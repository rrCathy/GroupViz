"""
GroupViz GAP 桥接服务（懒加载、可选加速器）。

探测顺序：环境变量 GAP_EXECUTABLE → PATH 中的 gap → Windows Cygwin 默认安装
（C:\\GAP\\GAP\\runtime\\opt\\gap-4.16.0\\gap.exe，经 runtime\\bin\\bash.exe 调用）。

每次计算启动一次性 GAP 子进程（stdin 管道喂脚本），以 GV_BEGIN/GV_END 行协议取回 JSON：
    GV_BEGIN
    <json>
    GV_END

GAP 不可用 / 出错时抛出异常，调用方（main.py）降级为纯 Python 行为，不改变现有行为。

id 映射约定：仅对置换群（IsPermGroup）启用——元素 id = 逗号排列串（ListPerm(p, n) 的函数值，
与后端 create_symmetric / create_alternating 及前端 TS 的元素 id 完全一致）。
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Any, Optional

GAP_TIMEOUT = 120  # 单次 GAP 计算秒数上限
MAX_IMPORT_ORDER = 4096  # 导入群最大阶守卫

_GAP_INFO: Optional[tuple[str, str]] = None  # ("direct" | "cygwin", executable)
_GAP_PROBED = False
_GAP_LOCK = threading.Lock()
_GAP_EXEC_LOCK = threading.Lock()  # 串行化 GAP 子进程（避免并发 OOM / 资源竞争）

_GV_HELPERS = r"""
GV_str := function(s)
    local r, c;
    r := "";
    for c in s do
        if c = '"' then
            Add(r, '\\');
            Add(r, '"');
        elif c = '\\' then
            Add(r, '\\');
            Add(r, '\\');
        else
            Add(r, c);
        fi;
    od;
    return Concatenation("\"", r, "\"");
end;

GV_ser := function(x)
    local i, r;
    if x = fail then
        return "null";
    fi;
    if IsInt(x) then
        return String(x);
    fi;
    if IsBool(x) or IsChar(x) then
        return String(x);
    fi;
    if IsString(x) then
        return GV_str(x);
    fi;
    if IsList(x) then
        r := "[";
        for i in [1 .. Length(x)] do
            if i > 1 then
                Append(r, ",");
            fi;
            Append(r, GV_ser(x[i]));
        od;
        Append(r, "]");
        return r;
    fi;
    return GV_str(String(x));
end;

GV_output := function(x)
    Print("GV_BEGIN\n");
    Print(GV_ser(x));
    Print("\nGV_END\n");
end;
"""

# 批量计算主体（GV_result 在结尾赋值，body 由调用方注入）。
# 元素枚举序约定（2026-08-17 定案）：GV_els := Elements(原始群 G)（不替换 G），
# keys = 每个原始元素的置换像 ListPerm —— 与 import 响应（MultiplicationTable(G)
# 同按 Elements(G) 行序）严格对齐；非置换群（PC/矩阵群等）经 IsomorphismPermGroup
# 转置换表示计算其结构数据，转换失败/无小表示时 GAP 报错 → GapComputeError。
# GV_id_pos = 恒等元在 Elements(G) 中的位置（1-based），供主服务校验位置映射。
# 载荷： [is_perm_group, keys, id_pos, subgroups, edges, classes, center, derived, props]
_GV_COMPUTE_ALL = r"""
GV_iso := IsomorphismPermGroup(G);
GV_els := Elements(G);
GV_img := Image(GV_iso);
GV_deg := LargestMovedPoint(GV_img);
GV_keys := List(GV_els, x -> JoinStringsWithSeparator(ListPerm(Image(GV_iso, x), GV_deg), ","));
GV_id_pos := Position(GV_els, One(G));
GV_smap := rec();
for i in [1 .. Length(GV_els)] do
    GV_smap.(String(Image(GV_iso, GV_els[i]))) := i;
od;
GV_pos := x -> GV_smap.(String(x));

GV_subs := AllSubgroups(GV_img);
GV_sub_data := List(GV_subs, H ->
    [List(Elements(H), GV_pos), IsNormal(GV_img, H), Size(H)]);
GV_edges := [];
for i in [1 .. Length(GV_subs)] do
    for M in MaximalSubgroups(GV_subs[i]) do
        Add(GV_edges, [Position(GV_subs, M), i]);
    od;
od;

GV_classes := List(ConjugacyClasses(GV_img), c -> List(Elements(c), GV_pos));
GV_center := List(Elements(Center(GV_img)), GV_pos);
GV_derived := List(DerivedSeriesOfGroup(GV_img), H ->
    [List(Elements(H), GV_pos), Size(H)]);
GV_props := [IsSolvableGroup(GV_img), IsNilpotentGroup(GV_img), IsPerfectGroup(GV_img)];

GV_result := [IsPermGroup(GV_img), GV_keys, GV_id_pos, GV_sub_data, GV_edges,
              GV_classes, GV_center, GV_derived, GV_props];
"""

# 载荷： [keys, id_pos, terms, factors]（terms 为原始群子群列，元素按原始枚举序）
_GV_COMPUTE_SERIES = r"""
GV_iso := IsomorphismPermGroup(G);
GV_els := Elements(G);
GV_img := Image(GV_iso);
GV_deg := LargestMovedPoint(GV_img);
GV_keys := List(GV_els, x -> JoinStringsWithSeparator(ListPerm(Image(GV_iso, x), GV_deg), ","));
GV_id_pos := Position(GV_els, One(G));
GV_smap := rec();
for i in [1 .. Length(GV_els)] do
    GV_smap.(String(Image(GV_iso, GV_els[i]))) := i;
od;
GV_pos_g := x -> GV_smap.(String(Image(GV_iso, x)));

GV_terms := {series_expr};
GV_terms := Filtered(GV_terms, x -> IsGroup(x));
GV_term_data := List(GV_terms, H -> [List(Elements(H), GV_pos_g), Size(H)]);
GV_factors := [];
for i in [1 .. Length(GV_terms) - 1] do
    F := FactorGroup(GV_terms[i], GV_terms[i + 1]);
    Add(GV_factors, [Size(F), IsAbelian(F), IsSimpleGroup(F)]);
od;

GV_result := [GV_keys, GV_id_pos, GV_term_data, GV_factors];
"""

_GV_IMPORT = r"""
GV_out := fail;
if IsGroup(G) and IsFinite(G) then
    GV_n := Size(G);
    if GV_n <= {max_order} then
        GV_els := Elements(G);
        GV_table := MultiplicationTable(G);
        GV_gens := GeneratorsOfGroup(G);
        GV_smap := rec();
        for i in [1 .. Length(GV_els)] do
            GV_smap.(String(GV_els[i])) := i;
        od;
        GV_gen_pos := List(GV_gens, x -> GV_smap.(String(x)));
        GV_idents := List(GV_els, String);
        GV_struct := StructureDescription(G);
        GV_out := [GV_n, GV_table, GV_gen_pos, GV_idents, GV_struct];
    fi;
fi;
GV_result := GV_out;
"""


class GapUnavailableError(RuntimeError):
    pass


class GapTimeoutError(RuntimeError):
    pass


class GapComputeError(RuntimeError):
    pass


def _probe() -> Optional[tuple[str, str]]:
    """探测 GAP 可执行文件，结果缓存。返回 ("direct"|"cygwin", 可执行路径)。"""
    global _GAP_INFO, _GAP_PROBED
    with _GAP_LOCK:
        if _GAP_PROBED:
            return _GAP_INFO

        env = os.environ.get("GAP_EXECUTABLE", "").strip()
        if env:
            if os.path.isfile(env):
                _GAP_INFO = ("direct", env)
            elif shutil.which(env):
                _GAP_INFO = ("direct", shutil.which(env))
            else:
                _GAP_INFO = None

        if _GAP_INFO is None:
            path_gap = shutil.which("gap")
            if path_gap:
                _GAP_INFO = ("direct", path_gap)

        if _GAP_INFO is None:
            cand = r"C:\GAP\GAP\runtime\opt\gap-4.16.0\gap.exe"
            if os.path.isfile(cand):
                bash = r"C:\GAP\GAP\runtime\bin\bash.exe"
                if os.path.isfile(bash):
                    _GAP_INFO = ("cygwin", bash)
                else:
                    _GAP_INFO = ("direct", cand)

        _GAP_PROBED = True
        return _GAP_INFO


def is_available() -> bool:
    return _probe() is not None


def probe_info() -> Optional[tuple[str, str]]:
    """探测结果（("direct"|"cygwin", 可执行路径)），供 health 端点暴露。"""
    return _probe()


def _run_gap_raw(script: str) -> subprocess.CompletedProcess:
    """执行 GAP 脚本，返回 subprocess 结果对象。"""
    info = _probe()
    if info is None:
        raise GapUnavailableError("GAP executable not found")
    mode, exe = info

    # 根因修复（2026-08-17 实验定案）：GAP -b -q -c 'Read(...)' 脚本执行完
    # 后回到 REPL 继续读 stdin（脚本无 QUIT 时）。capture_output=True 默认
    # stdin=PIPE 且从不关闭 → GAP 死等 stdin EOF 永不退出；detached/后台
    # （Start-Process、服务、任务计划）无控制台句柄上下文尤其顽固（进程
    # 卡死直至 GNU timeout 120s 强杀 → exit 124 → 422）。
    # 双重修复：
    #   1) stdin=subprocess.DEVNULL —— Read 完立即读到 EOF 退出；
    #   2) CREATE_NEW_CONSOLE | CREATE_NO_WINDOW —— 显式分配隐藏控制台，
    #      覆盖其他需要控制台句柄的 Cygwin 初始化竞态。
    # 实测（detached）：修复后 import PSL(2,7) 2.9s rc=0（修复前挂 120s）。
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NO_WINDOW

    # 把脚本写入临时文件，经 `-c 'Read(...)'` 载入（Read 模式不回显语句，
    # 而 stdin/文件重定向会在 REPL 语义下回显每条赋值结果，污染 stdout 协议）。
    fd, tmp_path = tempfile.mkstemp(suffix=".g", prefix="gv_", dir=None)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(script)
        gpath = tmp_path.replace("\\", "/")
        try:
            if mode == "cygwin":
                inner = (
                    "cd /opt/gap-4.16.0 && timeout "
                    + str(GAP_TIMEOUT)
                    + " ./gap.exe -b -q -c 'Read(\""
                    + gpath
                    + "\");'"
                )
                proc = subprocess.run(
                    [exe, "--login", "-c", inner],
                    capture_output=True,
                    stdin=subprocess.DEVNULL,
                    timeout=GAP_TIMEOUT + 30,
                    creationflags=creation_flags,
                )
            else:
                proc = subprocess.run(
                    [exe, "-b", "-q", "-c", f'Read("{gpath}");'],
                    capture_output=True,
                    stdin=subprocess.DEVNULL,
                    timeout=GAP_TIMEOUT,
                    creationflags=creation_flags,
                )
        except subprocess.TimeoutExpired as e:
            raise GapTimeoutError(
                f"GAP computation timed out after {GAP_TIMEOUT}s"
            ) from e
        except OSError as e:
            raise GapUnavailableError(f"Failed to launch GAP: {e}") from e
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    if proc.returncode not in (0, None):
        raise GapComputeError(
            "GAP exited with code %s: %s"
            % (proc.returncode, proc.stderr.decode("utf-8", "replace")[-2000:])
        )
    return proc


def run_script(script: str) -> Any:
    """执行 GAP 脚本并解析 GV_BEGIN/GV_END 之间的 JSON 值。

    exit code 124 = bash GNU timeout 杀掉 GAP（Windows 无 console 环境下偶发：
    bash --login 初始化竞态）——重试一次；仍失败则照常抛 GapComputeError。
    """
    with _GAP_EXEC_LOCK:
        proc = _run_gap_raw(script)
        if proc.returncode == 124:
            time.sleep(2)
            proc = _run_gap_raw(script)
    stdout = proc.stdout.decode("utf-8", "replace")
    m = re.search(r"GV_BEGIN\n(.*?)\nGV_END", stdout, re.S)
    if not m:
        raise GapComputeError(
            "No GV_BEGIN/GV_END payload in GAP output: %s"
            % stdout[-2000:]
        )
    # GAP Print 按列宽自动断行：插入 "\" + LF。本协议数据（排列串/整数/布尔）
    # 不含反斜杠或换行，直接删除该组合即可还原 JSON 文本。
    payload = m.group(1).replace("\\\n", "")
    try:
        return json.loads(payload)
    except json.JSONDecodeError as e:
        raise GapComputeError(f"Invalid JSON from GAP: {e}") from e


def _build_script(expr: str, body: str) -> str:
    return (
        _GV_HELPERS
        + f"\nG := {expr};\n"
        + body
        + "\nGV_output(GV_result);\n"
    )


# ── 符号 → GAP 表达式 ─────────────────────────────────────────────────────────

def symbol_to_expr(symbol: str) -> Optional[str]:
    """把 GroupViz 群符号转成 GAP 构造表达式；不支持的符号返回 None。

    支持：S_n / A_n / C_n(Z_n) / D_n / V_4 / Q_8 / GL(n,q) / SL(n,q) / PGL(n,q) /
    PSL(n,q) / 直积 × / 幂 ^k。
    """
    from factory import _strip_braces, _parse_superscript, _split_direct_product

    s = _strip_braces(symbol.replace("×", "\\times"))

    def atom(text: str) -> Optional[str]:
        text = _strip_braces(text).strip()
        sup = _parse_superscript(text)
        if sup is not None:
            base, k = sup
            base_expr = atom(base)
            if base_expr is None or base_expr.startswith("DirectProduct"):
                return None
            return "DirectProduct(" + ",".join([base_expr] * k) + ")"
        dp = _split_direct_product(text)
        if dp is not None:
            a, b = dp
            ea, eb = atom(a), atom(b)
            if ea is None or eb is None:
                return None
            return f"DirectProduct({ea},{eb})"
        m = re.match(r"^S_(\d+)$", text)
        if m:
            return f"SymmetricGroup({m.group(1)})"
        m = re.match(r"^A_(\d+)$", text)
        if m:
            return f"AlternatingGroup({m.group(1)})"
        m = re.match(r"^(?:C|Z)_(\d+)$", text)
        if m:
            return f"CyclicGroup({m.group(1)})"
        m = re.match(r"^D_(\d+)$", text)
        if m:
            return f"DihedralGroup({2 * int(m.group(1))})"
        if text in ("V_4", "V4"):
            return "KleinFourGroup()"
        if text in ("Q_8", "Q8"):
            return "QuaternionGroup(8)"
        m = re.match(r"^GL\((\d+),(\d+)\)$", text)
        if m:
            return f"GL({m.group(1)},{m.group(2)})"
        m = re.match(r"^SL\((\d+),(\d+)\)$", text)
        if m:
            return f"SL({m.group(1)},{m.group(2)})"
        m = re.match(r"^PGL\((\d+),(\d+)\)$", text)
        if m:
            return f"PGL({m.group(1)},{m.group(2)})"
        m = re.match(r"^PSL\((\d+),(\d+)\)$", text)
        if m:
            return f"PSL({m.group(1)},{m.group(2)})"
        return None

    return atom(s)


# ── 元素索引 → 后端元素 dict ─────────────────────────────────────────────────

def _externalize(keys: list[str], indices: list[int], id_to_elem: dict) -> list[dict]:
    """GAP 索引列表 → [{id,label,value}]（经后端 Group 元素对齐）。"""
    out = []
    for idx in indices:
        el = id_to_elem.get(keys[idx - 1])
        if el is not None:
            out.append({"id": el.id, "label": el.label, "value": el.value})
        else:
            out.append({"id": keys[idx - 1], "label": keys[idx - 1], "value": [idx]})
    return out


# ── 批量计算（一次 GAP 调用完成子群 / 格 / 类 / 中心 / 性质）──────────────────

def compute_all_expr(expr: str) -> dict:
    """按 GAP 构造表达式全量计算（导入群用原始 expr，避免结构名重建顺序漂移）。

    返回（全部以 GAP 元素索引表示，索引 k 严格对应 Elements(原始群) 的第 k 行，
    即 import 响应乘法表行序；调用方用 keys/id_pos 对齐到后端 Group）：
      is_perm_group, keys, id_pos, subgroups([idx,is_normal,size]...),
      edges([pos_max,pos_sub]...), classes, center, derived([[idx],size]...),
      props[solvable,nilpotent,perfect]
    """
    script = _build_script(expr, _GV_COMPUTE_ALL)
    data = run_script(script)
    if not isinstance(data, list) or len(data) != 9:
        raise GapComputeError(f"unexpected GAP payload for {expr}")
    return {
        "is_perm_group": bool(data[0]),
        "keys": data[1],
        "id_pos": int(data[2] or 0),
        "subgroups": data[3],
        "edges": data[4],
        "classes": data[5],
        "center": data[6],
        "derived": data[7],
        "props": data[8],
    }


def compute_all(symbol: str) -> dict:
    """order>120 大群全量计算（符号 → GAP 表达式）。"""
    expr = symbol_to_expr(symbol)
    if expr is None:
        raise GapComputeError(f"symbol not supported by GAP: {symbol}")
    return compute_all_expr(expr)


# ── 子群列（series）───────────────────────────────────────────────────────────

_SERIES_EXPR = {
    "derived": "DerivedSeriesOfGroup(G)",
    "upperCentral": "UpperCentralSeriesOfGroup(G)",
    "lowerCentral": "LowerCentralSeriesOfGroup(G)",
    "composition": "CompositionSeries(G)",
}


def compute_series_expr(expr: str, series_type: str) -> dict:
    """按 GAP 表达式计算子群列：terms([[idx],size]... 从大到小) + factors。"""
    if series_type not in _SERIES_EXPR:
        raise GapComputeError(f"unknown series type: {series_type}")
    body = _GV_COMPUTE_SERIES.format(series_expr=_SERIES_EXPR[series_type])
    script = _build_script(expr, body)
    data = run_script(script)
    if not isinstance(data, list) or len(data) != 4:
        raise GapComputeError(f"unexpected series payload for {expr}")
    return {
        "keys": data[0],
        "id_pos": int(data[1] or 0),
        "terms": data[2],
        "factors": data[3],
    }


def compute_series(symbol: str, series_type: str) -> dict:
    """大群子群列（符号 → GAP 表达式）。"""
    if series_type not in _SERIES_EXPR:
        raise GapComputeError(f"unknown series type: {series_type}")
    expr = symbol_to_expr(symbol)
    if expr is None:
        raise GapComputeError(f"symbol not supported by GAP: {symbol}")
    return compute_series_expr(expr, series_type)


# ── 导入群 ────────────────────────────────────────────────────────────────────

def import_group(gap_expr: str) -> dict:
    """按任意 GAP 表达式构建群，返回乘法表等数据供前端重建。

    返回：
      order, table(1-based 索引矩阵), gens(1-based 生成元位置),
      idents(元素原生表示串), structure(StructureDescription)
    表达式非法 / 非有限群 / 超阶守卫 → GapComputeError（422 由调用方转）。
    """
    script = _build_script(
        gap_expr,
        _GV_IMPORT.format(max_order=MAX_IMPORT_ORDER),
    )
    data = run_script(script)
    if not isinstance(data, list) or len(data) != 5:
        raise GapComputeError(
            "GAP expression does not define a finite group with order <= %d"
            % MAX_IMPORT_ORDER
        )
    return {
        "order": data[0],
        "table": data[1],
        "gens": data[2],
        "idents": data[3],
        "structure": data[4],
    }
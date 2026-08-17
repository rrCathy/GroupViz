"""
GroupViz Backend — FastAPI server for group theory computations.

Usage:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    GroupInfoRequest, ComputeRequest, CosetsRequest,
    CayleyEdgesRequest, ElementOrderRequest, DirectProductRequest,
    SeriesRequest, ImportGroupRequest,
)
from factory import create_group_from_symbol
from group import Group, GroupElement, Generator, create_direct_product, _build_group
from algebra import (
    PERF_CUTOFF,
    compute_subgroups, compute_normal_subgroups,
    compute_conjugacy_classes, compute_center,
    compute_cosets, compute_subgroup_lattice,
    compute_cayley_edges, compute_element_order,
    compute_group_properties,
)
import gap_service
from gap_service import GapComputeError, GapUnavailableError, GapTimeoutError


# ── Caching ─────────────────────────────────────────────────────────────────

_group_cache: dict[str, Group] = {}
_subgroup_cache: dict[str, list] = {}  # symbol → low-level subgroup data
_gap_cache: dict[str, dict] = {}  # symbol → gap_service.compute_all 结果
_imported_groups: dict[str, Group] = {}  # symbol/gapExpr → 导入群（import-group 注册）
_imported_exprs: dict[str, str] = {}  # structure/gapExpr → 原始 GAP 表达式


def get_group(symbol: str) -> Group:
    """Get a group by symbol, with caching."""
    if symbol not in _group_cache:
        group = create_group_from_symbol(symbol)
        if group is None:
            group = _imported_groups.get(symbol)
        if group is None:
            raise ValueError(f"Cannot create group from symbol: {symbol}")
        _group_cache[symbol] = group
    return _group_cache[symbol]


def _word_label(word: tuple[int, ...]) -> str:
    """镜像前端 wordToLabel：连续同生成元合并为幂（a、a^2、a^{10}），空格连接。"""
    terms: list[tuple[int, int]] = []
    for gi in word:
        if terms and terms[-1][0] == gi:
            g, e = terms[-1]
            terms[-1] = (g, e + 1)
        else:
            terms.append((gi, 1))
    parts = []
    for g, e in terms:
        s = chr(97 + g)
        if e == 1:
            parts.append(s)
        elif 2 <= e < 10:
            parts.append(f"{s}^{e}")
        else:
            parts.append(f"{s}^{{{e}}}")
    return " ".join(parts)


def _import_word_labels(table: list[list[int]], gens: list[int], n: int) -> list[str]:
    """镜像前端 assignWordLabels：沿生成元 BFS 求最短词标签（单位元 'e'）。

    返回与原 Frontend 一致的单词标签（a、a b、a^{2} b …），使后端返回的
    子群/陪集/类元素标签与前端（createGroupFromImport 后 assignWordLabels）一致。
    """
    labels = [None] * n
    labels[0] = "e"
    if not gens:
        for k in range(n):
            if labels[k] is None:
                labels[k] = f"g_{{{k}}}"
        return labels
    words = {0: ()}
    queue = [0]
    head = 0
    while head < len(queue) and len(words) < n:
        cur = queue[head]
        head += 1
        for gi, gpos in enumerate(gens):
            nxt = table[cur][gpos - 1] - 1
            if nxt in words:
                continue
            words[nxt] = words[cur] + (gi,)
            labels[nxt] = _word_label(words[nxt])
            queue.append(nxt)
    for k in range(n):
        if labels[k] is None:
            labels[k] = f"g_{{{k}}}"
    return labels


def _build_group_from_import(data: dict) -> Group | None:
    """从 import-group 响应（乘法表/生成元/记号）构造后端 Group。

    元素 id = f"g{k}"（按表行序，与前端 createGroupFromImport 一致），
    label = 生成元最短词标签（与前端 assignWordLabels 一致）。
    返回 None 表示数据不可用（防御）。
    """
    try:
        table = data["table"]
        gens = data["gens"]
        idents = data["idents"]
    except (KeyError, TypeError):
        return None
    n = len(table)
    if n == 0 or len(idents) != n:
        return None
    labels = _import_word_labels(table, gens, n)
    elements = [
        GroupElement(id=f"g{k}", label=labels[k], value=[k]) for k in range(n)
    ]

    def mul(a: GroupElement, b: GroupElement) -> GroupElement:
        return elements[table[a.value[0]][b.value[0]] - 1]

    def inv(a: GroupElement) -> GroupElement:
        row = table[a.value[0]]
        return elements[row.index(1)]

    generators = [
        Generator(name=chr(97 + i), symbol=chr(97 + i), color="#ff6b6b")
        for i in range(len(gens))
    ]
    is_abelian = all(
        table[i][j] == table[j][i]
        for i in range(n) for j in range(i + 1, n)
    )
    symbol = data.get("structure") or f"Import({n})"
    return _build_group(
        name=symbol,
        symbol=symbol,
        elements=elements,
        generators=generators,
        multiply_fn=mul,
        inverse_fn=inv,
        identity=elements[0],
        is_abelian=is_abelian,
        exponent=None,
    )


# ── GAP 加速路径（order>120 的全量计算由 GAP 完成）───────────────────────────

def _gap_expr_for(symbol: str) -> Optional[str]:
    """GAP 构造表达式：导入群 → 原始 gap_expr（元素序与导入表严格一致）；
    内置符号 → symbol_to_expr。都不支持 → None（调用方降级纯 Python）。"""
    imported = _imported_exprs.get(symbol)
    if imported is not None:
        return imported
    return gap_service.symbol_to_expr(symbol)


def _gap_compute_all(symbol: str) -> dict | None:
    """GAP 全量计算（一次调用拿全部子群/格/类/中心/性质数据，进程内缓存）。

    不可用 / 符号不支持 → None，调用方降级纯 Python。
    导入群走原始 gap_expr（结构名重构建可能元素序漂移，禁止 symbol_to_expr）。
    """
    if symbol in _gap_cache:
        data = _gap_cache[symbol]
    else:
        if not gap_service.is_available():
            return None
        expr = _gap_expr_for(symbol)
        if expr is None:
            return None
        try:
            data = gap_service.compute_all_expr(expr)
        except (GapComputeError, GapUnavailableError, GapTimeoutError):
            return None
        _gap_cache[symbol] = data
    if not data["is_perm_group"]:
        return None
    return data


def _gap_positional_map(g: Group, keys: list[str], id_pos: int,
                        groups: Optional[list]) -> list[dict] | None:
    """位置映射校验：GAP 元素枚举序 == 后端表行序时返回元素 dict 列表。

    规则（全部通过才算有效，否则 None → 纯 Python 兜底）：
      1) keys 数 == 阶；
      2) GAP 恒等元位于枚举第 1 位（后端恒等元恒为 elements[0]）；
      3) 抽样子群（前 3 个 + 全部正规子群）在位置映射下仍是后端乘法的封闭子集。
    """
    if len(keys) != g.order or id_pos != 1:
        return None
    groups = groups or []
    checked = 0
    for raw in groups:
        indices, is_normal, size = raw[0], raw[1], raw[2]
        if checked >= 14:
            break
        if checked >= 3 and not is_normal:
            continue
        checked += 1
        els = [g.elements[i - 1] for i in indices]
        if len(els) != size:
            return None
        s = {e.id for e in els}
        if not all(g.multiply(x, y).id in s for x in els for y in els):
            return None
    return [{"id": e.id, "label": e.label, "value": e.value} for e in g.elements]


def _gap_elements(symbol: str, keys: list[str], id_pos: int,
                  groups: Optional[list] = None) -> list[dict] | None:
    """GAP keys → 后端元素 dict 列表。

    优先按 id 精确匹配（S_n/A_n 排列串）；存在失配时尝试位置映射（keys[k] ↔
    后端 elements[k]，校验见 _gap_positional_map）；失败返回 None。
    """
    g = get_group(symbol)
    id_to_elem = {e.id: e for e in g.elements}
    out = []
    for key in keys:
        el = id_to_elem.get(key)
        if el is None:
            return _gap_positional_map(g, keys, id_pos, groups)
        out.append({"id": el.id, "label": el.label, "value": el.value})
    return out


def _gap_subgroups(data: dict, elements: list[dict]) -> list[dict]:
    """GAP 子群原始数据 → 端点格式（按 order 升序，与纯 Python 语义一致）。"""
    subs = []
    for idxs, is_normal, size in data["subgroups"]:
        subs.append({
            "elements": [elements[i - 1] for i in idxs],
            "is_normal": bool(is_normal),
            "order": size,
        })
    subs.sort(key=lambda s: s["order"])
    return subs


def _gap_lattice(data: dict, elements: list[dict]) -> dict:
    """GAP Hasse 边（[pos_max, pos_sub]，GAP AllSubgroups 顺序）→ 端点格式。"""
    m = len(data["subgroups"])
    subs = _gap_subgroups(data, elements)
    nodes = [
        {"id": i, "elements": sub["elements"], "order": sub["order"],
         "is_normal": sub["is_normal"], "level": 0}
        for i, sub in enumerate(subs)
    ]
    # GAP 下标 → 排序后下标（稳定排序保证同阶子群顺序不变）
    gap_rank = sorted(range(m), key=lambda i: (len(data["subgroups"][i][0]), i))
    new_of_gap = [0] * m
    for new, old in enumerate(gap_rank):
        new_of_gap[old] = new
    edges = [
        {"source": new_of_gap[pm - 1], "target": new_of_gap[ph - 1]}
        for pm, ph in data["edges"]
    ]
    # level 语义与 algebra.py 一致：level = max_level - order_rank（最小子群最高）；
    # rank 按「阶值」分配——同阶子群同层，避免稳定排序给每个节点独立 rank 导致竖线
    orders = sorted({nodes[i]["order"] for i in range(m)})
    order_rank = {order: rank for rank, order in enumerate(orders)}
    max_level = len(orders) - 1
    for i in range(m):
        nodes[i]["level"] = max_level - order_rank[nodes[i]["order"]]
    return {"nodes": nodes, "edges": edges}


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GroupViz API",
    description="Group theory computation backend for GroupViz",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ──────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    info = gap_service.probe_info()
    return {
        "status": "ok",
        "cached_groups": len(_group_cache),
        "gap": {
            "available": info is not None,
            "mode": info[0] if info is not None else None,
            "executable": info[1] if info is not None else None,
        },
    }


@app.post("/api/group-info")
async def group_info(req: GroupInfoRequest):
    """Get group structure: elements, generators, basic properties."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "symbol": g.symbol,
        "name": g.name,
        "order": g.order,
        "is_abelian": g.is_abelian,
        "exponent": g.exponent,
        "elements": [
            {"id": e.id, "label": e.label, "value": e.value}
            for e in g.elements
        ],
        "generators": [
            {"name": gen.name, "symbol": gen.symbol, "color": gen.color}
            for gen in g.generators
        ],
    }


@app.post("/api/compute/subgroups")
async def subgroups(req: ComputeRequest):
    """Find all subgroups of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], data["subgroups"])
            if elements is not None:
                subs = _gap_subgroups(data, elements)
                _subgroup_cache[req.symbol] = subs
                result = {"subgroups": subs, "total_count": len(subs), "source": "gap"}
                result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                return result
    result = compute_subgroups(g)
    _subgroup_cache[req.symbol] = result["subgroups"]
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/normal-subgroups")
async def normal_subgroups(req: ComputeRequest):
    """Find all normal subgroups of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], data["subgroups"])
            if elements is not None:
                normal = [s for s in _gap_subgroups(data, elements) if s["is_normal"]]
                result = {"normal_subgroups": normal, "total_count": len(normal), "source": "gap"}
                result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                return result
    result = compute_normal_subgroups(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/conjugacy-classes")
async def conjugacy_classes(req: ComputeRequest):
    """Compute conjugacy classes of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], data["subgroups"])
            if elements is not None:
                classes = [[elements[i - 1] for i in cls] for cls in data["classes"]]
                result = {"classes": classes, "source": "gap"}
            result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            return result
    result = compute_conjugacy_classes(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/center")
async def center(req: ComputeRequest):
    """Compute the center Z(G) of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], data["subgroups"])
            if elements is not None:
                center = [elements[i - 1] for i in data["center"]]
                result = {"center": center, "source": "gap"}
            result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            return result
    result = compute_center(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/cosets")
async def cosets(req: CosetsRequest):
    """Compute left and right cosets for a given subgroup."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_cosets(g, req.subgroup_element_ids)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    if result is None:
        raise HTTPException(status_code=400, detail="Invalid subgroup: not closed or invalid IDs")

    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/lattice")
async def lattice(req: ComputeRequest):
    """Compute the subgroup lattice (Hasse diagram)."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], data["subgroups"])
            if elements is not None:
                result = _gap_lattice(data, elements)
                result["source"] = "gap"
            result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            return result
    # Use cached subgroups if available to avoid recomputing
    cached_subs = _subgroup_cache.get(req.symbol)
    result = compute_subgroup_lattice(g, precomputed_subs=cached_subs)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/cayley-edges")
async def cayley_edges(req: CayleyEdgesRequest):
    """Compute Cayley graph edges for given action elements."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if req.multiply_type not in ("right", "left"):
        raise HTTPException(status_code=400, detail="multiply_type must be 'right' or 'left'")

    t0 = time.perf_counter()
    result = compute_cayley_edges(g, req.action_element_ids, req.multiply_type)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/element-order")
async def element_order(req: ElementOrderRequest):
    """Compute the order of a specific element."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_element_order(g, req.element_id)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    if result is None:
        raise HTTPException(status_code=400, detail=f"Element not found: {req.element_id}")

    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/direct-product")
async def direct_product(req: DirectProductRequest):
    """Create a direct product G × H on the server."""
    try:
        g_a = get_group(req.symbol_a)
        g_b = get_group(req.symbol_b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    dp = create_direct_product(g_a, g_b)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    # Cache it
    _group_cache[dp.symbol] = dp

    return {
        "symbol": dp.symbol,
        "name": dp.name,
        "order": dp.order,
        "is_abelian": dp.is_abelian,
        "exponent": dp.exponent,
        "elements": [
            {"id": e.id, "label": e.label, "value": e.value}
            for e in dp.elements
        ],
        "generators": [
            {"name": gen.name, "symbol": gen.symbol, "color": gen.color}
            for gen in dp.generators
        ],
        "elapsed_ms": elapsed,
    }


@app.post("/api/compute/properties")
async def group_properties(req: ComputeRequest):
    """Solvable / nilpotent / perfect + derived series for a group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    if g.order > PERF_CUTOFF:
        data = _gap_compute_all(req.symbol)
        if data is not None:
            series_orders = [size for _, size in data["derived"]]
            solvable, nilpotent, perfect = (bool(p) for p in data["props"])
            result = {
                "derived_series_orders": series_orders,
                "solvable": solvable,
                "nilpotent": nilpotent,
                "perfect": perfect,
                "source": "gap",
            }
            result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            return result
    result = compute_group_properties(g)
    result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return result


@app.post("/api/compute/series")
async def series(req: SeriesRequest):
    """子群列（大群走 GAP）：derived / upperCentral / lowerCentral / composition。

    terms 从大到小（G ⊵ N₁ ⊵ …），factors = 逐级因子 Nᵢ/Nᵢ₊₁。
    """
    if not gap_service.is_available():
        raise HTTPException(status_code=503, detail="GAP backend not available")
    t0 = time.perf_counter()
    expr = _gap_expr_for(req.symbol)
    if expr is None:
        raise HTTPException(status_code=400, detail="symbol not supported by GAP")
    try:
        data = gap_service.compute_series_expr(expr, req.series_type)
    except GapComputeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    terms_groups = [(t[0], False, t[1]) for t in data["terms"]]
    try:
        elements = _gap_elements(req.symbol, data["keys"], data["id_pos"], terms_groups)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if elements is None:
        raise HTTPException(status_code=400, detail="GAP element order mismatch")

    terms = [
        {"elements": [elements[i - 1] for i in idxs], "order": size}
        for idxs, size in data["terms"]
    ]
    factors = [
        {"order": f[0], "is_abelian": bool(f[1]), "is_simple": bool(f[2])}
        for f in data["factors"]
    ]
    return {
        "symbol": req.symbol,
        "series_type": req.series_type,
        "terms": terms,
        "factors": factors,
        "source": "gap",
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
    }


@app.post("/api/compute/import-group")
def import_group(req: ImportGroupRequest):
    """按任意 GAP 表达式构建有限群：乘法表 + 生成元 + 元素标识 + 结构描述。

    表达式非法 / 非有限群 / 超 4096 阶守卫 → 422。
    """
    if not gap_service.is_available():
        raise HTTPException(status_code=503, detail="GAP backend not available")
    t0 = time.perf_counter()
    try:
        data = gap_service.import_group(req.gap_expr)
    except GapComputeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # 注册导入群，使后续 compute 端点（subgroups/lattice/...）可以解析其符号；
    # 同时注册 结构名 → 原始 gap_expr，GAP 全量计算必须重跑原始表达式
    #（结构名经 symbol_to_expr 重建可能元素枚举序漂移，与导入乘法表行序脱节）。
    built = _build_group_from_import(data)
    if built is not None:
        structure = data.get("structure") or built.symbol
        _imported_groups[structure] = built
        _imported_groups[req.gap_expr] = built
        _imported_exprs[structure] = req.gap_expr
        _imported_exprs[req.gap_expr] = req.gap_expr

    return {
        "gap_expr": req.gap_expr,
        "order": data["order"],
        "table": data["table"],
        "gens": data["gens"],
        "idents": data["idents"],
        "structure": data["structure"],
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
    }


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

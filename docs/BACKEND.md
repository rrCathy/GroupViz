# 后端系统（FastAPI）与混合计算

## 1. 概述

GroupViz 采用**混合计算系统**：小群（order ≤ 60）在浏览器内用 TypeScript 本地计算；大群（order > 60）委托 Python FastAPI 后端计算。后端同时提供批量导出、服务端直积构建等能力。

**核心阈值**：`LARGE_ORDER_CUTOFF = 60`

## 2. 启动方式

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

或用前端托管脚本（推荐，node 常驻父进程保活，详见 §6 的 detached 修复）：

```bash
npm run backend            # 带 --reload（开发）
npm run backend -- --no-reload   # 无重载
```

Vite 开发服务器将 `/api` 代理到 `http://localhost:8000`（vite.config.ts proxy）。

## 3. 后端结构

| 文件 | 说明 |
|------|------|
| `backend/main.py` | FastAPI 入口 + REST 路由 |
| `backend/group.py` | Python 群实现（Cayley 表预计算） |
| `backend/algebra.py` | 代数计算（子群/共轭类/陪集/子群格） |
| `backend/factory.py` | 符号 → 群对象工厂 |
| `backend/schemas.py` | Pydantic 请求/响应模型 |
| `backend/gap_service.py` | GAP 4.16 集成层（direct/cygwin 双模式探测、表达式翻译、序列化调用） |
| `backend/requirements.txt` | Python 依赖 |
| `backend/test_main.py` | 后端 API 测试 |

## 4. API 端点

`src/utils/api.ts` 提供客户端函数：

| 方法 | 端点 | 客户端函数 | 说明 |
|------|------|-----------|------|
| GET | `/api/health` | `fetchHealth()` | 健康检查，返回 `{status, cached_groups, gap:{available, mode, executable}}` |
| POST | `/api/compute/subgroups` | `fetchSubgroups()` | 计算子群 |
| POST | `/api/compute/normal-subgroups` | `fetchNormalSubgroups()` | 仅计算正规子群 |
| POST | `/api/compute/conjugacy-classes` | `fetchConjugacyClasses()` | 计算共轭类 |
| POST | `/api/compute/center` | `fetchCenter()` | 计算群中心 |
| POST | `/api/compute/cayley-edges` | `fetchCayleyEdges()` | 计算 Cayley 图边 |
| POST | `/api/compute/element-orders` | `fetchElementOrders()` | 计算多个元素的阶 |
| POST | `/api/compute/lattice` | `fetchLattice()` | 计算子群格（Hasse 图） |
| POST | `/api/compute/direct-product` | `fetchDirectProduct()` | 服务端直积构建 |
| POST | `/api/compute/series` | `fetchSeries()` | 子群列（derived/upperCentral/lowerCentral/composition），terms+factors |
| POST | `/api/compute/import-group` | `fetchImportGroup()` | 任意 GAP 表达式导入（SymmetricGroup(3)→S3、SmallGroup(16,8)→QD16，≤4096 阶，非法 422）；**导入群自动注册**（`_imported_groups`：structure + gapExpr 双键，get_group 回退命中），导入后 subgroups/lattice/classes/center/properties/series 全链路可用；PSL 等非置换表示经 `IsomorphismPermGroup` 转置换 |

所有 POST 请求体统一为 `{symbol, embedding?, multiply_type, action_ids?, element_ids?}`。

## 5. 服务端缓存

- `_group_cache`：群对象构建结果（key=群符号）
- `_subgroup_cache`：子群/正规子群（key=群符号），lattice 端点复用避免重复计算
- `_gap_cache`：GAP 计算全量结果（key=群符号），进程内缓存，S₆ 首算 ≈13s 后毫秒级

## 6. GAP 大群计算引擎（v1.13.0）

`backend/gap_service.py` 集成 **GAP 4.16** 作为大群结构计算引擎：

- **模式探测**：direct（直接 `gap.exe -b -q`）/ cygwin（`bash.exe --login -c 'cd /opt/gap-4.16.0 && timeout 120 ./gap.exe …'` 双模式）
- **detached 卡死修复（2026-08-17 定案）**：Cygwin 版 GAP 在 detached/后台（Start-Process、服务）环境曾必挂 120s（exit 124 → 422）。根因：`-b -q -c 'Read(...)'` 脚本执行完回到 REPL 死等 stdin EOF（capture_output 的 stdin=PIPE 永不关闭），无控制台句柄上下文更顽固。`_run_gap_raw` 双重修复：`stdin=subprocess.DEVNULL`（Read 完立即 EOF 退出）+ `CREATE_NEW_CONSOLE | CREATE_NO_WINDOW`（显式隐藏控制台，覆盖其他初始化竞态）。实测 detached 下 import PSL(2,7) 3.3s 成功（修复前 90s+ 挂起）
- **表达式翻译**：`symbol_to_expr`（Cₙ/Zₙ→CyclicGroup(n)、Dₙ→DihedralGroup(2n)、V₄、Q₈、GL(2,q)、直积/幂^k），不认识的符号返回 None → 纯 Python 降级
- **序列化**：`GV_ser` 自定义序列化（群元素→置换/binary string、子群→下标列表），`run_script` 进程串行锁 + `GV_BEGIN/GV_END` 标记提取 + 15s 超时
- **自动切换**：subgroups/normal-subgroups/conjugacy-classes/center/lattice/properties 六端点 >120 阶且 GAP 可用时自动走 GAP（响应带 `source: "gap"`）；GAP 不可用/非置换群/表达式不支持 → 回退纯 Python
- **S₆ 参考数据**：1455 子群 / 6469 格边 / 11 共轭类（类大小 [1,15,45,15,40,120,40,90,90,144,120]）/ 中心 {e} / 导列 [720,360]
- **前端就绪层**：`fetchBackendSeries`（hybridCompute.ts）在 order > SERIES_MAX_ORDER=240 时自动切后端 series 端点，GroupSeriesContext.gapSeries 供 SubgroupLatticeView 底部链式面板显示

## 6. 混合计算层（src/utils/hybridCompute.ts）

| 函数 | 说明 |
|------|------|
| `createEmptyBackendCache()` | 空缓存初始状态 |
| `computeSubgroups(group, cache)` | 小群本地计算，大群从后端缓存读取 |
| `computeConjugacyClasses(group, cache)` | 同上模式 |
| `computeCenter(group, cache)` | 同上模式 |
| `computeIsSimple(group, cache)` | 利用缓存子群判断单群 |
| `fetchBackendResults(group, setCache)` | 主调度：先取子群（预热），再并行取共轭类/中心/子群格/群性质；**后端失败时自动本地兜底**（见 §8） |
| `fetchBackendCayleyEdges(group, actions, type)` | 异步 Cayley 边，小群本地降级 |
| `fetchBackendElementOrder(group, elementIds)` | 异步元素阶，小群本地降级 |

**BackendCache 结构**：`{subgroups, normalSubgroups, conjugacyClasses, center, isSimple, lattice, isSolvable, isNilpotent, isPerfect, derivedSeriesOrders, loading, error, groupSymbol}`。

## 7. 数据流

```
选择群 → isLargeGroup = order > 60
  ├─ false → 本地 TypeScript（subgroups.ts / forceLayout.ts 等）
  └─ true  → fetchBackendResults() → API → GroupContext 更新 backendCache
             右侧面板显示「正在从后端计算群结构...」
```

## 8. 边界与限制

- 半直积、自同构群、商群等**不参与后端计算**，全部本地 TypeScript
- 大群 UI 守卫：子群/共轭类/中心 cutoff 60；Cayley 边预算限流 `max(120, order*3)`
- 后端不可用时（未启动/报错），**前端本地兜底**：`fetchBackendResults` 的 catch 分支调用 `computeLocalFallbackResults(group)`（`src/utils/hybridCompute.ts`）全量本地重算子群/共轭类/中心/子群格/群性质。兜底上限 `FALLBACK_CUTOFF = 240`（覆盖直积/半直积上限 144 与 S₅=120），超过则返回空兜底防浏览器卡死。`findAllSubgroups` 已 idx 化（乘法表/逆元表查表 + pair-join 剪枝），S₅（120 阶）本地兜底约 2.6s，S₄×S₃（144 阶）约 4s
- **顶部进度条**：大群计算（`backendCache.loading && isLargeGroup`）超过 3s 时显示 `TopProgressBar`（`src/components/TopProgressBar.tsx`，fixed 顶部 3px，CSS `animation-delay: 3s`，动画运行在 compositor，主线程被同步兜底阻塞时依然可见）

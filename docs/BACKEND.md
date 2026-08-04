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

Vite 开发服务器将 `/api` 代理到 `http://localhost:8000`（vite.config.ts proxy）。

## 3. 后端结构

| 文件 | 说明 |
|------|------|
| `backend/main.py` | FastAPI 入口 + REST 路由 |
| `backend/group.py` | Python 群实现（Cayley 表预计算） |
| `backend/algebra.py` | 代数计算（子群/共轭类/陪集/子群格） |
| `backend/factory.py` | 符号 → 群对象工厂 |
| `backend/schemas.py` | Pydantic 请求/响应模型 |
| `backend/requirements.txt` | Python 依赖 |
| `backend/test_main.py` | 后端 API 测试 |

## 4. API 端点

`src/utils/api.ts` 提供客户端函数：

| 方法 | 端点 | 客户端函数 | 说明 |
|------|------|-----------|------|
| GET | `/api/health` | `fetchHealth()` | 健康检查，返回 `{status, cached_groups}` |
| POST | `/api/compute/subgroups` | `fetchSubgroups()` | 计算子群 |
| POST | `/api/compute/normal-subgroups` | `fetchNormalSubgroups()` | 仅计算正规子群 |
| POST | `/api/compute/conjugacy-classes` | `fetchConjugacyClasses()` | 计算共轭类 |
| POST | `/api/compute/center` | `fetchCenter()` | 计算群中心 |
| POST | `/api/compute/cayley-edges` | `fetchCayleyEdges()` | 计算 Cayley 图边 |
| POST | `/api/compute/element-orders` | `fetchElementOrders()` | 计算多个元素的阶 |
| POST | `/api/compute/lattice` | `fetchLattice()` | 计算子群格（Hasse 图） |
| POST | `/api/compute/direct-product` | `fetchDirectProduct()` | 服务端直积构建 |

所有 POST 请求体统一为 `{symbol, embedding?, multiply_type, action_ids?, element_ids?}`。

## 5. 服务端缓存

- `_group_cache`：群对象构建结果（key=群符号）
- `_subgroup_cache`：子群/正规子群（key=群符号），lattice 端点复用避免重复计算

## 6. 混合计算层（src/utils/hybridCompute.ts）

| 函数 | 说明 |
|------|------|
| `createEmptyBackendCache()` | 空缓存初始状态 |
| `computeSubgroups(group, cache)` | 小群本地计算，大群从后端缓存读取 |
| `computeConjugacyClasses(group, cache)` | 同上模式 |
| `computeCenter(group, cache)` | 同上模式 |
| `computeIsSimple(group, cache)` | 利用缓存子群判断单群 |
| `fetchBackendResults(group, setCache)` | 主调度：先取子群（预热），再并行取共轭类/中心/子群格 |
| `fetchBackendCayleyEdges(group, actions, type)` | 异步 Cayley 边，小群本地降级 |
| `fetchBackendElementOrder(group, elementIds)` | 异步元素阶，小群本地降级 |

**BackendCache 结构**：`{subgroups, normalSubgroups, conjugacyClasses, center, isSimple, lattice, loading, error, groupSymbol}`。

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
- 后端不可用时（未启动），大群视图降级：子群格等区域显示错误/空状态

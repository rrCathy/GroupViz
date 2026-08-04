# GroupViz - 群论可视化 WEB 应用开发框架

## 1. 项目概述

**GroupViz** 是一个用于可视化和探索群论的交互式 WEB 应用，通过动态图形帮助数学研究者、学生理解抽象代数概念。

### 核心特性

- **群结构可视化**：子群、陪集、正规子群、商群、中心、共轭类、子群格
- **群运算可视化**：Cayley 表、乘法表、运算律验证
- **定理可视化**：Lagrange 定理、Cayley 定理、第一同构定理（动画证明）、轨道-稳定子定理
- **Cayley 图可视化**：2D/3D 广义 Cayley 图（任意群元素作用边，非仅生成元）
- **群构建系统**：直积 G×H、半直积 N⋊_φ H、自同构群 Aut(G)、商群 G/N、同态映射
- **交互**：拖拽、缩放、动画、多视图浮动窗口、视图导出（SVG/PNG/GIF）

> **可视化方案参考**：若对可视化方案不理解（元素如何摆放、边如何连接、视图长什么样），请阅读 `refer/` 目录下的参考书籍，尤其《群论彩图版》（Visual Group Theory，Nathan Carter 著）——Cayley 图、群作用、陪集等约定均以其为准。

> **界面模式（硬核模式）**：当前 UI 定位为**硬核模式**（面向研究者/数学用户，欢迎页 + 三栏工作台）。后续计划开发**教育模式**（引导式学习欢迎页与教学视图），届时按模式切换入口与样式。欢迎页"即将推出"列表：教育模式、Sylow 型可视化、自由群、DLC（空间群/点群可视化）。

## 2. 文档导航

详细技术文档已拆分至 `docs/` 目录（本文件为精简索引）：

| 文档 | 内容 |
|------|------|
| [docs/GROUPS.md](docs/GROUPS.md) | 群实现：核心类型、群族表、直积/半直积/自同构、小群注册表、群工厂、代数函数、数学参考 |
| [docs/CAYLEY.md](docs/CAYLEY.md) | Cayley 图系统：边计算、2D/3D 渲染、17 种 3D 形状模板、10 种 2D 形状布局 |
| [docs/VIEWS.md](docs/VIEWS.md) | 9 种视图模式：集合/凯莱图/圆圈图/乘法表/3D/对称性/子群格/同态/陪集条带 + 多视图 |
| [docs/STATE.md](docs/STATE.md) | 状态管理：9 Provider 分层、子集/陪集/同态/商群状态、持久化 key、导出、i18n/主题 |
| [docs/BACKEND.md](docs/BACKEND.md) | 后端系统：FastAPI 端点、服务端缓存、混合计算（≤60 本地 / >60 后端） |
| [docs/UI.md](docs/UI.md) | UI 结构：三栏布局、左侧 5 面板、右侧双模式、组件清单、i18n 键缺口 |
| [docs/TESTING.md](docs/TESTING.md) | 测试体系：26 文件 483 tests、vitest 配置、覆盖率、测试约定 |

## 3. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React + TypeScript | ^19.2.5 / ~6.0.2 | UI 框架（函数式组件 + Hooks） |
| Vite | ^8.0.9 | 构建工具（含 /api → 后端代理） |
| Three.js + React Three Fiber | ^0.184.0 / ^9.6.0 | 3D 渲染 |
| Python FastAPI + Uvicorn | ^3.12 / ^0.115+ | 后端计算引擎（大群结构计算） |
| KaTeX | ^0.16+ | 数学渲染（全应用 TeX 渲染） |
| gifenc | ^1.0.3 | GIF 导出（对称性视图） |
| Vitest | ^4.1.5 | 单元测试 |

> 样式通过全局 CSS 自定义属性实现，**不依赖** Tailwind 或任何 CSS 框架。

## 4. 目录结构

```
GroupViz/
├── src/
│   ├── __tests__/              # 26 个测试文件（483 tests），见 docs/TESTING.md
│   ├── components/
│   │   ├── Canvas/             # GroupCanvas/SetView/CycleView/TableView/Cayley3DView/
│   │   │                       # SymmetryView/SubgroupLatticeView/FloatingViewWindow/
│   │   │                       # DirectProductView/CosetStripView/HomomorphismView/
│   │   │                       # FirstIsomorphismAnimation/SemidirectProductView/
│   │   │                       # AutomorphismPreviewPopup
│   │   ├── Panels/             # LeftPanel/RightPanel/AccordionSection/BasicGroupPanel/
│   │   │                       # ViewPanel(视图+导出)/OperationsPanel(4 tab)/
│   │   │                       # DirectProductPanel/HomomorphismPanel/
│   │   │                       # SemidirectProductPanel/TabBar/constants.ts
│   │   ├── Tex.tsx             # KaTeX 渲染组件
│   │   └── WelcomePage.tsx     # 欢迎页（群记号预览弹窗、赞助链接）
│   ├── core/
│   │   ├── types.ts            # 核心类型 + 群性质检测函数
│   │   ├── groups/             # SymmetricGroup/CyclicGroup/DihedralGroup/AlternatingGroup/
│   │   │                       # SpecialGroup(V4,Q8)/SmallGroups(注册表)/DirectProduct/
│   │   │                       # SemidirectProduct
│   │   ├── algebra/            # subgroups/homomorphisms/automorphisms/cayleyEdges/
│   │   │                       # forceLayout/cayleyEdges/cycleLayouts/ringOrder/
│   │   │                       # shapeLayouts/layout3D
│   │   ├── polyhedra.ts        # 多面体顶点生成（截角四面体/立方体/二十面体等）
│   │   ├── elementRotation.ts  # 群元素→几何旋转变换映射
│   │   └── viewBox.ts
│   ├── context/                # 9 个 Provider 分层（见 docs/STATE.md）
│   │   ├── core/ backend/ cayley/ subsets/ symmetry/ directProduct/
│   │   ├── multiview/ homomorphism/ semidirectProduct/
│   │   ├── GroupContext.tsx    # 组合容器（注册 window.__groupVizExport__ 导出桥）
│   │   ├── useGroup.ts
│   │   └── cayleyActions.ts cosetActions.ts directProductActions.ts positionUtils.ts
│   ├── utils/                  # texify(TeX转换)/export/exportApi/api/hybridCompute/groupFactory
│   ├── theme/  i18n/  types/  hooks/
│   ├── App.tsx                 # 欢迎页 + 三栏布局 + 键盘事件 + 会话保存恢复
│   └── main.tsx
├── backend/                    # FastAPI（main/group/algebra/factory/schemas/test_main）
├── docs/                       # 本文档体系（见 §2）
├── scripts/batch-export.mjs    # Playwright 批量导出 CLI（npm run export）
├── refer/                      # 可视化参考书籍（《群论彩图版》等）
└── package.json / vite.config.ts / vitest.config.ts / eslint.config.js
```

## 5. 当前状态

- ✅ 9 种视图模式：set / cayley / cycle / table / 3d / symmetry / sublattice / homomorphism / cosetstrip
- ✅ 群族：Sₙ(2-5)、Cₙ(2-120)、Dₙ(3-8)、Aₙ(3-5)、V₄、Q₈、直积 G×H、**半直积 N⋊_φ H**、**自同构群 Aut(G)**、商群 G/N（UI 上限出于性能：S₅=120 在本地兜底 FALLBACK_CUTOFF=240 内，S₆=720 超限故不提供）
- ✅ 广义 Cayley 图：右乘/左乘切换、任意元素作用边、10 种 2D 形状（含 rewiring）、17 种 3D 形状模板（按群性质自动分配）
- ✅ 对称性视图：多面体几何 + 元素操作动画 + 旋转轴/交点标记（运行时从几何数据计算）
- ✅ 同态映射系统：创建/验证/性质分析 + 第一同构定理动画
- ✅ 半直积构建：5 预设、φ 映射 UI、4 步构建动画、rewiring 布局与不动点高亮
- ✅ 混合计算：小群本地 TS（≤60），大群 FastAPI 后端（>60）+ 缓存；**后端不可用时前端本地兜底**（FALLBACK_CUTOFF=240 内全量重算，S₅ 约 2.6s），大群计算 >3s 显示顶部进度条（TopProgressBar）
- ✅ 小群预计算注册表（阶 1-15，27 条）
- ✅ 多视图浮动窗口、子集保存与分析、陪集分解（Lagrange 验证）、自逆元素检测
- ✅ KaTeX 全应用渲染、i18n 中英文、深/浅主题、会话保存与恢复
- ✅ 视图导出：SVG/PNG/GIF + 批量导出 CLI（`npm run export`）
- ✅ 测试体系：26 文件 483 tests 全绿（`npm run test`），core/utils 覆盖率 75.8%（`npm run test:coverage`）

## 6. 运行命令

```bash
npm run dev            # 开发启动
npm run build          # 生产构建（tsc -b && vite build）
npm run preview        # 预览构建
npm run lint           # ESLint 检查
npm run test           # 全部测试（vitest run）
npm run test:watch     # 测试监听
npm run test:coverage  # 覆盖率（v8 → coverage/）
npm run export         # Playwright 批量导出 → exports/batch-<timestamp>/
# 后端（大群计算需要）：
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 7. 开发规范

- 组件：函数式 + Hooks；命名 PascalCase 组件 / camelCase 函数与 Hook / UPPER_SNAKE_CASE 常量
- 数学符号：统一 KaTeX（`texify()` + `<Tex>` / `renderTex()`），不用 Unicode 上下标显示
- 状态：遵循 9 Provider 分层架构，新状态按领域放入对应子 Provider，经 `useGroup()` 聚合暴露
- 测试：改代码必写/更新测试并跑 `npm run test` + `npm run lint`；纯计算逻辑（core/algebra、core/groups）优先补测试
- 风险分级：鉴权/数据库/资金/核心架构改动需人工审查；常规改动（UI、内部逻辑、测试）自测自审后直接推进
- ESLint + TypeScript 严格检查，提交前保证 `npm run lint` 无错误

## 8. 数学参考速查

### 8.1 广义 Cayley 图

设 G 是群，C 是 G 的任意元素子集（不限于生成集）。顶点 = G 的元素；对 c∈C：
- **右乘**：`a·c = b` ⇒ 有向边 a→b；**左乘**：`c·a = b` ⇒ 有向边 a→b
- 若 `a·c = b` 且 `b·c = a`（c 自逆）⇒ 无向边（不画箭头）
- 当 C 是生成集时退化为标准 Cayley 图

### 8.2 颜色编码

16 色调色板 `COLOR_PALETTE`，按群元素作用添加顺序分配：
`#ff6b6b #4ecdc4 #ffd93d #a78bfa #f97316 #06b6d4 #84cc16 #f43f5e #38bdf8 #a855f7 #14b8a6 #eab308 #6366f1 #ec4899 #0ea5e9 #22c55e`

### 8.3 关键定理

| 定理 | 内容 | 可视化重点 |
|------|------|-----------|
| Lagrange | \|H\| 整除 \|G\| | 陪集划分、陪集条带 `|G|=|H|·[G:H]` |
| Cayley | G ≅ S(G) 子群 | 正则作用 |
| 第一同构 | G/ker ≅ im | 核与像、四阶段动画 |
| 轨道-稳定子 | \|G\| = \|O\|·\|S\| | 群作用 |

### 8.4 性能守卫

- 本地/后端阈值：order ≤ 60 本地，> 60 后端
- 子群/共轭类/中心 cutoff：60；Cayley 边限流：`max(120, order*3)`
- findAllAutomorphisms：生成元映射组合 > 30000 直接返回 []（如 Z₂⁴）
- 直积/半直积最大阶：144

---

*文档版本: 1.7.0*
*最后更新: 2026-08-04*

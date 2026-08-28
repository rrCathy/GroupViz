# 路线图 (Roadmap)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-08-04（三阶段规划讨论结论）。本文件为规划性文档，随开发推进持续更新。
> **本文档只列未做事项**：已完成的里程碑与逐次开发记录已移至 [docs/CHANGELOG.md](CHANGELOG.md)。

## 0. 规划总览

GroupViz 的演进分三个阶段，逐级沉淀：

| 阶段 | 时间窗 | 名称 | 目标 |
|------|--------|------|------|
| 近期 | 2026-08 → 2026-10 | 功能夯实期 | 群作用/Sylow/数学缺口/GAP 大群引擎全部交付（见 CHANGELOG），近期收官 |
| 中期 | 2026-10 → 2027-04 | FGVE 引擎化 | 沉淀独立于 UI 的有限群可视化引擎 |
| 远期 | 2027-04 → 2027-12 | GVL 教学实验室 | 面向大学抽象代数课程的教学产品形态 |

核心决策（详见 §5）：近期已全部交付——群作用/Sylow + 数学缺口 M1–M4/M8；原 **E1「gappy 后端集成」经 2026-08-16 换道（弃 gappy 库，直连本机 GAP 4.16）后以 GAP 大群计算引擎 v1.13.0 交付，2026-08-23 正式关闭**；M5 移除、M6–M8/E2/P1–P3 按 2026-08-10 筛选标准不做（非可视化任务）；**FGVE 阶段目标升级为「UI 与算法解耦 + 产出可导出 npm 包」**（2026-08-25 定案，见 §2.8）：保持单仓库、不拆分 monorepo，以「仓库内子目录 + vite library mode 多入口」产出 **`@groupviz/core`**（纯算法，零 UI 依赖）+ **`@groupviz/react`**（视图组件，react/three/katex 作 peerDeps）双包；GVL 定位 **大学抽象代数课程配套**（Fraleigh / Dummit & Foote 风格）。

## 1. 近期：功能夯实期（2026-08 → 2026-10）

> ✅ 已交付（详见 [CHANGELOG.md](CHANGELOG.md)）：群作用系统（v1.8）、Sylow 定理可视化（1.9.0）、群展示系统（1.10.0）、数学缺口 M1–M4 与 M8（2026-08-10）、群结构分析升级/群族扩充/质量支撑项（2026-08-09/10）、2D/3D 布局系列优化与乘法表/导出等（2026-08-11~15，逐次记录见 CHANGELOG §2）。

### 1.1 剩余待办

无——近期功能夯实期已于 2026-08-23 收官。原 E1「gappy 后端集成」换道为直连 GAP 4.16 的大群计算引擎（v1.13.0：六端点 >120 阶自动切 GAP + `/series` + `/import-group`、进程缓存 + 15s 超时守卫、S₆ 全链路实测），IdGroup 已砍除；后续后端增强项（缓存/超时强化、特征标表端点、大群前端全链路验收）并入中期 §2.5。

### 1.2 明确不做（2026-08-10 筛选标准，见 §5）

- M5 第二/第三同构定理验证（纯数值验证、无可视化价值，随开发已移除）
- M6 阿贝尔化、M7 类方程验证行、M8 剩余部分（gappy IdGroup 已砍除）、E2 细节收尾、P1–P3 FGVE 预铺路——非可视化任务一律不做
- 群论计算器 / 多对象工作台方向搁置，作为独立新引擎另行规划

### 1.3 本期明确暂缓（先不做，规划留存）

- 自由群（Cayley 树 / 商群视角）→ 中期候选
- DLC 空间群/点群 → GVL 阶段
- 教育模式 → GVL 核心，不在近期做
- 乘法表导入 → 已否决（群展示系统 Todd–Coxeter 已覆盖自定义群创建）
- 一维特征标 → 暂缓，并入中期特征标表视图（其特例）

## 2. 中期：FGVE 引擎化（2026-10 → 2027-04）

**FGVE**（Finite Group Visualization Engine）：数学内核 + 布局内核，独立于 UI、稳定 API、纯计算无 React/DOM 依赖。

### 2.1 结构演进

- `src/core/` 即仓库内引擎层（**保持现名**，不另立 `src/engine/` 目录）：纯 TypeScript、零 UI 依赖、独立测试（coreBoundary.test 守护纯净性）。
- 新增 `src/package/` 双包门面（`@groupviz/core` / `@groupviz/react`，见 §2.8）作为对外稳定入口；渲染层、状态层（Provider 分层）仅通过引擎公共 API 访问数学能力；UI 内部细节不再渗透进引擎。

### 2.2 稳定协议

- `GroupDescriptor`：元素、乘法、阶、名称、性质缓存（子群/正规/可解/幂零等）、构造参数（便于序列化与再构建）。
- `ViewConfig`：布局算法（force / ring / shape / 3D / rewiring）、颜色、边类型等视图配置协议。
- `GroupAction`：作用定义 + 轨道/稳定子查询接口（v1.8 已落地：`GroupActionDef`/`GroupActionComputation` + `core/algebra/actions.ts` 纯函数，见 [ACTIONS.md](ACTIONS.md)）。

### 2.3 数据互操作

- **群 JSON 导出 + round-trip**：标准化 schema（元素、乘法表、描述符、性质），支持还原与跨应用交换；JSON → 群 → 导出幂等；schema v1 本阶段正式化。
- ~~自定义群表导入~~：已否决（群展示系统已覆盖自定义群创建）。

### 2.4 特征标表（character table，正式交付）

群论研究者核心工具。数据链路：GAP `CharacterTable(G)` + `Irr` + `ConjugacyClasses` → 后端端点 → 缓存 → 前端渲染（本地仅缓存后端结果，无 GAP 环境时特征标表不可用）。

- **矩阵表**：行 = 不可约表示（记号、维数 dᵢ = χᵢ(e)），列 = 共轭类（代表元 TeX、阶、类大小）；单元格数值 + 悬停 KaTeX 显示 χᵢ(g)。
- **热力着色**：按实部 / 复相位可切换着色。
- **验证行**：Σ dᵢ² = |G|；Σ dᵢ·χᵢ(g) = 0（g ≠ e）；正交关系 Σ χᵢ(g)·χ̄ᵢ(h) = δ_{gh}·|C_G(g)|（点选两列验证）。
- **联动**：点击列 → 共轭类视图 / 主视图高亮该类元素；点击行 → 维数徽标。
- 复用表格视图渲染 + 多视图浮动窗口 + 导出（SVG/PNG/GIF）；一维特征标（元素 → 单位根圆周图）作为其子场景一并交付。

### 2.5 GAP 后端完善

- 缓存策略与超时守卫强化；按需扩充端点（特征标表、更多性质）；大群（S₆ 及以上）前端全链路可用性验收。

### 2.6 可选高价值项

- 引擎 API 文档（最小宿主示例已升格为阶段 3 正式验收项，见 §2.8）。

### 2.7 非目标

- **monorepo 拆分（pnpm workspaces / packages/*）**：仍推迟（单仓库内子目录构建已覆盖打包需求，迁移收益不足）。
- 包内嵌入 GAP 计算引擎：`@groupviz/core` 仅提供 `createBackendAdapter({ baseUrl, fetchImpl })` 适配接口，宿主自接后端。

### 2.8 双包解耦与打包（2026-08-25 定案，FGVE 新增核心子任务）

将「UI 与算法解耦」落地为**可消费的 npm 包**（原计划推迟到 GVL，用户 2026-08-25 拍板提前到 FGVE）：

- **包形态**：`@groupviz/core`（纯算法层：GroupDescriptor 序列化 / 群构造 / 布局算法 / 视图配置，零 React/DOM 依赖）+ `@groupviz/react`（视图组件 + adapter + renderTex + 主题，peerDeps: react/three/@react-three/fiber/drei/katex）。均从现有 `src/core`、`src/components` 导出，不引入 monorepo。
- **阶段 1 —— 序列化协议固化**：`GroupDescriptor v1`（`src/core/descriptor.ts`：元素/乘法表行序隐式索引/属性缓存/构造参数/source 溯源）+ zod 校验 + 全群族 round-trip 幂等测试；`ViewConfig` JSON 化（shape2D/3D、边类型、颜色）。
- **阶段 2 —— 视图 props 化（行为零变化重构）**：视图组件由 `useGroup()` 读全局 Provider 改为受控 props 注入；`GroupCanvas` 拆 `<GroupCanvas {...props}/>` + `<GroupCanvasFromContext/>` adapter 壳。**分四批推进**：第一批 set/cayley/cycle/table → 第二批 3d/sublattice/cosetstrip → 第三批 homomorphism/action/sylow/symmetry → 第四批 tree/prestable。每批独立 commit，测试全绿。
- **阶段 3 —— 打包与消费验收**：vite library mode 多入口 + `exports` 字段；`examples/host-minimal/` 最小宿主（JSON 载群 → 渲染视图 → 切形状 → 导出 SVG）；CI 跑包构建 + Playwright 消费冒烟测试。
- **数学渲染**：算法层输出 **TeX 字符串**（零依赖），KaTeX 渲染归宿主/`@groupviz/react`（peerDep），core 不直接 renderTex。

## 3. 远期：GVL 教学实验室（2027-04 → 2027-12）

**GVL**（Group Visualization Lab）：面向大学抽象代数课程（配套 Fraleigh《抽象代数》、Dummit & Foote）的教学产品形态。

### 3.1 教育模式

引导式欢迎页 + 教学视图（分步动画、提示、检查点），与现有硬核模式并存，按模式切换入口与样式（AGENTS.md §1 已有设计约定）。

### 3.2 课程系统

课程链：群的定义 → 子群 → 陪集 → Lagrange 定理 → 正规子群 → 商群 → 同态 → 群作用 → 轨道-稳定子 → Sylow 定理 → 同构定理。每课 = 场景 + 讲解 + 交互练习。

### 3.3 教师工具

场景保存/分享（JSON/链接）、自定义教程制作、讲义导出（SVG/PDF）。

### 3.4 学生端

练习自检（判断子群 / 找生成元 / 验证同态 / 求作用轨道）、本地进度跟踪。

### 3.5 证明动画库

补齐：第二/第三同构定理、轨道-稳定子、Cayley 定理。已有资产：Lagrange（陪集条带）、第一同构定理（四阶段动画）。

### 3.6 表示论可视化：矩阵表示动画

群元素 → 真实矩阵（复 2×2 / 实 3×3）变换动画：点击元素播放基向量 / 多面体被矩阵变换的动画；本质是 SymmetryView 的全矩阵化版本（SymmetryView 即其特殊情形：正交表示），教育价值最高。

### 3.7 DLC（空间群 / 点群）

晶体学方向（欢迎页已预告）：点群对称可视化、空间群平移对称。

### 3.8 工程形态

GVL 阶段消费 FGVE 已产出的 `@groupviz/core` + `@groupviz/react` 包（宿主即 GVL 自身/学校课程页面）；如出现 monorepo 拆分（packages/core|react|app）需求，届时再评估。

## 4. 阶段成功标准

| 阶段 | 验收标准 |
|------|----------|
| 近期 | 全部交付收官（含 GAP 大群计算引擎 v1.13.0，E1 已关闭）；lint/test/build 全绿；覆盖率 ≥ 85% |
| 中期 | `GroupDescriptor v1` round-trip 可用（全群族幂等）；视图组件 props 化拆分完成四批（第一批 set/cayley/cycle/table）；`@groupviz/core`/`@groupviz/react` 双包可构建、`examples/host-minimal/` 最小宿主（JSON 载群→渲染→切形状→导出 SVG）CI 冒烟通过；特征标表视图上线 |
| 远期 | 教育模式上线；≥ 1 套完整大学抽象代数课程；教师"制作场景 → 分享 → 学生作答"闭环可用 |

## 5. 决策记录

> 仅保留仍具规划指导意义的决策；完整工作记录（含逐次提交明细、测试计数、浏览器验证）见 [docs/CHANGELOG.md](CHANGELOG.md)。

| 日期 | 决策 |
|------|------|
| 2026-08-04 | 确定三阶段命名与范围；近期优先级 = 群作用系统 + Sylow 定理可视化（其余列 P1/暂缓）；FGVE 先做仓库内独立引擎层（npm 包化推迟到 GVL 阶段）；GVL 定位大学抽象代数课程配套 |
| 2026-08-09 | 规划定稿（覆盖此前"仅口头确认、不更新 ROADMAP"的决定）：近期 = 数学缺口补全 M1–M8 + 工程质量 E1（gappy 后端集成）/E2（细节收尾）+ FGVE 预铺路 P1（群 JSON 导出+round-trip，乘法表导入否决）/P2（引擎化审计）/P3（benchmark）；推进顺序 M1→M8→E1→E2→P1→P3（E2/P1–P3 后因筛选标准取消，见下行） |
| 2026-08-09 | 表示论可视化定稿：特征标表 = 中期正式交付（经典矩阵表 + 热力着色 + 正交性验证 + 共轭类联动，数据源 gappy CharacterTable/Irr/ConjugacyClasses，见 §2.4）；矩阵表示动画 → GVL（§3.6）；一维特征标并入特征标表（近期暂缓） |
| 2026-08-10 | 任务筛选标准 = 新建可视化或可视化优化，非可视化任务一律不做：M5（第二/第三同构定理验证）移除，M6/M7/M8/E2/P1/P2/P3 取消；gappy IdGroup 砍除（E1 其余端点照常规划，见 §1.1）；群论计算器/多对象工作台方向搁置，作为独立新引擎另行规划 |
| 2026-08-23 | **E1 正式关闭**：gappy 方案不采用——2026-08-16 已换道直连本机 GAP 4.16 并以 v1.13.0 交付核心能力（六端点 + series + import-group、缓存、超时守卫、S₆ 实测）；剩余收尾项（缓存/超时强化、特征标表端点、大群前端全链路验收）并入中期 §2.4/§2.5 |
| 2026-08-24 | **FGVE 前置工程准备收官，转入中期开发**：P0 引擎化预处理（v1.15.1，类型拆分+门面/大文件拆分/错误模型双轨/输入加固）+ 测试体系建设（v1.16.0，53 文件 1442 tests + E2E 13）全部落地；终验四绿实测通过（lint / test / build / test:e2e），版本与测试计数跨文档一致核对无误；近期阶段无遗留事项，中期 §2 FGVE 引擎化自此正式启动 |
| 2026-08-25 | **FGVE 包化范围定案（用户拍板，覆盖 §2.7 原"不拆包"决定）**：目标 = 将「UI 与算法解耦」落地为可消费 npm 包——`GroupDescriptor v1` 序列化协议 + 视图组件 props 化（从 `useGroup()` 全局 Provider 改为受控 props 注入）+ 双包产出。**包形态**：`@groupviz/core`（纯算法、零 React/DOM 依赖）+ `@groupviz/react`（视图组件 + 渲染适配，react/three/@react-three/fiber/drei/katex 作 peerDeps）。**仓库结构**：保持单仓库不转 monorepo（`src/core`、`src/package/` 子目录 + vite library mode 多入口），避免早期工程开销。**数学渲染**：算法层只输出 TeX 字符串（零依赖），KaTeX 渲染归宿主 / @groupviz/react（peer）。**视图解耦分四批推进**：第一批 set/cayley/cycle/table → 第二批 3d/sublattice/cosetstrip → 第三批 homomorphism/action/sylow/symmetry → 第四批 tree/prestable，每批行为零变化重构 + 独立 commit + 测试全绿。**验收**：`examples/host-minimal/` 最小宿主（JSON 载群→渲染→切形状→导出 SVG）CI 冒烟。详见 §2.8 |
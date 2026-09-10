# 路线图 (Roadmap)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-08-04（三阶段规划讨论结论）。
> **本文档只列"未做 / 规划中 / 边界决策"**：已完成的里程碑与逐次开发记录全部在 [docs/CHANGELOG.md](CHANGELOG.md)，此处不重复。

## 0. 规划总览

GroupViz 的演进分三个阶段，逐级沉淀：

| 阶段 | 时间窗 | 名称 | 状态（截至 2026-09-10，v2.1.0） |
|------|--------|------|------|
| 近期 | 2026-08 → 2026-10 | 功能夯实期 | ✅ 2026-08-23 收官 |
| 中期 | 2026-10 → 2027-04 | FGVE 引擎化 | 🔄 进行中（阶段 2 视图 props 化 10/13 + 阶段 3 双包已发布，余项见 §2） |
| 远期 | 2027-04 → 2027-12 | GVL 教学实验室 | ⏳ 未开始 |

核心演进（详见 §5 决策记录）：近期全部交付（群作用 / Sylow / 数学缺口 / 直连 GAP 的大群引擎）；**FGVE 目标 = UI 与算法解耦 + 产出可消费 npm 包**（2026-08-25 定案，保持单仓库，`src/package/` 门面 + vite library mode）——`@groupviz/core`（纯算法）+ `@groupviz/react`（视图组件）双包已于 **2026-09-09 以 v2.0.0 发布 npm**，**2026-09-10 以 v2.1.0 交付「消费端卡点优化」批次**（元素引用按 label 解析 / `useSceneState` 便利层 / `theme` 统一 / 阈值可覆盖 / `docs/API.md` 入包，全附加式 minor）；GVL 定位大学抽象代数课程配套（Fraleigh / Dummit & Foote 风格）。

## 1. 近期：功能夯实期 —— ✅ 已收官

全部交付（群作用 v1.8 / Sylow 1.9.0 / 群展示 1.10.0 / 数学缺口 M1–M4、M8 / GAP 大群引擎 v1.13.0 / 2D·3D 布局系列优化），逐次记录见 [CHANGELOG.md](CHANGELOG.md)。原 E1「gappy 后端集成」2026-08-16 换道为**直连本机 GAP 4.16**（弃 gappy 库）。

### 边界（仍有效，规划留存）

- **不做**（2026-08-10 筛选标准：只做可视化或可视化优化，见 §5）：M5 同构定理数值验证、M6/M7/E2/P1–P3、群论计算器 / 多对象工作台（作为独立新引擎另行规划——Galculator）。
- **暂缓**：自由群（Cayley 树 / 商群视角）→ 中期候选；DLC 空间群/点群 → GVL；教育模式 → GVL；乘法表导入（群展示 Todd–Coxeter 已覆盖）；一维特征标 → 并入特征标表（其特例）。

## 2. 中期：FGVE 引擎化 —— 🔄 进行中

**FGVE**（Finite Group Visualization Engine）：数学内核 + 布局内核，独立于 UI、稳定 API、可打包消费。

### 2.1 FGVE 收官待办（阶段 2/3 挂账，见 CHANGELOG 09-07~10 批次）

- **CI Playwright 消费冒烟接入**：host-minimal / TestPage1 包消费矩阵均已人工实证，未固化进 CI（`build:pkg` 之后跑消费冒烟）。`publish:smoke` 已强化为「真实 npm 安装 + SSR + 双 resolution 类型 + react→core 具名导出一致性」门禁（v2.1.0），CI 接线仍待做。
- **`exports` 字段子路径**：双包目前只有根入口 `.` + `./theme.css`；子路径（如 `@groupviz/react/components/...`）待规划。
- **descriptor 真 round-trip 载群**：`serializeDescriptor`/`deserializeDescriptor` 幂等已有单测与 smoke（发布门禁内置），但 host-minimal 的消费路径（JSON 载群 → 渲染）仍待正式化（见 §2.4 数据互操作）。
- **消费端 API 深化（v2.1.0 已交付部分，余项续排）**：已交付元素引用解析（label/id/value）、`useSceneState`、`theme` 统一、阈值 props 化、`docs/API.md`；未做——`ViewModel`/`ViewHost` 级整窗受控方案、事件回调覆盖面（目前仅 `onAnimationEnd`）、`exports` 子路径下的按需类型。

### 2.2 延后项（定案暂缓，规划留存）

- **tree / prestable 视图 props 化**：阶段 2 剩余 2 个视图（13 视图已完成 10 个窗口化；此二者入口在左侧「群展示」面板）。
- **action 窗口内 sylow/coset actionKind**：`ActionViewParams` 目前仅 conjugation/regular/custom 三来源。

### 2.3 中期正式交付项（未开始）

**特征标表（character table）**：群论研究者核心工具。数据链路：GAP `CharacterTable(G)` + `Irr` + `ConjugacyClasses` → 后端端点 → 缓存 → 前端渲染（本地仅缓存后端结果，无 GAP 环境不可用）。
- 矩阵表：行 = 不可约表示（记号、维数 dᵢ = χᵢ(e)），列 = 共轭类（代表元 TeX、阶、类大小）；单元格数值 + 悬停 KaTeX 显示 χᵢ(g)。
- 热力着色：按实部 / 复相位切换。
- 验证行：Σ dᵢ² = |G|；Σ dᵢ·χᵢ(g) = 0（g ≠ e）；正交关系 Σ χᵢ(g)·χ̄ᵢ(h) = δ_{gh}·|C_G(g)|（点选两列验证）。
- 联动：点击列 → 共轭类/主视图高亮；点击行 → 维数徽标。复用表格渲染 + 多视图窗口 + 导出；一维特征标（元素 → 单位根圆周）作子场景一并交付。

**GAP 后端完善**：缓存/超时守卫强化；按需扩充端点（特征标表、更多性质）；大群（S₆ 及以上）前端全链路验收。

**引擎 API 文档**：双包消费示例升格后以 host-minimal 为正式示例（已交付浏览器实证版）。✅ **2026-09-10 v2.1.0 部分交付**——`docs/API.md`（Scene props 全表 + core 新导出 + 元素引用/主题约定）已随 `build:pkg` 写入两包分发；余项：核心算法函数的 JSDoc 补全、站点化文档页。

### 2.4 结构 / 协议（已完成部分的状态）

- `src/core/` 即仓库内引擎层：纯 TS、零 UI 依赖、`coreBoundary.test` 守护；`src/package/` 为双包门面。✅
- `GroupDescriptor v1`（descriptor.ts：元素/乘法表/性质缓存/构造参数/source 溯源 + zod 校验 + 幂等测试）。✅
- `GroupAction`（`GroupActionDef`/`GroupActionComputation` + `core/algebra/actions.ts`，见 [ACTIONS.md](ACTIONS.md)）。✅
- `ViewConfig` 视图配置协议（布局 / 颜色 / 边类型）——已随各视图 props 化落地；独立 JSON schema 固化待办。
- **群 JSON 导出 + round-trip**：schema v1 已固化（§2.1 待办项即其消费侧收尾）。自定义群表导入已否决（群展示已覆盖）。

### 2.5 非目标（边界保留）

- monorepo 拆分（pnpm workspaces / packages/*）：单仓库子目录构建已覆盖，仍推迟。
- 包内嵌 GAP 计算引擎：`@groupviz/core` 仅提供 adapter 接口，宿主自接后端。

## 3. 远期：GVL 教学实验室（2027-04 → 2027-12）

**GVL**（Group Visualization Lab）：面向大学抽象代数课程的教学产品形态，消费 FGVE 双包（§3.8）。

### 3.1 教育模式
引导式欢迎页 + 教学视图（分步动画、提示、检查点），与硬核模式并存，按模式切换入口与样式。

### 3.2 课程系统
课程链：群定义 → 子群 → 陪集 → Lagrange → 正规子群 → 商群 → 同态 → 群作用 → 轨道-稳定子 → Sylow → 同构定理。每课 = 场景 + 讲解 + 交互练习。

### 3.3 教师工具
场景保存/分享（JSON/链接）、自定义教程制作、讲义导出（SVG/PDF）。

### 3.4 学生端
练习自检（判断子群 / 找生成元 / 验证同态 / 求作用轨道）、本地进度跟踪。

### 3.5 证明动画库
补齐第二/第三同构定理、轨道-稳定子、Cayley 定理。已有资产：Lagrange（陪集条带）、第一同构定理（四阶段动画）。

### 3.6 表示论可视化：矩阵表示动画
群元素 → 真实矩阵（复 2×2 / 实 3×3）变换动画（点击元素播放基向量/多面体变换）；本质是 SymmetryView 的全矩阵化版本（SymmetryView = 正交表示特例）。

### 3.7 DLC（空间群 / 点群）
晶体学方向（欢迎页已预告）：点群对称可视化、空间群平移对称。

### 3.8 工程形态
GVL 阶段消费 FGVE 双包（宿主即 GVL 自身 / 学校课程页面）；若出现 monorepo 拆分需求届时再评估。

## 4. 阶段验收对照

| 阶段 | 验收标准 | 状态 |
|------|----------|------|
| 近期 | 全部交付收官 + lint/test/build 全绿 + 覆盖率 ≥ 85% | ✅ 已达成（2026-08-23） |
| 中期 | FGVE 双包可消费（✅ v2.0.0 发布 npm，registry 安装冒烟通过；✅ v2.1.0 消费端卡点优化 = 元素引用/`useSceneState`/`theme`/阈值/`API.md`）；视图 props 化 10/13（✅ set/cayley/cycle/table/3d/sublattice/cosetstrip/homomorphism/action/symmetry；余 tree/prestable，见 §2.2）；descriptor round-trip 可用（✅ 幂等测试 + 发布门禁）；host-minimal 消费实证（✅ 浏览器实证，CI 化见 §2.1）；**特征标表上线（§2.3，未开始）** | 🔄 |
| 远期 | 教育模式上线；≥1 套完整大学抽象代数课程；教师"制作→分享→学生作答"闭环 | ⏳ |

## 5. 决策记录

> 仅保留**仍具规划指导意义**的决策；完整工作记录（含逐次提交、测试计数、浏览器验证）见 [CHANGELOG.md](CHANGELOG.md)。

| 日期 | 决策 |
|------|------|
| 2026-08-04 | 三阶段定名与范围（近期/中期 FGVE/远期 GVL）；GVL 定位大学抽象代数课程配套 |
| 2026-08-09 | 特征标表 = 中期正式交付（数据源 GAP CharacterTable/Irr/ConjugacyClasses）；矩阵表示动画 → GVL；一维特征标并入特征标表 |
| 2026-08-10 | **任务筛选标准** = 只做可视化或可视化优化，非可视化一律不做：M5/M6/M7/M8/E2/P1–P3 取消，gappy IdGroup 砍除；群论计算器方向搁置为独立新引擎（→ Galculator） |
| 2026-08-16/23 | E1 换道：弃 gappy，直连本机 GAP 4.16 交付大群引擎（v1.13.0），2026-08-23 正式关闭 E1 |
| 2026-08-25 | **FGVE 包化定案**：目标升级为可消费 npm 包（`@groupviz/core` + `@groupviz/react`）；保持单仓库（`src/core` + `src/package/` + vite library mode）；视图 props 化分批推进（行为零变化重构）；验收 = host-minimal 最小宿主 CI 冒烟 |
| 2026-09-07 | 阶段 2 收尾定案：剩余 sylow/tree/prestable 三视图延后（先做阶段 3 打包），批次七 symmetry 收官 v1.23.0 |
| 2026-09-07 | 阶段 3 推进节奏定案：批次八最小闭环（v1.24.0）→ i18n「语言包入包」策略（v1.25.0，react 包内置语言包并导出 I18nProvider）→ 余 6 Scene 全量入包收官（v1.26.0） |
| 2026-09-09 | 双包发布治理定案：`pkgVersion` 独立于主应用迭代版本；两包成对同版（v2.0.0，react peer 锁 core ^2.0.0）；发布门禁 `publish:smoke`（真实 npm 安装 + SSR + 双 resolution 类型冒烟）。同日主应用版本对齐 2.0.0 |
| 2026-09-10 | **消费端 API 加固定案（v2.1.0）**：以外部博客嵌入实测卡点为输入，确立「**元素引用类 props 一律接受 label/id/value 并在内部解析**」（未命中 warn 一次 + 忽略，不抛错）、「**主题统一为 `theme?: 'dark' \| 'light'`**（经 `SceneThemeRoot` 注入 `data-theme`，未传=零变化）」、「相机门控改 `lockCameraOnAction` 默认 **false**（默认不再锁死）」三条约定；全部改动**附加式**（未传=旧行为）故走 2.x minor；发布门禁强化为 react→core 具名导出一致性 + 消费端钉死宿主已解析 react/three 版本 |

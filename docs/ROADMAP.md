# 路线图 (Roadmap)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-08-04（三阶段规划讨论结论）。
> **本文档只列"未做 / 规划中 / 边界决策"**：已完成的里程碑与逐次开发记录全部在 [docs/CHANGELOG.md](CHANGELOG.md)，此处不重复。

## 0. 规划总览

GroupViz 的演进分三个阶段，逐级沉淀：

| 阶段 | 时间窗 | 名称 | 状态（截至 2026-09-10，v2.1.0） |
|------|--------|------|------|
| 近期 | 2026-08 → 2026-10 | 功能夯实期 | ✅ 2026-08-23 收官 |
| 中期 | 2026-10 → 2027-04 | FGVE 引擎化 | 🔄 进行中（阶段 2 视图 props 化 **11/13 收官**，余 tree/prestable 移交拓展包轨道 + 阶段 3 双包已发布，余项见 §2） |
| 远期 | 2027-04 → 2027-12 | GVL 教学实验室 | ⏳ 未开始 |

核心演进（详见 §5 决策记录）：近期全部交付（群作用 / Sylow / 数学缺口 / 直连 GAP 的大群引擎）；**FGVE 目标 = UI 与算法解耦 + 产出可消费 npm 包**（2026-08-25 定案，保持单仓库，`src/package/` 门面 + vite library mode）——`@groupviz/core`（纯算法）+ `@groupviz/react`（视图组件）双包已于 **2026-09-09 以 v2.0.0 发布 npm**，**2026-09-10 以 v2.1.0 交付「消费端卡点优化」批次**（元素引用按 label 解析 / `useSceneState` 便利层 / `theme` 统一 / 阈值可覆盖 / `docs/API.md` 入包，全附加式 minor）；GVL 定位大学抽象代数课程配套（Fraleigh / Dummit & Foote 风格）。

**拓展轨道（2026-09-16 立项）**：三个拓展包规划中——`@groupviz/symmetric-families`（对称群族 + 点群）/ `@groupviz/rep-theory`（表示论深化）/ `@groupviz/galois`（伽罗瓦对应），全部为引擎双包的 peerDeps 下游消费者、包间零依赖，**均未开始**——关系模型、内容边界与开发顺序见 [PLAN_EXTENSION_PACKS.md](PLAN_EXTENSION_PACKS.md)。其中点群提前兑现 §3.7 DLC；表示论深化与 §2.3 特征标表分工（主表归引擎，深化归包）见其 §4.1。

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

- **tree / prestable 视图 → 移交拓展包轨道（2026-09-16 定）**：13 视图中最后 2 个未 props 化的视图（入口在左侧「群展示」面板），**不再在引擎侧 props 化**。理由：二者与**无限群**方向绑定（自由群 Cayley 树 / 展示的无限族），当前没有消费需求，硬塞进双包会带一批只为自身服务的 props。承接方与边界见 [PLAN_EXTENSION_PACKS.md](PLAN_EXTENSION_PACKS.md) §9；引擎侧视图 props 化至此**收官**（sylow 于同日入包，见 [CHANGELOG.md](CHANGELOG.md) 2026-09-16）。
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

### 2.6 性能优化挂账（2026-09-13 基准实测后列入）

数据与判别实验见 [PERF.md](PERF.md)。核心结论：SVG 视图的卡顿来自**交互每帧重跑 React 全量重渲染**（非栅格化），故优化项一律围绕「减少重渲染频次」与「降算法复杂度」，**不做渲染层重写**。

**已完成**：三层极限基线（2026-09-13）。

**待办（按性价比排序）**：

- **交互期冻结节点树**（性价比最高，预期 480 阶缩放 9 fps → 接近 58 fps）：拖拽/滚轮期间用 ref 直接写 `<g transform>`，`canvasTransform` 只在手势结束或节流后才回 React state。涉及 `SetView` / `CycleView` / `CayleyView` 三处。
  - **前置决策（未定，阻塞项）**：`isNodeOnScreen` 裁剪依赖 `canvasTransform`，冻结后拉远不会补出新节点。二选一——手势期间按放大包围盒预裁留余量 / 手势结束再补。影响手感，需先定策略。
- **`findPermIndex` 改 `Map`**（`SymmetricGroup.ts:35`，约 5 行）：`elements` 的 `id` 本就是 `perm.join(',')`，建 `Map<id, idx>` 即可，Sₙ 单次乘法从 O(n!) 降到 O(1)。预期百倍量级提速，**这是「S₆ 组合视图卡死」的硬伤修复**。
- **大群阈值改成本模型**：现按群阶一刀切禁止，但实测 120 阶静态 60 fps、交互 49–56 fps 完全可用。改为「可看，但交互会卡顿」的提示语义 + 按视图分档。
- **`forceLayout` 大群切异步渐进**（`cycleLayouts.ts:116/254`）：`iterations` 封顶 500 是旋钮不是极限；复用已有的 `forceLayoutAsync` + RAF 分块，大群先出粗布局再细化。
- **子群枚举改 worklist**（`subgroups/enumerate.ts:99`）：pair-join 闭包现每轮重扫全部对（O(S²·n)），改为只把新发现的子群与已有子群求 join。预期 D84(168) 3.45 s → 1 s 内。

**明确不做（边界，附理由）**：

- 2D 视图上 Canvas / WebGL 重写 —— 栅格层在 5.9 万节点下仍有 41–58 fps，纯属浪费。
- Web Worker —— 子群枚举慢是算法复杂度，修算法远便宜于搬线程。
- 虚拟列表 / 窗口化 —— 绘制量不是瓶颈，只增加状态复杂度。
- 继续按群阶加硬编码特判 —— 现有特判已多，性能阈值不再进这个列表。

### 2.7 视图控制层（VCL）—— 🔄 进行中

> 定位与全量规划见 [PLAN_VIEW_CONTROL_LAYER.md](PLAN_VIEW_CONTROL_LAYER.md)（§1 定位与边界 · §2 四子系统 · §3 能力清单（唯一真源，含 Tier A/B/C 池）· §4 Phase 0 施工方案 · §5 决策记录 · §6 参考实现吸收台账）。目标 B「个性化编排一张教学/博客插图」，介于 FGVE 引擎化与 GVL 之间。

**已完成**（2026-09-11 ~ 09-12 两批 + 2026-09-23 第三批，仅 FGVE 窗口 + 包 props 路径）：

- 边几何：2D `edgeCurvature`（0=笔直）、逐生成元 `lengthScale`（2D/3D 各一套松弛）、动态力导向开关。
- 路径高亮：`pathHighlight`（2D/3D 共用 `core.resolveCayleyPath`，含 `dimOthers`/动画/悬停序号）。
- 语义装饰 F 组：共轭类着色、阶徽标、⟨g⟩ 闭包高亮、中心/正规子群标记（2D+3D）。
- 边样式与图例 E 组：`showLegend`、`printPalette`+逐生成元虚线、`edgeWidthScale`、`showArrows`。
- 3D B 组：`shell` 字长球壳、`layerRings` 纬度环、`relayoutNonce` 重新优化布局。

**下一批（Phase 0 三件地基，2026-09-24 用户拍板开工）**：`Decorations` 协议（图上注释）· `FigurePreset` + `useFigurePreset`（插图级预设）· 注册表驱动 ⚙ 面板。分刀顺序与验收见 PLAN §4.5。

**边界（2026-09-24 定）**：

- **主画布不接 VCL 控件**（原「甲组 A1/A2」取消）：主画布定位 = 新视图/新形状的**先行试验田**，不承担插图编排职责；VCL 只在 FGVE 窗口 + 包 props 路径生效。
- **2D 面/陪集填充否决**：2D 图已承载节点/标签/多层边/路径高亮/语义装饰外圈，再加面填充只会更乱；陪集语义由商群悬浮窗 + 3D `faceFill` 承载。
- **池中待议**（用户「其他到时候再说」）：caption/尺寸预设/TikZ、hover 字段清单、揭示模式、标签方案切换、布局位置入预设、分层选择器、图质量读数、预设库/深链、导出烘焙、Steps 分镜、多窗口联动选中。

### 2.8 视图窗口框架（三壳合一）—— 📋 方案待批

> 方案见 [PLAN_WINDOW_FRAMEWORK.md](PLAN_WINDOW_FRAMEWORK.md)。起因（2026-09-24 用户）：「把主画布里的悬浮多窗和 FGVE 里的窗口处理一下，要么切割，要么融合，**我倾向于融合**，弄一个通用框架，两边都能调用。」

- **现状**：三套壳并存——应用老式壳 `FloatingViewWindow`（context 壳，**无 ⚙ 面板、无持久化**）、FGVE 受控内核 `ViewWindow`（全套 ⚙ + 注释 + 持久化，只在 `?test=2` 与包消费端可见）、包消费端壳 `SceneWindow`（caps 裁剪，零 context）。⇒ 今天 VCL 的全部控件在**应用里点不到**（PLAN_VIEW_CONTROL_LAYER §4.2）。
- **已交付**：
  - **W-0（2026-09-24）窗口内导出**——`ViewWindow` 标题栏 ⤓ 按钮（2D → 自包含 SVG，含注释与 KaTeX 样式；3D/对称性 → PNG）；序列化抽为零依赖模块 `utils/exportSvg.ts`（`export.ts` 改为 re-export）。真机验收：导出 `图-2-凯莱图.svg` 含注释图层，脱离本项目独立渲染正常。
  - **W-1（2026-09-25）窗口几何统一**——老式壳改用共享 `useWindowDragResize` + `clampResize` + 同一 z 计数器，拿到 **8 向 resize**；顺带修掉共享 hook「rAF 吞最后一帧 ⇒ 松手不到位」的真 bug；补老式壳行为基线测试 9 条（此前零覆盖）。
  - **W-2（2026-09-25）窗口几何持久化**——老式壳接入 `useViewWindowPersist`（键 `gv-vw-fv-<view>`；不用 `fv-${Date.now()}` 因为每次都变），真机验收「拖到 (350,240)/590×460 → 刷新重开逐位还原」。
  - **W-2b（2026-09-25）重置入口**——`ViewPanel` 多视图区加「重置窗口位置」按钮（此前 `resetAllViewWindows()` 全仓无调用方、用户点不到），真机验收「拖到 (360,250) → 点重置 → 回 (140,110)」。
  - **W-3（2026-09-25）内容与面板统一（set/cayley）**——应用浮窗改走内核 `ViewContent` 并挂上 `ViewParamsPanel`（⚙ 按视图门控，未迁视图不给入口），`ViewContent` 增 `appWindowLabels`（应用浮窗保持常驻标签）；**应用浮窗第一次能改参数、能加注释**。真机验收：调半径 28→40 画面变、阶徽标 0→12 段文本、注释叠层 1 条、与 `?test=2` 内核窗口**归一化节点布局指纹逐字符相同**（节点 12/边 20 一致）。
  - **W-4（2026-09-25）余下 6 个视图迁完**——`KERNEL_VIEWS` 扩到 **8 个**（set/cayley/cycle/table/3d/symmetry/sublattice/cosetstrip）；真机扫场：8 个视图内容与 ⚙ 面板段头全对、`sylow` 按门控无 ⚙、**9 视图 0 JS 错误**；顺带修掉"ne 角手柄吃掉标题栏 ×/⚙ 点击"的交互 bug（两套壳同改）。仍未迁：`sylow`（`ViewContent` 尚无该分支）、`tree`/`prestable`（无限群方向视图，交拓展包轨道）、`action`/`homomorphism`（应用多视图入口打不开）。
  - **W-5（2026-09-25）收口**——删掉 `lazyViews` 里已死的 8 个分支与 `CayleyGraphViewLocal`/`TableZoomable`/`CosetStripWindowView` 三件自绘/包装件（**505 → 136 行**），只留 sylow/tree/prestable/action/homomorphism；真机 9 视图扫场与收口前**逐项相同**，对外消费方零改动。至此"两套壳"只剩**状态归属**差异（应用浮窗共享主画布选中与生成元，内核全窗口本地）。
- **待批**：三个语义取舍（浮窗**选中 / 生成元**是否继续与主画布联动——现两套壳行为相反）+ 后续分刀（W-3 内容分发与 ⚙ 面板**同时**迁 → W-4 余下视图 → W-5 删旧件 → 可选 W-6 包侧 `SceneWindow`）。

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
> 2026-09-16 注记：**点群提前兑现**——由拓展包 `@groupviz/symmetric-families` 承接（见 [PLAN_EXTENSION_PACKS.md](PLAN_EXTENSION_PACKS.md) §3.1）；**空间群**（平移对称、无限群方向）不在拓展包范围，仍留 GVL。

### 3.8 工程形态
GVL 阶段消费 FGVE 双包（宿主即 GVL 自身 / 学校课程页面）；若出现 monorepo 拆分需求届时再评估。

## 4. 阶段验收对照

| 阶段 | 验收标准 | 状态 |
|------|----------|------|
| 近期 | 全部交付收官 + lint/test/build 全绿 + 覆盖率 ≥ 85% | ✅ 已达成（2026-08-23） |
| 中期 | FGVE 双包可消费（✅ v2.0.0 发布 npm，registry 安装冒烟通过；✅ v2.1.0 消费端卡点优化 = 元素引用/`useSceneState`/`theme`/阈值/`API.md`）；视图 props 化 **11/13 收官**（✅ set/cayley/cycle/table/3d/sublattice/cosetstrip/homomorphism/action/symmetry/sylow；余 tree/prestable 已移交拓展包轨道，见 §2.2）；descriptor round-trip 可用（✅ 幂等测试 + 发布门禁）；host-minimal 消费实证（✅ 浏览器实证，CI 化见 §2.1）；**特征标表上线（§2.3，未开始）** | 🔄 |
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
| 2026-09-16 | **阶段 2 视图 props 化收官（11/13）**：sylow 入包（第 11 个 Scene `SylowScene`，三布局模式 circle/coset/two + `--sylow-*` 主题变量走 CSS 变量，故主画布壳零行为变化）；**tree / prestable 不再 props 化**，移交拓展包轨道——理由是与无限群方向绑定、当前无消费需求（见 §2.2 与 [PLAN_EXTENSION_PACKS.md](PLAN_EXTENSION_PACKS.md) §9）。VCL 仍挂账，待 sylow 之后另行推进 |
| 2026-09-19 | **附属窗口功能入包形态定案**：13 视图之外的「自同构作用预览」props 化为 `AutomorphismScene`（`@groupviz/react` 第 12 个 Scene）。形态 = **内容内核 + 宿主 `SceneWindow` 嵌套预览窗**（用户当日定：「在 view window 里面嵌套一个窗口就行」）——内核零 context / 零 `window`、不含窗口 chrome，窗口能力（拖拽 / resize / 持久化 / 关闭）由通用壳提供，主应用浮层与包消费端共用同一份实现。后续同类附属窗口功能循此形态 |
| 2026-09-24 | **VCL 两条边界 + Phase 0 开工**：① **主画布不接 VCL 控件**——用户定「主画布一般是我搞新视图、新形状时拿来先行测试用的」，故主画布是先行试验田、不承担插图编排，VCL 只在 FGVE 窗口 + 包 props 生效；② **2D 面/陪集填充否决**——用户定「2D 已经够乱了，还要面填充，那更乱了」，陪集语义留给商群悬浮窗 + 3D `faceFill`；③ 下一批 = Phase 0 三件地基（`Decorations` / `FigurePreset` / 注册表驱动面板），方案见 [PLAN_VIEW_CONTROL_LAYER.md](PLAN_VIEW_CONTROL_LAYER.md) §4（VCL 由挂账转进行中，ROADMAP 落位 §2.7）。同日该 PLAN 文档重构：§8 发散池 + §9 实施状态合并为 **§3 能力清单唯一真源**（带状态列），已完成历史交回 CHANGELOG |
| 2026-09-24 | **窗口内导出获批 + 窗口框架融合立项**：① 导出按「给 FGVE 窗口加导出按钮」实施（用户原话「就按你的」）——`ViewWindow` 标题栏 ⤓，2D 出自包含 SVG（含注释 + KaTeX 样式内联 + 字体 CDN 改写）、3D/对称性出 PNG；序列化抽 `utils/exportSvg.ts` 零依赖模块。② 用户定「主画布悬浮多窗与 FGVE 窗口**融合**成通用框架，两边都能调用」（否决切割），方案落 [PLAN_WINDOW_FRAMEWORK.md](PLAN_WINDOW_FRAMEWORK.md) + ROADMAP §2.8，待批三个语义取舍 |


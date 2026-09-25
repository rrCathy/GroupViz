# 视图控制层（View Control Layer, VCL）—— 规划与施工

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 定位：把 FGVE 从「展示群的各种视图」升级为「可编排、可分享、可嵌入的教学/博客插图」的那一半。
> 路线图落位：[ROADMAP.md](ROADMAP.md) **§2.7 视图控制层（VCL）**——中期 FGVE 阶段下的独立工作流（与 §2.3 特征标表并列），介于引擎化与 GVL 之间；VCL 是 GVL 的**前置能力**，不是 GVL。
> **文档分工**：本文只讲**规划 / 施工方案 / 边界**。**已完成历史（含逐次验证数据、实测数字）的唯一权威是 [CHANGELOG.md](CHANGELOG.md)**，本文一律不复述、只留指针。

---

## 1. 定位与边界

### 1.1 一句话定位

- **目标 A（已接近完成）**：把群的各种视图**算出来、画出来** → 计算层 + 视图渲染层承担。
- **目标 B（本文范围）**：个性化地**编排一张插图**用于教学/博客 → 叠一层**视图控制层（VCL）**。

最初点名要做的三件——「3D 凯莱图面着色」「凯莱图添加注释」「边弯曲 / 逐生成元边长 / 凯莱图路径」——全部属于这一层。

### 1.2 三级架构与边界纪律

```
┌──────────────────────────────────────────────────────────┐
│  视图控制层 View Control Layer (VCL)                       │
│  FigurePreset · Decorations · 注册表驱动 Control UI        │
│  编排 / 分享 / 导出 / 博客嵌入                              │
└───────────────────────────┬──────────────────────────────┘
                            │ 消费（viewParams + decorations）
┌───────────────────────────▼──────────────────────────────┐
│  视图渲染层 View Rendering（Scenes）                       │
│  SetView / CycleView / CayleyView / Cayley3DScene / …     │
│  只读 viewParams + decorations，不含编排逻辑               │
└───────────────────────────┬──────────────────────────────┘
                            │ 消费
┌───────────────────────────▼──────────────────────────────┐
│  计算层 Computation（@groupviz/core）                      │
│  groups / algebra：subgroups · cosets · faces · cayley…   │
└──────────────────────────────────────────────────────────┘
```

- `core` 只放**可序列化协议 + 纯函数**（ViewParams schema、Decorations schema、figure 序列化），零 React 依赖（`coreBoundary.test` 守护）。
- 控制 UI 与 Scene 内的叠层渲染放 `@groupviz/react`。
- **零配置安全（硬口径）**：所有新增 props 可选，未传时外观与既有**逐位一致**（附加式 minor）。

### 1.3 边界（不做 / 不接，附理由）

| 边界 | 结论 | 理由 |
|------|------|------|
| 主画布接 VCL 控件 | **不接**（2026-09-24 用户定；原「甲组 A1/A2」取消） | 用户原话：「主画布一般是我搞新视图、新形状时拿来先行测试用的」⇒ 主画布 = **先行试验田**，不承担插图编排职责。VCL 只在 FGVE 窗口（`ViewWindow`）+ 包 props 路径生效 |
| 2D 面 / 陪集填充 | **否决**（2026-09-24） | 用户原话：「2D 已经够乱了，还要面填充，那更乱了」。陪集语义已由商群悬浮窗 `QuotientSubgroupInset` + 3D `faceFill` 两处承载 |
| 按群阶加硬编码特判 | **不做**（沿用 [PERF.md](PERF.md) 口径） | 形状/控件的可用性由**技术能力**决定，不按群阶一刀切 |
| 练习/测验、课程链与进度、引导式提示 | **归 GVL** | 那些是**教学逻辑**，消费 VCL 产出的插图，但不在 VCL 内实现 |

---

## 2. 四子系统

### 2.1 子系统职责与现状

| 子系统 | 职责 | 现状 |
|--------|------|------|
| **ViewParams 协议**（`core/types/viewConfig.ts`） | 逐视图参数 + zod schema（序列化安全） | ✅ 9 个视图全有 `*ParamsSchema`；VCL 新增字段见 §2.2 |
| **Decorations**（新增，render-agnostic） | 注释/装饰的**可序列化协议**，与具体 Scene 无关——当前缺的那条抽象 | 🔄 本批（Phase 0），从零起 |
| **Control UI**（注册表驱动 ⚙ 面板） | 能力描述符 → 自动生成控件；新增控件不再改面板 JSX | 🔄 本批（Phase 0） |
| **FigurePreset** | 一张插图 = 一个可命名、可导入导出的 JSON 单元（教学消费的核心单元） | 🔄 本批（Phase 0） |

**既有基建（勿重造）**：`Canvas/floatingView/` 下的 `ViewWindow.tsx`（受控内核）/ `ViewParamsPanel.tsx`（⚙ 面板）/ `persist` hook，配 `ViewWindowConfig` / `ViewWindowPersistData` 与 localStorage `gv-sw-*`。`Canvas/FloatingViewWindow.tsx` 现为 12 行 re-export shim（实体已搬家，见 CHANGELOG 2026-09-22）。

### 2.2 ViewParams 已落地的 VCL 字段

> **真源 = `src/core/types/viewConfig.ts`**（含默认值与 JSDoc），此处只列名字；消费端 API 说明见 [API.md](API.md) §4.9 / §4.10。

- **2D `CayleyViewParams`**：VCL 新增 `edgeCurvature` · `actions[].lengthScale` · `actions[].dash` · `pathHighlight` · `forceDirected` + `force` · `nodeColorMode` · `showOrderBadge` · `highlightGenerated` · `markCenter` · `markNormalSubgroup` · `printPalette` · `edgeWidthScale` · `showArrows` · `showLegend`；既有 `shape2D` / `multiplyType` / `actions` / `nodeRadius` / `showLabels`。
- **3D `Cayley3DViewParams`**：VCL 新增 `actions[].lengthScale` · `pathHighlight` · `shell` · `layerRings` · `relayoutNonce` · `nodeColorMode` · `showOrderBadge`；既有 `faceFill`（VCL 之前即有的雏形）、`layout3D` / `nodeScale`。

---

## 3. 能力清单（唯一真源）

> **状态口径**：✅ 已交付 · 🔄 本批（Phase 0，见 §4）· 📋 池中（未排期）· ⛔ 否决。
> **归属**：`VP` ViewParams · `DEC` Decorations · `UI` Control UI · `FP` FigurePreset · `NEW` 可能需新子系统。
> 本节取代了旧版的「§4 优先级表 + §8 发散池」双份清单；单条能力的验证数据一律查 [CHANGELOG.md](CHANGELOG.md)。

### 3.1 ✅ 已交付

> 全部**只在 FGVE 窗口 + 包 props 路径**（主画布不接，见 §1.3）；逐次提交、测试计数与真机数据见 CHANGELOG（2026-09-11 / 09-12 / 09-23 三批）。

| 能力 | 落点 | 范围 |
|------|------|------|
| 边弯曲 / 笔直 + 曲率 | `CayleyViewParams.edgeCurvature`（0 = 笔直；平行边按作用序号左右分摊） | 2D |
| 逐生成元边长 | `actions[].lengthScale` + `core.relaxEdgeLengths` | 2D |
| 逐生成元边长（三维松弛） | 同一字段 + `core.relaxEdgeLengths3D` | 3D |
| 凯莱图路径高亮 | `pathHighlight`（元素序列 / 生成元单词，方向敏感，可选动画/序号，缺省淡化其余边） | 2D + 3D |
| 动态力导向（**开关**，非新形状） | `forceDirected` + `force` + `core.createCayleyForceSim`（Obsidian 式局部性；参数就地更新不重建 sim） | 2D |
| 节点可调大小 | `nodeRadius` / `nodeScale`（VCL 之前既有） | 2D + 3D |
| 3D 子群陪集面着色 | `faceFill` + `core/algebra/faces3D.ts`（VCL 之前既有；Scene 与 ⚙ 面板共用同一份候选数据） | 3D |
| 共轭类一键着色（F1） | `nodeColorMode: 'conjugacy'` + `core.nodeSemantics.conjugacyClassIndexMap` | 2D + 3D |
| 元素阶徽标（F2） | `showOrderBadge` + `core.elementOrderMap`（3D 端为「阶→球径」） | 2D + 3D |
| ⟨g⟩ 闭包高亮（F3） | `highlightGenerated`（联动 selection，无需额外参数） | 2D |
| 中心 / 最小正规子群标记（F4） | `markCenter`（双实线环）/ `markNormalSubgroup`（虚线外环） | 2D |
| 自动图例（E2） | `showLegend`（色块 + 记号 + 线型预览，点击行切该生成元边显隐）+ `onToggleAction` | 2D |
| 打印 / 单色 + 虚线（E3） | `printPalette`（全体同色，靠线型/线宽区分）+ `actions[].dash` | 2D |
| 边样式细化（E4） | `edgeWidthScale`（与 lengthScale 正交）/ `showArrows` | 2D |
| 3D 球壳 / 纬度环 / 重新优化布局（B1–B3） | `shell` / `layerRings`（仅字长球；缺省关）/ `relayoutNonce` | 3D |
| **窗口内导出（SVG/PNG）** | `ViewWindow` 标题栏 ⤓：2D → **自包含 SVG**（全量样式内联 + KaTeX 字体改写 CDN，注释与节点标签掉不了排版）；3D/对称性 → canvas PNG。序列化在零依赖模块 `utils/exportSvg.ts`（`export.ts` re-export） | 全部视图（W-0，2026-09-24） |

### 3.2 🔄 本批（Phase 0 三件地基）

`Decorations` 协议（注释）· `FigurePreset` + `useFigurePreset` · 注册表驱动 ⚙ 面板——**施工方案见 §4**。

### 3.3 📋 池中（原「§4 优先级表」与「§8 发散池」合并去重）

**Tier A — 高价值低成本（适合搭在后续任一批次里顺带）**

| 功能 | 归属 | 说明 |
|------|------|------|
| 标题/副标题/图注 caption | FP | 「图 3.2：S₄ 的 Cayley 图」，导出时烘焙 |
| 标签方案切换 | VP | 循环记号 / 幂记号（Cₙ 显 gⁱ）/ 自定义别名，逐图可切 |
| hover 气泡内容自定义 | UI | 教师定义悬停显示什么（阶 / 共轭类 / 自定义文本）——需要**字段清单模型**而非硬编码文案，配套 core 补 `reducedWordCount`（沿字长 DAG 的 DP 计数，暂无） |
| 揭示模式 | UI | 标签/答案默认遮住，点击逐个揭示（讲课悬念） |
| 节点位置覆盖 + 手动布局编辑 | VP / NEW | 拖摆节点位置持久化进预设（CycleView 已有 `getNodePosition` 局部态，扩到全视图） |
| 阶→形状映射 | VP | 2 阶方形、3 阶三角…（F2 的徽标已交付，形状映射未做） |
| 教学友好生成元集预设 | VP | 一键换"好讲"的生成组（现按形状换生成元已有，缺面板入口） |
| 聚焦聚光灯 | DEC | 非兴趣区压暗，讲某个陪集时其余退后 |
| 陪集边界描边 + \|G:H\| 区域标注 | DEC | 面填充已否决，但描边/标注本身可独立存在 |
| 禁选区细化 | UI | `locked`/`zoomLocked` 已有；补「只许点这几十个元素」 |
| 图质量读数面板 | UI | 松弛前后最小边距、近距边对计数——复用 core 诊断先例（`countLatticeCrossings`），3D 增 `edgePairClearance` |
| ~~窗口内导出（SVG/PNG，含 decorations）~~ | FP | ✅ **已交付（W-0，2026-09-24）**：见 §3.1 末行；真机验收导出文件含注释图层 |
| 应用浮窗与 FGVE 内核的面板收口 | UI | ✅ **已立项为独立方案**：[PLAN_WINDOW_FRAMEWORK.md](PLAN_WINDOW_FRAMEWORK.md)（三壳合一，分刀 W-1~W-6）——老式壳零控件、内核带全套 ⚙ 的鸿沟在那里收 |
| 导出内联 KaTeX CSS | FP | `exportSVGContent` 目前只内联 CSS 变量，**foreignObject 里的 KaTeX 节点标签在外部工具打开导出文件时会掉排版**（现状即如此）；内联 KaTeX 样式后节点标签与注释一起受益 |
| 分层选择器（字长直方图） | VP | 柱状选层 → 高亮该层节点/边；任何分层（字长/阶/共轭类）都适用的通用范式 |
| 悬停联动图例 | DEC / UI | 悬停节点 → 高亮其全部邻边（含方向）并同时高亮图例项；悬停边 → 显示生成元 + 两端字长变化 |
| 3D 布局旋钮 `BAND_RATIO` / `SNAP_RATIO` | VP | 纬度带厚度 / 外圈吸附阈值——直接影响"看起来像不像球" |

**Tier B — 价值高、有依赖（多与「预设生态」同批）**

| 功能 | 归属 | 说明 |
|------|------|------|
| 预设库（localStorage 列表 + 导入导出 JSON） | FP | §4 的 FP-1 只做单张 JSON 导入导出，**库/列表**留在此 |
| 深链分享 | FP | URL 编码 preset，点开即看 |
| 尺寸预设 | FP | 16:9 / A4 / 博客宽 |
| TikZ / PGF 源码导出 | FP | LaTeX 讲义直接可用 |
| 并排比较双群 | FP | D₄ vs Q₈ 同布局对照，一个 preset 编排两张图 |
| 合成 panel 导出 | FP | 多图拼版（教材式组合插图） |
| Steps 分镜 | NEW | 一张插图 = 多状态逐步展现（先生成元 → 再加边 → 再面着色 → 再路径）+ scrubber；`FigurePreset` 升格为 `FigureSequence`。**schema 需从 v1 预留 `steps?`** |
| 逐元素入场动画 | DEC | 节点/边 staggered reveal，讲课时图"长出来" |
| 相机关键帧（3D） | FP | 预设视角序列 + 插值 → 导出 mp4/GIF |
| 图中图 inset | DEC | 母图角落嵌子群小图 + 连线。**锚点类型需从 v1 预留** |
| 爆炸图（3D） | VP | torus/cylinder 拆层展示直积结构 |
| 自包含片段导出 | FP | 导出「自带面板、无框架依赖」的单文件 HTML/JS（与 TikZ 并列），对应"交付一张插图"的自然形态 |

**Tier C — 重工程（视消费端反馈再评估）**

| 功能 | 归属 | 说明 |
|------|------|------|
| 多窗口联动选中 | NEW | 选中元素全视图同步高亮（选 S₃ 的 (12)，Cayley/cycle/table/set 同时亮） |
| 交互录制回放 | NEW | 录制旋转/选中/高亮序列，回放或导出动图 |
| 同构重命名视角 | NEW | D₃ ≅ S₃ 换标对照——讲同构的杀手级演示 |
| minimap | UI | 大群 3D 导航 |
| 渲染风格 | VP | 线框 / 实体 / 玻璃 |

**架构预留（动手前必读）**：若 Steps 分镜确认要做，`FigurePreset` schema **从 v1 起预留 `steps?: []`**（先不实现），避免后续 schema 破坏性升级；Decorations 协议同理预留 `inset` / `callout` 锚点类型（见 §4.4）。

### 3.4 ⛔ 否决与边界

见 §1.3（主画布不接、2D 面填充否决、不按群阶特判、教学逻辑归 GVL）——**不在此重复**。

---

## 4. Phase 0 施工方案（2026-09-24 定稿）

> 范围 = 用户所称「A 组剩下三个」：**Decorations 协议 · FigurePreset + `useFigurePreset` · 注册表驱动面板**。

### 4.1 本轮拍板

| 议题 | 结论 |
|------|------|
| 主画布接线 / 2D 面填充 | 见 §1.3 前两行（不接 / 否决） |
| 三件地基 | **开工**（本节 4.4–4.7） |
| **注释锚点模型** | 用户 2026-09-24：「注释是相对于某个元素**节点**或**边**的，或**整个图案**的」⇒ 锚点三类 `node` / `edge` / `figure`；坐标一律按**相对位置**存——节点/边锚点跟随元素移动（拖拽、力导向重排都跟着走），`figure` 锚点用图案坐标系（缩放平移跟着图走） |
| **注释交互** | 面板驱动（用户授权「怎么方便怎么设计」）：面板 Annotations 区 = 列表 + 锚点类型选择 + TeX 文本框 + ✕ 删除；「+ 添加」默认取当前选中元素作锚点。**画布鼠标行为不改**（2D/3D 共用一套，避免两套编辑态） |
| **UI-1 迁移范围** | 只迁**凯莱 31 个**（2D 18 + 3D 13）+ 通用区 6；其余 8 个视图（set/cycle/table/子群格/陪集条带/对称/同态/作用）共 21 个控件保持手写 |
| **3D 注释** | v1 **只做 2D**：2D 注释随 `exportSVGContent` 自动烘焙、可直接用于博客配图；3D 注释（Html 覆盖层不进 canvas 栅格）等导出方案定了再做，不交付"导不出的功能" |
| **FP 的 JSON 形态** | **剪贴板 + 弹窗文本框**（导出=复制，导入=粘贴），零文件系统 API 依赖 |

### 4.2 现状核实（2026-09-24 以代码为准）

| 事实 | 证据 |
|------|------|
| 三件都是从零起 | 全仓 grep `Decorations` / `Annotation` / `FigurePreset` / `useFigurePreset` **零命中**（`src/` 与 `src/package/` 均无） |
| 面板是单组件、逐视图分支、硬编码英文标签 | `ViewParamsPanel.tsx` **931 行**，`{view === 'set' && (<>…</>)}` 式分支；控件为裸 `<div>`+`<input>`，标签是 `"Node radius"`/`"Gap"` 一类英文字面量（**不接 i18n**）；回写统一走 `updateViewParams(patch)` |
| 存量控件规模（迁移工作量基线） | 面板内 `input[type=range]` **18** · `checkbox` **33** · `color` **1** · `<select>` **6**（合计 58 个交互控件） |
| 编辑类控件有同形先例 | `floatingView/CayleyPathEditor.tsx`（109 行：text 输入 + 本地态 + `resetKey` 换群同步） |
| 2D 导出会自动烘焙 DOM 叠层 | `utils/exportApi.ts` 的 `exportSVGContent()` 直接序列化画布 `<svg>` ⇒ 注释只要渲染进同一棵 SVG 即随图导出，**零额外工作量** |
| 3D 导出**不**烘焙 DOM 覆盖层 | 3D 走 `exportCanvasDataUrl()`（canvas 栅格）；`Html` 注释层不进图 ⇒ 已知缺口（见 §4.6 第 5 条） |
| 面板 DOM 形状被测试硬编码断言 | `Cayley3DWindowParams.component.test.tsx`：面板内 `input[type=range]` = 2/4、`checkbox` = 13、`color` = 4、`select` 数量；`CayleyWindowParams` 同类计数（range 4、checkbox 16 = 含 DEC-2 的 Leader line） |
| **⚙ 面板的落点只有 `ViewWindow`，应用的浮窗没有面板**（2026-09-24 实测发现） | 应用自己的浮动视图窗走**老式壳** `floatingView/FloatingViewWindow.tsx` + `lazyViews.renderViewContent`（229 + 500 行）——纯标题栏 + 内容 + 缩放手柄，`grep 'input type'` = **0**、无 `Parameters` 按钮。`ViewParamsPanel`（含 F/E/B 组与 DEC-2 注释编辑器）只挂在 `ViewWindow`（FGVE 受控内核）上，而 `ViewWindow` 在仓内的消费点只有 `TestPage2.tsx`（`?test=2` 博客配图页，7 个窗口）+ 包消费端。⇒ **今天之前所有 VCL 控件在应用里都点不到**；`?test=2` 的凯莱窗口又用 `FIGURE`（`showControls:false`）隐藏控制条，所以博客配图窗口本身也没有 ⚙ |
| **导出通路只认主画布**（同上发现） | `utils/exportApi.exportSVGContent()` 与 `utils/export.exportView()` 都取 `document.querySelector('.canvas-viewport')` = **主画布**；导出按钮在 `ViewPanel`。⇒ **浮动窗口里的图（含注释）今天导不出来**——而主画布按 §1.3 决策不接 VCL。这是"编排一张插图用于博客"的最后一段缺口 |
| 协议与门禁 | 新 core 模块须同步 `src/core/index.ts` 门面；`coreBoundary.test` 守 core 零 UI；`GroupDescriptor v1` 的 zod + 幂等模式（`core/descriptor.ts`）是现成模板；schema 必须带 round-trip 测试；改 src props 后须 `npm run build:pkg`，消费页/冒烟才可见 |

### 4.3 先决设计冲突：`Decorations.paths` 与已落地的 `pathHighlight` 是两份真源

- 已落地：`CayleyViewParams.pathHighlight` / `Cayley3DViewParams.pathHighlight`（2D/3D 共用 `core.resolveCayleyPath`，含 `dimOthers`/`animate`/`showOrder`/`width`/`color`，有测试 + 真机验证）。
- 草案：`Decorations.paths: PathHighlight[]`（多路径 + label）。两者语义重叠。

**决定**：`Decorations` v1 **只做 `annotations`**；`paths` **在 schema 里预留字段但不实现、渲染端不消费**；「多路径」作为后续 `pathHighlight → paths[]` 的合并议题——等真出现"一张图要标两条路径"的需求再迁，届时只迁一次。

### 4.4 接口草案（core 纯协议，零 React）

```ts
// core/types/decorations.ts（新）
export const decorationAnchorSchema = z.object({
  type: z.enum(['node', 'edge', 'figure', 'inset', 'callout']), // 后两者预留不实现
  ref: z.string().optional(),        // node / edge：元素引用，走 core/algebra/elementRef 解析
  actionRef: z.string().optional(),  // edge：该边对应的作用元素引用（两者共同定位一条边）
  offset: z.object({ dx: z.number(), dy: z.number() }).optional(), // 相对锚点的位置偏移
})
export const annotationSchema = z.object({
  id: z.string(),
  anchor: decorationAnchorSchema,
  text: z.string(),                  // TeX，渲染走 texify → renderTex（与节点标签同一条路）
  leader: z.boolean().optional(),    // 从锚点画引导线到文本
  color: z.string().optional(),
})
export const decorationsSchemaV1 = z.object({
  schemaVersion: z.literal('1'),
  annotations: z.array(annotationSchema),
  paths: z.array(z.unknown()).optional(),   // 预留：多路径（v1 不实现，见 §4.3）
})
```

```ts
// core/types/figurePreset.ts（新，FP-1）
export const figurePresetSchemaV1 = z.object({
  schemaVersion: z.literal('1'),
  id: z.string(),
  title: z.string().optional(),
  group: z.object({
    symbol: z.string(),                              // v1 存 symbol；表群回放走 descriptor 门禁（ROADMAP §2.1）
    descriptor: GroupDescriptorSchemaV1.optional(),
  }),
  view: z.enum(VIEW_MODES),                          // 复用既有 ViewMode 枚举
  viewParams: z.record(z.string(), z.unknown()),     // 用既有逐视图 *ParamsSchema 校验（已齐）
  decorations: decorationsSchemaV1.optional(),
  theme: z.enum(['dark', 'light']).optional(),
  camera: z.record(z.string(), z.unknown()).optional(),
  steps: z.array(z.unknown()).optional(),            // §3.3 架构预留，v1 不实现
})
```

配套 `serializeFigurePreset` / `deserializeFigurePreset`（幂等 + zod，对齐 descriptor 门禁口径）；`useFigurePreset(preset)` 放 `@groupviz/react`，与 `useSceneState` 平级，v1 返回 `{ sceneProps, decorationsLayer }`。

### 4.5 分刀顺序与验收

> 顺序理由：**每刀都要有可见物**（用户标准：无可见影响的改动不接）；协议先用在新控件上验证，再迁移存量。

| 刀 | 内容 | 可见验收物 |
|----|------|-----------|
| **DEC-1** | core `decorations.ts` 协议 + schema + round-trip 测试 + 门面导出（零行为变化） | —（全批唯一无可见物的一步：1 新文件 + 1 测试） |
| **DEC-2** ✅ | 2D `CayleyView` 顶层 `<g>` 注释叠层（位置由锚点实时解析：`node`/`edge` 取当前坐标 ⇒ 拖拽与力导向重排都跟随；`figure` 走视图坐标、文本按锚点左上角排布不裁切）；面板「Annotations」区（锚点类型 + 元素引用 + TeX 文本 + 引导线/颜色 + ✎编辑/✕删除 + 「↑ sel」取窗口选中元素），随窗口持久化（`gv-vw-*` 的 `decorations`，旧存档兼容） | **已真机验收**（2026-09-24 · `?test=2` + 本机 Chromium）：A₄ 凯莱图给 (234) 挂 `g^2=e` → 图上出注释 + 虚线引导线；拖动该节点 120/70px，注释同步位移 (59.5,183) → (180.0,252.5)；整图锚点 `Z(G)=\{e\}` 不裁切；0 JS 错误 |
| **W-0 导出** ✅ | 窗口内导出（`ViewWindow` 标题栏 ⤓）：2D → 自包含 SVG、3D/对称性 → PNG；序列化抽零依赖模块 `utils/exportSvg.ts` | **已真机验收**（2026-09-24）：导出 `图-2-凯莱图.svg`（85 KB，含 `<style>` / KaTeX CDN 改写 / **注释图层**），`file://` 独立渲染时 `g²=e` 正常显示 |
| **UI-1** | `ViewControl` descriptor + 通用 `ControlPanel` 渲染器；迁移 2D/3D 凯莱面板 **31** 个存量控件（2D 18 + 3D 13）+ 通用区 6；DEC 控件改 descriptor 驱动。**其余 8 视图 21 个控件保持手写** | 既有面板外观逐位不变 + **面板 DOM 计数测试保持不变**（零回归证明即本步的可见物） |
| **FP-1** | `figurePreset.ts` 协议 + 序列化 + `useFigurePreset` + 面板「Save / Load preset」：导出=**复制 JSON 到剪贴板**、导入=**粘贴**（弹窗文本框） | 调好一张插图（含注释）→ 复制 JSON → 清空 → 粘贴导入 → 逐位还原 |
| 本批之外 | 3D 注释、预设库列表、深链、尺寸预设、caption 烘焙、TikZ | 见 §3.3 池 |

### 4.6 风险与坑（施工前须知）

1. **面板 DOM 计数断言是 UI-1 最大风险点**（见 §4.2）。迁移前先补一条「控件清单快照」测试（descriptor 数组 ↔ 渲染出的 input 类型/数量），迁移后用它证明等价；一旦计数漂移，等于把"面板没坏"的唯一自动化证据削掉。
2. **标签保持硬编码英文**：descriptor 里直接带英文字面量，与现状一致；不顺手 i18n（属另一类改动，另批）。
3. **注释文本与节点标签同路**：走 `texify → renderTex`（KaTeX）放进 foreignObject——与既有节点标签完全一致，**导出保真度 = 现状水平**（KaTeX 样式在导出文件里会掉，见 §3.3 池「导出内联 KaTeX CSS」）。若将来做 3D 注释，`Html` 层必须继承 `SceneThemeRoot` 的 `data-theme`，否则深色视图窗里出现白底块。
4. **元素引用走 `elementRef`**：Sₙ 元素 id 含逗号（`2,1,3,4`）——`pathHighlight` 曾因 `/[\s,]+/` 分词在 TestPage 解析出 0 条边；注释锚点解析禁止重蹈（`core/algebra/elementRef.ts` 是唯一入口）。
5. **导出的两道门**（2026-09-24 已解一半）：① **窗口内导出已交付**（W-0，2D SVG / 3D PNG，注释随图）⇒ 注释不再"只能看不能出图"；② 主画布导出入口（`exportView` / `exportSVGContent`，取 `.canvas-viewport`）**与此互不干扰**，且按 §1.3 不接 VCL。仍在的缺口：**3D 注释**不做（canvas 栅格不烘焙 HTML 层，v1 明确不交付）；**应用自己的浮窗**要等窗口框架融合（[PLAN_WINDOW_FRAMEWORK.md](PLAN_WINDOW_FRAMEWORK.md)）才能拿到导出按钮与 ⚙ 面板。
6. **预设载群**：v1 只存 `symbol`，回放走 `createGroupFromSymbol`——注意其 `C_n` 上限仅 30 阶（TestPage 实测坑）；大群/表群回放需 descriptor 全量，与 ROADMAP §2.1「descriptor 真 round-trip 载群」一起做，不在本批。
7. **换群后残留注释**：引用解析不出时渲染端静默跳过（设计如此），但面板列表里仍会列出——若嫌脏，可在换群时清空（`ViewWindow` 已有 `resetAll` 清空路径）。

### 4.7 待定（需一句话确认）

1. ~~导出闭环怎么补~~ → **已定并交付（2026-09-24 W-0）**：按「给 FGVE 窗口加导出按钮」实施，真机验收通过（§4.5）。
2. FP-1 只做 schema + hook + JSON 导入导出，**不做**预设库列表 / 深链——建议照此（库留在 Tier B）。
3. 面板标签保持硬编码英文，不顺手 i18n——建议照此。
4. ~~应用浮窗与 FGVE 内核的面板鸿沟要不要收口~~ → **已立项为独立方案**：[PLAN_WINDOW_FRAMEWORK.md](PLAN_WINDOW_FRAMEWORK.md)（用户 2026-09-24 定「融合」，三壳合一；待批其 §4 三个语义取舍）。

---

## 5. 决策记录

| 日期 | 决策 |
|------|------|
| 2026-09-11 | **VCL 立项**：三层架构 + 四子系统（ViewParams / Decorations / Control UI / FigurePreset）；口径 = VCL 管"怎么呈现一张图"，不管"教学逻辑本身"（后者归 GVL） |
| 2026-09-11 ~ 09-12 | **施行顺序改为「先用起来」**：原计划先做 Phase 0 地基，实际先交付了能用得上的边几何 / 路径高亮 / 动态力导向（见 CHANGELOG），地基顺延 |
| 2026-09-24 | **主画布不接 VCL 控件**：主画布 = 新视图/新形状的先行试验田，不承担插图编排（原「甲组 A1/A2」取消） |
| 2026-09-24 | **2D 面/陪集填充否决**：2D 已够乱；陪集语义由商群悬浮窗 + 3D `faceFill` 承载 |
| 2026-09-24 | **`Decorations` v1 只做 annotations**：`paths` 仅预留 schema 字段，避免与已落地的 `pathHighlight` 形成两份真源（见 §4.3） |

---

## 6. 参考实现吸收台账（S₅ 字长球单文件 HTML，2026-09-12）

> 来源：用户提供的独立单文件实现（three.js + 原生 DOM，S₅ 凯莱图 · 相邻对换生成元 · 3D 球形分层布局）。**布局算法本身已逐行移植入 core**（见 [CAYLEY.md](CAYLEY.md) 形状表 + CHANGELOG 2026-09-12）。本节只登记它的**交互/编排层**，避免随参考文件丢失。

**已吸收进 VCL**：球壳开关（`shell`）· 纬度环（`layerRings`）· 重新优化布局（`relayoutNonce`）· 生成元图例 + 点击切显隐（`showLegend`）· 重置视角（既有 `fitOrbit` / 双击复位）· 布局质量相关的边-边斥力实现（入 `relayoutNonce` 的松弛路径）。

**待吸收**（已登记进 §3.3 池）：

| 参考做法 | 落点 |
|----------|------|
| 布局质量指标行（松弛前后最小边距、近距边对计数，阈值可调） | Tier A 图质量读数面板 |
| 字长直方图（分层柱状）→ 悬停柱高亮该层 | Tier A 分层选择器 |
| 节点悬停信息卡（one-line + 轮换分解 + 字长 + **最短表达数** + 邻边分色 ±1） | Tier A hover 字段清单 + core `reducedWordCount` |
| 悬停节点 → 高亮邻边并同时高亮图例项 | Tier A 悬停联动图例 |
| 纬度带厚度 `BAND_RATIO` / 外圈吸附 `SNAP_RATIO` | Tier A 3D 布局旋钮 |
| 单文件即插即用（自带面板、无框架依赖） | Tier B 自包含片段导出 |

一句话：参考实现的价值不止布局算法——它把**「图 + 读数 + 图例 + 开关 + 重排」当成一个整体交付**，这正是 VCL 要长成的样子。

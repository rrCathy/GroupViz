# 视图控制层（View Control Layer, VCL）规划

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-09-11。状态：**规划草案（待评审）**。
> 建议落位：Roadmap 中期 FGVE 阶段下新增 **§2.6 视图控制层**，介于「FGVE 引擎化（§2）」与「GVL 教学实验室（§3）」之间——它是把 FGVE 从「展示群的各种视图」升级为「方便展示、方便教学的各自插图」的那一半。

---

## 0. 一句话定位

- **目标 A（已接近完成）**：把群的各种视图算出来、画出来 → 由**计算层** + **视图渲染层** 承担。
- **目标 B（尚有大段缺口）**：个性化地**编排一张插图**用于教学/博客 → 需要再叠一层**视图控制层（VCL）**。

本规划只谈 VCL（目标 B）。你之前提的「3D 凯莱图面着色」「凯莱图添加注释」以及「边弯曲/笔直、逐生成元边长、凯莱图路径」全部属于这一层。

---

## 1. 现状盘点（已有什么、缺什么）

### 1.1 已存在的 VCL 雏形（全是真实代码，非设想）

| 资产 | 位置 | 作用 |
|------|------|------|
| 逐视图 `viewParams` 协议 + zod schema | `src/core/types/viewConfig.ts` | `CayleyViewParams` / `Cayley3DViewParams` / `CycleViewParams` / `TableViewParams` / `SublatticeViewParams` / `CosetStripViewParams` / `SymmetryViewParams` / `HomomorphismViewParams` / `ActionViewParams`，每个都带 `*ParamsSchema`（序列化安全） |
| 3D 凯莱图面着色 | `Cayley3DViewParams.faceFill` + `src/core/algebra/faces3d.ts` | ✅ **已落地**。子群陪集面填充，含逐面颜色覆盖、透明度；Scene 渲染与 ⚙ 面板共用同一份候选数据（所见即所得） |
| 窗口级控制 + 持久化 | `src/components/Canvas/FloatingViewWindow.tsx` + `ViewWindowConfig` + `ViewWindowPersistData` | 受控 `viewParams` / `onViewParamsChange`；⚙ 参数面板；localStorage round-trip（`gv-sw-*`） |
| 测试护城河 | `CayleyWindowParams` / `Cayley3DWindowParams` / `ActionWindowParams` | 面板控件 + 受控回调 + 持久化 schema 均有组件测试 |

### 1.2 关键缺口（即 VCL 要做的事）

| 能力 | 现状 | 说明 |
|------|------|------|
| **边弯曲/笔直** | ❌ 硬编码 | `GroupCanvas.tsx:122-124` 与 `SetView.tsx:132-134` 里 `curveOffset = 2.5` 写死，不是控件、不可调 |
| **逐生成元边长** | ❌ 不存在 | `CayleyActionParam` 只有 `enabled`/`color`，没有长度/权重 |
| **凯莱图注释** | ❌ 不存在 | 全仓 `annotation` 仅出现在 KaTeX 的 MathML 标签里，没有真正的图上注释 |
| **凯莱图路径高亮** | ❌ 不存在 | 没有「按生成元单词高亮一条 walk / 路径」的模型 |
| **2D 面/陪集填充** | ⚠️ 仅 3D | `faceFill` 只在 `Cayley3DViewParams`；2D `CayleyView` 还没有 |
| **控制面板一致性** | ⚠️ 每窗重写 | 每个 `FloatingViewWindow` 自己重写参数面板，没有注册表驱动；新增控件=重写面板 |
| **插图级预设** | ⚠️ 仅内联 | 教学插图目前把 `viewParams` 内联在 `TestPage2` 等 demo 里，没有**命名的、可分享的、可导入导出的 FigurePreset** |

**结论**：VCL 不是从零建，而是把 `viewConfig.ts` + `FloatingViewWindow` 这套雏形**正式化为第一层**，补齐缺口、统一面板、引入"插图预设"概念。

---

## 2. 三层架构（含 VCL 的落点）

```
┌──────────────────────────────────────────────────────────┐
│  视图控制层 View Control Layer (VCL)  ← 本规划新增/成熟化   │
│  FigurePreset · Decorations · 注册表驱动 Control UI       │
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

**边界纪律（沿用 AGENTS §4/§5 既有约定）**：
- `core` 只放**可序列化协议 + 纯函数**（ViewParams schema、Decorations schema、figure 序列化），零 React 依赖（`coreBoundary` 测试守护）。
- 控制 UI、Scene 内的 decorations 叠层渲染放在 `@groupviz/react`。
- 所有新增默认 = **当前行为**（附加式 minor），不破坏既有插图。

---

## 3. VCL 的四个子系统

### 3.1 ViewParams 协议（扩展 `viewConfig.ts`）
- 在现有逐视图 params 上补字段，不重造：
  - `CayleyViewParams` / `Cayley3DViewParams` 增加 `edgeStyle?: 'straight' | 'curved'`、`edgeCurvature?: number`、`actions[].lengthScale?: number`。
  - `CayleyViewParams` 增加 `faceFill?: Cayley2DFaceFillParams`（把 3D 面着色下放到 2D）。
- 所有新字段带 zod schema（序列化圆角），沿用 `*ParamsSchema` 命名。

### 3.2 Decorations 模型（新增，render-agnostic）
这是"注释 + 路径"的统一抽象——当前缺失的根因是**没有一份可序列化、与具体 Scene 无关的装饰协议**。建议在 `core` 定义：

```ts
// 提案类型（待细化）
interface Decorations {
  annotations: Annotation[]
  paths: PathHighlight[]
}
interface Annotation {
  anchor: { type: 'node' | 'edge' | 'point'; ref: string; offset?: { dx: number; dy: number } }
  text: string          // TeX 能力（复用 Tex.tsx）
  leader?: boolean      // 是否画引导线
}
interface PathHighlight {
  elements: string[]    // 一条 walk：生成元单词对应的元素序列
  color?: string
  label?: string
  animate?: boolean     // 沿路径逐步点亮
}
```
- Scene 侧：2D 在 SVG 顶层 `<g>` 叠层；3D 用 `Html`/billboard 叠层；两者消费同一份 `Decorations`。
- 交互：点节点 → 弹「加注释」；框选/连点 → 生成 `path`。

### 3.3 注册表驱动 Control UI（统一 ⚙ 面板）
- 把"每个 `FloatingViewWindow` 重写面板"替换为：**能力描述符 → 自动生成控件**。
- 每个 `viewParams` 字段配一个 descriptor（label / 控件类型 / 取值范围 / 联动），面板由 descriptor 渲染，新增控件只需加 descriptor，不再碰面板 JSX。
- 受益：面着色、边几何、注释、路径四类控件用同一套机制长出 UI。

### 3.4 FigurePreset（插图级预设——教学消费的核心单元）
```ts
interface FigurePreset {
  id: string
  title: string
  group: GroupDescriptor        // 复用 §2.4 descriptor round-trip
  view: 'cayley' | 'cayley3d' | 'cycle' | 'set' | 'table' | ...
  viewParams: Record<string, unknown>
  decorations: Decorations
  theme: 'dark' | 'light'
  camera?: Record<string, unknown>
}
```
- 序列化：`serializeFigurePreset` / `deserializeFigurePreset`（幂等 + zod 校验，对齐 descriptor 门禁）。
- 消费：GVL 课程中一张插图 = 一个 `FigurePreset`；博客嵌入 = `<FigurePreset src={json} />`，导出 SVG/PNG 时把 decorations **烘焙进图**。
- 配套：`useFigurePreset(preset)` 便利 hook → 返回 `hostProps` + `sceneProps` + `decorationsLayer`，与 `useSceneState` 平级。

---

## 4. 能力清单（按优先级，附现状）

| 优先级 | 能力 | 落点 | 现状 |
|--------|------|------|------|
| P0 | 边弯曲/笔直 + 曲率 | `Cayley*ViewParams.edgeStyle/Curvature` | ✅ 2D 已落地（`CayleyViewParams.edgeCurvature`，见 §9） |
| P0 | 逐生成元边长 | `CayleyActionParam.lengthScale` | ✅ 2D + 3D 已落地（`core.relaxEdgeLengths` / `core.relaxEdgeLengths3D`，见 §9） |
| P0 | 注释（节点/边/自由点 + 引导线 + TeX） | `Decorations.annotations` | 不存在（Decorations 抽象未做） |
| P0 | 凯莱图路径高亮（单词 walk + 可选动画） | `Decorations.paths` | ✅ 2D + 3D 已落地（`CayleyViewParams` / `Cayley3DViewParams.pathHighlight`，共用 `core.resolveCayleyPath`，见 §9） |
| P1 | 2D 面/陪集填充 | `CayleyViewParams.faceFill` | 仅 3D |
| P1 | 注册表驱动 ⚙ 面板 | Control UI 重构 | 每窗重写 |
| P1 | FigurePreset 序列化 + `useFigurePreset` | core + react | 仅内联 |
| P2 | 节点位置覆盖（教学标注摆位） | `viewParams.nodeOverrides` | CycleView 已有 `getNodePosition` 局部态，未进预设 |
| P2 | 预设库：localStorage + 导入导出 JSON + 分享链接/嵌入片段 | `FigurePreset` 生态 | 不存在 |
| P2 | 导出烘焙 decorations（SVG/PNG/GIF） | 复用 exportApi | 未接 decorations |

---

## 5. 分阶段路线（建议）

### Phase 0 — 正式化与统一（地基，零视觉变化）
- 抽 `ViewControl` 注册表；定义 `FigurePreset` schema；把 ⚙ 面板收口为注册表驱动 `ControlPanel` 骨架。
- 交付：`FigurePreset` 类型 + 序列化/反序列化 + `useFigurePreset` 骨架 + 注册表面板骨架。
- 验收：既有插图外观逐位不变（附加式），新增的只是"可描述"能力。

### Phase 1 — 边几何控件
- `edgeStyle` / `edgeCurvature` / 逐 action `lengthScale` 进 `Cayley*ViewParams` + schema；用 params 驱动原先写死的 `curveOffset`；补面板控件与测试。
- 风险低：默认值 = 当前外观。

### Phase 2 — Decorations 叠层（注释 + 路径）
- `core` 引入 `Decorations` 协议（可序列化）；2D/3D Scene 各自实现叠层渲染；面板 + 点选交互（加注释、连路径）；补齐那条"缺失的抽象"。
- 这一步同时补上你点名的「凯莱图注释」与「凯莱图路径」两块。

### Phase 3 — 插图预设库与教学消费
- 命名预设存储（localStorage + 导入/导出 JSON + URL/嵌入片段）；GVL 就绪：一张插图 = 一个 `FigurePreset`；博客嵌入 = `<FigurePreset src=.../>`；导出 SVG/PNG 烘焙 decorations。

---

## 6. 与既有路线图的衔接

- **新增 §2.6「视图控制层（VCL）」**：作为中期 FGVE 阶段的一个独立工作流（与 §2.3 特征标表并列），不等同于 GVL（远期）——VCL 是 GVL 的**前置能力**，先把"编排插图"做出来，GVL 才能直接消费。
- 复用现有基建：GroupDescriptor（§2.4）、`viewConfig.ts` schema、`FloatingViewWindow` 持久化、`useSceneState`（§API 2）、Tex 渲染、`exportApi`。
- 工程口径不变：core 边界、`coreBoundary` 守护、附加式 minor、发布门禁（参考 §2.1 的 `publish:smoke`）。

---

## 7. 待你拍板的问题

1. **范围优先级**：P0 四块（边几何 / 注释 / 路径）是否一次性进 Phase 1+2，还是先只做"边几何"最小可用？
2. **Decorations 落点**：注释/路径的编辑交互放在 `FloatingViewWindow` 内（嵌入式），还是主画布也复用同一套 `Decorations`？（建议统一，主画布与窗口共享协议）
3. **FigurePreset 是否现在就入库**：Phase 0 先只定义 schema + hook，还是连"预设库/导入导出"一起做？
4. **是否折进 ROADMAP**：本草案通过评审后，是否作为 §2.6 写入 `docs/ROADMAP.md`？

---

## 8. 发散清单（Backlog Pool，2026-09-11 二轮发散）

> 口径：**VCL 管"怎么呈现一张图"，不管"教学逻辑本身"**（后者归 GVL，见 §8.9）。
> 标记：`VP`=ViewParams 协议 · `DEC`=Decorations · `UI`=Control UI · `FP`=FigurePreset · `NEW`=可能需要新子系统 · `GVL`=建议移出 VCL。

### 8.1 时间维度（§3 现有四子系统完全缺失的一维）

| 功能 | 归属 | 说明 |
|------|------|------|
| **分镜步骤 Steps** | NEW | 一张插图 = 多个状态逐步展现：先生成元 → 再加边 → 再面着色 → 再路径，带 scrubber/键盘步进。FigurePreset 升格为 FigureSequence（preset 数组 + 过渡） |
| 逐元素入场动画 | DEC | 节点/边 staggered reveal，讲课时图"长出来" |
| 相机关键帧（3D） | FP | 预设视角序列 + 插值 → 导出 mp4/GIF |
| 交互录制回放 | NEW | 录制旋转/选中/高亮序列，回放或导出动图 |

### 8.2 语义装饰（数学语义 → 一键样式，替代手工 subsets）

| 功能 | 归属 | 说明 |
|------|------|------|
| **共轭类一键着色** | VP | 共轭类是天然划分，比手工 subsets 高频得多 |
| 元素阶徽标 / 阶→形状映射 | VP | 2 阶方形、3 阶三角…，讲 Lagrange/Cayley 直观 |
| 点元素 → 高亮 ⟨g⟩ 闭包 | DEC | 点击任意元素高亮其生成循环子群（跨 set/cayley/cycle/table） |
| 中心 Z(G) / 正规子群专属标记 | DEC | 双环/描边区分，讲中心与正规性 |
| 陪集边界描边 + \|G:H\| 区域标注 | DEC | 与面着色配套 |
| 教学友好生成元集预设 | VP | 一键换"好讲"的生成组（如 Dₙ 用 {r,s} 而非 GAP 任意对） |
| 图中图 inset（母图内嵌子群视图） | DEC | 讲子群时在母图角落嵌子群小图 + 连线 |

### 8.3 标签与重命名系统

| 功能 | 归属 | 说明 |
|------|------|------|
| **标签方案切换** | VP | 循环记号 / 幂记号（Cₙ 显 gⁱ）/ 自定义别名，逐图可切 |
| 同构重命名视角 | NEW | D₃ ≅ S₃ 换标对照——讲同构的杀手级演示 |
| hover 气泡内容自定义 | UI | 教师定义悬停显示什么（阶/共轭类/自定义文本） |

### 8.4 图面排版（插图质感，教学插图刚需）

| 功能 | 归属 | 说明 |
|------|------|------|
| **标题/副标题/图注 caption 系统** | FP | "图 3.2：S₄ 的 Cayley 图"，导出时烘焙 |
| 自动图例 legend | DEC | 颜色/线型 → 含义表，从 viewParams 自动生成 |
| **黑白/色盲友好** | VP | 线型+虚实区分生成元（打印讲义刚需），色板切换 |
| 边样式细化 | VP | 粗细/虚实/箭头风格/双向边上下错开 |
| 手动布局编辑模式 + 位置入预设 | NEW | 拖摆节点位置持久化进 preset（CycleView 已有局部态，扩到全视图） |
| 聚焦聚光灯 | DEC | 非兴趣区压暗，讲某一陪集时其余退后 |

### 8.5 跨视图协同

| 功能 | 归属 | 说明 |
|------|------|------|
| 多窗口联动选中 | NEW | 选中元素全视图同步高亮（选 S₃ 的 (12)，Cayley/cycle/table/set 同时亮） |
| 并排比较双群 | FP | D₄ vs Q₈ 同布局对照，一个 preset 编排两张图 |
| 合成 panel 导出 | FP | 多图拼版导出（教材式组合插图） |

### 8.6 导出/交付

| 功能 | 归属 | 说明 |
|------|------|------|
| **TikZ/PGF 源码导出** | FP | LaTeX 讲义直接可用，教学场景杀伤力大 |
| caption 烘焙导出 | FP | 标题/图注进 SVG/PNG |
| 尺寸预设 | FP | 16:9 / A4 / 博客宽 |
| 深链分享 | FP | URL 编码 preset，点开即看 |

### 8.7 3D 特有

| 功能 | 归属 | 说明 |
|------|------|------|
| 爆炸图 | VP | torus/cylinder 拆层展示直积结构 |
| 渲染风格 | VP | 线框/实体/玻璃 |
| minimap | UI | 大群 3D 导航 |

### 8.8 交互门控（演示态控制）

| 功能 | 归属 | 说明 |
|------|------|------|
| 揭示模式 | UI | 标签/答案默认遮住，点击逐个揭示（讲课悬念） |
| 禁选区 | UI | locked/zoomLocked 已有；补"只许点这几十个元素" |

### 8.9 明确归 GVL、不进 VCL 的

练习/测验逻辑（判子群、找生成元）、课程链与进度跟踪、引导式提示系统——这些是**教学逻辑**，消费 VCL 产出的插图，但不在 VCL 内实现。

### 8.10 落地分层建议

| 层 | 内容 | 时机 |
|----|------|------|
| **Tier A**（高价值低成本，建议并入 P1/P2 一起做） | 标签方案切换、共轭类一键着色、caption/legend、虚线线型（黑白友好）、hover 内容自定义、揭示模式、布局位置入预设 | Phase 1/2 顺带 |
| **Tier B**（价值高、有依赖，Phase 3 预设生态时做） | Steps 分镜、TikZ 导出、尺寸预设、并排比较、爆炸图、相机关键帧、深链、inset | Phase 3 |
| **Tier C**（重工程，GVL 前再评估） | 多窗口联动选中、交互录制回放、同构重命名、minimap、渲染风格 | 视消费端反馈 |

**架构影响提示**：若 Steps 分镜（§8.1）确认要做，`FigurePreset` schema **从 v1 起预留 `steps?: []` 字段**（先不实现），避免后续 schema 破坏性升级；Decorations 协议同理预留 `inset`/`callout` 锚点类型。

---

## 9. 实施状态（2026-09-11 批次一 · 2026-09-12 批次二）

已交付（2D 凯莱图 + 3D 凯莱图，仅 FGVE 窗口/包 props 路径；主画布未接）：

| §4 条目 | 状态 | 落点 |
|---------|------|------|
| 边弯曲/笔直 + 曲率 | ✅ 2D | `CayleyViewParams.edgeCurvature`（0 = 笔直；平行边自动左右分摊） |
| 逐生成元边长 | ✅ 2D + 3D | 2D：`CayleyActionParam.lengthScale` + `core.relaxEdgeLengths`（**覆盖全部形状**的通用后处理）；3D：同一 `lengthScale` 字段 + `core.relaxEdgeLengths3D`（三维松弛；斥力按基础布局平均边长自适应、无边界钳制） |
| 凯莱图路径高亮 | ✅ 2D + 3D | 2D：`CayleyViewParams.pathHighlight`；3D：`Cayley3DViewParams.pathHighlight`；两者共用 `core.resolveCayleyPath`（元素序列 / 生成元单词，方向敏感，可选动画/序号） |
| 动态力导向 2D 凯莱图 | ✅ 2D | `CayleyViewParams.forceDirected`（**开关**，非新形状）+ `core.createCayleyForceSim`（持续可拖拽 + 实时受力） |
| 节点可调大小 | ✅ 已有 | `nodeRadius`（2D）/ `nodeScale`（3D，窗口 ⚙ 面板早已提供） |
| 3D 球壳装饰（2026-09-12） | ✅ | `Cayley3DScene` 的 `wordLengthSphere` 分支内置半透明球壳（半径 = 最外层节点球面、`depthWrite:false` 不遮挡内部节点）；**尚未控件化** → §10.3 待补 `Cayley3DViewParams.shell` |

**验证（批次二收官）**：`tsc -b` 干净 · `npm run lint` 0 problems · 全量 85 文件 1862 tests 全绿 · `vite build` 通过 · `npm run publish:smoke` CORE/REACT 双 PASS（含 `relaxEdgeLengths3D` 断言）· 浏览器实测 `/?test=1` 引擎消费卡片（C₄ 单生成元 2.5× 拉长、D₄ 双生成元 2.2×/0.5× 差异化 + 路径金线/序号，0 console error）。**页头「VCL 示例」四键**（一键复现：S₃ 2D 笔直 / A₄ 截角四面体 (12)(34) 2.2×·(234) 0.4× / S₄ 字长球哈密顿路径（`findHamiltonianWord` DFS）/ D₇ 2D 双环力导向）。

**待办（下一批候选）**：主画布 `GroupCanvas`/`ViewPanel` 接入 2D/3D 控件；`Decorations` 抽象（注释，§3.2）；2D 面/陪集填充（§4 P1）；注册表驱动 ⚙ 面板（§3.3）；`FigurePreset` 序列化与 `useFigurePreset`（§3.4）；3D 渲染开关 `shell`/`layerRings` 与「重新优化布局」入口（§10.3）。

**体验修复（2026-09-12，用户实测反馈两轮）**：

| 反馈 | 根因 | 修法 |
|------|------|------|
| 力导向「节点不跟手」 | `CayleyView` 拖拽把 `getNodePos()` 返回值当起点直接持有，而它正是 `sim.positions` 的**同一对象**、会被 `pin()` **原地改写** ⇒ 每次 mousemove 叠加上一次结果（位移三角累积 2.5–4×，节点越拖越飞） | mousedown 快照 `{x,y}`；mousemove 里立即 `setForcePositions`（不等 rAF）。实测逐像素 1:1 |
| 力导向「太软、拖一下形状大变样」 | `kSpring` 仅 0.06 + FR 全局斥力（任意两点耦合） | `kSpring` → 0.28；斥力 3.5×idealDist 截断；**拖拽中刚度 ×3**（`DRAG_STIFF`）；`maxSpeed` 1+12α → 0.6+6α；新增 `force.stiffness` + 面板 Rigidity 滑杆 |
| 路径高亮「视图里没显示出来」 | TestPage 哈密顿 word 用**元素 id**（Sₙ 的 id 含逗号 `2,1,3,4`），被 `/[\s,]+/` 分词拆碎 → `resolveCayleyPath` 解析出 **0 条边**（"金线"其实是生成元 34 的黄色边） | `findHamiltonianWord` 返回**生成元 label**；TestPage 路径改**白色 + 宽度 6** |
| 「非路径边不该显示」 | 路径线与生成元配色混在一起 | 新增 `pathHighlight.dimOthers`（**缺省 true**）：非路径边淡化（2D 0.12 / 3D 0.12–0.2 + 细管） |
| 「序号只能看见 1」 | 序号常显，长路径上互相遮挡、远处随距离缩小 | `showOrder` 改为**悬停该节点时显示**；3D 补受控 `hoveredElementId` prop（与 2D 对称） |

第二轮（用户：「想要 obsidian 里的交互式图谱那种效果」）：

| 反馈 | 根因 | 修法 |
|------|------|------|
| 力导向「一**点击**节点，图立马坍缩、许多节点纠缠在一起」 | `onMouseDown` 无条件 `pin()` + `alpha = 0.5` + wake ⇒ 每次点击都整图重新加热重排（且拖拽期 `stiff ×3` 让图收紧） | **4px 拖拽阈值**：未越界不 pin/不升温/不解钉（点击前后 avgR 完全不变）；`DRAG_ALPHA` → 0.22、`RELEASE_ALPHA` → 0.1；`gravK` 0.012 → 0.006（平衡尺度贴近初始布局） |
| 「节点纠缠在一起」 | 低热度下纯力场推不开重叠节点 | 新增 **`minSeparation` 硬约束**（缺省 idealDist×0.85）：每帧积分后把过近节点沿连线推开（钉住的不动、对方让位）；实测三次拖拽后 minGap 58 > 节点直径 56（修复前 35） |

第三轮（用户：「拖动一个节点，直接牵一发而动全身」）：

| 反馈 | 根因 | 修法 |
|------|------|------|
| 拖一个节点整图变形 | **力从不乘热度**：`alpha` 只管速度上限与循环寿命，弹簧/斥力位移每帧满量传递 ⇒ 位移沿弹簧链传遍全图（前两轮调"力的大小/刚度"因此无效） | 积分改 **`x += vx × alpha`**（FR 标准）；`DRAG_ALPHA` → 0.02；`unpin` 不升温（松手不回弹，重排走 Re-settle）；**删除拖拽刚度提升**（刚度越高传得越远）。实测拖 150px 其余 12 节点位移全为 (0,0)，松手后不变；碰撞推开保留 |

第四轮（用户：「拖动后动态效果僵硬；对 link/rep/rigid 过于敏感，稍微调调形状就大变样」）：

| 反馈 | 根因 | 修法 |
|------|------|------|
| 拖拽僵硬（上一轮矫枉过正） | 热度 0.02 + 松手不升温 ⇒ 邻居完全不动、无弹性收尾 | 标定 `DRAG_ALPHA` **0.2**（1 跳邻居 ~20–30% 粘性跟随、其余 2–7%）、`RELEASE_ALPHA` **0.25**（轻微回稳）。实测拖 150px：邻居 44px、其余 9–22px |
| 滑杆敏感（"稍微调调形状就大变样"） | `CayleyView` 模拟器 effect 依赖 `force.*` ⇒ **每次改参数都重建 sim + `initialAlpha:1` 全局重收敛** | 新增 **`sim.setOptions(partial)`**（就地改参数、保留位置速度、温和升温 0.55）；effect 拆分：结构依赖重建 / 参数依赖 `setOptions`。实测 link 1.0→1.3→2.0→1.0 每次 20–31px 平滑调整 |

---

## 10. 参考实现可借鉴细节（S₅ 字长球单文件 HTML，2026-09-12）

> 来源：用户提供的独立单文件实现（three.js + 原生 DOM，S₅ 凯莱图 · 相邻对换生成元 · 3D 球形分层布局），已在 `core/algebra/layouts3D/wordLengthSphereLayout3D.ts` 逐行移植。**布局算法本身已入 core**（见 [CAYLEY.md](CAYLEY.md) 形状表 + CHANGELOG 2026-09-12 行）；本节的用途是**把它的交互/编排层细节登记进 VCL 待办**，避免随参考文件丢失。

### 10.1 面板与读数（→ UI / DEC）

| 参考实现的做法 | 为什么对 VCL 有价值 | 落点 |
|----------------|--------------------|------|
| **布局质量指标行**：松弛前后最小边距、近距边对计数（阈值可调） | VCL 目前只看图，不给"这张图排得好不好"的数；教学插图需要一次判断"能不能用" | 新 `图质量面板`：复用 core 诊断先例（`countLatticeCrossings`），3D 增 `edgePairClearance` 读数 |
| **字长直方图**（11 层柱状 + 每柱点数），**悬停柱 → 高亮该纬度层**全部节点/边 | 「按语义分组做选择器」的通用范式：任何分层（字长/阶/共轭类）都能长出一个柱状选择器 | `VP` 分层选择器（§8.2 语义装饰的通用化）+ DEC 高亮 |
| **生成元图例**（4 色块 + 记号），**点击切换该生成元族显隐** | 现有 Edge actions 是面板里的复选列表；图例形式更贴近讲课"点色块关一类边" | `UI` 图例组件（由 actions 自动生成） |
| 极点 / 特殊层文本标注（e、w₀） | 与 §8.3 标签方案同源 | `VP` |

### 10.2 悬停与联动（→ UI / DEC）

| 参考实现的做法 | 为什么对 VCL 有价值 | 落点 |
|----------------|--------------------|------|
| 节点悬停**信息卡**：置换 one-line + 轮换分解 + 字长（逆序数）+ **最短表达数** + 四条生成元邻边分色列出并标 ±1 字长方向 | 「悬停显示什么」需要一个**字段清单模型**（而不是硬编码文案）——§8.3 hover 内容自定义正是这个 | `VP` hover 字段清单 + core 补 `reducedWordCount`（沿字长 DAG 的 DP 计数，暂无） |
| 悬停节点 → 高亮其全部邻边（含方向）**并同时高亮图例项** | 图↔图例双向联动，比单纯高亮更易读 | `DEC`/`UI` |
| 悬停边 → 显示生成元 + 两端字长变化 | 边的语义标注（§8.4 图例/线型的补充） | `DEC` |

### 10.3 视角与渲染开关（→ VP / DEC）

| 参考实现的做法 | 为什么对 VCL 有价值 | 落点 |
|----------------|--------------------|------|
| 开关组：自动旋转 / **球壳** / 纬度环 / 显示边 / 显示标签 | 现状：自动旋转、显示标签已有；**球壳与纬度环缺**（本次已把球壳实现为布局专属装饰，未控件化） | `VP` `Cayley3DViewParams.shell?: boolean` + `layerRings?: boolean`（默认关，附加式） |
| **「重新优化布局」按钮**（再松弛 N 轮） | 2D 已有 `forceDirected` + reheat；3D 侧缺少等价的"重排一次"入口 | `VP` `relayoutNonce`/`relaxIters`（触发布局后处理重跑，不改形状语义） |
| 重置视角 | 已有（→ `fitOrbit` / 双击复位） | — |

### 10.4 布局旋钮（→ VP 备选，均已有默认值）

| 参考常量 | 含义 | 是否值得暴露 |
|----------|------|--------------|
| `RELAX_ITERS = 320` | 边距松弛轮数 | 低（与 10.3 的「重新优化」合并） |
| `BAND_RATIO = 0.32` | 纬度带厚度（层松紧） | **中**：直接影响"看起来像不像球"，教学插图常要微调 |
| `SNAP_RATIO = 0.9` | 外圈吸附球面阈值 | 中：控制"球壳感"强弱，与 `shell` 开关配套 |
| `EDGE_CLEARANCE = 1.05` | 边距目标（×节点半径） | 低（诊断读数用，不必暴露） |
| 边-边斥力实现（AABB 预筛 + 3 采样点线段距离） | 实时重排的性能关键 | 不暴露；若做实时 3D 重排需沿用 |

### 10.5 形态层（→ NEW，强化 §3.4）

- 参考实现是**单文件即插即用**（自带面板、无框架依赖）——这正是教学场景交付一张插图的自然形态。它支持 §3.4 `FigurePreset` 的目标："可分享、可嵌入"；建议 VCL 的导出能力最终能产出这种**自包含片段**（HTML/JS 片段而不只是 SVG/PNG），与 TikZ 导出（§8.6）并列。

### 10.6 一句话小结

参考实现的价值不止布局算法：它把**「图 + 读数 + 图例 + 开关 + 重排」**当成一个整体交付——这正是 VCL 要长成的样子。上表按「已入 core / 待入 VCL」两分，前者不动，后者登记为 §4/§8 的补充条目。


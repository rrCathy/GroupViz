# 引擎 API 参考（@groupviz/core · @groupviz/react）

> 本文件随 npm 包发布（`node_modules/@groupviz/{core,react}/API.md`），是**包消费端**的权威 props 表。
> 面向主应用开发者 / 内嵌者；仓库内部实现细节见 [docs/VIEWS.md](VIEWS.md) · [docs/GROUPS.md](GROUPS.md) · [docs/CAYLEY.md](CAYLEY.md)。
>
> 口径：**Scene 是纯受控渲染内核**（不读应用级 context）；状态、hover 气泡、主题开关全部由宿主经 props 注入。
> `@groupviz/react` 收录 **12 个 Scene**：11 个视图 Scene + 附属窗口功能 `AutomorphismScene`（tree / prestable 未 props 化，不入包 —— 二者与无限群方向相关，改由拓展包轨道承接）。

---

## 0. 最小可用示例（推荐写法）

```tsx
import { createGroupFromSymbol } from '@groupviz/core'
import { useSceneState, SetView } from '@groupviz/react'
import '@groupviz/react/theme.css'

const group = createGroupFromSymbol('S_{4}')

export function Figure() {
  const s = useSceneState(group, { theme: 'light' })   // ← 四件套 + 交互 + 气泡全包
  return (
    <div {...s.hostProps} style={{ width: 480, height: 360 }}>
      <SetView group={group} {...s.sceneProps} theme="light" />
      {s.hoverBubble}
    </div>
  )
}
```

`useSceneState` 之前，同一张图需要宿主自备：`selectedElements` / `canvasTransform` / `viewBoxSize`
（ResizeObserver 量尺寸）+ `onSelect` / `onHover` + 滚轮缩放贴光标 + 拖拽平移 + hover 气泡 ≈ 80 行胶水。

---

## 1. 元素引用（element reference）—— 所有元素类 props 的通用约定

群元素同时有多种记号：

| 记号 | 来源 | 例子（S₄） |
|---|---|---|
| `id` | 机器键，`GroupElement.id` | `"1,3,4,2"` |
| `label` | 人类记号，`GroupElement.label` | `"34"` / `"234"` / `"(12)(34)"` / `"e"` |
| `value` | 数组，`GroupElement.value` | `[1,3,4,2]` |
| 循环记号 | 手写置换 | `"(234)"` / `"(12)(34)"` / `"(1 2 3)"` |

> `label` 约定**因群而异**：Aₙ 带括号（`(234)`），Sₙ 单环不带括号（`234`）、多环带括号（`(12)(34)`），循环群为指数（`3`），同构群为 `\alpha_3`。
> **不必记住用哪套**——手写标准循环记号即可，`resolveElement` 会按语义解析成同一个置换。

**下列 props 接受任一记号**，内部统一经 `core.resolveElement` 解析（匹配序 `id` → `label` → `value` → **循环记号语义档**，忽略空白）：

| 归属 | prop |
|---|---|
| `SymmetryViewScene` | `actionElementId` |
| `CayleyView` / `Cayley3DScene` | `actions[].elementId` |
| `CosetStripScene` | `subgroup[]` |
| `@groupviz/core` | `resolveElement` / `findElement` / `resolveElementRefs` / `resolveElementIds` / `buildCosetViewData` / `subgroupFromElementIds` 的入参 |

**未命中不再静默**：解析失败会 `console.warn` 一次（按「上下文 + 群 + 引用」去重），该项被忽略、渲染不炸。
需要自行诊断时用 core 的纯函数 `resolveElement(group, ref)`（返回 `null`，不告警）。

> 其余以元素 id 为语义的 props（`selectedElements` / `subsets[].elementIds` / `Cayley3DScene.faceFill.subgroup` /
> `CycleView.getNodePosition(elId)`）仍按 **id** 消费；需要 label 输入时先自行 `resolveElement`。

---

## 2. `useSceneState`（`@groupviz/react`）

```ts
const s = useSceneState(group?, options?)
```

| option | 缺省 | 说明 |
|---|---|---|
| `initialTransform` | `{x:0,y:0,scale:1}` | 初始平移 / 缩放 |
| `locked` | `false` | 锁交互（同时透传给 Scene 的 `locked`） |
| `enableZoom` / `enablePan` | `true` | 滚轮缩放 / 拖拽平移开关 |
| `minScale` / `maxScale` | `0.25` / `8` | 缩放区间（与主画布一致） |
| `selectedElements` | — | **传入即受控**，配合 `onSelectionChange` |
| `onSelectionChange` | — | 选中集合变更回调（受控 / 非受控都会触发） |
| `fallbackViewBoxSize` | `{800,600}` | ResizeObserver 首帧前的兜底尺寸 |
| `hostStyle` | — | 宿主容器附加样式（与内建样式合并） |
| `theme` | `'dark'` | 内建 hover 气泡主题 |
| `renderHoverBubble` | — | 自绘气泡；返回 `null` 表示不要内建气泡 |

返回值：

| 字段 | 用途 |
|---|---|
| `hostProps` | **一次 spread 即挂好宿主容器**：内含 `ref`（回调 ref）、事件（拖拽平移）与内建样式（`position:relative`、`100%`、`touchAction:none`、光标）|
| `sceneProps` | **可直接 spread 到 SetView / CycleView / CayleyView / CosetStripScene**：`selectedElements` `canvasTransform` `viewBoxSize` `onSelect` `onHover` |
| `viewBoxSize` | 容器实测尺寸 |
| `getHostElement()` | 需要 DOM 节点时用（如导出 SVG）|
| `canvasTransform` / `setCanvasTransform` / `resetTransform` / `zoomBy(factor)` | 视图变换 |
| `selectedElements` / `setSelectedElements` / `select(elId, additive?)` / `clearSelection()` | 选中态（`additive` = ⊕/Ctrl/⌘ 语义：切换成员；否则单选替换） |
| `hovered` / `hoverAnchor` / `hoverBubble` | 悬停元素、锚点、现成气泡节点 |
| `locked` | 透传给 Scene |
| `getNodePosition` / `onNodePositionChange` / `resetNodePositions` | 共享节点位置：把前两者传给 `CycleView` 即可多视图共用一套坐标 |

**行为要点**

- ⚠️ **不要在 spread 之后自己再写 `ref`** —— 会顶掉 `hostProps.ref`，尺寸测量与气泡换算会静默失效。需要节点用 `getHostElement()`。
- `hostProps` 里的 `ref` 之所以是回调 ref 且**只嵌套在 `hostProps` 内**：React Compiler 的 `react-hooks/refs` 规则会把「顶层返回 ref 写入函数 / 含 `RefObject`」的 hook 整体判为 ref 载体，此后宿主每次 `s.xxx` 读取都会报 *Cannot access refs during render*。保持嵌套即无此副作用（`SceneState` 顶层字段已做运行时断言守卫）。
- 拖拽平移用 **React 合成事件**，与 Scene 内节点自身的 `stopPropagation()` 同处一套冒泡序 → **拖节点不会连带拖动画布**；只有左键生效。
- 滚轮缩放走 **原生 non-passive 监听**（React root 级 `wheel` 是 passive，`preventDefault` 无效），锚定光标下的 viewBox 坐标；指针坐标缺失 / 非有限时退回容器中心，**不会把变换写成 NaN**。
- 换群（`group` 引用变化）会清空悬停 / 非受控选中 / 节点位置，避免旧 id 命中新群（渲染期校正，不额外多一帧残留）。

---

## 3. 主题（`theme`）

| 组件 | 主题 prop |
|---|---|
| 8 个 2D Scene：`SetView` `CycleView` `CayleyView` `TableView` `CosetStripScene` `ActionScene` `HomomorphismScene` `AutomorphismScene` | `theme?: 'dark' \| 'light'` |
| `SymmetryViewScene` | `theme?: 'dark' \| 'light'`（`dark?: boolean` 为兼容别名，`theme` 优先） |
| `Cayley3DScene` `SublatticeScene` | `theme?: 'dark' \| 'light'` |

- **缺省不传 → 不注入任何主题作用域**，Scene 沿用外层主题（`theme.css` 的 `:root` 变量 / ThemeContext），
  与既有行为逐位一致（无额外 DOM）。
- **显式传值 → 在该 Scene 子树内注入 `data-theme` 作用域**（`SceneThemeRoot`），命中 `theme.css`
  里对应的变量块。宿主须 `import '@groupviz/react/theme.css'`，否则变量缺失（此时仅剩内联兜底色）。
- `SublatticeScene` 例外：不做外层包装（其 `<svg>` 必须是宿主 flex 的直接子元素才能正确测量），
  主题经 palette 计算而非 CSS 作用域。

`SceneThemeRoot` 也可独立使用，把多张图一起罩进同一主题作用域。

---

## 4. Scene props 全表

> 四件套 `group` / `selectedElements` / `canvasTransform` / `viewBoxSize` 除表格内单独说明外均为**必填**受控项。

### 4.1 `SetView`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `group` | `Group \| null` | — | `null` 渲染空态 |
| `selectedElements` | `Set<string>` | — | 选中元素 id |
| `canvasTransform` | `{x,y,scale}` | — | |
| `viewBoxSize` | `{width,height}` | — | |
| `subsets` | `{elementIds,color}[]` | — | 子集着色（id） |
| `selfInverseElementId` | `string \| null` | — | 自逆元素标记（id） |
| `cosetElementMap` / `cosetHighlightSet` / `cosetColors` | `Map<id,number>` / `Set<number>` / `string[]` | — | 陪集着色三件套 |
| `onSelect` | `(elId, additive) => void` | — | |
| `onHover` | `(el \| null, anchor?) => void` | — | `anchor` = 视口内屏幕坐标 |
| `noGroupText` | `string` | `''` | |
| `nodeRadius` / `gap` / `columns` | `number` | 自动 | 布局微调 |
| `showLabels` | `boolean` | `true` | 常驻标签总开关 |
| `largeGroupThreshold` | `number` | `60` | 群阶 > 该值时「仅选中节点显示常驻标签」 |
| `quotientInsetTitle` | `string` | — | 商群视图右侧「正规子群 N 的凯莱图」面板标题（宿主本地化文案；缺省只画数学记号 `N` 与 `|N| = n`） |
| `theme` | `'dark' \| 'light'` | — | 不传 = 跟随外层 |

### 4.2 `CycleView`

在 `SetView` 四件套 + `subsets` / `selfInverseElementId` / 陪集三件套 / `onSelect` / `onHover` / `noGroupText` 之外：

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `showMaximalCycles` | `boolean` | `true` | 仅显示极大循环并启用 planar 布局 |
| `nodeRadius` | `number` | `24` | |
| `showLabels` | `boolean` | `true` | |
| `showCycleLabels` | `boolean` | `true` | 显示 `⟨g⟩ ≅ Z_n` 标注 |
| `locked` | `boolean` | `false` | 禁用节点拖拽（点击选中保留） |
| `getNodePosition` / `onNodePositionChange` | 函数 | — | 外部持久化节点位置（不传用局部态） |
| `largeGroupThreshold` | `number` | `60` | |
| `theme` | `'dark' \| 'light'` | — | |

### 4.3 `CayleyView`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `shape2D` | `CayleyShape2D` | 按群自动 | 不支持的形状自动回退 `circular` |
| `multiplyType` | `'right' \| 'left'` | `'right'` | |
| `actions` | `{elementId, enabled?, color?, lengthScale?}[]` | 群生成元 | **`elementId` 接受元素引用**；`lengthScale` = 该生成元边长倍率（缺省 1） |
| `nodeRadius` | `number` | `28` | |
| `showLabels` | `boolean` | `true` | 嵌入小窗常传 `false`（读元素靠 hover 气泡） |
| `locked` | `boolean` | `false` | |
| `hoveredElementId` | `string \| null` | — | 悬停高亮环（id） |
| `largeGroupThreshold` | `number` | `60` | |
| `edgeCurvature` | `number` | `1` | 边弯曲倍率（0–3）。**0 = 笔直**；2 = 更弯。同一对节点间的平行边按作用序号自动左右分开（笔直模式下也不重叠） |
| `pathHighlight` | `CayleyPathHighlight \| null` | `null` | 路径高亮（VCL）：**缺省淡化其余边**（`dimOthers`，只留路径醒目）；`showOrder` 序号**悬停该节点时显示** |
| `forceDirected` | `boolean` | `false` | 动态力导向**开关**（在**当前选定形状**之上把静图"激活"；**拖动一个节点只影响近旁**——1 跳邻居粘性跟随约 20–30%、其余 2–7%，松手轻微回稳；整体重排用 `force.settleSignal`） |
| `force` | `CayleyForceParams` | — | 力导向微调：`repulsion` / `linkScale` / `gravity` / `damping` / **`stiffness`（刚度 0.4–3）** / `settleSignal`。**参数变化就地生效**（平滑过渡，不重建模拟器） |
| `quotientInsetTitle` | `string` | — | 同 `SetView`：商群视图右侧「正规子群 N 的凯莱图」面板标题 |
| `theme` | `'dark' \| 'light'` | — | |

#### `CayleyPathHighlight`（路径高亮）

```ts
{
  elements?: string[]   // 元素引用序列（id/label/value/循环记号）；相邻须由某条已启用作用边相连
  word?: string[]       // 生成元单词，从 start（缺省单位元）连续作用 → 自动算 walk
  start?: string        // word 模式起点
  color?: string        // 缺省 #ffd93d（球面布局建议换白色等高对比色，避免与生成元配色撞色）
  width?: number        // 缺省 5
  animate?: boolean     // 沿路径逐步点亮
  showOrder?: boolean   // 次序徽标 ① ② ③ …：**悬停该节点时显示**（不常显，避免长路径互相遮挡）
  closed?: boolean      // word 模式：末元素回起点（展示闭环关系式）
  dimOthers?: boolean   // 缺省 true：淡化其余边，只留路径上的边醒目（"只显示路径"）
}
```

- 方向敏感：非自逆生成元只在其真实方向连通（`e0→e3` 若无该方向的边，只高亮两端节点、不画连段）。
- 未解析到的引用被忽略（不抛错），行为与 `resolveElement` 一致。
- **`word` 项建议用生成元 label 而不是元素 id**：Sₙ 的元素 id 形如 `2,1,3,4`（含逗号），会被按 `/[\s,]+/` 分词的输入框拆碎。

#### 动态力导向（`forceDirected`）

不是一种新形状，而是**在任意已选形状之上叠加**的力模拟：初始位置取所选形状的静态布局，随后持续求力平衡（FR 风格：位移按热度 `alpha` 缩放）。
交互模型（Obsidian 图谱式**局部性**）：**拖动一个节点只影响近旁**——1 跳邻居粘性跟随（约 20–30%），其余节点 2–7%；路径上撞到的节点由最小间距约束推开；**松手只有轻微弹性收尾**（拖到哪基本停哪）。
`force.*` 参数变化**就地生效**（`sim.setOptions`：保留位置与速度 + 温和升温），是平滑可感的调整而非整图重排；想重新求解整体布局用 `force.settleSignal` 自增（面板「⟳ Re-settle」）。

### 4.4 `TableView`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `subsets` / `cosetElementMap` / `cosetColors` / `cosetData` / `cosetType` / `showAllCosets` | — | — | 子群 / 陪集着色 |
| `forceShowLargeGroup` / `onForceShowLargeGroup` | `boolean` / `fn` | `false` / — | 解除大群告警 |
| `strategy` | `'subgroup' \| 'random' \| 'full'` | `'subgroup'` | 大群（>16 阶）策略 |
| `cellSize` | `number` | `50` | |
| `showHeatmap` | `boolean` | `false` | 热力图模式（不显示元素与表头） |
| `onStrategyChange` | `fn` | — | |
| `onLayoutSize` | `(size \| null) => void` | — | 实际表格尺寸回传（供窗口定最小尺寸） |
| `maxTableOrder` | `number` | `100` | 文字表过大阈值 |
| `maxHeatmapOrder` | `number` | `240` | 热力图过大阈值 |
| `theme` | `'dark' \| 'light'` | — | |
| `onHover` | `(el \| null) => void` | — | **不提供 anchor**（无就地气泡） |

### 4.5 `CosetStripScene`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `cosetElementMap` / `cosetColors` / `cosetHighlightSet` | — | — | 陪集三件套（显式传入优先） |
| `subgroup` | `string[] \| null` | — | **便捷入口**：只给 H（id/label 皆可），内部经 `core.buildCosetViewData` 一键派生三件套 |
| `cosetType` | `'left' \| 'right'` | `'left'` | 便捷入口配套 |
| `highlightAllCosets` | `boolean` | `false` | 便捷入口配套 |
| `showLabels` | `boolean` | `true` | |
| `showSubgroupCayley` | `boolean` | `true` | H 条带上方画 H 自身 Cayley 小圈 |
| `subsets` / `onSelect` / `onHover` / `noGroupText` / `noCosetsText` | — | — | |
| `theme` | `'dark' \| 'light'` | — | |

### 4.6 `ActionScene`

| prop | 类型 | 说明 |
|---|---|---|
| `group` | `Group`（必填，非 null） | |
| `kind` | `GroupActionKind` | 窗口范围：`conjugation` / `regular` / `custom` |
| `computation` | `GroupActionComputation \| null` | |
| `editing` / `setSize` / `arrows` / `error` | — | custom 编辑模式 |
| `onAddArrow` / `onBindArrow` / `onRemoveArrow` / `onReplaceGenArrows` | 函数 | 编辑回调 |
| `selectedElement` / `onSelectedElementChange` | `number \| null` / `fn` | 集合元素索引（OST 交互） |
| `hoveredElement` / `onHoverElementChange` | `string \| null` / `fn` | |
| `onSetElementSelect` | `fn` | chips 点击 → 主画布全局选中 |
| `showLabels` | `boolean`（缺省 `true`） | 关掉 = 空圈节点 + hover 气泡 |
| `onHover` | `(el \| null, anchor?) => void` | |
| `canvasTransform` / `viewBoxSize` | 可选（有内建缺省） | |
| `prime` | `number \| null` | sylow banner 标题 |
| `theme` | `'dark' \| 'light'` | |

### 4.7 `HomomorphismScene`

| prop | 类型 | 说明 |
|---|---|---|
| `source` / `target` | `Group \| null` | |
| `mapping` | `Map<srcId, tgtId>` | |
| `result` | `HomomorphismResult \| null` | 不传则内部 `verifyHomomorphism` 推导 |
| `name` | `string` | 显示名（TeX 或纯文本） |
| `theoremMode` / `onTheoremModeChange` | `boolean` / `fn` | 第一同构定理动画开关 |
| `theoremAnimation` | `ReactNode` | 动画内容（主应用注入） |
| `showLabels` | `boolean`（缺省 `true`） | |
| `onHover` | `(el \| null, anchor?) => void` | |
| `theme` | `'dark' \| 'light'` | |

### 4.8 `SymmetryViewScene`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `group` | `Group`（非 null） | — | |
| `symmetryType` | `SymmetryType` | 按群推导 | `unsupported` 群渲染提示层 |
| `theme` | `'dark' \| 'light'` | — | 优先 |
| `dark` | `boolean` | `false` | 兼容别名 |
| `variant` | `boolean` | `false` | 对偶多面体（cube↔octahedron / icosahedron↔dodecahedron） |
| `showAction` | `boolean` | `false` | 元素作用演示 |
| `actionElementId` | `string \| null` | `null` | **接受元素引用**（id/label） |
| `rotateSpeed` | `number` | `1` | 0.2–5 |
| `showFigureTitle` | `boolean` | `true` | 顶部群名 + 几何描述 |
| `locked` | `boolean` | `false` | 锁相机交互 |
| `onHint` | `(msg: string) => void` | — | 演示状态提示 |
| `hintOnIdle` | `boolean` | `true` | 无演示目标时是否上抛引导文案 |
| `replaySignal` | `number` | `0` | 自增即重播一次动画 |
| `lockCameraOnAction` | `boolean` | `false` | 演示期间是否禁用相机旋转/平移 |
| `onAnimationEnd` | `() => void` | — | 姿态落定（动画播完）回调 |

> **行为变更提示**：`lockCameraOnAction` 缺省 `false`。旧实现等价于恒 `true`
> （`enableRotate = !showAction && !locked`），会出现「演示元素未命中 → 动画没跑，视角却被锁死」。
> 需要旧行为请显式传 `true`。

### 4.9 `Cayley3DScene`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `actions` / `multiplyType` | — | 群生成元 / `'right'` | `actions[].elementId` 接受元素引用；**`lengthScale` = 该生成元边长倍率**（缺省 1，经 core `relaxEdgeLengths3D` 三维松弛后处理；全 1 时逐位不变） |
| `layout3D` | `Layout3D` | 按群自动 | |
| `nodeScale` | `number` | `1` | 0.5–2.0 |
| `autoRotate` | `boolean` | `false` | |
| `showLabels` | `boolean` | `true` | |
| `locked` | `boolean` | `false` | |
| `subsetHighlights` | `{elementIds,color}[]` | — | |
| `faceFill` | `Cayley3DFaceFillParams` | — | 子群陪集面填充 |
| `pathHighlight` | `CayleyPathHighlight \| null` | `null` | **路径高亮（VCL）**：元素序列 / 生成元单词（core `resolveCayleyPath` 解析，与 2D 同语义）；drei `Line` 线段 + 节点环 + 逐步点亮；**缺省淡化其余边**（`dimOthers`）、`showOrder` 序号**悬停该节点时显示** |
| `hoveredElementId` | `string \| null` | `null` | 受控悬停（与 2D 对称）：命中元素按悬停态渲染（放大 + 标签 + 路径序号），供图例/侧栏联动 |
| `theme` | `'dark' \| 'light'` | `'dark'` | |
| `onSelectElement` | `fn` | — | |

**字长球（`layout3D: 'wordLengthSphere'`，S₄/S₅）**：必须把 `actions` 传成**相邻对换生成集**（core 的 `wordLengthSphereActions(group)`），否则缺省生成元不是相邻对换、字长分层不成立。用法与导出一览见 §7 末「字长球形状」。

### 4.10 `SublatticeScene`

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `group` | `Group \| null` | — | |
| `lattice` | `LatticeData \| null` | — | 外部提供（大群后端通路）优先 |
| `canvasTransform` / `availableSize` | 可选 | — | 不传则自测容器 |
| `labelDetail` | `LatticeLabelDetail` | `'auto'` | 名片细节档 |
| `mergeConjugates` | `boolean` | `false` | 共轭子群合并为轨道节点 |
| `nodeScale` | `number` | `1` | |
| `showSeriesPanel` | `boolean` | `true` | |
| `series` / `centerIds` / `subsets` / `activeNodeIdx` / `onActivateNode` / `noGroupText` | — | — | |
| `theme` | `'dark' \| 'light'` | ThemeContext | |
| `maxEnumerateOrder` | `number` | `60` | 本地枚举子群格的群阶上限 |

### 4.11 `SylowScene`

p-子群 / Sylow 子群的探索视图。三种布局模式由右侧 chip 的选择驱动，选中态是**视图内部状态**，宿主无需接管。

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `group` | `Group \| null` | — | `null` 渲染空态 |
| `selectedElements` | `Set<string>` | 空集 | 选中元素 id（影响节点描边与边高亮） |
| `onSelect` | `(elId, multi) => void` | — | `multi` = ctrl/⌘ |
| `onHover` | `(el \| null) => void` | — | 不传 = 不挂 hover |
| `canvasTransform` | `{x,y,scale}` | 恒等 | 大群分支的屏内裁剪用 |
| `viewBoxSize` | `{width,height}` | `800×600` | |
| `theme` | `'dark' \| 'light'` | — | 不传 = 跟随外层 |

**三种模式**（视图内切换，不需要 props）：`circle`（全体元素环，缺省）→ 点一个 Sylow chip 进 `coset`（陪集条带 + `|G| = |H|·[G:H]` 数值行）→ ctrl/⌘ 点第二个 chip 进 `two`（P/Q 上下两行 + Sylow II 共轭箭头与共轭元 g 标注）。群阶 > `ENUMERATION_LIMIT`（144）时走大群分支：不画节点阴影、标签缩到 10px、按 `canvasTransform` 做屏内裁剪。

**配色**：三套语义色（P 子群 teal / Q 子群 purple / 交集 gold）走 `theme.css` 的 `--sylow-p-stroke`、`--sylow-sel-fill`、`--sylow-sel-stroke`、`--sylow-chip-active`、`--sylow-q-fill`、`--sylow-q-stroke`、`--sylow-i-fill`、`--sylow-i-stroke`，因此 `theme` prop 或外层 `data-theme` 都能整体换色（主画布不传 `theme`，跟随应用全局主题）。

---

### 4.12 `AutomorphismScene`

自同构作用预览：把 Aut(G) 里的一个自同构 α 作用在**父群 G** 上的效果画出来 —— 父群 G 的圆环 Cayley 图，边按 α 改接到生成元的像 α(g)（「自同构如何扭转乘法结构」的可视化）、α 的不动点高亮，下方附元素映射表与不动 / 移动计数。

**不含窗口 chrome**：它是内容内核，宿主用 `SceneWindow` 在自己的视图窗口里**嵌套一层预览窗**（主应用即如此，见下方示例）。

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `group` | `Group \| null` | — | 自同构群 Aut(G)；`null` / 非自同构群 → 空态 |
| `selectedElements` | `Set<string>` | 空集 | 受控选中；**恰一个且命中自同构**时渲染该 α 的作用 |
| `viewBoxSize` | `{ width, height }` | 自测容器 | 绘图区像素（不含头部 / 映射表）；不传则 ResizeObserver 实测 |
| `showMapping` | `boolean` | `true` | 元素映射表开关（小窗 / 大群时本来就自动隐藏） |
| `onHover` | `(el \| null) => void` | — | 节点是**父群元素**；不传 = 不挂 hover |
| `theme` | `'dark' \| 'light'` | — | 不传 = 跟随外层 |

**空态**：`group` 为 null / 非自同构群 / 未选中 / 选中多个 / 选中 id 不在自同构表里 —— 都在 `[data-testid="automorphism-scene"]` 容器内给提示文案，不抛错、不留白屏。

**在 ViewWindow 里嵌套一个预览窗**（宿主想把它当「窗中窗」用时的标准写法）：

```tsx
import { createGroupFromSymbol, createAutomorphismGroup, getAutomorphismMap } from '@groupviz/core'
import { AutomorphismScene, SceneWindow } from '@groupviz/react'

const G = createGroupFromSymbol('S_{3}')
const autG = createAutomorphismGroup(G)!        // Aut(S₃) ≅ S₃

export function Preview({ selected }: { selected: Set<string> }) {
  return (
    <SceneWindow
      title="Aut(G)"
      theme="dark"
      config={{ viewportFixed: true }}                        // 视口固定，可拖可缩
      capabilities={{ toggleInfo: false, params: false }}     // 本 Scene 无窗口级参数
      storageKey="automorphism-preview"                        // 位置/尺寸持久化（可省）
      defaultPosition={{ x: 24, y: 24 }}
      defaultSize={{ width: 380, height: 440 }}
      onClose={() => clearSelection()}
    >
      <AutomorphismScene group={autG} selectedElements={selected} theme="dark" />
    </SceneWindow>
  )
}
```

要点：

- 「选中哪个自同构」就是 Aut(G) 的**元素 id** —— 与其它视图共用同一套受控选中即可（`useSceneState().selectedElements`）。
- ⚠️ **换父群时要让旧 α 失效**：不同 Aut(G) 的元素 id 命名相同（`auto-0…auto-N`），宿主只比 id 会让旧选中被同名继承（不报错、但展示的是新群里同号的 α）。主应用靠换群清空选中规避（`setCurrentGroup` 内 `setSelectedElements(new Set())`）；`/?test=1` 的消费卡片则把选中记成 `{ 父群符号, id }` 再校验。
- 想看 α 把每个元素送到哪：`getAutomorphismMap(autG)!.get(elId)!.map`（`Map<父群元素 id, 父群元素 id>`）；`label` 是 α 的 TeX 记号。
- 父群 G 由 Aut(G) 自带的 `automorphismParentSymbol` 反查重建，宿主不必再传一次。



窗口 chrome 壳（标题栏 / 拖拽 / resize / ⚙ View Config / localStorage 持久化），**不接管 Scene 状态**。

| prop | 类型 | 缺省 | 说明 |
|---|---|---|---|
| `title` / `group` | `string` / `Group \| null` | `group.symbol` | 标题与 info 区 |
| `theme` | `'dark' \| 'light'` | `'dark'` | 窗口配色 |
| `shell` | `'none' \| 'chrome'` | `'chrome'` | `'none'` = 裸内容容器 |
| `capabilities` | `SceneWindowCaps` | 全开 | 逐项裁剪：`titlebar` `drag` `resize` `lockMove` `toggleInfo` `params` `close` `persist` |
| `config` / `onConfigChange` | `SceneWindowConfig` | — | `locked` `showInfo` `resizable` `viewportFixed` `showControls` |
| `storageKey` / `defaultPosition` / `defaultSize` / `onClose` / `children` | — | — | `storageKey` 给键才持久化（键空间 `gv-sw-*`） |

---

## 6. i18n

```tsx
import { I18nProvider, useTranslation } from '@groupviz/react'
```

| API | 说明 |
|---|---|
| `<I18nProvider lang? persist?>` | `lang` = 初始语言（缺省读 localStorage / 浏览器）；`persist` 缺省 `true`，嵌入宿主不想共用 `groupviz-lang` key 时传 `false` |
| `useTranslation()` | `{ lang, setLang, t }` |

**无 Provider 也可用**：缺省 `t` 直接查真实词典（中文优先、英文兜底），不再回落成 key。
只有真正缺失的 key 才返回 key 本身，并 `console.warn`。

---

## 7. `@groupviz/core` 本批次新增

| 导出 | 签名 | 说明 |
|---|---|---|
| `resolveElement` | `(group, ref) => GroupElement \| null` | 元素引用解析（`id` → `label` → `value` → **循环记号**，忽略空白） |
| `findElement` | 同上 | `resolveElement` 的别名 |
| `resolveElementRefs` | `(group, refs) => { elements, ids, unresolved }` | 批量解析 + 未命中回收 |
| `resolveElementIds` | `(group, refs) => string[]` | 批量解析为规范 id（去重、丢未命中） |
| `normalizeElementRef` | `(ref) => string` | 去空白归一化 |
| `parseCycleNotation` | `(ref, degree) => number[] \| null` | 循环记号 → 置换数组；`(234)`/`234`/`(12)(34)`/`(1 2 3)` 均可，非循环记号返回 `null` |
| `elementOrder` | `(group, el) => number` | 元素阶（group-first 公共入口） |
| `elementOrderDistribution` | `(group) => Map<number, number>` | 阶分布 |
| `elementOrderDistributionOf` | `(elements, group) => Map<number, number>` | 子集阶分布 |
| `subgroupFromElementIds` | `(group, refs, opts?) => Subgroup \| null` | 由元素引用装配 Subgroup（默认含封闭校验 + 极小生成集；`validate:false` / `computeGenerators:false` 可省开销） |
| `isSubgroupElementSet` | `(group, refs) => boolean` | 是否构成子群（含单位元 + 乘法封闭） |
| `buildCosetViewData` | `(group, subgroupRefs, opts?) => CosetViewData \| null` | **陪集视图一键装配**：`cosetElementMap` / `cosetColors` / `cosetHighlightSet` |
| `computeCosetElementMap` / `computeCosetColors` / `computeCosetHighlightSet` | 见源码 | 三件套单独入口 |
| `sizeLimitFor` | `(view) => number` | 各视图默认「过大」阈值（可读） |
| `isTooLarge` | `(order, view, limitOverride?) => boolean` | 第三参可覆盖阈值 |
| `listCosetStripSubgroups` / `findCosetStripSubgroup` / `cosetDataForSubgroup` | 见源码 | 陪集条带候选子群（此前未出门面，现已公开） |
| `relaxEdgeLengths` | `(base, edges, {lengthScales, ...}) => Map<id,NodePosition>` | **逐生成元边长（2D 通用后处理）**：在任意基础布局之上做长度约束松弛（弱锚定防散架）；所有倍率为 1 时原样返回基础布局（零配置安全） |
| `relaxEdgeLengths3D` | `(base, edges, {lengthScales, ...}) => Map<id,Vec3>` | **逐生成元边长（3D 后处理）**：与 2D 同一套力模型，距离为三维欧氏距离；斥力按基础布局平均边长 `ref` 自适应（作用半径 0.25·ref），无边界钳制；全 1 时原样返回基础布局 |
| `isIdentityScale` | `(scales: Map<string,number>) => boolean` | 倍率是否全为 1（渲染层判断是否需要跑松弛） |
| `resolveCayleyPath` | `(group, actions, multiplyType, {elements?, word?, start?, closed?}) => ResolvedCayleyPath \| null` | **路径高亮解析**：元素序列 / 生成元单词 → 顶点序列 + 逐步连边（方向敏感） |
| `getAutomorphismMap` | `(group) => Map<string, Automorphism> \| null` | Aut(G) 的「元素 id → 自同构」表（非自同构群 / 空输入 → `null`）；`AutomorphismScene` 与外部宿主共用，替代裸读 `_automorphismById` |
| `createCayleyForceSim` | `(group, actions, multiplyType, opts) => CayleyForceSim` | **动态力导向增量模拟器**：`step()` 逐帧推进、`pin/unpin` 拖拽钉住（低热度：拖拽只影响近旁）、`reheat()` 升温、**`setOptions(opts)` 就地更新力参数**（保留位置速度 + 温和升温 → 滑杆调节平滑过渡而非重建重排）；逐生成元弹簧静止长度 + `stiffness` 刚度 + `minSeparation` 最小间距硬约束（防纠缠）。⚠️ `pin()` **原地改写** `sim.positions` 里的对象——拖拽起点须自行快照 `{x,y}` |

**字长球形状（S₄ / S₅，随包分发）** —— 相邻对换生成集按字长分层摆成**实心球**（S₄ 7 层 / S₅ 11 层；S₅ 为纬度分层 + 正根胞格向量初值 + 边距松弛，视图侧自动套一层半透明球壳）：

| 导出 | 签名 | 说明 |
|---|---|---|
| `wordLengthSphereActions` | `(group) => CayleyAction[] \| null` | **该形状的标准作用边** = 相邻对换生成集（S₄ 3 条 / S₅ 4 条，按 `COLOR_PALETTE` 配色）。结构不符或 n ∉ {4,5} 返回 `null` |
| `wordLengthSphereLayout3D` | `(group, radius) => Vec3[] \| null` | 布局本体（`compute3DPositions(group,'wordLengthSphere')` 内部调用） |
| `wordLengthOf` | `(el) => number \| null` | 元素字长（相邻对换集下 = one-line 置换的**逆序数**） |
| `wordLengthColor` | `(group, el) => string \| null` | 字长色阶（205° 青蓝 → 330° 品红），同层同色 |
| `findAdjacentTranspositionGenerators` | `(group) => GroupElement[] \| null` | one-line 置换群的 n−1 个相邻对换（纯结构检测，Sₙ 结构不符返回 `null`） |

```tsx
import { createGroupFromSymbol, getAvailableShapes3D, wordLengthSphereActions } from '@groupviz/core'
import { Cayley3DScene, I18nProvider } from '@groupviz/react'

const S5 = createGroupFromSymbol('S_{5}')
// getAvailableShapes3D(S5) 已含 'wordLengthSphere'

<I18nProvider>
  <Cayley3DScene
    group={S5}
    layout3D="wordLengthSphere"
    actions={wordLengthSphereActions(S5) ?? undefined}   // ★ 必须传，否则缺省用群的抽象生成元
  />
</I18nProvider>
```

- **`actions` 必须显式传**：视图缺省用 `group.generators`（Sₙ 自动生成的生成元未必是相邻对换），那样字长分层与「层间才连边」都不成立。
- 节点配色由视图自动套 `wordLengthColor`；球壳是该形状专属渲染（无需 props）。

**陪集视图最省事写法**（宿主不再需要拼三件套）：

```tsx
import { buildCosetViewData } from '@groupviz/core'

const data = buildCosetViewData(group, ['e0', 'e3'], { side: 'left' })  // H 也可用 label
<CosetStripScene group={group} viewBoxSize={vb} {...data} />
// 或者更直接：<CosetStripScene group={group} viewBoxSize={vb} subgroup={['e0','e3']} />
```

## 8. 群记号解析与别名（v2.2.2+）

宿主的 `symbol` 现在可以吃**人类写法**，不再要求写引擎内部的规范 TeX 形态。

### 8.1 统一入口

| 导出 | 签名 | 说明 |
|---|---|---|
| `parseGroupNotation` | `(input) => GroupNotation` | **唯一入口**：规范化 → 专名展开 → 本地建群 → 后端 GAP → 定向报错 |
| `canonicalizeNotation` | `(input) => CanonicalResult` | 只做形态归一（不建群）；失败时给 `issue.kind` + 建议写法 |
| `getGroupAliases` | `(group) => string[]` | 反向：这个群还有哪些叫法（含 Frobenius 专名反查、幂⇄直积等价写法） |
| `parseNotation` | `(input) => NotationParseResult` | 旧门面（保留兼容），字段与 `GroupNotation` 基本一致 |

`GroupNotation` 关键字段：`ok` · `symbol`（引擎规范符号，本地可建时非空）· `order` · `source`（`'local'` / `'named'` / `'backend'`）· `gapExpr`（需后端时）· `canonical` · `applied`（命中的归一规则）· `via`（命中的别名规则，如 `F_{21} → C_{7}:C_{3}`）· `issue` + `hint`（失败时；`issue.kind` 供 UI 走 i18n 模板）。

**本地优先是硬保证**：只要本地工厂能建，`source` 必为 `local`/`named`，`gapExpr` 为 `null` —— 离线环境不会静默退化到后端。

### 8.2 支持的写法（同一群的多种记法都落到同一规范符号）

| 规范符号 | 同时接受 |
|---|---|
| `C_{4}` | `C4` `c4` `C_4` `C{4}` `Z_4` `Z4` `Z/4Z` `ℤ_{4}` |
| `S_{3}` | `S3` `s3` `S_3` `Sym(3)` `Symmetric(3)` |
| `D_{4}` | `D4` `D_4` `Dihedral(4)` |
| `S_{3}^{2}` | `S_3^2` `S_3^{2}` `S3xS3` `S_3×S_3` `S_3\times S_3` |
| `C_{2}\times C_{2}` | `C_2×C_2` `C2xC2` `C_2^2` `(C_2)^2` |
| `C_{7}:C_{3}` | `C7:C3` `C_7:C_3` `C7⋊C3` `C_7\rtimes C_3` **`F21`** `F_{21}` `Frobenius(21)` |
| `QD_{16}` | `QD16` `qd16` |
| `V_{4}` | `V4` `Klein` `K4` `K_4` |
| `C_{3}:C_{4}` | `Dic_3` `Dic3` |
| `Q_{8}` | `Q8` `Quaternion(8)` |
| `A_{5}` | `A5` `Alt(5)` |
| `GL(2,3)` | `gl(2,3)` |

专名规则是**算出来的、不猜**：`F_n` / `Frobenius(n)` → 阶为 n 且唯一的 `C_p:C_q`（F₂₁ / F₂₀ / F₁₂ / F₂₈ 均可）；多义（F₁₆ 有 `C_{4}:C_{4}` 与 `C_{8}:C_{2}`）或超出注册表（F₄₂）一律拒绝，`issue.candidates` 列出候选让你指定。

### 8.3 两条硬规则（有意为之，不是缺陷）

1. **只收 TeX 形态，拒绝 Unicode 上下标**：`C₄` / `S₃` / `C_2²` 返回 `issue.kind = 'unicode'` 并给 `issue.suggestion`（如 `C_{2}^{2}`）。原因是收 Unicode 就得在两套写法间猜，而 `C_2²` 会被猜成 22 阶的 `C_{22}`——静默给出错误的群，比报错危险。（展示方向 `texify` 仍支持 Unicode，那是给人看的。）
2. **`D_n` 约定为 2n 阶**（与注册表一致）：`D_4` = 8 阶、`D_8` = 16 阶。GAP 与部分教材写 `D_8` 指 8 阶群，那在本引擎里是 `D_4` —— 不会为兼容它而让同一符号指向两个群。

```tsx
import { parseGroupNotation, getGroupAliases, createGroupFromSymbol } from '@groupviz/core'

const r = parseGroupNotation('F21')
// { ok: true, symbol: 'C_{7}:C_{3}', order: 21, source: 'named', via: 'F_{21} → C_{7}:C_{3}' }

const bad = parseGroupNotation('C₄')
// { ok: false, issue: { kind: 'unicode', suggestion: 'C_{4}' } }

const aliases = getGroupAliases(createGroupFromSymbol('C_{7}:C_{3}')!)
// ['C_{7}:C_{3}', 'F_{21}', ...]   ← 可用来给读者标注「同一个群的其他记号」
```


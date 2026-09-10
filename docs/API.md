# 引擎 API 参考（@groupviz/core · @groupviz/react）

> 本文件随 npm 包发布（`node_modules/@groupviz/{core,react}/API.md`），是**包消费端**的权威 props 表。
> 面向主应用开发者 / 内嵌者；仓库内部实现细节见 [docs/VIEWS.md](VIEWS.md) · [docs/GROUPS.md](GROUPS.md) · [docs/CAYLEY.md](CAYLEY.md)。
>
> 口径：**Scene 是纯受控渲染内核**（不读应用级 context）；状态、hover 气泡、主题开关全部由宿主经 props 注入。
> `@groupviz/react` 收录 10 个 Scene（sylow / tree / prestable 未 props 化，不入包）。

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

群元素同时有两种记号：

| 记号 | 来源 | 例子（S₄） |
|---|---|---|
| `id` | 机器键，`GroupElement.id` | `"1,3,4,2"` |
| `label` | 人类记号，`GroupElement.label` | `"34"` / `"e"` |
| `value` | 数组，`GroupElement.value` | `[1,3,4,2]` |

**下列 props 接受任一记号**，内部统一经 `core.resolveElement` 解析（匹配序 `id` → `label` → `value`，忽略空白）：

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
| 7 个 2D Scene：`SetView` `CycleView` `CayleyView` `TableView` `CosetStripScene` `ActionScene` `HomomorphismScene` | `theme?: 'dark' \| 'light'` |
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
| `actions` | `{elementId, enabled?, color?}[]` | 群生成元 | **`elementId` 接受元素引用** |
| `nodeRadius` | `number` | `28` | |
| `showLabels` | `boolean` | `true` | 嵌入小窗常传 `false`（读元素靠 hover 气泡） |
| `locked` | `boolean` | `false` | |
| `hoveredElementId` | `string \| null` | — | 悬停高亮环（id） |
| `largeGroupThreshold` | `number` | `60` | |
| `theme` | `'dark' \| 'light'` | — | |

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
| `actions` / `multiplyType` | — | 群生成元 / `'right'` | `actions[].elementId` 接受元素引用 |
| `layout3D` | `Layout3D` | 按群自动 | |
| `nodeScale` | `number` | `1` | 0.5–2.0 |
| `autoRotate` | `boolean` | `false` | |
| `showLabels` | `boolean` | `true` | |
| `locked` | `boolean` | `false` | |
| `subsetHighlights` | `{elementIds,color}[]` | — | |
| `faceFill` | `Cayley3DFaceFillParams` | — | 子群陪集面填充 |
| `theme` | `'dark' \| 'light'` | `'dark'` | |
| `onSelectElement` | `fn` | — | |

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

---

## 5. `SceneWindow`

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
| `resolveElement` | `(group, ref) => GroupElement \| null` | 元素引用解析（`id` → `label` → `value`，忽略空白） |
| `findElement` | 同上 | `resolveElement` 的别名 |
| `resolveElementRefs` | `(group, refs) => { elements, ids, unresolved }` | 批量解析 + 未命中回收 |
| `resolveElementIds` | `(group, refs) => string[]` | 批量解析为规范 id（去重、丢未命中） |
| `normalizeElementRef` | `(ref) => string` | 去空白归一化 |
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

**陪集视图最省事写法**（宿主不再需要拼三件套）：

```tsx
import { buildCosetViewData } from '@groupviz/core'

const data = buildCosetViewData(group, ['e0', 'e3'], { side: 'left' })  // H 也可用 label
<CosetStripScene group={group} viewBoxSize={vb} {...data} />
// 或者更直接：<CosetStripScene group={group} viewBoxSize={vb} subgroup={['e0','e3']} />
```

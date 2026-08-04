# 状态管理与持久化 (State & Persistence)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

## 1. 模块化 Provider 架构

GroupViz 采用 **9 个独立 Provider** 的分层架构（`src/context/`）：

```
GroupContext (核心容器，组合所有子 Provider + 注册导出桥)
  ├── GroupCoreContext        — 基础类型 + useGroupCore hook
  ├── GroupBackendContext     — 后端缓存 + 混合计算层
  ├── GroupCayleyContext      — 凯莱图状态 + Cayley 配置
  ├── GroupSubsetContext      — 子集分析 + 陪集 + 商群 + 自同构
  ├── GroupSymmetryContext    — 对称性视图配置
  ├── GroupDirectProductContext — 直积群构建
  ├── GroupSemidirectProductContext — 半直积构建（N ⋊_φ H）
  ├── GroupMultiViewContext   — 多视图浮动窗口
  └── GroupHomomorphismContext — 同态映射创建与验证
```

- 每个子 Provider 通过 `useGroupCore()` 获取核心状态，实现关注点分离
- `GroupContext.tsx` 作为组合层，嵌套渲染 9 个子 Provider
- `useGroup()`（useGroup.ts）聚合所有子 Provider 的 hook 返回值，对外提供统一接口
- 群切换时通过 `useRef` 追踪变更，子 Provider 用 `queueMicrotask` 在微任务中重置相关状态
- `GroupContext.tsx` ~L223 注册 `window.__groupVizExport__` 导出桥

**Actions 模块**：`cayleyActions.ts`（getCayleyShapeConfig/getSpecialCayleyActions/addAllCayleyActionsHelper）、`cosetActions.ts`、`directProductActions.ts`、`positionUtils.ts`（节点位置初始化）。

## 2. 核心状态字段

```typescript
interface GroupContextState {
  currentGroup: Group | null
  currentView: ViewMode           // 9 种
  selectedElements: Set<string>
  canvasTransform: { x; y; scale }
  operationHistory: string[]
  nodePositions: NodePositionsMap
  viewTabs: { id; view; label }[] / activeTabId
  hoverElement: GroupElement | null
  isSimpleGroup / showMaximalCycles / hintMessage
  forceShowLargeGroupViews: Set<ViewMode>
  viewBoxSize / isPending / backendCache / isLargeGroup
  cayleyMultiplyType: 'right' | 'left'
  cayleyActions: GroupAction[]
  cayleyShape3D: Layout3D / cayleyAvailableShapes3D
  cayleyShape2D: CayleyShape2D / cayleyAvailableShapes2D
  subsets: Subset[]               // 子集分析（含子群/正规子群检测）
  multiViewMode / floatingViews
  symmetryShowAction / symmetryRotateSpeed / symmetryActionElementId
  selfInverseElementId           // 自逆元素高亮（2.5s 自动清除）
  cosetSubsetId / cosetSubgroupElementIds / cosetType / showAllCosets
  cosetData / cosetElementMap / cosetHighlightSet / cosetColors
  isDirectProductMode / directProductSource / directProductTarget
  directProductCreationMode / directProductGroups
  isSemidirectProductMode / sd* 状态（见 GROUPS.md §4）
  homomorphisms / activeHomomorphismId / quotientGroups
  automorphismGroups / theoremPhase
}
```

## 3. 子集保存与分析

- 选中元素集合 → `saveSubset()` 保存，自动检测是否**子群**（乘法封闭性）→ 是否**正规子群**（共轭封闭性）
- 8 色区分多个子集；`removeSubset(id)` / `clearAllSubsets()`
- 自逆元素检测：`computeInverse()` 时若 g⁻¹=g 触发高亮（`useAutoFade`，2.5s 消退）

## 4. 陪集可视化

- `cosetSubsetId` 激活陪集展示；`cosetType` 左/右切换；`showAllCosets` 显示全部陪集（验证 Lagrange）
- `cosetData`（CosetInfo：陪集索引/颜色/计数）+ `cosetElementMap` + `cosetHighlightSet` + 16 色陪集调色盘
- 乘法表矩形条纹高亮同一陪集

## 5. 同态与商群

- `GroupHomomorphismContext`：`createHomomorphism(source, target, name?)`（默认恒等映射）、`verifyCurrentMapping()`、`deleteHomomorphism(id)`、`activateHomomorphism(id)`
- `createQuotientGroupWithHomomorphism(subsetId)`：正规子群子集 → 商群 G/N + 自然同态
- 持久化：`homomorphismStorage.ts`，key `'groupviz-homomorphisms'`

## 6. 自同构群

- `computeAutomorphismGroup()`（GroupSubsetContext）：按 parentSymbol 去重，持久化
- 持久化：`automorphismStorage.ts`，key `'groupviz-automorphisms'`（仅元数据，加载时重建）

## 7. 半直积

- `GroupSemidirectProductContext` + `semidirectProductStorage.ts`，key `'groupviz-sd-groups'`（详见 GROUPS.md §4）

## 8. 直积群

- `GroupDirectProductContext`，key `'groupviz-dp-groups'`，三种构建模式（cayley/table/direct）

## 9. 会话保存与恢复

- key `'groupviz-session'`，App.tsx 自动保存/恢复：当前群符号、视图、节点位置、子集、直积、商群（sym…/N）、自同构（isoSymbol）、半直积（spec 重建）
- 点击左上角标题回欢迎页时清除 `groupviz-session`

## 10. 视图导出

`src/utils/export.ts`：

| 函数 | 按钮 | 适用视图 | 输出格式 |
|------|------|---------|---------|
| `exportView()` | 导出 SVG / PNG | 所有视图 | `.svg` / `.png` |
| `exportSymmetryAsGif()` | 导出 GIF | 对称性视图 | `.gif`（gifenc，20fps 2s 循环） |

- **SVG 导出**：克隆 SVG 元素、内联样式表 CSS、XMLSerializer → Blob → 下载（保留 KaTeX foreignObject）
- **PNG 导出**：`canvas.toDataURL` 同步捕获（依赖 `preserveDrawingBuffer: true`）
- **GIF 导出**：清除选中 → 重设元素 → rAF 逐帧 drawImage → quantize + applyPalette → gifenc 编码

**批量导出**（CLI 取代原 BatchExportPanel）：`scripts/batch-export.mjs`（`npm run export`）经 `window.__groupVizExport__` 桥（`src/utils/exportApi.ts`）渲染 9 预设群 × 7 视图，存 `exports/batch-<timestamp>/`。

## 11. 国际化 / 主题

- `src/i18n/`：`I18nProvider`（默认按浏览器语言）、`useTranslation()`、`translations.ts` 中英字典，偏好存 localStorage
- `src/theme/`：`ThemeContext`（深/浅色，CSS 自定义属性驱动，系统偏好检测 + 记忆）
- ✅ i18n 键已补全：商群/自同构提示（`hint.quotientCreated`、`hint.automorphismComputed` 等）、操作键（`op.createQuotient`、`op.removeAutomorphism` 等）、同态面板（`right.homo.*`）、第一同构定理四阶段（`homo.firstIso.phase0..3` + Desc）、自同构映射/不动点，均已定义，无 t() 回退警告（`panel.batchExport*` 键随 BatchExportPanel 移除）；zh/en 键集合一致性由 `i18n.test.ts` 自动化断言

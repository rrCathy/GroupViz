# Cayley 图系统 (Cayley Graph)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

## 1. 广义 Cayley 图

GroupViz 实现了**广义 Cayley 图**（Generalized Cayley Graph），边可由任意群元素定义，不仅限于生成元。当启用集合恰为生成集时退化为标准 Cayley 图。

```
定义：对于节点 a,b 和群元素 c：
  - 右乘模式：如果 a·c = b，则存在从 a 到 b 的边
  - 左乘模式：如果 c·a = b，则存在从 a 到 b 的边
  - 如果 a·c = b 且 b·c = a（双向），则为无向边（不画箭头）
  - 如果 a·c = b 但 b·c ≠ a，则为有向边（画箭头）
```

## 2. 类型定义

```typescript
type MultiplyType = 'right' | 'left'

interface GroupAction {
  elementId: string   // 作用元素的ID
  enabled: boolean    // 是否显示该作用的边
  color: string       // 该作用对应的边颜色
}

interface CayleyEdgeData {
  fromIdx: number        // 起点元素索引
  toIdx: number          // 终点元素索引
  fromId: string
  toId: string
  actionElementId: string // 作用元素ID
  color: string          // 边颜色
  isBidirectional: boolean // 是否无向边
  isSelfLoop: boolean
}
```

## 3. 边计算

`computeCayleyActionEdges(group, actions, multiplyType)`（`src/core/algebra/cayleyEdges.ts`）：

- 无 enabled action → `[]`
- isBidirectional = action 元素自逆
- right：to = multiply(fromEl, actionEl)；left：to = multiply(actionEl, fromEl)
- 最后按 `minIdx|maxIdx|actionId` 去重
- **大群限流**：order > 60 时 `maxEdges = Math.max(120, order*3)`

## 4. 2D Cayley 图 (GroupCanvas.tsx)

- 节点：SVG 圆 (r=28)，可拖拽移动；KaTeX 渲染（`foreignObject`）
- 边：二次贝塞尔曲线 + 箭头标记；自环：上方小椭圆 + 箭头
- 不同群元素作用 → 不同颜色（16 色调色板）
- 支持力导向布局；半直积 φ(h) 不动点青绿高亮（`sdFixedMap`）

**节点位置优先级**：
1. 用户拖拽保存的位置（~1px 容差）
2. `gridPositions`（grid/spherical/新形状布局）
3. `circlePositions`（circular 兜底）

初始化居中：`initializeNodePositions` 与运行时 `viewBoxSize` 使用相同 force 标志（默认 false），避免大群节点偏移出画布。

## 5. 3D Cayley 图 (Cayley3DView.tsx)

- 节点：Three.js 球体 (r=0.42~0.62)，**不可拖拽**，位置预计算
- 边：圆柱体 + 锥形箭头（有向）或仅圆柱体（无向）；自环：上方环形
- 节点标签：`Html` + KaTeX；OrbitControls 旋转/缩放/平移
- 3D 导出 PNG（`preserveDrawingBuffer: true`）

## 6. 3D 形状模板（17 种）

形状按**群的性质**分配（`getDefaultLayout3D` 优先级：直积 → 二面 → 循环 → 阿贝尔 → 特定群 → spherical）：

| 形状 | 适用群性质 | 布局描述 |
|------|-----------|---------|
| `spherical` | 所有群（兜底） | Fibonacci球面分布 |
| `circular` | 循环群 Zₙ、阿贝尔群 | xz平面圆环 |
| `dihedral` | 二面体群 Dₙ | 上下两平行环 |
| `hexagon` | S₃（非阿贝尔阶6） | 平面六边形 |
| `cube` | Q₈（非阿贝尔阶8） | 立方体顶点 + 多余球面散布 |
| `tetrahedron` | V₄（阿贝尔阶4） | 正四面体顶点 + 多余球面散布 |
| `lattice` | 全循环因子直积群（兜底） | 晶格布局，因子贪心分配 XYZ 轴组 |
| `cylinder` | 2因子直积，恰好一个循环因子 | 循环因子沿Y轴分层 |
| `torus` | 2因子直积，无循环因子 | 环面主/次方向 |
| `truncatedTetrahedron` | A₄（阶12） | 截角四面体顶点分布 |
| `truncatedCube` | S₄（阶24，默认） | 截角立方体顶点分布 |
| `truncatedOctahedron2/3` | S₄（备选） | 截角八面体变体 |
| `rhombicuboctahedron` | S₄（备选） | 菱形截角立方八面体 |
| `truncatedIcosahedron` | A₅（阶60，默认） | 截角二十面体顶点分布 |
| `truncatedDodecahedron` | A₅（备选） | 截角十二面体顶点分布 |
| `cuboctahedron` | 通用 | 截角立方八面体（类型中定义，UI 未暴露） |

> S₄/A₄/A₅ 群切换 3D 形状时自动切换预设 Cayley 边配置（`getSpecialCayleyActions`），以适配多面体对称性。
>
> 直积群 3D 形状由 `analyzeDPFactors` 智能选择：全循环→lattice、一循环→cylinder、无循环→torus、多因子→lattice。半直积群可用 ['spherical','lattice','torus','circular']，默认 'lattice'。

## 7. 2D 形状系统（10 种）

| 形状 | 布局函数 | 适用群 | 描述 |
|------|---------|--------|------|
| `circular` | 圆形排列 | 所有群（默认） | 节点均匀分布在圆周上 |
| `grid` | `directProductGridLayout2D()` | 直积群 | m×n 网格布局，行列交换优化 |
| `spherical` | `fibonacci2DLayout()` | 所有群 | Fibonacci 球面分布 2D 投影 |
| `concentric` | `concentricLayout()` | 所有群 | 按共轭类分层同心环，单位元居中 |
| `dualRing` | `dualRingLayout()` | 二面体群 Dₙ | 旋转元外环、反射元内环 |
| `archimedean` | `archimedeanSpiralLayout()` | 所有群 | 阿基米德螺旋，按元素阶排序 |
| `spiral` | `spiralLayout()` | 循环群 Cₙ | 多圈螺旋"玫瑰"图案 |
| `coil` | `coilLayout()` | 所有群 | 变距螺旋（α=0.7） |
| `projection3D` | `projection3DLayout()` | S₃/S₄/S₅/A₄/A₅/Q₈ | 3D 多面体等轴投影 |
| `rewiring` | `semidirectProductLayout()` | 半直积群 | |H| 个 N 副本环绕 H 主环，φ 重布线 |

**智能默认 2D 形状**（`getDefaultShape2D`）：直积→grid、S₃/S₄/S₅/A₄/A₅/Q₈→projection3D、循环→spiral、二面→dualRing、半直积→rewiring、大阶非循环(order>30)→archimedean、其余→circular。

**布局函数**（forceLayout.ts / shapeLayouts.ts / cycleLayouts.ts / ringOrder.ts）：

| 函数 | 文件 | 说明 |
|------|------|------|
| `computeShape2DPositions(group, shape, w, h)` | shapeLayouts.ts | 按形状名调度所有 2D 布局 |
| `directProductGridLayout2D` | shapeLayouts.ts | 直积网格/嵌套因子布局 |
| `matrixGridLayout(rows, cols, w, h)` | ringOrder.ts | 标准矩阵网格 |
| `nestedFactorLayout2D` | ringOrder.ts | 非循环直积：外层环 + 内层环 |
| `parseProductFactors(group)` | ringOrder.ts | 解析直积因子 → ProductFactors |
| `semidirectProductLayout` | forceLayout.ts | 半直积重布线布局 |
| `forceLayout(group, positions, w, h, iterations?)` | forceLayout.ts | 同步力导向（斥力+引力+重力+循环斥力+冷却） |
| `forceLayoutAsync(group, positions, w, h, onProgress?)` | forceLayout.ts | 异步分块力导向，order>30 使用 |
| `computeElementOrder(el, group)` | forceLayout.ts | 元素阶计算 |
| `computeCycleSubgroups(group)` | cycleLayouts.ts | 所有循环子群 |
| `planarCycleLayout(group, w, h)` | cycleLayouts.ts | 圆圈图布局引擎 |
| `ringOrder(keys)` | ringOrder.ts | 数字感知排序 / S3 Hamiltonian 环 / Gray 码 |
| `cayleyRingKeys(keys)` | ringOrder.ts | Cayley 环键排序 |

## 8. 凯莱图设置（ViewPanel 内联）

- **乘法类型**：右乘 `a·c` / 左乘 `c·a`
- **2D 形状**：下拉选择（cayley 视图）
- **3D 形状**：下拉选择（3d 视图），S₄/A₄/A₅ 的 `canonical3DEdgeIds` 典型边标注
- **力导向布局**：按钮（2D，`concentric`/`dualRing`/`projection3D`/`rewiring` 语义布局禁用）
- **群元素作用列表**：复选框 + 颜色条 + KaTeX 标签，全选/清除，"(by element)" 提示

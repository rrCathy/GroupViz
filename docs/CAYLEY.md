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

interface CayleyAction {   // 原 GroupAction，v1.8 起更名以让出"群作用"命名
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
- 节点标签：`Html` + KaTeX；**自定义球坐标轨道**（非 OrbitControls）：左键旋转（theta/phi 无极角钳制，可连续翻越上下两极点，`up=sign(sinφ)` 翻转保持画面正立）、右键平移 target、滚轮缩放 radius∈[3,25]；▶ 自动旋转沿用同一状态（最后拖拽方向与速率）
- 3D 导出 PNG（`preserveDrawingBuffer: true`）+ **3D GIF 导出**（`exportCayley3DGif`：`cayley3dControls` 注册桥驱动相机按 `cayley3DExportPlan`（3s/2 圈 60 帧或 5 圈 7.5s 150 帧，20fps）匀速旋转，rAF 逐帧离屏 drawImage → gifenc 编码，结束恢复原相机视角）

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
> 直积群 3D 形状由 `analyzeDPFactors` 智能选择：全循环→lattice、一循环→cylinder、无循环→torus、多因子→lattice。半直积群可用 ['spherical','lattice','torus','circular']，默认 'lattice'。半直积/命名半直积（QD16、SmallGroup(16,13)，`isGroupSemidirectProduct || isNamedRewiringGroup`）3D 可用 ['spherical','semidirectCylinder','lattice','torus','circular']，**默认 `semidirectCylinder`**（N 环沿 Y 轴分层圆柱，`semidirectCylinder` 内部经 `getSemidirectProductMeta`+`semidirectFactorMap` 支持命名特判，QD16 实测默认生效）。

## 7. 2D 形状系统（13 种）

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
| `rewiring` | `semidirectProductLayout()` | 半直积群（含 **QD16 / SmallGroup(16,13) 命名半直积**——`isNamedRewiringGroup` 特判；QD16 另经 buildGenerators 生成元标准化为 (a,b)，a 阶 8 / b 阶 2，bab=a³，保证双盘各显完整 8 元环实边；(16,13)=(C₄×C₂):C₂ 对齐 Group Explorer 标准化为 (a,b,c)，a 阶 4 / b 阶 2 / c 阶 2，ac=ca、cbc=ba²，双盘各显 C₄ 环） | \|H\| 个 N 副本环绕 H 主环，φ 重布线 |
| `cylinder` | `cylinderLayout2D()` | 2因子直积，恰一个循环因子 | 交错同心圆：同心多层环——每层=非循环因子 Xₙ 副本环（Dₙ 双环、S₃ 凯莱六边形），相邻层半格交错（offset = layerIdx·π/copyN），Cₙ 生成元边为层间斜线 |
| `torus` | `torusLayout2D()` | 2因子直积，无循环因子 | 主轴环 + 每点挂另一因子副本（甜甜圈） |
| `ringGrid` | `ringGridLayout2D()` | ≥3 个循环因子直积（Cₙ×C₂×…×C₂ 型） | n 边形环（环生成元 x 幂序）× 2×2 网格（V₄），每格中心挂一个完整环 |

**智能默认 2D 形状**（`getDefaultShape2D`）：直积→`classifyDirectProduct2D`（全循环→grid、恰一循环因子→cylinder、无循环→torus、多因子→grid；C₄×C₂×C₂ 类 ≥3 循环因子→ringGrid）、S₃/S₄/S₅/A₄/A₅/Q₈→projection3D、循环→circular（spiral 仅作手动可选）、二面→dualRing、半直积→rewiring（**QD16 / SmallGroup(16,13) 命名半直积经 `isNamedRewiringGroup` 同样默认 rewiring、可用 [rewiring,circular,spherical,concentric]**）、大阶非循环(order>30)→archimedean、其余→circular。可用形状列表自动追加分类形状 + grid（`getAvailableShapesForView`）。Q₁₆ 生成元按 Group Explorer 标准化为 (a,b)（a 阶 8 / b 阶 4、b²=a⁴、aba=b）且走 4 同心 ⟨b⟩-陪集环专用布局（见下「Q₁₆ 专用布局」）。

**环网格探测**（`findRingGridDecomposition`/`isRingGridGroup`，types.ts）：纯群论探测 Cₙ×C₂² 分解——阶≤2 元素两两生成 V₄ 网格、遍历阶 n=order/4 环生成元做幂×V 唯一覆盖探测 + 交换性检查（拒绝 C₂×D₄ 伪分解）；**仅限 ≥3 个循环因子直积**（符号循环因子计数，C₁₀×C₂ 等两因子直积排除回 grid）。pipe 直积群、注册表 GAP 表群、同构群统一走同一条路。

**注册表 Dₙ 双环**（`splitDihedralElements`，forceLayout.ts）：注册表二面体群（按阶创建面板 16-30 阶，元素 value=[k] 无旋转/反射编码）经元素阶分类——m=|G|/2，找阶 m 元素 r，旋转=⟨r⟩ 幂闭包（m 个），反射=其余（m 个），配对 sᵢ=rⁱ·s₀；`dualRingLayout` 与 `cayleyCircleLayout` 的 value 分类失败时自动回退此路径（外环旋转幂序角 + 内环反射同角），对 D_m、C₂ₘ、C_m×C₂、Q₈、C₈:C₂ 均匹配（A₄/C₂³ 无阶 m 元素返回 null 走原 fallback）。

**Q₁₆ 专用布局**（`quaternionCosetMap` ringOrder.ts + `quaternionRingLayout2D` forceLayout.ts，参考 Group Explorer Q16 圆柱——GE 中记作 Q₈，下标=阶/2）：`quaternionCosetMap` 对每个元素求 g=a^j·b^i 唯一分解（j,i∈0..3，扫 a⁻ʲ·g ∈ ⟨b⟩），结构校验 order=16 + a 阶 8 / b 阶 4 / a⁴=b² / b·a·b⁻¹=a⁻¹，任一失败返回 null（回退单环，不影响其他群）。2D：4 个右陪集 a^j⟨b⟩ 画成同心圆（j=0 含 e 最内，r_j=R·(0.34+0.66j/3)），角度 90°·i 四环对齐——b 边=环内 90° 弧（4 个干净正方形 b-循环），a 边=12 条纯径向辐条（i 偶向外 j→j+1、i 奇向内 j→j−1）+ 4 条 wrap 直径（(3,0)→(0,2)、(0,1)→(3,3)、(3,2)→(0,0)、(0,3)→(3,1)，即 2 条中心直径线各两个方向）。全参数数值扫描确认这是 4 环族最优（4 处交叉集中在圆心，教科书式画法）。3D：`quaternionCylinder3D`（layout3D.ts semidirectCylinder fallback 分支）4 层 y 环 × 4 节点对齐，a 边竖直、b 边层内弧，即 GE 圆柱原貌；`getDefaultLayout3D(Q16)`='semidirectCylinder'、3D 可用形状 [spherical, semidirectCylinder]。**位置预置修复**（positionUtils.ts `initializeNodePositions`）：cayley 视图 + circular 形状且 computeShape2DPositions 返回 null 时改用 cayleyCircleLayout 生成预置位置（与 GroupCanvas 兜底一致），此前 Q16 专用 4 环永远被 ringOrder 单环预置覆盖。

**直积因子识别**（`factorPipeGroups` / `factorPipeGroupsOrTokens`，ringOrder.ts）：按紧凑符号解析因子（`parseCompactFactors`，`C_{2}^{2}` 幂展开为 1 因子 2 段），与 pipe token 段数对齐后按因子分组（C₂²×S₃ = 2 组）；紧凑幂合并（S₃²）时按 pipe 段拆分为多因子，保证 cylinder/torus 布局与 `buildFactorSubgroup` 正常。

**注册表群（非 pipe）因子聚类**（`tableGroupGridFactors` / `clusterFactorGroups` / `tableGroupFactorSplit` / `clusterIsCyclic`，ringOrder.ts）：注册表群（16-31 阶，元素无 pipe id）不依赖符号，按生成元交换性 union-find 聚类（不可交换生成元同簇→非循环因子内部生成元）→ 因子划分 + 混合进制枚举；`clusterIsCyclic` 判定簇循环性（存在单元素幂闭包=全簇）。C₄×C₄/Z₄×Z₂×Z₂/C₂⁴ → 4×4 满网格，Z₂×D₄/Z₂×Q₈ → cylinder 2 层同心环（循环簇沿径向层叠），C₂×C₂×S₃ → 聚类 [12,2]（C₂×S₃ 非循环簇 + C₂ 循环簇）cylinder 2 层。半直积（'(Z₄×Z₂):Z₂'）由 `hasTopLevelTimes` 顶层 \\times 检测排除，不套网格。

**聚类失败兜底**（`tableFactorSearch`，ringOrder.ts + forceLayout.ts）：聚类对生成元横跨多个因子（C₃×S₃、C₂×A₄、C₅×S₃，GAP gens 混合）或全交换群（C₄×C₂×C₂）时失败/退化返回 null → cylinder/torus 布局改按符号搜索因子：按群符号分组（`tablePartOrder` 各因子阶 + `tableGroupedParts` 相邻同底循环合并），对每个分组从 `findAllSubgroups` 候选池（阶 + 循环性匹配）DFS 选因子，有序乘积覆盖全群验证后驱动同心多层环（如 C₃×S₃ → 3 层×6 节点、C₄×C₂×C₂ → 4 层×4 节点）。圆形布局兜底同步升级：`keys` 全为 gN 表群 id 时改用 `powerRingOrder`（生成元 BFS 幂序），C₁₆ 等循环表群恢复正多边形幂序、生成元边不再乱穿。

**布局函数**（forceLayout.ts / shapeLayouts.ts / cycleLayouts.ts / ringOrder.ts）：

| 函数 | 文件 | 说明 |
|------|------|------|
| `computeShape2DPositions(group, shape, w, h)` | shapeLayouts.ts | 按形状名调度所有 2D 布局 |
| `directProductGridLayout2D` | shapeLayouts.ts | 直积网格/嵌套因子布局 |
| `matrixGridLayout(rows, cols, w, h)` | ringOrder.ts | 标准矩阵网格 |
| `nestedFactorLayout2D` | ringOrder.ts | 非循环直积：外层环 + 内层环 |
| `parseProductFactors(group)` | ringOrder.ts | 解析直积因子 → ProductFactors |
| `factorPipeGroups` / `factorPipeGroupsOrTokens` | ringOrder.ts | 紧凑符号→按因子分组 pipe tokens（C₂²×S₃ = 2 组） |
| `buildFactorSubgroup` | forceLayout.ts | 因子临时群重建（keyToEl/分量乘法闭包） |
| `factorCopyRingLayout` | forceLayout.ts | 因子副本环（Dₙ 双环 r=1/0.55，其余单环） |
| `cylinderLayout2D` / `torusLayout2D` | forceLayout.ts | 交错同心圆（同心多层环，相邻层半格交错）/ 甜甜圈（环上挂副本） |
| `ringGridLayout2D` | forceLayout.ts | 环网格（n 边形环 × 2×2 网格，每格挂完整环） |
| `semidirectProductLayout` | forceLayout.ts | 半直积重布线布局（含 QD16 命名半直积——`getSemidirectProductMeta` 经 `namedSemidirectOrderPair` 恢复 C₈⋊C₂） |
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

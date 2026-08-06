# 视图系统 (Views)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

11 种视图模式（`ViewMode`：'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action' | 'sylow'），主画布 `GroupCanvas.tsx` 按 `currentView` 分发渲染。

## 1. 集合视图 (SetView.tsx)

- 元素按 ⌈√n⌉ 列密堆积网格排列（替代早期圆圈排列）
- 支持 2D Cayley 形状选择

## 2. 凯莱图 (GroupCanvas.tsx)

详见 [CAYLEY.md](CAYLEY.md)。支持平移、缩放（上限 8x）、选中、框选、套选、键盘导航（←→ 切换元素）、节点拖拽。

## 3. 圆圈图 (CycleView.tsx)

- `planarCycleLayout`：单位元居中，循环子群按角度扇区排列
- "显示极大循环子群"筛选（`showMaximalCycles`）

## 4. 乘法表 (TableView.tsx)

- 使用 SVG `<text>`（foreignObject 开销大）
- 陪集彩色矩形条纹高亮（同一陪集单元格）
- 缩放上限 10x

## 5. 3D 凯莱图 (Cayley3DView.tsx)

详见 [CAYLEY.md](CAYLEY.md) 第 5 节。

## 6. 对称性视图 (SymmetryView.tsx)

将群元素映射为多面体上的几何对称变换。

**支持的多面体**：

| 群 | 几何体 | 顶点数 | 面数 |
|---|--------|-------|------|
| Cₙ | 正n边形 | n | - |
| Dₙ | 正n边形 | n | - |
| A₄ | 正四面体 | 4 | 4△ |
| S₄ | 正方体 / 正八面体(切换) | 8/6 | 6□/8△ |
| A₅ | 正二十面体 / 正十二面体(切换) | 12/20 | 20△/12⬠ |
| V₄ | 长方形 | 4 | - |

**双层映射**：`computeGeometricRotation()`（SymmetryView.tsx）调用 `computeElementRotation()`（elementRotation.ts）获取旋转类型/角度，再按实际几何数据计算轴方向：

```
computeElementRotation(group, element) → { angleRad, label }  (旋转类型)
        ↓
getElementRotationKind(symbol, cycleType) → 'vertex' | 'face' | 'edge'  (轴类型)
        ↓
getGeometryAxes(data, symmetryType) → { vertexAxes, faceAxes, edgeAxes }  (从几何数据计算轴池)
        ↓
computeGeometricRotation() → { axis, angleRad, label }  (最终结果)
```

**轴渲染**：实体圆柱体 + 锥体箭头（WebGL 线宽不可靠），红色自发光材质。

**轴-几何体交点标记**：顶点交点（黄）、棱中点交点（青）、面心交点（绿），阈值 0.25。

**动画**：`useAnimatedRotation` 三阶段——复位(t=0→0.5) → 旋转(t=0.5→1.0, slerp) → 静止(t>1.0)；OrbitControls 动画期间禁用。

**状态**：`symmetryShowAction`（显示元素操作）、`symmetryRotateSpeed`（0.2~5.0）、`symmetryActionElementId`。

**导出 GIF**：`exportSymmetryAsGif()`——清除选中 → 重设元素触发新动画 → 20fps 录制 2 秒（gifenc）。

## 7. 子群格视图 (SubgroupLatticeView.tsx)

- Hasse 图：节点按层级排列，边表示包含关系
- 正规子群高亮
- 大群（order>60）：显示后端 `backendCache.lattice` 结果

## 8. 同态视图 (HomomorphismView.tsx)

- 源/目标群两个圆形 Cayley 图 + 弯曲彩色映射边
- 悬停/固定源元素 → 高亮像；悬停目标 → 高亮原像
- 核（红）/像（青）着色 + 单射/满射/同构 chips
- `theoremMode` 时全屏渲染 `FirstIsomorphismAnimation`（4 阶段动画证明 G/ker ≅ im：核 → 商群纤维簇 → 同构），步进按钮 + 方向键

## 9. 陪集条带视图 (CosetStripView.tsx)

- `cosetStripLayout()` 带标签的彩色列（条带）
- 子群列实线粗标签，其余虚线；节点按陪集着色，点击/ctrl 选中
- 底部 `|G|=n = |H|·[G:H]` Lagrange 定理验证
- 空态提示目前为硬编码英文

## 10. 轨道视图 / 群作用 (ActionView.tsx)

详见 [ACTIONS.md](ACTIONS.md)。轨道簇布局（大小升序左→右，固定点 ★ 最左）、生成元作用边、hover 群元素显示全部箭头、点击元素 → 右侧面板 OST/Stab 详情；自定义作用编辑模式（元素围圈 + 生成元 chips + 虚线未绑定箭头）。isTooLarge 阈值 120。

## 11. Sylow 视图 (SylowView.tsx)

以群元素为最小节点（节点 = 元素）的 p-子群浏览器：p 可选素数（|G| 素因子），工具栏统计 p-元素数 / p-子群数 / n_p / `|G| = p^k·m`。

- **默认凯莱图布局**：圆环排列（`cayleyCircleLayout`），边 = 群生成元作用（右乘，颜色对应）；点击子群 → 边切换为该子群生成元作用
- **单选子群 → 陪集条带布局**：`cosetStripLayout` + 底部 Lagrange 验证 `|G| = |H|·[G:H]`
- **Ctrl/⌘ 或 ⊕ 复选两个子群 → 共轭视图（Sylow 第二定理）**：上下两行布局（公共元素 P∩Q 中间拉链交错列），自动求共轭元 g 满足 gPg⁻¹ = Q，竖直双向金色共轭箭头 + 图上标注 `共轭: g = …`；两子群内部生成元边（P 青 / Q 紫）
- **子群列表**：Sylow p-子群（★ + ◁ 正规标记，|H|=p^i + ⟨生成元⟩ TeX）+ 其他 p-子群（默认收起）；⊕ 复选按钮；列表可整体收起（▶/◀）
- 节点配色：选中金色 → P∩Q 金色 → P 青 → Q 紫 → p-元素青描边 → 其他灰化（opacity 0.3）；legend 随模式切换
- 数据：`findAllPSubgroups`（专用 p-子群枚举算法，SYLOW_MAX_ORDER=240 守卫，isTooLarge 阈值 240）

## 12. 多视图模式

`toggleMultiViewMode()` 开启后可通过 `openFloatingView(view)` 打开浮动窗口（`FloatingViewWindow.tsx`）：

- 可拖拽、调整大小；所有窗口共享同一 `currentGroup`
- 主画布与浮动窗口可同时对比不同视图
- 缩放上限 8x（乘法表 10x）

## 13. 直积/半直积构建视图- `DirectProductView.tsx`：直积群构建画布（isDirectProductMode 时替换主画布）
- `SemidirectProductView.tsx`：半直积设置 + 4 步教学动画（详见 [GROUPS.md](GROUPS.md) 第 4 节）

## 14. 大群视图守卫

`forceShowLargeGroupViews`：order > 60 的群对计算密集视图（cycle/sublattice/symmetry/homomorphism/cosetstrip）提供守卫与后端降级。

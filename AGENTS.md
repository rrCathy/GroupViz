# GroupViz - 群论可视化WEB应用开发框架

## 1. 项目概述

**GroupViz** 是一个用于可视化和探索群论的交互式WEB应用。该应用旨在通过动态图形帮助数学研究者、学生理解抽象代数中的群论概念。

### 核心特性

- **群结构可视化**：子群、陪集、正规子群、商群、中心、共轭类
- **群运算可视化**：Cayley表、乘法表、运算律验证
- **定理与结论可视化**：Lagrange定理、Cayley定理、同构定理、轨道-稳定子定理
- **Cayley图可视化**：以图形方式展示有限群的群元素作用关系
- **群操作交互**：支持拖拽、缩放、动画演示群的运算过程
- **多群支持**：支持循环群、二面群、对称群、直积群等多种典型群

### 当前状态

- ✅ S₃ 对称群完整实现
- ✅ 循环群 Zₙ 实现 (n=1..20)
- ✅ 二面群 Dₙ 实现 (n=3..8)
- ✅ 交错群 Aₙ 实现 (n=3..5)
- ✅ 特殊群 V₄、Q₈
- ✅ 直积群 Z₄×Z₂、Z₂³、Z₃×Z₃
- ✅ 三栏布局 UI（左侧工具栏、中间画布、右侧属性面板）
- ✅ 手风琴式工具面板（创建群、群操作、视图切换、凯莱图设置）
- ✅ 7种视图模式：集合视图、凯莱图(2D)、圆圈图、乘法表、3D凯莱图、对称性视图、子群格图
- ✅ SVG画布交互（平移、缩放、选中、框选、套选）
- ✅ 键盘导航（← → 切换元素）
- ✅ 操作历史面板（右上角悬浮）
- ✅ 提示信息框（左下角）
- ✅ 子群列表与点击选择
- ✅ 共轭类分析
- ✅ 圆圈图极大循环子群筛选
- ✅ KaTeX 数学渲染（所有数学符号统一用 TeX 显示）
- ✅ Cayley图重构：基于群元素作用（非生成元），支持右乘/左乘切换
- ✅ 2D Cayley图力导向布局 + 节点拖拽
- ✅ 3D Cayley图按群性质选择形状模板，节点位置预计算（不可拖拽）
- ✅ 直积群晶格(lattice)布局
- ✅ 对称性视图：多面体几何体 + 元素操作动画 + 旋转轴与交点标记
- ✅ 对称性视图轴方向从几何数据运行时计算（A4/A5轴修正，二面体反射轴修正）
- ✅ 子群格(Hasse图)视图：节点按层级排列，正规子群高亮，边表示包含关系
- ✅ 多视图模式：支持浮动窗口，可同时打开多个视图对比分析
- ✅ 子集保存与分析：选中元素集合自动检测是否为子群/正规子群
- ✅ 自逆元素检测：计算逆元时自动标记并高亮自身为逆元的元素
- ✅ 国际化的UI界面（中文/English）
- ✅ 小群预计算注册表（阶<12所有群自动索引，含预计算子群/共轭类/中心数据）
- ✅ S₄/A₄/A₅ 群专属3D形状模板 + 预设Cayley边配置
- ✅ 视图导出：SVG视图导出SVG矢量图，3D视图导出PNG，对称性视图支持GIF动图导出
- ✅ 欢迎页群预览：点击群记号弹出倒水滴形圆窗，随机展示 ring/generators/orders 三种预览风格
- ⏳ 陪集分解UI可视化开发中（底层计算已完成）

---

## 2. 技术栈

### 核心框架
| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^19.2.5 | UI框架 |
| TypeScript | ~6.0.2 | 类型安全 |
| Vite | ^8.0.9 | 构建工具 |
| TailwindCSS | ^4.2.2 | 样式框架 |

### 可视化库
| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | ^0.184.0 | 3D渲染引擎 |
| React Three Fiber | ^9.6.0 | React Three.js绑定 |
| Mafs | ^0.21.0 | 数学函数绘图 |

### 数学渲染
| 技术 | 版本 | 用途 |
|------|------|------|
| KaTeX | ^0.16+ | TeX数学公式渲染（全应用） |

### 导出
| 技术 | 版本 | 用途 |
|------|------|------|
| gifenc | ^1.0.3 | GIF动图编码（对称性视图导出） |

### 状态管理
| 技术 | 版本 | 用途 |
|------|------|------|
| React Context | useState + useCallback | 轻量级状态管理 |

---

## 3. 目录结构

```
GroupViz/
├── src/
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── GroupCanvas.tsx         # 主画布 + 2D Cayley图
│   │   │   ├── SetView.tsx             # 集合视图
│   │   │   ├── CycleView.tsx           # 圆圈图
│   │   │   ├── TableView.tsx           # 乘法表
│   │   │   ├── Cayley3DView.tsx        # 3D Cayley图
│   │   │   ├── SymmetryView.tsx        # 对称性视图（多面体几何 + 元素操作动画）
│   │   │   ├── SubgroupLatticeView.tsx # 子群格(Hasse)视图
│   │   │   └── FloatingViewWindow.tsx  # 浮动多视图窗口
│   │   ├── Panels/
│   │   │   ├── LeftPanel.tsx           # 左侧工具栏
│   │   │   └── RightPanel.tsx          # 右侧属性面板
│   │   ├── Tex.tsx                     # KaTeX渲染组件
│   │   └── WelcomePage.tsx             # 欢迎页（浮动数学符号动画 + 群记号倒水滴预览弹窗）
│   ├── core/
│   │   ├── types.ts               # 核心类型定义
│   │   ├── groups/
│   │   │   ├── SymmetricGroup.ts   # 对称群 Sₙ
│   │   │   ├── CyclicGroup.ts     # 循环群 Zₙ
│   │   │   ├── DihedralGroup.ts   # 二面群 Dₙ
│   │   │   ├── AlternatingGroup.ts # 交错群 Aₙ
│   │   │   ├── SpecialGroup.ts    # V₄, Q₈
│   │   │   └── SmallGroups.ts     # 直积群 + 小群预计算注册表
│   │   ├── algebra/
│   │   │   ├── subgroups.ts       # 子群、正规子群、共轭类、陪集、子群格
│   │   │   └── forceLayout.ts     # 力导向布局 + Cayley边计算 + 圆圈图布局
│   │   ├── polyhedra.ts           # 多面体顶点生成（截角四面体/立方体/二十面体等）
│   │   ├── elementRotation.ts     # 群元素→几何旋转变换映射
│   │   └── viewBox.ts             # SVG视口尺寸计算
│   ├── context/
│   │   ├── GroupContext.tsx        # 全局状态管理 + 所有action（820行）
│   │   └── useGroup.ts            # Context Hook
│   ├── utils/
│   │   ├── texify.ts              # Unicode→TeX转换 + KaTeX渲染
│   │   └── export.ts              # 视图导出（SVG/PNG/GIF）
│   ├── i18n/
│   │   ├── I18nContext.tsx        # 国际化Provider
│   │   ├── useTranslation.ts      # useTranslation Hook
│   │   └── translations.ts        # 翻译字典（中文/English）
│   ├── hooks/
│   ├── assets/
│   ├── App.tsx                    # 主应用（欢迎页 + 三栏布局 + 键盘事件）
│   ├── App.css                    # 全局样式
│   ├── index.css                  # 基础全局样式
│   └── main.tsx                   # 入口（React Root + KaTeX CSS导入）
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── AGENTS.md                      # 本文档
└── VISUALIZATION.md               # 可视化策略文档
```

---

## 4. 核心群论实现

### 4.1 有限群接口定义

```typescript
interface GroupElement {
  id: string
  label: string        // 如 "(12)"、"r²"、"σ₁₂"、"0"
  value: number[]      // 编码，如置换 [2,1,3]、循环 [5]、直积 [a,b]
}

interface Generator {
  name: string
  symbol: string
  color: string
  apply(element: GroupElement): GroupElement
  inverse: Generator
}

interface Group {
  name: string         // 如 "Symmetric Group S₃"
  symbol: string       // 数学符号，如 "S₃"
  order: number
  elements: GroupElement[]
  generators: Generator[]
  multiply(a: GroupElement, b: GroupElement): GroupElement
  inverse(element: GroupElement): GroupElement
  identity: GroupElement
  exponent?: number
  isAbelian: boolean
}
```

### 4.2 已实现群

| 群 | 符号 | 阶 | 生成元 | 状态 |
|----|------|-----|--------|------|
| 对称群 S₃ | S₃ | 6 | σ₁₂, σ₂₃ | ✅ |
| 对称群 S₄ | S₄ | 24 | (12), (1234) | ✅ |
| 循环群 Zₙ | Zₙ | n | 1 | ✅ |
| 二面体群 Dₙ | Dₙ | 2n | r, s | ✅ |
| 交错群 Aₙ | Aₙ | n!/2 | (123), (12)(34) 等 | ✅ |
| Klein四群 V₄ | V₄ | 4 | a, b | ✅ |
| 四元数群 Q₈ | Q₈ | 8 | i, j | ✅ |
| Z₄×Z₂ | Z₄×Z₂ | 8 | a, b | ✅ |
| Z₂³ | Z₂³ | 8 | a, b, c | ✅ |
| Z₃×Z₃ | Z₃×Z₃ | 9 | a, b | ✅ |

---

## 5. Cayley图系统（重构后）

### 5.1 核心概念

Cayley图的**边**不再局限于生成元，而是由**任意群元素作用**定义：

```
定义：对于节点 a,b 和群元素 c：
  - 右乘模式：如果 a·c = b，则存在从 a 到 b 的边
  - 左乘模式：如果 c·a = b，则存在从 a 到 b 的边
  - 如果 a·c = b 且 b·c = a（双向），则为无向边（不画箭头）
  - 如果 a·c = b 但 b·c ≠ a，则为有向边（画箭头）
```

### 5.2 类型定义

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

### 5.3 2D Cayley图 (GroupCanvas.tsx)

- 节点：SVG圆 (r=28)，可拖拽移动
- 边：二次贝塞尔曲线 + 箭头标记
- 自环：上方小椭圆 + 箭头
- 不同群元素作用 → 不同颜色（16色调色板）
- 支持力导向布局 (`runForceLayout`)
- 图标使用KaTeX渲染（SVG `foreignObject`）

### 5.4 3D Cayley图 (Cayley3DView.tsx)

- 节点：Three.js 球体 (r=0.42~0.62)，**不可拖拽**，位置预计算
- 边：圆柱体 + 锥形箭头（有向）或仅圆柱体（无向）
- 自环：上方环形
- 节点标签：`Html` 组件 + KaTeX 渲染
- 支持 OrbitControls（旋转、缩放、平移）

### 5.5 3D形状模板

形状按**群的性质**分配，而非硬编码群符号。支持15种形状模板：

| 形状 | 适用群性质 | 布局描述 |
|------|-----------|---------|
| `spherical` | 所有群（兜底） | Fibonacci球面分布 |
| `circular` | 循环群Zₙ、阿贝尔群 | xz平面圆环 |
| `dihedral` | 二面体群Dₙ | 上下两平行环 |
| `hexagon` | S₃（非阿贝尔阶6） | 平面六边形 |
| `cube` | Q₈（非阿贝尔阶8） | 立方体顶点 + 多余球面散布 |
| `tetrahedron` | V₄（阿贝尔阶4） | 正四面体顶点 + 多余球面散布 |
| `lattice` | 直积群(Z₄×Z₂, Z₃×Z₃, Z₂³) | 晶格/网络布局，元素按 value 坐标映射 |
| `truncatedTetrahedron` | A₄（阶12） | 截角四面体顶点分布 |
| `truncatedCube` | S₄（阶24，默认） | 截角立方体顶点分布 |
| `truncatedOctahedron2` | S₄（阶24，备选） | 截角八面体变体2 |
| `truncatedOctahedron3` | S₄（阶24，备选） | 截角八面体变体3 |
| `rhombicuboctahedron` | S₄（阶24，备选） | 菱形截角八面体顶点分布 |
| `truncatedIcosahedron` | A₅（阶60，默认） | 截角二十面体顶点分布 |
| `truncatedDodecahedron` | A₅（阶60，备选） | 截角十二面体顶点分布 |
| `cuboctahedron` | 通用 | 截角立方八面体（球面+立方混合） |

> S₄/A₄/A₅ 群在切换3D形状时会自动切换预设的Cayley边配置，以适配不同多面体对称性。

**检测函数**：
- `isGroupCyclic(group)` — 符号以Z开头，不含 ×/²/³
- `isGroupDihedral(group)` — 符号以D开头
- `isGroupDirectProduct(group)` — 符号含 ×/²/³/⁴

### 5.6 凯莱图设置面板 (LeftPanel)

在 `cayley` 或 `3d` 视图时显示：

- **乘法类型**：右乘 `a·c` / 左乘 `c·a` 切换
- **3D图形状**：下拉选择（仅3D视图）
- **力导向布局**：按钮（仅2D视图）
- **添加所有元素 / 清除所有**：批量管理群元素作用
- **群元素作用列表**：复选框 + 颜色条 + KaTeX标签

---

## 6. 对称性视图系统

### 6.1 概述

对称性视图 (`SymmetryView.tsx`) 将群元素映射为多面体上的几何对称变换，展示元素对几何体的旋转/反射作用。

**支持的多面体：**

| 群 | 几何体 | 顶点数 | 面数 |
|---|--------|-------|------|
| Cₙ | 正n边形 | n | - |
| Dₙ | 正n边形 | n | - |
| A₄ | 正四面体 | 4 | 4△ |
| S₄ | 正方体 / 正八面体(切换) | 8/6 | 6□/8△ |
| A₅ | 正二十面体 / 正十二面体(切换) | 12/20 | 20△/12⬠ |
| V₄ | 长方形 | 4 | - |

### 6.2 元素→几何旋转变换架构

**双层映射**：`computeGeometricRotation()` (SymmetryView.tsx) 调用 `computeElementRotation()` (elementRotation.ts) 获取旋转类型和角度，再根据实际几何数据计算正确的轴方向。

```
computeElementRotation(group, element) → { angleRad, label }  (旋转类型)
        ↓
getElementRotationKind(symbol, cycleType) → 'vertex' | 'face' | 'edge'  (轴类型)
        ↓
getGeometryAxes(data, symmetryType) → { vertexAxes, faceAxes, edgeAxes }  (从几何数据计算轴池)
        ↓
computeGeometricRotation() → { axis: [x,y,z], angleRad, label }  (最终结果)
```

### 6.3 几何轴计算 (getGeometryAxes)

**运行时从实际多面体数据计算**，不依赖硬编码：

| 多面体 | vertexAxes | faceAxes | edgeAxes |
|--------|-----------|----------|----------|
| 四面体 | 4个顶点方向 | - | 3个坐标轴（对边中点） |
| 立方体 | 4个体对角线 | 3个坐标轴 | 6个棱中点方向 |
| 二十面体 | 6个顶点方向 | 10个面心方向 | 15个棱中点方向 |
| 十二面体 | 12个面心方向 * | 20个顶点方向 * | 15个棱中点方向 |

> *十二面体和二十面体互为对偶，5阶轴和3阶轴类型交换

所有轴经 `addAxis()` 精确保留1e-6精度，通过四舍五入坐标去重对向。

### 6.4 轴线渲染

使用实体 3D 圆柱体 + 锥体替代不可靠的 WebGL 线渲染：

- **轴体**：圆柱体 (radius=0.12)，从 `axisNeg` 延伸到 `axisTo`
- **箭头**：锥体 (radius=0.28, height=0.7)，位于 `axisTo`端
- **方向**：通过 `setFromUnitVectors` 将默认Y轴对齐到实际轴方向
- **材质**：红色自发光 `#ff3333`，emissiveIntensity=1.0

### 6.5 轴-几何体交点标记

显示旋转轴与多面体的交点位置，用彩色球体标记：

| 标记类型 | 颜色 | 位置计算 |
|---------|------|---------|
| 顶点交点 | 黄 `#ffd93d` | 顶点投影到轴线 (阈值0.25) |
| 棱中点交点 | 青 `#4ecdc4` | 棱中点投影到轴线 (阈值0.25) |
| 面心交点 | 绿 `#84cc16` | 面心投影到轴线 (阈值0.25) |

面心通过 `computeFaceCenters()` 统一计算：
- 三角面 (四面体/八面体/二十面体)：通过 `computeTriangularFaces()` 检测
- 立方体面：硬编码6个面心 `(±s,0,0), (0,±s,0), (0,0,±s)`
- 十二面体五边形面：通过图遍历查找5-cycle

### 6.6 动画系统

`useAnimatedRotation` hook 控制三阶段动画：
1. **复位** (t=0→0.5)：几何体从当前旋转回到恒等
2. **旋转** (t=0.5→1.0)：几何体从恒等 slerp 到目标旋转
3. **静止** (t>1.0)：几何体保持目标旋转，轴线和交点标记持续可见

OrbitControls 在动画期间禁用旋转/平移，防止干扰。

### 6.7 状态管理

对称性视图相关状态（在 `GroupContext` 中）：

```typescript
symmetryShowAction: boolean        // 是否启用"显示元素操作"
symmetryRotateSpeed: number        // 旋转速度倍率 (0.2~5.0)
symmetryActionElementId: string | null  // 当前选中的元素ID
```

### 6.8 关键修复历史

| 修复 | 问题 | 解决方案 |
|------|------|---------|
| 轴向量归一化 | 非单位轴导致几何体缩放扭曲 | 所有轴常量归一化为单位向量 |
| 二面体反射轴 | 所有反射用同一X轴 | 按 k·π/n 计算XZ平面内的独立反射轴 |
| 四面体棱轴 | 对角方向 `[0,1/√2,1/√2]` | 改为坐标轴（对边中点方向） |
| A5轴方向 | 使用立方体轴（不匹配二十面体） | 从几何数据运行时计算 |
| 十二面体轴交换 | 5阶/3阶轴与二十面体互换 | 检测顶点数≥20时交换vertexAxes/faceAxes |
| 负角度轴不显示 | `angleRad > 0` 过滤掉负数旋转角 | 改为 `Math.abs(angleRad) > 0` |
| WebGL线宽不支持 | `Line`组件线宽>1在多数平台无效 | 改用实体圆柱体+锥体mesh |
| 棱交点误判 | 投影落在棱段内但距离远 | 仅用棱中点投影到轴线距离判断 |

---

## 7. KaTeX数学渲染

### 7.1 技术方案

所有数学符号通过 KaTeX 渲染，替代之前的 Unicode 纯文本。

- `src/utils/texify.ts` — Unicode→TeX 转换：
  - 下标：`₀₋₉` → `_{0..9}`
  - 上标：`⁰⁻⁹` → `^{0..9}`
  - 希腊字母：`σ` → `\sigma`
  - 特殊符号：`×` → `\times`，`ℤ` → `\mathbb{Z}`
- `src/components/Tex.tsx` — `<Tex math="..." />` React 组件
- `renderTex()` — 直接返回 KaTeX HTML 字符串

### 7.2 渲染位置

| 位置 | 方式 |
|------|------|
| 2D/集合/圆圈图节点 | SVG `foreignObject` + `dangerouslySetInnerHTML` |
| 3D图节点/图例 | `Html` 组件 + `dangerouslySetInnerHTML` |
| 右侧面板（群信息、元素属性、子群、共轭类、元素芯片） | `dangerouslySetInnerHTML` |
| 左侧面板（凯莱图设置元素列表） | `dangerouslySetInnerHTML` |
| 3D图覆盖层（群符号） | `dangerouslySetInnerHTML` |
| 乘法表 | 保持 SVG `<text>`（单元格过多，`foreignObject` 开销大）|

---

## 8. 状态管理

使用 React Context (`GroupContext`) 进行状态管理：

```typescript
interface GroupContextState {
  currentGroup: Group | null
  currentView: ViewMode           // 'set'|'cayley'|'cycle'|'table'|'3d'|'symmetry'|'sublattice'
  selectedElements: Set<string>
  canvasTransform: { x: number; y: number; scale: number }
  operationHistory: string[]
  nodePositions: Map<ViewMode, Map<string, { x: number; y: number }>>
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  isSimpleGroup: boolean
  showMaximalCycles: boolean
  hintMessage: string
  forceShowLargeGroup: boolean
  viewBoxSize: ViewBoxSize
  isPending: boolean                    // useTransition 过渡状态
  cayleyMultiplyType: MultiplyType      // 'right' | 'left'
  cayleyActions: GroupAction[]          // 已启用的群元素作用
  cayleyShape3D: Layout3D               // 当前3D形状
  cayleyAvailableShapes3D: Layout3D[]   // 可选3D形状
  subsets: Subset[]                     // 保存的子集分析
  multiViewMode: boolean                // 多视图模式开关
  floatingViews: FloatingView[]         // 打开的浮动视图窗口
  symmetryShowAction: boolean           // 是否启用"显示元素操作"
  symmetryRotateSpeed: number           // 旋转速度倍率
  symmetryActionElementId: string | null // 当前选中的对称性视图元素ID
  selfInverseElementId: string | null   // 自逆元素ID（2.5秒后自动清除）
}
```

**使用 Hook**：
```typescript
const { 
  currentGroup, selectElement, setCurrentView,
  cayleyActions, toggleCayleyAction,
  cayleyMultiplyType, setCayleyMultiplyType,
  cayleyShape3D, setCayleyShape3D,
  subsets, saveSubset, removeSubset,
  multiViewMode, toggleMultiViewMode,
  openFloatingView, closeFloatingView,
  symmetryShowAction, setSymmetryShowAction,
  // ...
} = useGroup()
```

### 8.1 多视图模式

通过 `toggleMultiViewMode()` 开启多视图模式后，可以打开**浮动窗口**显示任意视图：

- `openFloatingView(view)` — 打开指定视图的浮动窗口
- `closeFloatingView(id)` — 关闭指定浮动窗口
- 浮动窗口可拖拽、调整大小
- 所有窗口共享同一 `currentGroup` 状态
- 主画布和浮动窗口可同时对比不同视图的分析结果

### 8.2 子集保存与分析

选中一组元素后，可通过 `saveSubset()` 保存为子集：

- 自动检测子集是否为**子群**（乘法封闭性检验）
- 如果是子群，进一步检测是否为**正规子群**（共轭封闭性检验）
- 支持多个子集同时保存，使用 8 色区分
- `removeSubset(id)` 删除单个子集，`clearAllSubsets()` 清除全部
- 子集在画布中以不同颜色高亮显示

### 8.3 自逆元素检测

当选中单个元素并调用 `computeInverse()` 时：

- 计算该元素的逆元并添加到选中集
- 如果逆元是自身（`g⁻¹ = g`），自动标记为自逆元素
- `selfInverseElementId` 被设置，触发画布高亮
- 2.5秒后自动清除标记，恢复正常显示

### 8.4 小群预计算注册表

`SmallGroups.ts` 中维护了一个**懒加载预计算注册表**，包含所有阶<12的群（共19个）：

| 阶 | 群 |
|----|-----|
| 1 | C₁ |
| 2 | C₂ |
| 3 | C₃ |
| 4 | C₄, V₄ |
| 5 | C₅ |
| 6 | C₆, S₃ |
| 7 | C₇ |
| 8 | C₈, Z₄×Z₂, Z₂³, D₄, Q₈ |
| 9 | C₉, Z₃×Z₃ |
| 10 | C₁₀, D₅ |
| 11 | C₁₁ |

每个注册表条目 (`SmallGroupEntry`) 包含：
- `group: Group` — 群对象
- `precomputed: PrecomputedData` — 预计算数据（子群、正规子群、共轭类、中心、是否单群）

API：
- `getAllSmallGroups()` — 获取所有预注册群
- `getSmallGroup(order, index)` — 按阶和编号查找
- `getSmallGroupBySymbol(symbol)` — 按符号查找
- `getPrecomputed(group)` — 获取群的预计算数据

### 8.5 国际化 (i18n)

`src/i18n/` 目录实现完整的中英文切换：

- `I18nProvider` — 语言状态管理，默认根据浏览器语言自动选择
- `useTranslation()` — 获取翻译函数 `t(key)` 和当前语言
- `translations.ts` — 翻译字典，支持中文(zh)和英文(en)
- 语言偏好存储在 `localStorage`，刷新后保持

### 8.6 视图导出

`src/utils/export.ts` 提供三个导出函数，通过左侧面板「操作与子集」区域的按钮触发：

| 函数 | 按钮 | 适用视图 | 输出格式 | 说明 |
|------|------|---------|---------|------|
| `exportView()` | 导出 SVG / 导出 PNG | 所有视图 | `.svg` / `.png` | SVG视图导出矢量图，3D视图导出PNG截图 |
| `exportSymmetryAsGif()` | 导出 GIF | 对称性视图 | `.gif` | 录制几何体旋转动画为循环动图 |

**SVG 导出** (`serializeSvg`):
- 克隆 SVG 元素，内联所有样式表 CSS
- 通过 `XMLSerializer` 序列化 → `Blob` → 下载 `.svg`
- 保留 KaTeX 渲染内容（`foreignObject` 无法转 PNG，故直接导出 SVG）

**PNG 导出**（3D/对称性视图）:
- 通过 `canvas.toDataURL('image/png')` 同步捕获当前帧
- 解码 → `ArrayBuffer` → `Blob` → 下载 `.png`
- 依赖 `preserveDrawingBuffer: true`（已在 `Cayley3DView` 和 `SymmetryView` 的 R3F Canvas 中设置）

**GIF 导出**（对称性视图专用）:
- 使用 `gifenc` 库编码 GIF
- 流程：清除当前选中元素（复位几何体）→ 重新设置元素（触发全新动画）→ 以 20fps 录制 2 秒
- 每帧通过 `requestAnimationFrame` 同步，`drawImage` 捕获 WebGL 画布到离屏 2D canvas
- 帧数据经 `quantize` + `applyPalette` 降色后写入 GIF
- GIF 设为无限循环 (`repeat: 0`)
- 按钮在未勾选「显示元素操作」或未选中元素时禁用

---

## 9. 开发规范

### 9.1 代码规范

- 使用ESLint + TypeScript进行代码检查
- 组件采用函数式组件 + Hooks
- 遵循React 19最佳实践

### 9.2 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `Cayley3DView.tsx` |
| Hooks | camelCase + use前缀 | `useGroup.ts` |
| 类型/接口 | PascalCase | `GroupElement` |
| 常量 | UPPER_SNAKE_CASE | `COLOR_PALETTE` |
| 群论函数 | camelCase | `getSubgroups`, `getCosets` |

### 9.3 数学符号 — KaTeX

- 不再使用 Unicode 上下标作为显示，所有数学符号通过 `texify()` + `renderTex()` 渲染
- 列表项如子群元素用逗号分隔后整体传入 KaTeX
- 字符串模板（如 hint message）中仍可使用 Unicode，由 KaTeX CSS 自动匹配字体

---

## 10. 运行命令

```bash
# 开发启动
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 预览构建
npm run preview
```

---

## 11. 数学参考

### 11.1 Cayley图定义（重构后）

设G是一个群，C是任意群元素的集合。G的Cayley图是一个有向图：
- 顶点：G的元素
- 边：对每个c∈C，从g到g·c（右乘）或c·g（左乘）有有向边
- 若g·c=h 且 h·c=g，则该边为无向边

### 11.2 颜色编码

16色调色板 (`COLOR_PALETTE`)，按群元素作用添加顺序分配：
- #ff6b6b (红), #4ecdc4 (青), #ffd93d (黄), #a78bfa (紫),
- #f97316 (橙), #06b6d4 (天蓝), #84cc16 (绿), #f43f5e (玫红),
- #38bdf8 (浅蓝), #a855f7 (深紫), #14b8a6 (墨绿), #eab308 (金),
- #6366f1 (靛蓝), #ec4899 (粉), #0ea5e9 (蓝), #22c55e (翠绿)

### 11.3 关键定理速查

| 定理 | 内容 | 可视化重点 |
|------|------|-----------|
| Lagrange | \|H\| 整除 \|G\| | 陪集划分 |
| Cayley | G ≅ S(G) 子群 | 正则作用 |
| 第一同构 | G/ker ≅ im | 核与像 |
| 轨道-稳定子 | \|G\| = \|O\|·\|S\| | 群作用 |

---

## 12. 扩展计划

### 短期目标
- [x] 实现S₃对称群完整分析
- [x] Cayley图交互（边、节点拖拽）
- [x] 乘法表交互
- [x] 键盘导航
- [x] 实现循环群Zₙ
- [x] 实现二面群Dₙ
- [x] 子群列表展示与选择
- [x] 共轭类分析
- [x] 圆圈图极大循环筛选
- [x] 力导向布局
- [x] Cayley图重构：群元素作用边 + 右乘/左乘切换
- [x] 3D Cayley图按群性质形状模板 + 晶格布局
- [x] KaTeX全应用数学渲染
- [x] 对称性视图：多面体几何 + 元素操作动画 + 轴与交点标记
- [x] 对称性视图轴方向运行时计算修复（A4/A5轴修正）
- [x] 子群格(Hasse图)视图
- [x] 多视图浮动窗口模式
- [x] 子集保存与自动检测（子群/正规子群）
- [x] 自逆元素检测与高亮
- [x] 国际化 (i18n) 中英文切换
- [x] 小群预计算注册表（阶<12）
- [x] 视图导出：SVG/PNG/GIF
- [x] 欢迎页群预览：点击群记号弹出倒水滴形圆窗，随机展示 ring/generators/orders 预览

### 中期目标
- [ ] S₄/A₄/A₅ 3D Cayley图形状重新设计
- [ ] 陪集分解UI可视化
- [ ] Lagrange定理验证动画
- [ ] 群运算律验证动画（结合律、交换律）

### 长期目标
- [ ] 任意有限群的输入与计算
- [ ] 群同构检验
- [ ] 同构定理演示
- [ ] 群作用与表示论基础
- [ ] 教学教程模式

---

*文档版本: 3.2.1*
*最后更新: 2026-04-29*

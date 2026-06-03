# GroupViz 技术文档

## 1. 项目概述

GroupViz 是一个交互式群论可视化 Web 应用，帮助数学研究者和学生理解抽象代数中的群论概念。项目使用 React 19 + TypeScript 6 构建，通过动态图形展现群的结构、运算和对称性。

**核心能力**：
- 支持 11 种群类型（Cₙ, Dₙ, Sₙ, Aₙ, V₄, Q₈ + 直积群），覆盖阶 1-144
- 7 种视图模式（集合、Cayley 图 2D/3D、圆圈图、乘法表、对称性、子群格）
- 广义 Cayley 图系统：边由任意群元素定义（不限于生成元），支持左乘/右乘切换
- 17 种 3D 布局形状模板，按群性质自动分配
- 子群/正规子群/共轭类/陪集/中心的全套群论计算
- 多视图浮动窗口、会话保存、深色/浅色主题、中英文国际化

---

## 2. 技术栈

### 2.1 核心框架

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|---------|
| React | ^19.2.5 | UI 框架 | Hooks 驱动的函数式组件模式，Concurrent 模式下 useTransition 处理大量计算的过渡状态 |
| TypeScript | ~6.0.2 | 类型安全 | 严格的类型系统保障群论计算正确性 |
| Vite | ^8.0.9 | 构建工具 | 极速 HMR、ESM 原生支持、高效的 Rollup 生产构建 |
| TailwindCSS | ^4.2.2 | 样式框架 | 原子化 CSS-in-JS，配合 CSS 自定义属性实现主题切换 |

### 2.2 可视化引擎

| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | ^0.184.0 | WebGL 3D 渲染（Cayley 3D、对称性视图） |
| @react-three/fiber (R3F) | ^9.6.0 | Three.js 的 React 声明式绑定 |
| @react-three/drei | ^10.7.7 | R3F 工具组件（OrbitControls、Html 标签等） |
| D3.js | ^7.9.0 | 力导向布局算法（`forceLayout` 自定义实现） |
| Mafs | ^0.21.0 | 数学函数绘图（保留未使用） |

### 2.3 数学渲染

| 技术 | 版本 | 用途 |
|------|------|------|
| KaTeX | ^0.16.45 | 轻量级 TeX 数学公式渲染（全应用所有数学符号） |
| MathJax | ^4.1.1 | 保留依赖，当前未使用 |

### 2.4 导出

| 技术 | 版本 | 用途 |
|------|------|------|
| gifenc | ^1.0.3 | 对称性视图 GIF 动图编码（量化 + 调色板 + 帧写入） |
| html-to-image | ^1.11.13 | 保留依赖，当前使用原生 canvas.toDataURL |

### 2.5 开发工具

| 技术 | 版本 | 用途 |
|------|------|------|
| ESLint | ^9.39.4 | 代码规范检查 |
| Vitest | ^4.1.5 | 单元测试框架（与 Vite 共享配置） |
| Testing Library | ^16 | React 组件测试 |

---

## 3. 项目架构

### 3.1 目录结构

```
src/
├── core/                    # 群论核心引擎
│   ├── types.ts             # 类型定义 + 群性质检测函数
│   ├── viewBox.ts           # SVG 视口尺寸计算
│   ├── polyhedra.ts         # 多面体顶点生成器
│   ├── elementRotation.ts   # 群元素→几何旋转映射
│   ├── groups/              # 具体群实现
│   │   ├── CyclicGroup.ts   # 循环群 Cₙ
│   │   ├── DihedralGroup.ts # 二面体群 Dₙ
│   │   ├── SymmetricGroup.ts# 对称群 Sₙ
│   │   ├── AlternatingGroup.ts # 交错群 Aₙ
│   │   ├── SpecialGroup.ts  # V₄, Q₈
│   │   ├── DirectProduct.ts # 任意直积 G×H
│   │   └── SmallGroups.ts   # 小群预计算注册表
│   └── algebra/
│       ├── subgroups.ts     # 子群/正规子群/共轭类/陪集/子群格
│       └── forceLayout.ts   # 力导向布局 + 2D 布局函数
├── components/
│   ├── Canvas/              # 视图渲染组件
│   │   ├── GroupCanvas.tsx  # 主画布（SVG 2D Cayley 图）
│   │   ├── SetView.tsx      # 集合视图
│   │   ├── CycleView.tsx    # 圆圈图
│   │   ├── TableView.tsx    # 乘法表
│   │   ├── Cayley3DView.tsx # 3D Cayley 图
│   │   ├── SymmetryView.tsx # 对称性视图
│   │   ├── SubgroupLatticeView.tsx # 子群格/Hasse 图
│   │   ├── FloatingViewWindow.tsx  # 浮动窗口
│   │   └── DirectProductView.tsx   # 直积群构建画布
│   ├── Panels/              # 面板组件
│   └── WelcomePage.tsx      # 欢迎页
├── context/                 # 状态管理
│   ├── GroupContext.tsx      # 全局状态 + actions
│   ├── cayleyActions.ts     # Cayley 图 action 逻辑
│   ├── cosetActions.ts      # 陪集 action 逻辑
│   ├── directProductActions.ts # 直积 action 逻辑
│   ├── positionUtils.ts     # 节点位置初始化
│   └── useGroup.ts          # Context Hook
├── i18n/                    # 国际化
├── theme/                   # 主题
├── utils/                   # 工具函数
│   ├── texify.ts            # Unicode→TeX 转换 + KaTeX 渲染
│   ├── export.ts            # SVG/PNG/GIF 导出
│   └── groupFactory.ts      # 符号→群对象工厂
└── hooks/                   # 自定义 Hooks（预留）
```

### 3.2 组件树

```
I18nProvider
  └── ThemeProvider
      └── App
          ├── WelcomePage (showMain=false)
          └── App (showMain=true)
              └── GroupProvider
                  ├── header (标题 + ThemeToggle + LanguageToggle)
                  ├── AppContent
                  │   ├── LeftPanel (aside.left-sidebar)
                  │   │   ├── GroupCreationPanel
                  │   │   ├── ViewModePanel
                  │   │   ├── CayleySettingsPanel
                  │   │   └── OperationsPanel
                  │   ├── main.main-canvas
                  │   │   ├── GroupCanvas (或 DirectProductView)
                  │   │   │   └── SetView / CycleView / TableView / Cayley3DView
                  │   │   │       SymmetryView / SubgroupLatticeView (按 currentView 切换)
                  │   │   └── 操作历史悬浮面板
                  │   └── RightPanel (aside.right-sidebar)
                  │       ├── 群信息
                  │       ├── 元素属性
                  │       ├── 子群列表
                  │       ├── 共轭类分析
                  │       └── 子集分析
                  └── FloatingViewWindow[] (多视图浮动窗口)
```

### 3.3 状态管理架构

使用 **React Context + useState** 轻量级状态管理，无外部依赖。`GroupProvider` 持有全部状态并通过 `useGroup()` Hook 暴露。

**关键设计决策**：
- 所有状态在 `GroupContext.tsx` 集中管理（868 行），通过 `useCallback` 包裹 action 保证引用稳定性
- 派发分离到独立文件（`cayleyActions.ts`, `cosetActions.ts`, `directProductActions.ts`）保持可维护性
- `useTransition` 处理大量计算（群切换）的过渡状态，避免阻塞 UI
- `useMemo` 缓存派生数据（viewBoxSize, cosetData 等），减少重复计算

---

## 4. 群论引擎

### 4.1 核心类型系统 (`core/types.ts`)

```typescript
interface GroupElement { id: string; label: string; value: number[] }
interface Generator {
  name: string; symbol: string; color: string;
  apply(element: GroupElement): GroupElement;
  inverse: Generator
}
interface Group {
  name: string; symbol: string; order: number;
  elements: GroupElement[]; generators: Generator[];
  multiply(a, b): GroupElement; inverse(el): GroupElement;
  identity: GroupElement; isAbelian: boolean; exponent?: number
}
```

**编码约定**：
- `GroupElement.value: number[]` — 统一编码数组，不同群使用不同维度：
  - 循环群 Cₙ：`[k]` (k=0..n-1)
  - 二面体群 Dₙ：`[r, s]` (r=0..n-1, s∈{0,1})
  - 对称群 Sₙ：`[p₁, p₂, ..., pₙ]` (置换的一行表示)
  - 直积群 `G×H`：`[...g.value, ...h.value]` (值拼接) 或 `"g_id|h_id"` (pipe 分隔, 动态直积)

### 4.2 群实现

#### 循环群 `CyclicGroup.ts`
- 元素：`e₀`(单位元), `e₁`...`eₙ₋₁`
- 生成元：`1` (加 1 mod n)
- 乘法：加法模 n
- 符号：`C_{n}` (n=1..30)

#### 二面体群 `DihedralGroup.ts`
- 元素：`r⁰`(e), `r¹`...`rⁿ⁻¹`, `s`, `sr¹`...`srⁿ⁻¹`
- 生成元：`r` (旋转), `s` (反射)
- 乘法：根据 sa 标志位分 4 种情况计算
- 关系：`rⁿ = e`, `s² = e`, `srs = r⁻¹`
- 符号：`D_{n}` (n=3..12)

#### 对称群 `SymmetricGroup.ts`
- 元素：n 个元素的所有排列（n! 个）
- 生成元：S₃ 用 (12),(23); S₄ 用 (12),(234); S₅+ 用 (12),(12...n)
- 乘法：置换复合 `p∘q`
- 符号：`S_{n}` (n=2..6)

#### 交错群 `AlternatingGroup.ts`
- 元素：偶置换（n!/2 个）
- 生成元：A₃=(123); A₄=(12)(34),(234); A₅=(12)(34),(135)
- 奇偶性检测：`permutationParity()` 计算逆序数
- 符号：`A_{n}` (n=3..5)

#### 特殊群 `SpecialGroup.ts`
- Klein 四元群 `V₄`：4 阶阿贝尔群，乘法表硬编码
- 四元数群 `Q₈`：8 阶非阿贝尔群，乘法表硬编码

#### 直积群 `DirectProduct.ts`

任意两群 G×H 的笛卡尔积：

- **元素编码**：pipe 分隔 `"g_id|h_id"`，标签 `"(g_label, h_label)"`
- **乘法**：`(g₁,h₁)·(g₂,h₂) = (g₁·g₂, h₁·h₂)`
- **生成元提升**：G 和 H 的生成元分别提升到直积群，保留颜色
- **符号压缩**：`C₃\\times C₃ → C₃²`（`buildCompactSymbol()` 聚合相同因子）
- **缓存**：`multiplyCache` / `inverseCache` 为 Map，key 为 `"id1|id2"` 格式
- **性能限制**：最大阶 144（执行时检查）

#### 小群预计算注册表 `SmallGroups.ts`

阶 < 12 的所有群（含阶 12-15）懒加载预计算：

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
| 12 | C₁₂, Z₆×Z₂, D₆, A₄ |
| 13-15 | C₁₃, C₁₄, D₇, C₁₅ |

`PrecomputedData` 包含子群、正规子群、共轭类、中心、单群判定。

### 4.3 代数运算 (`core/algebra/subgroups.ts`)

| 函数 | 复杂度 | 说明 |
|------|--------|------|
| `findAllSubgroups()` | O(2^n) | 两阶段：先找循环子群，再 pair-join 闭包扩张。阶>60 时跳过 |
| `findAllNormalSubgroups()` | O(2^c) | 共轭类子集枚举，c 为共轭类数 |
| `getConjugacyClasses()` | O(n²) | 逐元素共轭遍历。阶>60 时每个元素独成类 |
| `getGroupCenter()` | O(n²) | 交换性检查。阶>60 时只返回单位元 |
| `computeCosets()` | O(n·m) | 左/右陪集计算，n=群阶，m=子群阶 |
| `computeSubgroupLattice()` | O(k²) | Hasse 图的包含关系矩阵 + 层级分配 |
| `isSimpleGroup()` | 委托 | 阿贝尔群→素数判定；非阿贝尔→`findAllNormalSubgroups` |

**性能守卫**：所有计算函数在 `order > 60` 时短路返回，防止大群组合爆炸。

---

## 5. 视图系统

### 5.1 集合视图 (`SetView.tsx`)

元素按 `⌈√n⌉` 列密堆积网格排列，使用 KaTeX 渲染每个元素标签。支持选中高亮。

### 5.2 乘法表 (`TableView.tsx`)

SVG `<text>` 渲染（因 foreignObject 性能瓶颈），支持：
- 陪集彩色矩形条纹叠加（验证 Lagrange 定理：指数 = 陪集数）
- 元素阶信息显示（计算 `elementOrder`）

### 5.3 圆圈图 (`CycleView.tsx`)

基于 `planarCycleLayout()` 的环-扇区布局：
- 单位元居中
- 每个循环子群分配一个角度扇区
- 非相邻非连接循环元素间施加斥力
- 支持「极大循环子群」筛选过滤

### 5.4 2D Cayley 图 (`GroupCanvas.tsx`)

SVG 画布，支持：

**交互**：
- 拖拽平移画布（`dragStateRef` 直接 DOM 操作，避免 re-render）
- 滚轮缩放（上限 8x）
- 节点可拖拽（`onDragEnd` 更新 `nodePositions`）

**渲染**：
- 节点：SVG circle r=28，KaTeX 通过 `foreignObject` + `dangerouslySetInnerHTML`
- 边：二次贝塞尔曲线 + SVG `<marker>` 箭头
- 无向边（二阶元素作用）：不画箭头
- 自环：椭形上方弧线
- 彩色边：按群元素作用分配 16 色调色板

**节点位置优先级**：
1. 用户拖拽保存的位置（~1px 容差）
2. `gridPositions`（grid/spherical 布局）
3. `circlePositions`（circular 兜底）

**2D 形状系统**：

| 形状 | 布局函数 | 适用群 |
|------|---------|--------|
| `circular` | 等角圆形排列 | 所有群（默认） |
| `grid` | `directProductGridLayout2D()` | 直积群 |
| `spherical` | `fibonacci2DLayout()` | 所有群 |

`directProductGridLayout2D()` 智能选择：
- 双循环因子 → `matrixGridLayout` (网格)
- 含非循环因子 → `nestedFactorLayout2D` (外环+内环)

### 5.5 3D Cayley 图 (`Cayley3DView.tsx`)

Three.js + R3F 渲染，节点不可拖拽。

**节点**：球体 (r=0.42~0.62)，`Html` 组件 + KaTeX 标签
**边**：圆柱体 + 锥形箭头，或仅圆柱体（无向边）
**自环**：环形几何体
**相机控制**：OrbitControls（旋转、缩放、平移）

#### 3D 形状模板系统

形状按**群的性质**分配，支持 17 种模板：

| 形状 | 适用群 | 布局描述 |
|------|-------|---------|
| `spherical` | 所有群（兜底） | Fibonacci 球面分布 |
| `circular` | 循环群、阿贝尔群 | XZ 平面圆周 |
| `dihedral` | 二面体群 Dₙ | 上下两个平行环 |
| `hexagon` | S₃（非阿贝尔阶6） | 平面六边形 + 中心 |
| `cube` | Q₈ | 立方体顶点 |
| `tetrahedron` | V₄ | 正四面体顶点 |
| `lattice` | 全循环因子直积群 | 晶格/网络布局 |
| `cylinder` | 2因子直积(1循环+1非循环) | 循环因子沿 Y 轴分层 |
| `torus` | 2因子直积(无循环) | 环面主/次方向 |
| `truncatedTetrahedron` | A₄ | 截角四面体 (12顶点) |
| `truncatedCube` | S₄ (默认) | 截角立方体 (24顶点) |
| `rhombicuboctahedron` | S₄ (备选) | 菱形截角八面体 (24顶点) |
| `truncatedOctahedron2/3` | S₄ (备选) | 截角八面体变体 (24顶点) |
| `truncatedIcosahedron` | A₅ (默认) | 截角二十面体 (60顶点) |
| `truncatedDodecahedron` | A₅ (备选) | 截角十二面体 (60顶点) |

**形状分配优先级**（`getDefaultLayout3D()`）：
1. 直积群 → `analyzeDPFactors()` 智能选择
2. 二面体群 → dihedral
3. 循环群 → circular
4. 阿贝尔群 → circular
5. 特定群符号匹配 → 对应多面体
6. 兜底 → spherical

**S₄/A₅ 边预设**：切换 3D 形状时，`getSpecialCayleyActions()` 返回适配该多面体对称性的 Cayley 边配置。

### 5.6 对称性视图 (`SymmetryView.tsx`)

将群元素映射为多面体上的几何对称变换（旋转/反射）。

#### 多面体-群映射

| 群 | 多面体 | 顶点数 |
|---|--------|-------|
| Cₙ | 正 n 边形 | n |
| Dₙ | 正 n 边形 | n |
| A₄ | 正四面体 | 4 |
| S₄ | 正方体 / 正八面体(切换) | 8/6 |
| A₅ | 正二十面体 / 正十二面体(切换) | 12/20 |
| V₄ | 长方体 | 4 |

#### 元素→旋转映射架构 (`elementRotation.ts`)

```
computeElementRotation(group, element) → { axis, angleRad, label }
        ↓
getElementRotationKind(symbol, cycleType) → 'vertex' | 'face' | 'edge'
        ↓
getGeometryAxes(data, symmetryType) → { vertexAxes, faceAxes, edgeAxes }
        ↓
computeGeometricRotation() → { axis, angleRad, label }
```

**轴计算**：从实际多面体顶点数据运行时计算，不依赖硬编码常量。

**轴渲染**：
- 圆柱体 (radius=0.12) + 锥体箭头 (radius=0.28)
- 红色发光材质 `#ff3333`
- 通过 `setFromUnitVectors` 将默认 Y 轴对齐到实际方向

**交点标记**：
- 顶点交点：黄色 `#ffd93d`
- 棱中点：青色 `#4ecdc4`
- 面心：绿色 `#84cc16`

**三阶段动画**（`useAnimatedRotation` Hook）：
1. 复位 (t=0→0.5)：从当前旋转回到恒等
2. 旋转 (t=0.5→1.0)：从恒等 slerp 到目标旋转
3. 静止 (t>1.0)：保持目标旋转，轴线/交点持续可见

### 5.7 子群格视图 (`SubgroupLatticeView.tsx`)

Hasse 图：

- `computeSubgroupLattice()` 找出所有子群，建立包含关系矩阵
- 传递闭包消去间接边 → Hasse 边
- 节点层级按群阶分配（`order → level` 映射）
- 正规子群高亮（`isNormal: true` → 加粗边框或特殊颜色）
- 边：连接直接包含关系的子群对

---

## 6. 布局算法 (`core/algebra/forceLayout.ts`)

### 6.1 力导向布局 (`forceLayout`)

自定义实现，不依赖 D3 的力模拟：

- **斥力**：`repC / dist²`，所有节点对之间
- **引力**：`(dist - restLen) * attC`，有边连接的节点对
- **重力**：`gravity * dist`，向画布中心
- **循环斥力**：`cycleRep / dist²`，循环内非相邻节点之间
- **冷却**：`cool = (1 - t)^1.8`，迭代次数随 n 自适应 (150-500)
- **异步变体** `forceLayoutAsync`：按 `RAF_CHUNK=15` 帧分块执行，支持进度回调

### 6.2 圆圈图布局 (`planarCycleLayout`)

按循环子群分配角度扇区：
- 单位元居中
- 共享元素（属于多个循环）分配到唯一角度位置
- 非共享元素在循环扇区内扇状排列
- 兜底：圆环排列

### 6.3 直积群网格布局 (`directProductGridLayout2D`)

双循环因子 → 矩阵网格 (`matrixGridLayout`)
含非循环因子 → 嵌套因子布局 (`nestedFactorLayout2D`)：
- G 因子在外环
- 每个外环位置放置 H 的微型内环
- 内外环半径自适应间距

### 6.4 Fibonacci 2D 布局 (`fibonacci2DLayout`)

用于 spherical 形状：
- `φ = π(3-√5)` 黄金角
- 取画布半径 38%
- 均匀散布，无重叠

### 6.5 Cayley 边计算 (`computeCayleyActionEdges`)

- 遍历所有节点 × 所有启用作用
- 根据 `multiplyType` 选择 `a·c`（右乘）或 `c·a`（左乘）
- 无向边判定：作用元素为二阶（`inverse(c) === c`）
- 按作用元素去重（不同作用可产生同对节点）
- 大群限流：`maxEdges = max(120, order * 3)`

---

## 7. 多面体系统 (`core/polyhedra.ts`)

### 7.1 顶点生成

| 函数 | 顶点数 | 构造方式 |
|------|--------|---------|
| `truncatedTetrahedron()` | 12 | (±1,±1,±3) 偶个负号 |
| `truncatedCube()` | 24 | (±1,±1,±(1+√2)) 全排列 |
| `rhombicuboctahedron()` | 24 | (±1,±(√2-1),±(√2+1)) 偶排列 |
| `truncatedOctahedron()` | 24 | (0,±1,±2) 全排列 |
| `truncatedIcosahedron()` | 60 | 3 组偶排列 + 全符号 |
| `truncatedDodecahedron()` | 60 | 3 组偶排列 + 全符号 |

### 7.2 骨架边计算 (`computeSkeletonEdges`)

- 统计所有顶点对距离分布
- 出现最多的距离 = 边长度（均匀多面体的棱长）
- 该距离±3%内的顶点对即为边
- 结果缓存（`EDGE_CACHE`）

### 7.3 面心计算

- 三角面：`computeTriangularFaces()` 检测三元组（两两边存在于边集）
- 立方体面：硬编码 6 个 (±s,0,0) 等
- 十二面体五边形面：图遍历查找 5-cycle

---

## 8. 直积群构建系统

### 8.1 三种构建模式

| 模式 | 说明 |
|------|------|
| `cayley` | 基于 Cayley 表构建直积（通用） |
| `table` | 基于乘法表构建直积 |
| `direct` | 直接群运算构建直积（最快） |

### 8.2 持久化

- 直积群符号列表 → `localStorage` (key: `groupviz-dp-groups`)
- 页面加载通过 `loadDirectProductGroupsFromStorage()` 恢复
- `createGroupFromSymbol()` 递归解析符号重建群对象

### 8.3 符号压缩

`createDirectProduct` 调用 `buildCompactSymbol()`：
- `C₃ × C₃ × C₃ → C₃³`
- 相同因子的指数合并

---

## 9. 状态管理 (Context)

### 9.1 GroupContext 状态分类

| 类别 | 状态数 | 示例 |
|------|--------|------|
| 核心 | 8 | currentGroup, currentView, selectedElements, canvasTransform |
| Cayley | 5 | caylayActions, cayleyShape2D/3D, multiplyType |
| 陪集 | 6 | cosetSubsetId, cosetType, cosetData, cosetElementMap |
| 直积 | 5 | isDirectProductMode, directProductSource/Target |
| 子集 | 2 | subsets |
| 对称性 | 3 | symmetryShowAction, symmetryRotateSpeed |
| 多视图 | 2 | multiViewMode, floatingViews |
| 其他 | 7 | operationHistory, hintMessage, hoverElement 等 |

### 9.2 Action 设计模式

所有 action 使用 `useCallback` 包裹，无外部状态库：

```typescript
const setCurrentGroup = useCallback((group: Group) => {
  startTransition(() => {
    // 1. 设置基本状态
    // 2. 初始化 Cayley 设置（生成元→初始 actions）
    // 3. 初始化节点位置（各视图预计算）
    // 4. 重置子集/陪集等
    // 5. 记录操作历史
  })
}, [...deps])
```

数据流：`组件 → useGroup().action → context state → useMemo 派生 → 组件渲染`

### 9.3 位置管理

`nodePositions: Map<viewName, Map<elementId, {x,y}>>`
- 不同视图独立存储节点位置
- 用户拖拽 → `setNodePosition()` → 更新对应视图的 Map
- 力布局 → `batchSetNodePositions()` → 批量更新

---

## 10. KaTeX 渲染系统 (`utils/texify.ts`)

### 10.1 Unicode→TeX 转换 (`texify()`)

| 输入 | 输出 |
|------|------|
| `σ₁₂` | `\sigma_{12}` |
| `ℤ` | `\mathbb{Z}` |
| `×` | `\times` |
| `₂` | `_{2}` |
| `⁻¹` | `^{-1}` |

### 10.2 渲染函数 (`renderTex()`)

调用 `katex.renderToString(math, { displayMode, throwOnError: false })`。

### 10.3 渲染位置

| 视图 | 方式 |
|------|------|
| 2D 视图节点 | SVG `foreignObject>`div` > `dangerouslySetInnerHTML` |
| 3D 节点/图例 | `<Html>` 组件 > `dangerouslySetInnerHTML` |
| 面板文本 | `dangerouslySetInnerHTML` |
| 乘法表 | SVG `<text>`（因 foreignObject 开销大） |

---

## 11. 导出系统 (`utils/export.ts`)

### 11.1 SVG 导出

- 克隆 SVG 元素 → 内联 CSS 样式表 → `XMLSerializer` 序列化 → `Blob` → 下载
- `foreignObject` 的 KaTeX 内容在 SVG 中保留（但 SVG→PNG 时替换为纯文本）

### 11.2 PNG 导出（3D/对称性视图）

- `canvas.toDataURL('image/png')` → 解码 → `Blob` → 下载
- 依赖 `preserveDrawingBuffer: true`

### 11.3 GIF 导出（对称性视图）

使用 `gifenc` 库：
1. 清除当前选中 → 重新设置元素（触发新动画）
2. 以目标 fps 捕获 WebGL canvas 帧
3. `quantize()` 降色到 256 色 → `applyPalette()` 索引化 → `GIFEncoder.writeFrame()`
4. 无限循环 (`repeat: 0`)

---

## 12. 国际化

### 12.1 架构

- `I18nProvider`：语言状态管理
- `useTranslation()`：返回 `{ lang, setLang, t(key, params?) }`
- `translations.ts`：中英文翻译字典（554 条 key）

### 12.2 特性

- 默认根据浏览器语言自动选择（`navigator.language`）
- `localStorage` 持久化（key: `groupviz-lang`）
- 模板字符串：`t('hint.groupSelected', { name, order })`
- 翻译 key 兜底：中文缺失时回退英文

---

## 13. 主题系统

### 13.1 架构

- `ThemeContext`：`{ theme: 'dark' | 'light', toggleTheme }`
- CSS 自定义属性驱动（`data-theme` 属性切换）
- `localStorage` 持久化（key: `groupviz-theme`）
- 系统偏好检测：`window.matchMedia('(prefers-color-scheme: light)')`
- 无存储时跟随系统，存储后固定

### 13.2 主题变量

`App.css` 中定义 `--text-primary`, `--canvas-bg`, `--node-fill` 等 20+ CSS 自定义属性。

---

## 14. 会话管理

### 14.1 保存

`App.tsx` 监听 `currentGroup` 和 `currentView` 变化，自动写入 `localStorage`：
```typescript
localStorage.setItem('groupviz-session', JSON.stringify({ symbol, view }))
```

### 14.2 恢复

1. 首次挂载 → `loadSession()` 从 localStorage 读取
2. 有保存 → `createGroupFromSymbol()` 重建群→`setCurrentGroup()`
3. 恢复视图 → `restoreViewRef` 暂存，group 设置后再恢复
4. 无保存 → 默认加载 S₃

### 14.3 清除

点击标题左上角 → `localStorage.removeItem(STORAGE_KEY)` → 回到欢迎页。

---

## 15. 群工厂 (`utils/groupFactory.ts`)

`createGroupFromSymbol(symbol)` 支持递归解析：

1. 精确匹配已知符号（V₄, Q₈, Z₄×Z₂ 等）
2. `\times` 分隔 → 递归创建左右因子 → `createDirectProduct`
3. 上标幂记号 `^{n}` → 递归创建基群 → n 次自乘直积
4. 下标匹配：`C_{n}`, `D_{n}`, `S_{n}`, `A_{n}`
5. Unicode 兼容：`C_3`, `D5`, `S4` 等

---

## 16. 性能优化

### 16.1 计算守卫

| 函数 | 阈值 | 行为 |
|------|------|------|
| `findAllSubgroups()` | order > 60 | 返回空数组 |
| `findAllNormalSubgroups()` | order > 60 | 返回空数组 |
| `getConjugacyClasses()` | order > 60 | 每个元素独立成类 |
| `getGroupCenter()` | order > 60 | 返回 `[identity]` |
| `computeCayleyActionEdges()` | order > 60 | `maxEdges = max(120, order*3)` |

### 16.2 缓存

| 缓存 | 类型 | Key 格式 |
|------|------|---------|
| DP multiply | `Map<string, GroupElement>` | `"id1\|id2\|id3\|id4"` |
| DP inverse | `Map<string, GroupElement>` | `"elementId"` |
| 多面体顶点 | `POLYHEDRON_CACHE` | `"shapeName:radius"` |
| 多面体边 | `EDGE_CACHE` | 顶点坐标 JSON |
| 小群预计算 | `_table` (lazy) | 阶+编号 |

### 16.3 渲染优化

- 乘法表 SVG `<text>` 而非 foreignObject（避免大表性能问题）
- 拖拽平移使用 `dragStateRef` 直接 DOM 操作
- `useTransition` 处理群切换
- `useMemo` 缓存派生数据

---

## 17. 测试系统

### 17.1 配置

`vitest.config.ts` 基于 Vite 配置，使用 `@vitejs/plugin-react`。

### 17.2 测试文件

```
src/__tests__/
├── groups.test.ts      # 群创建与运算测试
└── subgroups.test.ts   # 子群/陪集/共轭类测试
```

运行命令：`npm run test`

---

## 18. 构建配置

### 18.1 Vite (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
})
```

### 18.2 TypeScript (`tsconfig.json`)

项目引用架构：
- `tsconfig.app.json` — 应用代码配置
- `tsconfig.node.json` — Node 工具配置

### 18.3 ESLint (`eslint.config.js`)

- `@eslint/js` 推荐规则
- `typescript-eslint` 严格类型检查
- `eslint-plugin-react-hooks` Hooks 规则
- `eslint-plugin-react-refresh` HMR 兼容

---

## 19. 命令参考

```bash
npm run dev        # 开发服务器 (Vite HMR)
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
npm run lint       # ESLint 代码检查
npm run test       # Vitest 单元测试
npm run test:watch # 测试监听模式
```

---

## 20. 数据流图

```
用户操作 → LeftPanel/Canvas
              ↓
         useGroup().action (useCallback)
              ↓
         GroupContext state (useState)
              ↓
         useMemo 派生数据 (cosetData, viewBoxSize, etc.)
              ↓
         视图组件重新渲染
              ↓
         Canvas: SVG (2D) / R3F Canvas (3D)
```

直积构建流：
```
GroupCreationPanel → select source/target
       ↓
directProductActions.executeDirectProductHelper()
       ↓
createDirectProduct() → Group
       ↓
setCurrentGroup() → 加载到应用
storeDirectProductGroup() → localStorage 持久化
```

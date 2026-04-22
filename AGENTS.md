# GroupViz - 群论可视化WEB应用开发框架

## 1. 项目概述

**GroupViz** 是一个用于可视化和探索群论的交互式WEB应用。该应用旨在通过动态图形帮助数学研究者、学生理解抽象代数中的群论概念。

### 核心特性

- **群结构可视化**：子群、陪集、正规子群、商群、中心、共轭类
- **群运算可视化**：Cayley表、乘法表、运算律验证
- **定理与结论可视化**：Lagrange定理、Cayley定理、同构定理、轨道-稳定子定理
- **Cayley图可视化**：以图形方式展示有限群的生成元与元素之间的关系
- **群操作交互**：支持拖拽、缩放、动画演示群的运算过程
- **多群支持**：支持循环群、二面群、对称群等多种典型群

### 当前状态

- ✅ S₃ 对称群完整实现
- ✅ 循环群 Zₙ 实现 (n=2,3,4,5,6,8)
- ✅ 二面群 Dₙ 实现 (n=3,4,5,6)
- ✅ 三栏布局 UI（左侧工具栏、中间画布、右侧属性面板）
- ✅ 手风琴式工具面板（生成群、群操作、视图切换）
- ✅ 5种视图模式：集合视图、凯莱图、圆圈图、乘法表、3D视图
- ✅ SVG画布交互（平移、缩放、选中、框选、套选）
- ✅ 键盘导航（← → 切换元素）
- ✅ 操作历史面板（右上角悬浮）
- ✅ 提示信息框（左下角）
- ✅ 子群列表与点击选择
- ✅ 共轭类分析
- ✅ 圆圈图极大循环子群筛选
- ⏳ 陪集分析开发中

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

### 状态管理
| 技术 | 版本 | 用途 |
|------|------|------|
| Zustand | ^5.x | 轻量级状态管理 |

---

## 3. 目录结构

```
GroupViz/
├── src/
│   ├── components/          # UI组件
│   │   ├── Canvas/         # 画布视图组件
│   │   │   ├── GroupCanvas.tsx  # 主画布
│   │   │   ├── SetView.tsx     # 集合视图
│   │   │   ├── CycleView.tsx   # 圆圈图
│   │   │   └── TableView.tsx    # 乘法表
│   │   └── Panels/        # 侧边栏组件
│   │       ├── LeftPanel.tsx    # 左侧工具栏
│   │       └── RightPanel.tsx  # 右侧属性面板
│   ├── context/            # React Context
│   │   └── GroupContext.tsx  # 群状态管理
│   ├── core/               # 核心算法
│   │   ├── types.ts        # 类型定义
│   │   ├── groups/        # 群实现
│   │   │   ├── SymmetricGroup.ts   # 对称群 S₃
│   │   │   ├── CyclicGroup.ts     # 循环群 Zₙ
│   │   │   └── DihedralGroup.ts   # 二面群 Dₙ
│   │   └── algebra/        # 抽象代数算法
│   │       └── subgroups.ts    # 子群、共轭类计算
│   ├── App.tsx           # 主应用
│   ├── App.css           # 全局样式
│   └── main.tsx          # 入口
├── public/              # 静态资源
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── AGENTS.md            # 开发框架文档
└── VISUALIZATION.md      # 可视化策略文档
```
GroupViz/
├── src/
│   ├── components/          # UI组件
│   │   ├── CayleyGraph/   # Cayley图组件
│   │   ├── CayleyTable/   # Cayley乘法表
│   │   ├── Toolbar/      # 工具栏
│   │   ├── GroupSelector/ # 群选择器
│   │   └── controls/    # 可视化控制组件
│   ├── core/            # 核心算法
│   │   ├── groups/      # 群论算法实现
│   │   │   ├── SymmetricGroup.ts  # 对称群 S_n
│   │   │   └── types.ts       # 类型定义
│   │   ├── algebra/    # 抽象代数算法
│   │   │   ├── subgroups.ts     # 子群计算
│   │   │   ├── cosets.ts        # 陪集与Lagrange定理
│   │   │   ├── normalSubgroups.ts # 正规子群
│   │   │   ├── quotient.ts    # 商群
│   │   │   ├── center.ts      # 群的中心
│   │   │   ├── conjugacy.ts   # 共轭类
│   │   │   └── homomorphisms.ts # 同态与同构
│   │   └── types.ts   # 类型定义
│   ├── store/           # 状态管理
│   │   └── useGroupStore.ts
│   ├── hooks/           # 自定义Hook
│   ├── utils/           # 工具函数
│   ├── styles/         # 全局样式
│   ├── App.tsx        # 主应用
│   └── main.tsx       # 入口
├── public/             # 静态资源
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── AGENTS.md           # 开发框架文档
└── VISUALIZATION.md     # 可视化策略文档
```

---

## 4. 核心群论实现

### 4.1 有限群接口定义

```typescript
interface GroupElement {
  id: string
  label: string
  value: number[]  // 置换表示，如 [1,2,3] 表示恒等置换
}

interface Generator {
  name: string
  symbol: string
  color: string
  apply(element: GroupElement): GroupElement
  inverse: Generator
}

interface Group {
  name: string
  symbol: string      // 数学符号显示，如 "S₃"
  order: number
  elements: GroupElement[]
  generators: Generator[]
  multiply(a: GroupElement, b: GroupElement): GroupElement
  inverse(element: GroupElement): GroupElement
  identity: GroupElement
  exponent?: number   // 群的指数
  isAbelian: boolean // 是否阿贝尔群
}
```

### 4.2 已实现群

| 群 | 符号 | 阶 | 生成元 | 状态 |
|----|------|-----|--------|------|
| 对称群 S₃ | S₃ | 6 | σ₁₂, σ₂₃ | ✅ 已完成 |
| 循环群 Zₙ | Zₙ | n | 1 | ✅ 已完成 |
| 二面群 Dₙ | Dₙ | 2n | r, s | ✅ 已完成 |
| Klein四群 | V₄ | 4 | a, b | ⏳ 计划中 |

---

## 5. 群结构可视化

### 5.1 子群分析 (Subgroup Analysis)

```typescript
interface SubgroupAnalysis {
  subgroups: Subgroup[]           // 所有子群
  lattice: SubgroupLattice         // 子群格
  cyclicSubgroups: Subgroup[]      // 循环子群
  generatedSubgroup: (elements: GroupElement[]) => Subgroup // 由元素生成的子群
}

interface Subgroup {
  elements: GroupElement[]
  order: number
  index: number            // [G:H]
  generators: GroupElement[]
  isNormal: boolean
  isCyclic: boolean
}
```

**可视化功能**：
- 列出所有子群及其阶
- 显示子群格图（Hasse图）
- 高亮选中子群在乘法表中的位置
- 展示子群的生成元

### 5.2 陪集与Lagrange定理 (Cosets & Lagrange's Theorem)

```typescript
interface CosetAnalysis {
  subgroup: Subgroup
  leftCosets: GroupElement[][]    // 左陪集
  rightCosets: GroupElement[][]   // 右陪集
  index: number                   // 指数 [G:H]
  cosetTable: Map<string, GroupElement[]>  // 陪集映射
}
```

**可视化功能**：
- 展示任意子群的左右陪集分解
- 验证 |G| = |H| × [G:H]
- 对比左右陪集是否相同（检验正规性）
- 动画演示陪集划分过程

### 5.3 正规子群与商群 (Normal Subgroups & Quotient Groups)

```typescript
interface NormalSubgroupAnalysis {
  normalSubgroups: Subgroup[]
  center: Subgroup                // 中心 Z(G)
  commutatorSubgroup: Subgroup    // 换位子群 [G,G]
  derivedSeries: Subgroup[]       // 导群列
  quotientGroups: Map<Subgroup, Group>  // 商群
}
```

**可视化功能**：
- 标记所有正规子群
- 展示商群 G/N 的元素与运算
- 显示中心 Z(G) 和换位子群 [G,G]
- 展示正规群列与合成群列

### 5.4 共轭类与类方程 (Conjugacy Classes & Class Equation)

```typescript
interface ConjugacyAnalysis {
  conjugacyClasses: GroupElement[][]
  classSizes: number[]
  classEquation: string           // |G| = ∑|cl(a)|
  centerElements: GroupElement[] // 中心元素（1阶类）
  actionOnSubgroups: Subgroup[][] // 子群共轭作用
}
```

**可视化功能**：
- 展示元素的共轭类
- 显示类方程
- 可视化共轭作用
- 类方程可视化

---

## 6. 群运算可视化

### 6.1 Cayley乘法表 (Cayley Table)

```typescript
interface CayleyTable {
  group: Group
  table: GroupElement[][]     // 运算表
  identityRow: number          // 单位元行
  inverseMap: Map<GroupElement, GroupElement>  // 逆元映射
}
```

**可视化功能**：
- 交互式乘法表
- 高亮行列查看运算结果
- 标记单位元、逆元
- 验证结合律 (a·b)·c = a·(b·c)

### 6.2 运算律验证

- **结合律验证**：动画演示 (ab)c = a(bc)
- **交换律验证**：对称性分析（仅阿贝尔群）
- **分配律验证**：若有额外运算（如环）

---

## 7. 定理与结论可视化

### 7.1 Lagrange定理

```
定理：若 H 是有限群 G 的子群，则 |H| 整除 |G|，且 [G:H] = |G|/|H|
```

**可视化**：
- 选择任意子群 H
- 显示陪集划分
- 动态展示 |G| = |H| × [G:H]

### 7.2 Cayley定理

```
定理：任意群 G 同���于 S(G) 的一个子群（正则作用）
```

**可视化**：
- 展示 G 在自身上的左正则作用
- 构造并展示嵌入映射 φ: G → S(G)
- 验证同构（比较Cayley图）

### 7.3 同构定理

**第一同构定理**：
```
若 φ: G → H 是群同态，则 G/ker(φ) ≅ im(φ)
```

**第二同构定理**：
```
若 H ≤ G, N ⊲ G，则 H/(H∩N) ≅ HN/N
```

**可视化**：
- 展示同态核与像
- 商群构造动画
- 同构映射验证

### 7.4 轨道-稳定子定理 (Orbit-Stabilizer Theorem)

```
|G| = |Orb(x)| · |Stab(x)|
```

**可视化**（群作用场景）：
- S_n 在集合 {1,...,n} 上的作用
- D_n 在正n边形顶点上的作用
- 共轭作用下的轨道

### 7.5 Sylow定理（可选扩展）

- p-子群与Sylow p-子群
- Sylow定理的可视化验证

---

## 8. Cayley图算法

```typescript
interface CayleyEdge {
  from: number      // 起点元素索引
  to: number        // 终点元素索引
  generator: Generator
}

interface CayleyGraph {
  nodes: GroupElement[]
  edges: { from: number; to: number; generator: Generator }[]
  layout: Point[]    // 节点坐标
}
```

**当前布局**：
- 圆形布局：元素沿圆周均匀分布

**可视化功能**：
- 节点：群元素
- 边：生成元的作用，带箭头曲线
- 颜色编码：每个生成元对应不同颜色
- 布局：圆形布局/力导向布局

---

## 9. 状态管理

使用 React Context (`GroupContext`) 进行状态管理：

```typescript
interface GroupContextState {
  currentGroup: Group | null
  currentView: ViewMode
  selectedElements: Set<string>
  lassoMode: boolean
  lassoShape: 'circle' | 'rect'
  canvasTransform: { x: number; y: number; scale: number }
  operationHistory: string[]
  nodePositions: Map<ViewMode, Map<string, { x: number; y: number }>>
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  isSimpleGroup: boolean
  showMaximalCycles: boolean
  hintMessage: string
}
```

**使用 Hook**：
```typescript
const { 
  currentGroup, 
  selectElement, 
  setCurrentView,
  setHintMessage,
  // ...
} = useGroup()
```

---

## 10. 开发规范

### 10.1 代码规范

- 使用ESLint + TypeScript进行代码检查
- 组件采用函数式组件 + Hooks
- 遵循React 19最佳实践

### 10.2 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `CayleyGraph.tsx` |
| Hooks | camelCase + use前缀 | `useGroup.ts` |
| 类型/接口 | PascalCase | `GroupElement` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ELEMENTS` |
| 群论函数 | camelCase | `getSubgroups`, `getCosets` |

### 10.3 数学符号显示

- 使用下标：Z₆, D₄, S₃, A₄
- 使用上标：V⁴, Q⁸
- 特殊符号：∈, ⊲, ≅, →, ×

---

## 11. 运行命令

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

## 12. 数学参考

### 12.1 Cayley图定义

设G是一个群，S是G的生成元集合。G的Cayley图是一个有向图：
- 顶点：G的元素
- 边：对每个s∈S，从g到gs有条有向边

### 12.2 颜色编码规则

每个生成元分配唯一颜色：
- 生成元 a → 红色 (#ff6b6b)
- 生成元 b → 青色 (#4ecdc4)
- 生成元 c → 黄色 (#ffd93d)
- 以此类推

### 12.3 S₃ 元素参考

| 元素 | 置换 | 性质 |
|------|------|------|
| e | (1)(2)(3) | 单位元 |
| (12) | 交换1,2 | 2-换位 |
| (13) | 交换1,3 | 2-换位 |
| (23) | 交换2,3 | 2-换位 |
| (123) | 循环1→2→3 | 3-循环 |
| (132) | 循环1→3→2 | 3-循环 |

### 12.4 关键定理速查

| 定理 | 内容 | 可视化重点 |
|------|------|-----------|
| Lagrange | \|H\| 整除 \|G\| | 陪集划分 |
| Cayley | G ≅ S(G) 子群 | 正则作用 |
| 第一同构 | G/ker ≅ im | 核与像 |
| 轨道-稳定子 | \|G\| = \|O\|·\|S\| | 群作用 |

---

## 13. 扩展计划

### 短期目标
- [x] 实现S₃对称群完整分析
- [x] Cayley图交互
- [x] 乘法表交互
- [x] 键盘导航
- [x] 实现循环群Z_n
- [x] 实现二面群Dₙ
- [x] 子群列表展示与选择
- [x] 共轭类分析
- [x] 圆圈图极大循环筛选

### 中期目标
- [ ] 陪集分解可视化
- [ ] Lagrange定理验证动画
- [ ] 实现对称群S₄可视化
- [ ] 套选功能重新设计

### 长期目标
- [ ] 任意有限群的输入与计算
- [ ] 群同构检验
- [ ] 同构定理演示
- [ ] 群作用与表示论基础
- [ ] 教学教程模式

---

## 14. 已创建文件列表

```
src/core/types.ts                 - 类型定义
src/core/groups/SymmetricGroup.ts   - S₃群实现
src/core/groups/CyclicGroup.ts   - 循环群 Zₙ 实现
src/core/groups/DihedralGroup.ts - 二面群 Dₙ 实现
src/core/algebra/subgroups.ts   - 子群、共轭类算法
src/context/GroupContext.tsx   - 状态管理 (React Context)
src/components/Canvas/GroupCanvas.tsx - 主画布
src/components/Canvas/SetView.tsx - 集合视图
src/components/Canvas/CycleView.tsx - 圆圈图
src/components/Canvas/TableView.tsx - 乘法表
src/components/Panels/LeftPanel.tsx - 左侧工具栏
src/components/Panels/RightPanel.tsx - 右侧属性面板
src/App.tsx                    - 主应用
src/App.css                    - 样式
```

---

*文档版本: 2.2.0*
*最后更新: 2026-04-21*
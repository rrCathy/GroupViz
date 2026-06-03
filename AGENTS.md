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
- ✅ 循环群 Zₙ 实现 (n=1..120)
- ✅ 二面群 Dₙ 实现 (n=3..12)
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
- ✅ 深色/浅色主题切换：右上角按钮，CSS自定义属性驱动，支持系统偏好检测与记忆
- ✅ 集合视图网格布局：元素按 ⌈√n⌉ 列密堆积排列，替代原来的圆圈排列
- ✅ 会话保存与恢复：群和视图自动存入 localStorage，刷新页面后可回到上次状态
- ✅ 标题返回欢迎页：点击左上角标题回到欢迎页，同时清除已保存会话
- ✅ 画布缩放上限提升：主画布与悬浮窗最大缩放从 4x→8x，乘法表 5x→10x
- ✅ Cayley图边/节点视觉优化：边透明度 0.7→0.9、颜色α 40%→60%、描边加宽，节点添加投影与丰富色彩
- ✅ 陪集分解可视化：左/右陪集切换，选中元素显示对应陪集，显示全部陪集验证Lagrange定理，乘法表矩形条纹
- ✅ 2D Cayley图多形状布局：圆形(circular)、网格(grid)、球面投影(spherical)三种节点排列
- ✅ 直积群构建系统：支持任意两群的直积，三种构建模式（cayley/table/direct），localStorage持久化
- ✅ 欢迎页群预览弹窗：点击群记号弹出圆形预览，随机展示 ring/generators/orders 三种风格，含元素阶染色
- ✅ 欢迎页赞助链接（PayPal/Ko-fi/爱发电）+ GitHub项目链接
- ✅ 集合视图 + 圆圈图：支持2D Cayley形状选择
- ✅ 3D直积群智能形状：全循环因子→lattice、一循环→cylinder、无循环→torus，支持多因子嵌套
- ✅ 大阶群性能守卫：子群/共轭类/中心计算 cutoff 降至60，Cayley边预算同步限流
- ✅ 直积群乘法缓存：pipe分隔DP的multiply/inverse结果Map缓存
- ✅ 直积群localStorage持久化修复：新建直积群刷新后不再消失
- ✅ 2D Cayley图初始化居中修复：position init与运行时viewBox space一致
- ✅ 7种新增2D Cayley图形状：共轭类同心环、双环(旋转/反射)、陪集条带、阿基米德螺旋、螺旋、线圈、3D平面投影
- ✅ 智能默认2D形状选择（按群类型自动匹配最佳形状）
- ✅ Python FastAPI 后端：大群结构计算（子群/共轭类/中心/子群格/Cayley边/元素阶）
- ✅ 混合计算系统：小群本地TypeScript计算（≤60），大群委托后端API计算
- ✅ 3D布局引擎独立提取到 `layout3D.ts`，被2D投影布局复用
- ✅ 后端API客户端 (`api.ts` + Vite proxy 配置)
- ✅ 子群格视图大群支持：通过 `backendCache.lattice` 显示后端计算结果
- ✅ 陪集条带布局：带标签的彩色列，底部显示 `|G|=n = |H|·[G:H]` Lagrange定理验证
- ✅ 力导向面板按钮仅在非语义布局时启用（cosetStrip/concentric/dualRing/projection3D 禁用）
- ✅ 大群UI加载状态：右侧面板显示 "正在从后端计算群结构..."

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

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Python | ^3.12 | 后端计算引擎 |
| FastAPI | ^0.115+ | REST API服务 |
| Uvicorn | - | ASGI服务器 |
| Pydantic | ^2.0+ | 数据验证 |

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
│   ├── __tests__/
│   │   ├── groups.test.ts             # 群创建与运算测试
│   │   └── subgroups.test.ts          # 子群/陪集/共轭类测试
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── GroupCanvas.tsx         # 主画布 + 2D Cayley图
│   │   │   ├── SetView.tsx             # 集合视图
│   │   │   ├── CycleView.tsx           # 圆圈图
│   │   │   ├── TableView.tsx           # 乘法表
│   │   │   ├── Cayley3DView.tsx        # 3D Cayley图
│   │   │   ├── SymmetryView.tsx        # 对称性视图（多面体几何 + 元素操作动画）
│   │   │   ├── SubgroupLatticeView.tsx # 子群格(Hasse)视图
│   │   │   ├── FloatingViewWindow.tsx  # 浮动多视图窗口
│   │   │   └── DirectProductView.tsx   # 直积群可视化画布（1299行）
│   │   ├── Panels/
│   │   │   ├── LeftPanel.tsx           # 左侧工具栏（集成各子面板）
│   │   │   ├── RightPanel.tsx          # 右侧属性面板
│   │   │   ├── AccordionSection.tsx    # 手风琴折叠面板组件
│   │   │   ├── CayleySettingsPanel.tsx # 凯莱图设置面板
│   │   │   ├── constants.ts            # 面板配置常量（群类型、视图模式、阶分组）
│   │   │   ├── DirectProductPanel.tsx  # 直积群构建面板
│   │   │   ├── GroupCreationPanel.tsx  # 群创建面板
│   │   │   ├── OperationsPanel.tsx     # 操作与子集面板
│   │   │   └── ViewModePanel.tsx       # 视图切换面板
│   │   ├── Tex.tsx                     # KaTeX渲染组件
│   │   └── WelcomePage.tsx             # 欢迎页（浮动数学符号动画 + 群记号倒水滴预览弹窗）
│   ├── core/
│   │   ├── types.ts               # 核心类型定义 + 3D形状选择函数（278行）
│   │   ├── groups/
│   │   │   ├── SymmetricGroup.ts   # 对称群 Sₙ
│   │   │   ├── CyclicGroup.ts     # 循环群 Zₙ
│   │   │   ├── DihedralGroup.ts   # 二面群 Dₙ
│   │   │   ├── AlternatingGroup.ts # 交错群 Aₙ
│   │   │   ├── SpecialGroup.ts    # V₄, Q₈
│   │   │   ├── SmallGroups.ts     # 直积群 + 小群预计算注册表
│   │   │   └── DirectProduct.ts   # 任意两群直积 G×H
│   │   ├── algebra/
│   │   │   ├── subgroups.ts       # 子群、正规子群、共轭类、陪集、子群格
│   │   │   ├── forceLayout.ts     # 力导向布局 + 所有2D布局函数 + Cayley边计算
│   │   │   └── layout3D.ts        # 3D布局引擎（全形状模板的节点位置计算）
│   │   ├── polyhedra.ts           # 多面体顶点生成（截角四面体/立方体/二十面体等）
│   │   ├── elementRotation.ts     # 群元素→几何旋转变换映射
│   │   └── viewBox.ts             # SVG视口尺寸计算
│   ├── context/
│   │   ├── GroupContext.tsx        # 全局状态管理 + actions（+940行）
│   │   ├── useGroup.ts            # Context Hook
│   │   ├── cayleyActions.ts       # 凯莱图action逻辑（116行）
│   │   ├── cosetActions.ts        # 陪集action逻辑（84行）
│   │   ├── directProductActions.ts # 直积action逻辑（54行）
│   │   └── positionUtils.ts       # 节点位置初始化（109行）
│   ├── utils/
│   │   ├── texify.ts              # Unicode→TeX转换 + KaTeX渲染
│   │   ├── export.ts              # 视图导出（SVG/PNG/GIF）
│   │   ├── api.ts                 # FastAPI后端API客户端
│   │   ├── hybridCompute.ts       # 混合计算层（小群本地/大群后端）
│   │   └── groupFactory.ts        # 群符号→群对象工厂（会话恢复用）
│   ├── theme/
│   │   ├── ThemeContext.tsx        # 深色/浅色主题Provider + localStorage持久化
│   │   └── useTheme.ts            # useTheme Hook
│   ├── i18n/
│   │   ├── I18nContext.tsx        # 国际化Provider
│   │   ├── useTranslation.ts      # useTranslation Hook
│   │   └── translations.ts        # 翻译字典（中文/English）
│   ├── types/
│   │   └── gifenc.d.ts            # gifenc库类型声明
│   ├── hooks/                      # 自定义Hooks（当前为空）
│   ├── assets/
│   │   ├── hero.png                # 欢迎页背景图片
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── App.tsx                    # 主应用（欢迎页 + 三栏布局 + 键盘事件）
│   ├── App.css                    # 全局样式
│   ├── index.css                  # 基础全局样式
│   └── main.tsx                   # 入口（React Root + KaTeX CSS导入）
├── public/
├── backend/
│   ├── main.py                    # FastAPI入口 + REST路由
│   ├── group.py                   # Python群实现（Cayley表预计算）
│   ├── algebra.py                 # 代数计算（子群/共轭类/陪集/子群格）
│   ├── factory.py                 # 符号→群对象工厂
│   ├── schemas.py                 # Pydantic请求/响应模型
│   ├── requirements.txt           # Python依赖
│   └── test_main.py               # 后端API测试
├── index.html
├── package.json
├── vite.config.ts                  # Vite配置（含/api→后端代理）
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
| Z₆×Z₂ | Z₆×Z₂ | 12 | a, b | ✅ |
| G×H (任意) | G×H | \|G\|·\|H\| | g₁,...,h₁,... | ✅ |

---

## 5. Cayley图系统（重构后）

### 5.1 核心概念

GroupViz实现了**广义Cayley图**（Generalized Cayley Graph），其中边可以由任意群元素定义，而不仅限于生成元：

> **标准Cayley图**：边标签取自群的生成集S ⊆ G
> **广义Cayley图**（本项目使用）：边标签取自群G的任意元素子集

这种广义化允许用户探索不同群元素子集如何定义连通模式。当仅启用生成元时，结果与标准Cayley图一致。

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

形状按**群的性质**分配，而非硬编码群符号。支持17种形状模板：

| 形状 | 适用群性质 | 布局描述 |
|------|-----------|---------|
| `spherical` | 所有群（兜底） | Fibonacci球面分布 |
| `circular` | 循环群Zₙ、阿贝尔群 | xz平面圆环 |
| `dihedral` | 二面体群Dₙ | 上下两平行环 |
| `hexagon` | S₃（非阿贝尔阶6） | 平面六边形 |
| `cube` | Q₈（非阿贝尔阶8） | 立方体顶点 + 多余球面散布 |
| `tetrahedron` | V₄（阿贝尔阶4） | 正四面体顶点 + 多余球面散布 |
| `lattice` | 全循环因子直积群（兜底） | 晶格/网络布局，因子按贪心算法分配到XYZ轴组 |
| `cylinder` | 2因子直积群，恰好一个循环因子 | 循环因子沿Y轴分层，非循环因子在每层排列成环 |
| `torus` | 2因子直积群，无循环因子 | 两个非循环因子分别在环面主/次方向排列 |
| `truncatedTetrahedron` | A₄（阶12） | 截角四面体顶点分布 |
| `truncatedCube` | S₄（阶24，默认） | 截角立方体顶点分布 |
| `truncatedOctahedron2` | S₄（阶24，备选） | 截角八面体变体2 |
| `truncatedOctahedron3` | S₄（阶24，备选） | 截角八面体变体3 |
| `rhombicuboctahedron` | S₄（阶24，备选） | 菱形截角八面体顶点分布 |
| `truncatedIcosahedron` | A₅（阶60，默认） | 截角二十面体顶点分布 |
| `truncatedDodecahedron` | A₅（阶60，备选） | 截角十二面体顶点分布 |
| `cuboctahedron` | 通用 | 截角立方八面体（球面+立方混合）（类型中定义但未在UI中暴露） |

> S₄/A₄/A₅ 群在切换3D形状时会自动切换预设的Cayley边配置，以适配不同多面体对称性。
>
> 直积群默认3D形状由 `analyzeDPFactors(group)` 智能选择：全循环因子→lattice、2因子+1循环→cylinder、2因子+无循环→torus、多因子→lattice兜底。

**检测函数**（types.ts）：
- `isGroupCyclic(group)` — 符号以C开头
- `isGroupDihedral(group)` — 符号以D开头
- `isGroupDirectProduct(group)` — 符号含\times/^{}/元素ID含|
- `analyzeDPFactors(group)` — 返回 `{totalFactors, cyclicCount, allCyclic, symbolParts, isPipeProduct}`，解析直积群符号判断各因子循环性（`C` 和 `Z_` 前缀均视为循环因子）
- `getDefaultLayout3D(group)` — 按优先级：DP群 → 二面群 → 循环群 → 阿贝尔群 → 特定群 → spherical

### 5.6 凯莱图设置面板 (LeftPanel)

在 `cayley` 或 `3d` 视图时显示：

- **乘法类型**：右乘 `a·c` / 左乘 `c·a` 切换
- **3D图形状**：下拉选择（仅3D视图）
- **力导向布局**：按钮（仅2D视图）
- **添加所有元素 / 清除所有**：批量管理群元素作用
- **群元素作用列表**：复选框 + 颜色条 + KaTeX标签
- **2D图形状**：下拉选择（仅2D Cayley视图），支持圆形(circular)、网格(grid)、球面投影(spherical)、共轭类同心环(concentric)、双环(dualRing)、陪集条带(cosetStrip)、阿基米德螺旋(archimedean)、螺旋(spiral)、线圈(coil)、3D平面投影(projection3D)
- **力导向布局**：按钮，语义布局(cosetStrip/concentric/dualRing/projection3D)时禁用

### 5.7 2D Cayley图形状系统

2D Cayley图支持十种节点布局形状，通过 LeftPanel 下拉菜单切换：

| 形状 | 布局函数 | 适用群 | 描述 |
|------|---------|--------|------|
| `circular` | 圆形排列 | 所有群（默认） | 节点均匀分布在圆周上 |
| `grid` | `directProductGridLayout2D()` | 直积群 | m×n网格布局，支持行列交换优化 |
| `spherical` | `fibonacci2DLayout()` | 所有群 | Fibonacci球面分布的2D投影，均匀散布 |
| `concentric` | `concentricLayout()` | 所有群 | 按共轭类分层同心环排列，单位元居中 |
| `dualRing` | `dualRingLayout()` | 二面体群Dₙ | 旋转元在外环，反射元在内环 |
| `cosetStrip` | `cosetStripLayout()` | 所有群 | 陪集列排布，每列彩色背景，底部验证Lagrange定理 |
| `archimedean` | `archimedeanSpiralLayout()` | 所有群 | 阿基米德螺旋，按元素阶排序 |
| `spiral` | `spiralLayout()` | 循环群Cₙ | 多圈螺旋，仅末尾→起始边交叉形成"玫瑰"图案 |
| `coil` | `coilLayout()` | 所有群 | 变距螺旋，角密度随半径增大（α=0.7），仅收尾边交叉 |
| `projection3D` | `projection3DLayout()` | S₃/S₄/S₅/A₄/A₅/Q₈ | 3D多面体顶点等轴投影到2D平面 |

**布局函数（forceLayout.ts）：**

| 函数 | 说明 |
|------|------|
| `fibonacci2DLayout(group, w, h)` | Fibonacci螺旋2D布局，φ=π(3-√5)，38%画布半径 |
| `directProductGridLayout2D(group, w, h)` | 直积群网格布局，因子均为循环群时 → matrix grid，否则 → nested factor layout |
| `nestedFactorLayout2D(group, w, h)` | 非循环直积群布局：外层环（G因子）+ 内层环（H元素）|
| `matrixGridLayout(rows, cols, w, h)` | 标准矩阵网格，行列自动交换优化 |
| `parseProductFactors(group)` | 解析直积群因子 → `{colSize, rowSize, getCol, getRow}` |
| `cayleyRingKeys(keys)` | Cayley环键排序（S3 Hamiltonian循环 / Z2ᵏ Gray码）|
| `concentricLayout(group, w, h)` | 共轭类同心环，类按大小升序由内向外排列 |
| `dualRingLayout(group, w, h)` | 内外双环，旋转元外环、反射元内环 |
| `cosetStripLayout(group, w, h, ...)` | 陪集条带布局，返回 `CosetStripData`（含 strips 数组） |
| `archimedeanSpiralLayout(group, w, h)` | 阿基米德螺旋，turns=n/8，按元素阶排序 |
| `spiralLayout(group, w, h)` | 多圈螺旋（turns=n/5），按元素索引顺序 |
| `coilLayout(group, w, h)` | 变距螺旋，α=0.7，内疏外密 |
| `projection3DLayout(group, w, h)` | 调用 `layout3D.ts` 的 `compute3DPositions` 做等轴投影 |

**类型定义（types.ts）：**
```typescript
type CayleyShape2D = 'grid' | 'circular' | 'spherical' | 'concentric' | 'dualRing' | 'cosetStrip' | 'archimedean' | 'spiral' | 'coil' | 'projection3D'

// 按视图分配可用形状
function getAvailableShapesForView(group, view) → CayleyShape2D[]
// 按群性质判断默认形状（智能选择）
function getDefaultShape2D(group) → CayleyShape2D
// 检测因子键是否为循环序列
function isCyclicFactorKeys(keys) → boolean
```

**智能默认形状选择**（`getDefaultShape2D()`）：
| 群类型 | 默认形状 |
|--------|---------|
| 直积群 | `grid` |
| S₃/S₄/S₅, A₄/A₅, Q₈ | `projection3D` |
| 循环群 Cₙ | `spiral` |
| 二面体群 Dₙ | `dualRing` |
| 大阶非循环群 (order > 30) | `archimedean` |
| 其余 | `circular` |

**节点位置优先级**（GroupCanvas.tsx）：
1. 用户拖拽保存的位置（~1px容差）
2. `gridPositions`（grid/spherical/新形状布局）
3. `circlePositions`（circular兜底）

**初始化居中修复**：`initializeNodePositions` 与运行时 `viewBoxSize` 使用相同的 force 标志（默认false），避免 order≥38 的群因 viewBox 空间不匹配导致节点偏移到画面外。

### 5.8 直积群构建系统

在左侧工具面板「直积群」区域，支持任意两群的直积 G×H：

**三种构建模式：**
| 模式 | 说明 |
|------|------|
| `cayley` | 基于Cayley表构建直积，支持任意群 |
| `table` | 基于乘法表构建直积 |
| `direct` | 直接群运算构建直积，最快 |

**功能按钮：**
- **进入/退出模式**：切换直积群面板显示
- **源群(G) / 目标群(H)选择器**：从现有群列表选择，或「导入当前群」
- **创建按钮**：执行直积运算，限制最大阶144
- **存储当前群**：将当前加载的群加入直积群列表
- **导入全部**：批量导入 V₄, Z₄×Z₂, Z₂³, Z₃×Z₃, Z₆×Z₂
- **直积群列表**：管理保存的直积群（点击加载 / 删除）

**持久化：** 直积群符号列表自动保存到 `localStorage`（key: `groupviz-dp-groups`），页面刷新后自动恢复。

**核心实现（DirectProduct.ts）：**
- `createDirectProduct(groupA, groupB)` — 创建任意 G×H 直积
- Pipe分隔元素ID：`"a_id|b_id"`
- 元素标签：`"(a_label, b_label)"` 
- 紧凑符号构建：如 C₃×C₃ → `C_{3}^{2}`

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
| 3D lattice分组不均衡 | 等大因子全部分到X轴 | `<` 改为 `<=` + id tie-breaker，等积时轮询分配 |
| 循环因子键排序 | C_n因子n≥10时字典序错乱 | `ringOrder`/`cayleyRingKeys`/tokenMaps 全部改用数字感知排序 |
| 大阶群共轭类无守卫 | getConjugacyClasses无order限制 | 添加 order>60 守卫，返回每个元素单独成类 |
| 子群计算守卫过低 | findAllSubgroups 100→60 | 与 DP 群最大阶144同步，避免 pair-join 闭包组合爆炸 |
| DP乘法无缓存 | 每次multiply都split+递归 | 添加 `multiplyCache`/`inverseCache` Map |
| DP群3D可选形状错误 | `isGroupCyclic`误匹配`Z_{`前缀 | 还原isGroupCyclic→只匹配C，DP分支提至循环/二面之前优先判断 |
| DP群默认3D形状 | 所有DP群统一lattice | 新增 `analyzeDPFactors()`：全循环→lattice，一循环→cylinder，无循环→torus |
| 2D Cayley图初始化居中 | force=true写死，与运行时viewBox不一致 | 全部改为 `force=false`，force切换时重新计算位置 |

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
  nodePositions: NodePositionsMap    // Map<string, Map<string, { x: number; y: number }>>
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  isSimpleGroup: boolean
  showMaximalCycles: boolean
  hintMessage: string
  forceShowLargeGroupViews: Set<ViewMode>
  viewBoxSize: ViewBoxSize
  isPending: boolean                    // useTransition 过渡状态
  cayleyMultiplyType: MultiplyType      // 'right' | 'left'
  cayleyActions: GroupAction[]          // 已启用的群元素作用
  cayleyShape3D: Layout3D               // 当前3D形状
  cayleyAvailableShapes3D: Layout3D[]   // 可选3D形状
  cayleyShape2D: CayleyShape2D           // 当前2D Cayley图形状
  cayleyAvailableShapes2D: CayleyShape2D[] // 可选2D形状
  subsets: Subset[]                     // 保存的子集分析
  multiViewMode: boolean                // 多视图模式开关
  floatingViews: FloatingView[]         // 打开的浮动视图窗口
  symmetryShowAction: boolean           // 是否启用"显示元素操作"
  symmetryRotateSpeed: number           // 旋转速度倍率
  symmetryActionElementId: string | null // 当前选中的对称性视图元素ID
  selfInverseElementId: string | null   // 自逆元素ID（2.5秒后自动清除）
  cosetSubsetId: string | null          // 陪集展示的子群ID
  cosetType: 'left' | 'right'           // 左/右陪集
  showAllCosets: boolean                // 显示全部陪集
  cosetData: CosetInfo | null
  cosetElementMap: Map<string, number>
  cosetHighlightSet: Set<number>
  cosetColors: string[]
  isDirectProductMode: boolean          // 直积群构建模式
  directProductSource: Group | null
  directProductTarget: Group | null
  directProductCreationMode: 'cayley' | 'table' | 'direct'
  directProductGroups: Group[]          // 已保存的直积群
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

### 8.7 陪集可视化

在画布和乘法表中显示陪集分解，验证 Lagrange 定理：

**状态变量（GroupContext）：**
- `cosetSubsetId`：当前用于陪集展示的子群子集 ID（null 表示未激活）
- `cosetType`：左陪集 `'left'` 或右陪集 `'right'`
- `showAllCosets`：是否显示全部陪集（false 时仅高亮选中元素所属陪集）
- `cosetData`：Memorized `CosetInfo`，包含陪集索引、颜色、计数
- `cosetElementMap`：元素 ID → 陪集编号映射
- `cosetHighlightSet`：需要高亮的陪集编号集合
- `cosetColors`：16 色彩色陪集调色盘

**操作（LeftPanel）：**
- `showCosetsForSubset(subsetId)`：选中子集 → 显示陪集分解
- `hideCosets()`：关闭陪集显示
- `setCosetType(type)`：切换左/右陪集
- `toggleShowAllCosets()`：切换显示全部陪集 / 仅选中

**乘法表可视化：** 同一陪集内的单元格以彩色矩形条纹高亮标记。

### 8.8 欢迎页群预览弹窗

点击欢迎页群记号（如 S₃, Dₙ, V₄ 等）弹出圆形预览弹窗，随机展示三种风格：

| 风格 | 内容 |
|------|------|
| `ring` | 元素环形排列 + 群符号 + 阶数 |
| `generators` | 标识元素（黄色中心点）+ 生成元箭头（彩色有向线段） |
| `orders` | 元素按阶染色（共9种阶颜色映射）+ 群符号叠加 |

**技术实现（WelcomePage.tsx）：**
- `WelcomePreviewPopup` 组件：210px 固定 SVG 预览 + 倒水滴形指针
- `randomStyle()` 随机选择预览风格
- `computeElementOrder()` 计算每个元素的阶
- `ORDER_COLORS` 映射：1(黄), 2(红), 3(青), 4(紫), 5(橙), 6(绿), 8(蓝), 10(金), 12(粉)
- `createGroupBySymbol()` 工厂函数将 TeX 记号映射到群对象
- 弹窗入场动画：`previewPopupIn` 弹性缓出（0.22s）
- 再次点击同一记号或点击背景关闭弹窗

### 8.9 赞助与项目链接

**欢迎页右上角：**
- GitHub 项目链接按钮（靛蓝色图标），链接到 `https://github.com/rrCathy/GroupViz`

**欢迎页右下角：**
- 赞助按钮（爱心图标），点击展开下拉菜单，含三条赞助渠道：
  - **PayPal**：`https://paypal.me/rrCathy314`
  - **Ko-fi**：`https://ko-fi.com/rrcathy314`
  - **爱发电 (Afdian)**：`https://afdian.com/a/rrCathy314`
- 各链接以彩色左边框标识

### 8.10 群工厂与会话恢复

`src/utils/groupFactory.ts` 提供从符号字符串重建群对象的能力：

- **`createGroupFromSymbol(symbol)`** — 解析 TeX/Unicode 符号 → `Group | null`
- 支持递归直积：识别 `\times` 或 `×` 分隔符
- 支持幂记号：`C_{3}^{2}`、`Z_{2}^{3}` 等
- 支持范围：C₁–C₃₀, D₃–D₁₂, S₂–S₆, A₃–A₅
- 用于：会话恢复、直积群持久化

**便捷工厂函数：**
- `createS3()` — 对称群 S₃ 快速创建
- `createZ6xZ2()` — Z₆×Z₂ 直积群（阶12）

> 注：`createGroupFromSymbol` 支持 S₂–S₆，但 UI 群创建面板的下拉菜单上限为 S₅（阶120），欢迎页「按阶浏览」区域也仅显示 S₃–S₅。S₆ 仅通过工厂直接创建或会话恢复可用。

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

# 后端启动（需先安装Python依赖）
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 11. 数学参考

### 11.1 Cayley图定义（重构后）

**标准Cayley图**：设G是一个群，S是G的生成集。G关于S的Cayley图是一个有向图：
- 顶点：G的元素
- 边：对每个s∈S，从g到g·s（右乘）或s·g（左乘）有有向边
- 若g·s=h 且 h·s=g，则该边为无向边

**广义Cayley图**（GroupViz使用）：设G是一个群，C是任意群元素的集合（不限于生成集）。G关于C的广义Cayley图定义同上，但C可以是G的任意子集。

> 注：当C是G的生成集时，广义Cayley图退化为标准Cayley图。广义化允许用户探索不同元素子集定义的连通模式。

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
- [x] 深色/浅色主题切换
- [x] 集合视图网格布局
- [x] 会话保存与恢复
- [x] 陪集分解可视化
- [x] 2D Cayley图多形状布局（circular/grid/spherical）
- [x] 直积群构建系统（任意两群直积 + localStorage持久化）
- [x] 欢迎页赞助链接 + GitHub项目链接
- [x] 3D Cayley图直积群智能形状选择（全循环→lattice/单循环→cylinder/无循环→torus）
- [x] 大阶群性能守卫（子群/共轭类/中心计算cutoff降至60，DP乘法缓存）
- [x] 直积群localStorage持久化修复
- [x] 7种新增2D Cayley图形状：共轭类同心环、双环(旋转/反射)、陪集条带、阿基米德螺旋、螺旋、线圈、3D平面投影
- [x] 智能默认2D形状选择（按群类型自动匹配最佳形状）
- [x] Python FastAPI 后端：大群结构计算（子群/共轭类/中心/子群格/Cayley边/元素阶）
- [x] 混合计算系统：小群本地TypeScript计算（≤60），大群委托后端API计算
- [x] 3D布局引擎独立提取到 `layout3D.ts`，被2D投影布局复用
- [x] 后端API客户端 (`api.ts` + Vite proxy 配置)
- [x] 子群格视图大群支持：通过 `backendCache.lattice` 显示后端计算结果
- [x] 陪集条带布局：带标签的彩色列，底部显示 `|G|=n = |H|·[G:H]` Lagrange定理验证
- [x] 力导向面板按钮仅在非语义布局时启用（cosetStrip/concentric/dualRing/projection3D 禁用）
- [x] 大群UI加载状态：右侧面板显示 "正在从后端计算群结构..."

### 中期目标

### 长期目标
- [ ] 任意有限群的输入与计算
- [ ] 群同构检验
- [ ] 同构定理演示
- [ ] 群作用与表示论基础
- [ ] 教学教程模式
- [ ] 任意有限群的输入与计算
- [ ] 群同构检验
- [ ] 同构定理演示
- [ ] 群作用与表示论基础
- [ ] 教学教程模式

---

*文档版本: 1.2.5*
*最后更新: 2026-06-03*

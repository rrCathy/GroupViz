# GroupViz · 群论可视化交互工具
<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

**GroupViz** 是一个用于可视化与探索有限群论的交互式Web应用。提供 9 种视图模式、支持多种典型群族与群构建系统（直积/半直积/自同构群/商群/同态），所有数学公式均通过 KaTeX 渲染。
<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TS 6">
  <img src="https://img.shields.io/badge/Three.js-0.184-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/KaTeX-0.16-green" alt="KaTeX">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT">
</p>

---

## 在线使用

`https://rrcathy.github.io/GroupViz/`

## ✨ 功能特性
### 群结构可视化
- **子群** — 计算、列出并高亮所有循环子群
- **共轭类** — 自动划分共轭类
- **中心** — 识别中心元素
- **子群格（Hasse 图）** — 节点按层级排列，正规子群高亮
- **陪集分解** — 左/右陪集彩色编码，陪集条带视图中验证 Lagrange 定理
- **单群检测** — 自动判断是否为单群
### 9 种视图模式
| 视图 | 说明 |
|------|------|
| **集合视图** | 群元素网格排列展示 |
| **凯莱图 (2D)** | SVG 渲染，10 种形状布局，节点可拖拽，边可配置 |
| **圆圈图** | 循环子群可视化，支持极大循环筛选 |
| **凯莱表** | 交互式乘法表，行列高亮，陪集条纹 |
| **凯莱图 (3D)** | Three.js 渲染，17 种形状模板，轨道控制 |
| **对称性视图** | 多面体几何 + 元素操作动画 + 旋转轴与交点标记 |
| **子群格图** | Hasse 图，按层级布局 |
| **同态视图** | 源/目标双凯莱图 + 映射边，核/像高亮，第一同构定理动画证明 |
| **陪集条带** | 陪集按列排布，`|G| = |H|·[G:H]` Lagrange 验证 |

### 群构建系统
| 构建 | 说明 |
|------|------|
| 直积 G×H | 交互式构建任意两群直积（最多 144），3 种模式（cayley/table/direct），紧凑符号（C₃×C₃→C₃²） |
| 半直积 N⋊_φ H | φ 映射 UI、Aut(N) 自动计算、5 个预设（Z₃⋊Z₂≅S₃、Z₄⋊Z₂≅D₄、Z₅⋊Z₂≅D₅、Z₇⋊Z₂ Frobenius、V₄⋊Z₃≅A₄）、4 步构建动画、rewiring 布局 |
| 自同构群 Aut(G) | 自动枚举全部自同构、Aut 群群律、选中元素查看重布线凯莱图与映射 |
| 商群 G/N | 从正规子群构建，陪集元素，≅ 同构徽章 |
| 同态映射 | 源→目标映射验证、核/像、单射/满射/同构性质分析、第一同构定理动画 |

### 支持的群
| 群族 | 符号 | 阶 | 状态 |
|-------|--------|-------|--------|
| 循环群 | Zₙ (n=1..120) | n | ✅ |
| 二面体群 | Dₙ (n=3..12) | 2n | ✅ |
| 对称群 | S₃, S₄, S₅ | 6, 24, 120 | ✅ |
| 交错群 | A₃, A₄, A₅ | 3, 12, 60 | ✅ |
| Klein 四群 | V₄ | 4 | ✅ |
| 四元数群 | Q₈ | 8 | ✅ |
| 直积群 | Z₄×Z₂, Z₂³, Z₃×Z₄, Z₆×Z₂ 及任意 G×H | ≤144 | ✅ |
| 半直积 | N⋊_φ H（如 Z₃⋊Z₂ ≅ S₃） | ≤144 | ✅ |
| 自同构群 | Aut(G)（如 Aut(Z₈) ≅ C₂） | — | ✅ |
| 商群 | G/N | \|G\|/\|N\| | ✅ |

### 核心亮点
- **基于群元素作用的凯莱图** — 边由任意群元素定义（广义 Cayley 图），支持右乘/左乘切换
- **17 种 3D 形状模板** — 按群性质自动分配（S₄、A₄、A₅ 使用截角多面体）；直积群智能形状选择（lattice/cylinder/torus）
- **10 种 2D 凯莱图形状** — circular/grid/spherical/concentric/dualRing/archimedean/spiral/coil/projection3D/rewiring（半直积专属），按群类型智能选择默认形状
- **多视图浮动窗口** — 同时打开多个视图进行对比分析
- **子集分析** — 保存元素选择集；通过封闭性检验自动检测子群/正规子群
- **自逆元素检测** — 高亮 g⁻¹ = g 的元素
- **会话保存与恢复** — 自动存入 localStorage，刷新后恢复（含商群/自同构/半直积重建）
- **深色/浅色主题** — CSS自定义属性，支持系统偏好检测
- **视图导出** — SVG（2D 视图）、PNG（3D 视图）、GIF（对称性动画）+ 批量导出 CLI（`npm run export`）
- **国际化** — 中文/English UI，localStorage 持久化
- **混合计算** — 小群本地 TS 计算（≤60），大群自动切换 FastAPI 后端（>60）
- **小群注册表** — 阶 1–15 全部 27 个群，预计算子群/共轭类/中心数据
- **性能守卫** — 子群/共轭类 cutoff 60；Cayley 边限流；自同构枚举组合 >30000 放弃
- **测试体系** — 21 个测试文件 427 tests（vitest）
---

## 🚀 快速开始
### 环境要求
- Node.js ≥ 18
- npm ≥ 9

### 安装运行

```bash
git clone https://github.com/rrCathy/GroupViz.git
cd groupviz
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`
### 生产构建

```bash
npm run build
npm run preview
```

---

## 📖 使用指南

1. 在左侧面板**选择群**（循环群、二面体群、对称群、交错群或特殊群），或用构建系统创建直积/半直积/Aut(G)/商群
2. 在视图面板**切换 9 种视图**
3. **画布交互** — 平移（拖拽背景）、缩放（滚轮）、选中（点击）、框选（Ctrl+拖拽）
4. **探索凯莱图** — 启用/禁用元素作用边，切换右乘/左乘，选择 2D/3D 形状，运行力导向布局
5. **群论探索** — 保存子集检测子群、显示陪集、创建商群；构建同态并运行第一同构定理动画
6. **键盘导航** — ←/→ 键切换元素
7. **打开浮动视图** — 开启多视图模式，并排对比不同表示

> 详细技术文档见 `docs/` 目录：群实现（GROUPS.md）、Cayley 图系统（CAYLEY.md）、视图（VIEWS.md）、状态管理（STATE.md）、后端（BACKEND.md）、UI（UI.md）、测试（TESTING.md）。

---

## 🛠 技术栈

| 类别 | 技术 |
|----------|-----------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite |
| 样式 | CSS 自定义属性 + App.css |
| 3D 渲染 | Three.js + React Three Fiber |
| 数学渲染 | KaTeX |
| 状态管理 | 模块化 React Context（9 个 Provider） |
| 后端 | Python FastAPI（大群混合计算） |
| 国际化 | 自定义 React Context |
| 测试 | Vitest |

---

## 📂 项目结构

```
src/
├── __tests__/            # 21 个测试文件（427 tests）
├── components/
│   ├── Canvas/           # 视图组件（Set/Cayley/Cycle/Table/3D/Symmetry/SubgroupLattice/
│   │                    #   Homomorphism/CosetStrip/DirectProduct/SemidirectProduct/多视图窗口）
│   ├── Panels/           # 左侧面板（Group/View/Operations/Homomorphism/SemidirectProduct）
│   │                    #   + RightPanel + TabBar + constants
│   ├── Tex.tsx           # KaTeX React 组件
│   └── WelcomePage.tsx   # 欢迎页（群记号预览弹窗、赞助链接）
├── core/
│   ├── types.ts          # 类型定义、色板、形状检测函数
│   ├── groups/           # 群实现（循环/二面/对称/交错/特殊/直积/半直积/小群注册表）
│   ├── algebra/          # 子群、陪集、同态、自同构、Cayley 边、布局算法
│   ├── polyhedra.ts      # 多面体顶点生成
│   ├── elementRotation.ts # 群元素 → 3D 几何旋转变换
│   └── viewBox.ts        # SVG 视口尺寸计算
├── context/              # 模块化状态管理（9 个 Provider + Actions 模块）
├── utils/                # Unicode→TeX 转换、导出、导出桥、群工厂、混合计算
├── backend/              # FastAPI 后端（大群结构计算）
└── docs/                 # 技术文档体系
```

---

## ⌨️ 命令

| 命令 | 说明 |
|---------|-------------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run test` | 运行 Vitest 测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run preview` | 预览生产构建 |
| `npm run export` | Playwright 批量导出视图（→ exports/batch-<时间戳>/） |

后端（大群计算需要）：
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 📚 数学背景

GroupViz 可视化抽象代数与有限群论中的概念。
- **Lagrange 定理** — 子群的阶必整除群的阶
- **Cayley 定理** — 任意有限群同构于某个对称群的子群
- **类方程** — |G| = 各共轭类大小之和
- **第一同构定理** — G/ker(φ) ≅ im(φ)
- **半直积** — N⋊_φ H：乘法 (n₁,h₁)·(n₂,h₂) = (n₁·φ(h₁)(n₂), h₁·h₂)

凯莱图由任意群元素的作用定义。
- **右乘模式**：若 a·c = b 则存在 a → b 的边
- **左乘模式**：若 c·a = b 则存在 a → b 的边
- 若作用为对合，边为无向边（不显示箭头）
---

## 🔮 路线图
- [x] 9 种视图模式（含同态视图、陪集条带）
- [x] 多视图浮动窗口
- [x] 子群格（Hasse 图）
- [x] 对称性视图（多面体旋转动画）
- [x] 小群预计算注册表（阶 1–15）
- [x] 国际化（中文 / English）
- [x] 陪集分解 UI 可视化 + Lagrange 验证
- [x] 直积群构建系统（任意 G×H）
- [x] 半直积构建（5 预设 + φ 映射 UI + 动画）
- [x] 自同构群 Aut(G)
- [x] 同态映射 + 第一同构定理动画证明
- [x] 2D 凯莱图多形状布局（10 种，含 rewiring）
- [x] 深色/浅色主题
- [x] 会话保存与恢复
- [x] 视图导出（SVG/PNG/GIF）+ 批量导出 CLI
- [x] 混合计算（本地 TS + FastAPI 后端）
- [x] 测试体系（21 文件 427 tests）
- [ ] 群运算律验证动画
- [ ] 自定义有限群输入
- [ ] 教学模式

---

## 📄 许可证
MIT © 2026

---

*为数学可视化而构建。*
# GroupViz — 群论可视化交互工具

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

**GroupViz** 是一个用于可视化与探索有限群论的交互式Web应用。提供 7 种视图模式、支持多种典型群族，所有数学公式均通过 KaTeX 渲染。

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TS 6">
  <img src="https://img.shields.io/badge/Three.js-0.184-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/KaTeX-0.16-green" alt="KaTeX">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT">
</p>

---

## ✨ 功能特性

### 群结构可视化
- **子群** — 计算、列出并高亮所有循环子群
- **共轭类** — 自动划分共轭类
- **中心** — 识别中心元素
- **子群格（Hasse 图）** — 节点按层级排列，正规子群高亮
- **陪集分解** — 左/右陪集计算（UI开发中）
- **单群检测** — 自动判断是否为单群

### 7 种视图模式
| 视图 | 说明 |
|------|------|
| **集合视图** | 群元素圆形排列展示 |
| **凯莱图 (2D)** | SVG 渲染，力导向布局，节点可拖拽，边可配置 |
| **圆圈图** | 循环子群可视化，支持极大循环筛选 |
| **凯莱表** | 交互式乘法表，行列高亮 |
| **凯莱图 (3D)** | Three.js 渲染，15 种形状模板，轨道控制 |
| **对称性视图** | 多面体几何 + 元素操作动画 + 旋转轴与交点标记 |
| **子群格图** | Hasse 图，按层级布局 |

### 支持的群
| 群 | 符号 | 阶 | 状态 |
|-------|--------|-------|--------|
| 循环群 | Zₙ (n=1..20) | n | ✅ |
| 二面体群 | Dₙ (n=3..8) | 2n | ✅ |
| 对称群 | S₃, S₄ | 6, 24 | ✅ |
| 交错群 | A₃, A₄, A₅ | 3, 12, 60 | ✅ |
| Klein 四群 | V₄ | 4 | ✅ |
| 四元数群 | Q₈ | 8 | ✅ |
| 直积群 | Z₄×Z₂, Z₂³, Z₃×Z₃ | 8, 8, 9 | ✅ |

### 核心亮点
- **基于群元素作用的凯莱图** — 边由任意群元素定义，支持右乘/左乘切换
- **15 种 3D 形状模板** — 按群性质自动分配（S₄/A₄/A₅ 使用截角多面体）
- **多视图浮动窗口** — 同时打开多个视图进行对比分析
- **子集分析** — 保存元素选择集；通过封闭性检验自动检测子群/正规子群
- **自逆元素检测** — 高亮 g⁻¹ = g 的元素
- **国际化** — 中文/English UI，localStorage 持久化
- **小群注册表** — 阶 < 12 的所有 19 个群，预计算子群/共轭类数据

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

浏览器打开 `https://rrcathy.github.io/GroupViz/`。

### 生产构建

```bash
npm run build
npm run preview
```

---

## 📖 使用指南

1. 在左侧面板**选择群**（循环群、二面体群、对称群、交错群或特殊群）
2. 通过标签栏或左侧按钮**切换视图**
3. **画布交互** — 平移（拖拽背景）、缩放（滚轮）、选中（点击）、框选（Ctrl+拖拽）
4. **探索凯莱图** — 启用/禁用元素作用边，切换右乘/左乘，运行力导向布局
5. **键盘导航** — ← → 键切换元素
6. **打开浮动视图** — 开启多视图模式，并排对比不同表示

---

## 🛠 技术栈

| 类别 | 技术 |
|----------|-----------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite |
| 样式 | TailwindCSS 4 |
| 3D 渲染 | Three.js + React Three Fiber |
| 数学渲染 | KaTeX |
| 状态管理 | React Context + Hooks |
| 国际化 | 自定义 React Context |

---

## 📂 项目结构

```
src/
├── components/
│   ├── Canvas/           # 7 种视图组件 + 浮动多视图窗口
│   ├── Panels/           # 左侧工具栏 + 右侧属性面板
│   ├── Tex.tsx           # KaTeX React 组件
│   └── WelcomePage.tsx   # 欢迎页（浮动数学符号动画）
├── core/
│   ├── types.ts          # 类型定义、色板、形状检测函数
│   ├── groups/           # 6 个群实现文件
│   ├── algebra/          # 子群、陪集、共轭类、力导向布局
│   ├── polyhedra.ts      # 多面体顶点生成
│   ├── elementRotation.ts # 群元素 → 3D 几何旋转变换
│   └── viewBox.ts        # SVG 视口尺寸计算
├── context/              # 全局状态管理（820行 Provider）
├── i18n/                 # 中英文翻译
└── utils/                # Unicode→TeX 转换
```

---

## ⌨️ 命令

| 命令 | 说明 |
|---------|-------------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run preview` | 预览生产构建 |

---

## 📚 数学背景

GroupViz 可视化抽象代数与有限群论中的概念：

- **Lagrange 定理** — 子群的阶必整除群的阶
- **Cayley 定理** — 任意有限群同构于某个对称群的子群
- **类方程** — |G| = 各共轭类大小之和
- **同构定理** — G/ker(φ) ≅ im(φ)

凯莱图由任意群元素的作用定义：
- **右乘模式**：若 a·c = b 则存在 a → b 的边
- **左乘模式**：若 c·a = b 则存在 a → b 的边
- 若作用为对合，边为无向边（不显示箭头）

---

## 🔮 路线图

- [x] 7 种视图模式
- [x] 多视图浮动窗口
- [x] 子群格（Hasse 图）
- [x] 对称性视图（多面体旋转动画）
- [x] 小群预计算注册表（阶 < 12）
- [x] 国际化（中文 / English）
- [ ] 陪集分解 UI 可视化
- [ ] Lagrange 定理验证动画
- [ ] 群运算律验证动画
- [ ] 自定义有限群输入
- [ ] 群同构检验
- [ ] 教学模式

---

## 📄 许可证

MIT © 2026

---

*为数学可视化而构建。*

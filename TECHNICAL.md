# GroupViz 技术总览

> **本文件的定位**：项目总览与**文档地图**。
>
> 可运行的细节——每个视图的 props、每条布局公式、每个 Provider 的字段、每次改动的原因——
> 一律以 `docs/` 下的专题文档为**单一权威**。本文件只保留两样东西：**不随功能迭代而变的骨架**
> 和**当前状态的关键数字**。
>
> **维护口径**：改功能 → 更新对应 `docs/` 文档 + 本文件「§1 当前状态」的数字；**不要把专题细节
> 抄回本文件**。2026-09-22 之前的旧版曾逐视图、逐布局、逐 Provider 展开（1027 行），结果是
> 双轨漂移：同一事实两处维护，改一处必漏另一处——最终只剩 7 个视图的小节对应 13 种视图、
> 群族与目录结构全部停在早期状态。**重复即漂移源。**

---

## 1. 项目是什么 · 当前状态

交互式群论可视化 Web 应用（面向数学研究者与学习者），用动态图形呈现群的结构、运算与对称性。
可视化方案的约定以 Nathan Carter《群论彩图版》（Visual Group Theory）与 `refer/` 参考书为准。

**关键数字**（2026-09-22，v2.4.0）：

| 维度 | 现状 |
|---|---|
| 视图模式 | **13 种** — set / cayley / cycle / table / 3d / symmetry / sublattice / homomorphism / cosetstrip / action / sylow / tree / prestable |
| 引擎化 | 11 个视图 Scene **props 化入包**；另附属 `AutomorphismScene`（自同构作用预览）与附属组件 `QuotientSubgroupInset`（商群 N 悬浮窗）。tree / prestable 与无限群绑定，移交拓展包轨道 |
| 群族 | Sₙ(2–6)、Cₙ(1–120)、Dₙ(3–15)、Aₙ(3–5)、V₄、Q₈、QD₁₆、GL(2,2)≅S₃、GL(2,3)(48 阶)、直积 G×H、半直积 N⋊_φH、自同构 Aut(G)、商群 G/N、SmallGroup 注册表（66 表群） |
| 形状模板 | **20** 种 3D + **14** 种 2D，按群性质自动分配 |
| 测试 | ~95 文件 / ~2000 tests（node+dom 双项目）+ e2e 7 spec；精确数以 `npm run test` 实时输出为准 |
| 发布 | 双包 `@groupviz/core` + `@groupviz/react` **v2.4.0 已发布 npm**（发布门禁 9 关 + 发布后 registry 验收 4 关） |

## 2. 技术栈

| 层 | 选型 |
|---|---|
| UI | React 19（函数式 + Hooks）、TypeScript 6 |
| 构建 | Vite 8（`/api` 代理到后端）、`tsconfig` project references（`tsc -b`） |
| 3D | three.js 0.184 + React Three Fiber 9 + drei（相机变化走 `useFrame` 命令式，不触发 React 重渲染） |
| 数学渲染 | KaTeX（全应用 TeX 渲染；`utils/texify` 做 Unicode↔TeX 双向） |
| 校验/序列化 | zod 4（持久化、`GroupDescriptor v1`） |
| 导出 | 原生 SVG/PNG + gifenc（对称性视图 GIF） |
| 测试 | Vitest 4（node + happy-dom 双 project）、Playwright（e2e + 批量导出 + 发布验收） |
| 后端 | Python 3.12 + FastAPI + Uvicorn + GAP（大群计算） |
| 样式 | 全局 CSS 自定义属性（**不依赖** Tailwind 或任何 CSS 框架） |

## 3. 架构分层与依赖方向

依赖只向下，不反向（`core` 不认识 React，`context` 不认识组件）：

```
core/        纯算法层：群构造、代数运算、布局、序列化、阈值守卫。零 React/DOM 依赖
  ↑
context/     状态层：12 个领域 Provider 分层 + 组合容器 GroupContext.tsx（+ useGroup 读取口）
  ↑
components/  视图层：Canvas 下 35 个组件文件（视图内核 + Scene）、Panels 控制面板
  ↑
App / Workspace  三栏工作台装配、键盘事件、会话保存恢复

utils/       TeX 转换、导出（SVG/PNG/GIF）、持久化、群工厂、混合计算（本地/后端分派）
backend/     FastAPI + GAP：>144 阶群的服务端计算（含预取缓存）
package 产物  dist-pkg/@groupviz/core（纯算法，唯一依赖 zod）+ @groupviz/react（Scene 组件，peerDeps）
```

- **视图内核 props 化**：`SetView` / `CayleyView` / … / `SylowScene` 等不读应用级 context，
  状态由宿主经 props 注入——主应用用 context 桥（`*FromContext` 壳）喂，消费端用 `useSceneState` 喂。
- **组件层可脱离主应用**：包消费端（`/?test=1` 的 `TestPagePkgConsume`）吃 `dist-pkg` 产物独立跑。

## 4. 关键设计决策

1. **core 零 React/DOM 依赖**——可独立发 npm 包，也可被后端算法对照与消费端复用。
   门禁会验证（`src/core` 不得 import react/components/context）。
2. **群记号「本地优先」解析**：统一入口 `parseGroupNotation`（规范化 → 专名展开 → 本地构造 →
   后端 GAP → 定向报错）。两条硬规则：只收 TeX 形态、**拒绝 Unicode 上下标**（曾静默把 `C_2²`
   解成 22 阶 `C_{22}`）；`D_n` 恒为 **2n 阶**（D_8 = 16 阶）。
3. **性能阈值线集中在 `core/guards.ts`**（依据 `docs/PERF.md` 实测，新代码禁止写魔数）：

   | 常量 | 值 | 含义 |
   |---|---|---|
   | `INTERACTIVE_LIMIT` | 120 | 需持续交互（拖拽/缩放）的流畅线 |
   | `ENUMERATION_LIMIT` | 144 | 子群枚举类 2 秒线 |
   | `STATIC_LIMIT` | 240 | 图形类「过大」警告线：静态/出图可用、拖拽卡 |
   | `RENDER_3D_LIMIT` | 720 | 3D 视图上限（DOM 恒定，1 个 canvas） |

4. **窗口双形态并存**：老式 context 壳（`FloatingViewWindow`，独立 canvasTransform 与 z 序）与
   受控内核（`ViewWindow`，config/viewParams 可受控）；实体在 `Canvas/floatingView/`
   （7 hook + 2 子组件 + 支撑模块），对外仅 3 个符号（`ViewWindow` / `FloatingViewWindow` / `ViewParams`）。
5. **商群 / 自同构 / 半直积是一等群构造**（与 Sₙ/Cₙ 同级）——有独立的创建入口、持久化与视图。
6. **文档单一权威**：`docs/CHANGELOG.md` = 已完成历史的唯一权威；`docs/ROADMAP.md` = 只列
   未做事项与边界决策；`docs/API.md` = 引擎消费契约。同一事实不在两处维护。

## 5. 目录结构（简版）

```
GroupViz/
├── src/
│   ├── __tests__/        # ~95 测试文件（node + dom 双 project）
│   ├── components/
│   │   ├── Canvas/       # 35 个组件：视图内核（SetView/CayleyView/…）+ Scene + floatingView/
│   │   ├── Panels/       # 左 6 面板 + 右侧视图/操作面板
│   │   ├── Tex.tsx  WelcomePage.tsx
│   ├── core/             # 纯算法层（零 React）
│   │   ├── groups/       # SymmetricGroup/CyclicGroup/DihedralGroup/AlternatingGroup/
│   │   │                 # SpecialGroup/SmallGroups/DirectProduct/SemidirectProduct
│   │   ├── algebra/      # subgroups/homomorphisms/automorphisms/actions/cayleyEdges/
│   │   │                 # cycleLayouts/forceLayout/shapeLayouts/layout3D/layouts3D/
│   │   │                 # notation/(群记号) series/ presentation/ faces3D/ …
│   │   ├── types/ types.ts guards.ts viewBox.ts descriptor.ts polyhedra.ts
│   ├── context/          # 12 个领域 Provider（core/backend/cayley/subsets/symmetry/
│   │                     # directProduct/multiview/homomorphism/semidirectProduct/
│   │                     # actions/presentation/series）+ GroupContext.tsx + useGroup.ts
│   ├── utils/            # texify / export / persistence / groupFactory / hybridCompute
│   ├── i18n/  theme/  hooks/  types/  package/（双包消费页）
│   └── App.tsx  Workspace.tsx  main.tsx
├── backend/              # FastAPI（main/group/algebra/factory/schemas/gap_service/test_main）
├── docs/                 # 专题文档（见 §7 文档地图）
├── scripts/              # 批量导出 CLI、双包构建与验收脚本（pkg/）
├── e2e/                  # Playwright 用例
├── refer/                # 可视化参考书（本地、不入库）
└── package.json / vite.config.ts / vitest.config.ts / .githooks/
```

## 6. 质量与发布门禁

**本地**
- `.githooks/pre-commit`：暂存的 `.ts/.tsx` 逐个 eslint + 全量 `tsc -b`（`package.json` 的
  `prepare` 脚本在 `npm install` 时自动 `git config core.hooksPath .githooks`，零新依赖）。

**测试**（详见 `docs/TESTING.md`）
- `npm run test` — node + dom 双 project；`npm run test:e2e` — Playwright 7 spec；
  `npm run test:coverage` — 四层 include（core/utils/context/components）+ **per-glob 分层阈值**
  （core/utils ≥ 85/70 硬线，context/components 为防倒退线）。
- 阈值不代表质量达标，作用是「删测试或新代码裸奔时直接红」。

**CI**（`.github/workflows/`）
- `ci.yml`：lint → test → build:pkg → build → coverage；另有 backend pytest 作业。
- `pages.yml`：GitHub Pages 部署。

**发布**（双包）
- 顺序：`npm run build:pkg`（产物 + `finalize-pkg.mjs` 生成包 README 与 package.json）
  → `npm run publish:smoke`（9 关：产物在位 / 具名导出 / README / pack / 安装消费 / strict 类型面 …）
  → `npm publish`（core 先，react 的 peerDeps 依赖它）
  → 发布后验收 4 关：`consume:compare`（registry 字节比对）/ `consume:registry`（真装消费）/
  `consume:types`（`skipLibCheck:false`）/ `consume:browser`（Chromium 实点 TestPage）。
- 版本 bump 需同步 **5 类位置**：`package.json`（`version` + `pkgVersion`）、`package-lock.json`
  3 处、`welcome.version` zh+en、`docs/PLAN_EXTENSION_PACKS.md` 的 peerDeps 示例、
  README/TECHNICAL 里的派生死数字。操作细则与本机沙箱规避见 skill `gv-release-gates`。

## 7. 文档地图

| 文档 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | 开发入口：项目概述、文档导航、技术栈、目录、当前状态 |
| [docs/TUTORIAL.md](docs/TUTORIAL.md) / [TUTORIAL_zh-CN.md](docs/TUTORIAL_zh-CN.md) | 新手教程（13 视图实操、群构建、导出） |
| [docs/GROUPS.md](docs/GROUPS.md) | 群实现：核心类型、群族、直积/半直积/自同构、小群注册表、群工厂 |
| [docs/CAYLEY.md](docs/CAYLEY.md) | Cayley 图系统：边计算、2D/3D 渲染、20 种 3D 形状、14 种 2D 布局 |
| [docs/VIEWS.md](docs/VIEWS.md) | 13 种视图模式与多视图窗口 |
| [docs/PRESENTATION.md](docs/PRESENTATION.md) | 群展示系统：解析器、Todd–Coxeter、关系发现器 |
| [docs/STATE.md](docs/STATE.md) | 状态管理：Provider 分层、子集/陪集/同态/商群状态、持久化 key |
| [docs/BACKEND.md](docs/BACKEND.md) | 后端：FastAPI 端点、服务端缓存、混合计算分界、GAP 引擎 |
| [docs/UI.md](docs/UI.md) | UI 结构：三栏布局、面板、组件清单、i18n |
| [docs/ACTIONS.md](docs/ACTIONS.md) | 群作用系统：五来源、轨道/稳定化子/OST、Burnside 自检 |
| [docs/API.md](docs/API.md) | **引擎消费 API**：Scene props 全表、core 门面、`useSceneState`、theme、阈值 |
| [docs/TESTING.md](docs/TESTING.md) | 测试体系：双 project、E2E、覆盖率、测试约定与法则型性质测试 |
| [docs/PERF.md](docs/PERF.md) | 性能基准：三层极限实测、瓶颈判别实验、阈值线由来 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | **已完成历史的唯一权威**（逐次开发记录） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | **只列未做事项与边界决策** |
| [docs/PLAN_VIEW_CONTROL_LAYER.md](docs/PLAN_VIEW_CONTROL_LAYER.md) | 视图控制层（VCL）规划 |
| [docs/PLAN_EXTENSION_PACKS.md](docs/PLAN_EXTENSION_PACKS.md) | 拓展包规划（对称群族 / 表示论 / 伽罗瓦） |
| [feedback/README.md](feedback/README.md) | 引擎缺陷反馈收件箱（本地、不入库）与处理 SOP |

## 8. 待办入口

- 未做事项与边界决策：[docs/ROADMAP.md](docs/ROADMAP.md)
- 中期方向：特征标表、GAP 后端完善、视图控制层（VCL）扩展
- 远期：拓展包（对称群族与点群 / 表示论深化 / 伽罗瓦对应）与 GVL 教学实验室

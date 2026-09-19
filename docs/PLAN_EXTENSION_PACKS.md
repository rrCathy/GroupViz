# 拓展包规划（Extension Packs）

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-09-16（与引擎双包关系讨论后立项）。性质：**规划文档（全部未开始）**。
> 状态标记：⏳ 未开始 / 🔄 进行中 / ✅ 已完成（完成后移入 [CHANGELOG.md](CHANGELOG.md)）。

## 1. 关系模型：拓展包是引擎的下游消费者

拓展包**不是引擎的一部分，也不是引擎的分支**——它与宿主应用站在同一侧：同样 `npm install` 引擎、同样只吃公开 API；区别只是它交付的是「可复用的新能力」（新视图组件、新群实现、新数据），宿主装上它，能力就多了。

```text
宿主应用 ──dependencies──> @groupviz/react ──peerDeps──> @groupviz/core
   │                             ↑
   ├──dependencies──> @groupviz/ext-xxx ──peerDeps──> @groupviz/core + @groupviz/react
（拓展包与引擎无反向依赖；多个拓展包之间零依赖，宿主页面层汇合）
```

四条定案：

1. **peerDependencies 硬约束**：拓展包对引擎只能用 `peerDeps`，绝不 `dependencies` 打包自己的 core——全应用必须只有一份 `@groupviz/core`，否则 Group 对象、类型判定、theme 跨实例断裂。`@groupviz/react` 自己就是这个模式（peerDeps core `^2.3.0`），拓展包照抄。
2. **Group 开放接口是基石**：`Group` 是开放 interface（`src/core/types/group.ts`，必填 `name/symbol/order/elements/generators/multiply/inverse/identity/isAbelian`）。拓展包可**自带群实现**（矩阵群、点群、快速置换群），实现该接口即被引擎 13 视图零改动消费。
3. **形态分三档，当前只做前两档**：① 组件型（导出视图组件，吃 Scene props / `useSceneState` / `theme` / `parseGroupNotation`）——现在就能做；② 数据型（导出群构造器、特征标数据、descriptor）——现在就能做；③ 插件型（`registerLayout`/`registerView` 注入引擎内部分发）——**引擎暂无 register API、exports 也只有根入口，不做预设计**；等 2~3 个拓展包出现共同需求再开孔。
4. **版本与仓库**：peerDeps 写 `"^当前引擎 minor"`，跟随引擎小版本；引擎发 major 时各包适配后发版。仓库形态为**独立 npm 仓库**（依赖的是已发布的双包，无需主仓库源码）；主仓库不拆 monorepo（与 [ROADMAP.md](ROADMAP.md) §2.5 一致）。

## 2. 三个拓展包总览

| 包 | 定位 | 旗舰交付 | 阶数风险 | 包间依赖 |
|----|------|----------|----------|----------|
| `@groupviz/symmetric-families` | 对称群族扩充 + 点群 | 32 三维点群 · stereogram · GL/SL/PSL/AGL 构造器 | 点群 ≤120 全在安全区；S₇⁺ 仅静态 | 无 |
| `@groupviz/rep-theory` | 表示论深化视图 | Young 图 · 正则表示分解 · 表示几何实现 | 表格渲染为主，无大节点风险 | 无 |
| `@groupviz/galois` | 伽罗瓦对应可视化 | Galois 对应图（域格 ↔ 子群格反序） | MVP 全在 120 阶内 | 无（Galois 群用 core 现有 S₃–S₅） |

## 3. `@groupviz/symmetric-families` —— 对称群拓展包 ⏳

### 3.1 内容

- **矩阵群构造器**：F_q 域运算（q = p^k，域元素表）→ GL(n,q)、SL(n,q)、PSL(n,q)、AGL(1,q)。矩阵乘法 O(n³)，天然绕开 core 置换群 `findPermIndex` 的 O(n!) 痛点（[ROADMAP.md](ROADMAP.md) §2.6 已列修复，修复前矩阵族不受影响）。
- **三维点群（皇冠，优先做）**：32 晶体学点群（Schönflies 记号，天然 3×3 正交矩阵实现）+ stereogram 极射赤面投影视图 + 多面体对称作用（直接衔接引擎 `polyhedra.ts` 现成的立方体/四面体/二十面体顶点与 3D 管线）。阶数多数 ≤48、最大 I_h=120，**全部落在交互天花板内，性能最安全**。本模块即欢迎页预告 DLC（点群）的**提前兑现**（[ROADMAP.md](ROADMAP.md) §3.7 原排 GVL 远期）。
- **大阶置换群**：快速 Sₙ 实现（`elements` id 建 Map 索引，multiply O(1)，对应 core §2.6 `findPermIndex` 修复思路）解锁 S₆–S₈ 静态可用。**孵化器模式**：实现先在拓展包 A/B 验证，成熟后下沉 core 发 minor。
- **族专属视图**：字长球（参考 [PLAN_VIEW_CONTROL_LAYER.md](PLAN_VIEW_CONTROL_LAYER.md) §10 S₅ 单文件实现）、共轭类几何。

### 3.2 性能对照（天花板见 [PERF.md](PERF.md)：交互 120–240 阶 / 子群枚举 144 阶）

| 族 | 阶 | 判定 |
|----|-----|------|
| 点群 | ≤120 | 交互安全（I_h=120 顶格） |
| GL(3,2) = PSL(2,7) | 168 | 静态 OK；子群格超线走后端 GAP |
| S₆ | 720 | 静态渲染 OK，交互卡顿 |
| S₇ / S₈ | 5040 / 40320 | 仅静态 + 大群警告 |

### 3.3 记号

`PSL(2,7)` 等族记号短期由本包自供解析函数（返回群对象），不改 core 的 `parseGroupNotation`；core 记号层开扩展点后置（见 §8）。

## 4. `@groupviz/rep-theory` —— 表示论拓展包 ⏳

### 4.1 与引擎特征标表的分工（重要）

特征标表**主表维持引擎中期交付**（[ROADMAP.md](ROADMAP.md) §2.3 定案：GAP `CharacterTable`+`Irr`+`ConjugacyClasses` → 后端 → 前端表格），本包不重复做表，做两件事：

- **离线查表数据档**：GAP `CharacterTable` 导出 JSON 内置（点群 32 / Sₙ n≤8 / Aₙ n≤6 / 常见小群），供无后端宿主离线消费；
- **主表之上的深化视图**。

### 4.2 内容

- **Young 图视图**：Sₙ 分拆 ↔ 不可约表示（Specht 模块），钩长公式出维数，分拆偏序格。Sₙ 表示论的统一入口。
- **正则表示分解视图**：特征标内积 → 各不可约表示出现次数（dᵢ 次）的条形/环状展示。
- **表示几何实现**：3D 表示矩阵作用于基向量/多面体的变换动画——与 [ROADMAP.md](ROADMAP.md) §3.6「矩阵表示动画」（SymmetryView 全矩阵化）同源，本包提前覆盖其核心场景。
- **不可约表示构造**（后置）：Young 正交表示矩阵；一般群走后端 GAP `IrreducibleRepresentations` 待评估。

### 4.3 数值策略

复数特征标（如 3 次单位根）MVP 用浮点 + 容差显示（0.5 ± 0.866i，容差 1e-6）；精确分圆域算术（Z[ζₙ]）后置。查表档天然携带 GAP 精确值，风险集中在计算档，而计算档本身后置。

## 5. `@groupviz/galois` —— 伽罗瓦理论拓展包 ⏳

### 5.1 旗舰视图：Galois 对应图

中间域格 ↔ 子群格的**反序双射**对照图（含正规/非正规着色、扩张度标注）。引擎 `SubgroupLatticeView` 已 props 化，本包新增：域侧数据结构（域扩张描述：底域 + 生成元 + 极小多项式）+ 域格计算 + 双侧对照连线层。

### 5.2 MVP 素材（全部本地精确可算，无需后端）

| 素材 | Galois 群 | 教学价值 |
|------|-----------|----------|
| 有限域 GF(pⁿ) | Cₙ（Frobenius σ:x↦x^p） | 最简闭环：域塔 ↔ 引擎循环群子群格，n 的因子一目了然 |
| 二次域复合 ℚ(√a,√b) | V₄ | 教科书第一例：域格与子群格同为 2×2 方格，对应关系最直观 |
| 分圆域 ℚ(ζₙ) | (ℤ/n)× | 素数幂时循环、n=12 出非循环，覆盖两形态 |
| 三次式判别 | S₃ / A₃ | 判别式平方性 → 群结构，第一次"多项式决定群" |
| 四次式 resolvent | S₄ / A₄ / D₄ / V₄ / C₄ | 五型分类，resolvent 思想入门 |

**Galois 群实现**：MVP 只需 S₃/S₄/S₅，**直接用 core 现有 Sₙ(2–6)/Aₙ(3–5)**，故本包 peerDeps 仅 core + react，与其他两包零耦合，可随时插队开发。S₅(120) 亦在子群枚举线内。

### 5.3 可解性视图

合成列 → 循环因子链 → 根式可解判定（引擎正规子群/商群计算现成）；配 A₅ 不可解反例 → "五次方程无求根公式"的叙事视图。与 rep-theory 的衔接（Burnside 特征标判据）属于页面层汇合，不进包内依赖。

### 5.4 边界（明确不做）

五次以上一般多项式的 Galois 群计算（模多项式/resolvent 研究级算法）、p 进域、无限扩张、Galois 上同调方向。

## 6. 开发顺序

| 序 | 交付 | 理由 |
|----|------|------|
| ① | symmetric-families·点群 | 性能安全区；3D 素材引擎现成；兑现 DLC 预告；为 rep-theory 供第一批特征标查表数据 |
| ② | rep-theory·查表档 + Young 图 | 消费 ① 的点群特征标数据 |
| ③ | galois·MVP | 只依赖 core 现有群，与前两包零耦合，可按兴趣插队 |
| ④ | symmetric-families·矩阵族 | F_q 域运算是独立资产 |
| ⑤ | symmetric-families·大 Sₙ（快速置换实现 → 验证后下沉 core） | 依赖 ④ 的性能经验与 core §2.6 协同 |

## 7. 通用工程规范

- **接口兼容门禁**：拓展包群实现必须 `implements` core 导出的 `Group` 类型，并复用 `publish:smoke` 思路做消费冒烟（真实 npm 安装 + SSR + 双 resolution 类型检查），防 core 升级接口漂移。
- **package.json 骨架**：`peerDependencies: { "@groupviz/core": "^2.3.0", "@groupviz/react": "^2.3.0", "react": "^19.0.0" }`，`sideEffects: false`（CSS 文件除外）；版本号策略独立（`pkgVersion` 模式，成对同版约定不跨包）。
- **性能豁免为零**：[PERF.md](PERF.md) 的边界（不做 Canvas/WebGL 重写、不做 Worker、不做虚拟列表）对拓展包同等生效。
- **视觉精致度预期**：引擎布局对 registry 群的特判（Dₙ 双环、循环群环序等）不覆盖拓展包群，走 fallback 布局——功能可用，精致度打折属可接受边界。
- **文档**：各包自带 README + 最小消费示例；主仓库 [AGENTS.md](../AGENTS.md) §2 收录导航行。

## 8. 引擎侧待开孔清单（由真实需求驱动，不预设排期）

| 孔 | 触发条件 | 说明 |
|----|----------|------|
| core 记号层扩展点 | ≥2 个包需要族记号进统一解析 | `parseGroupNotation` 增注册口或拓展包记号注入 |
| `register*` 插件 API | ≥2 个包需要引擎内部分发（布局/视图/群族） | 含 exports 子路径 |
| `findPermIndex` Map 化提前 | galois/symmetric-families 对大置换群有实际消费 | 见 [ROADMAP.md](ROADMAP.md) §2.6，本身已挂账 |
| **无限群的元素访问** | 拓展包承接 tree / prestable（无限族可视化）时 | 现 `Group.elements` 是**有限数组**，表达不了 ℤ / 自由群 / 无限展示；需要惰性成员接口或增量枚举。见 §9 衔接记录 |

## 9. 与既有规划的衔接记录

- [ROADMAP.md](ROADMAP.md) §2.3 特征标表：**维持引擎交付**，rep-theory §4.1 分工不重复。
- [ROADMAP.md](ROADMAP.md) §3.6 矩阵表示动画（GVL）：rep-theory §4.2「表示几何实现」提前覆盖核心场景。
- [ROADMAP.md](ROADMAP.md) §3.7 DLC 点群（GVL）：symmetric-families §3.1 提前兑现。
- 欢迎页「即将推出」DLC（空间群/点群）：点群由拓展包兑现；**空间群**（平移对称、无限群方向）不在三个拓展包范围内，留 GVL。
- **[ROADMAP.md](ROADMAP.md) §2.2 tree / prestable 视图（2026-09-16 移交）**：13 视图中最后两个未 props 化的视图（入口在左侧「群展示」面板），**引擎侧不再 props 化**。两条理由：① 与**无限群**方向绑定——自由群的 Cayley 树（`FreeGroupTreeView`）本质是**无限** Cayley 图；展示乘法表（`PresentationTableView`）服务 Todd–Coxeter 枚举出的展示族（可无限），两者的核心状态（`activePresentationGroup` / `templateGenCount` / `visualDraft`）都是展示域专属，硬塞进 `@groupviz/react` 会带一批只为自身服务的 props；② 当前**没有消费需求**（博客内嵌与现有嵌入用例全部是有限群视图）。
  - **承接形态**：新拓展包（建议名 `@groupviz/presentation`），与既有三包同构——peerDeps 引擎双包、自带 Scene 与状态壳、独立 npm 仓库。**不设排期**，等真出现「无限群 / 展示可视化」的消费场景再立项。
  - **届时引擎侧要开的第一孔**：`Group.elements` 是有限数组（见 §8），表达不了 ℤ / 自由群 / 无限展示。这是无限群方向的硬前置，不解决则该包无法消费引擎任何图形视图。

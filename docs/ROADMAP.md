# 路线图 (Roadmap)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定日期：2026-08-04（三阶段规划讨论结论）。本文件为规划性文档，随开发推进持续更新。

## 0. 规划总览

GroupViz 的演进分三个阶段，逐级沉淀：

| 阶段 | 时间窗 | 名称 | 目标 |
|------|--------|------|------|
| 近期 | 2026-08 → 2026-10 | 功能夯实期 | 补全群论可视化主流主题（群作用、Sylow、数学缺口、gappy 集成） |
| 中期 | 2026-10 → 2027-04 | FGVE 引擎化 | 沉淀独立于 UI 的有限群可视化引擎 |
| 远期 | 2027-04 → 2027-12 | GVL 教学实验室 | 面向大学抽象代数课程的教学产品形态 |

核心决策（详见 §5）：近期 = **群作用/Sylow（已完成）+ 数学缺口补全 M1–M8 + gappy 后端集成 + FGVE 预铺路**；FGVE **先做仓库内独立引擎层**（不拆 npm 包）；GVL 定位 **大学抽象代数课程配套**（Fraleigh / Dummit & Foote 风格）。

## 1. 近期：功能夯实期（2026-08 → 2026-10）

### 1.1 群作用系统（P0）— ✅ 已完成（v1.8）

当前最大的数学缺口：已有陪集、同态、商群，但缺少"作用"这一统一框架。

- **数学内容**：任意有限群 G 作用在集合 X 上；轨道 Orb(x)、稳定子 Stab(x)；轨道-稳定子定理 `|Orb(x)|·|Stab(x)| = |G|`；Burnside 引理（可选）。
- **作用来源**：
  - 群在陪集空间 G/H 上的左乘作用
  - 群在自身上的平移/共轭作用
  - 自定义作用（按元素指定置换）
  - ~~几何顶点集置换作用~~（v1.8 曾开发后移除：视觉不佳；正确路径 = 按元素阶在几何体上找 n 次轴并组织各轴，联系空间群/点群 DLC，暂缓，见 docs/ACTIONS.md §4）
- **可视化**：轨道视图（轨道划分、代表元、轨道-稳定子定理数值自检）、Schreier 图（生成元作用图）、稳定子结构与共轭稳定子展示。
- **工程**：新增 `actions` 领域 Provider；核心逻辑 `core/algebra/actions.ts` 纯函数 + 单测；i18n zh/en 成对补键；与陪集条带（cosetstrip）、同态/置换表示视图打通。

### 1.2 Sylow 定理可视化（P0）— ✅ 已完成（2026-08-06）

- **数学内容**：Sylow p-子群查找——p-元素 → 循环 p-子群 → pair-join 闭包闭合，本地算到 S₅=120（SYLOW_MAX_ORDER=240 守卫）；逐素数验证计数定理 `n_p ≡ 1 (mod p)`、`n_p | m`（`|G| = p^k·m`）；共轭性（所有 Sylow p-子群互为共轭）。
- **可视化**：Sylow 型视图（SylowView.tsx，第 11 种视图模式）——元素节点 + p 可选素数；凯莱图布局（点击子群边切换为子群生成元作用）；单选 → 陪集条带（Lagrange）；Ctrl/⌘/⊕ 复选两个子群 → 上下布局 + 竖直共轭箭头（Sylow 第二定理）+ 子群内部生成元边（P 青 / Q 紫）；轨道视图验证（G 共轭作用在 Syl_p(G) 上，轨道大小 = n_p，稳定子 = 正规化子）。
- **收尾**：欢迎页"即将推出"列表已移除 Sylow 项；Sylow 概览面板（OperationsPanel 第 5 tab）与子群格高亮联动已被视图取代并移除。

### 1.3 数学缺口补全（M1–M8）

基于「已具备能力清单 × 主流群论教材主题」审计出的缺口，按可独立交付拆分，推进顺序 M1 → M8：

- **M1 正则作用 + 陪集作用**：左平移作用 = Cayley 定理可视化（G ≅ Sym(G) 的嵌入，正则表示视角）；G ↷ G/H 传递作用（稳定子 = 共轭 H）；与轨道-稳定子面板打通。— ✅ 已完成（2026-08-10）：types/actions/context/panel/ActionView/RightPanel/i18n + 11 单测（actions.test.ts），orbit 视图展示 + 右侧数学标注。
- **M2 GL(2,p)**：纯 TS 2×2 矩阵模 p 实现（无需 GAP 数据）；GL(2,2) ≅ S₃、GL(2,3) = 48 阶。
- **M3 作用深化三小件**：共轭作用特化标注（固定点 = Z(G) 自检，轨道=共轭类/Stab=C_G(x) 已有通用展示）；Burnside 引理自检（|X/G| = (1/|G|)·Σ|Fix(g)|，右侧通用行）；Sylow 作用面板入口（p 素数下拉 + 按钮，createSylowAction 接线）— ✅ 已完成（2026-08-10）：computeBurnsideCount + 右侧固定点/Burnside 标注行 + 面板 Sylow 行 + 7 单测（actions.test.ts）
- **M4 半直积分解展示（识别方向）**：枚举 N ⊴ G + 互补 H（|H| = |G|/|N|、N∩H = {e}）→ φ(h) = 共轭限制 hgh⁻¹|N → 展示 G ≅ N⋊_φ H → createSemidirectProduct 重建闭环 isoSymbol 验证；多分解列表切换；关联分裂短正合列 1 → N → G → H → 1。— ✅ 已完成（2026-08-10）：findSemidirectDecompositions（order≤60 守卫，去重/排序 verified 优先）+ buildSubgroupGroup/minimalGenerators helper + verified 双通道（isoSymbol 相等 || 不变量回退：isAbelian + 元素阶多重集）+ 面板分解列表（✓/✗ 徽标、点击切换）+ 分裂短正合列 TeX + 14 单测（semidirectDecompositions.test.ts，共 23）；S₄ 双型分解（A₄⋊C₂ / V₄⋊S₃）、D₁₂ 19 候选、Q₈ 无分解均验证
- **M5 第二/第三同构定理数值验证**：(G/M)/(N/M) ≅ G/N（M ⊴ N ⊴ G）、HN/N ≅ H/(H∩N)；商群重建对 IsoSymbol 验证。
- **M6 阿贝尔化**：G_ab = G/[G,G] 展示 + ≅ 识别（导列首项已由 series.ts 算好）。
- **M7 类方程验证行**：共轭类面板补 |Cl(x)|·|C_G(x)| = |G| 验证。
- **M8 群族识别升级**：统一两处 detectIsomorphicGroup（subgroups.ts / presentations.ts 实现不一致）+ 大群权威识别走 gappy IdGroup。

### 1.4 工程质量（E1/E2）

- **E1 gappy 后端集成（近期最大工程）**：backend/gap_service.py 懒加载（pip install gap 未安装不影响其余功能）、端点 IdGroup / 子群 / 子群格 / 性质 / 子群列、服务端缓存 + 超时守卫；S₆（720 阶，1455 子群）UI 全链路开启（纯 Python 分钟级 → GAP 秒级）；Pages 静态部署无后端时前端本地兜底不变（FALLBACK_CUTOFF=240）。
- **E2 细节收尾**：i18n 裸字符串扫描、视图空态统一、文档事实核对（本文件本次同步）。

### 1.5 FGVE 预铺路（P1–P3）

- **P1 群 JSON 导出 + round-trip**：标准化 schema 导出（元素、乘法表、描述符、性质），JSON → 群 → 导出幂等（兼作引擎序列化协议验证）。~~自定义群表导入~~：已否决（自定义群创建已由群展示系统 Todd–Coxeter 覆盖，粘贴乘法表导入价值低）。
- **P2 core/ 引擎化审计**：grep 对 React/DOM/localStorage 的依赖；GroupDescriptor / ViewConfig 协议草案。
- **P3 核心算法 benchmark**：子群 / Sylow / Todd–Coxeter / 自同构的耗时基线。

### 1.6 支撑项与质量（P1）— ✅ 已完成

- **群结构分析升级**：换位子群 [G,G]、子群列（导列/上·下中心列/合成列）、可解/幂零判定——见 core/algebra/series.ts（SERIES_MAX_ORDER=240 守卫，大群二期走后端）。
- **群族扩充**：小群注册表扩至阶 1-31 全部 93 个群（GAP 4.16 SmallGroups 导入，超出原 16-30 计划）；GL(2,p) 移至 §1.3 M2 独立交付。
- **质量**：覆盖率 75.8% → 85%+（✅ 2026-08-09：88.64% stmts / 91.18% lines，35 文件 706 tests，export.ts/exportApi.ts 补测；✅ 2026-08-10：88.92% stmts / 91.34% lines，37 文件 763 tests）；后端计算与前端本地兜底功能对齐（S₆ 全通）。

### 1.7 本期明确暂缓

- 自由群（Cayley 树 / 商群视角）→ 中期候选
- DLC 空间群/点群 → GVL 阶段
- 教育模式 → GVL 核心，不在近期做
- 乘法表导入 → 已否决（群展示系统 Todd–Coxeter 已覆盖自定义群创建）
- 一维特征标 → 暂缓，并入中期特征标表视图（其特例）

## 2. 中期：FGVE 引擎化（2026-10 → 2027-04）

**FGVE**（Finite Group Visualization Engine）：数学内核 + 布局内核，独立于 UI、稳定 API、纯计算无 React/DOM 依赖。

### 2.1 结构演进

- `src/core/` 演进为仓库内独立引擎层（`src/engine/`）：纯 TypeScript、零 UI 依赖、独立测试。
- 渲染层、状态层（9 Provider）仅通过引擎公共 API 访问数学能力；UI 内部细节不再渗透进引擎。

### 2.2 稳定协议

- `GroupDescriptor`：元素、乘法、阶、名称、性质缓存（子群/正规/可解/幂零等）、构造参数（便于序列化与再构建）。
- `ViewConfig`：布局算法（force / ring / shape / 3D / rewiring）、颜色、边类型等视图配置协议。
- `GroupAction`：作用定义 + 轨道/稳定子查询接口（v1.8 已落地：`GroupActionDef`/`GroupActionComputation` + `core/algebra/actions.ts` 纯函数，见 [ACTIONS.md](ACTIONS.md)）。

### 2.3 数据互操作

- **群 JSON 导出 + round-trip**：标准化 schema（元素、乘法表、描述符、性质），支持还原与跨应用交换；JSON → 群 → 导出幂等（近期 P1 已验证，兼作引擎序列化协议）；schema v1 本阶段正式化。
- ~~自定义群表导入~~：已否决（近期 §1.5 P1 决策，群展示系统已覆盖自定义群创建）。

### 2.4 特征标表（character table，正式交付）

群论研究者核心工具。数据链路：gappy `CharacterTable(G)` + `Irr` + `ConjugacyClasses` → 后端端点 → 缓存 → 前端渲染（本地仅缓存后端结果，无 gappy 时特征标表不可用）。

- **矩阵表**：行 = 不可约表示（记号、维数 dᵢ = χᵢ(e)），列 = 共轭类（代表元 TeX、阶、类大小）；单元格数值 + 悬停 KaTeX 显示 χᵢ(g)。
- **热力着色**：按实部 / 复相位可切换着色。
- **验证行**：Σ dᵢ² = |G|；Σ dᵢ·χᵢ(g) = 0（g ≠ e）；正交关系 Σ χᵢ(g)·χ̄ᵢ(h) = δ_{gh}·|C_G(g)|（点选两列验证）。
- **联动**：点击列 → 共轭类视图 / 主视图高亮该类元素；点击行 → 维数徽标。
- 复用表格视图渲染 + 多视图浮动窗口 + 导出（SVG/PNG/GIF）；一维特征标（元素 → 单位根圆周图）作为其子场景一并交付。

### 2.5 gappy 后端完善

- 缓存策略与超时守卫强化；按需扩充端点（特征标表、IdGroup、更多性质）；大群（S₆ 及以上）全链路可用性验收。

### 2.6 可选高价值项

- 引擎 API 文档 + 最小宿主示例（约 100 行代码即可嵌入任意页面）。

### 2.7 非目标

- npm 包发布 / monorepo 拆分：**推迟到 GVL 阶段**出现明确宿主需求时再做，避免早期工程开销。

## 3. 远期：GVL 教学实验室（2027-04 → 2027-12）

**GVL**（Group Visualization Lab）：面向大学抽象代数课程（配套 Fraleigh《抽象代数》、Dummit & Foote）的教学产品形态。

### 3.1 教育模式

引导式欢迎页 + 教学视图（分步动画、提示、检查点），与现有硬核模式并存，按模式切换入口与样式（AGENTS.md §1 已有设计约定）。

### 3.2 课程系统

课程链：群的定义 → 子群 → 陪集 → Lagrange 定理 → 正规子群 → 商群 → 同态 → 群作用 → 轨道-稳定子 → Sylow 定理 → 同构定理。每课 = 场景 + 讲解 + 交互练习。

### 3.3 教师工具

场景保存/分享（JSON/链接）、自定义教程制作、讲义导出（SVG/PDF）。

### 3.4 学生端

练习自检（判断子群 / 找生成元 / 验证同态 / 求作用轨道）、本地进度跟踪。

### 3.5 证明动画库

补齐：第二/第三同构定理、轨道-稳定子、Cayley 定理。已有资产：Lagrange（陪集条带）、第一同构定理（四阶段动画）。

### 3.6 表示论可视化：矩阵表示动画

群元素 → 真实矩阵（复 2×2 / 实 3×3）变换动画：点击元素播放基向量 / 多面体被矩阵变换的动画；本质是 SymmetryView 的全矩阵化版本（SymmetryView 即其特殊情形：正交表示），教育价值最高。

### 3.7 DLC（空间群 / 点群）

晶体学方向（欢迎页已预告）：点群对称可视化、空间群平移对称。

### 3.8 工程形态

视需要将引擎正式发布为 npm 包 `@groupviz/engine`（此时 monorepo 拆分才有明确收益）。

## 4. 阶段成功标准

| 阶段 | 验收标准 |
|------|----------|
| 近期 | M1–M8 数学缺口 + E1 gappy 集成 + P1–P3 预铺路全部交付（见 §1）；lint/test/build 全绿；覆盖率 ≥ 85% |
| 中期 | `src/engine/` 独立成立且 UI 仅经公共 API 访问数学能力；群 JSON round-trip 可用；特征标表视图上线；最小宿主示例可运行 |
| 远期 | 教育模式上线；≥ 1 套完整大学抽象代数课程；教师"制作场景 → 分享 → 学生作答"闭环可用 |

## 5. 决策记录

| 日期 | 决策 |
|------|------|
| 2026-08-04 | 确定三阶段命名与范围；近期优先级 = 群作用系统 + Sylow 定理可视化（其余列 P1/暂缓）；FGVE 先做仓库内独立引擎层（npm 包化推迟到 GVL 阶段）；GVL 定位大学抽象代数课程配套 |
| 2026-08-06 | Sylow 定理可视化落地：core/algebra/sylow.ts 专用查找算法 + Sylow 型视图（元素节点/凯莱图/陪集条带/共轭双选/子群边）+ ActionView Sylow 共轭作用验证；28 文件 542 tests 全绿；版本 1.9.0 |
| 2026-08-07 | 群展示系统落地：core/algebra/presentations.ts（解析器 + Todd–Coxeter 陪集枚举 TC_MAX_COSETS=3000 + 构建 + presentationOf 标准展示分发 + 通用关系发现器）、左侧「群展示」面板（8 预设/防抖预览/持久化+草稿）、关系回路视图（Van Kampen 图 + 关系动画）、展示乘法表视图（单词求值路径）；32 文件 630 tests 全绿；版本 1.10.0 |
| 2026-08-09 | 测试补齐：覆盖率 84.02% → 88.64% stmts（91.18% lines），新增 export.test.ts（15 tests，GIF 编码/SVG/canvas 导出全路径）、exportApi.test.ts（16 tests，导出桥单例 + DOM stub）、utils.test.ts 补 9 用例（groupFactory 嵌套直积/上标幂/回退/越界）；修复 cayleyTree genElsOverride 测试 coverage 下 5s 超时（30s）；35 文件 695 tests 全绿 |
| 2026-08-09 | 小群全量导入：GAP 4.16 SmallGroups 库导出阶 1-31 全部 93 个群（smallGroupData.ts 乘法表数据 + createTableGroup 构建 + structureToSymbol 符号化，结构冲突回退 SmallGroup(n,i)，Dic₃ 强制 Z₃:C₄）；按阶创建面板改为注册表驱动（阶 1-31）；createGroupFromSymbol 支持 D₈-D₁₅/新符号/SmallGroup(n,i)/注册表兜底（会话恢复兼容）；35 文件 704 tests 全绿 |
| 2026-08-09 | 按阶创建面板补回 A₅(60)/S₅(120)（注册表驱动化时丢失回归）；符号 ":" 半直积提示（order-hint 文案，zh/en）；35 文件 706 tests 全绿 |
| 2026-08-10 | 半直积分解（M4）落地：core/algebra/semidirectDecompositions.ts（findSemidirectDecompositions order≤60 守卫 + buildSubgroupGroup/minimalGenerators + verified 双通道）；面板分解列表 + 分裂短正合列 + 点击切换；14 新单测（共 23）；37 文件 763 tests 全绿 |
| 2026-08-09 | 规划定稿（覆盖此前"仅口头确认、不更新 ROADMAP"的决定）：近期 = 数学缺口补全 M1–M8 + 工程质量 E1（gappy 后端集成）/E2（细节收尾）+ FGVE 预铺路 P1（群 JSON 导出+round-trip，乘法表导入否决）/P2（引擎化审计）/P3（benchmark）；推进顺序 M1→M8→E1→E2→P1→P3 |
| 2026-08-09 | 表示论可视化定稿：特征标表 = 中期正式交付（经典矩阵表 + 热力着色 + 正交性验证 + 共轭类联动，数据源 gappy CharacterTable/Irr/ConjugacyClasses，见 §2.4）；矩阵表示动画 → GVL（§3.6）；一维特征标并入特征标表（近期暂缓） |

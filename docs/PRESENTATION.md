# 群展示系统 (Group Presentations)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

## 1. 概述

任意群展示 `⟨S | R⟩`（自由群商群，`f(a,b) = e` 简写为 `f(a,b)`）的完整支持：

- **数学内核** `src/core/algebra/presentations.ts`：解析器、Todd–Coxeter 陪集枚举、由展示构建群、`presentationOf` 标准展示分发、通用关系发现器
- **UI**：左侧「群展示」面板（**直接创建**：完整展示文本/持久化/草稿；**可视化创建**：模板 + 单条关系逐步粘合 + 实时构建校验）、群信息栏展示 TeX 行、**树视图**（退化树 = 商群凯莱图 BFS 生成树，实线生成树边按生成元着色 / 粘合边不绘制仅 bar 计数，布局规则化：直线/网格/十字/3D）、**展示乘法表视图**
- 仅处理**有限群**：Todd–Coxeter 步数与陪集上限守卫，超限判定为无限/溢出

## 2. 核心类型（types.ts）

- `PresentationTerm { g: number; e: number }` — 生成元下标与指数
- `GroupPresentation { generators: string[]; relators: string[]; generatorElements?: GroupElement[] }` — `generatorElements` 为可选的展示生成元在目标群中的实际元素（供回代验证与视图渲染；持久化与重建时剥除，防旧群元素悬垂）
- `Group.presentation?: GroupPresentation` — 仅展示构建/携带展示的群设置
- `isGroupPresentation(group)` — `symbol.startsWith('\\langle')`；`isGroupDirectProduct` 对 `\langle` 开头直接返回 false（防展示符号 `^{n}` 误判直积）

## 3. 解析器

- `parseWord(text, gens)`：递归下降 — 空格、嵌套括号 `(ab)^3`（不平衡抛错）、生成元**贪心最长匹配**（支持 `\sigma_{1}` 等多字符 TeX 符号）、`^` 指数（`^{...}` 或裸数字，允许负号，指数 0 丢弃）；**Unicode 上标**（`a²`/`b³`/`a⁻¹` → `a^2`/`b^3`/`a^-1`，`normalizeSuperscripts`，含 `⁺⁻⁰¹..⁹`）；`simplifyWord` 合并相邻同生成元
- `wordToCanonicalString`：`a^2 b^{-1}` 规范形式（2 ≤ e < 10 用 `a^e`，其余 `a^{e}`）
- `parsePresentation(text)`：剥 `⟨⟩`/`<>` 包裹，第一个 `|` 或 `;` 切分生成元/关系，`,` 分割，剥离 `= e` 后缀
- **f1=f2 关系归一化**（`buildGroupFromPresentation` 内）：`a=b` 拆两侧，`e=f`/`f=e` 取另一侧，否则转 `f₁·f₂⁻¹`（`ab=ba` → `aba⁻¹b⁻¹`）
- `formatPresentation`：`\langle ${gens.join(', ')} \mid ${rels.join(', ')} \rangle`

## 4. Todd–Coxeter 陪集枚举（runToddCoxeter）

经典表算法：relator 及其逆的所有循环旋转作为扫描（去重）；`define` 新陪集时补对偶项 `rows[v][col^1] = r`（col = 生成元正列 2g / 逆列 2g+1）；主循环为**即时合并**（scanRow 发现 `end ≠ r` 立即 `coalesceRows(r, end)`，保小索引为幸存者，全表引用替换 + 行合并）；表稳定后完整性检查（任何 live 行有未定义项 → `infinite`）。

返回 `TCCResult { status: 'finite'|'infinite'|'overflow'|'unconnected', order, table, alive, wordsByCoset }`；`wordsByCoset` 由 BFS（2k 个正/逆 move）求最短词。

**守卫**：`TC_MAX_COSETS = 3000`（S₅ Coxeter 中间 churn 需 ~3000 总定义，80ms 量级）、`TC_MAX_STEPS = 5_000_000`；持续生长型无限群（如 BS(1,2)、自由积 C₂*C₃）触发上限 → `overflow`。

## 5. buildGroupFromPresentation

`parsePresentation` 文本 → TC → 有限且 `order ≤ PRESENTATION_MAX_ORDER (240)` 时构建 Group：

- 元素 `id = 'p{coset}'`、label = BFS 最短词（identity = 'e'）、`value = [i]`
- `multiply` = 从 e 走 a 的最短词再走 b 的最短词；`inverse` = 反转取负词从 e 走
- 生成元按 `COLOR_PALETTE` 着色，自逆/非自逆由表内对偶项天然保证
- `isAbelian` = 生成元两两交换；`exponent` = lcm(元素阶)；`symbol` = `formatPresentation`
- `isoSymbol` = `detectIsomorphicGroup`（阶 + 阿贝尔 + 阶分布匹配 Cₙ/Dₙ/Cₐ×C_b/V₄/Q₈/A₄/A₅/S₃/S₄/S₅）
- 失败原因 `parse | infinite | overflow | unconnected`（或 `order > maxOrder` → overflow）

## 6. presentationOf（标准展示分发）

顺序：① 已存 `group.presentation` 原样返回 → ② 半直积/商群 → 通用发现器；**直积 → `presentationOfDirectProduct`（因子展示组合：`parseDirectProductParts` 拆符号 → `createGroupFromSymbol` 建因子 → 各因子 `presentationOf` 重映射生成元名（'a'..'h'，超 8 用 `g_{i}`）→ 拼因子关系 + 交叉交换子 `[s,t]` → TC 验证阶=|G| 才返回，失败落发现器）** → ③ symbol 匹配家族正则且阶一致 → 家族展示 → ④ V₄/Q₈ 特例 → ⑤ 其余（含 Aut 群、`C_{3}^{2}` 等）→ 发现器。

| 群 | 展示 |
|----|------|
| Cₙ | `⟨a | a^n⟩` |
| Dₙ | `⟨r, s | r^n, s^2, srsr⟩` |
| Sₙ | Coxeter：`⟨σ₁..σ_{n-1} | σᵢ², (σᵢσᵢ₊₁)³, (σᵢσⱼ)²⟩`（换位生成元按 value 匹配）——**先 TC 验证 finite 且阶一致，失败落发现器**（(2,4,5) 等双曲三角形群展示是无限群，不能盲用） |
| A₃ | `⟨a | a³⟩` |
| A₄/A₅ | 搜索序 2 元 x、序 3 元 y 使 \|xy\| = 3/5 且闭包 = 全群：`⟨x, y | x², y³, (xy)^t⟩` |
| V₄ | `⟨a, b | a², b², abab⟩` |
| Q₈ | `⟨i, j | i⁴, i²j², jij⁻¹i⟩` |
| Aut/其他 | 通用发现器 |

`generatorElements` = `generators[i].apply(identity)`（Sₙ 为构造的换位元素）。

## 7. 通用关系发现器（discoverPresentation）

数学上不可能出错——只收集求值为 e 的单词，TC 阶数 = |G| 即同构：

- 守卫：`order > DISCOVERER_MAX_ORDER (120)` 或生成元数 ∉ 1..4 → null
- 词预算：`maxL = max{L ∈ [5,7,9] : (2k)^L ≤ 40000}`（含正/逆字母，k=1→9、k=2→7、k=3/4→5）
- 枚举全部长度 2..maxL 单词，求值 = identity 的收集（canonical string 去重，cap 200 条）；**生成元符号重复时改用 `abcdefgh`[i] 防歧义**（如 C₃×C₂ 两生成元都叫 '1'）
- 对 L ∈ [5,7,9] 逐步提升：TC(长度 ≤ L 的关系词) finite 且 order = |G| → 返回
- 已知局限：S₄×C₂ 等（k=4, maxL=5）缺长关系会失败 → null

## 8. UI

- **PresentationPanel**（左侧手风琴，图标 ⟨⟩）：两种创建方式 tab——
  - **直接创建**：textarea 输入完整展示（支持 `|` 或 `;` 分隔、`= e` 后缀、`a²`/`a⁻¹` 上标与 `f1=f2` 等式关系）；「创建群」实时校验（失败按 reason 提示），已创建群自动**切树视图**（`activePresentationGroup` 独立状态，不替换左侧当前群）
  - **可视化创建**：1/2/3 生成元模板（⟨a|⟩/⟨a,b|⟩/⟨a,b,c|⟩）→ 逐条输入关系（严格 f=e 或 f1=f2，`parseRelationEquation` 校验；词由生成元组成，支持 ^n、上标与 ⁻¹）→ 确定加入列表（实时 `buildGroupFromPresentation` 校验 |G|、≅、无限判定）→ 「结束并创建群」
  - 已保存列表（点击加载/× 删除）；「✕ 清空当前群（回到模板树）」清除展示群 + 当前群 + 可视化草稿
- **持久化** `presentationStorage.ts`：key `groupviz-presentation-groups`（仅存 generators/relators，加载时重建）+ `groupviz-presentation-draft`（textarea 原文自动保存）
- **RightPanel 群信息栏**：`right.presentation` 行，`presentationOf(currentGroup)` 的 TeX（try/catch 降级隐藏）
- **树视图（退化树）**（`FreeGroupTreeView.tsx` + `cayleyTree.ts`）：商群凯莱图的 BFS 生成树——**实线=生成树边**（首次到达，按生成元 a/b/c 着色）；**粘合边不绘制**（指向已访问元素的边被省略，顶部 bar 以金色「粘合边 ×N」计数呈现——计数越大树「塌缩」越明显）；**布局按群结构规则化**：1 生成元直线（不衰减）、2 生成元交换格（词全形如 a* b*）→ 正方形网格（不衰减）、非交换/自由积 → 谢尔宾斯基十字（层距减半防遮挡）、3 生成元 → 3D（R3F，立方体方向）；**幂折叠**：幂关系（a²=e）下指数按 mod 折叠到同一网格点（a²,b³,ab=ba → 2×3 网格）；**层距**：路径状树（max child ≤ 2）用 0.7 衰减保细节、稠密树用 0.5 防交叉（`stepForDepth(depth, ratio)`）；**genElsOverride**：展示生成元数与群自带生成元不一致时用 `pres.generatorElements` 求值（修复 S₄ Coxeter 3 生成元）；有限群全元素展示（fit 缩放），无群时自由模板树（深度随缩放自适应）；点击节点显示词、缩放/平移/双击复位
- **展示乘法表视图**（`PresentationTableView.tsx`）：乘法表式浏览（列×行），顶部静态展示式 bar；order > 36 采样（cap 20）并显示大群警告
- 创建成功设置 `activePresentationGroup`（独立状态，`?? currentGroup` 回退） + 切 tree 视图 + hint（含 ≅ 同构提示）；失败按 reason 显示对应错误

## 9. 性能守卫汇总

- `PRESENTATION_MAX_ORDER = 240`（构建上限，对齐 FALLBACK_CUTOFF）
- `TC_MAX_COSETS = 3000`、`TC_MAX_STEPS = 5_000_000`
- `DISCOVERER_MAX_ORDER = 120`、`DISCOVERER_RELATOR_CAP = 200`、`DISCOVERER_WORD_BUDGET = 40_000`、`DISCOVERER_LENGTHS = [5, 7, 9]`

## 10. 测试（presentations.test.ts，36 用例）

解析器边界（简化/指数/括号/零指数/非法字符/长符号/**Unicode 上标**）、parsePresentation（包裹/`;`/`= e`）、TC 三态、构建（C₄/D₄/V₄/S₃/A₅ + multiply/inverse 一致性 + 无限/溢出 + **f1=f2 归一化**：`a²=b³` 幂等 + `ab=ba` 上标形式 → C₂×C₃/V₄）、presentationOf 全群族回代（C₆/D₄/S₃/S₄/S₅/A₃/A₄/A₅/V₄/Q₈/Aut(Z₃)/直积/商群/S₃×S₃ 因子组合 + stored 原样 + isGroupPresentation 判定）。

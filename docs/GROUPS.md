# 群实现与代数系统 (Groups & Algebra)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

本文档覆盖有限群的 TypeScript 实现：核心群类型、已实现群族、直积、半直积、自同构、小群注册表与群工厂。

## 1. 核心类型

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
  isoSymbol?: string            // 同构记号（如 V₄ ≅ C₂×C₂）
  automorphismParentSymbol?: string            // 仅自同构群：父群符号
  _automorphismById?: Map<string, Automorphism> // 仅自同构群
  _semidirectProduct?: { normal: Group; acting: Group; phiMap: Map<string, Automorphism> }
}
```

群性质检测函数（`src/core/types.ts`）：

| 函数 | 判定依据 |
|------|---------|
| `isGroupCyclic(group)` | 符号以 C 开头（不含 Z_ 前缀，避免与直积群冲突） |
| `isGroupDihedral(group)` | 符号以 D 开头 |
| `isGroupDirectProduct(group)` | 符号含 `\times`/`^{}`/元素ID含 `\|`，且不含 `\rtimes` |
| `isGroupSemidirectProduct(group)` | 符号含 `\rtimes` |
| `isAutomorphismGroup(group)` | `automorphismParentSymbol` 非空（types.ts 与 automorphisms.ts 各有一份） |
| `analyzeDPFactors(group)` | 解析直积群因子 → `{totalFactors, cyclicCount, allCyclic, symbolParts, isPipeProduct}`，`C` 与 `Z_` 前缀均视为循环因子 |
| `isCyclicFactorKeys(keys)` | 因子键是否为循环序列 |

## 2. 已实现群族

| 群 | 符号 | 阶 | 生成元 | 文件 |
|----|------|-----|--------|------|
| 对称群 Sₙ | Sₙ | n! | (12), (12...n) | `SymmetricGroup.ts` |
| 循环群 Zₙ | Cₙ | n | 1 | `CyclicGroup.ts` |
| 二面体群 Dₙ | Dₙ | 2n | r, s | `DihedralGroup.ts` |
| 交错群 Aₙ | Aₙ | n!/2 | (123), (12)(34) 等 | `AlternatingGroup.ts` |
| Klein四群 V₄ | V₄ | 4 | a, b | `SpecialGroup.ts` |
| 四元数群 Q₈ | Q₈ | 8 | i, j | `SpecialGroup.ts` |
| 一般线性群 GL(2,p) | GL(2, p) | (p²−1)(p²−p) | a=[[1,1],[0,1]], b=[[0,1],[1,0]] | `GeneralLinearGroup.ts` |
| 直积 G×H | G×H | \|G\|·\|H\| | g₁,...,h₁,... | `DirectProduct.ts` |
| 半直积 N⋊H | N \rtimes H | \|N\|·\|H\| | 提升的 N/H 生成元 | `SemidirectProduct.ts` |
| 自同构群 Aut(G) | \operatorname{Aut}(G) | \|Aut(G)\| | greedy 闭包扩张 | `automorphisms.ts` |
| 商群 G/N | G/N | [G:N] | 陪集 | `subgroups.ts` 的 `computeQuotientGroup` |

范围：C₁–C₃₀、D₃–D₁₂、S₂–S₆、A₃–A₅（UI 下拉上限 S₅，S₆ 仅工厂/会话可用）、V₄、Q₈、GL(2,2)、GL(2,3)（GL(2,5)=480 超本地兜底上限，可经「记号导入群」面板走后端 GAP 导入）。

## 3. 直积群 G×H

`createDirectProduct(groupA, groupB)`（`src/core/groups/DirectProduct.ts`）：

- 元素 id 为 `aId|bId`（pipe 分隔），label `(a,b)`，value 拼接
- `multiplyCache`/`inverseCache` Map 缓存
- 生成元提升：A 的生成元保持 B 分量不变；自逆生成元 inverse=self
- 紧凑符号：`parseSymbolFactors` + `buildCompactSymbol`，如 C₃×C₃ → `C_{3}^{2}`；C₄×C₂ 保持 `C_{4} \times C_{2}`
- `exponent = lcm(两因子 exponent)`，`isAbelian = 两因子都阿贝尔`
- UI 限制最大阶 144

**三种构建模式**：`cayley`（基于 Cayley 表）、`table`（乘法表）、`direct`（直接群运算，最快）。

## 4. 半直积群 N ⋊_φ H

`createSemidirectProduct(N, H, phiMap)`（`src/core/groups/SemidirectProduct.ts`）：

- φ 是 H → Aut(N) 的同态；**H.order ≤ 30 时全对验证** φ(h₁h₂)(n) = φ(h₁)(φ(h₂)(n))，违规抛 Error；大 H 跳过验证
- phiMap 缺项回退 identity 自同构（扫描 phiMap 或合成 `id:'id'`）
- 元素 id `n.id|h.id`，label `(n.label,h.label)`；pairMap 索引
- **乘法**：(n₁,h₁)(n₂,h₂) = (n₁·φ(h₁)(n₂), h₁·h₂)
- **逆元**：(n,h)⁻¹ = (φ(h⁻¹)(n⁻¹), h⁻¹)
- 生成元：N 与 H 的生成元各自提升；符号 `N \rtimes_{\phi} H`
- 内部无阶限制；**144 上限由 context 的 `executeSemidirectProduct` 强制**
- 群工厂 `createGroupFromSymbol` 不解析 `\rtimes`，会话恢复依赖 `reconstructSemidirectProduct`（`semidirectProductStorage.ts`）

**半直积状态与 UI**：
- Context：`GroupSemidirectProductContext.tsx`（12 个领域 Provider 之一）——isSemidirectProductMode / sdPanelOpen / sdNormalSubgroup / sdActingGroup / sdAutNGroup / sdAutNList / sdPhiGenMapping / sdPhiFullMap / sdPhiValid / sdSemidirectProductGroups / sdDecompositions / sdActiveDecomposition；Actions：toggleSemidirectProductMode / setSDPanelOpen / setSDNormalSubgroup / setSDActingGroup / computeAutN / setPhiGenMapping / expandPhiFull / executeSemidirectProduct / storeSemidirectProductGroup / loadSemidirectProductGroup / decomposeSemidirectProduct / selectSemidirectDecomposition
- 持久化：localStorage key `'groupviz-sd-groups'`，`StoredSemidirectProduct {id, symbol?, normalSymbol, actingSymbol, phiGenMapping}`
- 面板：`SemidirectProductPanel.tsx`（模式切换 + N/H 选择 + φ 映射 + 创建/群列表/储存 + **半直积分解列表区**）
- 视图：`SemidirectProductView.tsx`——设置模式（H 与 Aut(N) 双 Cayley 图 + φ 箭头）+ 4 步教学动画（H 骨架 → N 副本环重布线 → H 边连接 → 完整乘积）
- 2D 布局：`semidirectProductLayout()`（forceLayout.ts）——|H| 个 N 副本环绕 H 主环，对应 2D 形状 `'rewiring'`；φ(h) 不动点在 GroupCanvas 中青绿高亮

**半直积分解（识别方向，order≤60 守卫）**：
- 算法：`src/core/algebra/semidirectDecompositions.ts`——`findSemidirectDecompositions(group)` 枚举正规子群 N（1<|N|<|G|）+ 互补 H（|H|=|G|/|N| 且 N∩H={e}），φ(h) = 共轭 h·n·h⁻¹（N⊴G 保证闭）；去重（N/H 元素 id 键）+ 排序（verified 优先、|N| 降序）；helper `buildSubgroupGroup`（子群即父群元素，generators 走 `minimalGenerators` 贪心闭包）/`minimalGenerators`/`findAutoByMap`/`verifyPhiHomomorphism`/`buildPhiFromGroup`（读 `_semidirectProduct`）
- 闭环验证：重建 `createSemidirectProduct` → isoSymbol 相等，或**不变量回退**（isAbelian + 元素阶多重集）；S₃ 重建为 D₃（detect 不同名）但不变量相等 → verified
- 面板：分解列表（`N \rtimes_{\phi} H` TeX + |N|/|H| + ✓/✗ 徽标 + 点击 `selectSemidirectDecomposition(i)` 切换）+ 活动分解分裂短正合列 `1 \to N \to G \to H \to 1`

## 5. 自同构群 Aut(G)

`src/core/algebra/automorphisms.ts`：

```typescript
interface Automorphism { id: string; map: Map<string,string>; label: string; apply(el): GroupElement }
```

- `findAllAutomorphisms(group)`：按生成元置换枚举——候选 = 同阶元素；`MAX_COMBINATIONS = 30000` 超出直接返回 `[]`（如 Z₂⁴ 会冻结页面），`MAX_RESULTS = 1000`；DFS + BFS 扩展 + 同态验证 + 核1 + 像全 + 去重。已知数量：|Aut(Z₃)|=2、|Aut(Z₄)|=2、|Aut(Z₅)|=4、|Aut(S₃)|=6、|Aut(V₄)|=6、|Aut(D₄)|=8、|Aut(Q₈)|=24
- `createAutomorphismGroup(group, autos?)`：返回完整 Group——id `auto-i`、identity 在前、循环群标签 α_k（k≥10 用 `\alpha_{k}`）、符号 `\operatorname{Aut}(G)`、乘法 = 复合、inverse = 反转映射、`automorphismParentSymbol`/`_automorphismById`、isoSymbol（如 Aut(Z₃)≅C₂）
- 组件：`AutomorphismPreviewPopup.tsx`（选中 Aut(G) 群单个元素时弹窗：重布线 Cayley 图 + 不动点青绿高亮 + 映射列表）；RightPanel 的 `AutomorphismMappingPanel`；OperationsPanel 的 Aut 标签页
- 持久化：localStorage key `'groupviz-automorphisms'`，仅存元数据 `{id, parentSymbol, order, isoSymbol}`，加载时重建

## 6. 小群预计算注册表

`src/core/groups/SmallGroups.ts` 维护**懒加载预计算注册表**——阶 1..31 的全部 93 个群（GAP 4.16 SmallGroups 库全量导入）：

| 阶 | 群（数量） |
|----|-----|
| 1-7 | C₁, C₂, C₃, C₄, V₄, C₅, C₆, S₃, C₇（9） |
| 8 | C₈, Z₄×Z₂, Z₂³, D₄, Q₈（5） |
| 9-11 | C₉, Z₃×Z₃, C₁₀, D₅, C₁₁（5） |
| 12 | C₁₂, Z₆×Z₂, D₆, A₄, Dic₃（Z₃:C₄）（5） |
| 13-15 | C₁₃, C₁₄, D₇, C₁₅（4） |
| 16 | 14 个（C₁₆, Z₄×Z₄, Z₄×Z₂×Z₂, D₈, QD₁₆, Q₁₆, Z₈×Z₂, Z₄:C₄, Z₈:C₂, Z₂×D₄, Z₂×Q₈, Z₂⁴, (Z₄×Z₂):Z₂, SmallGroup(16,13)） |
| 17-23 | C₁₇, D₉, C₁₈, C₃×S₃, Z₃:C₆, Z₆×Z₃, C₁₉, Z₅:C₄, C₂₀, Z₅:C₄, D₁₀, Z₁₀×Z₂, Z₇:C₃, C₂₁, D₁₁, C₂₂, C₂₃（17） |
| 24 | 15 个（C₂₄, Z₃:C₈, SL(2,3), Z₃:Q₈, Z₄×S₃, D₁₂, Z₂×(Z₃:C₄), (Z₆×Z₂):C₂, Z₁₂×Z₂, Z₃×D₄, Z₃×Q₈, S₄, Z₂×A₄, Z₂×Z₂×S₃, Z₆×Z₂×Z₂） |
| 25-31 | C₂₅, Z₅×Z₅, D₁₃, C₂₆, C₂₇, Z₉×Z₃, (Z₃×Z₃):C₃, Z₉:C₃, Z₃³, Z₇:C₄, C₂₈, D₁₄, Z₁₄×Z₂, C₂₉, Z₅×S₃, Z₃×D₁₀, D₁₅, C₃₀, C₃₁（19） |

数据来源 `src/core/groups/smallGroupData.ts`（`SMALL_GROUP_DATA`，93 条，一次性由 GAP 导出：n=1..31、i=1..NrSmallGroups(n)，字段 {n, i, structure=StructureDescription, abelian, exponent, gens=MinimalGeneratingSet 元素位置, table=乘法表}，元素序 = SortedList(Elements) 且恒等元置首）。阶 1..15 的 27 条沿用原手写工厂（符号/行为不变），阶 16..31 的 65 条 + (12,4) Dic₃ 由 `createTableGroup(order, gapIndex)` 按乘法表构建（元素 id 保留 `g_{i}`，label 用生成元词，生成元名 a/b/c…，apply 右乘）。

- **元素词标签**（`assignWordLabels` / `applyDihedralNormalForm`，SmallGroups.ts）：表驱动群元素不再裸 g_n——建群后先 BFS 沿生成元求最短词标签（恒等元 `e`，词如 `a`、`a b`、`a^{2} b`），D_m 结构再应用二面体正规形（旋转 = `a^{i}` 幂链、反射 = `a^{j} b`，初等 D₄ 印记），与展示群（presentations.ts）标签约定一致；生成元元素标签 = 生成元名，凯莱图作用勾选列表/同态/陪集/循环布局的 label 匹配（`elements.find(e => e.label === gen.name)`、恒等元 `label === 'e'` 检测）全部对齐。id 不变，环序数字排序与 id 键逻辑不受影响。

- **符号生成 `structureToSymbol(n, i, structure)`**：StructureDescription TeX 化（C8→`C_{8}`、D16→`D_{8}`（二面体阶÷2 旋转约定）、C4 x C4→`Z_{4}\times Z_{4}`）；非循环群描述以 C 开头则 C→Z 替换（防 isGroupCyclic 误判）；`:` 保留字面量（不触发 `\rtimes` 判定）。结构描述重复（GAP 无法区分同构类型）时符号回退为 `SmallGroup(n,i)`（(16,3)/(16,13) 与 (20,1)/(20,3)）；(12,4) 的 GAP 描述 'D12' 与 D₁₂ 冲突，强制为 `Z_{3}:C_{4}`（Dic₃）。ensureTable 遇到符号冲突时后注册者改符号（先注册者优先）。
- `getAllSmallGroups()` / `getSmallGroup(order, index=0)` / `getSmallGroupBySymbol(symbol)` / `getPrecomputed(group)`
- `PrecomputedData {subgroups, normalSubgroups, conjugacyClasses, center, isSimple}`——由 `compile()` 预计算（findAllSubgroups/findAllNormalSubgroups/getConjugacyClasses/getGroupCenter/isSimpleGroup）
- 便捷工厂：`createZ4xZ2` / `createZ2xZ2xZ2` / `createZ3xZ3` / `createZ6xZ2`

## 7. 群工厂与会话恢复

`src/utils/groupFactory.ts` 的 `createGroupFromSymbol(symbol): Group | null`：

- 精确匹配特例：`Z_{4}\times Z_{2}`、`Z_{2}^{3}`、`Z_{3}^{2}`、`Z_{6}\times Z_{2}`、`V_{4}`、`Q_{8}`、`GL(2, 2)`/`GL(2,2)`、`GL(2, 3)`/`GL(2,3)`（+旧 Unicode 形式）
- 递归解析：`\times`/`×` 直积、`^{n}` 幂（n≥2）
- 范围：C₁–C₃₀ / Zₙ / D₃–D₁₂ / S₂–S₆ / A₃–A₅，含 `_{n}` 与裸 `n` 两种形式
- 便捷工厂：`createS3()`、`createZ6xZ2()`

> 注意：`createGroupFromSymbol` 不解析 `\rtimes` 与 `\operatorname{Aut}` 符号——半直积与自同构群的会话恢复走各自的 spec 重建路径。

## 8. 代数计算

`src/core/algebra/subgroups.ts`：

| 函数 | 说明 |
|------|------|
| `findAllSubgroups(group, allowLarge?)` | 所有子群（idx 化乘法表 + 循环子群 + pair-join 闭包，order > 60 有守卫，allowLarge 强制计算） |
| `findAllNormalSubgroups(group)` | 正规子群 |
| `getConjugacyClasses(group, allowLarge?)` | 共轭类（order > 60 时每元素单独成类，allowLarge 强制计算） |
| `getGroupCenter(group, allowLarge?)` | 群中心 |
| `getCentralizer(group, elements)` | 中心化子 C_G(E) = {g \| gx = xg, ∀x ∈ E} |
| `getNormalizer(group, elements)` | 正规化子 N_G(E) = {g \| gEg⁻¹ = E} |
| `computeQuotientGroup(group, normalSubgroup)` | 商群 G/N |
| `computeCosets(group, subgroup, type)` | 左/右陪集（CosetInfo） |
| `computeSubgroupLattice(group)` | 子群格（Hasse 图节点/边） |
| `isSimpleGroup(group)` | 单群判定 |
| `computeElementOrderInGroup(group, el)` | 元素阶 |
| `detectIsomorphicGroup(group)` | 与 Cₙ/Dₙ/直积/V₄/Q₈ 候选比对，返回 isoSymbol |

`src/core/algebra/homomorphisms.ts`：`verifyHomomorphism` / `computeKernelFromMapping` / `computeImageFromMapping` / `getHomomorphismProperties`（单射/满射/同构/核阶/像阶）/ `trivialMapping` / `naturalProjectionMapping`（仅 C/Z 循环，要求整除）/ `subgroupInclusionMapping`（注意：非子群元素塌缩到单位元的映射**不是**同态）/ `directProductProjectionMapping`（factorIndex 0\|1）/ `extendFromGenerators`（BFS，覆盖不全返回 null）/ `formatKernelLabel`（单元素→`\{e\}`，>4 含 `\dots`）。

## 9. 关键数学参考

| 定理 | 内容 | 可视化重点 |
|------|------|-----------|
| Lagrange | \|H\| 整除 \|G\| | 陪集划分 |
| Cayley | G ≅ S(G) 子群 | 正则作用 |
| 第一同构 | G/ker ≅ im | 核与像 |
| 轨道-稳定子 | \|G\| = \|O\|·\|S\| | 群作用 |

颜色编码（`COLOR_PALETTE`，16 色）：#ff6b6b(红), #4ecdc4(青), #ffd93d(黄), #a78bfa(紫), #f97316(橙), #06b6d4(天蓝), #84cc16(绿), #f43f5e(玫红), #38bdf8(浅蓝), #a855f7(深紫), #14b8a6(墨绿), #eab308(金), #6366f1(靛蓝), #ec4899(粉), #0ea5e9(蓝), #22c55e(翠绿)。

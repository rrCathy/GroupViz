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
| 直积 G×H | G×H | \|G\|·\|H\| | g₁,...,h₁,... | `DirectProduct.ts` |
| 半直积 N⋊H | N \rtimes H | \|N\|·\|H\| | 提升的 N/H 生成元 | `SemidirectProduct.ts` |
| 自同构群 Aut(G) | \operatorname{Aut}(G) | \|Aut(G)\| | greedy 闭包扩张 | `automorphisms.ts` |
| 商群 G/N | G/N | [G:N] | 陪集 | `subgroups.ts` 的 `computeQuotientGroup` |

范围：C₁–C₃₀、D₃–D₁₂、S₂–S₆、A₃–A₅（UI 下拉上限 S₅，S₆ 仅工厂/会话可用）、V₄、Q₈。

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
- Context：`GroupSemidirectProductContext.tsx`（9 个 Provider 之一）——isSemidirectProductMode / sdNormalSubgroup / sdActingGroup / sdAutNGroup / sdAutNList / sdPhiGenMapping / sdPhiFullMap / sdPhiValid / sdSemidirectProductGroups；Actions：toggleSemidirectProductMode / setSDNormalSubgroup / setSDActingGroup / computeAutN / setPhiGenMapping / expandPhiFull / executeSemidirectProduct / storeSemidirectProductGroup / loadSemidirectProductGroup
- 持久化：localStorage key `'groupviz-sd-groups'`，`StoredSemidirectProduct {id, symbol?, normalSymbol, actingSymbol, phiGenMapping}`
- 面板：`SemidirectProductPanel.tsx`（5 预设：Z₃⋊Z₂≅S₃、Z₄⋊Z₂≅D₄、Z₅⋊Z₂≅D₅、Z₇⋊Z₃ Frobenius、V₄⋊Z₃≅A₄）
- 视图：`SemidirectProductView.tsx`——设置模式（H 与 Aut(N) 双 Cayley 图 + φ 箭头）+ 4 步教学动画（H 骨架 → N 副本环重布线 → H 边连接 → 完整乘积）
- 2D 布局：`semidirectProductLayout()`（forceLayout.ts）——|H| 个 N 副本环绕 H 主环，对应 2D 形状 `'rewiring'`；φ(h) 不动点在 GroupCanvas 中青绿高亮

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

`src/core/groups/SmallGroups.ts` 维护**懒加载预计算注册表**（全部阶 ≤ 15 的群，共 27 条）：

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
| 13 | C₁₃ |
| 14 | C₁₄, D₇ |
| 15 | C₁₅ |

- `getAllSmallGroups()` / `getSmallGroup(order, index=0)` / `getSmallGroupBySymbol(symbol)` / `getPrecomputed(group)`
- `PrecomputedData {subgroups, normalSubgroups, conjugacyClasses, center, isSimple}`——由 `compile()` 预计算（findAllSubgroups/findAllNormalSubgroups/getConjugacyClasses/getGroupCenter/isSimpleGroup）
- 便捷工厂：`createZ4xZ2` / `createZ2xZ2xZ2` / `createZ3xZ3` / `createZ6xZ2`

## 7. 群工厂与会话恢复

`src/utils/groupFactory.ts` 的 `createGroupFromSymbol(symbol): Group | null`：

- 精确匹配特例：`Z_{4}\times Z_{2}`、`Z_{2}^{3}`、`Z_{3}^{2}`、`Z_{6}\times Z_{2}`、`V_{4}`、`Q_{8}`（+旧 Unicode 形式）
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

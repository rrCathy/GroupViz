# 群作用系统 (Group Actions)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

## 1. 数学背景

设 G 是有限群、X 是非空有限集合。G 在 X 上的**作用**（左作用）是满足以下条件的映射 G×X → X（记为 g·x）：

- 单位元作用：e·x = x 对所有 x∈X
- 结合律：g·(h·x) = (gh)·x 对所有 g,h∈G, x∈X

等价地：作用 ⇔ 存在群同态 Φ: G → Sym(X)（定理 9.1，参考《群论彩图版》第 9 章）。

**核心概念**：

| 概念 | 定义 | 记号 |
|------|------|------|
| 轨道 | Orb(x) = { g·x : g∈G }（作用图的不连通分量） | Orb(x) |
| 稳定化子 | Stab(x) = { g∈G : g·x = x }（G 的子群） | Stab(x) |
| 固定点 | 轨道大小为 1 的元素（★ 标记） | X^G |
| 轨道-稳定化子定理 | \|Orb(x)\| · \|Stab(x)\| = \|G\| | OST |

作用图约定（图 9.3）：顶点 = X 的元素，箭头 = **生成元**的作用（非全部元素）；轨道 = 作用图的不连通分量；布局上**稳定元在左、大轨道在右**。

## 2. 作用来源（两种）

| Kind | 描述 | 集合 X | 置换构造 |
|------|------|--------|---------|
| `conjugation` | 共轭作用 | X = G 自身（0..\|G\|-1） | Φ(g)[x] = index(g·G[x]·g⁻¹)，O(\|G\|²) 用 Map 索引 |
| `custom` | 用户自定义 | 用户指定大小 \|X\|（1..20） | 箭头 + 补全 + BFS 扩展（见 §3） |

共轭作用中：轨道 = 共轭类、固定点 = 中心 Z(G)、Stab(x) = 中心化子 C_G(x)。（共轭特化标注为后续待办。）

## 3. 自定义作用（箭头 + 补全 + 校验）

用户交互：点击元素 A 再点击 B → 未绑定箭头 A→B；**生成元 chips 位于元素环左侧竖排**，可点击选中或**拖拽到箭头上**绑定（onDrop → bindArrow）；点击已绑定箭头解绑。编辑模式可随时「退出」（clearAction 清全部作用状态）。

**补全规则**（方案 A）：未指定源的元素 = 不动（自环）。

**合法性检查**（`validateCustomArrows`，顺序敏感）：

1. `unbound` — 箭头未绑定生成元
2. `range` — from/to 越界
3. `unknown-generator` — symbol 不在群生成元中
4. `duplicate-source` — 同生成元同 from 两条
5. `conflict-target` — 同生成元 to 被两个 from 指向
6. `missing-target` — to 不是该生成元任意 from（「该元素需要去向」）

**同态校验**（`extendAndVerifyPerms`）：BFS 从单位元经生成元宽度遍历，Φ(el·gen) 与已算 Φ(el)∘Φ(gen) 比较；不一致 → violation {g, a, x}（第一个不同位置）。O(|G|·k)。违规时 perms 不完整——下游 `computeStabilizers` 对缺失 perm 防御跳过。

## 4. 几何作用（已暂缓，开发思想记录）

> v1.8 开发了「几何对称作用」（多面体顶点 + 生成元旋转 BFS 构造），因视觉效果不佳且与后续排期冲突，已整体移除（代码、i18n、测试、文档）。`polyhedra.ts` 与 `elementRotation.ts` 保留（对称性视图仍在用）。

**开发思想（用户口述，v1.8 记录）**：群 G 作用在几何体 T 上，群元素 a 阶为 n，则应在 T 上寻找 **n 次轴**，再去组织各个轴。这一思路联系到**空间群和点群**（DLC：空间群/点群可视化是路线图远期项），因此现在不开发；未来做几何作用时按此路径重新设计（先实现「按元素阶分配正确对称轴」的框架，而非 BFS 构造）。

**旧方案教训**（避免重蹈）：`elementRotation.ts` 用元素哈希在类型正确的轴池里随机分配轴方向，**不保乘法表**（Φ(g·a) 的哈希轴与 R(g)R(a) 不一致）——逐元素独立旋转必然破坏同构；BFS 构造只对生成元旋转做最近邻匹配，能保证同态合法，但 A₅ 等群的部分生成元哈希轴不是真对称轴（5 阶元 7 轴池含 3 条坐标面轴），仍会失败。

## 5. 核心模块与 API

**纯函数**（`src/core/algebra/actions.ts`，全部可单测）：

```
identityPermutation / composePermutations(先 p2 后 p1) / applyPermutation
inversePermutation / permsEqual / firstDiffIndex
computeConjugationPerms(group)
validateCustomArrows(arrows, n, group) → CustomArrowError?
generatorPermsFromArrows(arrows, n, genSymbols)  // 无箭头生成元初始化为恒等！
extendAndVerifyPerms(group, generatorPerms) → { perms, ok, violation? }
computeOrbits / computeStabilizers / verifyOrbitStabilizer / computeFixedPoints
buildActionComputation(group, def, arrows=[]) → ActionBuildResult
```

**类型**（`src/core/types.ts`）：`GroupActionKind`('conjugation'|'custom')、`GroupActionArrow`{generatorId|null, from, to}、`OrbitInfo`{representative, elements}、`GroupActionComputation`{n, perms: Map<elId, number[]>, orbits, orbitOf, stabilizers, isHomomorphism, violation?}、`GroupActionDef`{kind, setSize?}。

**状态**（`src/context/actions/GroupActionContext.tsx`）：actionKind/actionSetSize/actionArrows/actionEditing/actionComputation/actionError/actionSelectedElement/actionHoverElement；动作 createConjugationAction/startCustomAction/addArrow/bindArrow/removeArrow/replaceGenArrows/clearArrows/completeCustomAction/setActionSelectedElement/setActionHoverElement/clearAction。群切换时 prevGroupRef 重置（queueMicrotask）。

## 6. 视图（轨道视图，`src/components/Canvas/ActionView.tsx`）

- 轨道簇布局：按大小升序左→右（固定点 ★ 簇最左，呼应书中「稳定元在左」）；簇内环形排列，半径 max(52, size·14)，节点半径 28
- 只画**生成元**有向边（书中作用图约定），自环隐藏；边色 = 生成元色（COLOR_PALETTE）
- 顶部固定 banner（视口绝对定位，不随画布动）：第一行作用由来（共轭：g·x = g·x·g⁻¹，轨道=共轭类），第二行动态边解释（hover 图例/元素/选中时联动变金色）
- 图例可 hover：高亮该生成元边、淡化其余（genEdges 三态）
- hover 群元素 chip → 临时显示该元素全部作用箭头（金色，含自环小圆）
- 点击集合元素 x → 所在簇发光 + 右侧面板显示 |Orb(x)|、|Stab(x)|、OST 等式、Stab(x) 成员
- 显示模式元素用 TeX 标签（共轭作用，元素=群元素）或数字 1..n（自定义）
- 自定义编辑模式：|X| 元素围圈、生成元 chips 左侧竖排（可拖拽/点击）、虚线未绑定箭头、红字错误提示
- 视图 2000×2000 viewBox，随 GroupCanvas 平移缩放；FloatingViewWindow 中包 SvgPanZoom
- isTooLarge 阈值 120（与 symmetry/sublattice 同级）

## 7. 面板

- **左侧**（GroupActionPanel，HomomorphismPanel 之后）：两个来源按钮（共轭/自定义）+ |X| 输入（1..20）+ 编辑模式箭头列表/错误/完成并验证/清除/**退出**（clearAction）+ 非编辑模式「轨道视图 →」入口与「清除」
- **右侧**（RightPanel，action 视图且有计算时）：作用类型、同态校验 ✓/✗、violation、|X|、轨道数+大小列表、Σ|Orb|=|X| 检查、稳定元数、选中元素 OST 详情

## 8. 性能守卫

- 自定义 |X| ≤ 20（UI 输入限制）
- 同态校验 O(|G|·k)，A₅ 级（60 元素）即时
- 共轭作用 O(|G|²) Map 索引，S₅ (120) 级即时

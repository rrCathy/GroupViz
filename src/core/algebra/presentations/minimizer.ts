import type { Group, GroupElement, GroupPresentation, PresentationTerm } from '../../types'
import { runToddCoxeter } from './toddCoxeter'
import { canonicalCyclicForm, simplifyWord, wordToCanonicalString } from './wordParser'

export const DISCOVERER_MAX_ORDER = 120
// relator 候选截断：需容纳共轭组合词（a³b²a 型）之外的关键长关系
// （QD16 的 (ba)⁴ 长 8——200 名额会被 ≤5 terms 的共轭词占满挤出；
// TC 对千级 relators × ≤8 terms 扫描很快，2000 安全）。
export const DISCOVERER_RELATOR_CAP = 2000
// 词长预算：4^8 = 65536 ≤ 70000 → k=2 群可枚举到长度 8 的关系
// （QD16 等的生成元关系 a⁸ 长度恰为 8；旧预算 40000 只能枚举到长度 7 → 识别失败）。
export const DISCOVERER_WORD_BUDGET = 70_000
// 验证长度序列：k≥2 时 maxL≤8（4⁸=65536 已达预算上限，9 层 4⁹=262144 不可达，被循环内
// L > maxL 守卫自动跳过，无空转）；L=9 仅对 k=1 生效（2⁹=512 ≤ 预算，覆盖 C₁₈/⟨a²⟩≅C₉
// 一类长度为 9 的关系）。偶数长度（8）覆盖 a⁸ 类关系，奇数上界（7）覆盖 b⁻¹aba⁻³ 类。
export const DISCOVERER_LENGTHS = [5, 7, 8, 9] as const

// 发现器结果缓存：同一 symbol+order+生成元数的群，其展示恒定。
// presentationOf 被信息栏/树视图/乘法表视图在每次渲染时反复调用，
// 全量枚举（2 生成元 4⁸=65536 词）+ 极小化每次约 1.6s，缓存避免重复计算。
// 仅缓存结构（generators/relators），generatorElements 每次按当前群重新求值。
// 键含乘法表指纹：防御同符号不同表（如重映射重建的同构群）静默命中错误展示。
const DISCOVERY_CACHE = new Map<string, { generators: string[]; relators: string[] }>()

// 轻量乘法表指纹：折叠前 min(order,16) 行 × 全列的乘积 id（FNV-1a 32 位）。
// 成本 ≤16·order 次 multiply（order=240 时约 4k 次查找，微秒级），足以区分不同表的群。
function tableFingerprint(group: Group): number {
  let h = 2166136261
  const rows = Math.min(group.order, 16)
  for (let i = 0; i < rows; i++) {
    const a = group.elements[i]
    for (let j = 0; j < group.order; j++) {
      const uid = group.multiply(a, group.elements[j]).id
      for (let k = 0; k < uid.length; k++) {
        h = ((h ^ uid.charCodeAt(k)) * 16777619) >>> 0
      }
    }
  }
  return h
}

/**
 * 平凡复合关系过滤：若简化词的某个真前缀（逐符号展开）也为 identity，
 * 则该词是更短关系的平凡拼接（如 a⁴b² = e·e），可由更短关系推出 → 冗余。
 * 不过滤时这类词会挤满 RELATOR_CAP 名额，把 (ba)⁴ 等关键长关系挤出
 * （QD16 = ⟨a⁴, b², (ba)⁴⟩ 的 (ba)⁴ 即因此无法识别）。
 */
function isRedundantRelator(
  group: Group,
  terms: PresentationTerm[],
  genEls: GroupElement[],
  invEls: GroupElement[]
): boolean {
  const syms: { g: number; e: number }[] = []
  for (const t of terms) {
    const step = t.e > 0 ? 1 : -1
    for (let i = 0; i < Math.abs(t.e); i++) syms.push({ g: t.g, e: step })
  }
  let pre = group.identity
  for (let i = 0; i < syms.length - 1; i++) {
    pre = group.multiply(pre, syms[i].e > 0 ? genEls[syms[i].g] : invEls[syms[i].g])
    if (pre.id === group.identity.id) return true
  }
  return false
}

export function discoverPresentation(group: Group): GroupPresentation | null {
  if (group.order > DISCOVERER_MAX_ORDER) return null
  const k = group.generators.length
  if (k === 0 || k > 4) return null
  const rawSyms = group.generators.map(g => g.symbol || g.name)
  const genSyms =
    new Set(rawSyms).size === rawSyms.length
      ? rawSyms
      : rawSyms.map((_, i) => (i < 26 ? String.fromCharCode(97 + i) : `g_{${i}}`))
  let maxL = -1
  for (const L of DISCOVERER_LENGTHS) {
    if (Math.pow(2 * k, L) <= DISCOVERER_WORD_BUDGET) maxL = L
  }
  if (maxL < 5) return null

  const genEls = group.generators.map(g => g.apply(group.identity))
  const invEls = genEls.map(el => group.inverse(el))
  const relatorSet = new Map<string, PresentationTerm[]>()

  const cur: PresentationTerm[] = []
  const rec = (depth: number, el: GroupElement) => {
    if (depth >= 2 && el.id === group.identity.id) {
      // 先简化词（合并相邻同生成元、消去 aa⁻¹ 平凡对）再入集合：
      // 不简化时平凡词（a a^{-1} 等）会挤满 relator 排序前列，
      // 长关系（如 QD16 的 a⁸）被 RELATOR_CAP 截断挤出 → 识别失败
      const simplified = simplifyWord(cur)
      if (simplified.length > 0 && !isRedundantRelator(group, simplified, genEls, invEls)) {
        // 循环旋转/逆折叠：同一共轭类的词统一到字典序最小形式再入集合，
        // 将数百条共轭冗余词折叠为少数规范词，供贪心极小化快速收敛
        const cyc = canonicalCyclicForm(simplified, genSyms)
        const key = wordToCanonicalString(cyc, genSyms)
        if (!relatorSet.has(key)) relatorSet.set(key, cyc)
      }
    }
    if (depth >= maxL) return
    for (let g = 0; g < k; g++) {
      cur.push({ g, e: 1 })
      rec(depth + 1, group.multiply(el, genEls[g]))
      cur.pop()
      cur.push({ g, e: -1 })
      rec(depth + 1, group.multiply(el, invEls[g]))
      cur.pop()
    }
  }
  rec(0, group.identity)

  const relators = [...relatorSet.values()]
    .sort((a, b) => a.length - b.length)
    .slice(0, DISCOVERER_RELATOR_CAP)
  if (relators.length === 0) return null

  for (const L of DISCOVERER_LENGTHS) {
    if (L > maxL) continue
    const subset = relators.filter(t => t.length <= L)
    if (subset.length === 0) continue
    const tcFull = runToddCoxeter(genSyms, subset)
    if (tcFull.status === 'finite' && tcFull.order === group.order) {
      // 贪心极小化（保留必要关系）：TC 已确认全子集阶 = |G|。
      // 保护 K 条最短关系（K = 生成元数，即生成元阶关系如 QD16 的 a⁴、b²），
      // 其余词从长到短逐个尝试移除——移除后 TC 阶仍 = |G| 才移除。
      // 这样 QD16 展示 ⟨a⁴, b², (ba)⁴⟩ 而非数百条共轭冗余词。
      const protectN = Math.min(k, subset.length)
      const byLen = [...subset].sort((a, b) => a.length - b.length)
      const protectedSet = new Set(byLen.slice(0, protectN))
      const working = byLen.slice(protectN).sort((a, b) => b.length - a.length)
      const maxAttempts = Math.min(working.length, 300)
      const t0min = Date.now()
      for (let i = 0; i < maxAttempts; i++) {
        if (Date.now() - t0min > 1500) break // 预算守卫：极小化累计超时则中止，返回当前集
        const candidate = [...protectedSet, ...working.filter((_, j) => j !== i)]
        const tc2 = runToddCoxeter(genSyms, candidate)
        if (tc2.status === 'finite' && tc2.order === group.order) {
          working.splice(i, 1)
          i--
        }
      }
      const final = [...protectedSet, ...working]
      return {
        generators: genSyms,
        relators: final.map(t => wordToCanonicalString(t, genSyms)),
        generatorElements: genEls,
      }
    }
  }
  return null
}

export function discoverPresentationCached(group: Group): GroupPresentation | null {
  const key = `${group.symbol}|${group.order}|${group.generators.length}|${tableFingerprint(group)}`
  const cached = DISCOVERY_CACHE.get(key)
  if (cached) {
    return {
      generators: cached.generators,
      relators: cached.relators,
      generatorElements: group.generators.map(g => g.apply(group.identity)),
    }
  }
  const d = discoverPresentation(group)
  if (d) DISCOVERY_CACHE.set(key, { generators: d.generators, relators: d.relators })
  return d
}

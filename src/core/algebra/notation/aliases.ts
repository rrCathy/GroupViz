/**
 * 反向查询：给定一个群，列出它所有的「别名」写法。
 *
 * 用途：UI 上告诉用户「你现在看的这个群，也叫 F₂₁ / C₇⋊C₃ / SmallGroup(21,1)」，
 * 让宿主与读者能把眼前的对象和文献里的记号对上。
 *
 * 别名来源（按可靠性排序）：
 *   1. 群自身的 symbol（引擎规范名，永远第一）
 *   2. 同构类标准名 detectIsomorphicGroup —— 注意它是**启发式**的（阶分布 +
 *      交换性，不是真同构算法），与引擎内 isoSymbol 口径一致
 *   3. 幂 ⇄ 直积的等价写法：S_{3}^{2} ⇄ S_{3}\times S_{3}
 *   4. 专名反查：C_{7}:C_{3} → F_{21}、QD_{16} → QD16、C_{3}:C_{4} → Dic_{3}
 *   5. 同阶注册表里同构的其它群符号（仅在 |G| ≤ 31 时做，逐候选比 isomorph 类名）
 *
 * **不做** SmallGroup(n,i) 编号反查：registry 只给「符号冲突而改名」的少数群存了
 * GAP 编号，其余群的 (n,i) 不在运行时数据里，硬猜会给出错误编号。
 */
import type { Group } from '../../types'
import { detectIsomorphicGroup } from '../subgroups'
import { getAllSmallGroups } from '../../groups/SmallGroups'

/** 静态专名反查（规范符号 → 别名写法）。与 canonical.ts 的专名表互为逆向。 */
const NAMED_REVERSE: Record<string, string[]> = {
  'QD_{16}': ['QD16', 'QD_16'],
  'V_{4}': ['Klein', 'K4', 'V4'],
  'C_{3}:C_{4}': ['Dic_{3}'],
}

/** registry 的「阶 → 符号列表」索引（惰性、只建一次）。 */
let indexCache: Map<number, string[]> | null = null
function symbolIndex(): Map<number, string[]> {
  if (!indexCache) {
    indexCache = new Map()
    for (const e of getAllSmallGroups()) {
      const o = e.group.order
      if (!indexCache.has(o)) indexCache.set(o, [])
      indexCache.get(o)!.push(e.group.symbol)
    }
  }
  return indexCache
}

/** 仅供测试：清空索引缓存。 */
export function resetAliasIndexCache(): void {
  indexCache = null
}

/** X^{k} → X\times X\times …（k 次）。非幂形态返回 null。 */
function expandPower(symbol: string): string | null {
  const m = /^(.+)\^\{(\d+)\}$/.exec(symbol)
  if (!m) return null
  const k = Number(m[2])
  if (k < 2) return null
  return Array.from({ length: k }, () => m[1]).join('\\times')
}

/** 同因子的直积折叠：C_{2}\times C_{2}\times C_{3} → C_{2}^{2}\times C_{3}。 */
function foldEqualFactors(symbol: string): string | null {
  const parts = symbol.split('\\times')
  if (parts.length < 2) return null
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const p of parts) {
    if (!counts.has(p)) order.push(p)
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  if (order.every((b) => counts.get(b) === 1)) return null
  return order.map((b) => {
    const c = counts.get(b)!
    return c > 1 ? `${b}^{${c}}` : b
  }).join('\\times')
}

/** C_p:C_q 且该阶在注册表里唯一 → Frobenius 专名 F_{|G|}。 */
function frobeniusAlias(symbol: string, order: number): string | null {
  if (!/^C_\{(\d+)\}:C_\{(\d+)\}$/.test(symbol)) return null
  const candidates = (symbolIndex().get(order) ?? []).filter((s) => /^C_\{(\d+)\}:C_\{(\d+)\}$/.test(s))
  return candidates.length === 1 ? `F_{${order}}` : null
}

const aliasCache = new Map<string, string[]>()

/**
 * 列出一个群的全部别名（含自身 symbol，去重、保持优先级顺序）。
 * 结果按 symbol 缓存——同阶候选的 isomorph 判定有成本，UI 会反复查同一个群。
 */
export function getGroupAliases(group: Group): string[] {
  const cached = aliasCache.get(group.symbol)
  if (cached) return cached

  const out: string[] = []
  const push = (s: string | null | undefined) => {
    if (s && !out.includes(s)) out.push(s)
  }

  push(group.symbol)

  // 同构类标准名（启发式，与引擎 isoSymbol 同口径）
  const iso = group.isoSymbol ?? detectIsomorphicGroup(group) ?? undefined
  push(iso)

  // 幂 ⇄ 直积
  for (const s of [...out]) {
    push(expandPower(s))
    push(foldEqualFactors(s))
  }

  // 专名反查
  for (const s of [...out]) {
    for (const named of NAMED_REVERSE[s] ?? []) push(named)
    push(frobeniusAlias(s, group.order))
  }

  // 同阶注册表里同构的其它群（|G| ≤ 31 才有注册表）
  if (group.order >= 1 && group.order <= 31 && iso) {
    for (const e of getAllSmallGroups()) {
      if (e.group.order !== group.order) continue
      if (out.includes(e.group.symbol)) continue
      const otherIso = e.group.isoSymbol ?? detectIsomorphicGroup(e.group)
      if (otherIso && otherIso === iso) push(e.group.symbol)
    }
  }

  aliasCache.set(group.symbol, out)
  return out
}

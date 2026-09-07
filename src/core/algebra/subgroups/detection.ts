import type { Group, GroupElement } from '../../types'
import { createDihedralGroup } from '../../groups/DihedralGroup'
import { createSymmetricGroup } from '../../groups/SymmetricGroup'
import { createAlternatingGroup } from '../../groups/AlternatingGroup'
import { createQuaternion } from '../../groups/SpecialGroup'

export function computeElementOrderInGroup(el: GroupElement, group: Group): number {
  let current = el
  let ord = 0
  do {
    current = group.multiply(current, el)
    ord++
    if (ord > group.order) return group.order
  } while (current.id !== el.id)
  return ord
}

function getOrderDistribution(group: Group): Map<number, number> {
  const dist = new Map<number, number>()
  for (const el of group.elements) {
    const ord = computeElementOrderInGroup(el, group)
    dist.set(ord, (dist.get(ord) ?? 0) + 1)
  }
  return dist
}

export function distributionsEqual(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false
  }
  return true
}

function eulerPhi(n: number): number {
  let result = n
  let x = n
  for (let p = 2; p * p <= x; p++) {
    if (x % p === 0) {
      while (x % p === 0) x /= p
      result -= result / p
    }
  }
  if (x > 1) result -= result / x
  return result
}

// All chains [d1, ..., dk] with d1 | d2 | ... | dk and product = n.
// Each chain is an abelian invariant tuple; distinct chains = distinct
// abelian groups of order n (finite abelian classification theorem).
export function abelianFactorChains(n: number): number[][] {
  const out: number[][] = []
  const rec = (rem: number, upper: number, chain: number[]): void => {
    if (rem === 1) {
      out.push(chain)
      return
    }
    for (let d = 2; d <= rem; d++) {
      if (rem % d === 0 && upper % d === 0) {
        rec(rem / d, d, [d, ...chain])
      }
    }
  }
  if (n === 1) return [[1]]
  rec(n, n, [])
  return out
}

// Order distribution of C_{d1} x ... x C_{dk}: count(o) = sum over
// e_i | d_i with lcm(e_1..e_k) = o of prod phi(e_i).
export function abelianChainDistribution(ds: number[]): Map<number, number> {
  const dist = new Map<number, number>()
  const rec = (i: number, lcmVal: number, acc: number): void => {
    if (i === ds.length) {
      dist.set(lcmVal, (dist.get(lcmVal) ?? 0) + acc)
      return
    }
    const d = ds[i]
    for (let e = 1; e <= d; e++) {
      if (d % e !== 0) continue
      const g = gcd(e, lcmVal)
      rec(i + 1, (e / g) * lcmVal, acc * eulerPhi(e))
    }
  }
  rec(0, 1, 1)
  return dist
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

// Exact identification for abelian groups via the finite abelian
// classification theorem: a finite abelian group is determined up to
// isomorphism by its order distribution, and chains d1|d2|...|dk with
// product n enumerate all abelian groups of order n.
function abelianTypeFromDistribution(n: number, dist: Map<number, number>): string | null {
  for (const chain of abelianFactorChains(n)) {
    if (distributionsEqual(dist, abelianChainDistribution(chain))) {
      return chain.map(d => `C_{${d}}`).join('\\times ')
    }
  }
  return null
}

export function detectAbelianType(group: Group): string | null {
  if (!group.isAbelian) return null
  return abelianTypeFromDistribution(group.order, getOrderDistribution(group))
}

/** 候选识别表：非阿贝尔情形按阶分布比对这些已知群（与 Visual Group Theory 约定一致） */
function candidateTests(order: number): Array<{ symbol: string; factory: () => Group | null }> {
  const tests: Array<{ symbol: string; factory: () => Group | null }> = []
  if (order >= 6 && order % 2 === 0) {
    const dN = order / 2
    tests.push({ symbol: `D_{${dN}}`, factory: () => createDihedralGroup(dN) })
  }
  if (order === 8) tests.push({ symbol: 'Q_{8}', factory: createQuaternion })
  if (order === 12) tests.push({ symbol: 'A_{4}', factory: () => createAlternatingGroup(4) })
  if (order === 60) tests.push({ symbol: 'A_{5}', factory: () => createAlternatingGroup(5) })
  if (order === 6) tests.push({ symbol: 'S_{3}', factory: () => createSymmetricGroup(3) })
  if (order === 24) tests.push({ symbol: 'S_{4}', factory: () => createSymmetricGroup(4) })
  if (order === 120) tests.push({ symbol: 'S_{5}', factory: () => createSymmetricGroup(5) })
  return tests
}

/** 候选群的阶分布缓存（子群结构符号在悬停时高频调用，避免反复建群） */
const candidateDistCache = new Map<string, { abelian: boolean; dist: Map<number, number> }>()

/**
 * 纯数据识别：给定阶、是否阿贝尔、阶分布，比对已知群。
 * detectIsomorphicGroup（吃 Group 对象）与子群结构符号（只有元素 id 集合）共用。
 */
function identifyByDistribution(
  order: number,
  abelian: boolean,
  dist: Map<number, number>
): string | null {
  if (abelian) {
    const ab = abelianTypeFromDistribution(order, dist)
    if (ab) return ab
  }
  for (const { symbol, factory } of candidateTests(order)) {
    let cached = candidateDistCache.get(symbol)
    if (!cached) {
      try {
        const candidate = factory()
        if (!candidate || candidate.order !== order) continue
        cached = { abelian: candidate.isAbelian, dist: getOrderDistribution(candidate) }
        candidateDistCache.set(symbol, cached)
      } catch {
        continue
      }
    }
    if (cached.abelian !== abelian) continue
    if (distributionsEqual(dist, cached.dist)) return symbol
  }
  return null
}

export function detectIsomorphicGroup(quotientGroup: Group): string | null {
  const qOrder = quotientGroup.order
  const qAbelian = quotientGroup.isAbelian
  return identifyByDistribution(qOrder, qAbelian, getOrderDistribution(quotientGroup))
}

/**
 * 子群的结构符号（`C_{2}\\times C_{4}` / `D_{4}` / `A_{4}` …），只需母群 + 子群元素 id。
 *
 * 子群格节点不持有独立 Group 对象，故这里在母群上就地算该子集的阶分布与交换性，
 * 再套用与 detectIsomorphicGroup 相同的判定。代价 O(|H|²)，仅供悬停/选中时惰性调用
 * （视图侧按键缓存），不进主渲染循环。无法识别返回 null，调用方回落到 |H|=n。
 */
export function subgroupStructureSymbol(
  group: Group,
  elementIds: string[]
): string | null {
  const n = elementIds.length
  if (n === 0) return null
  if (n === 1) return 'C_{1}'
  const byId = new Map<string, GroupElement>()
  for (const el of group.elements) byId.set(el.id, el)
  const subset: GroupElement[] = []
  for (const id of elementIds) {
    const el = byId.get(id)
    if (!el) return null
    subset.push(el)
  }
  const dist = new Map<number, number>()
  for (const el of subset) {
    const ord = computeElementOrderInGroup(el, group)
    dist.set(ord, (dist.get(ord) ?? 0) + 1)
  }
  if (dist.size === 2 && (dist.get(1) ?? 0) === 1 && (dist.get(n) ?? 0) === n - 1) {
    return `C_{${n}}` // 循环群快速通道（免 O(n²) 交换性检查）
  }
  let isAbelian = true
  outer: for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (group.multiply(subset[i], subset[j]).id !== group.multiply(subset[j], subset[i]).id) {
        isAbelian = false
        break outer
      }
    }
  }
  return identifyByDistribution(n, isAbelian, dist)
}

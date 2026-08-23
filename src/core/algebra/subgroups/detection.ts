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
export function detectAbelianType(group: Group): string | null {
  if (!group.isAbelian) return null
  const n = group.order
  const dist = getOrderDistribution(group)
  for (const chain of abelianFactorChains(n)) {
    if (distributionsEqual(dist, abelianChainDistribution(chain))) {
      return chain.map(d => `C_{${d}}`).join('\\times ')
    }
  }
  return null
}

export function detectIsomorphicGroup(quotientGroup: Group): string | null {
  const qOrder = quotientGroup.order
  const qAbelian = quotientGroup.isAbelian

  if (qAbelian) {
    return detectAbelianType(quotientGroup)
  }

  const qDist = getOrderDistribution(quotientGroup)

  const tests: Array<{ symbol: string; factory: () => Group | null }> = []

  if (qOrder >= 6 && qOrder % 2 === 0) {
    const dN = qOrder / 2
    tests.push({ symbol: `D_{${dN}}`, factory: () => createDihedralGroup(dN) })
  }

  if (qOrder === 8) tests.push({ symbol: 'Q_{8}', factory: createQuaternion })
  if (qOrder === 12) tests.push({ symbol: 'A_{4}', factory: () => createAlternatingGroup(4) })
  if (qOrder === 60) tests.push({ symbol: 'A_{5}', factory: () => createAlternatingGroup(5) })
  if (qOrder === 6) tests.push({ symbol: 'S_{3}', factory: () => createSymmetricGroup(3) })
  if (qOrder === 24) tests.push({ symbol: 'S_{4}', factory: () => createSymmetricGroup(4) })
  if (qOrder === 120) tests.push({ symbol: 'S_{5}', factory: () => createSymmetricGroup(5) })

  const seen = new Set<string>()
  for (const { symbol, factory } of tests) {
    if (seen.has(symbol)) continue
    seen.add(symbol)
    try {
      const candidate = factory()
      if (!candidate || candidate.order !== qOrder) continue
      if (candidate.isAbelian !== qAbelian) continue
      const cDist = getOrderDistribution(candidate)
      if (distributionsEqual(qDist, cDist)) {
        return symbol
      }
    } catch {
      continue
    }
  }

  return null
}

import type { Group, GroupElement } from '../types'
import { closeUnderMultiply, computeElementOrderInGroup } from './subgroups'

export interface SylowSubgroupInfo {
  elements: GroupElement[]
  generators: GroupElement[]
  order: number
  isNormal: boolean
}

export interface PSubgroupInfo extends SylowSubgroupInfo {
  isSylow: boolean
}

export interface SylowPrimeInfo {
  p: number
  k: number
  pPower: number
  m: number
  np: number
  subgroups: SylowSubgroupInfo[]
  congruentModP: boolean
  dividesM: boolean
  isNormal: boolean
}

export interface SylowAnalysis {
  order: number
  factors: { prime: number; exponent: number }[]
  primes: SylowPrimeInfo[]
}

export const SYLOW_MAX_ORDER = 240

export function factorizeOrder(n: number): { prime: number; exponent: number }[] {
  const factors: { prime: number; exponent: number }[] = []
  let remaining = n
  for (let p = 2; p * p <= remaining; p++) {
    if (remaining % p !== 0) continue
    let exponent = 0
    while (remaining % p === 0) {
      remaining /= p
      exponent++
    }
    factors.push({ prime: p, exponent })
  }
  if (remaining > 1) factors.push({ prime: remaining, exponent: 1 })
  return factors
}

/**
 * Enumerates all Sylow p-subgroups of a group without enumerating all
 * subgroups: collect p-subgroups (closure of p-power-order elements under
 * pair-join), then keep the maximal ones of order p^k. Completeness follows
 * from the fixed-point join closure; correctness of maximality is guarded by
 * the Sylow theorems themselves and verified numerically in tests.
 */
export function findSylowSubgroups(group: Group, p: number): SylowSubgroupInfo[] {
  const pPower = largestPowerOfP(group.order, p)
  if (pPower === 1) return []
  return collectPSubgroups(group, p).filter(sub => sub.length === pPower).map(sub => ({
    elements: sub.map(i => group.elements[i]),
    generators: findMinimalGenerators(sub.map(i => group.elements[i]), group),
    order: pPower,
    isNormal: isNormalIdx(group, sub),
  }))
}

function largestPowerOfP(n: number, p: number): number {
  let pPower = 1
  let rest = n
  while (rest % p === 0) {
    rest /= p
    pPower *= p
  }
  return pPower
}

/**
 * Collects all non-trivial p-subgroups (order a power of p) as index arrays:
 * cyclic p-subgroups from each p-element, then BFS pair-join closure.
 */
function collectPSubgroups(group: Group, p: number): number[][] {
  const n = group.order
  const pPower = largestPowerOfP(n, p)
  const elems = group.elements
  const idToIdx = new Map<string, number>()
  for (let i = 0; i < n; i++) idToIdx.set(elems[i].id, i)
  const table: number[][] = new Array(n)
  const invIdx: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const row = new Array(n)
    for (let j = 0; j < n; j++) row[j] = idToIdx.get(group.multiply(elems[i], elems[j]).id) ?? 0
    table[i] = row
    invIdx[i] = idToIdx.get(group.inverse(elems[i]).id) ?? 0
  }

  function keyOf(els: number[]): string {
    return els.slice().sort((a, b) => a - b).join(',')
  }

  function closeIdx(seed: number[]): number[] {
    const result: number[] = []
    const resultSet = new Set<number>()
    for (const x of seed) {
      if (!resultSet.has(x)) {
        resultSet.add(x)
        result.push(x)
      }
    }
    let changed = true
    while (changed) {
      changed = false
      const curLen = result.length
      for (let i = 0; i < curLen; i++) {
        const row = table[result[i]]
        for (let j = i; j < curLen; j++) {
          const prod = row[result[j]]
          if (!resultSet.has(prod)) {
            resultSet.add(prod)
            result.push(prod)
            changed = true
          }
        }
      }
    }
    return result
  }

  function isPGroupIdx(els: number[]): boolean {
    let size = els.length
    while (size > 1 && size % p === 0) size /= p
    return size === 1
  }

  const pSubgroups: number[][] = []
  const seen = new Set<string>()

  function addSubgroup(idx: number[]): boolean {
    const key = keyOf(idx)
    if (seen.has(key)) return false
    seen.add(key)
    pSubgroups.push(idx)
    return true
  }

  // Phase 1: cyclic p-subgroups, one per p-element (skip identity)
  const identityIdx = idToIdx.get(group.identity.id) ?? 0
  for (let i = 0; i < n; i++) {
    if (i === identityIdx) continue
    const ord = computeElementOrderInGroup(elems[i], group)
    let o = ord
    while (o > 1 && o % p === 0) o /= p
    if (o !== 1) continue
    const cyc: number[] = []
    const cycSeen = new Set<number>()
    let cur = i
    while (!cycSeen.has(cur)) {
      cycSeen.add(cur)
      cyc.push(cur)
      cur = table[cur][i]
    }
    addSubgroup(cyc)
  }

  // Phase 2: BFS pair-join closure restricted to p-subgroups
  let frontier = pSubgroups.slice()
  while (frontier.length > 0) {
    const next: number[][] = []
    for (const h of frontier) {
      const hSet = new Set(h)
      for (const cand of pSubgroups) {
        if (h === cand) continue
        let unionSize = h.length
        for (const c of cand) {
          if (!hSet.has(c)) unionSize++
          if (unionSize > pPower) break
        }
        if (unionSize > pPower) continue
        const join = closeIdx(h.concat(cand))
        if (join.length <= pPower && isPGroupIdx(join)) {
          if (addSubgroup(join)) next.push(join)
        }
      }
    }
    frontier = next
  }

  return pSubgroups
}

function isNormalIdx(group: Group, sub: number[]): boolean {
  const n = group.order
  const elems = group.elements
  const idToIdx = new Map<string, number>()
  for (let i = 0; i < n; i++) idToIdx.set(elems[i].id, i)
  const subSet = new Set(sub)
  for (let g = 0; g < n; g++) {
    for (const h of sub) {
      const gh = idToIdx.get(group.multiply(elems[g], elems[h]).id) ?? 0
      const conj = idToIdx.get(group.multiply(elems[gh], group.inverse(elems[g])).id) ?? 0
      if (!subSet.has(conj)) return false
    }
  }
  return true
}

/**
 * All non-trivial p-subgroups of G (order a power of p), including Sylow
 * p-subgroups, sorted by order descending so Sylow subgroups come first.
 */
export function findAllPSubgroups(group: Group, p: number): PSubgroupInfo[] {
  const pPower = largestPowerOfP(group.order, p)
  if (pPower === 1) return []
  const all = collectPSubgroups(group, p)
  return all
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(sub => ({
      elements: sub.map(i => group.elements[i]),
      generators: findMinimalGenerators(sub.map(i => group.elements[i]), group),
      order: sub.length,
      isNormal: isNormalIdx(group, sub),
      isSylow: sub.length === pPower,
    }))
}

/** Greedy minimal generating set (largest orders first, for readable labels). */
export function findMinimalGenerators(elements: GroupElement[], group: Group): GroupElement[] {
  const sorted = elements
    .slice()
    .sort((a, b) => computeElementOrderInGroup(b, group) - computeElementOrderInGroup(a, group))
  const gens: GroupElement[] = []
  for (const el of sorted) {
    if (gens.length === 0) {
      gens.push(el)
      continue
    }
    const closure = closeUnderMultiply(group, gens)
    if (closure.some(c => c.id === el.id)) continue
    gens.push(el)
  }
  return gens
}

/** g·H·g⁻¹ as a sorted element list. */
export function conjugateSubgroup(
  group: Group,
  elements: GroupElement[],
  g: GroupElement
): GroupElement[] {
  const invG = group.inverse(g)
  const result: GroupElement[] = []
  const seen = new Set<string>()
  for (const h of elements) {
    const conj = group.multiply(group.multiply(g, h), invG)
    if (!seen.has(conj.id)) {
      seen.add(conj.id)
      result.push(conj)
    }
  }
  return result
}

/**
 * Conjugation action of G on the set of Sylow p-subgroups (Second Sylow
 * theorem: transitive — one orbit of size n_p). Used by ActionView.
 */
export function sylowConjugationPerms(
  group: Group,
  subgroups: SylowSubgroupInfo[]
): Map<string, number[]> {
  const np = subgroups.length
  if (np === 0) return new Map()
  const keyToIdx = new Map<string, number>()
  for (let i = 0; i < np; i++) {
    keyToIdx.set(
      subgroups[i].elements.map(e => e.id).slice().sort().join(','),
      i
    )
  }
  const perms = new Map<string, number[]>()
  for (const g of group.elements) {
    const invG = group.inverse(g)
    const perm = new Array<number>(np)
    for (let j = 0; j < np; j++) {
      let idx = keyToIdx.get(
        subgroups[j].elements
          .map(h => group.multiply(group.multiply(g, h), invG).id)
          .slice()
          .sort()
          .join(',')
      )
      if (idx === undefined) {
        // Fallback containment scan (should never trigger)
        const target = new Set(
          subgroups[j].elements.map(h => group.multiply(group.multiply(g, h), invG).id)
        )
        idx = subgroups.findIndex(
          sg => sg.elements.length === target.size && sg.elements.every(el => target.has(el.id))
        )
      }
      perm[j] = idx
    }
    perms.set(g.id, perm)
  }
  return perms
}

export function computeSylowAnalysis(group: Group, allowLarge = false): SylowAnalysis | null {
  if (group.order > SYLOW_MAX_ORDER && !allowLarge) return null
  const factors = factorizeOrder(group.order)
  const primes = factors.map(f => {
    const { prime: p, exponent: k } = f
    let pPower = 1
    for (let i = 0; i < k; i++) pPower *= p
    const m = group.order / pPower
    const subgroups = findSylowSubgroups(group, p)
    const np = subgroups.length
    return {
      p,
      k,
      pPower,
      m,
      np,
      subgroups,
      congruentModP: np % p === 1,
      dividesM: m % np === 0,
      isNormal: np === 1,
    }
  })
  return { order: group.order, factors, primes }
}

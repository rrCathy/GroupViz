import type { Group, GroupElement } from '../types'
import { SERIES_MAX_ORDER } from '../guards'

// Re-exported for backwards compatibility; the canonical definition lives in
// core/guards.ts alongside every other engine guard constant.
export { SERIES_MAX_ORDER }

import { findAllSubgroups, abelianChainDistribution, abelianFactorChains, distributionsEqual } from './subgroups'
import { commutatorClosure, computeGroupProperties } from './properties'

// Subgroup series: normal series, central series (upper/lower), composition
// series, and their factors. All computations are local and guarded by
// SERIES_MAX_ORDER (matching the Sylow / fallback cutoffs used elsewhere).

export type SeriesType = 'derived' | 'upperCentral' | 'lowerCentral' | 'composition'

export interface SeriesFactor {
  order: number
  isAbelian: boolean
  isSimple: boolean
  label: string
}

export interface SubgroupSeries {
  type: SeriesType
  /** Descending chain N_0 = G ⊇ N_1 ⊇ … ⊇ N_k = {e} (or the terminal term when incomplete). */
  terms: GroupElement[][]
  /** factors[i] = terms[i] / terms[i+1] */
  factors: SeriesFactor[]
  reachesTrivial: boolean
  reachesFull: boolean
  solvable: boolean
  nilpotent: boolean
  /** Number of distinct composition series (composition type only). */
  alternativeCount: number
  truncated: boolean
}

function sameSet(a: GroupElement[], b: GroupElement[]): boolean {
  if (a.length !== b.length) return false
  const ids = new Set(a.map(e => e.id))
  return b.every(e => ids.has(e.id))
}

function isSubset(a: GroupElement[], b: GroupElement[]): boolean {
  const ids = new Set(b.map(e => e.id))
  return a.every(e => ids.has(e.id))
}

function elementKey(elements: GroupElement[]): string {
  return elements.map(e => e.id).sort().join(',')
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false
  return true
}

// H ◁ M (conjugation by elements of M; both subsets of group G).
export function isNormalSubgroupIn(group: Group, M: GroupElement[], H: GroupElement[]): boolean {
  if (H.length === 1 && H[0].id === group.identity.id) return true
  const hSet = new Set(H.map(e => e.id))
  for (const m of M) {
    const mInv = group.inverse(m)
    for (const h of H) {
      if (!hSet.has(group.multiply(group.multiply(m, h), mInv).id)) return false
    }
  }
  return true
}

// All maximal proper normal subgroups of M (normal within M), restricted to
// the given candidate subgroups of G.
function maximalProperNormalSubgroups(
  group: Group,
  M: GroupElement[],
  candidates: GroupElement[][]
): GroupElement[][] {
  const result: GroupElement[][] = []
  for (const H of candidates) {
    if (H.length >= M.length || H.length < 1) continue
    if (!isSubset(H, M)) continue
    if (!isNormalSubgroupIn(group, M, H)) continue
    let isMaximal = true
    for (const K of candidates) {
      if (K === H || K.length <= H.length || K.length >= M.length) continue
      if (!isSubset(K, M)) continue
      if (!isNormalSubgroupIn(group, M, K)) continue
      if (isSubset(H, K)) {
        isMaximal = false
        break
      }
    }
    if (isMaximal) result.push(H)
  }
  return result
}

// Canonical choice for a deterministic chain: prefer subgroups normal in the
// ambient group G, then larger order, then lexicographic element ids.
function pickCanonical(group: Group, maximal: GroupElement[][]): GroupElement[] {
  const preferred = maximal.filter(H => isNormalSubgroupIn(group, group.elements, H))
  const pool = preferred.length > 0 ? preferred : maximal
  return sortDeterministic(pool)[0]
}

function sortDeterministic(list: GroupElement[][]): GroupElement[][] {
  return [...list].sort(
    (a, b) => b.length - a.length || elementKey(a).localeCompare(elementKey(b))
  )
}

// Order of g·N in the quotient N_i/N_{i+1}.
function quotientElementOrder(group: Group, g: GroupElement, small: Set<string>): number {
  let cur = g
  let k = 1
  while (!small.has(cur.id)) {
    cur = group.multiply(cur, g)
    k++
  }
  return k
}

function computeFactor(
  group: Group,
  big: GroupElement[],
  small: GroupElement[],
  isComposition: boolean
): SeriesFactor {
  const order = big.length / small.length
  const smallSet = new Set(small.map(e => e.id))

  // Quotient is abelian iff every commutator of big lies in small.
  let isAbelian = true
  outer: for (const a of big) {
    for (const b of big) {
      const c = group.multiply(group.multiply(group.multiply(a, b), group.inverse(a)), group.inverse(b))
      if (!smallSet.has(c.id)) {
        isAbelian = false
        break outer
      }
    }
  }

  let label: string
  if (isAbelian) {
    // Exact identification via the finite abelian classification theorem:
    // match the quotient's order distribution against every invariant-factor
    // chain d1|d2|...|dk with product = order. This is correct even for
    // rank >= 3 quotients (C_2^4 etc.), where the old two-term heuristic
    // produced wrong structure labels like C_2 x C_8.
    const dist = new Map<number, number>()
    for (const g of big) {
      const ord = quotientElementOrder(group, g, smallSet)
      dist.set(ord, (dist.get(ord) ?? 0) + 1)
    }
    // Each coset of small contributes |small| representatives with the same
    // order, so normalize counts to get the quotient's actual order
    // distribution (e.g. S3  A3   C2: {1:3,2:3} -> {1:1,2:1}).
    const distQ = new Map<number, number>()
    for (const [ord, c] of dist) {
      if (c % small.length !== 0) return { order, isAbelian: true, isSimple: isComposition ? order > 1 : isPrime(order), label: `G_{${order}}` }
      distQ.set(ord, c / small.length)
    }
    let matched: string | null = null
    for (const chain of abelianFactorChains(order)) {
      if (distributionsEqual(distQ, abelianChainDistribution(chain))) {
        matched = chain.map(d => `C_{${d}}`).join(' \\times ')
        break
      }
    }
    label = matched ?? `G_{${order}}`
  } else if (order === 8) {
    let involutions = 0
    for (const g of big) if (quotientElementOrder(group, g, smallSet) === 2) involutions++
    label = involutions === 1 ? 'Q_8' : 'D_4'
  } else if (order % 2 === 0 && isPrime(order / 2)) {
    label = `D_{${order / 2}}`
  } else if (order === 12) {
    let has6 = false
    for (const g of big) if (quotientElementOrder(group, g, smallSet) === 6) {
      has6 = true
      break
    }
    label = has6 ? 'D_6' : 'A_4'
  } else if (order === 60 && isComposition) {
    label = 'A_5'
  } else {
    label = `G_{${order}}`
  }

  const isSimple = isComposition ? order > 1 : isPrime(order)
  return { order, isAbelian, isSimple, label }
}

function buildFactors(group: Group, terms: GroupElement[][], isComposition: boolean): SeriesFactor[] {
  const factors: SeriesFactor[] = []
  for (let i = 0; i + 1 < terms.length; i++) {
    factors.push(computeFactor(group, terms[i], terms[i + 1], isComposition))
  }
  return factors
}

// Factors of an arbitrary descending chain (used to render alternative
// composition-series chains, whose factor multiset is unique by J–H).
export function computeChainFactors(
  group: Group,
  terms: GroupElement[][],
  isComposition: boolean
): SeriesFactor[] {
  return buildFactors(group, terms, isComposition)
}

/**
 * Computes a subgroup series of the given type:
 * - derived: canonical normal series G ⊇ G′ ⊇ G″ ⊇ … (quotients abelian ⇔ solvable)
 * - lowerCentral: γ₁=G, γₖ₊₁=[G,γₖ]; reaches {e} ⇔ nilpotent
 * - upperCentral: Z₀={e}, Zₖ₊₁/Zₖ = Z(G/Zₖ); reaches G ⇔ nilpotent
 * - composition: greedy maximal-normal chain; factors are simple (Jordan–Hölder)
 *
 * Returns null when the group exceeds SERIES_MAX_ORDER.
 */
export function computeSubgroupSeries(group: Group, type: SeriesType): SubgroupSeries | null {
  if (group.order > SERIES_MAX_ORDER) return null
  const props = computeGroupProperties(group, true)
  const trivial = [group.identity]

  let terms: GroupElement[][] = []
  let reachesTrivial = true
  let reachesFull = false
  let alternativeCount = 0
  let truncated = false

  if (type === 'derived') {
    const derived = props?.derivedSeries ?? [group.elements]
    terms = derived.slice()
    reachesTrivial = sameSet(derived[derived.length - 1], trivial)
    if (!reachesTrivial && !sameSet(terms[terms.length - 1], trivial)) terms.push(trivial)
  } else if (type === 'lowerCentral') {
    terms = [group.elements]
    let lower = group.elements
    for (;;) {
      const next = commutatorClosure(group, group.elements, lower)
      if (next.length === 1) {
        terms.push(trivial)
        reachesTrivial = true
        break
      }
      if (sameSet(next, lower)) {
        terms.push(trivial)
        reachesTrivial = false
        break
      }
      terms.push(next)
      lower = next
    }
  } else if (type === 'upperCentral') {
    const ascending: GroupElement[][] = [trivial]
    let z = trivial
    for (;;) {
      const next: GroupElement[] = []
      const zSet = new Set(z.map(e => e.id))
      for (const g of group.elements) {
        let central = true
        for (const x of group.elements) {
          const c = group.multiply(group.multiply(group.multiply(g, x), group.inverse(g)), group.inverse(x))
          if (!zSet.has(c.id)) {
            central = false
            break
          }
        }
        if (central) next.push(g)
      }
      if (next.length === group.order) {
        ascending.push(next)
        reachesFull = true
        break
      }
      if (sameSet(next, z)) break
      ascending.push(next)
      z = next
    }
    terms = [...ascending].reverse()
    reachesTrivial = true
  } else {
    const subgroups = findAllSubgroups(group, true)
    const candidates = [group.elements, ...subgroups.map(s => s.elements)]
    const chain: GroupElement[][] = [group.elements]
    let cur = group.elements
    while (cur.length > 1) {
      const maximal = maximalProperNormalSubgroups(group, cur, candidates)
      if (maximal.length === 0) break
      cur = pickCanonical(group, maximal)
      chain.push(cur)
    }
    if (!sameSet(chain[chain.length - 1], trivial)) chain.push(trivial)
    terms = chain
    reachesTrivial = true
    const enumerated = enumerateCompositionSeries(group, 20)
    if (enumerated) {
      alternativeCount = enumerated.chains.length
      truncated = enumerated.truncated
    }
  }

  const factors = buildFactors(group, terms, type === 'composition')
  const solvable = type === 'derived' ? reachesTrivial : (props?.solvable ?? false)
  const nilpotent = type === 'lowerCentral'
    ? reachesTrivial
    : type === 'upperCentral'
      ? reachesFull
      : (props?.nilpotent ?? false)

  return {
    type,
    terms,
    factors,
    reachesTrivial,
    reachesFull,
    solvable,
    nilpotent,
    alternativeCount,
    truncated,
  }
}

/**
 * Enumerates ALL composition series (Jordan–Hölder): the chain may not be
 * unique (e.g. V₄ has 3), but the multiset of factors is unique up to order.
 * Stops after maxChains chains. Returns null above SERIES_MAX_ORDER.
 */
export function enumerateCompositionSeries(
  group: Group,
  maxChains = 20
): { chains: GroupElement[][][]; truncated: boolean } | null {
  if (group.order > SERIES_MAX_ORDER) return null
  const subgroups = findAllSubgroups(group, true)
  const candidates = [group.elements, ...subgroups.map(s => s.elements)]
  const trivial = [group.identity]

  const chains: GroupElement[][][] = []
  let truncated = false

  function dfs(cur: GroupElement[], chain: GroupElement[][]) {
    if (chains.length >= maxChains) {
      truncated = true
      return
    }
    if (cur.length === 1) {
      chains.push(chain)
      return
    }
    const maximal = sortDeterministic(maximalProperNormalSubgroups(group, cur, candidates))
    if (maximal.length === 0) {
      dfs(trivial, [...chain, trivial])
      return
    }
    for (const H of maximal) dfs(H, [...chain, H])
  }

  dfs(group.elements, [group.elements])
  return { chains, truncated }
}

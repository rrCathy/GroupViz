import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE, isGroupDirectProduct, isGroupSemidirectProduct } from '../types'
import type { Automorphism } from './automorphisms'
import {
  findAllNormalSubgroups,
  findAllSubgroups,
  closeUnderMultiply,
  computeElementOrderInGroup,
  detectIsomorphicGroup,
  type Subgroup,
} from './subgroups'
import { createSemidirectProduct } from '../groups/SemidirectProduct'

export interface SemidirectDecomposition {
  normal: Group
  acting: Group
  phiMap: Map<string, Automorphism>
}

export interface SemidirectDecompositionCandidate {
  normal: Group
  acting: Group
  normalElements: GroupElement[]
  actingElements: GroupElement[]
  phiMap: Map<string, Automorphism>
  /** Whether rebuilding G ≅ N ⋊_φ H reproduces the isomorphism class of G */
  verified: boolean
  rebuiltIsoSymbol: string | null
  sourceIsoSymbol: string | null
}

/**
 * Find the automorphism in `autos` whose map exactly equals `targetMap`.
 * Returns null when no match exists, or when either side is empty.
 */
export function findAutoByMap(
  autos: Automorphism[],
  targetMap: Map<string, string> | null | undefined
): Automorphism | null {
  if (!targetMap || targetMap.size === 0 || autos.length === 0) return null
  for (const auto of autos) {
    if (auto.map.size !== targetMap.size) continue
    let match = true
    for (const [k, v] of targetMap) {
      if (auto.map.get(k) !== v) {
        match = false
        break
      }
    }
    if (match) return auto
  }
  return null
}

function makeIdentityAuto(N: Group): Automorphism {
  return {
    id: 'auto-identity',
    map: new Map(N.elements.map(e => [e.id, e.id])),
    label: '\\mathrm{id}',
    apply: (el) => el,
  }
}

function samplePairs(H: Group): Array<[GroupElement, GroupElement]> {
  if (H.order <= 30) {
    return H.elements.flatMap(h1 => H.elements.map(h2 => [h1, h2] as [GroupElement, GroupElement]))
  }
  const gens = H.generators
    .map(g => g.apply(H.identity))
    .filter(el => el.id !== H.identity.id)
  const h1s = [H.identity, ...gens]
  const out: Array<[GroupElement, GroupElement]> = []
  for (const h1 of h1s) {
    for (const h2 of H.elements) out.push([h1, h2])
  }
  return out
}

function sampleNs(N: Group): GroupElement[] {
  if (N.order <= 40) return N.elements
  const gens = N.generators
    .map(g => g.apply(N.identity))
    .filter(el => el.id !== N.identity.id)
  return [N.identity, ...gens, ...N.elements.slice(0, 20)]
}

/**
 * Verify that φ : H → Aut(N) is a group homomorphism:
 *   φ(h1·h2) = φ(h1) ∘ φ(h2)   (composition applies φ(h2) first, matching
 *   createAutomorphismGroup's multiply and createSemidirectProduct's convention).
 * All pairs of H are checked when |H| ≤ 30, otherwise (identity ∪ generators) × H.
 * Missing φ entries fall back to the identity automorphism (same as createSemidirectProduct).
 */
export function verifyPhiHomomorphism(N: Group, H: Group, phiMap: Map<string, Automorphism>): boolean {
  const identityAuto = makeIdentityAuto(N)
  const getPhi = (hId: string): Automorphism => phiMap.get(hId) ?? identityAuto

  for (const [h1, h2] of samplePairs(H)) {
    const h1h2 = H.multiply(h1, h2)
    const phi12 = getPhi(h1h2.id)
    const phi1 = getPhi(h1.id)
    const phi2 = getPhi(h2.id)
    for (const n of sampleNs(N)) {
      // φ(h1·h2)(n) vs φ(h1)(φ(h2)(n))
      const lhs = phi12.map.get(n.id) ?? n.id
      const mid = phi2.map.get(n.id) ?? n.id
      const rhs = phi1.map.get(mid) ?? mid
      if (lhs !== rhs) return false
    }
  }
  return true
}

/**
 * Extract the canonical semidirect decomposition recorded at construction time
 * (group._semidirectProduct). Returns null for groups that are not semidirect products.
 */
export function buildPhiFromGroup(group: Group): SemidirectDecomposition | null {
  const spec = group._semidirectProduct
  if (!spec) return null
  return { normal: spec.normal, acting: spec.acting, phiMap: spec.phiMap }
}

/**
 * Greedy minimal generating set for a subgroup described by `elements`
 * (its elements are objects of the parent group). Seeds with higher element
 * order are preferred (they span larger subgroups), ties broken by id.
 * Returns [] for the trivial subgroup.
 */
export function minimalGenerators(group: Group, elements: GroupElement[]): GroupElement[] {
  if (elements.length <= 1) return []
  const target = new Set(elements.map(e => e.id))
  const idOf = group.identity.id

  const candidates = elements
    .filter(e => e.id !== idOf)
    .sort((a, b) => {
      const oa = computeElementOrderInGroup(a, group)
      const ob = computeElementOrderInGroup(b, group)
      if (oa !== ob) return ob - oa
      return a.id.localeCompare(b.id, undefined, { numeric: true })
    })

  let kept: GroupElement[] = []
  const covers = (seeds: GroupElement[]): boolean => {
    const closure = closeUnderMultiply(group, seeds)
    return closure.length === target.size && closure.every(e => target.has(e.id))
  }

  for (const c of candidates) {
    if (covers([...kept, c])) {
      kept.push(c)
      break
    }
    if (closeUnderMultiply(group, [...kept, c]).length > kept.length + 1) {
      kept.push(c)
    }
  }

  // Trim pass: drop seeds that are no longer needed
  let i = 0
  while (i < kept.length) {
    const without = kept.filter((_, j) => j !== i)
    if (covers(without)) {
      kept = without
    } else {
      i++
    }
  }
  return kept
}

/**
 * Build a Group whose elements are a subset of the parent's elements.
 * multiply/inverse/identity are inherited from the parent (subgroup elements
 * are the parent's element objects), so ids stay consistent across groups.
 * Generators are taken from `generators` when given (must be minimal
 * generators), otherwise computed via minimalGenerators.
 */
export function buildSubgroupGroup(
  parent: Group,
  elements: GroupElement[],
  symbol: string,
  generators?: GroupElement[]
): Group {
  const elById = new Map(elements.map(e => [e.id, e]))
  const genEls = generators && generators.length > 0 ? generators : minimalGenerators(parent, elements)

  const genObjs: Generator[] = genEls.map((g, i) => {
    const color = COLOR_PALETTE[i % COLOR_PALETTE.length]
    const invEl = parent.inverse(g)
    const makeGen = (gen: GroupElement, suffix: string): Generator => ({
      name: `${gen.label}${suffix}`,
      symbol: `${gen.label}${suffix}`,
      color,
      apply: (el: GroupElement) => elById.get(parent.multiply(el, gen).id)!,
      inverse: undefined as unknown as Generator,
    })
    const genObj = makeGen(g, '')
    if (g.id === invEl.id) {
      genObj.inverse = genObj
    } else {
      const invObj = makeGen(invEl, '^{-1}')
      genObj.inverse = invObj
      invObj.inverse = genObj
    }
    return genObj
  })

  let isAbelian = true
  outer: for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i]
      const b = elements[j]
      if (parent.multiply(a, b).id !== parent.multiply(b, a).id) {
        isAbelian = false
        break outer
      }
    }
  }

  return {
    name: symbol,
    symbol,
    order: elements.length,
    elements,
    generators: genObjs,
    multiply: parent.multiply,
    inverse: parent.inverse,
    identity: parent.identity,
    isAbelian,
  }
}

/** Conjugation automorphism of N induced by h ∈ H: n ↦ h·n·h⁻¹ (valid since N ⊴ G) */
function conjugationAuto(group: Group, N: Group, h: GroupElement): Automorphism {
  const map = new Map<string, string>()
  for (const n of N.elements) {
    map.set(n.id, group.multiply(group.multiply(h, n), group.inverse(h)).id)
  }
  return {
    id: `decomp-${h.id}`,
    map,
    label: `\\phi(${h.label})`,
    apply: (el: GroupElement) => group.multiply(group.multiply(h, el), group.inverse(h)),
  }
}

function orderDistributionKey(group: Group): string {
  const counts = new Map<number, number>()
  for (const el of group.elements) {
    const ord = computeElementOrderInGroup(el, group)
    counts.set(ord, (counts.get(ord) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v}`)
    .join(',')
}

function sameInvariants(a: Group, b: Group): boolean {
  if (a.isAbelian !== b.isAbelian) return false
  return orderDistributionKey(a) === orderDistributionKey(b)
}

function genSymbol(gens: GroupElement[]): string {
  if (gens.length === 0) return '\\{e\\}'
  return `\\langle ${gens.map(g => g.label).join(', ')} \\rangle`
}

/**
 * Human-readable TeX symbol for a subgroup: cyclic subgroups get C_{order},
 * otherwise a recognized group type (V_4, D_{3}, A_{4}, …) via
 * detectIsomorphicGroup, falling back to the generator-angle-bracket form.
 */
function subgroupTypeSymbol(sub: Group): string {
  if (sub.generators.length === 1) return `C_{${sub.order}}`
  const detected = detectIsomorphicGroup(sub)
  if (detected) return detected
  return genSymbol(sub.generators.map(g => g.apply(sub.identity)))
}

/**
 * Enumerate all decompositions G ≅ N ⋊_φ H:
 *  - N ⊴ G proper nontrivial normal subgroup,
 *  - H ≤ G with |H| = |G|/|N| and N ∩ H = {e} (then NH = G automatically),
 *  - φ(h) = conjugation by h restricted to N (well-defined because N ⊴ G).
 * Each candidate is rebuilt via createSemidirectProduct and compared to G by
 * isoSymbol (fallback: isAbelian + element-order distribution) → `verified`.
 * Candidates are deduplicated by the (N, H) element sets and sorted with
 * verified decompositions first, then by |N| descending.
 * Returns [] for groups of order > 60 (subgroup enumeration guard).
 */
export function findSemidirectDecompositions(
  group: Group,
  allowLarge = false
): SemidirectDecompositionCandidate[] {
  if (group.order > 60) return []

  const normals = findAllNormalSubgroups(group)
    .filter(n => n.order > 1 && n.order < group.order)
  if (normals.length === 0) return []

  const allSubgroups = findAllSubgroups(group, allowLarge)
  const byOrder = new Map<number, Subgroup[]>()
  for (const sg of allSubgroups) {
    const list = byOrder.get(sg.order) ?? []
    list.push(sg)
    byOrder.set(sg.order, list)
  }

  const identityId = group.identity.id
  const sourceIsoSymbol = group.isoSymbol ?? detectIsomorphicGroup(group)
  const candidates: SemidirectDecompositionCandidate[] = []
  const seenKeys = new Set<string>()

  for (const nSub of normals) {
    const hOrder = group.order / nSub.order
    const hSubs = byOrder.get(hOrder) ?? []
    for (const hSub of hSubs) {
      // N ∩ H must be exactly {e}
      const hSet = new Set(hSub.elements.map(e => e.id))
      let intersects = false
      for (const n of nSub.elements) {
        if (n.id !== identityId && hSet.has(n.id)) {
          intersects = true
          break
        }
      }
      if (intersects) continue

      const nKey = nSub.elements.map(e => e.id).sort().join(',')
      const hKey = hSub.elements.map(e => e.id).sort().join(',')
      const key = `${nKey}|${hKey}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const nGens = minimalGenerators(group, nSub.elements)
      const hGens = minimalGenerators(group, hSub.elements)
      const N = buildSubgroupGroup(group, nSub.elements, genSymbol(nGens), nGens)
      const H = buildSubgroupGroup(group, hSub.elements, genSymbol(hGens), hGens)
      const nSymbol = subgroupTypeSymbol(N)
      const hSymbol = subgroupTypeSymbol(H)
      N.name = nSymbol
      N.symbol = nSymbol
      H.name = hSymbol
      H.symbol = hSymbol

      const phiMap = new Map<string, Automorphism>()
      for (const h of H.elements) {
        phiMap.set(h.id, conjugationAuto(group, N, h))
      }

      let rebuilt: Group | null = null
      try {
        rebuilt = createSemidirectProduct(N, H, phiMap)
      } catch {
        rebuilt = null
      }

      let rebuiltIsoSymbol: string | null = null
      let verified = false
      if (rebuilt) {
        rebuiltIsoSymbol = rebuilt.isoSymbol ?? detectIsomorphicGroup(rebuilt)
        verified = (sourceIsoSymbol !== null && sourceIsoSymbol === rebuiltIsoSymbol)
          || sameInvariants(group, rebuilt)
      }

      candidates.push({
        normal: N,
        acting: H,
        normalElements: nSub.elements,
        actingElements: hSub.elements,
        phiMap,
        verified,
        rebuiltIsoSymbol,
        sourceIsoSymbol,
      })
    }
  }

  candidates.sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1
    return b.normal.order - a.normal.order
  })
  return candidates
}

export type GroupStructureType = 'direct' | 'semidirect' | 'indecomposable' | 'unknown'

export function detectStructureType(group: Group): GroupStructureType {
  if (group._semidirectProduct) return 'semidirect'
  if (isGroupDirectProduct(group)) return 'direct'
  if (group.order > 60) return 'unknown'

  const normals = findAllNormalSubgroups(group).filter(
    (n) => n.order > 1 && n.order < group.order,
  )
  for (let i = 0; i < normals.length; i++) {
    const a = normals[i]
    for (let j = i + 1; j < normals.length; j++) {
      const b = normals[j]
      if (a.order * b.order !== group.order) continue
      if (intersectsAtIdentity(group, a.elements, b.elements)) continue
      return 'direct'
    }
  }

  if (findSemidirectDecompositions(group).length > 0) return 'semidirect'
  return 'indecomposable'
}

function intersectsAtIdentity(group: Group, xs: GroupElement[], ys: GroupElement[]): boolean {
  const ysSet = new Set(ys.map((y) => y.id))
  const identityId = group.identity.id
  for (const x of xs) {
    if (x.id !== identityId && ysSet.has(x.id)) return true
  }
  return false
}

// ─── Shared semidirect-product metadata (rewiring shape) ────────────────

export interface SemidirectProductMeta {
  normal: Group
  acting: Group
  phiMap: Map<string, Automorphism>
}

/** Split a symbol at its top-level ':' (bracket depth 0), stripping brackets. */
function splitTopLevelColon(symbol: string): [string, string] | null {
  let depth = 0
  for (let i = 0; i < symbol.length; i++) {
    const ch = symbol[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ':' && depth === 0) {
      const left = symbol.slice(0, i).trim()
      const right = symbol.slice(i + 1).trim()
      const strip = (s: string) => (s.startsWith('(') && s.endsWith(')') ? s.slice(1, -1) : s)
      return [strip(left), strip(right)]
    }
  }
  return null
}

/** Order of a compact group token like 'C_{3}', 'D_{4}', 'S_{3}', 'Q_{8}', 'C_{2}^{3}'. */
function factorOrderFromToken(token: string): number | null {
  const m = token.match(/^([A-Za-z]+)(?:_\{(\d+)\})?(?:\^\{(\d+)\})?$/)
  if (!m) return null
  const base = m[1]
  const sub = m[2] ? parseInt(m[2], 10) : 0
  const power = m[3] ? parseInt(m[3], 10) : 1
  let order: number | null
  if (base === 'C') order = sub || 1
  else if (base === 'D') order = sub ? 2 * sub : null
  else if (base === 'S') order = sub ? factorial(sub) : null
  else if (base === 'A') order = sub ? factorial(sub) / 2 : null
  else if (base === 'Q') order = sub === 8 ? 8 : sub ? 4 * sub : null
  else return null
  if (order === null) return null
  let result = 1
  for (let i = 0; i < power; i++) result *= order
  return result
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** Parse 'L:R' from a GAP-style symbol, e.g. 'C_{3}:C_{4}' → [3, 4]. */
function parseSemiDirectSymbolPair(symbol: string): [number, number] | null {
  const pair = splitTopLevelColon(symbol)
  if (!pair) return null
  const orders: number[] = []
  for (const side of pair) {
    const tokens = side.split('\\times').map((t) => t.trim()).filter(Boolean)
    if (tokens.length === 0) return null
    let product = 1
    for (const token of tokens) {
      const o = factorOrderFromToken(token)
      if (o === null) return null
      product *= o
    }
    orders.push(product)
  }
  return [orders[0], orders[1]]
}

/**
 * Resolve the (N, H, φ) structure of a semidirect-product group.
 * Pipe semidirect products (created via createSemidirectProduct) carry
 * _semidirectProduct directly; registered groups written in GAP ':' notation
 * (e.g. '(C_{4}\times C_{2}):C_{2}') have no metadata, so their canonical
 * decomposition is recovered via findSemidirectDecompositions (verified first).
 * Groups without semidirect-product notation return null.
 */
export function getSemidirectProductMeta(group: Group): SemidirectProductMeta | null {
  const spec = group._semidirectProduct
  if (spec) return spec
  if (!isGroupSemidirectProduct(group)) return null
  const decs = findSemidirectDecompositions(group)
  const pair = parseSemiDirectSymbolPair(group.symbol)
  const bySymbol = pair
    ? decs.find((d) => d.normal.order === pair[0] && d.acting.order === pair[1])
    : undefined
  const dec = bySymbol ?? decs.find((d) => d.verified) ?? decs[0]
  if (!dec) return null
  return { normal: dec.normal, acting: dec.acting, phiMap: dec.phiMap }
}

/**
 * Decompose every element of G into its unique (n, h) pair with g = n·h.
 * Pipe groups (element ids like 'a|b') are split by id suffix matching;
 * registered groups are decomposed algebraically via g·h⁻¹ ∈ N (valid
 * because N ⊴ G, N ∩ H = {e} and |N|·|H| = |G|). Returns null when the
 * decomposition fails to cover all elements.
 */
export function semidirectFactorMap(
  group: Group,
  sd: SemidirectProductMeta
): Map<string, { n: GroupElement; h: GroupElement }> | null {
  const { normal: N, acting: H } = sd
  const nIds = new Set(N.elements.map((e) => e.id))
  const result = new Map<string, { n: GroupElement; h: GroupElement }>()
  const isPipe = group.elements.length > 0 && group.elements[0].id.includes('|')

  if (isPipe) {
    const nById = new Map(N.elements.map((e) => [e.id, e]))
    for (const el of group.elements) {
      let found: { n: GroupElement; h: GroupElement } | null = null
      for (const h of H.elements) {
        if (!el.id.endsWith(`|${h.id}`)) continue
        const nId = el.id.slice(0, el.id.length - h.id.length - 1)
        const n = nById.get(nId)
        if (n) {
          found = { n, h }
          break
        }
      }
      if (!found) return null
      result.set(el.id, found)
    }
    return result
  }

  const hById = new Map(H.elements.map((e) => [e.id, e]))
  for (const el of group.elements) {
    let found: { n: GroupElement; h: GroupElement } | null = null
    for (const h of H.elements) {
      const hInv = H.inverse(h)
      const n = group.multiply(el, hInv)
      if (nIds.has(n.id)) {
        found = { n, h: hById.get(h.id) ?? h }
        break
      }
    }
    if (!found) return null
    result.set(el.id, found)
  }
  return result
}

/**
 * φ(h)-fixed points of every element (g = n·h is fixed iff φ(h)(n) = n).
 * Rings whose φ(h) is the identity are left unhighlighted (same convention
 * as the reference copy in pipe semidirect products).
 */
export function semidirectFixedPoints(
  _group: Group,
  sd: SemidirectProductMeta,
  factorMap: Map<string, { n: GroupElement; h: GroupElement }>
): Map<string, boolean> {
  const m = new Map<string, boolean>()
  const perH = new Map<string, string[]>()
  const nTotal = sd.normal.order
  for (const [elId, f] of factorMap) {
    const phiH = sd.phiMap.get(f.h.id)
    if (!phiH) continue
    if (phiH.map.get(f.n.id) === f.n.id) {
      const list = perH.get(f.h.id) ?? []
      list.push(elId)
      perH.set(f.h.id, list)
    }
  }
  for (const elIds of perH.values()) {
    if (elIds.length === nTotal) continue
    for (const id of elIds) m.set(id, true)
  }
  return m
}

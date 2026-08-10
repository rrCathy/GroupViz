import type { Group, GroupActionArrow, GroupActionComputation, GroupActionDef, GroupElement, OrbitInfo } from '../types'
import { findSylowSubgroups, sylowConjugationPerms } from './sylow'

export interface CustomArrowError {
  generatorId: string | null
  from: number
  to: number
  g?: string
  type: 'range' | 'unbound' | 'duplicate-source' | 'conflict-target' | 'missing-target' | 'unknown-generator' | 'homomorphism'
}

export interface ActionBuildResult {
  computation?: GroupActionComputation
  error?: CustomArrowError
}

export interface OrbitsResult {
  orbits: OrbitInfo[]
  orbitOf: number[]
}

export interface OrbitStabilizerCheck {
  representative: number
  orbitSize: number
  stabSize: number
  product: number
  valid: boolean
}

export function identityPermutation(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

// Compose permutations: first apply p2, then p1. (p1∘p2)(i) = p1[p2[i]]
export function composePermutations(p1: number[], p2: number[]): number[] {
  const n = p1.length
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = p1[p2[i]]
  return out
}

export function applyPermutation(p: number[], x: number): number {
  return p[x]
}

export function inversePermutation(p: number[]): number[] {
  const n = p.length
  const inv = new Array<number>(n)
  for (let i = 0; i < n; i++) inv[p[i]] = i
  return inv
}

export function permsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function firstDiffIndex(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return n < Math.max(a.length, b.length) ? n : -1
}

export function indexById(group: Group): Map<string, number> {
  const m = new Map<string, number>()
  group.elements.forEach((el, i) => m.set(el.id, i))
  return m
}

// Conjugation action: G acts on itself by g·x = gxg⁻¹
export function computeConjugationPerms(group: Group): Map<string, number[]> {
  const idx = indexById(group)
  const perms = new Map<string, number[]>()
  const gInvCache = new Map<string, GroupElement>()
  for (const g of group.elements) gInvCache.set(g.id, group.inverse(g))
  for (const g of group.elements) {
    const gInv = gInvCache.get(g.id)!
    const perm = new Array<number>(group.order)
    for (let x = 0; x < group.order; x++) {
      const product = group.multiply(group.multiply(g, group.elements[x]), gInv)
      perm[x] = idx.get(product.id)!
    }
    perms.set(g.id, perm)
  }
  return perms
}

// Regular action (left translation): G acts on itself by g·x = gx.
// Transitive and free (Stab(x) = {e}); its image is the regular representation
// realising Cayley's theorem G ≅ image ≤ Sym(G).
export function computeLeftTranslationPerms(group: Group): Map<string, number[]> {
  const idx = indexById(group)
  const perms = new Map<string, number[]>()
  for (const g of group.elements) {
    const perm = new Array<number>(group.order)
    for (let x = 0; x < group.order; x++) {
      perm[x] = idx.get(group.multiply(g, group.elements[x]).id)!
    }
    perms.set(g.id, perm)
  }
  return perms
}

// Coset action: G acts on the left cosets G/H by g·(xH) = (gx)H.
// Transitive; Stab(xH) = xHx⁻¹ (a conjugate of H).
export function computeCosetActionPerms(group: Group, subgroupElements: GroupElement[]): { perms: Map<string, number[]>; n: number; setLabels: string[] } {
  const cosetOf = new Map<string, number>()
  const reps: GroupElement[] = []
  for (const g of group.elements) {
    if (cosetOf.has(g.id)) continue
    const ci = reps.length
    reps.push(g)
    for (const h of subgroupElements) {
      cosetOf.set(group.multiply(g, h).id, ci)
    }
  }
  const n = reps.length
  const perms = new Map<string, number[]>()
  for (const g of group.elements) {
    const perm = new Array<number>(n)
    for (let x = 0; x < n; x++) {
      perm[x] = cosetOf.get(group.multiply(g, reps[x]).id)!
    }
    perms.set(g.id, perm)
  }
  return { perms, n, setLabels: reps.map(r => `${r.label}H`) }
}

// Verify Φ(g·a) = Φ(g)∘Φ(a) for all g and every generator a
export function verifyAllRelations(group: Group, perms: Map<string, number[]>): { ok: boolean; violation?: { g: string; a: string; x: number } } {
  for (const g of group.elements) {
    const permG = perms.get(g.id)!
    for (const gen of group.generators) {
      const genEl = gen.apply(group.identity)
      const productEl = group.multiply(g, genEl)
      const expected = composePermutations(permG, perms.get(genEl.id)!)
      const actual = perms.get(productEl.id)!
      const diff = firstDiffIndex(actual, expected)
      if (diff !== -1) {
        return { ok: false, violation: { g: g.id, a: gen.symbol, x: diff } }
      }
    }
  }
  return { ok: true }
}

// BFS word extension from identity: Φ(el·gen) = Φ(el)∘Φ(gen)
export function extendAndVerifyPerms(group: Group, generatorPerms: Map<string, number[]>, n: number): { perms: Map<string, number[]>; ok: boolean; violation?: { g: string; a: string; x: number } } {
  const perms = new Map<string, number[]>()
  const queue: GroupElement[] = []
  const idPerm = identityPermutation(n)
  perms.set(group.identity.id, idPerm)
  queue.push(group.identity)
  for (let qi = 0; qi < queue.length; qi++) {
    const el = queue[qi]
    const permEl = perms.get(el.id)!
    for (const gen of group.generators) {
      const genEl = gen.apply(group.identity)
      const next = composePermutations(permEl, generatorPerms.get(gen.symbol)!)
      const productEl = group.multiply(el, genEl)
      const existing = perms.get(productEl.id)
      if (existing === undefined) {
        perms.set(productEl.id, next)
        queue.push(productEl)
      } else {
        const diff = firstDiffIndex(existing, next)
        if (diff !== -1) {
          return { perms, ok: false, violation: { g: el.id, a: gen.symbol, x: diff } }
        }
      }
    }
  }
  return { perms, ok: true }
}

export function validateCustomArrows(arrows: GroupActionArrow[], n: number, group: Group): { ok: boolean; error?: CustomArrowError } {
  const genSymbols = new Set(group.generators.map(g => g.symbol))
  const byGen = new Map<string, GroupActionArrow[]>()
  for (const arrow of arrows) {
    if (arrow.generatorId === null) return { ok: false, error: { generatorId: null, from: arrow.from, to: arrow.to, type: 'unbound' } }
    if (arrow.from < 0 || arrow.from >= n || arrow.to < 0 || arrow.to >= n) {
      return { ok: false, error: { generatorId: arrow.generatorId, from: arrow.from, to: arrow.to, type: 'range' } }
    }
    if (!genSymbols.has(arrow.generatorId)) {
      return { ok: false, error: { generatorId: arrow.generatorId, from: arrow.from, to: arrow.to, type: 'unknown-generator' } }
    }
    const list = byGen.get(arrow.generatorId)
    if (list) list.push(arrow)
    else byGen.set(arrow.generatorId, [arrow])
  }
  for (const [genId, list] of byGen) {
    const sources = new Set<number>()
    const targets = new Set<number>()
    const sourceOf = new Map<number, number>()
    for (const a of list) {
      if (sources.has(a.from)) {
        return { ok: false, error: { generatorId: genId, from: a.from, to: a.to, type: 'duplicate-source' } }
      }
      sources.add(a.from)
      if (sourceOf.has(a.to)) {
        return { ok: false, error: { generatorId: genId, from: a.from, to: a.to, type: 'conflict-target' } }
      }
      sourceOf.set(a.to, a.from)
      targets.add(a.to)
    }
    for (const a of list) {
      if (!sources.has(a.to)) {
        return { ok: false, error: { generatorId: genId, from: a.from, to: a.to, type: 'missing-target' } }
      }
    }
  }
  return { ok: true }
}

// Build generator permutations from arrows: unspecified sources are fixed points,
// and generators with no arrows act as the identity permutation.
export function generatorPermsFromArrows(arrows: GroupActionArrow[], n: number, genSymbols: string[]): Map<string, number[]> {
  const perms = new Map<string, number[]>()
  for (const sym of genSymbols) perms.set(sym, identityPermutation(n))
  for (const arrow of arrows) {
    if (arrow.generatorId === null) continue
    perms.get(arrow.generatorId)![arrow.from] = arrow.to
  }
  return perms
}

export function computeOrbits(perms: Map<string, number[]>, n: number): OrbitsResult {
  const visited = new Array<boolean>(n).fill(false)
  const orbits: OrbitInfo[] = []
  const orbitOf = new Array<number>(n).fill(-1)
  const permList = Array.from(perms.values())
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    const orbit: number[] = []
    const queue = [start]
    visited[start] = true
    for (let qi = 0; qi < queue.length; qi++) {
      const x = queue[qi]
      orbit.push(x)
      for (const p of permList) {
        const y = p[x]
        if (!visited[y]) {
          visited[y] = true
          queue.push(y)
        }
      }
    }
    const rep = Math.min(...orbit)
    const idx = orbits.length
    orbit.forEach(x => { orbitOf[x] = idx })
    orbits.push({ representative: rep, elements: orbit })
  }
  orbits.sort((a, b) => a.elements.length - b.elements.length || a.representative - b.representative)
  const newOrbitOf = new Array<number>(n).fill(-1)
  orbits.forEach((o, i) => o.elements.forEach(x => { newOrbitOf[x] = i }))
  return { orbits, orbitOf: newOrbitOf }
}

export function computeStabilizers(group: Group, perms: Map<string, number[]>, n: number): Map<number, string[]> {
  const stab = new Map<number, string[]>()
  for (let x = 0; x < n; x++) {
    const list: string[] = []
    for (const el of group.elements) {
      const p = perms.get(el.id)
      if (!p) continue
      if (p[x] === x) list.push(el.id)
    }
    stab.set(x, list)
  }
  return stab
}

export function verifyOrbitStabilizer(group: Group, orbits: OrbitInfo[], stabilizers: Map<number, string[]>): OrbitStabilizerCheck[] {
  return orbits.map(o => {
    const orbitSize = o.elements.length
    const stabSize = stabilizers.get(o.representative)?.length ?? 0
    const product = orbitSize * stabSize
    return { representative: o.representative, orbitSize, stabSize, product, valid: product === group.order }
  })
}

export function computeFixedPoints(perms: Map<string, number[]>, n: number): number[] {
  const fixed: number[] = []
  for (let x = 0; x < n; x++) {
    let isFixed = true
    for (const p of perms.values()) {
      if (p[x] !== x) { isFixed = false; break }
    }
    if (isFixed) fixed.push(x)
  }
  return fixed
}

// Burnside's lemma: |X/G| = (1/|G|) * Σ_{g∈G} |Fix(g)|
export function computeBurnsideCount(perms: Map<string, number[]>, n: number): number {
  let sum = 0
  for (const p of perms.values()) {
    for (let x = 0; x < n; x++) {
      if (p[x] === x) sum++
    }
  }
  const gSize = perms.size
  return gSize > 0 ? sum / gSize : 0
}

export interface CycleCandidate {
  length: number
  label: string
  pairs: [number, number][]
}

// Given a partial chain of arrows (per generator), suggest the cycles that
// extend it: from the shortest (a 2-cycle) up to a full n-cycle, filling the
// remaining elements in ascending order. If the arrows already close a cycle,
// only that cycle is returned.
export function computeCycleCandidates(arrows: { from: number; to: number }[], n: number): CycleCandidate[] {
  if (arrows.length === 0 || n < 2) return []
  const out = new Map<number, number>()
  for (const a of arrows) out.set(a.from, a.to)
  const inCount = new Map<number, number>()
  for (const a of arrows) inCount.set(a.to, (inCount.get(a.to) ?? 0) + 1)

  let start = -1
  for (const a of arrows) {
    if (!inCount.has(a.from)) { start = a.from; break }
  }
  if (start === -1) {
    const chain: number[] = []
    let cur = arrows[0].from
    const seen = new Set<number>()
    while (!seen.has(cur) && out.has(cur)) {
      seen.add(cur)
      chain.push(cur)
      cur = out.get(cur)!
    }
    if (chain.length > 1 && out.get(chain[chain.length - 1]) === chain[0]) {
      return [{
        length: chain.length,
        label: `(${chain.map(x => x + 1).join(' ')})`,
        pairs: chain.map((x, i) => [x, chain[(i + 1) % chain.length]] as [number, number]),
      }]
    }
    return []
  }

  const chain: number[] = [start]
  const seen = new Set<number>([start])
  while (out.has(chain[chain.length - 1])) {
    const nx = out.get(chain[chain.length - 1])!
    if (seen.has(nx)) break
    seen.add(nx)
    chain.push(nx)
  }

  const rest: number[] = []
  for (let i = 0; i < n; i++) if (!seen.has(i)) rest.push(i)
  const len = chain.length
  const candidates: CycleCandidate[] = []
  for (let L = Math.max(2, len); L <= n; L++) {
    const extra = L - len
    const seq = [...chain, ...rest.slice(0, extra)]
    const pairs: [number, number][] = []
    for (let i = 0; i < seq.length; i++) pairs.push([seq[i], seq[(i + 1) % seq.length]])
    candidates.push({ length: L, label: `(${seq.map(x => x + 1).join(' ')})`, pairs })
  }
  return candidates
}

export function buildActionComputation(group: Group, def: GroupActionDef, arrows: GroupActionArrow[] = []): ActionBuildResult {
  let perms: Map<string, number[]>
  let n: number
  let ok = true
  let violation: { g: string; a: string; x: number } | undefined
  let setLabels: string[] | undefined

  if (def.kind === 'conjugation') {
    n = group.order
    perms = computeConjugationPerms(group)
    const res = verifyAllRelations(group, perms)
    ok = res.ok
    violation = res.violation
  } else if (def.kind === 'sylow') {
    if (def.prime === undefined) return { error: { generatorId: null, from: -1, to: -1, type: 'range' } }
    const subgroups = findSylowSubgroups(group, def.prime)
    n = subgroups.length
    perms = sylowConjugationPerms(group, subgroups)
    const res = verifyAllRelations(group, perms)
    ok = res.ok
    violation = res.violation
    setLabels = subgroups.map((_, i) => `P${i + 1}`)
  } else if (def.kind === 'regular') {
    n = group.order
    perms = computeLeftTranslationPerms(group)
    const res = verifyAllRelations(group, perms)
    ok = res.ok
    violation = res.violation
  } else if (def.kind === 'coset') {
    if (!def.subgroupElements || def.subgroupElements.length === 0) {
      return { error: { generatorId: null, from: -1, to: -1, type: 'range' } }
    }
    const cosetRes = computeCosetActionPerms(group, def.subgroupElements)
    n = cosetRes.n
    perms = cosetRes.perms
    setLabels = cosetRes.setLabels
    const res = verifyAllRelations(group, perms)
    ok = res.ok
    violation = res.violation
  } else {
    if (!def.setSize) return { error: { generatorId: null, from: -1, to: -1, type: 'range' } }
    n = def.setSize
    const v = validateCustomArrows(arrows, n, group)
    if (!v.ok) return { error: v.error }
    const genPerms = generatorPermsFromArrows(arrows, n, group.generators.map(g => g.symbol))
    const ext = extendAndVerifyPerms(group, genPerms, n)
    perms = ext.perms
    ok = ext.ok
    violation = ext.violation
  }

  const { orbits, orbitOf } = computeOrbits(perms, n)
  const stabilizers = computeStabilizers(group, perms, n)
  return {
    computation: { n, perms, orbits, orbitOf, stabilizers, isHomomorphism: ok, violation, setLabels },
  }
}

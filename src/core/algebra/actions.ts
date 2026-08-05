import type { Group, GroupActionArrow, GroupActionComputation, GroupActionDef, GroupElement, OrbitInfo } from '../types'
import { computeElementRotation } from '../elementRotation'
import {
  truncatedTetrahedron, truncatedCube, rhombicuboctahedron, truncatedOctahedron,
  truncatedIcosahedron, truncatedDodecahedron, type PolyhedronType,
} from '../polyhedra'

export type Vec3 = [number, number, number]

export interface CustomArrowError {
  generatorId: string | null
  from: number
  to: number
  type: 'range' | 'unbound' | 'duplicate-source' | 'conflict-target' | 'missing-target' | 'unknown-generator'
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

// Rodrigues rotation matrix for axis (unit-ish) and angle
export function rotationMatrix(axis: Vec3, angleRad: number): number[][] {
  const [ux, uy, uz] = axis
  const len = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
  const x = ux / len
  const y = uy / len
  const z = uz / len
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  const t = 1 - c
  return [
    [c + x * x * t, x * y * t - z * s, x * z * t + y * s],
    [y * x * t + z * s, c + y * y * t, y * z * t - x * s],
    [z * x * t - y * s, z * y * t + x * s, c + z * z * t],
  ]
}

export function applyRotationMatrix(m: number[][], v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
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

export function getGeometryVertices(geometry: PolyhedronType): Vec3[] {
  switch (geometry) {
    case 'truncatedTetrahedron': return truncatedTetrahedron()
    case 'truncatedCube': return truncatedCube()
    case 'rhombicuboctahedron': return rhombicuboctahedron()
    case 'truncatedOctahedron': return truncatedOctahedron()
    case 'truncatedIcosahedron': return truncatedIcosahedron()
    case 'truncatedDodecahedron': return truncatedDodecahedron()
  }
}

export interface GeometryPermResult {
  perms: Map<string, number[]>
  ok: boolean
  badGenerator?: string
}

function rotateSnapToVertices(m: number[][], verts: Vec3[]): number[] {
  const n = verts.length
  const perm = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const rotated = applyRotationMatrix(m, verts[i])
    let best = 0
    let bestDist = Infinity
    for (let j = 0; j < n; j++) {
      const dx = rotated[0] - verts[j][0]
      const dy = rotated[1] - verts[j][1]
      const dz = rotated[2] - verts[j][2]
      const d = dx * dx + dy * dy + dz * dz
      if (d < bestDist) {
        bestDist = d
        best = j
      }
    }
    perm[i] = best
  }
  return perm
}

// Geometry action: generator permutations come from rotating the vertices and
// snapping to the nearest vertex; the full action is extended word-by-word via
// BFS so the multiplication table is respected by construction.
export function computeGeometryPerms(group: Group, geometry: PolyhedronType): GeometryPermResult {
  const verts = getGeometryVertices(geometry)
  const n = verts.length
  const genPerms = new Map<string, number[]>()
  for (const gen of group.generators) {
    const genEl = gen.apply(group.identity)
    const rotation = computeElementRotation(group, genEl)
    if (!rotation || rotation.angleRad === 0) {
      genPerms.set(gen.symbol, identityPermutation(n))
    } else {
      const m = rotationMatrix(rotation.axis as Vec3, rotation.angleRad)
      genPerms.set(gen.symbol, rotateSnapToVertices(m, verts))
    }
  }
  for (const [sym, p] of genPerms) {
    if (new Set(p).size !== n) {
      return { perms: new Map(), ok: false, badGenerator: sym }
    }
  }
  const ext = extendAndVerifyPerms(group, genPerms, n)
  return { perms: ext.perms, ok: ext.ok }
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

export function buildActionComputation(group: Group, def: GroupActionDef, arrows: GroupActionArrow[] = []): ActionBuildResult {
  let perms: Map<string, number[]>
  let n: number
  let ok = true
  let violation: { g: string; a: string; x: number } | undefined

  if (def.kind === 'conjugation') {
    n = group.order
    perms = computeConjugationPerms(group)
    const res = verifyAllRelations(group, perms)
    ok = res.ok
    violation = res.violation
  } else if (def.kind === 'geometry') {
    if (!def.geometry) return { error: { generatorId: null, from: -1, to: -1, type: 'range' } }
    const verts = getGeometryVertices(def.geometry)
    n = verts.length
    const geo = computeGeometryPerms(group, def.geometry)
    perms = geo.perms
    if (!geo.ok) {
      ok = false
      violation = geo.badGenerator ? { g: geo.badGenerator, a: geo.badGenerator, x: 0 } : undefined
    } else {
      const res = verifyAllRelations(group, perms)
      ok = res.ok
      violation = res.violation
    }
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
    computation: { n, perms, orbits, orbitOf, stabilizers, isHomomorphism: ok, violation },
  }
}

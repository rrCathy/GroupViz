import { describe, it, expect } from 'vitest'
import { createSemidirectProduct } from '../core/groups/SemidirectProduct'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { getSmallGroup, getAllSmallGroups } from '../core/groups/SmallGroups'
import { createS3 } from '../core/groups/SymmetricGroup'
import type { Group, GroupElement } from '../core/types'
import type { Automorphism } from '../core/algebra/automorphisms'
import {
  getSemidirectProductMeta,
  semidirectFactorMap,
  semidirectFixedPoints,
} from '../core/algebra/semidirectDecompositions'

function assertGroupAxioms(G: Group, sample = 15) {
  const idSet = new Set(G.elements.map(e => e.id))
  for (const a of G.elements) {
    expect(G.multiply(a, G.identity).id).toBe(a.id)
    expect(G.multiply(G.identity, a).id).toBe(a.id)
    const inv = G.inverse(a)
    expect(G.multiply(a, inv).id).toBe(G.identity.id)
    expect(G.multiply(inv, a).id).toBe(G.identity.id)
  }
  for (let i = 0; i < sample; i++) {
    const a = G.elements[Math.floor(Math.random() * G.order)]
    const b = G.elements[Math.floor(Math.random() * G.order)]
    const c = G.elements[Math.floor(Math.random() * G.order)]
    expect(idSet.has(G.multiply(a, b).id)).toBe(true)
    expect(G.multiply(G.multiply(a, b), c).id).toBe(G.multiply(a, G.multiply(b, c)).id)
  }
}

function identityAuto(group: Group): Automorphism {
  const idMap = new Map(group.elements.map(e => [e.id, e.id]))
  return {
    id: 'id',
    map: idMap,
    label: '\\mathrm{id}',
    apply: (el: GroupElement) => el,
  }
}

describe('createSemidirectProduct', () => {
  it('C3 ⋊ C2 with inversion is D3 (order 6, non-abelian)', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)

    // inversion automorphism on C3: a -> a^2
    const inv: Automorphism = {
      id: 'inv',
      map: new Map([['e0', 'e0'], ['e1', 'e2'], ['e2', 'e1']]),
      label: '\\rho',
      apply: (el: GroupElement) => {
        const idx = el.value[0]
        return C3.elements[(3 - idx) % 3]
      },
    }

    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', inv],
    ])

    const D = createSemidirectProduct(C3, C2, phi)
    expect(D.order).toBe(6)
    expect(D.isAbelian).toBe(false)
    expect(D.identity.id).toBe('e0|e0')

    // (n1, h1)·(n2, h2) = (n1·phi(h1)(n2), h1·h2)
    // n1 = 1, h1 = 1; n2 = 2, h2 = 0: phi(1)(2)=inversion(2)=1, so 1·1=2
    const a = D.elements.find(e => e.id === 'e1|e1')!
    const b = D.elements.find(e => e.id === 'e2|e0')!
    expect(D.multiply(a, b).id).toBe('e2|e1')

    assertGroupAxioms(D)
  })

  it('trivial φ makes the semidirect product into a direct product (abelian C6)', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ])

    const G = createSemidirectProduct(C3, C2, phi)
    expect(G.order).toBe(6)
    expect(G.isAbelian).toBe(true)
    expect(G.exponent).toBe(6)
    assertGroupAxioms(G)
  })

  it('falls back to identity φ for missing entries in phiMap', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const phi = new Map<string, Automorphism>([])
    const G = createSemidirectProduct(C3, C2, phi)
    expect(G.order).toBe(6)
    expect(G.isAbelian).toBe(true)
    assertGroupAxioms(G)
  })

  it('throws when φ is not a homomorphism', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    // φ(e0) = id, φ(e1) = constant map to identity:
    // φ(e1·e1) = φ(e0) = id, but φ(e1)∘φ(e1) maps every n to e0 ≠ n
    const constAuto: Automorphism = {
      id: 'const',
      map: new Map([['e0', 'e0'], ['e1', 'e0'], ['e2', 'e0']]),
      label: '\\mathrm{const}',
      apply: () => C3.identity,
    }
    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', constAuto],
    ])
    expect(() => createSemidirectProduct(C3, C2, phi)).toThrow(/homomorphism/)
  })

  it('computes exponent as lcm of factor exponents', () => {
    const C6 = createCyclicGroup(6)
    const C4 = createCyclicGroup(4)
    const phi = new Map<string, Automorphism>()
    const G = createSemidirectProduct(C6, C4, phi)
    expect(G.exponent).toBe(12)
    assertGroupAxioms(G)
  })

  it('lifts and pairs N and H generators', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const invId: Automorphism = {
      id: 'inv',
      map: new Map([['e0', 'e0'], ['e1', 'e2'], ['e2', 'e1']]),
      label: '\\rho',
      apply: (el: GroupElement) => C3.elements[(3 - el.value[0]) % 3],
    }
    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', invId],
    ])
    const D = createSemidirectProduct(C3, C2, phi)
    expect(D.generators.length).toBe(2)

    // N-generator preserves H component
    const g0 = D.generators[0]
    expect(g0.name).toBe('a')
    const el = D.elements.find(e => e.id === 'e2|e1')!
    const lifted = g0.apply(el)
    expect(lifted.id).toBe('e0|e1')

    // H-generator preserves N component
    const g1 = D.generators[1]
    const liftedH = g1.apply(el)
    expect(liftedH.id).toBe('e2|e0')
  })
})

describe('getSemidirectProductMeta (rewiring shape metadata)', () => {
  it('recovers the canonical decomposition of registered semidirect products', () => {
    const g = getSmallGroup(16, 2)! // (C₄×C₂):C₂
    const meta = getSemidirectProductMeta(g.group)
    expect(meta).not.toBeNull()
    expect(meta!.normal.order * meta!.acting.order).toBe(16)
    expect(meta!.phiMap.size).toBe(meta!.acting.order)
  })

  it('picks the decomposition matching the symbol pair (C3:C4 -> N=3, H=4)', () => {
    const g = getSmallGroup(12, 4)! // Dic3, symbol C_{3}:C_{4}
    const meta = getSemidirectProductMeta(g.group)
    expect(meta).not.toBeNull()
    expect(meta!.normal.order).toBe(3)
    expect(meta!.acting.order).toBe(4)
  })

  it('returns null for groups without semidirect-product notation', () => {
    expect(getSemidirectProductMeta(createS3())).toBeNull()
    expect(getSemidirectProductMeta(createCyclicGroup(5))).toBeNull()
  })

  it('uses construction metadata for pipe semidirect products', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const G = createSemidirectProduct(C3, C2, new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ]))
    const meta = getSemidirectProductMeta(G!)
    expect(meta).not.toBeNull()
    expect(meta!.normal.order).toBe(3)
    expect(meta!.acting.order).toBe(2)
  })

  it('recovers named semidirect QD16 as C₈⋊C₂ (no ":" notation)', () => {
    const entry = getAllSmallGroups().find(e => e.group.symbol === 'QD_{16}')!
    const meta = getSemidirectProductMeta(entry.group)
    expect(meta).not.toBeNull()
    expect(meta!.normal.name).toBe('C_{8}')
    expect(meta!.normal.order).toBe(8)
    expect(meta!.acting.order).toBe(2)
    expect(meta!.phiMap.size).toBe(2)
    // φ(b)(a) = a³ — the quasidihedral twist
    const a = meta!.normal.generators[0].apply(meta!.normal.identity)
    const b = meta!.acting.generators[0].apply(meta!.acting.identity)
    const phiB = meta!.phiMap.get(b.id)
    expect(phiB).toBeDefined()
    expect(phiB).toBeDefined()
    const a3 = phiB!.map.get(a.id)
    expect(a3).toBeDefined()
    const cub = entry.group.multiply(entry.group.multiply(a, a), a)
    expect(a3).toBe(cub.id)
  })
})

describe('semidirectFactorMap', () => {
  it('splits pipe element ids into (n, h) pairs', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const G = createSemidirectProduct(C3, C2, new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ]))
    const meta = getSemidirectProductMeta(G!)!
    const fm = semidirectFactorMap(G!, meta)
    expect(fm).not.toBeNull()
    expect(fm!.size).toBe(6)
    for (const [elId, pair] of fm!) {
      expect(elId).toBe(`${pair.n.id}|${pair.h.id}`)
      expect(meta.normal.elements.some(e => e.id === pair.n.id)).toBe(true)
      expect(meta.acting.elements.some(e => e.id === pair.h.id)).toBe(true)
    }
  })

  it('algebraically decomposes registered group elements (g = n·h)', () => {
    const g = getSmallGroup(16, 2)!
    const meta = getSemidirectProductMeta(g.group)!
    const fm = semidirectFactorMap(g.group, meta)
    expect(fm).not.toBeNull()
    expect(fm!.size).toBe(16)
    const nIds = new Set(meta.normal.elements.map(e => e.id))
    for (const [elId, pair] of fm!) {
      expect(pair.n.id).toBe((g.group.multiply(g.group.elements.find(e => e.id === elId)!, meta.acting.inverse(pair.h))).id)
      expect(nIds.has(pair.n.id)).toBe(true)
    }
  })
})

describe('semidirectFixedPoints', () => {
  it('leaves identity-action rings unhighlighted (all fixed)', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const G = createSemidirectProduct(C3, C2, new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ]))
    const meta = getSemidirectProductMeta(G!)!
    const fm = semidirectFactorMap(G!, meta)!
    expect(semidirectFixedPoints(G!, meta, fm).size).toBe(0)
  })

  it('highlights φ(h)-fixed points for non-identity rings', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const inv: Automorphism = {
      id: 'inv',
      map: new Map([['e0', 'e0'], ['e1', 'e2'], ['e2', 'e1']]),
      label: '\\rho',
      apply: (el: GroupElement) => C3.elements[(3 - el.value[0]) % 3],
    }
    const G = createSemidirectProduct(C3, C2, new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', inv],
    ]))
    const meta = getSemidirectProductMeta(G!)!
    const fm = semidirectFactorMap(G!, meta)!
    const fixed = semidirectFixedPoints(G!, meta, fm)
    // φ(e1) = inversion fixes only e0 (the identity of C3)
    expect(fixed.get('e0|e1')).toBe(true)
    expect(fixed.has('e1|e1')).toBe(false)
    expect(fixed.has('e2|e1')).toBe(false)
    // identity ring (e0) is skipped entirely
    expect(fixed.has('e0|e0')).toBe(false)
  })
})
import { describe, it, expect } from 'vitest'
import { createSemidirectProduct } from '../core/groups/SemidirectProduct'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import type { Group, GroupElement } from '../core/types'
import type { Automorphism } from '../core/algebra/automorphisms'

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
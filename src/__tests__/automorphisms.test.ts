import { describe, it, expect } from 'vitest'
import { findAllAutomorphisms, createAutomorphismGroup } from '../core/algebra/automorphisms'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { verifyHomomorphism } from '../core/algebra/homomorphisms'
import { getInitialCayleyActions } from '../context/cayleyActions'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'

describe('findAllAutomorphisms', () => {
  it('Aut(Z_3) should have 2 automorphisms (φ(3)=2)', () => {
    const Z3 = createCyclicGroup(3)
    const autos = findAllAutomorphisms(Z3)
    expect(autos.length).toBe(2)
  })

  it('Aut(Z_4) should have 2 automorphisms (φ(4)=2)', () => {
    const Z4 = createCyclicGroup(4)
    const autos = findAllAutomorphisms(Z4)
    expect(autos.length).toBe(2)
  })

  it('Aut(Z_5) should have 4 automorphisms (φ(5)=4)', () => {
    const Z5 = createCyclicGroup(5)
    const autos = findAllAutomorphisms(Z5)
    expect(autos.length).toBe(4)
  })

  it('Aut(S_3) should have 6 automorphisms (Aut(S_3) ≅ S_3)', () => {
    const S3 = createS3()
    const autos = findAllAutomorphisms(S3)
    expect(autos.length).toBe(6)
  })

  it('every automorphism of S_3 should be a valid homomorphism and bijective', () => {
    const S3 = createS3()
    const autos = findAllAutomorphisms(S3)
    for (const auto of autos) {
      const result = verifyHomomorphism(S3, S3, auto.map)
      expect(result.isHomomorphism).toBe(true)
      expect(result.kernel.length).toBe(1)
      expect(result.image.length).toBe(S3.order)
    }
  })

  it('Aut(V_4) should have 6 automorphisms (Aut(V_4) ≅ S_3)', () => {
    const V4 = createKleinFour()
    const autos = findAllAutomorphisms(V4)
    expect(autos.length).toBe(6)
  })

  it('Aut(Q_8) should have 24 automorphisms', () => {
    const Q8 = createQuaternion()
    const autos = findAllAutomorphisms(Q8)
    // Aut(Q_8) ≅ S_4, order 24
    expect(autos.length).toBe(24)
  })

  it('Aut(D_3) should have 6 automorphisms (D_3 ≅ S_3)', () => {
    const D3 = createDihedralGroup(3)
    const autos = findAllAutomorphisms(D3)
    expect(autos.length).toBe(6)
  })

  it('Aut(D_4) should have 8 automorphisms', () => {
    const D4 = createDihedralGroup(4)
    const autos = findAllAutomorphisms(D4)
    expect(autos.length).toBe(8)
  })

  it('huge automorphism groups should be rejected by the guard (Z2^4)', () => {
    const Z2 = createCyclicGroup(2)
    const Z2sq = createDirectProduct(Z2, Z2)
    const Z2cube = createDirectProduct(Z2sq, Z2)
    const Z2to4 = createDirectProduct(Z2cube, Z2)
    expect(Z2to4.order).toBe(16)
    const autos = findAllAutomorphisms(Z2to4)
    expect(autos.length).toBe(0)
  })

  it('identity automorphism should be in every Aut(G)', () => {
    const groups = [createCyclicGroup(3), createS3(), createKleinFour(), createDihedralGroup(4)]
    for (const G of groups) {
      const autos = findAllAutomorphisms(G)
      const hasIdentity = autos.some(a => {
        let isId = true
        for (const [k, v] of a.map) {
          if (k !== v) { isId = false; break }
        }
        return isId
      })
      expect(hasIdentity).toBe(true)
    }
  })

  it('each automorphism should preserve element orders', () => {
    const S3 = createS3()
    const autos = findAllAutomorphisms(S3)
    for (const auto of autos) {
      const applied = auto.apply(S3.elements[0])
      expect(applied).toBeDefined()
      // Check order preservation: |f(g)| should equal |g|
      for (const el of S3.elements) {
        const mapped = auto.apply(el)
        // Compute order by repeated multiplication
        let a = el
        let orderA = 0
        do {
          a = S3.multiply(a, el)
          orderA++
          if (orderA > 100) break
        } while (a.id !== el.id)

        let b = mapped
        let orderB = 0
        do {
          b = S3.multiply(b, mapped)
          orderB++
          if (orderB > 100) break
        } while (b.id !== mapped.id)

        expect(orderA).toBe(orderB)
      }
    }
  })
})

describe('createAutomorphismGroup', () => {
  it('should create Aut(Z_3) group', () => {
    const Z3 = createCyclicGroup(3)
    const AutZ3 = createAutomorphismGroup(Z3)
    expect(AutZ3).not.toBeNull()
    expect(AutZ3!.order).toBe(2)
    expect(AutZ3!.isAbelian).toBe(true)
  })

  it('should create Aut(S_3) group (≅ S_3)', () => {
    const S3 = createS3()
    const AutS3 = createAutomorphismGroup(S3)
    expect(AutS3).not.toBeNull()
    expect(AutS3!.order).toBe(6)
    // Aut(S_3) ≅ S_3 (not abelian)
    expect(AutS3!.isAbelian).toBe(false)
  })

  it('Aut(Q_8) is non-abelian of order 24 (≅ S_4)', () => {
    const Q8 = createQuaternion()
    const AutQ8 = createAutomorphismGroup(Q8)!
    expect(AutQ8.order).toBe(24)
    // |Aut(Q8)| > 20: the abelianity check must cover ALL pairs, not the
    // first 20 elements (S_4 is non-abelian).
    expect(AutQ8.isAbelian).toBe(false)
  })

  it('should have valid group operations (closure, identity, inverse)', () => {
    const S3 = createS3()
    const AutS3 = createAutomorphismGroup(S3)!
    
    // Check closure: multiply any two elements must give element in the group
    for (let i = 0; i < AutS3.order; i++) {
      for (let j = 0; j < AutS3.order; j++) {
        const prod = AutS3.multiply(AutS3.elements[i], AutS3.elements[j])
        const found = AutS3.elements.find(e => e.id === prod.id)
        expect(found).toBeDefined()
      }
    }

    // Check identity
    for (const el of AutS3.elements) {
      const prod = AutS3.multiply(el, AutS3.identity)
      expect(prod.id).toBe(el.id)
    }

    // Check inverse
    for (const el of AutS3.elements) {
      const inv = AutS3.inverse(el)
      const prod = AutS3.multiply(el, inv)
      expect(prod.id).toBe(AutS3.identity.id)
    }

    // Check associativity on small subset
    const els = AutS3.elements
    for (let i = 0; i < Math.min(els.length, 5); i++) {
      for (let j = 0; j < Math.min(els.length, 5); j++) {
        for (let k = 0; k < Math.min(els.length, 5); k++) {
          const ab = AutS3.multiply(els[i], els[j])
          const bc = AutS3.multiply(els[j], els[k])
          const ab_c = AutS3.multiply(ab, els[k])
          const a_bc = AutS3.multiply(els[i], bc)
          expect(ab_c.id).toBe(a_bc.id)
        }
      }
    }
  })

  it('should detect isomorphism for Aut(Z_3) ≅ C_2', () => {
    const Z3 = createCyclicGroup(3)
    const AutZ3 = createAutomorphismGroup(Z3)
    expect(AutZ3).not.toBeNull()
    expect(AutZ3!.isoSymbol).toBeDefined()
    // Aut(Z_3) ≅ C_2
  })

  it('should detect isomorphism for Aut(S_3) ≅ S_3', () => {
    const S3 = createS3()
    const AutS3 = createAutomorphismGroup(S3)
    expect(AutS3).not.toBeNull()
    // Aut(S_3) ≅ S_3 (inner automorphisms form the whole group)
  })

  it('should have generators', () => {
    const S4 = createSymmetricGroup(4)
    const AutS4 = createAutomorphismGroup(S4)
    expect(AutS4).not.toBeNull()
    expect(AutS4!.generators.length).toBeGreaterThan(0)
  })

  it('should have automorphismParentSymbol set', () => {
    const Z4 = createCyclicGroup(4)
    const AutZ4 = createAutomorphismGroup(Z4)!
    expect(AutZ4.automorphismParentSymbol).toBe('C_{4}')
  })

  it('should have _automorphismById map', () => {
    const Z4 = createCyclicGroup(4)
    const AutZ4 = createAutomorphismGroup(Z4)!
    expect(AutZ4._automorphismById).toBeDefined()
    expect(AutZ4._automorphismById!.size).toBe(AutZ4.order)
  })
})

describe('Automorphism Cayley edges and connectivity', () => {
  it('Aut(C6) should have at least 1 generator and edges', () => {
    const C6 = createCyclicGroup(6)
    const AutC6 = createAutomorphismGroup(C6)!
    expect(AutC6.generators.length).toBeGreaterThanOrEqual(1)
    const actions = getInitialCayleyActions(AutC6)
    expect(actions.length).toBeGreaterThan(0)
    const edges = computeCayleyActionEdges(AutC6, actions, 'right')
    expect(edges.length).toBeGreaterThan(0)
  })

  it('Aut(C6) Cayley graph should be connected', () => {
    const C6 = createCyclicGroup(6)
    const AutC6 = createAutomorphismGroup(C6)!
    const actions = getInitialCayleyActions(AutC6)
    const edges = computeCayleyActionEdges(AutC6, actions, 'right')
    const reachable = new Set<string>([AutC6.identity.id])
    const queue = [AutC6.identity.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.fromId === cur && !reachable.has(e.toId)) { reachable.add(e.toId); queue.push(e.toId) }
        if (e.toId === cur && e.isBidirectional && !reachable.has(e.fromId)) { reachable.add(e.fromId); queue.push(e.fromId) }
      }
    }
    expect(reachable.size).toBe(AutC6.order)
  })

  it('Aut(S3) Cayley graph should be connected', () => {
    const S3 = createS3()
    const AutS3 = createAutomorphismGroup(S3)!
    const actions = getInitialCayleyActions(AutS3)
    const edges = computeCayleyActionEdges(AutS3, actions, 'right')
    const reachable = new Set<string>([AutS3.identity.id])
    const queue = [AutS3.identity.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.fromId === cur && !reachable.has(e.toId)) { reachable.add(e.toId); queue.push(e.toId) }
        if (e.toId === cur && e.isBidirectional && !reachable.has(e.fromId)) { reachable.add(e.fromId); queue.push(e.fromId) }
      }
    }
    expect(reachable.size).toBe(AutS3.order)
  })

  it('Aut(V4) Cayley graph should be connected', () => {
    const V4 = createKleinFour()
    const AutV4 = createAutomorphismGroup(V4)!
    const actions = getInitialCayleyActions(AutV4)
    const edges = computeCayleyActionEdges(AutV4, actions, 'right')
    const reachable = new Set<string>([AutV4.identity.id])
    const queue = [AutV4.identity.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.fromId === cur && !reachable.has(e.toId)) { reachable.add(e.toId); queue.push(e.toId) }
        if (e.toId === cur && e.isBidirectional && !reachable.has(e.fromId)) { reachable.add(e.fromId); queue.push(e.fromId) }
      }
    }
    expect(reachable.size).toBe(AutV4.order)
  })

  it('Aut(D4) Cayley graph should be connected', () => {
    const D4 = createDihedralGroup(4)
    const AutD4 = createAutomorphismGroup(D4)!
    const actions = getInitialCayleyActions(AutD4)
    const edges = computeCayleyActionEdges(AutD4, actions, 'right')
    const reachable = new Set<string>([AutD4.identity.id])
    const queue = [AutD4.identity.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.fromId === cur && !reachable.has(e.toId)) { reachable.add(e.toId); queue.push(e.toId) }
        if (e.toId === cur && e.isBidirectional && !reachable.has(e.fromId)) { reachable.add(e.fromId); queue.push(e.fromId) }
      }
    }
    expect(reachable.size).toBe(AutD4.order)
  })

  it('Aut(Q8) Cayley graph should be connected', () => {
    const Q8 = createQuaternion()
    const AutQ8 = createAutomorphismGroup(Q8)!
    const actions = getInitialCayleyActions(AutQ8)
    const edges = computeCayleyActionEdges(AutQ8, actions, 'right')
    const reachable = new Set<string>([AutQ8.identity.id])
    const queue = [AutQ8.identity.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.fromId === cur && !reachable.has(e.toId)) { reachable.add(e.toId); queue.push(e.toId) }
        if (e.toId === cur && e.isBidirectional && !reachable.has(e.fromId)) { reachable.add(e.fromId); queue.push(e.fromId) }
      }
    }
    expect(reachable.size).toBe(AutQ8.order)
  })

  it('automorphism labels should be compact (id or alpha_i)', () => {
    const S3 = createS3()
    const AutS3 = createAutomorphismGroup(S3)!
    for (const el of AutS3.elements) {
      // Labels should be short: either "id" or "αᵢ" style
      expect(el.label.length).toBeLessThanOrEqual(15)
    }
    // First element should be identity
    expect(AutS3.elements[0].label).toBe('\\mathrm{id}')
  })

  it('Aut(C_11) labels should match multipliers and render multi-digit subscripts correctly', () => {
    const C11 = createCyclicGroup(11)
    const AutC11 = createAutomorphismGroup(C11)!
    expect(AutC11.order).toBe(10)

    // Find alpha_9 and alpha_10 by their group element labels
    const alpha9 = AutC11.elements.find(el => el.label === '\\alpha_9')
    const alpha10 = AutC11.elements.find(el => el.label === '\\alpha_{10}')
    expect(alpha9).toBeDefined()
    expect(alpha10).toBeDefined()

    // Verify the _automorphismById label is synced
    const autoById = (AutC11 as typeof AutC11 & { _automorphismById?: Map<string, { label: string; map: Map<string, string> }> })._automorphismById
    expect(autoById?.get(alpha9!.id)?.label).toBe('\\alpha_9')
    expect(autoById?.get(alpha10!.id)?.label).toBe('\\alpha_{10}')

    // alpha_9 should map canonical generator e1 to e9
    const genEl = C11.generators[0].apply(C11.identity)
    const alpha9Map = autoById?.get(alpha9!.id)?.map
    const imageId = alpha9Map?.get(genEl.id)
    const imageEl = C11.elements.find(e => e.id === imageId)
    expect(imageEl?.value[0]).toBe(9)

    // Rewired action for alpha_9 should be e9, producing edge e0 -> e9
    const action: import('../core/types').CayleyAction = { elementId: imageId!, enabled: true, color: '#ff6b6b' }
    const edges = computeCayleyActionEdges(C11, [action], 'right')
    const edgeFrom0 = edges.find(e => e.fromId === C11.elements[0].id)
    expect(edgeFrom0).toBeDefined()
    expect(edgeFrom0!.toId).toBe(C11.elements[9].id)
  })
})

import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSemidirectProduct } from '../core/groups/SemidirectProduct'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createQuaternion, createKleinFour } from '../core/groups/SpecialGroup'
import { findAllAutomorphisms, createAutomorphismGroup } from '../core/algebra/automorphisms'
import { extendFromGenerators } from '../core/algebra/homomorphisms'
import {
  findAutoByMap,
  verifyPhiHomomorphism,
  buildPhiFromGroup,
  findSemidirectDecompositions,
  minimalGenerators,
  buildSubgroupGroup,
  detectStructureType,
} from '../core/algebra/semidirectDecompositions'
import type { Automorphism } from '../core/algebra/automorphisms'

function buildFullPhiMap(
  N: ReturnType<typeof createCyclicGroup>,
  H: ReturnType<typeof createCyclicGroup>,
  genMap: Map<string, string>
): Map<string, Automorphism> {
  const autos = findAllAutomorphisms(N)
  const autGroup = createAutomorphismGroup(N, autos)!
  const fullMap = extendFromGenerators(H, autGroup, genMap)!
  const autoById = new Map(autos.map(a => [a.id, a]))
  const phiFull = new Map<string, Automorphism>()
  for (const [hId, autoId] of fullMap) {
    const a = autoById.get(autoId)
    if (a) phiFull.set(hId, a)
  }
  return phiFull
}

function mapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false
  }
  return true
}

describe('findAutoByMap', () => {
  it('matches an automorphism whose map equals the target', () => {
    const N = createCyclicGroup(4)
    const autos = findAllAutomorphisms(N)
    const identity = autos.find(a => {
      let isId = true
      for (const [k, v] of a.map) {
        if (k !== v) { isId = false; break }
      }
      return isId
    })!
    const found = findAutoByMap(autos, identity.map)
    expect(found).not.toBeNull()
    expect(mapsEqual(found!.map, identity.map)).toBe(true)
  })

  it('returns null when no automorphism matches', () => {
    const N = createCyclicGroup(4)
    const autos = findAllAutomorphisms(N)
    const nGen = N.generators[0].apply(N.identity)
    // Inversion image of the generator never matches identity
    const target = new Map<string, string>()
    target.set(N.identity.id, N.identity.id)
    target.set(nGen.id, N.inverse(nGen).id)
    const found = findAutoByMap(autos, target)
    expect(found).toBeNull()
  })

  it('returns null for empty or missing target maps', () => {
    const N = createCyclicGroup(4)
    const autos = findAllAutomorphisms(N)
    expect(findAutoByMap(autos, new Map())).toBeNull()
    expect(findAutoByMap(autos, null)).toBeNull()
    expect(findAutoByMap(autos, undefined)).toBeNull()
    expect(findAutoByMap([], new Map([[N.identity.id, N.identity.id]]))).toBeNull()
  })
})

describe('verifyPhiHomomorphism', () => {
  it('accepts the C4 ⋊ C2 inversion semidirect product (≅ D4)', () => {
    const N = createCyclicGroup(4)
    const H = createCyclicGroup(2)
    const autos = findAllAutomorphisms(N)
    const nGen = N.generators[0].apply(N.identity)
    const inversion = autos.find(a => a.apply(nGen).id === N.inverse(nGen).id)!
    const h1 = H.generators[0].apply(H.identity)
    const phiFull = buildFullPhiMap(N, H, new Map([[h1.id, inversion.id]]))
    expect(verifyPhiHomomorphism(N, H, phiFull)).toBe(true)
    expect(() => createSemidirectProduct(N, H, phiFull)).not.toThrow()
  })

  it('accepts the trivial φ (C2 ⋊ C2 ≅ V4)', () => {
    const N = createCyclicGroup(2)
    const H = createCyclicGroup(2)
    const autos = findAllAutomorphisms(N)
    const identity = autos[0]
    const h1 = H.generators[0].apply(H.identity)
    const phiFull = buildFullPhiMap(N, H, new Map([[h1.id, identity.id]]))
    expect(phiFull.size).toBeGreaterThan(0)
    expect(verifyPhiHomomorphism(N, H, phiFull)).toBe(true)
    expect(phiFull.get(H.identity.id)?.id ?? '').toBe(identity.id)
  })

  it('rejects a φ that maps h1 to a wrong-order automorphism', () => {
    const N = createCyclicGroup(4)
    const H = createCyclicGroup(3)
    const autos = findAllAutomorphisms(N)
    const nGen = N.generators[0].apply(N.identity)
    const inversion = autos.find(a => a.apply(nGen).id === N.inverse(nGen).id)!
    const h1 = H.generators[0].apply(H.identity)
    const h2 = H.multiply(h1, h1)
    // φ(h1) = inversion (order 2), φ(h1²) = inversion — order 3 element maps to order 2 automorphism
    const phiBad = new Map<string, Automorphism>()
    phiBad.set(H.identity.id, autos.find(a => {
      let isId = true
      for (const [k, v] of a.map) {
        if (k !== v) { isId = false; break }
      }
      return isId
    })!)
    phiBad.set(h1.id, inversion)
    phiBad.set(h2.id, inversion)
    expect(verifyPhiHomomorphism(N, H, phiBad)).toBe(false)
    expect(() => createSemidirectProduct(N, H, phiBad)).toThrow()
  })

  it('falls back to identity for unmapped H elements', () => {
    const N = createCyclicGroup(5)
    const H = createCyclicGroup(2)
    const phiPartial = new Map<string, Automorphism>()
    phiPartial.set(H.identity.id, {
      id: 'auto-x',
      map: new Map(N.elements.map(e => [e.id, e.id])),
      label: '\\mathrm{id}',
      apply: (el) => el,
    })
    // h1 unmapped → identity fallback, trivial φ is still a homomorphism
    expect(verifyPhiHomomorphism(N, H, phiPartial)).toBe(true)
  })
})

describe('buildPhiFromGroup', () => {
  it('round-trips N, H and φ recorded on a created semidirect product', () => {
    const N = createCyclicGroup(4)
    const H = createCyclicGroup(2)
    const autos = findAllAutomorphisms(N)
    const nGen = N.generators[0].apply(N.identity)
    const inversion = autos.find(a => a.apply(nGen).id === N.inverse(nGen).id)!
    const h1 = H.generators[0].apply(H.identity)
    const phiFull = buildFullPhiMap(N, H, new Map([[h1.id, inversion.id]]))

    const group = createSemidirectProduct(N, H, phiFull)
    const decomposed = buildPhiFromGroup(group)
    expect(decomposed).not.toBeNull()
    expect(decomposed!.normal.order).toBe(4)
    expect(decomposed!.acting.order).toBe(2)
    expect(decomposed!.phiMap.size).toBe(phiFull.size)
    for (const [hId, auto] of phiFull) {
      const back = decomposed!.phiMap.get(hId)
      expect(back).toBeDefined()
      expect(mapsEqual(back!.map, auto.map)).toBe(true)
    }
  })

  it('returns null for groups that are not semidirect products', () => {
    expect(buildPhiFromGroup(createCyclicGroup(4))).toBeNull()
  })
})

describe('minimalGenerators', () => {
  it('returns a small generating set whose closure covers the elements', () => {
    const A4 = createAlternatingGroup(4)
    // V4 = identity + the three order-2 elements {(12)(34), (13)(24), (14)(23)}
    const v4Elements = A4.elements.filter(e => e.id === A4.identity.id || A4.multiply(e, e).id === A4.identity.id)
    expect(v4Elements.length).toBe(4)
    const gens = minimalGenerators(A4, v4Elements)
    expect(gens.length).toBe(2)
    const covered = new Set([A4.identity.id])
    const queue = [...gens]
    while (queue.length > 0) {
      const x = queue.pop()!
      for (const g of gens) {
        const y = A4.multiply(x, g)
        if (!covered.has(y.id)) {
          covered.add(y.id)
          queue.push(y)
        }
      }
    }
    expect(covered.size).toBe(4)
  })

  it('returns [] for the trivial subset', () => {
    const C6 = createCyclicGroup(6)
    expect(minimalGenerators(C6, [C6.identity])).toEqual([])
  })

  it('handles subgroups whose recorded generators are empty', () => {
    const S3 = createSymmetricGroup(3)
    const nGens = minimalGenerators(S3, S3.elements)
    expect(nGens.length).toBeGreaterThan(0)
    expect(nGens.length).toBeLessThanOrEqual(2)
  })
})

describe('buildSubgroupGroup', () => {
  it('builds a working group from a subgroup of elements of a parent group', () => {
    const S3 = createSymmetricGroup(3)
    const trans = S3.elements.find(e => e.id !== S3.identity.id && S3.multiply(e, e).id === S3.identity.id)!
    const H = buildSubgroupGroup(S3, [S3.identity, trans], '\\langle x \\rangle')
    expect(H.order).toBe(2)
    expect(H.isAbelian).toBe(true)
    expect(H.multiply(trans, trans).id).toBe(S3.identity.id)
    expect(H.inverse(trans).id).toBe(trans.id)
    expect(H.generators.length).toBe(1)
    expect(H.generators[0].apply(S3.identity).id).toBe(trans.id)
  })

  it('uses provided generators when given', () => {
    const C6 = createCyclicGroup(6)
    const H = buildSubgroupGroup(C6, C6.elements.filter(e => e.value[0] % 2 === 0), '\\langle a^{2} \\rangle', [C6.generators[0].apply(C6.identity)])
    expect(H.order).toBe(3)
    expect(H.generators.length).toBe(1)
  })
})

describe('findSemidirectDecompositions', () => {
  it('finds S3 ≅ C3 ⋊ C2 (N = A3, 3 transposition complements)', () => {
    const S3 = createSymmetricGroup(3)
    const deps = findSemidirectDecompositions(S3)
    expect(deps.length).toBe(3)
    for (const d of deps) {
      expect(d.normal.order).toBe(3)
      expect(d.acting.order).toBe(2)
      expect(d.verified).toBe(true)
    }
    const keys = deps.map(d => [...d.actingElements].map(e => e.id).sort().join(','))
    expect(new Set(keys).size).toBe(3)
  })

  it('finds D4 ≅ C4 ⋊ C2 and D4 ≅ V4 ⋊ C2 (8 candidates, all verified)', () => {
    const D4 = createDihedralGroup(4)
    const deps = findSemidirectDecompositions(D4)
    expect(deps.length).toBe(8)
    for (const d of deps) {
      expect(d.verified).toBe(true)
      expect(d.normal.order).toBe(4)
      expect(d.acting.order).toBe(2)
    }
    expect(deps[0].rebuiltIsoSymbol).toBe('D_{4}')
    expect(deps[0].sourceIsoSymbol).toBe('D_{4}')
  })

  it('finds A4 ≅ V4 ⋊ C3 (Frobenius group, 4 Sylow-3 complements)', () => {
    const A4 = createAlternatingGroup(4)
    const deps = findSemidirectDecompositions(A4)
    expect(deps.length).toBe(4)
    for (const d of deps) {
      expect(d.normal.order).toBe(4)
      expect(d.acting.order).toBe(3)
      expect(d.verified).toBe(true)
    }
  })

  it('finds S4 decompositions A4 ⋊ C2 and V4 ⋊ S3', () => {
    const S4 = createSymmetricGroup(4)
    const deps = findSemidirectDecompositions(S4)
    expect(deps.length).toBeGreaterThanOrEqual(9)
    const types = deps.map(d => `${d.normal.order}/${d.acting.order}`)
    expect(types).toContain('12/2')
    expect(types).toContain('4/6')
    for (const d of deps) {
      expect(d.verified).toBe(true)
    }
    const keys = deps.map(d => [...d.normalElements, ...d.actingElements].map(e => e.id).sort().join('|'))
    expect(new Set(keys).size).toBe(deps.length)
  })

  it('finds the two abelian decompositions of C6 with trivial φ', () => {
    const C6 = createCyclicGroup(6)
    const deps = findSemidirectDecompositions(C6)
    expect(deps.length).toBe(2)
    for (const d of deps) {
      expect(d.verified).toBe(true)
      const orders = [d.normal.order, d.acting.order].sort((a, b) => a - b)
      expect(orders).toEqual([2, 3])
    }
  })

  it('finds no decompositions for Q8', () => {
    expect(findSemidirectDecompositions(createQuaternion())).toEqual([])
  })

  it('D5 decomposes into C5 ⋊ C2 with recognizable subgroup symbols', () => {
    const D5 = createDihedralGroup(5)
    const deps = findSemidirectDecompositions(D5)
    expect(deps.length).toBe(5)
    for (const d of deps) {
      expect(d.normal.order).toBe(5)
      expect(d.acting.order).toBe(2)
      expect(d.verified).toBe(true)
      expect(d.normal.symbol).toBe('C_{5}')
      expect(d.acting.symbol).toBe('C_{2}')
    }
  })

  it('finds all 19 decompositions of D12 (C6 ⋊ C2, S3 ⋊ C2, C3 ⋊ V4 ≅ S3×C2, C2 ⋊ S3)', () => {
    const D12 = createDihedralGroup(6)
    const deps = findSemidirectDecompositions(D12)
    expect(deps.length).toBe(19)
    const types = deps.map(d => `${d.normal.order}/${d.acting.order}`)
    expect(types.filter(t => t === '6/2').length).toBe(14)
    expect(types.filter(t => t === '3/4').length).toBe(3)
    expect(types.filter(t => t === '2/6').length).toBe(2)
    for (const d of deps) {
      expect(d.verified).toBe(true)
      expect(d.rebuiltIsoSymbol).toBe('D_{6}')
      expect(d.sourceIsoSymbol).toBe('D_{6}')
    }
  })

  it('returns [] for order > 60 (guard)', () => {
    const S5 = createSymmetricGroup(5)
    expect(findSemidirectDecompositions(S5)).toEqual([])
    expect(findSemidirectDecompositions(S5, true)).toEqual([])
  })

  it('returns [] for cyclic groups of prime order', () => {
    expect(findSemidirectDecompositions(createCyclicGroup(7))).toEqual([])
  })
})

describe('detectStructureType', () => {
  it('labels direct products', () => {
    expect(detectStructureType(createCyclicGroup(6))).toBe('direct')
    expect(detectStructureType(createKleinFour())).toBe('direct')
    expect(detectStructureType(createDihedralGroup(6))).toBe('direct')
  })

  it('labels semidirect products', () => {
    expect(detectStructureType(createSymmetricGroup(3))).toBe('semidirect')
    expect(detectStructureType(createDihedralGroup(5))).toBe('semidirect')
    expect(detectStructureType(createAlternatingGroup(4))).toBe('semidirect')
    expect(detectStructureType(createSymmetricGroup(4))).toBe('semidirect')
  })

  it('labels indecomposable groups', () => {
    expect(detectStructureType(createCyclicGroup(4))).toBe('indecomposable')
    expect(detectStructureType(createCyclicGroup(7))).toBe('indecomposable')
    expect(detectStructureType(createQuaternion())).toBe('indecomposable')
    expect(detectStructureType(createAlternatingGroup(5))).toBe('indecomposable')
  })

  it('returns unknown beyond the search cutoff', () => {
    expect(detectStructureType(createSymmetricGroup(5))).toBe('unknown')
  })

  it('fast-paths groups built as semidirect products', () => {
    const N = createCyclicGroup(3)
    const H = createCyclicGroup(4)
    const autos = findAllAutomorphisms(N)
    const nGen = N.generators[0].apply(N.identity)
    const inversion = autos.find(a => a.apply(nGen).id === N.inverse(nGen).id)!
    const h1 = H.generators[0].apply(H.identity)
    const phiFull = buildFullPhiMap(N, H, new Map([[h1.id, inversion.id]]))
    const built = createSemidirectProduct(N, H, phiFull)
    expect(detectStructureType(built)).toBe('semidirect')
  })
})

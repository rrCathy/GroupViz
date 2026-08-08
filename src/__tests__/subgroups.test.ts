import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { findAllSubgroups, isSimpleGroup, getConjugacyClasses, getGroupCenter, getCentralizer, getNormalizer, computeQuotientGroup, findAllNormalSubgroups, computeSubgroupLattice, closeUnderMultiply } from '../core/algebra/subgroups'
import { createDirectProduct } from '../core/groups/DirectProduct'
import type { Group } from '../core/types'

function isSubgroup(group: Group, candidateIds: string[]): boolean {
  const idSet = new Set(candidateIds)
  const elements = group.elements.filter(e => idSet.has(e.id))
  
  if (elements.length === 0) return false
  
  const hasIdentity = elements.some(e => e.id === group.identity.id)
  if (!hasIdentity) return false
  
  for (const a of elements) {
    const inv = group.inverse(a)
    if (!idSet.has(inv.id)) return false
    
    for (const b of elements) {
      const product = group.multiply(a, b)
      if (!idSet.has(product.id)) return false
    }
  }
  
  return true
}

describe('Subgroup Calculations', () => {
  describe('findAllSubgroups', () => {
    it('should find subgroups of C_6', () => {
      const group = createCyclicGroup(6)
      const subgroups = findAllSubgroups(group)
      
      expect(subgroups.length).toBeGreaterThan(0)
      
      for (const sub of subgroups) {
        const ids = sub.elements.map(e => e.id)
        expect(isSubgroup(group, ids)).toBe(true)
      }
    })

    it('should find subgroups of S_3', () => {
      const group = createS3()
      const subgroups = findAllSubgroups(group)
      
      expect(subgroups.length).toBeGreaterThan(0)
      
      for (const sub of subgroups) {
        const ids = sub.elements.map(e => e.id)
        expect(isSubgroup(group, ids)).toBe(true)
      }
    })

    it('should find subgroups of D_4', () => {
      const group = createDihedralGroup(4)
      const subgroups = findAllSubgroups(group)
      
      expect(subgroups.length).toBeGreaterThan(0)
      
      for (const sub of subgroups) {
        const ids = sub.elements.map(e => e.id)
        expect(isSubgroup(group, ids)).toBe(true)
      }
    })

    it('should always include trivial subgroup', () => {
      const group = createS3()
      const subgroups = findAllSubgroups(group)
      
      const hasTrivial = subgroups.some(s => s.order === 1)
      
      expect(hasTrivial).toBe(true)
    })

    it('should have subgroups with valid orders (Lagrange)', () => {
      const group = createS3()
      const subgroups = findAllSubgroups(group)
      
      for (const sub of subgroups) {
        expect(group.order % sub.order).toBe(0)
      }
    })

    it('should satisfy Lagrange theorem: subgroup order divides group order', () => {
      const group = createDihedralGroup(5)
      const subgroups = findAllSubgroups(group)
      
      for (const sub of subgroups) {
        expect(group.order % sub.order).toBe(0)
      }
    })
  })

  describe('getConjugacyClasses', () => {
    it('should partition the group', () => {
      const group = createS3()
      const classes = getConjugacyClasses(group)
      
      // Each element should appear in at least one class
      const allIds = new Set(classes.flatMap(c => c.map(e => e.id)))
      for (const el of group.elements) {
        expect(allIds.has(el.id)).toBe(true)
      }
    })

    it('abelian group conjugacy classes should cover all elements', () => {
      const group = createCyclicGroup(5)
      const classes = getConjugacyClasses(group)
      
      // All elements should be covered
      const allIds = new Set(classes.flatMap(c => c.map(e => e.id)))
      expect(allIds.size).toBe(group.order)
    })
  })

  describe('getGroupCenter', () => {
    it('abelian group center should be whole group', () => {
      const group = createKleinFour()
      const center = getGroupCenter(group)
      
      expect(center.length).toBe(group.order)
    })

    it('S_3 center should be trivial', () => {
      const group = createS3()
      const center = getGroupCenter(group)
      
      expect(center.length).toBe(1)
      expect(center[0].id).toBe(group.identity.id)
    })

    it('Q_8 center should be {1, -1}', () => {
      const group = createQuaternion()
      const center = getGroupCenter(group)
      
      expect(center.length).toBe(2)
    })

    it('center elements should commute with all elements', () => {
      const group = createDihedralGroup(4)
      const center = getGroupCenter(group)
      
      for (const z of center) {
        for (const g of group.elements) {
          expect(group.multiply(z, g).id).toBe(group.multiply(g, z).id)
        }
      }
    })
  })

  describe('center appears in subgroup lattice', () => {
    it('Q_8 center {1, -1} should appear as a lattice node', () => {
      const group = createQuaternion()
      const centerSet = new Set(getGroupCenter(group).map(e => e.id))
      const lattice = computeSubgroupLattice(group)
      const hasCenterNode = lattice.nodes.some(nd =>
        nd.elementIds.length === centerSet.size &&
        nd.elementIds.every(id => centerSet.has(id))
      )
      expect(hasCenterNode).toBe(true)
    })

    it('D_8 center {1, r^2} should appear as a lattice node', () => {
      const group = createDihedralGroup(4)
      const centerSet = new Set(getGroupCenter(group).map(e => e.id))
      const lattice = computeSubgroupLattice(group)
      const hasCenterNode = lattice.nodes.some(nd =>
        nd.elementIds.length === centerSet.size &&
        nd.elementIds.every(id => centerSet.has(id))
      )
      expect(hasCenterNode).toBe(true)
    })
  })

  describe('closeUnderMultiply', () => {
    it('S_3 generated by two transpositions should be the whole group', () => {
      const group = createS3()
      const transpositions = group.elements.filter(e => e.id !== group.identity.id && group.multiply(e, e).id === group.identity.id)
      expect(transpositions.length).toBeGreaterThanOrEqual(2)
      const closure = closeUnderMultiply(group, transpositions.slice(0, 2))
      expect(closure.length).toBe(6)
    })

    it('S_3 generated by a single transposition should be its own closure of order 2', () => {
      const group = createS3()
      const transposition = group.elements.find(e => e.id !== group.identity.id && group.multiply(e, e).id === group.identity.id)!
      const closure = closeUnderMultiply(group, [transposition])
      expect(closure.length).toBe(2)
    })

    it('Q_8 generated by i should be the cyclic subgroup of order 4', () => {
      const group = createQuaternion()
      const i = group.elements.find(e => e.label === 'i')!
      const closure = closeUnderMultiply(group, [i])
      expect(closure.length).toBe(4)
      expect(isSubgroup(group, closure.map(e => e.id))).toBe(true)
    })

    it('closure should be a subgroup containing the seed', () => {
      const group = createDihedralGroup(4)
      const seed = group.elements.filter(e => e.id !== group.identity.id).slice(0, 2)
      const closure = closeUnderMultiply(group, seed)
      const ids = closure.map(e => e.id)
      expect(isSubgroup(group, ids)).toBe(true)
      for (const el of seed) {
        expect(ids).toContain(el.id)
      }
    })
  })

  describe('getCentralizer', () => {
    it('S_3 centralizer of a transposition should be {e, transposition}', () => {
      const group = createS3()
      const t = group.elements.find(e => e.label === '12')!
      const cent = getCentralizer(group, [t])
      expect(cent.length).toBe(2)
      expect(cent.some(e => e.id === group.identity.id)).toBe(true)
      expect(cent.some(e => e.id === t.id)).toBe(true)
    })

    it('S_3 centralizer of A_3 should be A_3 itself (abelian)', () => {
      const group = createS3()
      const a = group.elements.find(e => e.label === '123')!
      const b = group.elements.find(e => e.label === '132')!
      const cent = getCentralizer(group, [a, b])
      expect(cent.length).toBe(3)
    })

    it('D_4 centralizer of r^2 (center element) should be whole group', () => {
      const group = createDihedralGroup(4)
      const r2 = group.elements.find(e => e.label === 'r2')!
      const cent = getCentralizer(group, [r2])
      expect(cent.length).toBe(8)
    })

    it('Q_8 centralizer of i should be <i> of order 4', () => {
      const group = createQuaternion()
      const i = group.elements.find(e => e.label === 'i')!
      const cent = getCentralizer(group, [i])
      expect(cent.length).toBe(4)
      expect(cent.some(e => e.label === '-i')).toBe(true)
    })
  })

  describe('getNormalizer', () => {
    it('S_3 normalizer of a transposition should be itself', () => {
      const group = createS3()
      const t = group.elements.find(e => e.label === '12')!
      const norm = getNormalizer(group, [t])
      expect(norm.length).toBe(2)
      expect(norm.some(e => e.id === group.identity.id)).toBe(true)
      expect(norm.some(e => e.id === t.id)).toBe(true)
    })

    it('S_3 normalizer of A_3 should be whole group (normal)', () => {
      const group = createS3()
      const a = group.elements.find(e => e.label === '123')!
      const b = group.elements.find(e => e.label === '132')!
      const norm = getNormalizer(group, [a, b])
      expect(norm.length).toBe(6)
    })

    it('D_4 normalizer of <s> should be <r^2, s> of order 4', () => {
      const group = createDihedralGroup(4)
      const s = group.elements.find(e => e.label === 's')!
      const norm = getNormalizer(group, [s])
      expect(norm.length).toBe(4)
      expect(norm.some(e => e.label === 'r2')).toBe(true)
      expect(norm.some(e => e.label === 'sr2')).toBe(true)
    })

    it('Q_8 normalizer of the element i should be C(i) = <i> of order 4', () => {
      const group = createQuaternion()
      const i = group.elements.find(e => e.label === 'i')!
      const norm = getNormalizer(group, [i])
      expect(norm.length).toBe(4)
      expect(norm.some(e => e.label === '-i')).toBe(true)
    })

    it('Q_8 normalizer of the subgroup <i> should be whole group (normal)', () => {
      const group = createQuaternion()
      const sub = group.elements.filter(e => ['1', '-1', 'i', '-i'].includes(e.label))
      expect(sub.length).toBe(4)
      const norm = getNormalizer(group, sub)
      expect(norm.length).toBe(8)
    })
  })

  describe('computeQuotientGroup', () => {
    it('S_3 / A_3 should have correct order', () => {
      const group = createS3()
      const normal = findAllSubgroups(group).find(s => s.order === 3 && s.isNormal)
      expect(normal).toBeDefined()
      const q = computeQuotientGroup(group, normal!)
      expect(q).not.toBeNull()
      expect(q!.order).toBe(2)
      expect(q!.normalSubgroupElementIds).toBeDefined()
      expect(q!.normalSubgroupElementIds!.length).toBe(3)
    })

    it('quotient group inverse should return the correct coset', () => {
      const group = createS3()
      const normal = findAllSubgroups(group).find(s => s.order === 3 && s.isNormal)
      expect(normal).toBeDefined()
      const q = computeQuotientGroup(group, normal!)
      expect(q).not.toBeNull()

      // Every element multiplied by its inverse should be identity
      for (const el of q!.elements) {
        const inv = q!.inverse(el)
        const product = q!.multiply(el, inv)
        expect(product.id).toBe(q!.identity.id)
      }
    })

    it('quotient group inverse should be deterministic after reconstruction', () => {
      const group = createS3()
      const normal = findAllSubgroups(group).find(s => s.order === 3 && s.isNormal)
      expect(normal).toBeDefined()
      const q1 = computeQuotientGroup(group, normal!)
      const q2 = computeQuotientGroup(group, normal!)
      expect(q1).not.toBeNull()
      expect(q2).not.toBeNull()
      for (let i = 0; i < q1!.elements.length; i++) {
        expect(q1!.elements[i].id).toBe(q2!.elements[i].id)
        const inv1 = q1!.inverse(q1!.elements[i])
        const inv2 = q2!.inverse(q2!.elements[i])
        expect(inv1.id).toBe(inv2.id)
      }
    })

    it('non-abelian group can have an abelian quotient: (S3 x C5) / (A3 x {e}) ~= C10', () => {
      const group = createDirectProduct(createS3(), createCyclicGroup(5))
      const normal = findAllSubgroups(group).find(s => s.order === 3 && s.isNormal)
      expect(normal).toBeDefined()
      const q = computeQuotientGroup(group, normal!)
      expect(q).not.toBeNull()
      expect(q!.order).toBe(10)
      expect(q!.isAbelian).toBe(true)
    })
  })

  describe('findAllNormalSubgroups', () => {
    it('fallback path (many conjugacy classes) includes the full group and trivial subgroup', () => {
      // S3 x C10: 3 x 10 = 30 conjugacy classes -> otherClasses = 29 >= 20, uses fallback
      const group = createDirectProduct(createS3(), createCyclicGroup(10))
      expect(group.order).toBe(60)
      const normal = findAllNormalSubgroups(group)
      expect(normal.some(s => s.order === group.order && s.isNormal)).toBe(true)
      expect(normal.some(s => s.order === 1 && s.isNormal)).toBe(true)
      expect(normal.length).toBeGreaterThan(2)
    })

    it('fallback path marks only genuinely normal subgroups as normal', () => {
      const group = createDirectProduct(createS3(), createCyclicGroup(10))
      const normal = findAllNormalSubgroups(group)
      const ids = new Set(normal.map(s => s.order + ':' + s.elements.map(e => e.id).sort().join(',')))
      expect(ids.size).toBe(normal.length)
      for (const sub of normal) {
        expect(sub.isNormal).toBe(true)
      }
    })
  })

  describe('isSimpleGroup', () => {
    it('S_3 should not be simple', () => {
      const group = createS3()
      expect(isSimpleGroup(group)).toBe(false)
    })

    it('A_5 should be simple', () => {
      const group = createAlternatingGroup(5)
      expect(isSimpleGroup(group)).toBe(true)
    })

    it('V_4 should not be simple', () => {
      const group = createKleinFour()
      expect(isSimpleGroup(group)).toBe(false)
    })

    it('A_4 should not be simple', () => {
      const group = createAlternatingGroup(4)
      expect(isSimpleGroup(group)).toBe(false)
    })
  })
})

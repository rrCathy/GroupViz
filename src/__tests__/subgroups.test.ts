import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { findAllSubgroups, isSimpleGroup, getConjugacyClasses, getGroupCenter, computeQuotientGroup, findAllNormalSubgroups } from '../core/algebra/subgroups'
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

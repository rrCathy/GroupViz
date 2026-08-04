import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import {
  computeGroupProperties,
  isSolvable,
  isNilpotent,
  isPerfect,
  PROPERTIES_CUTOFF,
} from '../core/algebra/properties'
import type { Group } from '../core/types'

function elementIds(elements: { id: string }[]): string[] {
  return elements.map(e => e.id).sort()
}

describe('Group Properties', () => {
  describe('computeGroupProperties', () => {
    it('returns null for groups above the cutoff', () => {
      const group = createDirectProduct(
        createSymmetricGroup(5),
        createSymmetricGroup(3),
      )
      expect(group.order).toBeGreaterThan(PROPERTIES_CUTOFF)
      expect(computeGroupProperties(group)).toBeNull()
    })

    it('S_3: derived series [S3, A3, {e}], solvable, not nilpotent, not perfect', () => {
      const group = createSymmetricGroup(3)
      const props = computeGroupProperties(group)!
      expect(props.derivedSeries.map(d => d.length)).toEqual([6, 3, 1])
      expect(props.solvable).toBe(true)
      expect(props.nilpotent).toBe(false)
      expect(props.perfect).toBe(false)
    })

    it('A_4: derived series [A4, V4, {e}], solvable, not nilpotent', () => {
      const group = createAlternatingGroup(4)
      const props = computeGroupProperties(group)!
      expect(props.derivedSeries.map(d => d.length)).toEqual([12, 4, 1])
      expect(props.solvable).toBe(true)
      expect(props.nilpotent).toBe(false)
      expect(props.perfect).toBe(false)
    })

    it('A_5: perfect, not solvable', () => {
      const group = createAlternatingGroup(5)
      const props = computeGroupProperties(group)!
      expect(props.perfect).toBe(true)
      expect(props.solvable).toBe(false)
      expect(props.nilpotent).toBe(false)
      // G′ = G: the derived series stabilizes immediately
      expect(props.derivedSeries).toHaveLength(1)
      expect(props.derivedSeries[0].length).toBe(60)
    })

    it('S_4: solvable, not nilpotent, not perfect', () => {
      const group = createSymmetricGroup(4)
      const props = computeGroupProperties(group)!
      expect(props.solvable).toBe(true)
      expect(props.nilpotent).toBe(false)
      expect(props.perfect).toBe(false)
      expect(props.derivedSeries.map(d => d.length)).toEqual([24, 12, 4, 1])
    })

    it('D_8: nilpotent (n is a power of 2), solvable', () => {
      const group = createDihedralGroup(8)
      const props = computeGroupProperties(group)!
      expect(props.nilpotent).toBe(true)
      expect(props.solvable).toBe(true)
      expect(props.perfect).toBe(false)
    })

    it('D_12: not nilpotent (n not a power of 2), solvable', () => {
      const group = createDihedralGroup(12)
      const props = computeGroupProperties(group)!
      expect(props.solvable).toBe(true)
      expect(props.nilpotent).toBe(false)
      expect(props.derivedSeries[1].length).toBe(6)
    })

    it('Q_8: nilpotent, solvable, not perfect', () => {
      const group = createQuaternion()
      const props = computeGroupProperties(group)!
      expect(props.nilpotent).toBe(true)
      expect(props.solvable).toBe(true)
      expect(props.perfect).toBe(false)
      expect(props.derivedSeries[1].length).toBe(2)
    })

    it('C_n and V_4: nilpotent, solvable, not perfect', () => {
      for (const group of [createCyclicGroup(7), createCyclicGroup(12), createKleinFour()]) {
        const props = computeGroupProperties(group)!
        expect(props.nilpotent).toBe(true)
        expect(props.solvable).toBe(true)
        expect(props.perfect).toBe(false)
        expect(props.derivedSeries.map(d => d.length)).toEqual([group.order, 1])
      }
    })

    it('S_3 × C_2: derived series [12, 3, 1], not nilpotent, not perfect', () => {
      const group = createDirectProduct(createSymmetricGroup(3), createCyclicGroup(2))
      const props = computeGroupProperties(group)!
      expect(props.solvable).toBe(true)
      expect(props.nilpotent).toBe(false)
      expect(props.perfect).toBe(false)
      // (G×H)′ = G′×H′ = A₃×{e}
      expect(props.derivedSeries.map(d => d.length)).toEqual([12, 3, 1])
    })
  })

  describe('convenience functions', () => {
    it('derived series stabilizes and contains only subgroups', () => {
      const group: Group = createSymmetricGroup(4)
      const props = computeGroupProperties(group)!
      for (const stage of props.derivedSeries) {
        const idSet = new Set(stage.map(e => e.id))
        expect(idSet.has(group.identity.id)).toBe(true)
        for (const a of stage) {
          expect(idSet.has(group.inverse(a).id)).toBe(true)
          for (const b of stage) {
            expect(idSet.has(group.multiply(a, b).id)).toBe(true)
          }
        }
      }
      // G′ ⊆ G
      const gPrime = props.derivedSeries[1]
      expect(elementIds(gPrime).every(id => group.elements.some(e => e.id === id))).toBe(true)
    })

    it('helpers return false for groups above cutoff', () => {
      const group = createDirectProduct(createSymmetricGroup(5), createSymmetricGroup(3))
      expect(isSolvable(group)).toBe(false)
      expect(isNilpotent(group)).toBe(false)
      expect(isPerfect(group)).toBe(false)
    })

    it('abelian groups of any order are solvable and nilpotent', () => {
      for (const n of [5, 9, 15]) {
        expect(isSolvable(createCyclicGroup(n))).toBe(true)
        expect(isNilpotent(createCyclicGroup(n))).toBe(true)
        expect(isPerfect(createCyclicGroup(n))).toBe(false)
      }
    })
  })
})

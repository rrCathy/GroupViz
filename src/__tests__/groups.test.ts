import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup, createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import type { Group, GroupElement } from '../core/types'

function getRandomElement(group: Group): GroupElement {
  const idx = Math.floor(Math.random() * group.elements.length)
  return group.elements[idx]
}

function testGroupAxioms(group: Group, groupName: string) {
  describe(`${groupName} (order ${group.order})`, () => {
    it('should have correct order', () => {
      expect(group.elements.length).toBe(group.order)
    })

    it('should have identity element', () => {
      expect(group.identity).toBeDefined()
      expect(group.identity.id).toBeDefined()
    })

    it('identity: a * e = a for all a', () => {
      for (const a of group.elements) {
        const result = group.multiply(a, group.identity)
        expect(result.id).toBe(a.id)
      }
    })

    it('identity: e * a = a for all a', () => {
      for (const a of group.elements) {
        const result = group.multiply(group.identity, a)
        expect(result.id).toBe(a.id)
      }
    })

    it('inverse: a * a^(-1) = e for all a', () => {
      for (const a of group.elements) {
        const inv = group.inverse(a)
        const result = group.multiply(a, inv)
        expect(result.id).toBe(group.identity.id)
      }
    })

    it('inverse: a^(-1) * a = e for all a', () => {
      for (const a of group.elements) {
        const inv = group.inverse(a)
        const result = group.multiply(inv, a)
        expect(result.id).toBe(group.identity.id)
      }
    })

    it('associativity: (a * b) * c = a * (b * c) for sample elements', () => {
      const sampleSize = Math.min(20, group.order)
      for (let i = 0; i < sampleSize; i++) {
        const a = getRandomElement(group)
        const b = getRandomElement(group)
        const c = getRandomElement(group)
        
        const ab_c = group.multiply(group.multiply(a, b), c)
        const a_bc = group.multiply(a, group.multiply(b, c))
        
        expect(ab_c.id).toBe(a_bc.id)
      }
    })

    it('closure: a * b is in group for all a, b', () => {
      const elementIds = new Set(group.elements.map(e => e.id))
      const sampleSize = Math.min(30, group.order)
      
      for (let i = 0; i < sampleSize; i++) {
        const a = getRandomElement(group)
        const b = getRandomElement(group)
        const result = group.multiply(a, b)
        expect(elementIds.has(result.id)).toBe(true)
      }
    })

    if (group.generators.length > 0) {
      it('generators should produce valid elements', () => {
        for (const gen of group.generators) {
          const result = gen.apply(group.identity)
          expect(result).toBeDefined()
          expect(result.id).toBeDefined()
        }
      })
    }
  })
}

describe('Group Axioms Verification', () => {
  testGroupAxioms(createCyclicGroup(1), 'C_1 (trivial)')
  testGroupAxioms(createCyclicGroup(2), 'C_2')
  testGroupAxioms(createCyclicGroup(3), 'C_3')
  testGroupAxioms(createCyclicGroup(5), 'C_5')
  testGroupAxioms(createCyclicGroup(7), 'C_7')
  testGroupAxioms(createCyclicGroup(12), 'C_12')
  
  testGroupAxioms(createS3(), 'S_3')
  testGroupAxioms(createSymmetricGroup(4), 'S_4')
  
  testGroupAxioms(createDihedralGroup(3), 'D_3')
  testGroupAxioms(createDihedralGroup(4), 'D_4')
  testGroupAxioms(createDihedralGroup(5), 'D_5')
  testGroupAxioms(createDihedralGroup(6), 'D_6')
  
  testGroupAxioms(createAlternatingGroup(4), 'A_4')
  testGroupAxioms(createAlternatingGroup(5), 'A_5')
  testGroupAxioms(createAlternatingGroup(6), 'A_6')
  
  testGroupAxioms(createKleinFour(), 'V_4')
  testGroupAxioms(createQuaternion(), 'Q_8')
})

describe('Specific Group Properties', () => {
  describe('Cyclic Groups', () => {
    it('C_n should be abelian', () => {
      const group = createCyclicGroup(6)
      expect(group.isAbelian).toBe(true)
      
      for (let i = 0; i < 10; i++) {
        const a = getRandomElement(group)
        const b = getRandomElement(group)
        expect(group.multiply(a, b).id).toBe(group.multiply(b, a).id)
      }
    })

    it('C_n should have exponent n', () => {
      const group = createCyclicGroup(5)
      expect(group.exponent).toBe(5)
    })
  })

  describe('Symmetric Groups', () => {
    it('S_3 should not be abelian', () => {
      const group = createS3()
      expect(group.isAbelian).toBe(false)
    })

    it('S_n should have order n!', () => {
      const s3 = createS3()
      expect(s3.order).toBe(6)
      
      const s4 = createSymmetricGroup(4)
      expect(s4.order).toBe(24)
    })
  })

  describe('Dihedral Groups', () => {
    it('D_n should have order 2n', () => {
      const d3 = createDihedralGroup(3)
      expect(d3.order).toBe(6)
      
      const d4 = createDihedralGroup(4)
      expect(d4.order).toBe(8)
    })

    it('D_n should not be abelian for n >= 3', () => {
      const group = createDihedralGroup(4)
      expect(group.isAbelian).toBe(false)
    })
  })

  describe('Alternating Groups', () => {
    it('A_n should have order n!/2', () => {
      const a4 = createAlternatingGroup(4)
      expect(a4.order).toBe(12)
      
      const a5 = createAlternatingGroup(5)
      expect(a5.order).toBe(60)

      const a6 = createAlternatingGroup(6)
      expect(a6.order).toBe(360)
    })

    it('A_n should not be abelian for n >= 4', () => {
      const group = createAlternatingGroup(4)
      expect(group.isAbelian).toBe(false)
    })

    it('A_n element labels follow the S_n notation (single cycle loses its parens)', () => {
      const a4 = createAlternatingGroup(4)
      const threeCycle = a4.elements.find(el => el.value.join(',') === '1,3,4,2')!
      expect(threeCycle.label).toBe('234')            // 旧实现为 '(234)'，与 S₄ 两套记法
      const doubleTransposition = a4.elements.find(el => el.value.join(',') === '2,1,4,3')!
      expect(doubleTransposition.label).toBe('(12)(34)')
      const s4 = createSymmetricGroup(4)
      expect(s4.elements.find(el => el.value.join(',') === '1,3,4,2')!.label).toBe('234')
    })
  })

  describe('Special Groups', () => {
    it('V_4 should be abelian', () => {
      const group = createKleinFour()
      expect(group.isAbelian).toBe(true)
      expect(group.order).toBe(4)
    })

    it('Q_8 should not be abelian', () => {
      const group = createQuaternion()
      expect(group.isAbelian).toBe(false)
      expect(group.order).toBe(8)
    })
  })
})

// 生成元闭包 = 全群（A_n 的生成对不能随便挑：闭包不足时界面会显示
// 「生成元生成不出这个群」的假象——反馈实测反例 (123)+(12345) 闭包只有 60 阶）。
// 本次为 A₆ 新增相邻 3-循环生成集，本组测试同时锁定既有 A₃–A₅ 不回退。
describe('Alternating group generators span the whole group', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`A_${n}: closure of the generator set = all ${n}! / 2 elements`, () => {
      const group = createAlternatingGroup(n)
      expect(group.generators.length).toBeGreaterThan(0)
      const seen = new Set([group.identity.id])
      const queue: GroupElement[] = [group.identity]
      while (queue.length > 0) {
        const el = queue.pop()!
        for (const gen of group.generators) {
          const next = gen.apply(el)
          if (!seen.has(next.id)) {
            seen.add(next.id)
            queue.push(next)
          }
        }
      }
      expect(seen.size).toBe(group.order)
    })
  }

  it('A_6 generators are the consecutive 3-cycles (1 2 3)(2 3 4)(3 4 5)(4 5 6)', () => {
    const a6 = createAlternatingGroup(6)
    expect(a6.generators.map(g => g.symbol)).toEqual(['(123)', '(234)', '(345)', '(456)'])
  })
})

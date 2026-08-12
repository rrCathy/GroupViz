import { describe, expect, it } from 'vitest'
import { detectAbelianType, detectIsomorphicGroup } from '../core/algebra/subgroups'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'

function directProductOf(orders: number[]) {
  let g = createCyclicGroup(orders[0])!
  for (let i = 1; i < orders.length; i++) {
    g = createDirectProduct(g, createCyclicGroup(orders[i])!)
  }
  return g
}

describe('detectAbelianType', () => {
  it('identifies multi-factor abelian groups exactly', () => {
    expect(detectAbelianType(directProductOf([2, 2, 2]))).toBe('C_{2}\\times C_{2}\\times C_{2}')
    expect(detectAbelianType(directProductOf([2, 4]))).toBe('C_{2}\\times C_{4}')
    expect(detectAbelianType(directProductOf([4, 4]))).toBe('C_{4}\\times C_{4}')
    expect(detectAbelianType(directProductOf([2, 6]))).toBe('C_{2}\\times C_{6}')
    expect(detectAbelianType(directProductOf([2, 2, 4]))).toBe('C_{2}\\times C_{2}\\times C_{4}')
    expect(detectAbelianType(directProductOf([2, 8]))).toBe('C_{2}\\times C_{8}')
  })

  it('returns null for non-abelian groups', () => {
    expect(detectAbelianType(createSymmetricGroup(3)!)).toBeNull()
    expect(detectAbelianType(createQuaternion())).toBeNull()
    expect(detectAbelianType(createDihedralGroup(4)!)).toBeNull()
  })
})

describe('detectIsomorphicGroup regression', () => {
  it('keeps previous abelian results', () => {
    expect(detectIsomorphicGroup(createCyclicGroup(12)!)).toBe('C_{12}')
    expect(detectIsomorphicGroup(createCyclicGroup(1)!)).toBe('C_{1}')
    expect(detectIsomorphicGroup(createKleinFour())).toBe('C_{2}\\times C_{2}')
    expect(detectIsomorphicGroup(directProductOf([2, 4]))).toBe('C_{2}\\times C_{4}')
  })

  it('keeps previous non-abelian results', () => {
    expect(detectIsomorphicGroup(createSymmetricGroup(3)!)).toBe('D_{3}')
    expect(detectIsomorphicGroup(createQuaternion())).toBe('Q_{8}')
    expect(detectIsomorphicGroup(createAlternatingGroup(4)!)).toBe('A_{4}')
    expect(detectIsomorphicGroup(createSymmetricGroup(4)!)).toBe('S_{4}')
    expect(detectIsomorphicGroup(createAlternatingGroup(5)!)).toBe('A_{5}')
    expect(detectIsomorphicGroup(createDihedralGroup(4)!)).toBe('D_{4}')
  })

  it('detects abelian direct products beyond two factors', () => {
    expect(detectIsomorphicGroup(directProductOf([2, 2, 2]))).toBe('C_{2}\\times C_{2}\\times C_{2}')
    expect(detectIsomorphicGroup(directProductOf([2, 2, 4]))).toBe('C_{2}\\times C_{2}\\times C_{4}')
    expect(detectIsomorphicGroup(directProductOf([4, 4]))).toBe('C_{4}\\times C_{4}')
  })

  it('returns null when no candidate matches', () => {
    const g = createDirectProduct(createCyclicGroup(3)!, createSymmetricGroup(3)!)
    expect(detectIsomorphicGroup(g)).toBeNull()
  })
})

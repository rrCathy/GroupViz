import { describe, it, expect } from 'vitest'
import { getSymmetryType } from '../core/symmetryType'
import type { Group } from '../core/types'

function groupWithSymbol(symbol: string): Group {
  return {
    symbol,
    name: symbol,
    order: 1,
    identity: { id: 'e0', label: 'e' },
    elements: [],
    generators: [],
    multiply: () => ({ id: 'e0', label: 'e' }),
    inverse: () => ({ id: 'e0', label: 'e' }),
  } as unknown as Group
}

describe('getSymmetryType', () => {
  it('classifies cyclic groups', () => {
    expect(getSymmetryType(groupWithSymbol('C_{3}'))).toBe('cyclic')
    expect(getSymmetryType(groupWithSymbol('C_{8}'))).toBe('cyclic')
  })

  it('classifies dihedral groups', () => {
    expect(getSymmetryType(groupWithSymbol('D_{4}'))).toBe('dihedral')
  })

  it('classifies named polyhedral groups', () => {
    expect(getSymmetryType(groupWithSymbol('A_{4}'))).toBe('tetrahedron')
    expect(getSymmetryType(groupWithSymbol('S_{4}'))).toBe('cube')
    expect(getSymmetryType(groupWithSymbol('A_{5}'))).toBe('icosahedron')
    expect(getSymmetryType(groupWithSymbol('V_{4}'))).toBe('rectangle')
  })

  it('classifies SL(2,3) as binary tetrahedron (2T, double cover of A4)', () => {
    // 二元四面体群：与 A₄ 同几何（四面体），但多出双覆盖/皮带戏法语义；
    // 必须先于 S/A 前缀截杀命中（'SL(2,3)' 以 S 开头）
    expect(getSymmetryType(groupWithSymbol('SL(2,3)'))).toBe('binaryTetrahedron')
  })

  it('treats direct products of the cyclic class as unsupported (not cyclic/dihedral)', () => {
    expect(getSymmetryType(groupWithSymbol('C_{4}\\times C_{2}'))).toBe('unsupported')
    expect(getSymmetryType(groupWithSymbol('C_{2}\\times S_{3}'))).toBe('unsupported')
    expect(getSymmetryType(groupWithSymbol('C_{2}^{3}'))).toBe('unsupported')
    expect(getSymmetryType(groupWithSymbol('C_{3}^{2}'))).toBe('unsupported')
  })

  it('maps the rectangle group V4 (any construction) to rectangle', () => {
    expect(getSymmetryType(groupWithSymbol('C_{2}^{2}'))).toBe('rectangle')
    expect(getSymmetryType(groupWithSymbol('C_{2}\\times C_{2}'))).toBe('rectangle')
  })

  it('maps S3 to dihedral (S3 ≅ D3) and treats other non-cyclic classes as unsupported', () => {
    expect(getSymmetryType(groupWithSymbol('S_{3}'))).toBe('dihedral')
    expect(getSymmetryType(groupWithSymbol('Q_{8}'))).toBe('unsupported')
    expect(getSymmetryType(groupWithSymbol('GL(2,3)'))).toBe('unsupported')
  })
})

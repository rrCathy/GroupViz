import { describe, it, expect } from 'vitest'
import { getSymmetryType } from '../components/Canvas/SymmetryView'
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

import { describe, it, expect } from 'vitest'
import { computeElementRotation } from '../core/elementRotation'
import type { Group } from '../core/types'

function mockGroup(symbol: string, order: number, values: number[][]): Group {
  const elements = values.map((value, i) => ({ id: String(i), label: '', value }))
  return {
    symbol,
    order,
    identity: elements[0],
    elements,
  } as unknown as Group
}

describe('computeElementRotation', () => {
  it('identity element gets the identity rotation (angle 0)', () => {
    const group = mockGroup('S_{4}', 24, [[], [2, 1, 4, 3]])
    const r = computeElementRotation(group, group.elements[0])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(0)
  })

  it('returns rotation info for valid S4 double transposition', () => {
    const group = mockGroup('S_{4}', 24, [[], [2, 1, 4, 3]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(Math.PI)
  })

  it('does not hang on malformed values (0-indexed or out-of-range entries)', () => {
    const group = mockGroup('A_{5}', 60, [
      [],
      [1, 2, 0, 4, 5],
      [2, 3, 1, 5, 4],
      [1, 0, 2, 3, 4],
    ])
    for (const el of group.elements.slice(1)) {
      const r = computeElementRotation(group, el)
      expect(r).not.toBeNull()
    }
  })

  it('returns null for unsupported group symbols', () => {
    const group = mockGroup('X_{9}', 9, [[], [1, 2, 3]])
    expect(computeElementRotation(group, group.elements[1])).toBeNull()
  })

  it('maps cyclic group element to a rotation around Y axis', () => {
    const group = mockGroup('C_{6}', 6, [[], [2]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.axis).toEqual([0, 1, 0])
    expect(r!.angleRad).toBeCloseTo((2 * 2 * Math.PI) / 6)
  })

  it('maps S3 3-cycle to 120° rotation and transposition to 180° flip', () => {
    // S3 ≅ D3: identity + two 3-cycles (ct '3') + three transpositions (ct '2')
    const group = mockGroup('S_{3}', 6, [
      [],
      [2, 3, 1], // 3-cycle
      [3, 1, 2], // 3-cycle
      [2, 1, 3], // transposition (fix 3)
    ])
    const r3 = computeElementRotation(group, group.elements[1])
    expect(r3).not.toBeNull()
    expect(Math.abs(r3!.angleRad)).toBeCloseTo((2 * Math.PI) / 3, 5)
    const r2 = computeElementRotation(group, group.elements[3])
    expect(r2).not.toBeNull()
    expect(r2!.angleRad).toBe(Math.PI)
    expect(r2!.axis[1]).toBe(0)
  })

  it('maps dihedral reflection to a flip about an axis in the XZ plane', () => {
    const group = mockGroup('D_{4}', 8, [[0, 0], [1, 1]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(Math.PI)
    expect(r!.axis[1]).toBe(0)
  })
})

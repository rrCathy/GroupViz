import { describe, it, expect } from 'vitest'
import { compute3DPositions } from '../core/algebra/layout3D'
import type { Group } from '../core/types'

function mockGroup(n: number, idPrefix = 'x'): Group {
  return {
    symbol: `M_{${n}}`,
    order: n,
    identity: { id: idPrefix + '0', label: '', value: [] },
    elements: Array.from({ length: n }, (_, i) => ({ id: idPrefix + i, label: '', value: [] })),
  } as unknown as Group
}

describe('compute3DPositions', () => {
  it('fills every position for a plain group on a sphere', () => {
    const group = mockGroup(10)
    const pos = compute3DPositions(group, 'spherical')
    expect(pos).toHaveLength(10)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(p).toHaveLength(3)
    }
  })

  it('fills every position even when element ids do not match the canonical permutation format', () => {
    const group = mockGroup(24, 'x')
    const pos = compute3DPositions(group, 'rhombicuboctahedron')
    expect(pos).toHaveLength(24)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
  })

  it('fills every position for a 60-element group on a truncated dodecahedron', () => {
    const group = mockGroup(60, 'y')
    const pos = compute3DPositions(group, 'truncatedDodecahedron')
    expect(pos).toHaveLength(60)
    for (const p of pos) {
      expect(p).toBeDefined()
    }
  })

  it('returns distinct positions (not all coincident)', () => {
    const group = mockGroup(12)
    const pos = compute3DPositions(group, 'lattice')
    expect(pos).toHaveLength(12)
    const distinct = new Set(pos.map(p => p.join(',')))
    expect(distinct.size).toBeGreaterThan(1)
  })
})

import { describe, it, expect } from 'vitest'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'
import { compute3DPositions } from '../core/algebra/layout3D'
import { ringOrder, computeElementOrder } from '../core/algebra/forceLayout'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import type { Group, Layout3D } from '../core/types'

const W = 800
const H = 600

describe('computeShape2DPositions', () => {
  it('returns null for the circular fallback shape', () => {
    const C6 = createCyclicGroup(6)
    expect(computeShape2DPositions(C6, 'circular', W, H)).toBeNull()
  })

  it('spherical layout covers every element', () => {
    const C6 = createCyclicGroup(6)
    const pos = computeShape2DPositions(C6, 'spherical', W, H)!
    expect(pos.size).toBe(6)
    for (const el of C6.elements) expect(pos.has(el.id)).toBe(true)
  })

  it('grid layout works for direct products and returns null otherwise', () => {
    const DP = createDirectProduct(createCyclicGroup(3), createCyclicGroup(3))
    const pos = computeShape2DPositions(DP, 'grid', W, H)!
    expect(pos.size).toBe(9)
    const C6 = createCyclicGroup(6)
    expect(computeShape2DPositions(C6, 'grid', W, H)).toBeNull()
  })

  it('concentric layout covers every element', () => {
    const S3 = createS3()
    const pos = computeShape2DPositions(S3, 'concentric', W, H)!
    expect(pos.size).toBe(6)
  })

  it('dualRing layout covers every element', () => {
    const D6 = createDihedralGroup(6)
    const pos = computeShape2DPositions(D6, 'dualRing', W, H)!
    expect(pos.size).toBe(12)
  })

  it('archimedean / spiral / coil layouts cover every element', () => {
    const C12 = createCyclicGroup(12)
    expect(computeShape2DPositions(C12, 'archimedean', W, H)!.size).toBe(12)
    expect(computeShape2DPositions(C12, 'spiral', W, H)!.size).toBe(12)
    expect(computeShape2DPositions(C12, 'coil', W, H)!.size).toBe(12)
  })

  it('projection3D layout covers every element', () => {
    const S3 = createS3()
    const pos = computeShape2DPositions(S3, 'projection3D', W, H)!
    expect(pos.size).toBe(6)
  })

  it('positions lie within the canvas bounds', () => {
    const C12 = createCyclicGroup(12)
    const pos = computeShape2DPositions(C12, 'coil', W, H)!
    for (const p of pos.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(W)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(H)
    }
  })
})

describe('compute3DPositions', () => {
  it('returns one position per element', () => {
    const C12 = createCyclicGroup(12)
    const pos = compute3DPositions(C12, 'circular')
    expect(pos.length).toBe(12)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('circular layout lies in the xz plane', () => {
    const C12 = createCyclicGroup(12)
    const pos = compute3DPositions(C12, 'circular')
    for (const p of pos) expect(Math.abs(p[1])).toBeLessThan(1e-9)
  })

  it('dihedral layout places rotations and reflections on two rings', () => {
    const D6 = createDihedralGroup(6)
    const pos = compute3DPositions(D6, 'dihedral')
    expect(pos.length).toBe(12)
    const upper = pos.filter(p => p[1] > 0)
    const lower = pos.filter(p => p[1] < 0)
    expect(upper.length).toBe(6)
    expect(lower.length).toBe(6)
  })

  it('lattice layout works for direct products', () => {
    const DP = createDirectProduct(createCyclicGroup(3), createCyclicGroup(3))
    const pos = compute3DPositions(DP, 'lattice')
    expect(pos.length).toBe(9)
  })

  it('cylinder layout works for a product with exactly one cyclic factor', () => {
    const DP = createDirectProduct(createCyclicGroup(4), createCyclicGroup(2))
    const pos = compute3DPositions(DP, 'cylinder')
    expect(pos.length).toBe(8)
  })

  it('torus layout works for products of non-cyclic factors', () => {
    const DP = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    const pos = compute3DPositions(DP, 'torus')
    expect(pos.length).toBe(4)
  })

  it('hexagon layout applies to S3', () => {
    const S3 = createS3()
    const pos = compute3DPositions(S3, 'hexagon')
    expect(pos.length).toBe(6)
  })

  it('truncatedTetrahedron layout covers all of A4', () => {
    const A4 = createAlternatingGroup(4)
    const pos = compute3DPositions(A4, 'truncatedTetrahedron')
    expect(pos.length).toBe(12)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('truncatedCube layout covers all of S4', () => {
    const S4 = createSymmetricGroup(4)
    const pos = compute3DPositions(S4, 'truncatedCube')
    expect(pos.length).toBe(24)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('spherical layout works for any group', () => {
    const D6 = createDihedralGroup(6)
    const pos = compute3DPositions(D6, 'spherical')
    expect(pos.length).toBe(12)
  })

  it('all 3D layouts produce finite coordinates', () => {
    const layouts: Layout3D[] = ['lattice', 'cylinder', 'circular', 'torus', 'hexagon', 'dihedral', 'tetrahedron', 'cube', 'cuboctahedron', 'spherical']
    const group: Group = createS3()
    for (const layout of layouts) {
      const pos = compute3DPositions(group, layout)
      expect(pos.length).toBe(6)
      for (const p of pos) {
        expect(Number.isFinite(p[0])).toBe(true)
        expect(Number.isFinite(p[1])).toBe(true)
        expect(Number.isFinite(p[2])).toBe(true)
      }
    }
  })
})

describe('ringOrder', () => {
  it('sorts keys numerically', () => {
    expect(ringOrder(['2', '10', '1'])).toEqual(['1', '2', '10'])
  })

  it('sorts mixed cyclic keys numerically', () => {
    const keys = ['e10', 'e2', 'e1', 'e12', 'e3']
    const result = ringOrder(keys)
    expect(result).toEqual(['e1', 'e2', 'e3', 'e10', 'e12'])
  })

  it('leaves non-numeric keys in stable order', () => {
    const keys = ['b', 'a', 'c']
    expect(ringOrder(keys)).toEqual(['a', 'b', 'c'])
  })
})

describe('computeElementOrder', () => {
  it('identity has order 1', () => {
    const C6 = createCyclicGroup(6)
    expect(computeElementOrder(C6.identity, C6)).toBe(1)
  })

  it('computes orders in cyclic groups', () => {
    const C6 = createCyclicGroup(6)
    const byId = new Map(C6.elements.map(el => [el.id, el]))
    expect(computeElementOrder(byId.get('e1')!, C6)).toBe(6)
    expect(computeElementOrder(byId.get('e2')!, C6)).toBe(3)
    expect(computeElementOrder(byId.get('e3')!, C6)).toBe(2)
  })

  it('element orders divide the group order', () => {
    const S3 = createS3()
    for (const el of S3.elements) {
      expect(S3.order % computeElementOrder(el, S3)).toBe(0)
    }
  })
})

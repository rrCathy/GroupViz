import { describe, it, expect } from 'vitest'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'
import { compute3DPositions } from '../core/algebra/layout3D'
import { ringOrder, computeElementOrder, cayleyCircleLayout } from '../core/algebra/forceLayout'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createKleinFour } from '../core/groups/SpecialGroup'
import type { Group, Layout3D, CayleyAction } from '../core/types'

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

describe('cayleyCircleLayout', () => {
  interface Pt { x: number; y: number }

  function genActions(group: Group): CayleyAction[] {
    return group.generators.map((g, i) => ({
      elementId: g.apply(group.identity).id,
      enabled: true,
      color: `c${i}`,
    }))
  }

  function angleOf(pos: Pt, cx: number, cy: number): number {
    return (Math.atan2(pos.y - cy, pos.x - cx) * 180) / Math.PI
  }

  function orient(a: Pt, b: Pt, c: Pt): number {
    return (b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y)
  }

  function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    const o1 = orient(a, b, c)
    const o2 = orient(a, b, d)
    const o3 = orient(c, d, a)
    const o4 = orient(c, d, b)
    return (o1 * o2 < 0) && (o3 * o4 < 0)
  }

  function crossingCount(group: Group): number {
    const layout = cayleyCircleLayout(group, 100, 100, 80)
    const edges = computeCayleyActionEdges(group, genActions(group), 'right')
    const pts = new Map<string, Pt>()
    edges.forEach(e => {
      const f = layout.get(e.fromId)
      const t = layout.get(e.toId)
      if (f) pts.set(e.fromId, f)
      if (t) pts.set(e.toId, t)
    })
    let count = 0
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i]
        const e2 = edges[j]
        if (e1.fromId === e2.fromId || e1.fromId === e2.toId ||
            e1.toId === e2.fromId || e1.toId === e2.toId) continue
        const a = pts.get(e1.fromId)
        const b = pts.get(e1.toId)
        const c = pts.get(e2.fromId)
        const d = pts.get(e2.toId)
        if (!a || !b || !c || !d) continue
        if (segmentsCross(a, b, c, d)) count++
      }
    }
    return count
  }

  it('draws S₃ permutations as a crossing-free hexagon', () => {
    const S3 = createS3()
    const layout = cayleyCircleLayout(S3, 100, 100, 80)
    const byAngle = [...layout.entries()]
      .sort((a, b) => angleOf(a[1], 100, 100) - angleOf(b[1], 100, 100))
      .map(([id]) => id)
    expect(byAngle).toEqual(['1,3,2', '1,2,3', '2,1,3', '2,3,1', '3,2,1', '3,1,2'])
    expect(crossingCount(S3)).toBe(0)
  })

  it('draws D₃ (dihedral ids) as a dual ring without crossings', () => {
    const D3 = createDihedralGroup(3)
    const layout = cayleyCircleLayout(D3, 100, 100, 80)
    const rotAngle = new Map<string, number>()
    const refAngle = new Map<string, number>()
    D3.elements.forEach(el => {
      const pos = layout.get(el.id)!
      const angle = angleOf(pos, 100, 100)
      const dist = Math.hypot(pos.x - 100, pos.y - 100)
      if (el.value[1] === 0) {
        rotAngle.set(el.id, angle)
        expect(dist).toBeCloseTo(80, 3)
      } else {
        refAngle.set(el.id, angle)
        expect(dist).toBeCloseTo(44, 3)
      }
    })
    // s_k must sit radially under its s-edge partner r_k (multiply convention)
    const rId = (k: number) => D3.elements.find(e => e.value[0] === k && e.value[1] === 0)!.id
    const sId = (k: number) => D3.elements.find(e => e.value[0] === k && e.value[1] === 1)!.id
    expect(refAngle.get(sId(0))).toBeCloseTo(rotAngle.get(rId(0))!, 3)
    expect(refAngle.get(sId(1))).toBeCloseTo(rotAngle.get(rId(1))!, 3)
    expect(refAngle.get(sId(2))).toBeCloseTo(rotAngle.get(rId(2))!, 3)
    expect(crossingCount(D3)).toBe(0)
  })

  it('draws D₄ without crossings', () => {
    expect(crossingCount(createDihedralGroup(4))).toBe(0)
  })

  it('keeps V₄ on a plain square (no false dual-ring)', () => {
    const V4 = createKleinFour()
    const layout = cayleyCircleLayout(V4, 100, 100, 80)
    const dists = [...layout.values()].map(p => Math.hypot(p.x - 100, p.y - 100))
    dists.forEach(d => expect(d).toBeCloseTo(80, 3))
    expect(layout.size).toBe(4)
  })

  it('lays out direct products factor-wise with ring order', () => {
    const prod = createDirectProduct(createCyclicGroup(2), createS3())
    const layout = cayleyCircleLayout(prod, 100, 100, 80)
    expect(layout.size).toBe(prod.order)
    prod.elements.forEach(el => expect(layout.has(el.id)).toBe(true))
  })
})

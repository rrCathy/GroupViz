import { describe, it, expect } from 'vitest'
import {
  truncatedTetrahedron,
  truncatedCube,
  rhombicuboctahedron,
  truncatedOctahedron,
  truncatedIcosahedron,
  truncatedDodecahedron,
  computeSkeletonEdges,
  type Vec3,
} from '../core/polyhedra'
import { computeElementRotation } from '../core/elementRotation'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

describe('polyhedra vertex generation', () => {
  const cases: [string, () => number[][], number][] = [
    ['truncatedTetrahedron', truncatedTetrahedron, 12],
    ['truncatedCube', truncatedCube, 24],
    ['rhombicuboctahedron', rhombicuboctahedron, 24],
    ['truncatedOctahedron', truncatedOctahedron, 24],
    ['truncatedIcosahedron', truncatedIcosahedron, 60],
    ['truncatedDodecahedron', truncatedDodecahedron, 60],
  ]

  for (const [name, fn, count] of cases) {
    it(`${name} has ${count} vertices`, () => {
      const verts = fn()
      expect(verts.length).toBe(count)
      for (const v of verts) {
        expect(v.length).toBe(3)
        for (const c of v) expect(Number.isFinite(c)).toBe(true)
      }
    })
  }

  it('respects the radius parameter', () => {
    const r1 = truncatedCube(1)
    const r5 = truncatedCube(5)
    expect(r1[0][0]).toBeCloseTo(r5[0][0] / 5, 6)
  })

  it('computeSkeletonEdges returns non-empty edge lists', () => {
    for (const fn of [truncatedTetrahedron, truncatedCube, truncatedIcosahedron]) {
      const edges = computeSkeletonEdges(fn())
      expect(edges.length).toBeGreaterThan(0)
      for (const [a, b] of edges) {
        expect(a).toBeGreaterThanOrEqual(0)
        expect(b).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('truncated dodecahedron skeleton has exactly 90 edges (coordinate regression)', () => {
    // Regression: sets[1]/sets[2] used to read [1/phi,1,2*phi]/[1/phi,phi,1+2*phi],
    // which is not the truncated dodecahedron (60 vertices, 90 edges, degree 3).
    const edges = computeSkeletonEdges(truncatedDodecahedron(5))
    expect(edges.length).toBe(90)
    const dists = edges.map(([a, b]) => {
      const v1 = truncatedDodecahedron(5)[a] as number[]
      const v2 = truncatedDodecahedron(5)[b] as number[]
      return Math.hypot(v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2])
    })
    const first = dists[0]
    for (const d of dists) expect(d).toBeCloseTo(first, 9)
  })

  it('rhombicuboctahedron skeleton has exactly 48 edges (4-regular support)', () => {
    // Regression: computeSkeletonEdges hard-coded target = 3n/2, which rejected
    // the 4-regular rhombicuboctahedron (24 vertices, 48 edges) and fell back to
    // a 24-edge pseudo-skeleton.
    const edges = computeSkeletonEdges(rhombicuboctahedron())
    expect(edges.length).toBe(48)
  })

  it('every vertex has the expected degree in each skeleton', () => {
    const solids: [() => Vec3[], number][] = [
      [truncatedTetrahedron, 3],
      [truncatedCube, 3],
      [rhombicuboctahedron, 4],
      [truncatedOctahedron, 3],
      [truncatedIcosahedron, 3],
      [truncatedDodecahedron, 3],
    ]
    for (const [fn, degree] of solids) {
      const verts = fn()
      const edges = computeSkeletonEdges(verts)
      const deg = new Array(verts.length).fill(0)
      for (const [a, b] of edges) {
        deg[a as number]++
        deg[b as number]++
      }
      for (const d of deg) expect(d).toBe(degree)
    }
  })
})

describe('computeElementRotation', () => {
  it('identity maps to a zero rotation', () => {
    const C6 = createCyclicGroup(6)
    const rot = computeElementRotation(C6, C6.identity)
    expect(rot).not.toBeNull()
    expect(rot!.angleRad).toBe(0)
  })

  it('returns null for unsupported groups', () => {
    const S3 = createS3()
    const rot = computeElementRotation(S3, S3.elements[1])
    expect(rot).toBeNull()
  })

  it('cyclic group rotations lie on the y-axis with correct angle', () => {
    const C6 = createCyclicGroup(6)
    const byId = new Map(C6.elements.map(el => [el.id, el]))
    const r2 = computeElementRotation(C6, byId.get('e2')!)!
    expect(r2.axis).toEqual([0, 1, 0])
    expect(r2.angleRad).toBeCloseTo((2 * 2 * Math.PI) / 6, 6)
    const r4 = computeElementRotation(C6, byId.get('e4')!)!
    expect(r4.angleRad).toBeCloseTo((4 * 2 * Math.PI) / 6, 6)
  })

  it('dihedral rotations and reflections are distinguished', () => {
    const D4 = createDihedralGroup(4)
    // find a rotation (s component = 0) and a reflection (s component = 1)
    let rotation = null as ReturnType<typeof computeElementRotation> | null
    let reflection = null as ReturnType<typeof computeElementRotation> | null
    for (const el of D4.elements) {
      if (el.id === D4.identity.id) continue
      const r = computeElementRotation(D4, el)
      if (!r) continue
      if (r.angleRad === Math.PI && el.value[1] === 1 && !reflection) reflection = r
      if (r.angleRad !== Math.PI && !rotation) rotation = r
    }
    expect(rotation).not.toBeNull()
    expect(reflection).not.toBeNull()
    // reflection axis must be a unit vector in the xz plane
    const [x, y, z] = reflection!.axis
    expect(Math.abs(y)).toBeLessThan(1e-9)
    expect(Math.hypot(x, z)).toBeCloseTo(1, 6)
  })

  it('A4 3-cycles rotate about a vertex axis by 120 degrees', () => {
    const A4 = createAlternatingGroup(4)
    let found: ReturnType<typeof computeElementRotation> | null = null
    for (const el of A4.elements) {
      if (el.id === A4.identity.id) continue
      const r = computeElementRotation(A4, el)
      if (r && Math.abs(Math.abs(r.angleRad) - (2 * Math.PI) / 3) < 1e-9) { found = r; break }
    }
    expect(found).not.toBeNull()
    expect(Math.hypot(...found!.axis)).toBeCloseTo(1, 6)
  })

  it('S4 4-cycles rotate about a face axis by 90 degrees', () => {
    const S4 = createSymmetricGroup(4)
    let found: ReturnType<typeof computeElementRotation> | null = null
    for (const el of S4.elements) {
      if (el.id === S4.identity.id) continue
      const r = computeElementRotation(S4, el)
      if (r && Math.abs(Math.abs(r.angleRad) - Math.PI / 2) < 1e-9) { found = r; break }
    }
    expect(found).not.toBeNull()
    expect(Math.hypot(...found!.axis)).toBeCloseTo(1, 6)
  })
})

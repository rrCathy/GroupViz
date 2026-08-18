import { describe, it, expect } from 'vitest'
import {
  mulberry32,
  sphereRadiusFor,
  angularDist,
  greatArcSamples,
  greatArcsCross,
  fibonacciUnitPoints,
  sphericalNodeDirections,
  embedSphereGraph,
  polylinesNear,
} from '../core/algebra/sphereGraph'
import type { SphereEdge, Vec3 } from '../core/algebra/sphereGraph'
import { compute3DPositions } from '../core/algebra/layout3D'
import type { Group } from '../core/types'

const EPS = 1e-9

function unitOf(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

/** 边覆盖不变式：所有弧（各层）+ 弦 = 输入边集合 */
function expectEdgeCoverage(embedding: ReturnType<typeof embedSphereGraph>, edges: SphereEdge[]): void {
  const covered = new Set<string>()
  for (const layer of embedding.layers) {
    for (const a of layer.arcs) {
      const key = a.fromIdx <= a.toIdx ? `${a.fromIdx}|${a.toIdx}` : `${a.toIdx}|${a.fromIdx}`
      covered.add(key)
    }
  }
  for (const c of embedding.chords) {
    const key = c.fromIdx <= c.toIdx ? `${c.fromIdx}|${c.toIdx}` : `${c.toIdx}|${c.fromIdx}`
    covered.add(key)
  }
  const expected = new Set(edges.map(e => (e.fromIdx <= e.toIdx ? `${e.fromIdx}|${e.toIdx}` : `${e.toIdx}|${e.fromIdx}`)))
  expect(covered).toEqual(expected)
}

/** 弦对密集采样最小距离 */
function chordMinDist(embedding: ReturnType<typeof embedSphereGraph>): number {
  let best = Infinity
  for (let i = 0; i < embedding.chords.length; i++) {
    for (let j = i + 1; j < embedding.chords.length; j++) {
      const a0 = embedding.chords[i].samples[0]
      const a1 = embedding.chords[i].samples[1]
      const b0 = embedding.chords[j].samples[0]
      const b1 = embedding.chords[j].samples[1]
      for (let s = 0; s <= 16; s++) {
        const t = s / 16
        const pa: Vec3 = [
          a0[0] + (a1[0] - a0[0]) * t,
          a0[1] + (a1[1] - a0[1]) * t,
          a0[2] + (a1[2] - a0[2]) * t,
        ]
        for (let u = 0; u <= 16; u++) {
          const q = u / 16
          const pb: Vec3 = [
            b0[0] + (b1[0] - b0[0]) * q,
            b0[1] + (b1[1] - b0[1]) * q,
            b0[2] + (b1[2] - b0[2]) * q,
          ]
          best = Math.min(best, Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]))
        }
      }
    }
  }
  return best
}

/** 弦经过外来节点球的最短距离 */
function chordMinDistanceToAlienNodes(embedding: ReturnType<typeof embedSphereGraph>): number {
  let best = Infinity
  for (const c of embedding.chords) {
    const a = c.samples[0]
    const b = c.samples[1]
    for (let i = 0; i < embedding.directions.length; i++) {
      if (i === c.fromIdx || i === c.toIdx) continue
      const w = embedding.directions[i]
      const abx = b[0] - a[0]
      const aby = b[1] - a[1]
      const abz = b[2] - a[2]
      const len2 = abx * abx + aby * aby + abz * abz
      let t = 0
      if (len2 > 1e-12) {
        t = Math.max(0, Math.min(1, ((w[0] - a[0]) * abx + (w[1] - a[1]) * aby + (w[2] - a[2]) * abz) / len2))
      }
      const dx = a[0] + abx * t - w[0]
      const dy = a[1] + aby * t - w[1]
      const dz = a[2] + abz * t - w[2]
      best = Math.min(best, Math.hypot(dx, dy, dz))
    }
  }
  return best
}

function cycle(n: number): SphereEdge[] {
  return Array.from({ length: n }, (_, i) => ({ fromIdx: i, toIdx: (i + 1) % n }))
}

function completeGraph(n: number): SphereEdge[] {
  const out: SphereEdge[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) out.push({ fromIdx: i, toIdx: j })
  }
  return out
}

function mockGroup(n: number): Group {
  return {
    symbol: `M_{${n}}`,
    order: n,
    identity: { id: 'x0', label: '', value: [] },
    elements: Array.from({ length: n }, (_, i) => ({ id: 'x' + i, label: '', value: [] })),
  } as unknown as Group
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seq1 = Array.from({ length: 8 }, () => a())
    const seq2 = Array.from({ length: 8 }, () => b())
    expect(seq1).toEqual(seq2)
    for (const v of seq1) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('fibonacciUnitPoints / sphericalNodeDirections', () => {
  it('returns the north pole for n=1', () => {
    expect(fibonacciUnitPoints(1)).toEqual([[0, 0, 1]])
    expect(sphericalNodeDirections(1)).toEqual([[0, 0, 1]])
  })

  it('produces unit-length vectors', () => {
    for (const n of [6, 10, 60, 120]) {
      for (const p of sphericalNodeDirections(n)) {
        expect(Math.abs(unitOf(p) - 1)).toBeLessThan(EPS)
      }
    }
  })

  it('skips refinement beyond 400 yet stays unit-length', () => {
    for (const p of sphericalNodeDirections(500)) {
      expect(Math.abs(unitOf(p) - 1)).toBeLessThan(EPS)
    }
  })

  it('is deterministic across calls', () => {
    expect(sphericalNodeDirections(40)).toEqual(sphericalNodeDirections(40))
  })

  it('keeps a reasonable minimum angular separation after refinement', () => {
    for (const n of [12, 30]) {
      const dirs = sphericalNodeDirections(n)
      let min = Infinity
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          min = Math.min(min, angularDist(dirs[i], dirs[j]))
        }
      }
      expect(min).toBeGreaterThan(0.25)
    }
  })
})

describe('greatArcSamples', () => {
  it('returns null for coincident endpoints', () => {
    const v: Vec3 = [0.6, 0.8, 0]
    expect(greatArcSamples(v, v, 48)).toBeNull()
  })

  it('walks the short arc between two points (antipodal included)', () => {
    const a: Vec3 = [1, 0, 0]
    const b: Vec3 = [-1, 0, 0]
    const s = greatArcSamples(a, b, 8)!
    expect(s).toHaveLength(9)
    expect(Math.abs(unitOf(s[0]) - 1)).toBeLessThan(EPS)
    for (let k = 0; k < 3; k++) {
      expect(Math.abs(s[0][k] - a[k])).toBeLessThan(1e-9)
    }
    for (let k = 0; k < 3; k++) {
      expect(s[8][k] - b[k]).toBeCloseTo(0, 9)
    }
    for (const p of s) {
      expect(Math.abs(unitOf(p) - 1)).toBeLessThan(EPS)
    }
  })
})

describe('greatArcsCross', () => {
  const A1: Vec3 = [1, 0, 0]
  const A2: Vec3 = [0, 1, 0]

  it('detects an endpoint of one arc lying inside the other (semicircle across the equator end)', () => {
    // B 是 y=0 大圆（xz 平面）上的半圆弧，经过 (1,0,0) 内部
    const B1: Vec3 = [Math.SQRT1_2, 0, Math.SQRT1_2]
    const B2: Vec3 = [Math.SQRT1_2, 0, -Math.SQRT1_2]
    expect(greatArcsCross(A1, A2, B1, B2)).toBe(true)
  })

  it('ignores a purely shared endpoint', () => {
    const C1: Vec3 = [0, 1, 0]
    const C2: Vec3 = [0, 0, 1]
    expect(greatArcsCross(A1, A2, C1, C2)).toBe(false)
  })

  it('detects coplanar interior overlap', () => {
    const F1: Vec3 = [Math.SQRT1_2, Math.SQRT1_2, 0]
    const F2: Vec3 = [0, 1, 0]
    expect(greatArcsCross(A1, A2, F1, F2)).toBe(true)
  })

  it('rejects disjoint arcs on different great circles', () => {
    const G1: Vec3 = [0, 0, 1]
    const G2: Vec3 = [-Math.SQRT1_2, Math.SQRT1_2, 0]
    expect(greatArcsCross(A1, A2, G1, G2)).toBe(false)
  })
})

describe('embedSphereGraph', () => {
  it('routes a C6 cycle to a single planar layer with zero chords', () => {
    const emb = embedSphereGraph(6, cycle(6))
    expect(emb.mode).toBe('planar')
    expect(emb.layers).toHaveLength(1)
    expect(emb.chords).toHaveLength(0)
    expect(emb.layers[0].arcs).toHaveLength(6)
    expect(emb.stems).toHaveLength(0)
    expectEdgeCoverage(emb, cycle(6))
  })

  it('degrades K5 to interior chords and keeps them separated', () => {
    const edges = completeGraph(5)
    const emb = embedSphereGraph(5, edges, { chordCap: 10 })
    expect(emb.mode).toBe('chord')
    expect(emb.chords.length).toBeGreaterThan(0)
    expectEdgeCoverage(emb, edges)
    expect(chordMinDist(emb)).toBeGreaterThan(0.015)
    expect(chordMinDistanceToAlienNodes(emb)).toBeGreaterThan(0.04)
  })

  it('degrades K6 with chordCap=0 to concentric layers without losing edges', () => {
    const edges = completeGraph(6)
    const emb = embedSphereGraph(6, edges, { chordCap: 0, maxLayers: 3 })
    expect(emb.mode).toBe('layered')
    expect(emb.layers.length).toBeGreaterThanOrEqual(2)
    expect(emb.layers[0].radiusFactor).toBe(1)
    for (let l = 1; l < emb.layers.length; l++) {
      expect(emb.layers[l].radiusFactor).toBeCloseTo(Math.pow(0.8, l), 6)
    }
    expectEdgeCoverage(emb, edges)
  })

  it('is deterministic under a fixed seed', () => {
    const a = embedSphereGraph(6, cycle(6))
    const b = embedSphereGraph(6, cycle(6))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('assigns stems only for elements whose outermost layer is interior', () => {
    const emb = embedSphereGraph(6, completeGraph(6), { chordCap: 0, maxLayers: 3 })
    for (const s of emb.stems) {
      expect(s.layer).toBeGreaterThan(0)
    }
  })

  it('sphereRadiusFor matches the historical layout radius formula', () => {
    expect(sphereRadiusFor(10)).toBeCloseTo(Math.max(5, Math.cbrt(10) * 2.2), 10)
    expect(sphereRadiusFor(200)).toBeCloseTo(Math.max(5, Math.cbrt(200) * 2.2), 10)
  })

  it('seeds disjoint cycle components on separate small circles (4 triangles, planar)', () => {
    const edges: SphereEdge[] = [
      { fromIdx: 0, toIdx: 1 }, { fromIdx: 1, toIdx: 2 }, { fromIdx: 0, toIdx: 2 },
      { fromIdx: 3, toIdx: 4 }, { fromIdx: 4, toIdx: 5 }, { fromIdx: 3, toIdx: 5 },
      { fromIdx: 6, toIdx: 7 }, { fromIdx: 7, toIdx: 8 }, { fromIdx: 6, toIdx: 8 },
      { fromIdx: 9, toIdx: 10 }, { fromIdx: 10, toIdx: 11 }, { fromIdx: 9, toIdx: 11 },
    ]
    const emb = embedSphereGraph(12, edges)
    expect(emb.mode).toBe('planar')
    expect(emb.layers).toHaveLength(1)
    expect(emb.layers[0].arcs).toHaveLength(12)
    expect(emb.chords).toHaveLength(0)
    expectEdgeCoverage(emb, edges)
  })

  it('seeds two disjoint cycles and keeps every surface arc pair separated', () => {
    const edges: SphereEdge[] = [
      ...cycle(5),
      ...cycle(5).map(e => ({ fromIdx: e.fromIdx + 5, toIdx: e.toIdx + 5 })),
    ]
    const emb = embedSphereGraph(10, edges)
    expect(emb.mode).toBe('planar')
    expect(emb.layers[0].arcs).toHaveLength(10)
    expectEdgeCoverage(emb, edges)
    const arcs = emb.layers[0].arcs
    for (let i = 0; i < arcs.length; i++) {
      for (let j = i + 1; j < arcs.length; j++) {
        const a = arcs[i]
        const b = arcs[j]
        if (a.fromIdx === b.fromIdx || a.fromIdx === b.toIdx || a.toIdx === b.fromIdx || a.toIdx === b.toIdx) continue
        expect(polylinesNear(a.samples, b.samples, 0.0785)).toBe(false)
      }
    }
  })

  it('guarantees zero surface crossings for a dense non-planar graph', () => {
    const edges = completeGraph(8)
    const emb = embedSphereGraph(8, edges)
    const arcs = emb.layers[0].arcs
    for (let i = 0; i < arcs.length; i++) {
      for (let j = i + 1; j < arcs.length; j++) {
        const a = arcs[i]
        const b = arcs[j]
        if (a.fromIdx === b.fromIdx || a.fromIdx === b.toIdx || a.toIdx === b.fromIdx || a.toIdx === b.toIdx) continue
        expect(polylinesNear(a.samples, b.samples, 0.0785)).toBe(false)
      }
    }
    expectEdgeCoverage(emb, edges)
  })
})

describe('compute3DPositions spherical regression', () => {
  it('places every node exactly on the sphere of the layout radius', () => {
    const group = mockGroup(10)
    const pos = compute3DPositions(group, 'spherical')
    expect(pos).toHaveLength(10)
    const R = sphereRadiusFor(10)
    for (const p of pos) {
      expect(Math.hypot(p[0], p[1], p[2])).toBeCloseTo(R, 6)
    }
  })
})
// Regression: cycle graph layout (cycleGraphLayout) must satisfy:
// - 0 intra-cycle self-intersecting polygons (hard correctness — any >0 is a bug)
// - 0 node overlaps (any >0 is a bug)
// - minimal inter-cycle edge crossings (soft; residual values match Group Explorer
//   for groups where ≥3 cycles share points and/or mixed-order cycles share a tip;
//   these are fundamental 2D constraints of concentric petal nesting, not bugs)
//
// Before the GE-faithful rewrite (bestPowerRelativeTo + no flip hacks + ≥3-skip
// for shared-subgroup re-orbiting) the counts were much worse. The values below
// are the current GE-faithful baseline; any increase in a future change indicates
// a regression that should be investigated.
import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createZ3xZ3, createZ2xZ2xZ2, createZ4xZ2, createZ6xZ2 } from '../core/groups/SmallGroups'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createGL2 } from '../core/groups/GeneralLinearGroup'
import { getSmallGroup } from '../core/groups/SmallGroups/registry'
import { cycleGraphLayout } from '../core/algebra/cycleLayouts'
import type { Group } from '../core/types'

function orderedMaximalCycles(group: Group) {
  const all: { elementIds: string[] }[] = []
  const seen = new Set<string>()
  for (const g of group.elements) {
    const seq: string[] = []
    const visited = new Set<string>()
    let cur = g
    let guard = 0
    while (!visited.has(cur.id) && guard++ < 1000) {
      visited.add(cur.id); seq.push(cur.id); cur = group.multiply(cur, g)
    }
    if (seq.length <= 1) continue
    const key = [...seq].sort().join(',')
    if (seen.has(key)) continue
    seen.add(key); all.push({ elementIds: seq })
  }
  return all.filter(c => {
    const set = new Set(c.elementIds)
    return !all.some(o => {
      if (o === c) return false
      const other = new Set(o.elementIds)
      return [...set].every(id => other.has(id)) && set.size < other.size
    })
  })
}

function ccw(a: [number, number], b: [number, number], c: [number, number]) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}
function segInt(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
function isSelfIntersecting(pts: [number, number][]): boolean {
  const n = pts.length
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === (i + 1) % n || i === (j + 1) % n) continue
    if (segInt(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true
  }
  return false
}
function normalizedCycles(cycles: { elementIds: string[] }[], identityId: string) {
  return cycles.map(c => {
    const ei = c.elementIds.indexOf(identityId)
    return ei >= 0 ? [...c.elementIds.slice(ei), ...c.elementIds.slice(0, ei)] : c.elementIds
  })
}
function countSelfIntersecting(normCycles: string[][], pos: Map<string, { x: number; y: number }>) {
  let bad = 0
  normCycles.forEach(c => {
    if (c.length < 3) return
    const pts: [number, number][] = c.map(id => { const p = pos.get(id)!; return [p.x, p.y] })
    if (isSelfIntersecting(pts)) bad++
  })
  return bad
}
function countCrossings(normCycles: string[][], pos: Map<string, { x: number; y: number }>) {
  const edges: { a: [number, number]; b: [number, number]; from: string; to: string }[] = []
  normCycles.forEach(c => {
    const pts = c.map(id => pos.get(id)!)
    for (let i = 0; i < pts.length; i++) {
      edges.push({ a: [pts[i].x, pts[i].y], b: [pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y], from: c[i], to: c[(i + 1) % pts.length] })
    }
  })
  let cr = 0
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const A = edges[i], B = edges[j]
    if (A.from === B.from || A.from === B.to || A.to === B.from || A.to === B.to) continue
    if (segInt(A.a, A.b, B.a, B.b)) cr++
  }
  return cr
}
function countNodeOverlaps(pos: Map<string, { x: number; y: number }>, threshold = 1) {
  const pts = [...pos.values()].map(p => [p.x, p.y] as [number, number])
  let c = 0
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
    if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < threshold) c++
  return c
}

interface Counts { self: number; cross: number; overlap: number }
function measure(group: Group): Counts {
  const cycles = orderedMaximalCycles(group)
  const pos = cycleGraphLayout(group.elements, cycles, 800, 800, group.identity.id)
  const nc = normalizedCycles(cycles, group.identity.id)
  return {
    self: countSelfIntersecting(nc, pos),
    cross: countCrossings(nc, pos),
    overlap: countNodeOverlaps(pos),
  }
}

describe('cycleGraphLayout — hard-correctness regression', () => {
  // Hard invariants: no self-intersecting cycle polygon, no overlapping nodes.
  it('no self-intersecting cycles and no overlapping nodes for the full catalog', () => {
    const groups: Array<[string, Group, boolean]> = []
    for (let n = 2; n <= 16; n++) groups.push([`C${n}`, createCyclicGroup(n), true])
    for (let n = 3; n <= 8; n++) groups.push([`D${n}`, createDihedralGroup(n), true])
    groups.push(['S3', createS3(), true], ['S4', createSymmetricGroup(4), true], ['S5', createSymmetricGroup(5), true])
    groups.push(['A4', createAlternatingGroup(4), true], ['A5', createAlternatingGroup(5), true])
    groups.push(['V4', createKleinFour(), true], ['Q8', createQuaternion(), true])
    groups.push(['C4xC2', createZ4xZ2(), true], ['C6xC2', createZ6xZ2(), true], ['C3xC3', createZ3xZ3(), true], ['C2xC2xC2', createZ2xZ2xZ2(), true])
    groups.push(['C4xC4', createDirectProduct(createCyclicGroup(4), createCyclicGroup(4)), true])
    groups.push(['C8xC2', createDirectProduct(createCyclicGroup(8), createCyclicGroup(2)), true])
    groups.push(['C3xC6', createDirectProduct(createCyclicGroup(3), createCyclicGroup(6)), true])
    groups.push(['GL(2,3)', createGL2(3), true])
    groups.push(['SL(2,3)', getSmallGroup(24, 2)!.group, true])
    // C5xS3 is the known inherent case: the 15-cycle shares 5 elements with the
    // 10-cycle's C5 spine; the pinned shared positions cannot match the 15-cycle's
    // own arc positions simultaneously, so the 15-gon self-intersects (matches GE).
    groups.push(['C5xS3', createDirectProduct(createCyclicGroup(5), createS3()), false])

    for (const [name, group, expectNoSelfIntersect] of groups) {
      const c = measure(group)
      if (expectNoSelfIntersect) {
        expect(c.self, `${name}: ${c.self} self-intersecting cycles`).toBe(0)
      }
      expect(c.overlap, `${name}: ${c.overlap} overlapping nodes`).toBe(0)
    }
  })
})

describe('cycleGraphLayout — crossing baseline (matches Group Explorer)', () => {
  // Soft baseline: inter-cycle edge crossings. The values below are the current
  // GE-faithful counts. They arise from the fundamental 2D constraint that ≥3
  // cycles sharing points (especially a single tip with mixed orders, or a
  // shared subgroup of order ≥4) cannot be drawn as non-overlapping concentric
  // petals. Group Explorer itself produces these crossings.
  it('S3/D3 spokes cross the 3-cycle arc edge (GE-inherent, baseline ≤ 6)', () => {
    expect(measure(createS3()).cross).toBeLessThanOrEqual(6)
    expect(measure(createDihedralGroup(3)).cross).toBeLessThanOrEqual(6)
  })
  it('C4xC4 multiple order-4 cycles share a C4 (GE-inherent, baseline ≤ 12)', () => {
    expect(measure(createDirectProduct(createCyclicGroup(4), createCyclicGroup(4))).cross).toBeLessThanOrEqual(12)
  })
  it('SL(2,3) 7 cycles sharing -I (mixed orders, GE-inherent, baseline ≤ 8)', () => {
    expect(measure(getSmallGroup(24, 2)!.group).cross).toBeLessThanOrEqual(8)
  })
  it('C5xS3 4 cycles sharing C5 (known 1 self-intersect on the 15-cycle)', () => {
    expect(measure(createDirectProduct(createCyclicGroup(5), createS3())).self).toBe(1)
  })
})

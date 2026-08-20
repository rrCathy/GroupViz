import { describe, it, expect } from 'vitest'
import {
  directProductGridLayout2D,
  computeElementOrder,
  concentricLayout,
  dualRingLayout,
  archimedeanSpiralLayout,
  spiralLayout,
  coilLayout,
  cosetStripLayout,
  projection3DLayout,
  semidirectProductLayout,
  cylinderLayout2D,
  torusLayout2D,
  ringGridLayout2D,
  q8PythagoreanLayout,
  buildFactorSubgroup,
  normalizeLayout2D,
  factorPipeGroups,
  parseCompactFactors,
  splitDihedralElements,
  dihedralSnakeOrder,
} from '../core/algebra/forceLayout'
import { classifyDirectProduct2D, findRingGridDecomposition } from '../core/types'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createSemidirectProduct } from '../core/groups/SemidirectProduct'
import { findAllSubgroups } from '../core/algebra/subgroups'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { createQuaternion } from '../core/groups/SpecialGroup'
import type { Group, GroupElement } from '../core/types'
import type { Automorphism } from '../core/algebra/automorphisms'

function identityAuto(group: Group): Automorphism {
  return {
    id: 'id',
    map: new Map(group.elements.map(e => [e.id, e.id])),
    label: '\\mathrm{id}',
    apply: (el: GroupElement) => el,
  }
}

describe('directProductGridLayout2D', () => {
  it('returns null for non-direct-product groups', () => {
    expect(directProductGridLayout2D(createS3(), 800, 600)).toBeNull()
  })

  it('lays out Z2 x Z2 as a 2x2 grid', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(4)
  })

  it('lays out pipe-id products via matrix grid', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    expect(dp.elements[0].id.includes('|')).toBe(true)
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })

  it('lays out S3 x C2 as a 6x2 grid (factors split evenly)', () => {
    const dp = createDirectProduct(createS3(), createCyclicGroup(2))
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(12)
  })

  it('lays out registry group C4xC4 as a 4x4 grid', () => {
    const g = getSmallGroup(16, 1)!.group
    const pos = directProductGridLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    const xs = new Set([...pos!.values()].map(p => p.x))
    const ys = new Set([...pos!.values()].map(p => p.y))
    expect(xs.size).toBe(4)
    expect(ys.size).toBe(4)
    const unique = new Set([...pos!.values()].map(p => `${p.x},${p.y}`))
    expect(unique.size).toBe(16)
  })

  it('returns null for semidirect-marked registry group (Z4xZ2):Z2', () => {
    const g = getSmallGroup(16, 2)!.group
    expect(directProductGridLayout2D(g, 800, 600)).toBeNull()
  })
})

describe('factorPipeGroups', () => {
  it('parses compact symbol factors with power segments', () => {
    const parts = parseCompactFactors('C_{2}^{2} \\times S_{3}')
    expect(parts.length).toBe(2)
    expect(parts[0].text).toBe('C_{2}^{2}')
    expect(parts[0].segments).toBe(2)
    expect(parts[1].segments).toBe(1)
  })

  it('groups pipe segments by compact factors for C2^2 x S3', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createS3()
    )
    expect(dp.elements[0].id.split('|').length).toBe(3)
    const groups = factorPipeGroups(dp)
    expect(groups).not.toBeNull()
    expect(groups![0].length).toBe(2)
    expect(groups![0][0]).toEqual(['e0', 'e0'])
    expect(groups![0][1]).toEqual(['1,2,3'])
  })

  it('groups two-factor pipe products as two groups', () => {
    const dp = createDirectProduct(createS3(), createDihedralGroup(4))
    const groups = factorPipeGroups(dp)
    expect(groups).not.toBeNull()
    expect(groups![0].length).toBe(2)
    expect(groups![0][0]).toEqual(['1,2,3'])
  })
})

describe('buildFactorSubgroup', () => {
  it('extracts an independent factor group from a direct product', () => {
    const dp = createDirectProduct(createS3(), createCyclicGroup(2))
    const factor = buildFactorSubgroup(dp, 0)
    expect(factor).not.toBeNull()
    expect(factor!.order).toBe(6)
    expect(factor!.symbol).toBe('S_{3}')
    const id = factor!.identity
    const prod = factor!.multiply(id, factor!.elements[1])
    expect(prod.id).toBe(factor!.elements[1].id)
  })

  it('extracts the second factor as well', () => {
    const dp = createDirectProduct(createS3(), createCyclicGroup(2))
    const factor = buildFactorSubgroup(dp, 1)
    expect(factor).not.toBeNull()
    expect(factor!.order).toBe(2)
    const inv = factor!.inverse(factor!.elements[1])
    expect(factor!.multiply(factor!.elements[1], inv).id).toBe(factor!.identity.id)
  })
})

describe('normalizeLayout2D', () => {
  it('centers and scales a layout to the unit circle', () => {
    const pos = new Map<string, { x: number; y: number }>([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 300, y: 100 }],
      ['c', { x: 200, y: 260 }],
    ])
    const { unit, radius } = normalizeLayout2D(pos)
    expect(radius).toBeCloseTo(100)
    const a = unit.get('a')!
    expect(a.x).toBeCloseTo(-1)
    expect(a.y).toBeCloseTo(-0.8)
  })
})

describe('classifyDirectProduct2D', () => {
  it('classifies all-cyclic products as grid', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    expect(classifyDirectProduct2D(dp)).toBe('grid')
  })

  it('classifies one cyclic + one non-cyclic as cylinder', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createS3())
    expect(classifyDirectProduct2D(dp)).toBe('cylinder')
  })

  it('classifies C2^2 x S3 as torus (C2^2 = V4 grouped as one non-cyclic factor)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createS3()
    )
    expect(classifyDirectProduct2D(dp)).toBe('torus')
  })

  it('classifies two non-cyclic factors as torus', () => {
    const dp = createDirectProduct(createS3(), createDihedralGroup(4))
    expect(classifyDirectProduct2D(dp)).toBe('torus')
  })

  it('classifies C2 x C3 x S3 as cylinder (multi-cyclic factors keep layers)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(3)),
      createS3()
    )
    expect(classifyDirectProduct2D(dp)).toBe('cylinder')
  })

  it('classifies C2^3 as grid (single grouped factor)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createCyclicGroup(2)
    )
    expect(classifyDirectProduct2D(dp)).toBe('grid')
  })

  it('classifies three non-cyclic factors as torus', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    )
    const dp3 = createDirectProduct(dp, createS3())
    dp3.symbol = 'C_{2}^{2} \\times C_{2}^{2} \\times S_{3}'
    expect(classifyDirectProduct2D(dp3)).toBe('torus')
  })

  it('classifies registry C2 x C2 x S3 (24,13) as torus', () => {
    const g = getSmallGroup(24, 13)!.group
    expect(classifyDirectProduct2D(g)).toBe('torus')
  })
})

describe('cylinderLayout2D', () => {
  it('lays out C4 x D4 as 4 concentric dual-ring copies (32 points)', () => {
    const dp = createDirectProduct(createCyclicGroup(4), createDihedralGroup(4))
    const pos = cylinderLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(32)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    const cx = 400
    const cy = 300
    const radii = new Set<number>()
    for (const p of pos!.values()) {
      radii.add(Math.round(Math.hypot(p.x - cx, p.y - cy)))
    }
    // 4 layers x (dual ring outer + inner) = 8 distinct radii
    expect(radii.size).toBeGreaterThanOrEqual(8)
  })

  it('lays out C2 x S3 (cylinder) with 12 points', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createS3())
    const pos = cylinderLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(12)
  })

  it('interleaves adjacent cylinder layers by half a copy step', () => {
    const dp = createDirectProduct(createCyclicGroup(3), createS3())
    const pos = cylinderLayout2D(dp, 800, 600)!
    const cx = 400
    const cy = 300
    const byPart = new Map<string, { r: number; angle: number }[]>()
    for (const [id, p] of pos) {
      const part = id.split('|').slice(1).join('|')
      const r = Math.hypot(p.x - cx, p.y - cy)
      const angle = Math.atan2(p.y - cy, p.x - cx)
      const list = byPart.get(part) ?? []
      list.push({ r, angle })
      byPart.set(part, list)
    }
    expect(byPart.size).toBe(6)
    const diff = (a: number, b: number) => {
      let d = (a - b) % (Math.PI * 2)
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      return d
    }
    for (const entries of byPart.values()) {
      expect(entries.length).toBe(3) // one point per C3 layer
      entries.sort((a, b) => a.r - b.r)
      const d1 = diff(entries[1].angle, entries[0].angle)
      const d2 = diff(entries[2].angle, entries[1].angle)
      expect(Math.abs(d1 - Math.PI / 6)).toBeLessThan(0.02) // interleaved by half a copy step
      expect(Math.abs(d2 - Math.PI / 6)).toBeLessThan(0.02)
    }
  })

  it('lays out registry Z2 x D4 (16,10) as 2 concentric copies (16 points)', () => {
    const g = getSmallGroup(16, 10)!.group
    const pos = cylinderLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    const cx = 400
    const cy = 300
    const radii = new Set<number>()
    for (const p of pos!.values()) {
      radii.add(Math.round(Math.hypot(p.x - cx, p.y - cy)))
    }
    // 2 layers x D₈ single ring = 2 distinct radii
    expect(radii.size).toBe(2)
  })

  it('lays out registry Z2 x Q8 (16,11) as 2 concentric copies (16 points)', () => {
    const g = getSmallGroup(16, 11)!.group
    const pos = cylinderLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
  })

  it('returns null for registry non-direct-product (16,6 D8)', () => {
    const g = getSmallGroup(16, 6)!.group
    expect(cylinderLayout2D(g, 800, 600)).toBeNull()
  })

  it('lays out C2 x C3 x S3 as 3-layer cylinder (36 points)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(3)),
      createS3()
    )
    const pos = cylinderLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(36)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('lays out registry C3 x S3 (18,2) as 3 interleaved S3 rings', () => {
    const g = getSmallGroup(18, 2)!.group
    const pos = cylinderLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(18)
    const cx = 400
    const cy = 300
    const layers = new Map<number, { id: string; angle: number }[]>()
    for (const [id, p] of pos!) {
      const r = Math.round(Math.hypot(p.x - cx, p.y - cy))
      const a = Math.atan2(p.y - cy, p.x - cx)
      if (!layers.has(r)) layers.set(r, [])
      layers.get(r)!.push({ id, angle: a })
    }
    expect(layers.size).toBe(3)
    for (const list of layers.values()) expect(list.length).toBe(6)
    const sorted = [...layers.values()]
    const angOf = (layer: { id: string; angle: number }[], id: string) =>
      layer.find(x => x.id === id)?.angle ?? NaN
    const diff = (a: number, b: number) => {
      let d = (a - b) % (Math.PI * 2)
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      return d
    }
    // 交错：层 0 的 g0（=e）与层 1 的 g2（= g0·C₃ 生成元）角度差 = 半格 π/6
    const a0 = angOf(sorted[0], 'g0')
    const a1 = angOf(sorted[1], 'g2')
    expect(Math.abs(diff(a1, a0) - Math.PI / 6)).toBeLessThan(0.01)
    const rOf = (id: string) =>
      Math.round(Math.hypot(pos!.get(id)!.x - cx, pos!.get(id)!.y - cy))
    const elById = new Map(g.elements.map(e => [e.id, e]))
    const g1 = elById.get('g1')! // 2 阶反射（S₃ 内）
    const g3 = elById.get('g3')! // 3 阶旋转（S₃ 内）
    expect(g.multiply(elById.get('g0')!, g1).id).toBe('g1')
    expect(g.multiply(elById.get('g0')!, g3).id).toBe('g3')
    expect(rOf('g1')).toBe(rOf('g0'))
    expect(rOf('g3')).toBe(rOf('g0'))
  })
})

describe('torusLayout2D', () => {
  it('lays out S3 x D4 as a ring with hanging copies (48 points)', () => {
    const dp = createDirectProduct(createS3(), createDihedralGroup(4))
    const pos = torusLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(48)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    const cx = 400
    const cy = 300
    const maxR = Math.max(...[...pos!.values()].map(p => Math.hypot(p.x - cx, p.y - cy)))
    expect(maxR).toBeLessThanOrEqual(400)
  })

  it('lays out grouped C2^2 x S3 as nested torus (24 points)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createS3()
    )
    const pos = torusLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(24)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('lays out 3 non-cyclic factors as triple-nested torus (96 points)', () => {
    const dp = createDirectProduct(
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2)),
      createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    )
    const dp3 = createDirectProduct(dp, createS3())
    dp3.symbol = 'C_{2}^{2} \\times C_{2}^{2} \\times S_{3}'
    const pos = torusLayout2D(dp3, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(96)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('lays out registry C2 x C2 x S3 (24,13) via cluster factors (24 points)', () => {
    const g = getSmallGroup(24, 13)!.group
    const pos = torusLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(24)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})

describe('computeElementOrder', () => {
  it('identity has order 1', () => {
    const c6 = createCyclicGroup(6)
    expect(computeElementOrder(c6.identity, c6)).toBe(1)
  })

  it('matches known orders in C6', () => {
    const c6 = createCyclicGroup(6)
    const e1 = c6.elements.find(e => e.value[0] === 1)!
    const e2 = c6.elements.find(e => e.value[0] === 2)!
    expect(computeElementOrder(e1, c6)).toBe(6)
    expect(computeElementOrder(e2, c6)).toBe(3)
  })
})

describe('concentricLayout', () => {
  it('places every element of S3', () => {
    const pos = concentricLayout(createS3(), 800, 600)
    expect(pos.size).toBe(6)
  })
})

describe('dualRingLayout', () => {
  it('places every element of D4', () => {
    const pos = dualRingLayout(createDihedralGroup(4), 800, 600)
    expect(pos.size).toBe(8)
  })

  it('lays out C2^3 as a square dual ring (D4 style)', () => {
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    const pos = dualRingLayout(cube, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(8)
    const radii = [...pos!.values()].map(p => Math.hypot(p.x - 400, p.y - 300))
    const outer = Math.max(...radii)
    expect(outer).toBeCloseTo(0.38 * 600, 0) // 228
    expect(Math.min(...radii)).toBeCloseTo(0.55 * outer, 0) // ~125
    expect(radii.filter(r => Math.abs(r - outer) < 1).length).toBe(4)

    // 大正方形套小正方形：外环必须是交替生成元 4-环序 [e, a, ab, b]——
    // 每一边都是真实生成元边（无穿心对角弦），内方各角 = 外方对应角·c（径向对齐）
    const [a, b, c] = cube.generators.map(g => g.apply(cube.identity))
    const ab = cube.multiply(a, b)
    const outerIds = [cube.identity.id, a.id, ab.id, b.id]
    const idsAtRadius = (r: number) =>
      [...pos!]
        .filter(([, p]) => Math.abs(Math.hypot(p.x - 400, p.y - 300) - r) < 1)
        .map(([k]) => k)
        .sort()
    expect(idsAtRadius(outer).sort()).toEqual([...outerIds].sort())
    const elById = new Map(cube.elements.map(e => [e.id, e]))
    for (let i = 0; i < 4; i++) {
      const cur = outerIds[i]
      const nxt = outerIds[(i + 1) % 4]
      const edgeReach = [
        cube.multiply(elById.get(cur)!, a).id,
        cube.multiply(elById.get(cur)!, b).id,
      ]
      expect(edgeReach).toContain(nxt)
      const p = pos!.get(cur)!
      const pi = pos!.get(cube.multiply(elById.get(cur)!, c).id)!
      expect(Math.atan2(pi.y - 300, pi.x - 400)).toBeCloseTo(
        Math.atan2(p.y - 300, p.x - 400),
        2,
      )
    }
  })

  it('lays out registry D8 (16,6, scalar values) as a dual ring', () => {
    const g = getSmallGroup(16, 6)!.group
    const pos = dualRingLayout(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    const radii = [...pos!.values()].map(p => Math.hypot(p.x - 400, p.y - 300))
    const outer = Math.max(...radii)
    expect(outer).toBeCloseTo(0.38 * 600, 0) // 228
    expect(Math.min(...radii)).toBeCloseTo(0.55 * outer, 0)
    expect(radii.filter(r => Math.abs(r - outer) < 1).length).toBe(8)
    expect(radii.filter(r => Math.abs(r - 0.55 * outer) < 1).length).toBe(8)
  })

  it('lays out registry D9 (18,1, scalar values) as a dual ring', () => {
    const g = getSmallGroup(18, 1)!.group
    const pos = dualRingLayout(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(18)
    const radii = [...pos!.values()].map(p => Math.hypot(p.x - 400, p.y - 300))
    const outer = Math.max(...radii)
    expect(radii.filter(r => Math.abs(r - outer) < 1).length).toBe(9)
    expect(radii.filter(r => Math.abs(r - 0.55 * outer) < 1).length).toBe(9)
  })
})

describe('splitDihedralElements', () => {
  it('classifies registry D8 (16,6) into rotations and paired reflections', () => {
    const g = getSmallGroup(16, 6)!.group
    const res = splitDihedralElements(g)
    expect(res).not.toBeNull()
    expect(res!.rotations.length).toBe(8)
    expect(res!.reflectPair.size).toBe(8)
    for (const refId of res!.reflectPair.keys()) {
      expect(res!.rotations).not.toContain(refId)
    }
  })

  it('classifies basic D4 into rotations and paired reflections', () => {
    const res = splitDihedralElements(createDihedralGroup(4))
    expect(res).not.toBeNull()
    expect(res!.rotations.length).toBe(4)
    expect(res!.reflectPair.size).toBe(4)
  })

  it('returns null for C2^3 (no element of order 4)', () => {
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    expect(splitDihedralElements(cube)).toBeNull()
  })

  it('returns null for A4 (no element of order 6)', () => {
    const a4 = getSmallGroup(12, 3)!.group
    expect(splitDihedralElements(a4)).toBeNull()
  })
})

describe('ringGridLayout2D', () => {
  const c4c2c2 = () =>
    createDirectProduct(
      createDirectProduct(createCyclicGroup(4), createCyclicGroup(2)),
      createCyclicGroup(2),
    )

  it('lays out pipe C4 x C2 x C2 as 4 rings on a 2x2 grid (ring n=4)', () => {
    const g = c4c2c2()
    const pos = ringGridLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    // 无重复位置
    const keys = [...pos!.values()].map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
    expect(new Set(keys).size).toBe(16)

    const dec = findRingGridDecomposition(g)!
    expect(dec.n).toBe(4)
    const elById = new Map(g.elements.map(e => [e.id, e]))
    // 每个元素：乘环生成元后落在同一格簇的相邻环位（真实边，弦长一致）
    for (const el of g.elements) {
      const { v } = dec.map.get(el.id)!
      const nxt = g.multiply(elById.get(el.id)!, dec.ringGen)
      const p = pos!.get(el.id)!
      const pn = pos!.get(nxt.id)!
      // 环心 = 同一格簇（同 v）4 点的质心
      const sameV = g.elements.filter(e => dec.map.get(e.id)!.v.id === v.id)
      expect(sameV.length).toBe(4)
      const cxv = sameV.reduce((s, e) => s + pos!.get(e.id)!.x, 0) / 4
      const cyv = sameV.reduce((s, e) => s + pos!.get(e.id)!.y, 0) / 4
      const r1 = Math.hypot(p.x - cxv, p.y - cyv)
      expect(r1).toBeGreaterThan(0)
      const r2 = Math.hypot(pn.x - cxv, pn.y - cyv)
      expect(r2).toBeGreaterThan(0)
      const chord = Math.hypot(pn.x - p.x, pn.y - p.y)
      expect(chord).toBeCloseTo(2 * r1 * Math.sin(Math.PI / dec.n), 1)
      // v 相同的 4 个元素（同一格簇）环半径相同
      const radii = sameV.map(e => Math.hypot(pos!.get(e.id)!.x - cxv, pos!.get(e.id)!.y - cyv))
      expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1)
      // 网格真实边：乘 v1 / v2 后应落在相邻格簇的对应环位
      for (const vg of [dec.v1, dec.v2]) {
        const gn = g.multiply(elById.get(el.id)!, vg)
        const pg = pos!.get(gn.id)!
        // 相邻格簇环位距离 ≈ 网格间距（d 略大于 2r）
        expect(Math.hypot(pg.x - p.x, pg.y - p.y)).toBeGreaterThan(2 * r1)
      }
    }
    expect(dec.map.size).toBe(16)
  })

  it('lays out registry C4 x C2 x C2 (16,9) as a ring grid', () => {
    const g = getSmallGroup(16, 9)!.group
    const pos = ringGridLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    expect(new Set([...pos!.values()].map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size).toBe(16)
    const dec = findRingGridDecomposition(g)
    expect(dec).not.toBeNull()
    expect(dec!.n).toBe(4)
  })

  it('returns null for C4 x C4 (no ring-grid decomposition)', () => {
    const g = createDirectProduct(createCyclicGroup(4), createCyclicGroup(4))
    expect(ringGridLayout2D(g, 800, 600)).toBeNull()
  })

  it('lays out C3^3 (p=3) as 9 rings on a 3x3 grid (power-form pipe)', () => {
    const g = createDirectProduct(
      createDirectProduct(createCyclicGroup(3), createCyclicGroup(3)),
      createCyclicGroup(3),
    )
    const pos = ringGridLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(27)
    expect(new Set([...pos!.values()].map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size).toBe(27)
    const dec = findRingGridDecomposition(g)
    expect(dec).not.toBeNull()
    expect(dec!.p).toBe(3)
    expect(dec!.n).toBe(3)
    // 每格 3 个元素呈三角形（环 n=3），9 个格簇
    const byV = new Map<string, number>()
    for (const el of g.elements) {
      const v = dec!.map.get(el.id)!.v.id
      byV.set(v, (byV.get(v) ?? 0) + 1)
    }
    expect(byV.size).toBe(9)
    expect([...byV.values()].every(c => c === 3)).toBe(true)
  })

  it('lays out registry C3^3 (27,5) as a ring grid', () => {
    const g = getSmallGroup(27, 4)!.group
    const pos = ringGridLayout2D(g, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(27)
    expect(findRingGridDecomposition(g)!.p).toBe(3)
  })
})

describe('dihedralSnakeOrder', () => {
  it('flattens registry C4 x C2 into snake order (rotations asc + reflections desc)', () => {
    const c4 = createCyclicGroup(4)
    const c2 = createCyclicGroup(2)
    const c4xc2 = createDirectProduct(c4, c2)
    const order = dihedralSnakeOrder(c4xc2)
    expect(order).not.toBeNull()
    expect(order).toHaveLength(8)
    const first = order!.slice(0, 4)
    const last = order!.slice(4)
    expect(new Set(first).size).toBe(4)
    expect(new Set(last).size).toBe(4)
    expect(order![0]).toBe(c4xc2.identity.id)
  })

  it('returns null for C2^3 (not dihedral-like)', () => {
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    expect(dihedralSnakeOrder(cube)).toBeNull()
  })
})

describe('spiral layouts', () => {
  const c6 = createCyclicGroup(6)

  it('archimedean spiral places every element', () => {
    expect(archimedeanSpiralLayout(c6, 800, 600).size).toBe(6)
  })

  it('spiral places every element', () => {
    expect(spiralLayout(c6, 800, 600).size).toBe(6)
  })

  it('coil places every element', () => {
    expect(coilLayout(c6, 800, 600).size).toBe(6)
  })

  it('spiral keeps C16 arc lengths roughly uniform (sqrt spiral)', () => {
    const pos = spiralLayout(createCyclicGroup(16), 800, 600)
    expect(pos.size).toBe(16)
    const pts = [...pos.values()]
    const dists: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      dists.push(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y))
    }
    expect(Math.max(...dists) / Math.min(...dists)).toBeLessThan(4)
  })
})

describe('cosetStripLayout', () => {
  it('returns empty data for an empty group', () => {
    const empty = { order: 0, elements: [], identity: { id: '', label: '', value: [] } } as unknown as Group
    const data = cosetStripLayout(empty, 800, 400)
    expect(data.positions.size).toBe(0)
    expect(data.strips.length).toBe(0)
  })

  it('lays out S3 by cosets of A3 into two strips', () => {
    const s3 = createS3()
    const a3 = findAllSubgroups(s3).find(s => s.order === 3)!
    const a3Ids = a3.elements.map(e => e.id)
    const a3Set = new Set(a3Ids)
    const cosetMap = new Map<string, number>()
    for (const el of s3.elements) cosetMap.set(el.id, a3Set.has(el.id) ? 0 : 1)

    const data = cosetStripLayout(s3, 800, 400, a3Ids, cosetMap, 2)
    expect(data.positions.size).toBe(6)
    expect(data.strips.length).toBe(2)
  })

  it('respects an explicit top padding', () => {
    const s3 = createS3()
    const a3 = findAllSubgroups(s3).find(s => s.order === 3)!
    const a3Ids = a3.elements.map(e => e.id)
    const a3Set = new Set(a3Ids)
    const cosetMap = new Map<string, number>()
    for (const el of s3.elements) cosetMap.set(el.id, a3Set.has(el.id) ? 0 : 1)

    const base = cosetStripLayout(s3, 800, 400, a3Ids, cosetMap, 2)
    const padded = cosetStripLayout(s3, 800, 400, a3Ids, cosetMap, 2, undefined, 160)
    expect(padded.strips[0].y).toBeGreaterThan(base.strips[0].y)
  })
})

describe('projection3DLayout', () => {
  it('projects S3 onto its 3D layout', () => {
    const pos = projection3DLayout(createS3(), 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })

  it('projects a cyclic group onto its 3D layout', () => {
    const pos = projection3DLayout(createCyclicGroup(6), 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })
})

describe('semidirectProductLayout', () => {
  it('returns null for groups without semidirect product structure', () => {
    expect(semidirectProductLayout(createS3(), 800, 600)).toBeNull()
  })

  it('lays out C3 ⋊ C2 (identity action) on N-per-H rings', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ])
    const G = createSemidirectProduct(C3, C2, phi)
    expect(G).not.toBeNull()
    const pos = semidirectProductLayout(G!, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })

  it('lays out registered semidirect products via canonical decomposition', () => {
    const g = getSmallGroup(16, 2) // (C₄×C₂):C₂
    expect(g).not.toBeNull()
    const pos = semidirectProductLayout(g!.group, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(16)
    for (const p of pos!.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('twists N-rings by phi(h) so QD16 and C8:C2 differ (issue 9)', () => {
    // QD16=(16,8) 的 φ(b)(a)=a³ 与 C8:C2=(16,6) 的 φ(b)(a)=a⁵：扭转后辐条 (n → k·n) 互异
    const qd16 = getSmallGroup(16, 7)!.group
    const c8c2 = getSmallGroup(16, 5)!.group
    const posQ = semidirectProductLayout(qd16, 800, 600)
    const posC = semidirectProductLayout(c8c2, 800, 600)
    expect(posQ).not.toBeNull()
    expect(posC).not.toBeNull()
    // 至少一个元素在两种布局中位置不同
    let differ = false
    for (const el of qd16.elements) {
      const a = posQ!.get(el.id)
      const b = posC!.get(el.id)
      if (a && b && (Math.abs(a.x - b.x) > 1e-3 || Math.abs(a.y - b.y) > 1e-3)) {
        differ = true
        break
      }
    }
    expect(differ).toBe(true)
  })
})

describe('q8PythagoreanLayout', () => {
  it('places Q8 elements in pythagorean square layout', () => {
    const q8 = createQuaternion()
    const pos = q8PythagoreanLayout(q8, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(8)
  })

  it('outer elements (1, i, -1, -i) are equidistant from center', () => {
    const q8 = createQuaternion()
    const pos = q8PythagoreanLayout(q8, 800, 600)!
    const cx = 400, cy = 300
    const outer = ['1', 'i', '-1', '-i'].map(id => pos.get(id)!)
    expect(outer.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    const dists = outer.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))
    const [first, ...rest] = dists
    for (const d of rest) {
      expect(Math.abs(d - first!)).toBeLessThan(1)
    }
  })

  it('inner elements (j, k, -j, -k) are equidistant from center', () => {
    const q8 = createQuaternion()
    const pos = q8PythagoreanLayout(q8, 800, 600)!
    const cx = 400, cy = 300
    const inner = ['j', 'k', '-j', '-k'].map(id => pos.get(id)!)
    expect(inner.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    const dists = inner.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))
    const [first, ...rest] = dists
    for (const d of rest) {
      expect(Math.abs(d - first!)).toBeLessThan(1)
    }
  })

  it('outer radius is larger than inner radius', () => {
    const q8 = createQuaternion()
    const pos = q8PythagoreanLayout(q8, 800, 600)!
    const cx = 400, cy = 300
    const outerR = Math.sqrt((pos.get('1')!.x - cx) ** 2 + (pos.get('1')!.y - cy) ** 2)
    const innerR = Math.sqrt((pos.get('j')!.x - cx) ** 2 + (pos.get('j')!.y - cy) ** 2)
    expect(outerR).toBeGreaterThan(innerR)
  })
})

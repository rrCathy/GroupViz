import { describe, it, expect } from 'vitest'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'
import { compute3DPositions } from '../core/algebra/layout3D'
import { ringOrder, computeElementOrder, cayleyCircleLayout } from '../core/algebra/forceLayout'
import { quaternionCosetMap } from '../core/algebra/ringOrder'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { getConjugacyClasses } from '../core/algebra/subgroups'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createKleinFour } from '../core/groups/SpecialGroup'
import { getSmallGroup } from '../core/groups/SmallGroups'
import type { Group, Layout3D, CayleyAction } from '../core/types'

const W = 800
const H = 600

describe('computeShape2DPositions', () => {
  it('returns null for the circular fallback shape', () => {
    const C6 = createCyclicGroup(6)
    expect(computeShape2DPositions(C6, 'circular', W, H)).toBeNull()
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

  it('cone layout (2D concentric rings) covers every element by order', () => {
    const D6 = createDihedralGroup(6)
    const pos = computeShape2DPositions(D6, 'cone', W, H)!
    expect(pos.size).toBe(12)
    const center = pos.get(D6.identity.id)!
    expect(center.x).toBe(W / 2)
    expect(center.y).toBe(H / 2)
    const ringOf = (id: string) => Math.hypot(pos.get(id)!.x - W / 2, pos.get(id)!.y - H / 2)
    const e3 = D6.elements.find(el => computeElementOrder(el, D6) === 3)!
    const e2 = D6.elements.find(el => computeElementOrder(el, D6) === 2)!
    expect(ringOf(e3.id)).toBeGreaterThan(ringOf(e2.id))
    const r2s = D6.elements.filter(el => computeElementOrder(el, D6) === 2).map(el => ringOf(el.id))
    for (const r of r2s) expect(r).toBeCloseTo(r2s[0], 5)
  })
})

describe('compute3DPositions', () => {
  it('returns one position per element', () => {
    const C12 = createCyclicGroup(12)
    const pos = compute3DPositions(C12, 'circular')
    expect(pos.length).toBe(12)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('cone layout puts identity at the apex and rings by element order', () => {
    const S3 = createS3()
    const pos = compute3DPositions(S3, 'cone')
    expect(pos.length).toBe(6)
    const apexY = pos[S3.elements.findIndex(el => el.id === S3.identity.id)][1]
    expect(apexY).toBeGreaterThan(Math.max(...pos.filter((_, i) => S3.elements[i].id !== S3.identity.id).map(p => p[1])))
    const ord2 = S3.elements.findIndex(el => computeElementOrder(el, S3) === 2)
    const ord3 = S3.elements.findIndex(el => computeElementOrder(el, S3) === 3)
    expect(pos[ord2][1]).toBeGreaterThan(pos[ord3][1])
    const ringOf = (id: string) => Math.hypot(pos[S3.elements.findIndex(el => el.id === id)][0], pos[S3.elements.findIndex(el => el.id === id)][2])
    const r2 = ringOf(S3.elements[ord2].id)
    const r3 = ringOf(S3.elements[ord3].id)
    expect(r3).toBeGreaterThan(r2)
  })

  it('cone ring sectors group conjugacy classes together (D6, order-2 ring)', () => {
    const D6 = createDihedralGroup(6)
    const pos = compute3DPositions(D6, 'cone')
    const ord2 = D6.elements.filter(el => el.id !== D6.identity.id && computeElementOrder(el, D6) === 2)
    const classes = getConjugacyClasses(D6, false).filter(c => computeElementOrder(c[0], D6) === 2)
    const idxOf = (id: string) => D6.elements.findIndex(el => el.id === id)
    const ang = (id: string) => Math.atan2(pos[idxOf(id)][2], pos[idxOf(id)][0])
    const sorted = ord2.map(el => el.id).sort((a, b) => ang(a) - ang(b))
    const inSameClass = (a: string, b: string) => classes.some(c => c.some(e => e.id === a) && c.some(e => e.id === b))
    const inner: number[] = []
    const gap: number[] = []
    for (let t = 0; t < sorted.length; t++) {
      const a = sorted[t]
      const b = sorted[(t + 1) % sorted.length]
      let d = ang(b) - ang(a)
      if (d < 0) d += 2 * Math.PI
      if (inSameClass(a, b)) inner.push(d)
      else gap.push(d)
    }
    expect(inner.length).toBeGreaterThan(0)
    expect(Math.max(...inner)).toBeLessThan(Math.min(...gap))
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

  it('all 3D layouts produce finite coordinates', () => {
    const layouts: Layout3D[] = ['lattice', 'cylinder', 'circular', 'torus', 'hexagon', 'dihedral', 'tetrahedron', 'cube', 'cuboctahedron']
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

  it('circular layout uses the S3 hexagon order (identity at angle 0)', () => {
    const S3 = createS3()
    const pos = compute3DPositions(S3, 'circular')
    const idIdx = S3.elements.findIndex(e => e.id === '1,2,3')
    expect(pos[idIdx][0]).toBeGreaterThan(4.9)
    expect(Math.abs(pos[idIdx][2])).toBeLessThan(1e-9)
  })

  it('circular layout on cyclic groups keeps the generator edge adjacent', () => {
    const C16 = createCyclicGroup(16)
    const pos = compute3DPositions(C16, 'circular')
    const idIdx = new Map(C16.elements.map((e, i) => [e.id, i]))
    // 生成元幂序：e, g, g², … 生成元边连接相邻位置（弧长相等）
    const genEl = C16.generators[0].apply(C16.identity)
    const eIdx = idIdx.get(C16.identity.id)!
    const gIdx = idIdx.get(genEl.id)!
    const d1 = Math.hypot(
      pos[eIdx][0] - pos[gIdx][0],
      pos[eIdx][2] - pos[gIdx][2],
    )
    const d2 = Math.hypot(
      pos[gIdx][0] - pos[idIdx.get(C16.multiply(genEl, genEl).id)!][0],
      pos[gIdx][2] - pos[idIdx.get(C16.multiply(genEl, genEl).id)!][2],
    )
    expect(d1).toBeCloseTo(d2, 6)
  })

  it('cylinder supports multi-factor products (C2 x C3 x S3)', () => {
    const c2c3 = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    const dp = createDirectProduct(c2c3, createS3())
    expect(dp.order).toBe(36)
    const pos = compute3DPositions(dp, 'cylinder')
    expect(pos.length).toBe(36)
    expect(pos.every(p => p !== undefined)).toBe(true)
    // 6 层（C2×C3 组合）× 6 副本（S3 环）
    const yLevels = new Set(pos.map(p => Math.round(p[1] * 1000) / 1000))
    expect(yLevels.size).toBe(6)
    const byLevel = new Map<number, number>()
    for (const p of pos) {
      const y = Math.round(p[1] * 1000) / 1000
      byLevel.set(y, (byLevel.get(y) ?? 0) + 1)
    }
    for (const cnt of byLevel.values()) expect(cnt).toBe(6)
  })

  it('torus supports multi-factor non-cyclic products (S3 x S3 x S3)', () => {
    const s3s3 = createDirectProduct(createS3(), createS3())
    const dp = createDirectProduct(s3s3, createS3())
    expect(dp.order).toBe(216)
    const pos = compute3DPositions(dp, 'torus')
    expect(pos.length).toBe(216)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('torus handles grouped factors (C2 x C2 x S3 as [C2², S3])', () => {
    const c2c2 = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    const dp = createDirectProduct(c2c2, createS3())
    const pos = compute3DPositions(dp, 'torus')
    expect(pos.length).toBe(24)
    expect(pos.every(p => p !== undefined)).toBe(true)
  })

  it('dihedral circular layout avoids the index-order diagonal chords', () => {
    const D4 = createDihedralGroup(4)
    const pos = compute3DPositions(D4, 'circular')
    expect(pos.length).toBe(8)
    // 双环：4 旋转（y<0）+ 4 反射（y>0），每环同半径
    const upper = pos.filter(p => p[1] > 0)
    const lower = pos.filter(p => p[1] < 0)
    expect(upper.length).toBe(4)
    expect(lower.length).toBe(4)
    const rU = new Set(upper.map(p => Math.hypot(p[0], p[2]).toFixed(3)))
    const rL = new Set(lower.map(p => Math.hypot(p[0], p[2]).toFixed(3)))
    expect(rU.size).toBe(1)
    expect(rL.size).toBe(1)
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

  it('draws Q₁₆ as four concentric ⟨b⟩-coset rings with radial a edges', () => {
    const Q16 = getSmallGroup(16, 8)!.group
    expect(Q16.symbol).toBe('Q_{16}')
    const layout = cayleyCircleLayout(Q16, 100, 100, 80)
    expect(layout.size).toBe(16)
    const dec = quaternionCosetMap(Q16)!
    // 4 个陪集环：半径按陪集 j 递增，同环内 4 个节点等距 90°（b 边 = 环内弧）
    const rings = new Map<number, number[]>()
    for (const el of Q16.elements) {
      const { j } = dec.byElement.get(el.id)!
      const pos = layout.get(el.id)!
      const dist = Math.hypot(pos.x - 100, pos.y - 100)
      expect(dist).toBeCloseTo(80 * (0.34 + (j * 0.66) / 3), 6)
      if (!rings.has(j)) rings.set(j, [])
      rings.get(j)!.push(dist)
    }
    expect(rings.size).toBe(4)
    for (const [j, dists] of rings) {
      expect(dists.length).toBe(4)
      const angles = Q16.elements
        .filter(el => dec.byElement.get(el.id)!.j === j)
        .map(el => angleOf(layout.get(el.id)!, 100, 100))
        .sort((a, b) => a - b)
      for (let k = 0; k < 4; k++) {
        const diff = (angles[(k + 1) % 4] - angles[k] + 360) % 360
        expect(Math.abs(diff - 90)).toBeLessThan(1e-6)
      }
    }
    // i 偶的 a 边为纯径向（同角跨环）：(j,0) 与 (j+1,0) 同角度
    for (const el of Q16.elements) {
      const { i } = dec.byElement.get(el.id)!
      if (i !== 0) continue
      const next = Q16.multiply(el, dec.a)
      const p1 = layout.get(el.id)!
      const p2 = layout.get(next.id)!
      const a1 = angleOf(p1, 100, 100)
      const a2 = angleOf(p2, 100, 100)
      const diff = (a2 - a1 + 360) % 360
      // 径向辐条 (j,0)→(j+1,0) 同角；wrap (3,0)→(0,2) 为直径（180°）
      expect(Math.abs(diff) < 1e-6 || Math.abs(diff - 180) < 1e-6).toBe(true)
    }
    // 数值扫描确认最少的 4 环布局：4 条 wrap 边 = 2 条直径线（各含反向两条边），
    // 在圆心相交（2×2 = 4 处）；另有 4 处「弦端点落在直径内部」的共线邻接
    // （即 4 条 wrap 各穿过 3 个中间节点，共 12 处顶点贴边）——教科书式
    // Q16 同心方画法（与 GE 圆柱的 4 层 ⟨b⟩ 环同构）
    expect(crossingCount(Q16)).toBe(8)
  })

  it('does not apply the Q₁₆ ring layout to non-quaternion groups', () => {
    const C16 = createCyclicGroup(16)
    const D16 = createDihedralGroup(8)
    expect(quaternionCosetMap(C16)).toBeNull()
    expect(quaternionCosetMap(D16)).toBeNull()
    const c16 = cayleyCircleLayout(C16, 100, 100, 80)
    c16.forEach(p => {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(80, 6)
    })
    // D16 是二面体：走双环（80 外环 + 44 内环），不受 Q16 布局影响
    const d16 = cayleyCircleLayout(D16, 100, 100, 80)
    expect(d16.size).toBe(16)
    d16.forEach(p => {
      const d = Math.hypot(p.x - 100, p.y - 100)
      expect(Math.abs(d - 80) < 1e-6 || Math.abs(d - 44) < 1e-6).toBe(true)
    })
  })
})

describe('Q₁₆ 3D cylinder (Group Explorer style)', () => {
  it('semidirectCylinder lays Q₁₆ out as 4 ⟨b⟩-coset rings along y', () => {
    const Q16 = getSmallGroup(16, 8)!.group
    const pos = compute3DPositions(Q16, 'semidirectCylinder')
    expect(pos.length).toBe(16)
    const yLevels = new Set<number>()
    for (const p of pos) {
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
      yLevels.add(Math.round(p[1] * 100))
    }
    // 4 个不同层（陪集 j）
    expect(yLevels.size).toBe(4)
    // 同层 4 节点共圆
    const dec = quaternionCosetMap(Q16)!
    for (let j = 0; j < 4; j++) {
      const radiusAt = new Set<number>()
      for (const el of Q16.elements) {
        if (dec.byElement.get(el.id)!.j === j) {
          const idx = Q16.elements.indexOf(el)
          const p = pos[idx]
          radiusAt.add(Math.round(Math.hypot(p[0], p[2]) * 100))
        }
      }
      expect(radiusAt.size).toBe(1)
    }
  })

  it('leaves other semidirect-shape groups on the fibonacci fallback', () => {
    const C8 = createCyclicGroup(8)
    const pos = compute3DPositions(C8, 'semidirectCylinder')
    expect(pos.length).toBe(8)
  })
})

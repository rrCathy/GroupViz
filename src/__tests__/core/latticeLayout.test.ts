import { describe, it, expect } from 'vitest'
import {
  computeLatticeLayout,
  latticeFitScale,
  latticeLodTier,
  orderLevelsByBarycenter,
  countLatticeCrossings,
  latticeSlotScreenSize,
  LATTICE_CARD_RX,
  LATTICE_LOD_FULL,
  LATTICE_LOD_COMPACT,
  LATTICE_ROW_FULL,
  LATTICE_ROW_COMPACT,
} from '../../core/algebra/latticeLayout'
import { levelsByOrderRank, transitiveReduce } from '../../core/algebra/subgroups'
import type { SubgroupLatticeNode, SubgroupLatticeEdge } from '../../core/algebra/subgroups'

/** 只填布局关心的字段（level/order），其余给占位值 */
function node(order: number, level: number): SubgroupLatticeNode {
  return { id: `n${order}-${level}`, label: `${order}`, elementIds: [], order, index: 0, isNormal: false, level }
}

describe('computeLatticeLayout', () => {
  it('fits the world box tightly to content (no 1000x600 floor)', () => {
    const nodes = [node(6, 0), node(2, 1), node(3, 1), node(1, 2)]
    const edges: SubgroupLatticeEdge[] = [{ from: 1, to: 0 }, { from: 2, to: 0 }, { from: 1, to: 3 }, { from: 2, to: 3 }]
    const layout = computeLatticeLayout(nodes, edges)
    // 同层最多 2 个节点 → 2 槽位 + 左右内边距，远小于旧实现的 1000 下限
    expect(layout.viewW).toBeLessThan(1000)
    expect(layout.viewW).toBeCloseTo(2 * (LATTICE_CARD_RX * 2 + 40) + 80)
    expect(layout.viewH).toBeLessThan(600)
  })

  it('centers a level and puts level 0 at the top (G above ⟨e⟩)', () => {
    const nodes = [node(4, 0), node(2, 1), node(2, 1), node(1, 2)]
    const layout = computeLatticeLayout(nodes, [])
    expect(layout.positions[0].x).toBeCloseTo(layout.viewW / 2)
    expect(layout.positions[1].x).toBeLessThan(layout.positions[2].x)
    expect(layout.positions[0].y).toBeLessThan(layout.positions[3].y)
  })

  it('never overlaps cards inside a level (slot ≥ card width + gap)', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node(i + 2, 1))
    const layout = computeLatticeLayout(nodes, [])
    const xs = layout.positions.map(p => p.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(layout.nodeRx * 2)
    }
  })

  it('scales card and spacing with nodeScale', () => {
    const nodes = [node(2, 0), node(1, 1)]
    const full = computeLatticeLayout(nodes, [])
    const small = computeLatticeLayout(nodes, [], { nodeScale: 0.5 })
    expect(small.nodeRx).toBeCloseTo(full.nodeRx * 0.5)
    expect(small.slotW).toBeCloseTo(full.slotW * 0.5)
    expect(small.viewW).toBeCloseTo(full.viewW * 0.5)
  })

  it('degrades gracefully on empty and single-node lattices (no NaN)', () => {
    const empty = computeLatticeLayout([], [])
    expect(empty.positions).toHaveLength(0)
    expect(Number.isNaN(empty.viewW)).toBe(false)
    const one = computeLatticeLayout([node(1, 0)], [])
    expect(one.maxLevel).toBe(0)
    expect(Number.isFinite(one.positions[0].x)).toBe(true)
    expect(Number.isFinite(one.positions[0].y)).toBe(true)
  })
})

describe('orderLevelsByBarycenter / countLatticeCrossings', () => {
  it('untangles a single crossing between two levels', () => {
    // 顶层 A,B（level 0）；底层 C,D（level 1）；边 C→B 与 D→A 交叉
    const nodes = [node(6, 0), node(6, 0), node(2, 1), node(3, 1)]
    const edges: SubgroupLatticeEdge[] = [{ from: 2, to: 1 }, { from: 3, to: 0 }]
    const groups = computeLatticeLayout(nodes, edges, { barycenterPasses: 0 }).levelOrder
    expect(countLatticeCrossings(groups, edges)).toBe(1)
    const relaxed = orderLevelsByBarycenter(groups, edges, 3)
    expect(countLatticeCrossings(relaxed, edges)).toBe(0)
  })

  it('leaves single-element levels untouched and keeps every node', () => {
    const nodes = [node(6, 0), node(2, 1), node(3, 1)]
    const edges: SubgroupLatticeEdge[] = [{ from: 1, to: 0 }, { from: 2, to: 0 }]
    const out = orderLevelsByBarycenter(computeLatticeLayout(nodes, edges, { barycenterPasses: 0 }).levelOrder, edges, 3)
    expect(out.map(g => [...g].sort((a, b) => a - b))).toEqual([[0], [1, 2]])
  })

  it('does not count level-skipping edges as crossings', () => {
    const nodes = [node(12, 0), node(6, 1), node(2, 2)]
    const edges: SubgroupLatticeEdge[] = [{ from: 2, to: 1 }, { from: 1, to: 0 }, { from: 2, to: 0 }]
    const groups = computeLatticeLayout(nodes, edges).levelOrder
    expect(countLatticeCrossings(groups, edges)).toBe(0)
  })
})

describe('lattice LOD math', () => {
  it('clamps fit at 1 so cards never magnify', () => {
    expect(latticeFitScale(2000, 2000, 500, 500)).toBe(1)
    expect(latticeFitScale(500, 500, 1000, 1000)).toBeCloseTo(0.5)
  })

  it('treats an unmeasured host as full scale (first frame / happy-dom)', () => {
    expect(latticeFitScale(0, 0, 1000, 1000)).toBe(1)
    expect(latticeFitScale(1000, 1000, 0, 0)).toBe(1)
  })

  it('picks a tier from the slot screen size (both axes must fit)', () => {
    expect(latticeSlotScreenSize(200, 132, 1, 1)).toEqual({ slotScreenWidth: 200, rowScreenHeight: 132 })
    expect(latticeLodTier(200, 132)).toBe('full')
    expect(latticeLodTier(LATTICE_LOD_FULL, LATTICE_ROW_FULL)).toBe('full')
    // 宽够但层高不足（扁宽格）也不能上完整名片
    expect(latticeLodTier(LATTICE_LOD_FULL, LATTICE_ROW_FULL - 1)).toBe('compact')
    expect(latticeLodTier(LATTICE_LOD_FULL - 1, 500)).toBe('compact')
    // 窄高的轨道格靠高度仍能放胶囊（此前按单指标会被误降成 dots）
    expect(latticeLodTier(LATTICE_LOD_COMPACT, LATTICE_ROW_COMPACT)).toBe('compact')
    expect(latticeLodTier(42, 28)).toBe('dots')
    expect(latticeLodTier(LATTICE_LOD_COMPACT - 1, 500)).toBe('dots')
  })
})

describe('levelsByOrderRank / transitiveReduce', () => {
  it('shares one level rule: equal orders share a level, biggest order on top', () => {
    // 阶升序 [1,2,3,4,6] → rank 0..4，maxLevel = 4 ⇒ level = 4 - rank（阶最大者在 0 层=顶部）
    const levels = levelsByOrderRank([1, 2, 2, 3, 4, 6])
    expect(levels).toEqual([4, 3, 3, 2, 1, 0])
    expect(levelsByOrderRank([])).toEqual([])
    expect(levelsByOrderRank([5])).toEqual([0])
  })

  it('drops edges implied by a longer path', () => {
    const chain: SubgroupLatticeEdge[] = [{ from: 0, to: 1 }, { from: 1, to: 2 }]
    const withShortcut: SubgroupLatticeEdge[] = [...chain, { from: 0, to: 2 }]
    expect(transitiveReduce(3, withShortcut)).toEqual(chain)
  })

  it('keeps a diamond intact and removes duplicate parallel edges', () => {
    const diamond: SubgroupLatticeEdge[] = [
      { from: 3, to: 1 }, { from: 1, to: 0 }, { from: 3, to: 2 }, { from: 2, to: 0 },
    ]
    expect(transitiveReduce(4, diamond)).toEqual(diamond)
    expect(transitiveReduce(4, [...diamond, { from: 1, to: 0 }])).toHaveLength(4)
  })
})

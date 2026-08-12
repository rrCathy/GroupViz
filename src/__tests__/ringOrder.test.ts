import { describe, it, expect } from 'vitest'
import {
  detectS3PermSet,
  ringOrder,
  cayleyRingKeys,
  parseProductFactors,
  matrixGridLayout,
  nestedFactorLayout2D,
  S3_PERM_IDS,
  clusterFactorGroups,
  tableGroupFactorSplit,
  clusterIsCyclic,
  factorPipeGroupsGrouped,
  powerRingOrder,
} from '../core/algebra/ringOrder'
import type { Group, GroupElement } from '../core/types'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'

const ID: GroupElement = { id: 'e', label: '0', value: [] }

function mk(overrides: Partial<Group>): Group {
  return {
    name: '',
    symbol: '',
    order: 1,
    elements: [],
    generators: [],
    multiply: (a) => a,
    inverse: (el) => el,
    identity: ID,
    isAbelian: true,
    ...overrides,
  }
}

describe('detectS3PermSet', () => {
  it('recognizes the S3 permutation set regardless of order', () => {
    const shuffled = ['3,1,2', '1,2,3', '1,3,2', '3,2,1', '2,1,3', '2,3,1']
    expect(detectS3PermSet(shuffled)).toBe(true)
    expect(detectS3PermSet([...S3_PERM_IDS])).toBe(true)
  })

  it('rejects wrong size / wrong content', () => {
    expect(detectS3PermSet(S3_PERM_IDS.slice(0, 5))).toBe(false)
    expect(detectS3PermSet(['0'])).toBe(false)
    expect(detectS3PermSet(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(false)
  })
})

describe('ringOrder', () => {
  it('returns S3 canonical order for S3 permutations', () => {
    expect(ringOrder(['3,1,2', '1,2,3', '1,3,2', '3,2,1', '2,1,3', '2,3,1'])).toEqual(S3_PERM_IDS)
  })

  it('orders Z2xZ2 and Z2^3 bit vectors', () => {
    expect(ringOrder(['1,1', '0,0', '0,1', '1,0'])).toEqual(['0,0', '1,0', '1,1', '0,1'])
    const z23 = ringOrder(['1,1,1', '0,0,0', '0,1,0', '1,1,0', '1,0,0', '0,0,1', '1,0,1', '0,1,1'])
    expect(z23).toEqual(['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0'])
  })

  it('sorts integers and eN-style ids numerically', () => {
    expect(ringOrder(['3', '1', '10', '2'])).toEqual(['1', '2', '3', '10'])
    expect(ringOrder(['e2', 'e10', 'e1'])).toEqual(['e1', 'e2', 'e10'])
  })

  it('falls back to lexicographic sort', () => {
    expect(ringOrder(['b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('cayleyRingKeys', () => {
  it('applies S3 and bit-vector special cases', () => {
    expect(cayleyRingKeys(S3_PERM_IDS)).toEqual(S3_PERM_IDS)
    expect(cayleyRingKeys(['1,1', '0,0', '0,1', '1,0'])).toEqual(['0,0', '1,0', '1,1', '0,1'])
  })

  it('sorts numeric and eN keys then falls back', () => {
    expect(cayleyRingKeys(['2', '10', '1'])).toEqual(['1', '2', '10'])
    expect(cayleyRingKeys(['e2', 'e10', 'e1'])).toEqual(['e1', 'e2', 'e10'])
    expect(cayleyRingKeys(['z', 'y'])).toEqual(['y', 'z'])
  })
})

describe('parseProductFactors', () => {
  it('parses pipe-style direct products', () => {
    const elements = [
      { id: 'a|1', label: '', value: [] },
      { id: 'b|1', label: '', value: [] },
      { id: 'a|2', label: '', value: [] },
      { id: 'b|2', label: '', value: [] },
    ]
    const group = mk({ elements })
    const f = parseProductFactors(group)!
    expect(f.colSize).toBe(2)
    expect(f.rowSize).toBe(2)
    expect(f.getCol(elements[0])).toBe(0)
    expect(f.getRow(elements[0])).toBe(0)
    expect(f.getCol(elements[3])).toBe(1)
    expect(f.getRow(elements[3])).toBe(1)
  })

  it('parses 2D value vectors', () => {
    const elements = [
      { id: '0', label: '', value: [0, 0] },
      { id: '1', label: '', value: [1, 0] },
      { id: '2', label: '', value: [0, 1] },
      { id: '3', label: '', value: [1, 1] },
    ]
    const f = parseProductFactors(mk({ elements }))!
    expect(f.colSize).toBe(2)
    expect(f.rowSize).toBe(2)
    expect(f.getCol(elements[1])).toBe(1)
    expect(f.getRow(elements[1])).toBe(0)
  })

  it('rejects 2D vectors that do not factor', () => {
    const elements = [
      { id: 'a', label: '', value: [0, 0] },
      { id: 'b', label: '', value: [0, 0] },
      { id: 'c', label: '', value: [0, 1] },
    ]
    expect(parseProductFactors(mk({ elements }))).toBeNull()
  })

  it('parses 3D bit-vector products', () => {
    const elements = [
      { id: '0', value: [0, 0, 0] },
      { id: '1', value: [0, 0, 1] },
      { id: '2', value: [0, 1, 0] },
      { id: '3', value: [0, 1, 1] },
      { id: '4', value: [1, 0, 0] },
      { id: '5', value: [1, 0, 1] },
      { id: '6', value: [1, 1, 0] },
      { id: '7', value: [1, 1, 1] },
    ]
    const f = parseProductFactors(mk({ elements: elements.map(e => ({ ...e, label: '' })) }))!
    expect(f.colSize).toBe(2)
    expect(f.rowSize).toBe(4)
  })

  it('returns null for empty or 1-dimensional groups', () => {
    expect(parseProductFactors(mk({ elements: [] }))).toBeNull()
    expect(parseProductFactors(mk({ elements: [{ id: 'a', label: '', value: [0] }] }))).toBeNull()
  })

  it('factors registry table groups via generator commuting clusters', () => {
    const c4c4 = getSmallGroup(16, 1)!.group
    const f = parseProductFactors(c4c4)!
    expect(f.colSize).toBe(4)
    expect(f.rowSize).toBe(4)
    const cols = new Set(c4c4.elements.map(f.getCol))
    const rows = new Set(c4c4.elements.map(f.getRow))
    expect(cols.size).toBe(4)
    expect(rows.size).toBe(4)

    const c4c2c2 = getSmallGroup(16, 9)!.group
    const f2 = parseProductFactors(c4c2c2)!
    expect(f2.colSize).toBe(4)
    expect(f2.rowSize).toBe(4)

    const c2c2c2c2 = getSmallGroup(16, 13)!.group
    const f3 = parseProductFactors(c2c2c2c2)!
    expect(f3.colSize).toBe(4)
    expect(f3.rowSize).toBe(4)

    const c2d8 = getSmallGroup(16, 10)!.group
    const f4 = parseProductFactors(c2d8)!
    expect(Math.min(f4.colSize, f4.rowSize)).toBe(2)
    expect(Math.max(f4.colSize, f4.rowSize)).toBe(8)
  })

  it('returns null for registry groups without a commuting generator split', () => {
    const d16 = getSmallGroup(16, 6)!.group
    expect(parseProductFactors(d16)).toBeNull()
  })
})

describe('clusterFactorGroups / tableGroupFactorSplit / clusterIsCyclic', () => {
  it('clusters Z2 x D8 (16,10) generators into a cyclic and a dihedral factor', () => {
    const g = getSmallGroup(16, 10)!.group
    const clusters = clusterFactorGroups(g)!
    expect(clusters.length).toBe(2)
    const sizes = clusters.map(c => c.length).sort((a, b) => a - b)
    expect(sizes).toEqual([2, 8])
    const bySize = (n: number) => clusters.find(c => c.length === n)!
    expect(clusterIsCyclic(g, bySize(2))).toBe(true)
    expect(clusterIsCyclic(g, bySize(8))).toBe(false)
  })

  it('splits every element of Z2 x D8 into factor components', () => {
    const g = getSmallGroup(16, 10)!.group
    const split = tableGroupFactorSplit(g)!
    expect(split.byElement.size).toBe(16)
    expect(split.aIds.length).toBeGreaterThan(1)
    expect(split.bIds.length).toBeGreaterThan(1)
    const idSet = new Set(g.elements.map(e => e.id))
    for (const el of g.elements) {
      const comp = split.byElement.get(el.id)!
      expect(idSet.has(comp.aId)).toBe(true)
      expect(idSet.has(comp.bId)).toBe(true)
    }
  })

  it('returns null for non-direct-product registry groups', () => {
    const d16 = getSmallGroup(16, 6)!.group
    expect(clusterFactorGroups(d16)).toBeNull()
    expect(tableGroupFactorSplit(d16)).toBeNull()
  })
})

describe('factorPipeGroupsGrouped', () => {
  function pipeGroup(symbol: string, tokenCount: number): Group {
    return mk({
      symbol,
      elements: [
        { id: Array(tokenCount).fill('x').join('|'), label: '', value: [] },
        { id: Array(tokenCount).fill('y').join('|'), label: '', value: [] },
      ],
    })
  }

  it('groups compact power C2^2 x S3 into one non-cyclic factor', () => {
    const g = pipeGroup('C_{2}^{2} \\times S_{3}', 3)
    const r = factorPipeGroupsGrouped(g)!
    expect(r.count).toBe(2)
    expect(r.cyclic).toEqual([false, false])
    expect(r.offsets).toEqual([0, 2])
    expect(r.perEl[0][0]).toEqual(['x', 'x'])
    expect(r.perEl[0][1]).toEqual(['x'])
  })

  it('merges adjacent same-base cyclic parts (C2 x C2 x C3 -> C2^2 + C3)', () => {
    const g = pipeGroup('C_{2} \\times C_{2} \\times C_{3}', 3)
    const r = factorPipeGroupsGrouped(g)!
    expect(r.count).toBe(2)
    expect(r.cyclic).toEqual([false, true])
    expect(r.offsets).toEqual([0, 2])
    expect(r.perEl[0][0]).toEqual(['x', 'x'])
    expect(r.perEl[0][1]).toEqual(['x'])
  })

  it('keeps distinct cyclic parts separate (C2 x C3 x S3)', () => {
    const g = pipeGroup('C_{2} \\times C_{3} \\times S_{3}', 3)
    const r = factorPipeGroupsGrouped(g)!
    expect(r.count).toBe(3)
    expect(r.cyclic).toEqual([true, true, false])
    expect(r.offsets).toEqual([0, 1, 2])
  })

  it('returns null for non-pipe groups and segment mismatches', () => {
    const nonPipe = mk({ symbol: 'C_{2} \\times C_{3}', elements: [{ id: 'a', label: '', value: [] }] })
    expect(factorPipeGroupsGrouped(nonPipe)).toBeNull()
    const mismatch = pipeGroup('C_{2}^{2} \\times S_{3}', 4)
    expect(factorPipeGroupsGrouped(mismatch)).toBeNull()
  })
})

describe('matrixGridLayout', () => {
  const elements: GroupElement[] = [
    { id: 'a', label: '', value: [] },
    { id: 'b', label: '', value: [] },
    { id: 'c', label: '', value: [] },
    { id: 'd', label: '', value: [] },
  ]

  it('lays elements out on a grid with swapped orientation when rows exceed columns', () => {
    const group = mk({ elements })
    const pos = matrixGridLayout(
      2, 2,
      (el) => elements.indexOf(el) % 2,
      (el) => Math.floor(elements.indexOf(el) / 2),
      group,
      640, 640
    )
    expect(pos.size).toBe(4)
    const x = new Set([...pos.values()].map(p => p.x))
    const y = new Set([...pos.values()].map(p => p.y))
    expect(x.size).toBe(2)
    expect(y.size).toBe(2)
  })

  it('handles dimension swap when r > c', () => {
    const group = mk({ elements })
    const pos = matrixGridLayout(
      2, 3,
      (el) => elements.indexOf(el) % 2,
      (el) => Math.floor(elements.indexOf(el) / 2),
      group,
      1000, 1000
    )
    expect(pos.size).toBe(4)
  })
})

describe('nestedFactorLayout2D', () => {
  it('builds a nested ring layout for pipe products', () => {
    const elements = [
      { id: 'a|0', label: '', value: [] },
      { id: 'b|0', label: '', value: [] },
      { id: 'a|1', label: '', value: [] },
      { id: 'b|1', label: '', value: [] },
      { id: 'c|1', label: '', value: [] },
      { id: 'c|0', label: '', value: [] },
    ]
    const layout = nestedFactorLayout2D(mk({ elements }), 800, 800)!
    expect(layout.size).toBe(6)
    for (const el of elements) {
      expect(layout.has(el.id)).toBe(true)
    }
  })

  it('returns null for non-pipe or empty groups', () => {
    expect(nestedFactorLayout2D(mk({ elements: [{ id: 'x', label: '', value: [] }] }), 800, 800)).toBeNull()
    expect(nestedFactorLayout2D(mk({ elements: [] }), 800, 800)).toBeNull()
  })
})

describe('powerRingOrder', () => {
  it('returns generator-power order for cyclic groups (e, g, g², …)', () => {
    const c6 = createCyclicGroup(6)
    const order = powerRingOrder(c6)
    expect(order[0]).toBe(c6.identity.id)
    const g = c6.generators[0].apply(c6.identity)
    const mul = c6.multiply
    let cur = c6.identity
    for (let i = 1; i < 6; i++) {
      cur = mul(cur, g)
      expect(order[i]).toBe(cur.id)
    }
  })

  it('returns the ring order (square) for V4 bit-vector ids', () => {
    const g = mk({
      order: 4,
      elements: [
        { id: '0,0', label: 'e', value: [] },
        { id: '1,0', label: 'a', value: [] },
        { id: '0,1', label: 'b', value: [] },
        { id: '1,1', label: 'ab', value: [] },
      ],
      multiply: (a, b) => {
        const pa = a.id.split(',').map(Number)
        const pb = b.id.split(',').map(Number)
        return { id: `${(pa[0] ^ pb[0])},${pa[1] ^ pb[1]}`, label: '', value: [] } as GroupElement
      },
      inverse: (el) => el,
      identity: { id: '0,0', label: 'e', value: [] } as GroupElement,
    })
    expect(powerRingOrder(g)).toEqual(['0,0', '1,0', '1,1', '0,1'])
  })

  it('orders by right multiplication along generators for Z2 x Z2 (square ring)', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    const order = powerRingOrder(dp)
    expect(order[0]).toBe(dp.identity.id)
    expect(new Set(order)).toEqual(new Set(dp.elements.map(e => e.id)))
    expect(order.length).toBe(4)
    const gens = dp.generators.map(g => g.apply(dp.identity))
    const mul = dp.multiply
    const id = dp.identity
    expect(mul(order[0] === id.id ? id : dp.elements.find(e => e.id === order[0])!, gens[0]).id).toBe(order[1] === dp.identity.id ? id.id : order[1])
  })

  it('returns S3 canonical hexagon order for S3 permutations', () => {
    const s3 = createS3()
    expect(powerRingOrder(s3)).toEqual(S3_PERM_IDS)
  })

  it('orders C4 x C2 as a rectangular ring (outer t0 row, inner t1 row)', () => {
    const dp = createDirectProduct(createCyclicGroup(4), createCyclicGroup(2))
    const order = powerRingOrder(dp)
    expect(order).toEqual([
      'e0|e0', 'e1|e0', 'e2|e0', 'e3|e0',
      'e3|e1', 'e2|e1', 'e1|e1', 'e0|e1',
    ])
  })

  it('falls back to ringOrder when generators are empty', () => {
    const keys = ['b', 'a', 'c']
    const g = mk({ order: 3, elements: keys.map(k => ({ id: k, label: k, value: [] } as GroupElement)) })
    expect(powerRingOrder(g)).toEqual(['a', 'b', 'c'])
  })
})
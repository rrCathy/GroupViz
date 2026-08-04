import { describe, it, expect } from 'vitest'
import {
  detectS3PermSet,
  ringOrder,
  cayleyRingKeys,
  parseProductFactors,
  matrixGridLayout,
  nestedFactorLayout2D,
  S3_PERM_IDS,
} from '../core/algebra/ringOrder'
import type { Group, GroupElement } from '../core/types'

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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeSubgroups,
  computeConjugacyClasses,
  computeCenter,
  computeIsSimple,
  computeLattice,
  computeGroupProperties,
  createEmptyBackendCache,
  computeLocalFallbackResults,
  fetchBackendResults,
  fetchBackendCayleyEdges,
  fetchBackendElementOrder,
} from '../utils/hybridCompute'
import {
  fetchSubgroups,
  fetchConjugacyClasses,
  fetchCenter,
  fetchLattice,
  fetchCayleyEdges,
  fetchElementOrder,
  fetchGroupProperties,
} from '../utils/api'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import type { Group, GroupElement } from '../core/types'

vi.mock('../utils/api', () => ({
  fetchSubgroups: vi.fn(),
  fetchConjugacyClasses: vi.fn(),
  fetchCenter: vi.fn(),
  fetchLattice: vi.fn(),
  fetchCayleyEdges: vi.fn(),
  fetchElementOrder: vi.fn(),
  fetchGroupProperties: vi.fn(),
}))

const mockFetchFunctions = {
  fetchSubgroups: vi.mocked(fetchSubgroups),
  fetchConjugacyClasses: vi.mocked(fetchConjugacyClasses),
  fetchCenter: vi.mocked(fetchCenter),
  fetchLattice: vi.mocked(fetchLattice),
  fetchCayleyEdges: vi.mocked(fetchCayleyEdges),
  fetchElementOrder: vi.mocked(fetchElementOrder),
  fetchGroupProperties: vi.mocked(fetchGroupProperties),
}

beforeEach(() => {
  for (const m of Object.values(mockFetchFunctions)) m.mockReset()
})

function makeBigGroup(order: number, ids: string[] = []): Group {
  const elements: GroupElement[] = ids.map(id => ({
    id,
    label: id,
    value: [Number(id.replace(/[^0-9]/g, '')) || 0],
  }))
  const identity: GroupElement = { id: 'e0', label: '0', value: [0] }
  return {
    name: `Big ${order}`,
    symbol: `C_{${order}}`,
    order,
    elements,
    generators: [],
    multiply: (a) => a,
    inverse: (el) => el,
    identity,
    isAbelian: true,
    exponent: order,
  }
}

describe('hybrid compute cutoff (order �?60 local)', () => {
  it('computes local subgroups for small groups', () => {
    const subs = computeSubgroups(createCyclicGroup(6))
    expect(subs.length).toBeGreaterThan(0)
    expect(subs.some(s => s.order === 3)).toBe(true)
  })

  it('returns cached subgroups for large groups', () => {
    const big = makeBigGroup(120)
    const cached = [{ elements: [], isNormal: true, order: 60, index: 2, generators: [] }]
    const res = computeSubgroups(big, cached)
    expect(res).toBe(cached)
  })

  it('returns [] for cached missing subgroups on large groups', () => {
    const big = makeBigGroup(120)
    expect(computeSubgroups(big)).toEqual([])
  })

  it('computes local conjugacy classes for small groups', () => {
    const classes = computeConjugacyClasses(createS3())
    expect(classes.length).toBe(3)
  })

  it('uses cache for conjugacy classes on large groups', () => {
    const big = makeBigGroup(120)
    const cached = [[{ id: 'e0', label: '0', value: [0] }]]
    expect(computeConjugacyClasses(big, cached)).toBe(cached)
  })

  it('computes local center for small groups', () => {
    const center = computeCenter(createS3())
    expect(center.map(e => e.id)).toEqual(['1,2,3'])
  })

  it('falls back to identity for center on large groups without cache', () => {
    const big = makeBigGroup(120)
    expect(computeCenter(big)).toEqual([big.identity])
  })

  it('detects simplicity locally for small groups', () => {
    // C_5 is simple
    expect(computeIsSimple(createCyclicGroup(5))).toBe(true)
    // C_6 is not
    expect(computeIsSimple(createCyclicGroup(6))).toBe(false)
  })

  it('derives simplicity from cached subgroups for large groups', () => {
    const big = makeBigGroup(120)
    // only trivial normal subgroups -> simple
    const trivialOnly = [
      { elements: [], isNormal: true, order: 1, index: 120, generators: [] },
      { elements: [], isNormal: true, order: 120, index: 1, generators: [] },
    ]
    expect(computeIsSimple(big, trivialOnly)).toBe(true)
    // has a nontrivial normal subgroup -> not simple
    const withNormal = [...trivialOnly, { elements: [], isNormal: true, order: 60, index: 2, generators: [] }]
    expect(computeIsSimple(big, withNormal)).toBe(false)
    // no cache -> conservative false
    expect(computeIsSimple(big)).toBe(false)
  })

  it('computes local lattice for small groups', () => {
    const lat = computeLattice(createCyclicGroup(6))
    expect(lat.nodes.length).toBeGreaterThanOrEqual(4)
  })

  it('returns empty lattice fallback for large groups', () => {
    const big = makeBigGroup(120)
    expect(computeLattice(big)).toEqual({ nodes: [], edges: [] })
  })

  it('computes properties locally for small groups', () => {
    const props = computeGroupProperties(createS3())
    expect(props).toEqual({
      solvable: true,
      nilpotent: false,
      perfect: false,
      derivedSeriesOrders: [6, 3, 1],
    })
  })

  it('uses backend cache for large groups, null when unavailable', () => {
    const big = makeBigGroup(120)
    expect(computeGroupProperties(big)).toBeNull()
    expect(computeGroupProperties(big, {
      ...createEmptyBackendCache(),
      isSolvable: true, isNilpotent: false, isPerfect: false,
      derivedSeriesOrders: [120, 60, 1],
    })).toEqual({
      solvable: true, nilpotent: false, perfect: false,
      derivedSeriesOrders: [120, 60, 1],
    })
  })

  it('creates an empty backend cache', () => {
    expect(createEmptyBackendCache()).toEqual({
      subgroups: null, normalSubgroups: null, conjugacyClasses: null,
      center: null, isSimple: null, isSolvable: null, isNilpotent: null,
      isPerfect: null, derivedSeriesOrders: [], lattice: null, loading: false,
      error: null, groupSymbol: null,
    })
  })
})

describe('fetchBackendResults', () => {
  it('skips backend for small groups', async () => {
    const res = await fetchBackendResults({ ...makeBigGroup(6), symbol: 'C_{6}' })
    expect(res.subgroups).toBeNull()
    expect(res.groupSymbol).toBe('C_{6}')
    expect(mockFetchFunctions.fetchSubgroups).not.toHaveBeenCalled()
  })

  it('collects and converts backend results for large groups', async () => {
    const big = makeBigGroup(120, ['g0', 'g1', 'g2'])
    mockFetchFunctions.fetchSubgroups.mockResolvedValue({
      subgroups: [
        { elements: [{ id: 'g0', label: 'g0', value: [0] }], is_normal: true, order: 1 },
        { elements: [{ id: 'g1', label: 'x', value: [1] }], is_normal: false, order: 40 },
        { elements: [{ id: 'g2', label: 'g2', value: [2] }], is_normal: true, order: 60 },
      ],
      total_count: 3,
    })
    mockFetchFunctions.fetchConjugacyClasses.mockResolvedValue({
      classes: [[{ id: 'g0', label: 'g0', value: [0] }], [{ id: 'g1', label: 'g1', value: [1] }]],
    })
    mockFetchFunctions.fetchCenter.mockResolvedValue({ center: [{ id: 'g0', label: 'g0', value: [0] }] })
    mockFetchFunctions.fetchLattice.mockResolvedValue({
      nodes: [{ id: 0, elements: [], order: 1, is_normal: true, level: 0 }],
      edges: [],
    })
    mockFetchFunctions.fetchGroupProperties.mockResolvedValue({
      derived_series_orders: [120, 60, 1],
      solvable: true,
      nilpotent: false,
      perfect: false,
    })

    const res = await fetchBackendResults(big)

    expect(res.subgroups).toHaveLength(3)
    expect(res.normalSubgroups).toHaveLength(2)
    expect(res.isSimple).toBe(false)
    expect(res.conjugacyClasses).toHaveLength(2)
    expect(res.center?.map(e => e.id)).toEqual(['g0'])
    expect(res.lattice).toEqual({
      nodes: [{ id: 0, elements: [], order: 1, is_normal: true, level: 0 }],
      edges: [],
    })
    expect(res.isSolvable).toBe(true)
    expect(res.isNilpotent).toBe(false)
    expect(res.isPerfect).toBe(false)
    expect(res.derivedSeriesOrders).toEqual([120, 60, 1])
    expect(res.error).toBeNull()
  })

  it('falls back to local computation when the backend fails', async () => {
    const s5 = createSymmetricGroup(5)
    mockFetchFunctions.fetchSubgroups.mockRejectedValue(new Error('backend down'))
    const res = await fetchBackendResults(s5)
    expect(res.error).toBe('backend down')
    expect(res.subgroups!.length).toBeGreaterThan(0)
    expect(res.normalSubgroups!.length).toBeGreaterThan(0)
    expect(res.isSimple).toBe(false)
    expect(res.center!.map(e => e.id)).toEqual([s5.identity.id])
    expect(res.conjugacyClasses).toHaveLength(7)
    expect(res.isSolvable).toBe(false)
    expect(res.isNilpotent).toBe(false)
    expect(res.isPerfect).toBe(false)
    expect(res.lattice!.nodes.length).toBeGreaterThan(2)
  }, 30000)

  it('falls back when the backend returns truncated results', async () => {
    const s5 = createSymmetricGroup(5)
    mockFetchFunctions.fetchSubgroups.mockResolvedValue({
      subgroups: [],
      total_count: 0,
      truncated: true,
    })
    const res = await fetchBackendResults(s5)
    expect(res.error).toContain('truncated')
    expect(res.subgroups!.length).toBeGreaterThan(0)
    expect(res.conjugacyClasses).toHaveLength(7)
    expect(res.isSolvable).toBe(false)
  }, 30000)

  it('computeLocalFallbackResults returns empty above the cutoff', () => {
    const huge = makeBigGroup(250)
    const res = computeLocalFallbackResults(huge)
    expect(res.subgroups).toBeNull()
    expect(res.isSimple).toBeNull()
    expect(res.groupSymbol).toBe('C_{250}')
  })

  it('computeLocalFallbackResults computes S_5 locally', () => {
    const s5 = createSymmetricGroup(5)
    const res = computeLocalFallbackResults(s5)
    expect(res.subgroups!.length).toBeGreaterThan(0)
    expect(res.isSimple).toBe(false)
    expect(res.conjugacyClasses).toHaveLength(7)
    expect(res.isSolvable).toBe(false)
  }, 30000)
})

describe('fetchBackendCayleyEdges', () => {
  it('computes locally for small groups', async () => {
    const s3 = createS3()
    const edges = await fetchBackendCayleyEdges(s3, [s3.elements[0].id], 'right')
    expect(Array.isArray(edges)).toBe(true)
  })

  it('maps backend edges for large groups', async () => {
    const big = makeBigGroup(120, ['g0', 'g1'])
    mockFetchFunctions.fetchCayleyEdges.mockResolvedValue({
      edges: [{
        from_idx: 0, to_idx: 1, from_id: 'g0', to_id: 'g1',
        action_element_id: 'g1', color: '#ff6b6b',
        is_bidirectional: true, is_self_loop: false,
      }],
    })
    const edges = await fetchBackendCayleyEdges(big, ['g1'], 'left')
    expect(edges).toEqual([{
      fromIdx: 0, toIdx: 1, fromId: 'g0', toId: 'g1',
      actionElementId: 'g1', color: '#ff6b6b',
      isBidirectional: true, isSelfLoop: false,
    }])
    expect(mockFetchFunctions.fetchCayleyEdges).toHaveBeenCalledWith('C_{120}', ['g1'], 'left')
  })

  it('returns [] when backend raises', async () => {
    const big = makeBigGroup(120, ['g0'])
    mockFetchFunctions.fetchCayleyEdges.mockRejectedValue(new Error('boom'))
    expect(await fetchBackendCayleyEdges(big, ['g0'], 'right')).toEqual([])
  })
})

describe('fetchBackendElementOrder', () => {
  it('computes local cyclic order for small groups', async () => {
    const c6 = createCyclicGroup(6)
    const res = await fetchBackendElementOrder(c6, 'e2')
    expect(res?.order).toBe(3)
    expect(res?.cycle).toHaveLength(3)
  })

  it('returns null for unknown element locally', async () => {
    const c6 = createCyclicGroup(6)
    expect(await fetchBackendElementOrder(c6, 'nope')).toBeNull()
  })

  it('maps backend element order for large groups', async () => {
    const big = makeBigGroup(120, ['g0', 'g1'])
    mockFetchFunctions.fetchElementOrder.mockResolvedValue({
      element_id: 'g1', element_label: 'x', order: 10,
      cycle: [{ id: 'g1', label: 'x', value: [1] }, { id: 'g0', label: 'g0', value: [0] }],
    })
    const res = await fetchBackendElementOrder(big, 'g1')
    expect(res?.order).toBe(10)
    expect(res?.cycle?.map(e => e.id)).toEqual(['g1', 'g0'])
  })

  it('returns null when backend raises and element unknown', async () => {
    const big = makeBigGroup(120, ['g0'])
    mockFetchFunctions.fetchElementOrder.mockRejectedValue(new Error('boom'))
    expect(await fetchBackendElementOrder(big, 'g9')).toBeNull()
  })
})
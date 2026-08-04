import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchGroupInfo,
  fetchSubgroups,
  fetchNormalSubgroups,
  fetchConjugacyClasses,
  fetchCenter,
  fetchCosets,
  fetchLattice,
  fetchCayleyEdges,
  fetchElementOrder,
  fetchDirectProduct,
  fetchHealth,
} from '../utils/api'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockFetchOk(json: unknown) {
  const res = {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(json),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
  return fetch as unknown as ReturnType<typeof vi.fn>
}

function mockFetchError(status: number, statusText: string, body?: object) {
  const json = body
    ? vi.fn().mockResolvedValue(body)
    : vi.fn().mockRejectedValue(new Error('no body'))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json,
  }))
}

describe('api client', () => {
  it('fetchGroupInfo posts symbol to /group-info', async () => {
    const data = { symbol: 'S_{3}', name: '', order: 6, is_abelian: false, exponent: null, elements: [], generators: [] }
    const fn = mockFetchOk(data)
    const res = await fetchGroupInfo('S_{3}')
    expect(res).toEqual(data)
    expect(fn).toHaveBeenCalledWith('/api/group-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'S_{3}' }),
    })
  })

  it('fetchSubgroups posts symbol', async () => {
    const fn = mockFetchOk({ subgroups: [], total_count: 0 })
    await fetchSubgroups('C_{6}')
    expect(fn).toHaveBeenCalledWith('/api/compute/subgroups', expect.objectContaining({
      body: JSON.stringify({ symbol: 'C_{6}' }),
    }))
  })

  it('fetchNormalSubgroups posts symbol', async () => {
    const fn = mockFetchOk({ subgroups: [], total_count: 0 })
    await fetchNormalSubgroups('C_{6}')
    expect(fn).toHaveBeenCalledWith('/api/compute/normal-subgroups', expect.anything())
  })

  it('fetchConjugacyClasses posts symbol', async () => {
    const fn = mockFetchOk({ classes: [] })
    await fetchConjugacyClasses('C_{6}')
    expect(fn).toHaveBeenCalledWith('/api/compute/conjugacy-classes', expect.objectContaining({
      body: JSON.stringify({ symbol: 'C_{6}' }),
    }))
  })

  it('fetchCenter posts symbol', async () => {
    const fn = mockFetchOk({ center: [] })
    await fetchCenter('C_{6}')
    expect(fn).toHaveBeenCalledWith('/api/compute/center', expect.anything())
  })

  it('fetchCosets sends subgroup element ids', async () => {
    const fn = mockFetchOk({ left_cosets: [], right_cosets: [], is_normal: true, num_cosets: 2 })
    await fetchCosets('C_{6}', ['e0', 'e2', 'e4'])
    expect(fn).toHaveBeenCalledWith('/api/compute/cosets', expect.objectContaining({
      body: JSON.stringify({ symbol: 'C_{6}', subgroup_element_ids: ['e0', 'e2', 'e4'] }),
    }))
  })

  it('fetchLattice posts symbol', async () => {
    const fn = mockFetchOk({ nodes: [], edges: [] })
    await fetchLattice('C_{6}')
    expect(fn).toHaveBeenCalledWith('/api/compute/lattice', expect.anything())
  })

  it('fetchCayleyEdges defaults to right multiplication', async () => {
    const fn = mockFetchOk({ edges: [] })
    await fetchCayleyEdges('D_{6}', ['a', 'b'])
    expect(fn).toHaveBeenCalledWith('/api/compute/cayley-edges', expect.objectContaining({
      body: JSON.stringify({ symbol: 'D_{6}', action_element_ids: ['a', 'b'], multiply_type: 'right' }),
    }))
  })

  it('fetchCayleyEdges supports left multiplication', async () => {
    const fn = mockFetchOk({ edges: [] })
    await fetchCayleyEdges('D_{6}', ['a'], 'left')
    expect(fn).toHaveBeenCalledWith('/api/compute/cayley-edges', expect.objectContaining({
      body: JSON.stringify({ symbol: 'D_{6}', action_element_ids: ['a'], multiply_type: 'left' }),
    }))
  })

  it('fetchElementOrder posts symbol and element id', async () => {
    const fn = mockFetchOk({ element_id: 'e1', element_label: '1', order: 3, cycle: [] })
    await fetchElementOrder('C_{6}', 'e1')
    expect(fn).toHaveBeenCalledWith('/api/compute/element-order', expect.objectContaining({
      body: JSON.stringify({ symbol: 'C_{6}', element_id: 'e1' }),
    }))
  })

  it('fetchDirectProduct posts both symbols', async () => {
    const fn = mockFetchOk({ symbol: 'C_{2}\\times C_{3}', name: '', order: 6, is_abelian: true, exponent: 6, elements: [], generators: [] })
    await fetchDirectProduct('C_{2}', 'C_{3}')
    expect(fn).toHaveBeenCalledWith('/api/compute/direct-product', expect.objectContaining({
      body: JSON.stringify({ symbol_a: 'C_{2}', symbol_b: 'C_{3}' }),
    }))
  })

  it('fetchHealth issues a plain GET', async () => {
    const fn = mockFetchOk({ status: 'ok', cached_groups: 3 })
    const res = await fetchHealth()
    expect(res).toEqual({ status: 'ok', cached_groups: 3 })
    expect(fn).toHaveBeenCalledWith('/api/health')
  })

  it('throws the detail message from an error response', async () => {
    mockFetchError(500, 'Internal Server Error', { detail: 'group too large' })
    await expect(fetchGroupInfo('X')).rejects.toThrow('group too large')
  })

  it('falls back to status text when error body has no detail', async () => {
    mockFetchError(503, 'Service Unavailable', undefined)
    await expect(fetchGroupInfo('X')).rejects.toThrow('Service Unavailable')
  })
})
import { describe, it, expect } from 'vitest'
import {
  getAllSmallGroups,
  getSmallGroup,
  getSmallGroupBySymbol,
  getPrecomputed,
} from '../core/groups/SmallGroups'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { getGroupCenter, isSimpleGroup } from '../core/algebra/subgroups'

function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

describe('SmallGroups registry', () => {
  it('contains all groups of order < 16', () => {
    const all = getAllSmallGroups()
    // 27 entries: 1,2,3,4x2,5,6x2,7,8x5,9x2,10x2,11,12x4,13,14x2,15
    expect(all.length).toBe(27)
    const orders = all.map(e => e.order)
    for (let o = 1; o < 16; o++) {
      expect(orders).toContain(o)
    }
  })

  it('every entry has unique symbol', () => {
    const all = getAllSmallGroups()
    const symbols = all.map(e => e.group.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
  })

  it('getSmallGroup returns expected groups by (order, index)', () => {
    expect(getSmallGroup(4, 0)!.group.symbol).toBe('C_{4}')
    expect(getSmallGroup(4, 1)!.group.symbol).toBe('V_{4}')
    expect(getSmallGroup(6, 0)!.group.symbol).toBe('C_{6}')
    expect(getSmallGroup(6, 1)!.group.symbol).toBe('S_{3}')
    expect(getSmallGroup(8, 4)!.group.symbol).toBe('Q_{8}')
    expect(getSmallGroup(12, 3)!.group.symbol).toBe('A_{4}')
  })

  it('getSmallGroup returns null for out-of-range index', () => {
    expect(getSmallGroup(4, 5)).toBeNull()
    expect(getSmallGroup(999)).toBeNull()
  })

  it('getSmallGroupBySymbol finds entries', () => {
    expect(getSmallGroupBySymbol('S_{3}')!.order).toBe(6)
    expect(getSmallGroupBySymbol('Q_{8}')!.order).toBe(8)
    expect(getSmallGroupBySymbol('Z_{2}^{3}')!.order).toBe(8)
    expect(getSmallGroupBySymbol('Z_{3}^{2}')!.order).toBe(9)
    expect(getSmallGroupBySymbol('Z_{6}\\times Z_{2}')!.order).toBe(12)
  })

  it('getSmallGroupBySymbol returns null for unknown symbol', () => {
    expect(getSmallGroupBySymbol('X_{7}')).toBeNull()
  })

  it('getPrecomputed matches a group instance by symbol', () => {
    const S3 = createS3()
    const pre = getPrecomputed(S3)
    expect(pre).not.toBeNull()
    expect(pre!.subgroups.some(s => s.order === 3)).toBe(true)
    expect(pre!.normalSubgroups.some(s => s.order === 3)).toBe(true)
    expect(pre!.isSimple).toBe(false)
  })

  it('getPrecomputed returns null for unregistered groups', () => {
    const A = createS3()
    const B = createS3()
    const DP = createDirectProduct(A, B)
    expect(getPrecomputed(DP)).toBeNull()
  })

  it('precomputed subgroup orders satisfy Lagrange', () => {
    for (const entry of getAllSmallGroups()) {
      for (const sub of entry.precomputed.subgroups) {
        expect(entry.group.order % sub.order).toBe(0)
      }
    }
  })

  it('simplicity matches primality of order for orders < 16', () => {
    for (const entry of getAllSmallGroups()) {
      expect(entry.precomputed.isSimple).toBe(isPrime(entry.order))
      expect(entry.precomputed.isSimple).toBe(isSimpleGroup(entry.group))
    }
  })

  it('precomputed center matches getGroupCenter', () => {
    for (const entry of getAllSmallGroups()) {
      const centerIds = new Set(entry.precomputed.center.map(e => e.id))
      const computed = getGroupCenter(entry.group)
      expect(computed.length).toBe(centerIds.size)
      for (const c of computed) expect(centerIds.has(c.id)).toBe(true)
    }
  })

  it('precomputed conjugacy classes partition the group', () => {
    for (const entry of getAllSmallGroups()) {
      const ids = new Set(entry.precomputed.conjugacyClasses.flatMap(c => c.map(e => e.id)))
      expect(ids.size).toBe(entry.group.order)
    }
  })
})

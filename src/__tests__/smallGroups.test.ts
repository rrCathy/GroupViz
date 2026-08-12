import { describe, it, expect } from 'vitest'
import {
  getAllSmallGroups,
  getSmallGroup,
  getSmallGroupBySymbol,
  getPrecomputed,
} from '../core/groups/SmallGroups'
import { SMALL_GROUP_DATA } from '../core/groups/smallGroupData'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { getGroupCenter, isSimpleGroup } from '../core/algebra/subgroups'
import { createGroupFromSymbol } from '../utils/groupFactory'
import { buildOrderGroupsMap } from '../components/Panels/constants'

function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

// Number of groups of each order 1..31 (GAP NrSmallGroups)
const EXPECTED_COUNTS: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 6: 2, 7: 1, 8: 5, 9: 2, 10: 2, 11: 1, 12: 5,
  13: 1, 14: 2, 15: 1, 16: 14, 17: 1, 18: 5, 19: 1, 20: 5, 21: 2, 22: 2,
  23: 1, 24: 15, 25: 2, 26: 2, 27: 5, 28: 4, 29: 1, 30: 4, 31: 1
}

describe('SmallGroups registry', () => {
  it('contains all groups of order < 32', () => {
    const all = getAllSmallGroups()
    expect(all.length).toBe(93)
    for (let o = 1; o <= 31; o++) {
      const count = all.filter(e => e.order === o).length
      expect(count).toBe(EXPECTED_COUNTS[o])
    }
  })

  it('registry covers every GAP SmallGroup(1..31,i) data record', () => {
    for (const rec of SMALL_GROUP_DATA) {
      const entry = getSmallGroup(rec.n, rec.i - 1)
      expect(entry, `SmallGroup(${rec.n},${rec.i})`).not.toBeNull()
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

  it('Dic3 (GAP 12,4) is registered with its own symbol', () => {
    const entry = getSmallGroup(12, 4)!
    expect(entry.group.symbol).toBe('C_{3}:C_{4}')
    expect(entry.group.order).toBe(12)
    expect(entry.group.isAbelian).toBe(false)
  })

  it('Dic3 element orders match C3:C4 (one involution, six order-4)', () => {
    const group = getSmallGroup(12, 4)!.group
    const id = group.identity
    const counts: Record<number, number> = {}
    for (const el of group.elements) {
      if (el.id === id.id) continue
      let cur = el
      let k = 1
      while (cur.id !== id.id) {
        cur = group.multiply(cur, el)
        k++
      }
      counts[k] = (counts[k] ?? 0) + 1
    }
    expect(counts[2]).toBe(1)
    expect(counts[4]).toBe(6)
    expect(counts[3]).toBe(2)
    expect(counts[6]).toBe(2)
  })

  it('orders 16-31 use GAP-derived TeX symbols', () => {
    expect(getSmallGroup(16, 0)!.group.symbol).toBe('C_{16}')
    expect(getSmallGroup(16, 1)!.group.symbol).toBe('C_{4}\\times C_{4}')
    expect(getSmallGroup(16, 6)!.group.symbol).toBe('D_{8}')
    expect(getSmallGroup(16, 8)!.group.symbol).toBe('Q_{16}')
    expect(getSmallGroup(18, 0)!.group.symbol).toBe('D_{9}')
    expect(getSmallGroup(24, 11)!.group.symbol).toBe('S_{4}')
    expect(getSmallGroup(24, 2)!.group.symbol).toBe('SL(2,3)')
    expect(getSmallGroup(30, 0)!.group.symbol).toBe('C_{5}\\times S_{3}')
  })

  it('GAP structure-description collisions fall back to SmallGroup(n,i)', () => {
    expect(getSmallGroup(16, 2)!.group.symbol).toBe('(C_{4}\\times C_{2}):C_{2}')
    expect(getSmallGroup(16, 12)!.group.symbol).toBe('SmallGroup(16,13)')
    expect(getSmallGroup(20, 0)!.group.symbol).toBe('C_{5}:C_{4}')
    expect(getSmallGroup(20, 2)!.group.symbol).toBe('SmallGroup(20,3)')
  })

  it('getSmallGroup returns null for out-of-range index', () => {
    expect(getSmallGroup(4, 5)).toBeNull()
    expect(getSmallGroup(999)).toBeNull()
    expect(getSmallGroup(16, 14)).toBeNull()
  })

  it('getSmallGroupBySymbol finds entries', () => {
    expect(getSmallGroupBySymbol('S_{3}')!.order).toBe(6)
    expect(getSmallGroupBySymbol('Q_{8}')!.order).toBe(8)
    expect(getSmallGroupBySymbol('Z_{2}^{3}')!.order).toBe(8)
    expect(getSmallGroupBySymbol('Z_{3}^{2}')!.order).toBe(9)
    expect(getSmallGroupBySymbol('Z_{6}\\times Z_{2}')!.order).toBe(12)
    expect(getSmallGroupBySymbol('Z_{3}:C_{4}')!.order).toBe(12)
    expect(getSmallGroupBySymbol('D_{8}')!.order).toBe(16)
    expect(getSmallGroupBySymbol('SmallGroup(16,13)')!.order).toBe(16)
  })

  it('getSmallGroupBySymbol returns null for unknown symbol', () => {
    expect(getSmallGroupBySymbol('X_{7}')).toBeNull()
    expect(getSmallGroupBySymbol('D_{16}')).toBeNull()
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

  it('every table-driven group satisfies the group axioms', () => {
    for (const entry of getAllSmallGroups()) {
      const g = entry.group
      const id = g.identity
      const order = g.order
      // identity laws
      for (let a = 0; a < order; a++) {
        expect(g.multiply(id, g.elements[a]).id).toBe(g.elements[a].id)
        expect(g.multiply(g.elements[a], id).id).toBe(g.elements[a].id)
      }
      // inverses
      for (let a = 0; a < order; a++) {
        const inv = g.inverse(g.elements[a])
        expect(g.multiply(g.elements[a], inv).id).toBe(id.id)
        expect(g.multiply(inv, g.elements[a]).id).toBe(id.id)
      }
    }
    // Full associativity verified directly on the GAP multiplication tables
    // (table cells are 1-based positions; a,b,c are 0-based indices)
    for (const rec of SMALL_GROUP_DATA) {
      const t = rec.table
      for (let a = 0; a < rec.n; a++) {
        for (let b = 0; b < rec.n; b++) {
          for (let c = 0; c < rec.n; c++) {
            const ab = t[a][b] - 1
            const bc = t[b][c] - 1
            if (t[ab][c] !== t[a][bc]) {
              throw new Error(`associativity failed for SmallGroup(${rec.n},${rec.i}) at (${a},${b},${c})`)
            }
          }
        }
      }
    }
    // Spot-check associativity through the Group API
    for (const entry of getAllSmallGroups()) {
      const g = entry.group
      const order = g.order
      for (let k = 0; k < 30; k++) {
        const a = (k * 7 + 3) % order
        const b = (k * 5 + 1) % order
        const c = (k * 3 + 2) % order
        const ab = g.multiply(g.elements[a], g.elements[b])
        const bc = g.multiply(g.elements[b], g.elements[c])
        expect(g.multiply(ab, g.elements[c]).id).toBe(g.multiply(g.elements[a], bc).id)
      }
    }
    // generators generate the whole group
    for (const entry of getAllSmallGroups()) {
      const g = entry.group
      const id = g.identity
      const order = g.order
      const generated = new Set<string>([id.id])
      const frontier = [id.id]
      while (frontier.length > 0) {
        const curId = frontier.pop()!
        const cur = g.elements.find(e => e.id === curId)!
        for (const gen of g.generators) {
          const next = gen.apply(cur)
          if (!generated.has(next.id)) {
            generated.add(next.id)
            frontier.push(next.id)
          }
        }
      }
      expect(generated.size, `${g.symbol} generators`).toBe(order)
    }
  })

  it('precomputed subgroup orders satisfy Lagrange', () => {
    for (const entry of getAllSmallGroups()) {
      for (const sub of entry.precomputed.subgroups) {
        expect(entry.group.order % sub.order).toBe(0)
      }
    }
  })

  it('simplicity matches primality of order for orders < 32', () => {
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

describe('createGroupFromSymbol with GAP-derived symbols', () => {
  it('parses dihedral symbols for orders 16-30', () => {
    expect(createGroupFromSymbol('D_{8}')!.order).toBe(16)
    expect(createGroupFromSymbol('D_{9}')!.order).toBe(18)
    expect(createGroupFromSymbol('D_{13}')!.order).toBe(26)
    expect(createGroupFromSymbol('D_{15}')!.order).toBe(30)
  })

  it('parses registry symbols via fallback', () => {
    expect(createGroupFromSymbol('Z_{4}\\times Z_{4}')!.order).toBe(16)
    expect(createGroupFromSymbol('SL(2,3)')!.order).toBe(24)
    expect(createGroupFromSymbol('Z_{3}:C_{4}')!.order).toBe(12)
    expect(createGroupFromSymbol('SmallGroup(16,13)')!.order).toBe(16)
  })

  it('returns null for unknown symbols', () => {
    expect(createGroupFromSymbol('D_{16}')).toBeNull()
    expect(createGroupFromSymbol('X_{7}')).toBeNull()
  })
})

describe('buildOrderGroupsMap (order-based creation panel)', () => {
  it('covers every order 1..31 plus A_5 (60) and S_5 (120)', () => {
    const map = buildOrderGroupsMap(k => k)
    const orders = [...map.keys()].sort((a, b) => a - b)
    for (let n = 1; n <= 31; n++) expect(orders).toContain(n)
    expect(orders).toContain(60)
    expect(orders).toContain(120)
    const a5 = map.get(60)!
    expect(a5.some(e => e.symbol === 'A_{5}')).toBe(true)
    const s5 = map.get(120)!
    expect(s5.some(e => e.symbol === 'S_{5}')).toBe(true)
  })

  it('lists all 14 groups of order 16 and keeps V4 at order 4', () => {
    const map = buildOrderGroupsMap(k => k)
    expect(map.get(16)!.length).toBe(14)
    expect(map.get(4)!.some(e => e.symbol === 'V_{4}')).toBe(true)
  })
})

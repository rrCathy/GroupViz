import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import {
  computeSubgroupSeries,
  computeChainFactors,
  enumerateCompositionSeries,
  isNormalSubgroupIn,
  SERIES_MAX_ORDER,
} from '../core/algebra/series'
import type { SubgroupSeries } from '../core/algebra/series'

function termOrders(series: SubgroupSeries | null): number[] {
  if (!series) return []
  return series.terms.map(t => t.length)
}

function factorOrders(series: ReturnType<typeof computeSubgroupSeries>): number[] {
  if (!series) return []
  return series.factors.map(f => f.order)
}

describe('Subgroup Series', () => {
  describe('isNormalSubgroupIn', () => {
    it('detects normality within the ambient group', () => {
      const s3 = createSymmetricGroup(3)
      const identity = s3.identity
      const transposition = s3.elements.find(e => e.id !== identity.id)!
      const singleton = [transposition]
      expect(isNormalSubgroupIn(s3, s3.elements, [identity])).toBe(true)
      expect(isNormalSubgroupIn(s3, s3.elements, singleton)).toBe(false)
    })
  })

  describe('derived series (normal series + solvability)', () => {
    it('S_3: [6,3,1] solvable, not nilpotent', () => {
      const series = computeSubgroupSeries(createSymmetricGroup(3), 'derived')!
      expect(termOrders(series)).toEqual([6, 3, 1])
      expect(series.solvable).toBe(true)
      expect(series.nilpotent).toBe(false)
      expect(series.reachesTrivial).toBe(true)
      expect(series.factors.map(f => f.label)).toEqual(['C_{2}', 'C_{3}'])
    })

    it('S_4: [24,12,4,1] solvable', () => {
      const series = computeSubgroupSeries(createSymmetricGroup(4), 'derived')!
      expect(termOrders(series)).toEqual([24, 12, 4, 1])
      expect(series.solvable).toBe(true)
      expect(series.reachesTrivial).toBe(true)
    })

    it('A_5: perfect, derived stabilizes at G, not solvable', () => {
      const series = computeSubgroupSeries(createAlternatingGroup(5), 'derived')!
      expect(termOrders(series)).toEqual([60, 1])
      expect(series.solvable).toBe(false)
      expect(series.reachesTrivial).toBe(false)
    })

    it('V_4: [4,1] solvable and nilpotent', () => {
      const series = computeSubgroupSeries(createKleinFour(), 'derived')!
      expect(termOrders(series)).toEqual([4, 1])
      expect(series.solvable).toBe(true)
      expect(series.nilpotent).toBe(true)
    })
  })

  describe('central series (upper/lower + nilpotence)', () => {
    it('Q_8: upper and lower central series both [8,2,1], nilpotent', () => {
      const upper = computeSubgroupSeries(createQuaternion(), 'upperCentral')!
      expect(termOrders(upper)).toEqual([8, 2, 1])
      expect(upper.reachesFull).toBe(true)
      expect(upper.nilpotent).toBe(true)
      const lower = computeSubgroupSeries(createQuaternion(), 'lowerCentral')!
      expect(termOrders(lower)).toEqual([8, 2, 1])
      expect(lower.reachesTrivial).toBe(true)
      expect(lower.nilpotent).toBe(true)
    })

    it('D_8: nilpotent, both central series reach the ends', () => {
      const upper = computeSubgroupSeries(createDihedralGroup(8), 'upperCentral')!
      expect(upper.reachesFull).toBe(true)
      expect(upper.nilpotent).toBe(true)
      expect(upper.factors[0].isAbelian).toBe(true)
      const lower = computeSubgroupSeries(createDihedralGroup(8), 'lowerCentral')!
      expect(lower.reachesTrivial).toBe(true)
      expect(lower.nilpotent).toBe(true)
    })

    it('D_12: not nilpotent, upper central stabilizes at Z∞ = ⟨r³⟩ (order 4)', () => {
      const upper = computeSubgroupSeries(createDihedralGroup(12), 'upperCentral')!
      expect(termOrders(upper)).toEqual([4, 2, 1])
      expect(upper.reachesFull).toBe(false)
      expect(upper.nilpotent).toBe(false)
      const lower = computeSubgroupSeries(createDihedralGroup(12), 'lowerCentral')!
      expect(lower.reachesTrivial).toBe(false)
      expect(lower.nilpotent).toBe(false)
    })

    it('S_3: upper central stabilizes at Z∞ = {e}, not nilpotent', () => {
      const upper = computeSubgroupSeries(createSymmetricGroup(3), 'upperCentral')!
      expect(termOrders(upper)).toEqual([1])
      expect(upper.reachesFull).toBe(false)
      expect(upper.nilpotent).toBe(false)
    })

    it('C_6: upper central reaches G immediately (abelian), nilpotent', () => {
      const upper = computeSubgroupSeries(createCyclicGroup(6), 'upperCentral')!
      expect(termOrders(upper)).toEqual([6, 1])
      expect(upper.reachesFull).toBe(true)
      expect(upper.nilpotent).toBe(true)
    })
  })

  describe('composition series and factors', () => {
    it('S_3: chain [6,3,1], factors C2, C3, unique', () => {
      const series = computeSubgroupSeries(createSymmetricGroup(3), 'composition')!
      expect(termOrders(series)).toEqual([6, 3, 1])
      expect(factorOrders(series)).toEqual([2, 3])
      expect(series.factors.every(f => f.isSimple)).toBe(true)
      expect(series.factors.map(f => f.label)).toEqual(['C_{2}', 'C_{3}'])
      expect(series.alternativeCount).toBe(1)
    })

    it('S_4: factors C2, C3, C2, C2 — 3 chains (Jordan–Hölder)', () => {
      const series = computeSubgroupSeries(createSymmetricGroup(4), 'composition')!
      expect(termOrders(series)).toEqual([24, 12, 4, 2, 1])
      expect(factorOrders(series)).toEqual([2, 3, 2, 2])
      expect(series.alternativeCount).toBe(3)
    })

    it('A_4: factors C3, C2, C2 — 3 chains', () => {
      const series = computeSubgroupSeries(createAlternatingGroup(4), 'composition')!
      expect(termOrders(series)).toEqual([12, 4, 2, 1])
      expect(factorOrders(series)).toEqual([3, 2, 2])
      expect(series.alternativeCount).toBe(3)
    })

    it('A_5: single factor A5 (simple, non-abelian, order 60)', () => {
      const series = computeSubgroupSeries(createAlternatingGroup(5), 'composition')!
      expect(termOrders(series)).toEqual([60, 1])
      expect(series.factors).toHaveLength(1)
      expect(series.factors[0]).toMatchObject({ order: 60, isAbelian: false, isSimple: true, label: 'A_5' })
      expect(series.solvable).toBe(false)
      expect(series.alternativeCount).toBe(1)
    })

    it('S_5: factors C2, A5', () => {
      const series = computeSubgroupSeries(createSymmetricGroup(5), 'composition')!
      expect(factorOrders(series)).toEqual([2, 60])
      expect(series.factors[1].label).toBe('A_5')
    }, 30000)

    it('C_12: canonical chain 12 ⊵ 6 ⊵ 3 ⊵ 1, factors 2,2,3 — 3 chains', () => {
      const series = computeSubgroupSeries(createCyclicGroup(12), 'composition')!
      expect(termOrders(series)).toEqual([12, 6, 3, 1])
      expect(factorOrders(series)).toEqual([2, 2, 3])
      expect(series.alternativeCount).toBe(3)
    })

    it('V_4: chain 4 ⊵ 2 ⊵ 1, factors C2,C2 — 3 chains', () => {
      const series = computeSubgroupSeries(createKleinFour(), 'composition')!
      expect(termOrders(series)).toEqual([4, 2, 1])
      expect(factorOrders(series)).toEqual([2, 2])
      expect(series.alternativeCount).toBe(3)
    })
  })

  describe('enumerateCompositionSeries', () => {
    it('V_4 has exactly 3 composition series', () => {
      const res = enumerateCompositionSeries(createKleinFour())!
      expect(res.truncated).toBe(false)
      expect(res.chains).toHaveLength(3)
      const orders = res.chains.map(c => c.map(t => t.length))
      orders.forEach(o => expect(o).toEqual([4, 2, 1]))
    })

    it('A_5 has exactly 1 composition series (itself)', () => {
      const res = enumerateCompositionSeries(createAlternatingGroup(5))!
      expect(res.chains).toHaveLength(1)
      expect(res.chains[0].map(t => t.length)).toEqual([60, 1])
    })

    it('D_8 has 15 composition series (C8 branch: 1, each V4 branch: 7)', () => {
      const res = enumerateCompositionSeries(createDihedralGroup(8))!
      expect(res.chains).toHaveLength(15)
    })
  })

  describe('guards', () => {
    it('returns null above SERIES_MAX_ORDER', () => {
      const big = createDirectProduct(createSymmetricGroup(5), createSymmetricGroup(3))
      expect(big.order).toBeGreaterThan(SERIES_MAX_ORDER)
      expect(computeSubgroupSeries(big, 'composition')).toBeNull()
      expect(computeSubgroupSeries(big, 'derived')).toBeNull()
      expect(enumerateCompositionSeries(big)).toBeNull()
    })
  })

  describe('computeChainFactors (alternative chains)', () => {
    it('S_5 unique composition chain: factors (A_5, C_2)', () => {
      const s5 = createSymmetricGroup(5)
      const res = enumerateCompositionSeries(s5)!
      expect(res.chains).toHaveLength(1)
      const chain = res.chains[0]
      expect(chain.map(t => t.length)).toEqual([120, 60, 1])
      const factors = computeChainFactors(s5, chain, true)
      expect(factors.map(f => f.order)).toEqual([2, 60])
      expect(factors[0].label).toBe('C_{2}')
      expect(factors[1].label).toBe('A_5')
      expect(factors[1].isSimple).toBe(true)
    }, 30000)

    it('D_8 alternative chain through two V4 terms: all factors C_2', () => {
      const d8 = createDihedralGroup(8)
      const res = enumerateCompositionSeries(d8)!
      const chain = res.chains.find(c =>
        c.length === 5 && c[1].length === 8 && c[2].length === 4 && c[3].length === 2
      )!
      const factors = computeChainFactors(d8, chain, true)
      expect(factors).toHaveLength(4)
      expect(factors.every(f => f.order === 2 && f.label === 'C_{2}' && f.isSimple && f.isAbelian)).toBe(true)
    })

    it('non-composition flag keeps A_4 factor label for order-12 quotient', () => {
      const s4 = createSymmetricGroup(4)
      const chain = enumerateCompositionSeries(s4)!.chains[0]
      const a4 = chain[1]
      const identity = s4.identity
      const factors = computeChainFactors(s4, [s4.elements, a4, [identity]], false)
      expect(factors.map(f => f.label)).toEqual(['C_{2}', 'A_4'])
    })
  })

  describe('abelian factor labels (rank >= 3)', () => {
    it('C_2^4 upper-central factor gets exact invariant-chain label (was C_2 x C_8)', () => {
      const v4 = createKleinFour()
      const c24 = createDirectProduct(v4, v4)
      const series = computeSubgroupSeries(c24, 'upperCentral')!
      const bigFactor = series.factors.find(f => f.order === 16)!
      expect(bigFactor.label).toBe('C_{2} \\times C_{2} \\times C_{2} \\times C_{2}')
    })

    it('C_4 x C_2^2 factor gets exact three-term chain label', () => {
      const g = createDirectProduct(createCyclicGroup(4), createKleinFour())
      const series = computeSubgroupSeries(g, 'upperCentral')!
      const bigFactor = series.factors.find(f => f.order === 16)!
      expect(bigFactor.label).toBe('C_{2} \\times C_{2} \\times C_{4}')
    })

    it('cyclic quotients still get the plain C_n label', () => {
      const c6 = createCyclicGroup(6)
      const series = computeSubgroupSeries(c6, 'upperCentral')!
      expect(series.factors.map(f => f.label)).toEqual(['C_{6}'])
    })
  })
})

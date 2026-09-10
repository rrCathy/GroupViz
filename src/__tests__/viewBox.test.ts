import { describe, it, expect } from 'vitest'
import { getViewBoxSize, isTooLarge, sizeLimitFor } from '../core/viewBox'

describe('getViewBoxSize', () => {
  it('table view clamps cell grid and pads', () => {
    const size = getViewBoxSize(5, 'table')
    expect(size.width).toBeGreaterThanOrEqual(400)
    expect(size.width).toBe(size.height)
    // 20 cells max: 20*52 + 120 + 60 = 1220, clamped into [400,1800]
    const big = getViewBoxSize(30, 'table')
    expect(big.width).toBe(1220)
  })

  it('table view never exceeds the clamp', () => {
    const size = getViewBoxSize(200, 'table')
    expect(size.width).toBeLessThanOrEqual(1800)
    expect(size.width).toBeGreaterThanOrEqual(400)
  })

  it('sublattice is always 2000x2000', () => {
    expect(getViewBoxSize(64, 'sublattice')).toEqual({ width: 2000, height: 2000 })
  })

  it('small groups up to order 16 get 2000', () => {
    expect(getViewBoxSize(4, 'cayley')).toEqual({ width: 2000, height: 2000 })
    expect(getViewBoxSize(16, 'cayley')).toEqual({ width: 2000, height: 2000 })
  })

  it('groups up to order 30 get 3000', () => {
    expect(getViewBoxSize(17, 'cayley')).toEqual({ width: 3000, height: 3000 })
    expect(getViewBoxSize(30, 'cayley')).toEqual({ width: 3000, height: 3000 })
  })

  it('force layout scales beyond 3000 for large orders', () => {
    const size = getViewBoxSize(100, 'cayley', true)
    expect(size.width).toBe(Math.max(3000, 100 * 70 + 400))
  })

  it('default (non-force) caps at 3000', () => {
    expect(getViewBoxSize(100, 'cayley')).toEqual({ width: 3000, height: 3000 })
  })
})

describe('isTooLarge', () => {
  it('enforces per-view thresholds', () => {
    expect(isTooLarge(100, 'table')).toBe(false)
    expect(isTooLarge(101, 'table')).toBe(true)
    expect(isTooLarge(120, 'symmetry')).toBe(false)
    expect(isTooLarge(121, 'symmetry')).toBe(true)
    expect(isTooLarge(100, '3d')).toBe(false)
    expect(isTooLarge(101, '3d')).toBe(true)
    expect(isTooLarge(100, 'cayley')).toBe(false)
    expect(isTooLarge(101, 'cayley')).toBe(true)
    expect(isTooLarge(120, 'sublattice')).toBe(false)
    expect(isTooLarge(121, 'sublattice')).toBe(true)
  })

  it('tree 视图永不判过大；heatmap / sylow 放宽到 240', () => {
    expect(isTooLarge(10000, 'tree')).toBe(false)
    expect(isTooLarge(240, 'heatmap')).toBe(false)
    expect(isTooLarge(241, 'heatmap')).toBe(true)
    expect(isTooLarge(240, 'sylow')).toBe(false)
    expect(isTooLarge(241, 'sylow')).toBe(true)
  })

  it('第三参可覆盖阈值（嵌入方放开 / 收紧限制）', () => {
    expect(isTooLarge(150, 'table')).toBe(true)
    expect(isTooLarge(150, 'table', 200)).toBe(false)
    expect(isTooLarge(150, 'table', 100)).toBe(true)
    // 阈值取严格大于：等于阈值不算过大
    expect(isTooLarge(200, 'table', 200)).toBe(false)
    // 显式 Infinity = 彻底放开
    expect(isTooLarge(9999, 'table', Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('sizeLimitFor', () => {
  it('暴露各视图默认阈值（供宿主读取 / 二次判断）', () => {
    expect(sizeLimitFor('table')).toBe(100)
    expect(sizeLimitFor('prestable')).toBe(100)
    expect(sizeLimitFor('heatmap')).toBe(240)
    expect(sizeLimitFor('sylow')).toBe(240)
    expect(sizeLimitFor('symmetry')).toBe(120)
    expect(sizeLimitFor('sublattice')).toBe(120)
    expect(sizeLimitFor('action')).toBe(120)
    expect(sizeLimitFor('3d')).toBe(100)
    expect(sizeLimitFor('cayley')).toBe(100)
    expect(sizeLimitFor('tree')).toBe(Number.POSITIVE_INFINITY)
  })

  it('与 isTooLarge 缺省行为一致', () => {
    for (const view of ['table', 'heatmap', 'symmetry', 'sylow', '3d', 'cayley', 'action', 'sublattice'] as const) {
      const limit = sizeLimitFor(view)
      expect(isTooLarge(limit, view)).toBe(false)
      expect(isTooLarge(limit + 1, view)).toBe(true)
    }
  })
})
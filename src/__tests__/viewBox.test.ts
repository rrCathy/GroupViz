import { describe, it, expect } from 'vitest'
import { getViewBoxSize, isTooLarge, sizeLimitFor } from '../core/viewBox'
import { STATIC_LIMIT, ENUMERATION_LIMIT, RENDER_3D_LIMIT } from '../core/guards'

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
  it('per-view thresholds 引用 guards 三条实测线（口径锁定，防再漂移）', () => {
    // 图形类 → 静态可用线 STATIC_LIMIT（240 阶静态 60fps，交互会卡但可看）
    expect(sizeLimitFor('table')).toBe(STATIC_LIMIT)
    expect(sizeLimitFor('prestable')).toBe(STATIC_LIMIT)
    expect(sizeLimitFor('heatmap')).toBe(STATIC_LIMIT)
    expect(sizeLimitFor('cayley')).toBe(STATIC_LIMIT)
    expect(sizeLimitFor('set')).toBe(STATIC_LIMIT)
    expect(sizeLimitFor('cycle')).toBe(STATIC_LIMIT)
    // 3D → canvas DOM 恒定，S₆(720) 实测可用
    expect(sizeLimitFor('3d')).toBe(RENDER_3D_LIMIT)
    // 子群枚举类 → 枚举 2 秒线（144 阶 1.81s，168 阶 3.45s）
    expect(sizeLimitFor('sylow')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('symmetry')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('sublattice')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('action')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('homomorphism')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('cosetstrip')).toBe(ENUMERATION_LIMIT)
    expect(sizeLimitFor('tree')).toBe(Number.POSITIVE_INFINITY)
  })

  it('边界取严格大于：等于阈值不算过大', () => {
    expect(isTooLarge(STATIC_LIMIT, 'table')).toBe(false)
    expect(isTooLarge(STATIC_LIMIT + 1, 'table')).toBe(true)
    expect(isTooLarge(RENDER_3D_LIMIT, '3d')).toBe(false)
    expect(isTooLarge(RENDER_3D_LIMIT + 1, '3d')).toBe(true)
    expect(isTooLarge(ENUMERATION_LIMIT, 'sublattice')).toBe(false)
    expect(isTooLarge(ENUMERATION_LIMIT + 1, 'sublattice')).toBe(true)
    // 旧口径回归：101 阶 table / 121 阶 3d 在新口径下都应正常显示
    expect(isTooLarge(101, 'table')).toBe(false)
    expect(isTooLarge(101, '3d')).toBe(false)
  })

  it('tree 视图永不判过大', () => {
    expect(isTooLarge(10000, 'tree')).toBe(false)
  })

  it('第三参可覆盖阈值（嵌入方放开 / 收紧限制）', () => {
    expect(isTooLarge(150, 'table', 100)).toBe(true)
    expect(isTooLarge(150, 'table', 200)).toBe(false)
    // 阈值取严格大于：等于阈值不算过大
    expect(isTooLarge(200, 'table', 200)).toBe(false)
    // 显式 Infinity = 彻底放开
    expect(isTooLarge(9999, 'table', Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('sizeLimitFor', () => {
  it('与 isTooLarge 缺省行为一致', () => {
    for (const view of ['table', 'heatmap', 'symmetry', 'sylow', '3d', 'cayley', 'action', 'sublattice'] as const) {
      const limit = sizeLimitFor(view)
      expect(isTooLarge(limit, view)).toBe(false)
      expect(isTooLarge(limit + 1, view)).toBe(true)
    }
  })
})
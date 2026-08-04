import { describe, it, expect } from 'vitest'
import { getViewBoxSize, isTooLarge } from '../core/viewBox'

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
})
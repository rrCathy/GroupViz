import { describe, it, expect } from 'vitest'
import { compute3DPositions } from '../core/algebra/layout3D'
import { getSmallGroup, getSmallGroupBySymbol, getAllSmallGroups } from '../core/groups/SmallGroups'
import type { Group } from '../core/types'

/** 注册表群按 order + symbol 子串定位（FACTORIES 顺序与 GAP 编号不完全一致） */
function registryGroup(order: number, symbolPart: string): Group {
  const entry = getAllSmallGroups().find(e => e.order === order && e.group.symbol.includes(symbolPart))
  expect(entry).toBeTruthy()
  return entry!.group
}

function mockGroup(n: number, idPrefix = 'x'): Group {
  return {
    symbol: `M_{${n}}`,
    order: n,
    identity: { id: idPrefix + '0', label: '', value: [] },
    elements: Array.from({ length: n }, (_, i) => ({ id: idPrefix + i, label: '', value: [] })),
  } as unknown as Group
}

describe('compute3DPositions', () => {
  it('fills every position for a plain group on a sphere', () => {
    const group = mockGroup(10)
    const pos = compute3DPositions(group, 'spherical')
    expect(pos).toHaveLength(10)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(p).toHaveLength(3)
    }
  })

  it('fills every position even when element ids do not match the canonical permutation format', () => {
    const group = mockGroup(24, 'x')
    const pos = compute3DPositions(group, 'rhombicuboctahedron')
    expect(pos).toHaveLength(24)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
  })

  it('fills every position for a 60-element group on a truncated dodecahedron', () => {
    const group = mockGroup(60, 'y')
    const pos = compute3DPositions(group, 'truncatedDodecahedron')
    expect(pos).toHaveLength(60)
    for (const p of pos) {
      expect(p).toBeDefined()
    }
  })

  it('returns distinct positions (not all coincident)', () => {
    const group = mockGroup(12)
    const pos = compute3DPositions(group, 'lattice')
    expect(pos).toHaveLength(12)
    const distinct = new Set(pos.map(p => p.join(',')))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('fills every position for Dic3 as a semidirect cylinder (4 layers x 3)', () => {
    const group = getSmallGroup(12, 4)!.group
    const pos = compute3DPositions(group, 'semidirectCylinder')
    expect(pos).toHaveLength(12)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
    const layers = new Set(pos.map(p => Math.round(p[1] * 100)))
    expect(layers.size).toBe(4)
    const ringR = new Set(pos.map(p => Math.round(Math.hypot(p[0], p[2]) * 100)))
    expect(ringR.size).toBe(1)
    const angles = new Set(pos.map(p => Math.round((Math.atan2(p[2], p[0]) * 180) / Math.PI)))
    expect(angles.size).toBe(12)
  })

  it('cylinder layout works for a registry mixed product (C3 x S3, 3 layers x 6)', () => {
    // 注册表索引为 0 基数组位置（GAP index - 1）：C3×S3 = GAP (18,3) → 位置 2
    const group = getSmallGroup(18, 2)!.group
    expect(group.symbol).toContain('C_{3}')
    const pos = compute3DPositions(group, 'cylinder')
    expect(pos).toHaveLength(18)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
    const layers = new Set(pos.map(p => Math.round(p[1] * 100)))
    expect(layers.size).toBe(3)
    const byLevel = new Map<number, number>()
    for (const p of pos) {
      const y = Math.round(p[1] * 100)
      byLevel.set(y, (byLevel.get(y) ?? 0) + 1)
    }
    for (const cnt of byLevel.values()) expect(cnt).toBe(6)
  })

  it('torus layout works for a registry order-16 group (cluster/table fallback)', () => {
    const group = getSmallGroup(16, 2)!.group
    const pos = compute3DPositions(group, 'torus')
    expect(pos).toHaveLength(16)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
  })

  it('fills every position for a registry S4 table group on truncatedCube (id fallback)', () => {
    // S4 = GAP (24,12) → 0 基位置 11
    const group = getSmallGroup(24, 11)!.group
    expect(group.symbol).toBe('S_{4}')
    const pos = compute3DPositions(group, 'truncatedCube')
    expect(pos).toHaveLength(24)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)
    }
  })

  it('dihedral layout splits registry D8 rotations/reflections radially', () => {
    const entry = getSmallGroupBySymbol('D_{8}') ?? getSmallGroup(16, 6)
    expect(entry).toBeTruthy()
    const group = entry!.group
    expect(group.symbol).toBe('D_{8}')
    const pos = compute3DPositions(group, 'dihedral')
    expect(pos).toHaveLength(16)
    const upper = pos.filter(p => p[1] > 0)
    const lower = pos.filter(p => p[1] < 0)
    expect(upper.length).toBe(8)
    expect(lower.length).toBe(8)
    const rU = new Set(upper.map(p => Math.hypot(p[0], p[2]).toFixed(3)))
    expect(rU.size).toBe(1)
  })

  it('lattice on registry abelian products is not a straight line (C4 x C4)', () => {
    const group = registryGroup(16, 'C_{4}\\times C_{4}')
    const pos = compute3DPositions(group, 'lattice')
    expect(pos).toHaveLength(16)
    // 至少 2 个非平凡维度（旧实现 value 单维 → 1 轴直线）
    const dims = [0, 1, 2].map(d => new Set(pos.map(p => p[d].toFixed(3))).size)
    expect(dims.filter(s => s > 1).length).toBeGreaterThanOrEqual(2)
  })

  it('lattice on registry abelian products is not a straight line (C8 x C2)', () => {
    const group = registryGroup(16, 'C_{8}\\times C_{2}')
    const pos = compute3DPositions(group, 'lattice')
    expect(pos).toHaveLength(16)
    const dims = [0, 1, 2].map(d => new Set(pos.map(p => p[d].toFixed(3))).size)
    expect(dims.filter(s => s > 1).length).toBeGreaterThanOrEqual(2)
  })

  it('lattice on elementary abelian C2^4 is a 3D box (not a line)', () => {
    // C₂⁴ = order 16 全元素阶 2 的群（唯一）
    const c24 = getAllSmallGroups().find(e =>
      e.order === 16 && e.group.elements.every(el => e.group.multiply(el, el).id === e.group.identity.id)
    )
    expect(c24).toBeTruthy()
    const pos = compute3DPositions(c24!.group, 'lattice')
    expect(pos).toHaveLength(16)
    expect(pos.every(p => p !== undefined)).toBe(true)
    const dims = [0, 1, 2].map(d => new Set(pos.map(p => p[d].toFixed(3))).size)
    // 4×2×2 长方体：3 个非平凡维度
    expect(dims.filter(s => s > 1).length).toBe(3)
  })
})

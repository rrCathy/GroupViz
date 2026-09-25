import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import {
  conjugacyClassColor,
  conjugacyClassIndexMap,
  conjugacyClassCount,
  cyclicSubgroupElements,
  centerElementIds,
  smallestNormalSubgroupIds,
  elementOrderMap,
} from '../core/algebra/nodeSemantics'

const C6 = createCyclicGroup(6)
const S3 = createSymmetricGroup(3)

const el = (group: ReturnType<typeof createCyclicGroup>, id: string) =>
  group.elements.find(e => e.id === id)!

describe('nodeSemantics · 共轭类（VCL F1）', () => {
  it('splits S₃ into 3 classes (identity / transpositions / 3-cycles)', () => {
    expect(conjugacyClassCount(S3)).toBe(3)
    const idx = conjugacyClassIndexMap(S3)
    expect(idx.size).toBe(S3.order)
    // 单位元独占一类
    const identityClass = idx.get(S3.identity.id)!
    expect([...idx.values()].filter(v => v === identityClass)).toHaveLength(1)
    // 三个对换同类、两个 3-轮换同类
    const sizes = new Map<number, number>()
    for (const v of idx.values()) sizes.set(v, (sizes.get(v) ?? 0) + 1)
    expect([...sizes.values()].sort()).toEqual([1, 2, 3])
  })

  it('abelian groups degenerate to singleton classes (mathematical fact, not a bug)', () => {
    expect(conjugacyClassCount(C6)).toBe(6)
    const idx = conjugacyClassIndexMap(C6)
    expect(new Set(idx.values()).size).toBe(6)
  })

  it('is deterministic across calls (preset-safe)', () => {
    const a = [...conjugacyClassIndexMap(S3).entries()].sort()
    const b = [...conjugacyClassIndexMap(S3).entries()].sort()
    expect(a).toEqual(b)
  })

  it('class palette gives one distinct colour per class and never divides by zero', () => {
    const colors = [0, 1, 2].map(i => conjugacyClassColor(i, 3))
    expect(new Set(colors).size).toBe(3)
    expect(conjugacyClassColor(0, 0)).toMatch(/^hsl\(/)
    expect(conjugacyClassColor(0, 0)).toBe(conjugacyClassColor(0, 0))
  })
})

describe('nodeSemantics · ⟨g⟩ 循环子群（VCL F3）', () => {
  it('lists powers in exponent order, starting at the identity', () => {
    expect(cyclicSubgroupElements(C6, el(C6, 'e2')).map(e => e.id)).toEqual(['e0', 'e2', 'e4'])
    expect(cyclicSubgroupElements(C6, el(C6, 'e3')).map(e => e.id)).toEqual(['e0', 'e3'])
  })

  it('size always equals the element order', () => {
    const orders = elementOrderMap(C6)
    for (const e of C6.elements) {
      expect(cyclicSubgroupElements(C6, e)).toHaveLength(orders.get(e.id)!)
    }
  })

  it('the identity generates the trivial subgroup', () => {
    expect(cyclicSubgroupElements(C6, C6.identity).map(e => e.id)).toEqual([C6.identity.id])
  })

  it('closes the loop: multiplying the last power by g returns the identity', () => {
    for (const e of C6.elements) {
      const cyc = cyclicSubgroupElements(C6, e)
      expect(C6.multiply(cyc[cyc.length - 1], e).id).toBe(C6.identity.id)
    }
  })
})

describe('nodeSemantics · 中心与最小正规子群（VCL F4）', () => {
  it('center: abelian ⇒ whole group, S₃ ⇒ {e}', () => {
    expect(centerElementIds(C6).size).toBe(6)
    expect([...centerElementIds(S3)]).toEqual([S3.identity.id])
  })

  it('center of D₄ is {e, r²}', () => {
    const d4 = createDihedralGroup(4)
    const center = centerElementIds(d4)
    expect(center.size).toBe(2)
    expect(center.has(d4.identity.id)).toBe(true)
  })

  it('smallest normal subgroup of S₃ is A₃ (identity + the two 3-cycles)', () => {
    const ids = smallestNormalSubgroupIds(S3)!
    expect(ids).toHaveLength(3)
    expect(ids).toContain(S3.identity.id)
    // 三个 3-轮换之一必在其中（A₃ = {e, (123), (132)}）
    expect(ids.filter(id => id !== S3.identity.id)).toHaveLength(2)
  })

  it('smallest normal subgroup of C₆ is its order-2 subgroup', () => {
    expect(smallestNormalSubgroupIds(C6)).toEqual(['e0', 'e3'])
  })

  it('returns null when there is no proper non-trivial normal subgroup', () => {
    // 素数阶循环群：无真非平凡子群
    expect(smallestNormalSubgroupIds(createCyclicGroup(5))).toBeNull()
    // 超枚举上限（> 144）：不枚举，直接 null（不抛错、不阻塞渲染）
    expect(smallestNormalSubgroupIds(createCyclicGroup(200))).toBeNull()
  })
})

describe('nodeSemantics · 元素阶（VCL F2）', () => {
  it('maps every element to its order', () => {
    const m = elementOrderMap(C6)
    expect([...m.entries()].sort()).toEqual([
      ['e0', 1], ['e1', 6], ['e2', 3], ['e3', 2], ['e4', 3], ['e5', 6],
    ])
  })

  it('covers exactly the group elements', () => {
    expect(elementOrderMap(S3).size).toBe(6)
  })
})

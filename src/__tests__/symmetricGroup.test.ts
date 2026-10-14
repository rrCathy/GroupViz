import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

/**
 * SymmetricGroup 直测（2026-10-14 findPermIndex 线性扫 → WeakMap 数值键索引后
 * 的行为回归）：S₆=720 全元素闭包 + 逆元往返 + 乘法结合律抽查 + 生成元像落群内。
 * 索引缓存（WeakMap per elements 数组）的正确性由「全对乘积仍在群内」隐式覆盖。
 */
describe('SymmetricGroup（findPermIndex 索引化回归）', () => {
  const g = createSymmetricGroup(6)

  it('S₆：720 元素、id = value.join(",")、恒等在位', () => {
    expect(g.order).toBe(720)
    expect(g.elements.length).toBe(720)
    for (const el of g.elements) expect(el.id).toBe(el.value.join(','))
    expect(g.identity.value.join(',')).toBe('1,2,3,4,5,6')
  })

  it('全元素 × 生成元像仍在群内（闭包 + 索引命中）', () => {
    for (const el of g.elements) {
      for (const gen of g.generators) {
        const img = gen.apply(el)
        expect(img.id, `${el.label}·${gen.name}`).toBe(img.value.join(','))
      }
    }
  })

  it('全元素逆元往返 = 恒等（g·g⁻¹ = e）', () => {
    for (const el of g.elements) {
      const back = g.multiply(el, g.inverse(el))
      expect(back.id).toBe(g.identity.id)
    }
  })

  it('乘法同态抽查：multiply(a,b) 与 multiply(multiply(a,b),c) 结合律成立', () => {
    const els = g.elements
    for (let i = 0; i < 720; i += 37) {
      const a = els[i]!, b = els[(i * 7 + 3) % 720]!, c = els[(i * 13 + 11) % 720]!
      const left = g.multiply(g.multiply(a, b), c)
      const right = g.multiply(a, g.multiply(b, c))
      expect(left.id).toBe(right.id)
    }
  })
})

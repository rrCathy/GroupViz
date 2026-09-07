import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { extendFromGenerators, verifyHomomorphism, getHomomorphismProperties } from '../core/algebra/homomorphisms'

// S4 → S3 满同态（核 = V4 = {e, (12)(34), (13)(24), (14)(23)}）：
// S4 作用在三条 2-2 划分 P1={12|34} P2={13|24} P3={14|23} 上诱导 S4 → S3（划分集合的置换），
// 商群同构 S4/V4 ≅ S3。生成元像自算并整体机器验证：(12) 交换 P2↔P3 → (23)∈S3；
// (1234) 交换 P1↔P3 → (13)∈S3。与 TestPage 的 test-homo-4to3 演示窗同一构造。
describe('S4→S3 满同态构造', () => {
  it('生成元映射扩展 24 元素 + 同态性 + 核=V4（4 双对换）+ 满射 Im=S3', () => {
    const s4 = createSymmetricGroup(4)
    const s3 = createSymmetricGroup(3)

    const srcById = new Map(s4.elements.map(e => [e.id, e]))
    const genByName = new Map(s4.generators.map(g => [g.name, srcById.get(g.apply(s4.identity).id)]))
    const findTgt = (v: number[]) => s3.elements.find(e => e.value.every((x, i) => x === v[i]))!

    const gm = new Map<string, string>()
    const s12 = genByName.get('s12')! // (12)
    const c = genByName.get('c')!     // (1234)
    expect(s12).toBeTruthy()
    expect(c).toBeTruthy()
    gm.set(s12.id, findTgt([1, 3, 2]).id) // φ(12) = (23)
    gm.set(c.id, findTgt([3, 2, 1]).id)   // φ(1234) = (13)

    const mapping = extendFromGenerators(s4, s3, gm)
    expect(mapping).not.toBeNull()
    expect(mapping!.size).toBe(24)

    const result = verifyHomomorphism(s4, s3, mapping!)
    expect(result.isHomomorphism).toBe(true)

    // 核恰为 V4（双对换闭包 4 元素）
    expect(result.kernel.length).toBe(4)
    const v4Values = new Set([
      [1, 2, 3, 4].join(','),
      [2, 1, 4, 3].join(','), // (12)(34)
      [3, 4, 1, 2].join(','), // (13)(24)
      [4, 3, 2, 1].join(','), // (14)(23)
    ])
    for (const kid of result.kernel) {
      expect(v4Values.has(kid)).toBe(true)
    }

    const props = getHomomorphismProperties(s4, s3, result)
    expect(props.isInjective).toBe(false)
    expect(props.isSurjective).toBe(true)
    expect(props.isIsomorphism).toBe(false)
    expect(props.imageOrder).toBe(6)
  })
})

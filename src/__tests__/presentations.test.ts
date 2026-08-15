import { describe, it, expect } from 'vitest'
import {
  buildGroupFromPresentation,
  formatPresentation,
  parsePresentation,
  parseWord,
  presentationOf,
  runToddCoxeter,
  simplifyWord,
  wordToCanonicalString,
} from '../core/algebra/presentations'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { getAllSmallGroups } from '../core/groups/SmallGroups'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createAutomorphismGroup } from '../core/algebra/automorphisms'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { computeQuotientGroup, findAllNormalSubgroups } from '../core/algebra/subgroups'
import { isGroupDirectProduct, isGroupPresentation, type Group, type GroupPresentation } from '../core/types'

// Evaluate a relator word using the presentation's generator elements.
function evaluateRelator(group: Group, pres: GroupPresentation, rel: string): string {
  const terms = parseWord(rel, pres.generators)
  const genEls = pres.generatorElements!
  let cur = group.identity
  for (const t of terms) {
    const base = t.e > 0 ? genEls[t.g] : group.inverse(genEls[t.g])
    for (let n = 0; n < Math.abs(t.e); n++) cur = group.multiply(cur, base)
  }
  return cur.id
}

describe('parseWord / simplifyWord / wordToCanonicalString', () => {
  const gens = ['a', 'b', '\\sigma_{1}', '\\sigma_{2}']

  it('parses and simplifies a simple word', () => {
    expect(parseWord('a b b a', ['a', 'b'])).toEqual([
      { g: 0, e: 1 },
      { g: 1, e: 2 },
      { g: 0, e: 1 },
    ])
  })

  it('supports exponents and negative exponents', () => {
    expect(parseWord('a^3 b^{-2}', ['a', 'b'])).toEqual([
      { g: 0, e: 3 },
      { g: 1, e: -2 },
    ])
  })

  it('supports Unicode superscripts (a², b³, a⁻¹)', () => {
    expect(parseWord('a²b³', ['a', 'b'])).toEqual([
      { g: 0, e: 2 },
      { g: 1, e: 3 },
    ])
    expect(parseWord('a⁻¹', ['a'])).toEqual([{ g: 0, e: -1 }])
    expect(parseWord('a⁰ b', ['a', 'b'])).toEqual([{ g: 1, e: 1 }])
    expect(parseWord('(ab)²', ['a', 'b'])).toEqual([
      { g: 0, e: 1 },
      { g: 1, e: 1 },
      { g: 0, e: 1 },
      { g: 1, e: 1 },
    ])
  })

  it('handles parenthesized groups with exponents', () => {
    expect(parseWord('(ab)^2', ['a', 'b'])).toEqual([
      { g: 0, e: 1 },
      { g: 1, e: 1 },
      { g: 0, e: 1 },
      { g: 1, e: 1 },
    ])
    expect(parseWord('(ab)^{-1}', ['a', 'b'])).toEqual([
      { g: 1, e: -1 },
      { g: 0, e: -1 },
    ])
  })

  it('cancels zero-exponent factors', () => {
    expect(parseWord('a^0 b', ['a', 'b'])).toEqual([{ g: 1, e: 1 }])
    expect(parseWord('a b^0 a^{-1}', ['a', 'b'])).toEqual([])
  })

  it('merges adjacent same-generator terms and drops zeros', () => {
    expect(simplifyWord([{ g: 0, e: 1 }, { g: 0, e: 2 }, { g: 1, e: 1 }])).toEqual([
      { g: 0, e: 3 },
      { g: 1, e: 1 },
    ])
    expect(simplifyWord([{ g: 0, e: 2 }, { g: 0, e: -2 }])).toEqual([])
  })

  it('rejects invalid characters and unbalanced parentheses', () => {
    expect(() => parseWord('a#', ['a'])).toThrow()
    expect(() => parseWord('(ab', ['a', 'b'])).toThrow()
    expect(() => parseWord('ab)', ['a', 'b'])).toThrow()
    expect(() => parseWord('a^{x}', ['a'])).toThrow()
  })

  it('matches multi-character generator symbols greedily', () => {
    expect(parseWord('\\sigma_{1}^{2}\\sigma_{2}', gens.slice(2))).toEqual([
      { g: 0, e: 2 },
      { g: 1, e: 1 },
    ])
  })

  it('formats canonical strings', () => {
    expect(wordToCanonicalString([{ g: 0, e: 1 }, { g: 1, e: 2 }, { g: 0, e: -1 }, { g: 1, e: 12 }], ['a', 'b']))
      .toBe('a b^2 a^{-1} b^{12}')
  })
})

describe('parsePresentation', () => {
  it('parses full angle-bracket syntax', () => {
    const p = parsePresentation('⟨a, b | a^3, b^2, abab = e⟩')
    expect(p).toEqual({ generators: ['a', 'b'], relators: ['a^3', 'b^2', 'abab'] })
  })

  it('parses semicolon syntax and plain text', () => {
    expect(parsePresentation('a; a^4')).toEqual({ generators: ['a'], relators: ['a^4'] })
    expect(parsePresentation('a, b | a^2, b^3')).toEqual({
      generators: ['a', 'b'],
      relators: ['a^2', 'b^3'],
    })
  })

  it('formats back to TeX', () => {
    expect(formatPresentation(['a', 'b'], ['a^2', 'b^3'])).toBe('\\langle a, b \\mid a^2, b^3 \\rangle')
  })
})

describe('runToddCoxeter', () => {
  it('enumerates finite groups', () => {
    const tc = runToddCoxeter(['a'], [[{ g: 0, e: 3 }]])
    expect(tc.status).toBe('finite')
    expect(tc.order).toBe(3)
  })

  it('detects infinite groups', () => {
    expect(runToddCoxeter(['a', 'b'], []).status).toBe('infinite')
    expect(runToddCoxeter(['a', 'b'], [[{ g: 0, e: 2 }]]).status).toBe('infinite')
  })

  it('detects Baumslag–Solitar overflow', () => {
    const bs = runToddCoxeter(
      ['a', 'b'],
      [[{ g: 0, e: 1 }, { g: 1, e: 1 }, { g: 0, e: -1 }, { g: 1, e: -2 }]],
    )
    expect(['overflow', 'infinite']).toContain(bs.status)
  })
})

describe('buildGroupFromPresentation', () => {
  it('builds C_4 from ⟨a | a^4⟩', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a | a^4⟩'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(4)
    expect(res.group!.isAbelian).toBe(true)
    expect(res.group!.isoSymbol).toBe('C_{4}')
    expect(res.group!.symbol).toContain('\\langle')
    expect(res.group!.exponent).toBe(4)
    const g = res.group!
    expect(g.multiply(g.identity, g.identity).id).toBe(g.identity.id)
    expect(g.inverse(g.multiply(g.generators[0].apply(g.identity), g.generators[0].apply(g.identity))).id)
      .toBe(g.generators[0].apply(g.generators[0].apply(g.identity)).id)
  })

  it('builds D_4 from ⟨r, s | r^4, s^2, srsr⟩', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨r, s | r^4, s^2, srsr⟩'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(8)
    expect(res.group!.isoSymbol).toBe('D_{4}')
    expect(res.group!.isAbelian).toBe(false)
  })

  it('builds V_4 from ⟨a, b | a^2, b^2, abab⟩', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^2, abab⟩'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(4)
    expect(res.group!.isoSymbol).toBe('C_{2}\\times C_{2}')
  })

  it('f1=f2 归一化 + Unicode 上标：⟨a, b | a²=e, b³=e, ab=ba⟩ 创建成功（C₂×C₃，阶 6）', () => {
    const res = buildGroupFromPresentation(parsePresentation('a, b | a²=e, b³=e, ab=ba'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(6)
    expect(res.group!.isAbelian).toBe(true)
  })

  it('f1=f2 归一化 + Unicode 上标：⟨a, b | a²=e, b²=e, ab=ba⟩ 创建成功（V₄，阶 4）', () => {
    const res = buildGroupFromPresentation(parsePresentation('a, b | a²=e, b²=e, ab=ba'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(4)
    expect(res.group!.isoSymbol).toBe('C_{2}\\times C_{2}')
  })

  it('builds S_3 from ⟨a, b | a^2, b^2, (ab)^3⟩', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^2, (ab)^3⟩'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(6)
    expect(res.group!.isoSymbol).toBe('D_{3}')
  })

  it('builds A_5 from ⟨a, b | a^2, b^3, (ab)^5⟩', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^3, (ab)^5⟩'))
    expect(res.ok).toBe(true)
    expect(res.order).toBe(60)
    expect(res.group!.isoSymbol).toBe('A_{5}')
  })

  it('reports infinite and overflow presentations', () => {
    expect(buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^3⟩')).reason).toBe('overflow')
    expect(buildGroupFromPresentation(parsePresentation('⟨a, b |⟩')).reason).toBe('infinite')
    expect(buildGroupFromPresentation(parsePresentation('⟨a, b | aba^{-1}b^{-2}⟩')).reason).toBe('overflow')
    expect(buildGroupFromPresentation(parsePresentation('⟨a | a^5x⟩')).reason).toBe('parse')
  })

  it('group operations are consistent (associativity spot check)', () => {
    const g = buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^3, (ab)^5⟩')).group!
    const [x, y, z] = [g.elements[1], g.elements[2], g.elements[5]]
    expect(g.multiply(g.multiply(x, y), z).id).toBe(g.multiply(x, g.multiply(y, z)).id)
    expect(g.multiply(g.inverse(x), x).id).toBe(g.identity.id)
  })

  it('presentation-built groups are not classified as direct products', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a | a^4⟩'))
    expect(isGroupDirectProduct(res.group!)).toBe(false)
    expect(isGroupPresentation(res.group!)).toBe(true)
  })
})

describe('presentationOf', () => {
  function expectPresentationValid(group: Group): GroupPresentation {
    const pres = presentationOf(group)
    expect(pres).not.toBeNull()
    expect(pres!.generatorElements!.length).toBe(pres!.generators.length)
    for (const rel of pres!.relators) {
      expect(evaluateRelator(group, pres!, rel)).toBe(group.identity.id)
    }
    const rebuilt = buildGroupFromPresentation({ ...pres!, generatorElements: undefined })
    expect(rebuilt.ok).toBe(true)
    expect(rebuilt.order).toBe(group.order)
    return pres!
  }

  it('recovers C_6', () => {
    expectPresentationValid(createCyclicGroup(6))
  })

  it('recovers D_4', () => {
    expectPresentationValid(createDihedralGroup(4))
  })

  it('recovers S_3 and S_5 via Coxeter presentation', () => {
    expectPresentationValid(createSymmetricGroup(3))
    expectPresentationValid(createSymmetricGroup(5))
  })

  it('recovers A_3, A_4, A_5', () => {
    expectPresentationValid(createAlternatingGroup(3))
    expectPresentationValid(createAlternatingGroup(4))
    expectPresentationValid(createAlternatingGroup(5))
  })

  it('recovers V_4 and Q_8', () => {
    expectPresentationValid(createKleinFour())
    expectPresentationValid(createQuaternion())
  })

  it('recovers Aut(Z_3) via discovery', () => {
    const aut = createAutomorphismGroup(createCyclicGroup(3))
    expect(aut).not.toBeNull()
    expectPresentationValid(aut!)
  })

  it('recovers a direct product via discovery', () => {
    expectPresentationValid(createDirectProduct(createCyclicGroup(3), createCyclicGroup(2)))
  })

  it('combines factor presentations for S_3 x S_3', () => {
    const g = createDirectProduct(createSymmetricGroup(3), createSymmetricGroup(3))
    expect(g.order).toBe(36)
    const pres = presentationOf(g)
    expect(pres).not.toBeNull()
    expect(pres!.generators.length).toBe(4)
    expectPresentationValid(g)
    expect(pres!.relators.length).toBeGreaterThanOrEqual(10)
  })

  it('recovers a quotient group via discovery', () => {
    const g = createCyclicGroup(6)
    const normals = findAllNormalSubgroups(g)
    const order3 = normals.find(s => s.elements.length === 3)
    expect(order3).toBeDefined()
    const q = computeQuotientGroup(g, order3!)
    expect(q).not.toBeNull()
    expectPresentationValid(q!)
  })

  it('recovers QD_16 as the standard presentation ⟨a⁸, b², bab=a³⟩', () => {
    const entry = getAllSmallGroups().find(e => e.group.symbol === 'QD_{16}')
    expect(entry).toBeDefined()
    const pres = expectPresentationValid(entry!.group)
    // GAP 生成元 g1 阶 4（= 标准 a²）；标准展示按阶定位 a（阶 8）：
    // ⟨a⁸, b², bab=a³⟩，而非发现器给出的非标准 ⟨a⁴, b², (ba)⁴⟩
    const relText = pres.relators.join(' ')
    expect(relText).toContain('a^{8}')
    expect(relText).toContain('b^{2}')
    expect(relText).toContain('baba^{-3}')
    expect(pres.relators.length).toBeLessThanOrEqual(5)
  })

  it('reuses cached discovery results across group instances', () => {
    // Aut(Z_3) symbol 不匹配 S/A/C/D family 正则，必走发现器路径；
    // 两个独立实例共享缓存，且 generatorElements 按当前群重新求值
    const a = createAutomorphismGroup(createCyclicGroup(3))!
    const b = createAutomorphismGroup(createCyclicGroup(3))!
    const p1 = presentationOf(a)
    const p2 = presentationOf(b)
    expect(p1).not.toBeNull()
    expect(p2!.relators).toEqual(p1!.relators)
    expect(p2!.generatorElements!.length).toBe(b.generators.length)
  })

  it('returns the stored presentation unchanged', () => {
    const res = buildGroupFromPresentation(parsePresentation('⟨a, b | a^2, b^2, abab⟩'))
    const stored = presentationOf(res.group!)
    expect(stored).toEqual(res.group!.presentation)
    expect(stored!.generatorElements).toBeUndefined()
  })

  it('isGroupPresentation classification', () => {
    expect(isGroupPresentation(createCyclicGroup(6))).toBe(false)
    const built = buildGroupFromPresentation(parsePresentation('⟨a | a^4⟩'))
    expect(isGroupPresentation(built.group!)).toBe(true)
  })
})

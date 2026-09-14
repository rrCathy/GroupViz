import { describe, it, expect } from 'vitest'
import { parseNotation, getGroupAliases } from '../core/algebra/notationParser'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'

describe('群别名 · 解析（parseNotation）', () => {
  it('同一个群的多种写法都落到同一个规范符号（且全部走本地，不依赖后端）', () => {
    const groups: [number, string, string[]][] = [
      [36, 'S_{3}^{2}', ['S_3^2', 'S_3^{2}', 'S3xS3', 'S3xS3', 'S_3×S_3', 'S_3\\times S_3', 's3xs3']],
      [21, 'C_{7}:C_{3}', ['F21', 'F_{21}', 'F_21', 'Frobenius(21)', 'C7:C3', 'C_7:C_3', 'C7⋊C3', 'C_7\\rtimes C_3']],
      [4, 'C_{4}', ['C_4', 'C4', 'c4', 'Z_4', 'Z4', 'C{4}', 'C_{4}', 'Z/4Z']],
      [6, 'S_{3}', ['S_3', 'S3', 's3', 'Sym(3)', 'Symmetric(3)']],
      [8, 'D_{4}', ['D_4', 'D4', 'Dihedral(4)']],
      [16, 'QD_{16}', ['QD16', 'QD_{16}', 'qd16']],
      [8, 'Q_{8}', ['Q_8', 'Q8', 'Quaternion(8)']],
      [4, 'V_{4}', ['V_4', 'V4', 'Klein', 'K4', 'K_4']],
      [12, 'C_{3}:C_{4}', ['Dic_3', 'Dic3']],
      [60, 'A_{5}', ['A_5', 'A5', 'Alt(5)', 'Alternating(5)']],
    ]
    for (const [order, canonical, aliases] of groups) {
      for (const input of aliases) {
        const r = parseNotation(input)
        expect(r.ok, input).toBe(true)
        expect(r.order, input).toBe(order)
        expect(r.localSymbol, input).toBe(canonical)
        expect(r.gapExpr, input).toBeNull()
      }
    }
  })

  it('专名展开会说明「已按别名识别」', () => {
    const r = parseNotation('F21')
    expect(r.via).toContain('F_{21}')
    expect(r.hint).toContain('已按别名识别')
    expect(r.source).toBe('named')
  })

  it('标记来源：本地 / 专名 / 后端三档可区分', () => {
    expect(parseNotation('C_4').source).toBe('local')
    expect(parseNotation('F21').source).toBe('named')
    expect(parseNotation('PSL(2,7)').source).toBe('backend')
    expect(parseNotation('Aut(S_4)').source).toBe('backend')
  })

  it('F_n 无解或歧义时拒绝并给定向提示（不猜）', () => {
    // 42 阶不在注册表（1–31）覆盖范围内
    const noRing = parseNotation('F_42')
    expect(noRing.ok).toBe(false)
    expect(noRing.error).toBe('alias-ambiguous')
    expect(noRing.hint).toContain('注册表')

    // 16 阶有两个 C_p:C_q（C_{4}:C_{4} / C_{8}:C_{2}）→ 必须让用户指定
    const ambiguous = parseNotation('F_16')
    expect(ambiguous.ok).toBe(false)
    expect(ambiguous.error).toBe('alias-ambiguous')
    expect(ambiguous.hint).toContain('2 个候选')
  })

  it('Unicode 上下标被拒绝，并给出等价 TeX 写法（不静默给错群）', () => {
    const cases: [string, string][] = [
      ['C₄', '请改用 TeX 记号：C_{4}'],
      ['S₃', '请改用 TeX 记号：S_{3}'],
      // 这条最关键：旧实现会把 C_2² 吞成 C_{22}（22 阶）
      ['C_2²', '请改用 TeX 记号：C_{2}^{2}'],
      ['C₂²', '请改用 TeX 记号：C_{2}^{2}'],
    ]
    for (const [input, hint] of cases) {
      const r = parseNotation(input)
      expect(r.ok, input).toBe(false)
      expect(r.error, input).toBe('unicode-script')
      expect(r.hint, input).toBe(hint)
      expect(r.localSymbol, input).toBeNull()
    }
  })

  it('D_n 保持引擎约定（2n 阶）', () => {
    expect(parseNotation('D_4').order).toBe(8)
    expect(parseNotation('D_8').order).toBe(16)
    expect(parseNotation('D_16').order).toBe(32)
  })

  it('二义写法不会被误当成别的东西', () => {
    // (A×B)^2 不能被折成 A×B^2
    expect(parseNotation('(C_2×C_2)^2').order).toBe(16)
    // 全不动点引用之类的不该命中
    expect(parseNotation('foo bar').ok).toBe(false)
    expect(parseNotation('foo bar').error).toBe('unknown')
  })
})

describe('群别名 · 反向（getGroupAliases）', () => {
  it('列出自身 symbol 与幂⇄直积的等价写法', () => {
    const s3sq = createDirectProduct(createS3(), createS3())
    const aliases = getGroupAliases(s3sq)
    expect(aliases).toContain('S_{3}^{2}')
    expect(aliases.some((a) => a.includes('×') || a.includes('\\times'))).toBe(true)
  })

  it('Frobenius 专名可反查', () => {
    const f21 = createGroupFromSymbol('C_{7}:C_{3}')!
    expect(getGroupAliases(f21)).toContain('F_{21}')
  })

  it('Klein 四元群给出等价写法', () => {
    const v4 = createGroupFromSymbol('V_{4}')!
    const aliases = getGroupAliases(v4)
    expect(aliases).toContain('V_{4}')
    expect(aliases.some((a) => a.includes('C_{2}'))).toBe(true)
  })

  it('结果稳定且去重（同一 symbol 多次查询一致）', () => {
    const c12 = createCyclicGroup(12)
    const a = getGroupAliases(c12)
    const b = getGroupAliases(c12)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(a.length)
    expect(a[0]).toBe('C_{12}')
  })
})

import { describe, it, expect } from 'vitest'
import {
  parseNotation,
  normalizeNotation,
  groupOrderGL,
  groupOrderSL,
  groupOrderPSL,
} from '../core/algebra/notationParser'

describe('normalizeNotation', () => {
  it('normalizes whitespace, unicode superscripts, Z_, × and bare subscripts', () => {
    expect(normalizeNotation(' C 3 ')).toBe('C3')
    expect(normalizeNotation('Z_5')).toBe('C_{5}')
    expect(normalizeNotation('A \\times B')).toBe('A×B')
    expect(normalizeNotation('A ⋊ B')).toBe('A:B')
    expect(normalizeNotation('A \\rtimes B')).toBe('A:B')
    expect(normalizeNotation('S_5')).toBe('S_{5}')
    expect(normalizeNotation('C_4^3')).toBe('C_{4}^3')
  })
})

describe('parseNotation — locally constructible (offline)', () => {
  it('resolves familiar small-group notations to localSymbol with no GAP path', () => {
    const cases = [
      'S_5', 'A_4', 'C_12', 'D_6', 'Q_8', 'V_4',
      'GL(2,3)', 'SmallGroup(16,13)', 'C_3×D_4',
    ]
    for (const sym of cases) {
      const r = parseNotation(sym)
      expect(r.ok, sym).toBe(true)
      expect(r.localSymbol, sym).not.toBeNull()
      expect(r.gapExpr, sym).toBeNull()
      expect(r.order, sym).not.toBeNull()
    }
  })
})

describe('parseNotation — GAP family expressions with order formulas', () => {
  it('PSL(2,7) → ProjectiveSpecialLinearGroup(2,7), order 168', () => {
    const r = parseNotation('PSL(2,7)')
    expect(r.ok).toBe(true)
    expect(r.gapExpr).toBe('ProjectiveSpecialLinearGroup(2,7)')
    expect(r.order).toBe(168)
    expect(r.tex).toBe('\\mathrm{PSL}(2,7)')
  })

  it('SL(2,3) → SpecialLinearGroup(2,3), order 24', () => {
    const r = parseNotation('SL(2,3)')
    expect(r.ok).toBe(true)
    expect(r.order).toBe(24)
    expect(r.gapExpr ?? r.localSymbol).toBeTruthy()
  })

  it('PGL(2,5) → order 120; PSL(2,5) ≅ A₅ → order 60', () => {
    expect(parseNotation('PGL(2,5)').order).toBe(120)
    expect(parseNotation('PSL(2,5)').order).toBe(60)
  })

  it('A_6 → AlternatingGroup(6), order 360 (local creator throws for n>5, must not crash)', () => {
    const r = parseNotation('A_6')
    expect(r.ok).toBe(true)
    expect(r.gapExpr).toBe('AlternatingGroup(6)')
    expect(r.order).toBe(360)
    expect(r.localSymbol).toBeNull()
  })

  it('C_3×D_16 → DirectProduct(CyclicGroup(3), DihedralGroup(32)), order 96', () => {
    const r = parseNotation('C_3×D_16')
    expect(r.ok).toBe(true)
    expect(r.gapExpr).toBe('DirectProduct(CyclicGroup(3), DihedralGroup(32))')
    expect(r.order).toBe(96)
    expect(r.localSymbol).toBeNull()
  })

  it('Aut(S_4) → Aut(AutomorphismGroup(SymmetricGroup(4))) with unknown order', () => {
    const r = parseNotation('Aut(S_4)')
    expect(r.ok).toBe(true)
    expect(r.gapExpr).toBe('AutomorphismGroup(SymmetricGroup(4))')
    expect(r.order).toBeNull()
    expect(r.tex).toBe('\\operatorname{Aut}(S_{4})')
  })

  it('(C_2×C_2)^2 → four-fold DirectProduct, order 16', () => {
    const r = parseNotation('(C_2×C_2)^2')
    expect(r.ok).toBe(true)
    expect(r.order).toBe(16)
  })

  it('Q_8 → quaternion group, order 8', () => {
    const r = parseNotation('Q_8')
    expect(r.ok).toBe(true)
    expect(r.order).toBe(8)
    expect(r.gapExpr ?? r.localSymbol).toBeTruthy()
  })

  it('C_4^2 → direct-product path or local, order 16', () => {
    const r = parseNotation('C_4^2')
    expect(r.ok).toBe(true)
    expect(r.order).toBe(16)
    expect(r.gapExpr ?? r.localSymbol).toBeTruthy()
  })

  it('V_4 → KleinFourGroup() (or local), order 4', () => {
    const r = parseNotation('V_4')
    expect(r.ok).toBe(true)
    expect(r.order).toBe(4)
    expect(r.gapExpr === 'KleinFourGroup()' || r.localSymbol === 'V_{4}').toBe(true)
  })

  it('C_8:C_2 → semidirect error (missing φ)', () => {
    const r = parseNotation('C_8:C_2')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('semidirect')
    expect(r.gapExpr).toBeNull()
  })

  it('unknown garbage → unknown error; empty → empty error', () => {
    expect(parseNotation('foo bar').ok).toBe(false)
    expect(parseNotation('foo bar').error).toBe('unknown')
    expect(parseNotation('').ok).toBe(false)
    expect(parseNotation('').error).toBe('empty')
  })
})

describe('matrix group order formulas', () => {
  it('GL(2,2)=6, GL(2,3)=48, GL(3,2)=168', () => {
    expect(groupOrderGL(2, 2)).toBe(6)
    expect(groupOrderGL(2, 3)).toBe(48)
    expect(groupOrderGL(3, 2)).toBe(168)
  })
  it('SL and PSL: |SL(2,3)|=24, |PSL(2,7)|=168', () => {
    expect(groupOrderSL(2, 3)).toBe(24)
    expect(groupOrderPSL(2, 7)).toBe(168)
  })
})
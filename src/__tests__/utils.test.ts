import { describe, it, expect } from 'vitest'
import { texify, renderTex } from '../utils/texify'
import { createGroupFromSymbol } from '../utils/groupFactory'

describe('texify', () => {
  it('converts unicode subscripts', () => {
    expect(texify('Z₄')).toBe('Z_{4}')
    expect(texify('Z₁₂')).toBe('Z_{12}')
    expect(texify('σ₁₂')).toBe('\\sigma_{12}')
  })

  it('converts unicode superscripts', () => {
    expect(texify('C₃²')).toBe('C_{3}^{2}')
    expect(texify('x²')).toBe('x^{2}')
  })

  it('converts special symbols', () => {
    expect(texify('Z₄×Z₂')).toBe('Z_{4}\\times Z_{2}')
    expect(texify('a≅b')).toBe('a\\cong b')
    expect(texify('a→b')).toBe('a\\to b')
    expect(texify('g∈G')).toBe('g\\in G')
    expect(texify('ℤ')).toBe('\\mathbb{Z}')
    expect(texify('⟨a⟩')).toBe('\\langle a\\rangle')
    expect(texify('H⊲G')).toBe('H\\triangleleft G')
  })

  it('converts greek letters', () => {
    expect(texify('α')).toBe('\\alpha')
    expect(texify('σ₃')).toBe('\\sigma_{3}')
  })

  it('adds a space after bare greek commands followed by ascii letters', () => {
    expect(texify('σx')).toBe('\\sigma x')
    expect(texify('αG')).toBe('\\alpha G')
    expect(texify('σρ')).toBe('\\sigma\\rho')
  })

  it('leaves plain text untouched', () => {
    expect(texify('Hello')).toBe('Hello')
    expect(texify('S3')).toBe('S3')
  })

  it('is idempotent on already-converted text', () => {
    expect(texify('\\sigma_{12}')).toBe('\\sigma_{12}')
  })
})

describe('renderTex', () => {
  it('renders katex html with the katex class', () => {
    const html = renderTex('x^2 + y^2')
    expect(html).toContain('katex')
  })

  it('renders inline vs display mode differently', () => {
    const inline = renderTex('Z_4')
    const display = renderTex('Z_4', true)
    expect(inline).toContain('katex')
    expect(display).toContain('katex-display')
  })

  it('never throws on invalid input', () => {
    expect(() => renderTex('\\undefinedcmd{')).not.toThrow()
  })
})

describe('createGroupFromSymbol', () => {
  const cases: [string, number][] = [
    ['C_{4}', 4],
    ['C_{12}', 12],
    ['D_{4}', 8],
    ['D_{6}', 12],
    ['S_{3}', 6],
    ['S_{4}', 24],
    ['A_{4}', 12],
    ['A_{5}', 60],
    ['V_{4}', 4],
    ['Q_{8}', 8],
    ['Z_{4}\\times Z_{2}', 8],
    ['Z_{2}^{3}', 8],
    ['Z_{3}^{2}', 9],
    ['Z_{6}\\times Z_{2}', 12],
    ['C_{3}^{2}', 9],
  ]

  it('creates groups with correct orders', () => {
    for (const [symbol, order] of cases) {
      const g = createGroupFromSymbol(symbol)
      expect(g).not.toBeNull()
      expect(g!.order).toBe(order)
    }
  })

  it('accepts bare index forms', () => {
    expect(createGroupFromSymbol('C12')!.order).toBe(12)
    expect(createGroupFromSymbol('D6')!.order).toBe(12)
    expect(createGroupFromSymbol('S4')!.order).toBe(24)
  })

  it('returns null for unknown symbols', () => {
    expect(createGroupFromSymbol('X_{9}')).toBeNull()
    expect(createGroupFromSymbol('Garbage')).toBeNull()
  })

  it('creates equivalent group instances', () => {
    const g = createGroupFromSymbol('S_{3}')!
    const byGenerator = createGroupFromSymbol('S_{3}')!
    expect(g.name).toBe(byGenerator.name)
    expect(g.multiply(g.elements[1], g.elements[2]).id).toBe(
      byGenerator.multiply(byGenerator.elements[1], byGenerator.elements[2]).id
    )
  })
})

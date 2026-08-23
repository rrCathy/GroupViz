import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tex, TexBlock } from '../components/Tex'

describe('Tex component', () => {
  it('renders a span with tex-span class', () => {
    const { container } = render(<Tex math="S_3" />)
    expect(container.querySelector('span.tex-span')).toBeInTheDocument()
  })

  it('renders KaTeX markup inside', () => {
    const { container } = render(<Tex math="C_6" />)
    expect(container.querySelector('.katex')).toBeInTheDocument()
  })

  it('converts unicode subscripts via texify', () => {
    const { container } = render(<Tex math="D₄" />)
    const html = container.querySelector('span.tex-span')?.innerHTML ?? ''
    expect(html).toContain('katex')
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders inline mode by default', () => {
    const { container } = render(<Tex math="V_4" />)
    expect(container.querySelector('.katex')).toBeInTheDocument()
    expect(container.querySelector('.katex-display')).toBeNull()
  })

  it('renders display mode when requested', () => {
    const { container } = render(<Tex math="V_4" displayMode />)
    expect(container.querySelector('.katex-display')).toBeInTheDocument()
  })

  it('re-renders when math changes', () => {
    const { container, rerender } = render(<Tex math="S_3" />)
    const before = container.querySelector('span.tex-span')?.innerHTML
    rerender(<Tex math="S_4" />)
    const after = container.querySelector('span.tex-span')?.innerHTML
    expect(after).not.toEqual(before)
  })

  it('matches snapshot for a group symbol', () => {
    const { container } = render(<Tex math="S_3 \times C_2" />)
    expect(container.querySelector('span.tex-span')?.innerHTML).toMatchSnapshot()
  })
})

describe('TexBlock component', () => {
  it('renders a block-level element with display math', () => {
    const { container } = render(<TexBlock math="G/N" />)
    expect(container.querySelector('.katex-display')).toBeInTheDocument()
  })

  it('matches snapshot', () => {
    const { container } = render(<TexBlock math="Q_8 / Z(Q_8)" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe('Tex special symbol handling', () => {
  it.each([
    ['A × B', '\\times'],
    ['G ≅ H', 'cong'],
    ['⟨a, b⟩', 'langle'],
  ])('maps %s into TeX commands', (input) => {
    const { container } = render(<Tex math={input} />)
    expect(container.querySelector('.katex')).toBeInTheDocument()
    expect(screen.queryByText(input)).toBeNull()
  })
})

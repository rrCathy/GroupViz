import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nContext'
import Workspace from '../Workspace'

function renderWorkspace() {
  return render(
    <I18nProvider>
      <Workspace />
    </I18nProvider>,
  )
}

function getViewCard(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.view-mode-card'))
    .find(b => (b.textContent ?? '').replace(/\s+/g, '').includes(label))
}

function svgSummary(container: HTMLElement) {
  const svg = container.querySelector('svg.view-svg')
  if (!svg) return null
  return {
    circles: svg.querySelectorAll('circle').length,
    texts: svg.querySelectorAll('text').length,
    paths: svg.querySelectorAll('path').length,
    lines: svg.querySelectorAll('line').length,
    rects: svg.querySelectorAll('rect').length,
  }
}

describe('SVG structural snapshots', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('set view of S3 has a stable element-node structure', () => {
    const { container } = renderWorkspace()
    expect(svgSummary(container)).toMatchInlineSnapshot(`
      {
        "circles": 6,
        "lines": 0,
        "paths": 0,
        "rects": 0,
        "texts": 0,
      }
    `)
    expect(container.querySelectorAll('svg.view-svg foreignObject').length).toBe(6)
  })

  it('cayley view of S3 keeps element nodes with KaTeX labels', () => {
    const { container } = renderWorkspace()
    fireEvent.click(getViewCard(container, '凯莱图')!)
    const summary = svgSummary(container)
    expect(summary).not.toBeNull()
    expect(summary!.circles).toBe(6)
    expect(container.querySelectorAll('svg.view-svg foreignObject').length).toBe(6)
  })

  it('table view of S3 draws the full grid as svg cells', () => {
    const { container } = renderWorkspace()
    fireEvent.click(getViewCard(container, '乘法表')!)
    const summary = svgSummary(container)
    expect(summary).not.toBeNull()
    expect(summary!.rects).toBeGreaterThanOrEqual(36)
  })

  it('cycle view of S3 shows one cycle diagram per element order', () => {
    const { container } = renderWorkspace()
    fireEvent.click(getViewCard(container, '循环图')!)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(container.querySelectorAll('svg circle').length).toBeGreaterThan(0)
  })
})

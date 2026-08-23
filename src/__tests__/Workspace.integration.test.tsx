import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nContext'
import Workspace from '../Workspace'
import { STORAGE_KEY } from '../utils/sessionKey'
import { STORAGE_FORMAT_VERSION } from '../utils/persistence'

function renderWorkspace() {
  return render(
    <I18nProvider>
      <Workspace />
    </I18nProvider>,
  )
}

const SAFE_VIEWS: [string, string][] = [
  ['凯莱图', 'cayley'],
  ['循环图', 'cycle'],
  ['乘法表', 'table'],
  ['子群格', 'sublattice'],
  ['陪集条带', 'cosetstrip'],
  ['Sylow', 'sylow'],
]

function getViewCard(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.view-mode-card'))
    .find(b => (b.textContent ?? '').replace(/\s+/g, '').includes(label))
}

describe('Workspace integration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads default S3 in set view with all element nodes', () => {
    const { container } = renderWorkspace()
    const svg = container.querySelector('svg.view-svg')
    expect(svg).not.toBeNull()
    expect(container.querySelectorAll('svg.view-svg circle').length).toBeGreaterThanOrEqual(6)
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.__gvVersion).toBe(STORAGE_FORMAT_VERSION)
    expect(envelope.data.symbol).toBe('S_{3}')
    expect(envelope.data.view).toBe('set')
  })

  it('switches through the non-WebGL view cards without crashing', () => {
    const { container } = renderWorkspace()
    for (const [label] of SAFE_VIEWS) {
      const card = getViewCard(container, label)
      expect(card).toBeDefined()
      fireEvent.click(card!)
      const active = getViewCard(container, label)
      expect(active).toBeDefined()
      expect(active!.className).toContain('active')
      expect(container.querySelector('main.main-canvas')).not.toBeNull()
    }
  })

  it('restores group and view from a versioned session envelope', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      __gvVersion: STORAGE_FORMAT_VERSION,
      data: { symbol: 'C_{6}', view: 'table' },
    }))
    const { container } = renderWorkspace()
    const tableCard = getViewCard(container, '乘法表')
    expect(tableCard).toBeDefined()
    expect(tableCard!.className).toContain('active')
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.data.symbol).toBe('C_{6}')
    expect(envelope.data.view).toBe('table')
  })

  it('falls back to S3 on a corrupt session payload', () => {
    localStorage.setItem(STORAGE_KEY, '{broken json')
    const { container } = renderWorkspace()
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.data.symbol).toBe('S_{3}')
    expect(container.querySelectorAll('svg.view-svg circle').length).toBeGreaterThanOrEqual(6)
  })

  it('selects elements with arrow keys and marks the selection ring', () => {
    const { container } = renderWorkspace()
    expect(container.querySelector('circle[stroke="#ffd93d"]')).toBeNull()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(container.querySelector('circle[stroke="#ffd93d"]')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(container.querySelector('circle[stroke="#ffd93d"]')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(container.querySelector('circle[stroke="#ffd93d"]')).not.toBeNull()
  })

  it('renders the left panel with all accordion sections collapsed except views', () => {
    const { container } = renderWorkspace()
    const sections = container.querySelectorAll('.left-sidebar .accordion-section')
    expect(sections.length).toBeGreaterThanOrEqual(8)
    const openContents = container.querySelectorAll('.left-sidebar .accordion-content')
    expect(openContents.length).toBe(1)
  })

  it('shows drawer buttons and opens the right info drawer', () => {
    const { container } = renderWorkspace()
    const rightBtn = container.querySelector('.drawer-btn-right') as HTMLButtonElement
    expect(rightBtn).not.toBeNull()
    fireEvent.click(rightBtn)
    expect(container.querySelector('.right-sidebar.sidebar-open')).not.toBeNull()
    expect(container.querySelector('.sidebar-overlay')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.querySelector('.right-sidebar.sidebar-open')).toBeNull()
  })
})

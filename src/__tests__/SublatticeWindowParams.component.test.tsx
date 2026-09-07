import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import type { SublatticeViewParams } from '../core/types/viewConfig'

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const s3 = createSymmetricGroup(3)!
const c4 = createCyclicGroup(4)!

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

const latticeNodes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-lattice-node]'))

describe('ViewWindow · sublattice view', () => {
  beforeEach(() => localStorage.clear())

  it('renders the lattice kernel plus its caption inside the window', () => {
    const { container } = render(
      <ViewWindow view="sublattice" group={s3} title="S₃ 子群格" storageKey="lat-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(latticeNodes(win)).toHaveLength(6)
    expect(win.querySelector('[data-lattice-tier]')?.getAttribute('data-lattice-tier')).toBe('full')
    expect(win.querySelector('[data-testid="lattice-caption"]')).toBeNull()
    // 默认未 hover 时不渲染气泡；caption 行已下线，改为 hover bubble
    expect(win.querySelector('[data-testid="lattice-bubble"]')).toBeNull()
  })

  it('params panel offers tier select / merge / card size / series panel', () => {
    render(
      <ViewWindow view="sublattice" group={s3} title="S₃ 子群格" storageKey="lat-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Lattice View')).toBeInTheDocument()
    const select = panel.querySelector('select') as HTMLSelectElement
    expect(Array.from(select.options).map(o => o.value)).toEqual(['auto', 'full', 'compact', 'dots'])
    expect(select.value).toBe('auto')
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
    // 6 窗口配置复选 + Merge conjugates + Series panel
    expect(panel.querySelectorAll('input[type="checkbox"]')).toHaveLength(8)
    expect(screen.getByText('Merge conjugates')).toBeInTheDocument()
    expect(screen.getByText('Series panel')).toBeInTheDocument()
  })

  it('accumulates the controlled payload across all four controls', () => {
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<SublatticeViewParams>({})
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as SublatticeViewParams)
      }
      return (
        <ViewWindow view="sublattice" group={s3} title="S₃ 子群格" storageKey="lat-ctl"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    const { container } = render(<Controlled />)
    const win = container.firstElementChild as HTMLElement
    const panel = openPanel()

    fireEvent.change(panel.querySelector('select')!, { target: { value: 'dots' } })
    expect(received.at(-1)).toEqual({ labelDetail: 'dots' })
    expect(latticeNodes(win)).toHaveLength(6)
    expect(win.querySelector('svg text')).toBeNull()

    fireEvent.click(screen.getByText('Merge conjugates').querySelector('input')!)
    expect(received.at(-1)).toEqual({ labelDetail: 'dots', mergeConjugates: true })

    fireEvent.change(panel.querySelector('input[type="range"]')!, { target: { value: '0.8' } })
    expect(received.at(-1)).toEqual({ labelDetail: 'dots', mergeConjugates: true, nodeScale: 0.8 })

    fireEvent.click(screen.getByText('Series panel').querySelector('input')!)
    expect(received.at(-1)).toEqual({
      labelDetail: 'dots', mergeConjugates: true, nodeScale: 0.8, showSeriesPanel: true,
    })
  })

  it('persists sublattice params under the versioned envelope (debounced)', async () => {
    render(
      <ViewWindow view="sublattice" group={s3} title="S₃ 子群格" storageKey="lat-persist"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    openPanel()
    fireEvent.click(screen.getByText('Merge conjugates').querySelector('input')!)
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-lat-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { __gvVersion: number; data: { viewParams: { mergeConjugates?: boolean } } }
      expect(env.__gvVersion).toBe(1)
      expect(env.data.viewParams.mergeConjugates).toBe(true)
    }, { timeout: 1000 })
  })

  it('falls back to defaults when persisted params fail the sublattice schema', () => {
    localStorage.setItem(
      'gv-vw-lat-bad',
      JSON.stringify({
        __gvVersion: 1,
        data: {
          position: { x: 10, y: 10 },
          size: { width: 300, height: 250 },
          config: {},
          viewParams: { labelDetail: 'huge', nodeScale: 99, mergeConjugates: 'yes' },
        },
      }),
    )
    render(
      <ViewWindow view="sublattice" group={s3} title="S₃ 子群格" storageKey="lat-bad"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const panel = openPanel()
    expect((panel.querySelector('select') as HTMLSelectElement).value).toBe('auto')
    expect(
      (screen.getByText('Merge conjugates').querySelector('input') as HTMLInputElement).checked
    ).toBe(false)
  })

  it('default persist key includes the view name (lattice and set windows never collide)', async () => {
    render(
      <ViewWindow view="sublattice" group={c4} title="C₄ 子群格" defaultPosition={{ x: 20, y: 20 }} />,
    )
    render(
      <ViewWindow view="set" group={c4} title="C₄ 集合" defaultPosition={{ x: 60, y: 60 }} />,
    )
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|sublattice'))).toBe(true)
      expect(keys.some(k => k.endsWith('|set'))).toBe(true)
    }, { timeout: 1000 })
  })
})

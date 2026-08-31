import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'

const c4 = createCyclicGroup(4)
const d6 = createDihedralGroup(6)
const c12 = createCyclicGroup(12)

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

describe('ViewWindow · cycle view', () => {
  beforeEach(() => localStorage.clear())

  it('renders cycle diagram nodes for the group', () => {
    const { container } = render(
      <ViewWindow view="cycle" group={c4} title="C₄ 循环" storageKey="cyc-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 4 个元素节点（带 node-shadow 滤镜），另有 2 个循环中心小圆点不计入
    const nodeCircles = [...win.querySelectorAll('circle')].filter(c => c.getAttribute('filter')?.includes('node-shadow'))
    expect(nodeCircles).toHaveLength(4)
    // 循环图窗口类似凯莱图：默认不显示元素标签（无 foreignObject label）
    expect(win.querySelectorAll('foreignObject')).toHaveLength(0)
  })

  it('params panel offers cycle controls (maximal/radius/labels/captions)', () => {
    render(
      <ViewWindow view="cycle" group={d6} title="D₆ 循环" storageKey="cyc-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Cycle View')).toBeInTheDocument()
    // 节点半径 1 个滑杆；4 窗口配置 + 2 循环配置复选框（无 Show labels，窗口默认隐藏标签）
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(screen.getByText('Maximal cycles only')).toBeInTheDocument()
    expect(screen.getByText('Show ⟨g⟩ ≅ Zₙ captions')).toBeInTheDocument()
  })

  it('fires onViewParamsChange when toggling maximal cycles', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="cycle" group={d6} title="D₆ 循环" storageKey="cyc-ctl"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    openPanel()
    const checkbox = screen.getByText('Maximal cycles only').closest('label')!.querySelector('input')!
    fireEvent.click(checkbox)
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ showMaximalCycles: true })
  })

  it('clicking an element highlights the maximal cycle containing it', () => {
    const { container } = render(
      <ViewWindow view="cycle" group={c4} title="C₄ 循环" storageKey="cyc-hl"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 点击第一个非单位元节点 → 所在极大循环被高亮（彩色填充 + 加粗 + ⟨g⟩≅Z_n 标注）
    const nodeCircle = [...win.querySelectorAll('circle')].find(c => c.getAttribute('filter')?.includes('node-shadow'))
    fireEvent.click(nodeCircle as Element)
    const hlPath = win.querySelector('path[fill-opacity="0.18"]')
    expect(hlPath).not.toBeNull()
    expect(win.textContent).toContain('≅ Z4')
  })
})

describe('ViewWindow · table view', () => {
  beforeEach(() => localStorage.clear())

  it('renders a multiplication table grid for a small group', () => {
    const { container } = render(
      <ViewWindow view="table" group={c4} title="C₄ 乘法表" storageKey="tbl-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 360 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 4×4 单元格 = 16 个 <rect>
    expect(win.querySelectorAll('rect')).toHaveLength(16)
  })

  it('params panel offers strategy select and cell-size slider', () => {
    render(
      <ViewWindow view="table" group={c12} title="C₁₂ 乘法表" storageKey="tbl-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 360 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Table View')).toBeInTheDocument()
    const select = panel.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(Array.from(select.options).map(o => o.value)).toEqual(['subgroup', 'random', 'full'])
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
  })

  it('fires onViewParamsChange when strategy changes', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="table" group={c12} title="C₁₂ 乘法表" storageKey="tbl-ctl"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 360 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    const panel = openPanel()
    fireEvent.change(panel.querySelector('select')!, { target: { value: 'random' } })
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ strategy: 'random' })
  })

  it('grows the window to a minimum size so the full table is visible', () => {
    const { container } = render(
      <ViewWindow view="table" group={c12} title="C₁₂ 乘法表" storageKey="tbl-minsize"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 300, height: 260 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 12×12 表（cellSize 50）：宽 ≥ 12*50+44=644，高 ≥ 12*50+74+32=706
    expect(parseInt(win.style.width, 10)).toBeGreaterThanOrEqual(644)
    expect(parseInt(win.style.height, 10)).toBeGreaterThanOrEqual(706)
  })

  it('keeps a large default size unchanged when it already fits the table', () => {
    const { container } = render(
      <ViewWindow view="table" group={c4} title="C₄ 乘法表" storageKey="tbl-minfit"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 520, height: 420 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // C₄ 最小 ~280×306，默认 520×420 已满足 → 保持不变
    expect(win.style.width).toBe('520px')
    expect(win.style.height).toBe('420px')
  })
})

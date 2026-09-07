import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SublatticeScene } from '../components/Canvas/SublatticeScene'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const s3 = createSymmetricGroup(3)!
const d4 = createDihedralGroup(4)!
const ct = { x: 0, y: 0, scale: 1 }

const nodesIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-lattice-node]'))
const tierOf = (container: HTMLElement) =>
  container.querySelector('.sublattice-view-wrap')?.getAttribute('data-lattice-tier')

describe('SublatticeScene · 受控内核', () => {
  it('renders the S₃ lattice at native card size when the host is unmeasured (fit = 1 → full)', () => {
    const { container } = render(<SublatticeScene group={s3} canvasTransform={ct} />)
    expect(tierOf(container)).toBe('full')
    expect(nodesIn(container)).toHaveLength(6)
    expect(container.textContent).toContain('|H|=2')
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 680 608')
  })

  it('keeps the card/canvas geometry free of the old 1000×600 floor', () => {
    const { container } = render(<SublatticeScene group={createCyclicGroup(4)!} canvasTransform={ct} />)
    const [w, h] = (container.querySelector('svg')!.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
    expect(w).toBeLessThan(1000)
    expect(h).toBeLessThan(600)
  })

  it('applies the host transform exactly once', () => {
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={{ x: 10, y: 20, scale: 2 }} />,
    )
    const groups = Array.from(container.querySelectorAll('svg > g'))
    expect(groups).toHaveLength(1)
    expect(groups[0].getAttribute('transform')).toBe('translate(10, 20) scale(2)')
  })

  it('dots tier drops all card text and draws one dot per subgroup', () => {
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="dots" />,
    )
    expect(tierOf(container)).toBe('dots')
    expect(container.querySelectorAll('svg text')).toHaveLength(0)
    expect(container.querySelectorAll('svg rect')).toHaveLength(0)
    // 每节点 = 透明命中圆 + 实色圆
    expect(container.querySelectorAll('svg circle')).toHaveLength(12)
  })

  it('compact tier draws one short line per node (order only, no |H|= cards)', () => {
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="compact" />,
    )
    expect(tierOf(container)).toBe('compact')
    expect(container.textContent).toContain('2')
    expect(container.textContent).not.toContain('|H|=')
    expect(container.querySelectorAll('svg text')).toHaveLength(6)
  })

  it('mergeConjugates collapses S₃ to four orbit nodes and badges the ×3 class', () => {
    const { container: plain } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="full" />,
    )
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="full" mergeConjugates />,
    )
    expect(nodesIn(plain)).toHaveLength(6)
    expect(nodesIn(container)).toHaveLength(4)
    expect(container.textContent).toContain('×3')
  })

  it('merging an abelian group leaves the lattice unchanged', () => {
    const { container } = render(
      <SublatticeScene group={createCyclicGroup(4)!} canvasTransform={ct} mergeConjugates labelDetail="full" />,
    )
    expect(nodesIn(container)).toHaveLength(3) // ⟨e⟩ < C₄ < C₂? 循环群子群格：e, ⟨a²⟩, C₄
    expect(container.textContent).not.toContain('×')
  })

  it('D₄ merged lattice hides fewer nodes than the raw lattice and marks orbits', () => {
    const { container: raw } = render(<SublatticeScene group={d4} canvasTransform={ct} labelDetail="full" />)
    const { container } = render(
      <SublatticeScene group={d4} canvasTransform={ct} labelDetail="full" mergeConjugates />,
    )
    expect(nodesIn(container).length).toBeLessThan(nodesIn(raw).length)
    expect(container.textContent).toMatch(/×2/)
  })

  it('nodeScale tightens the world box and the card geometry', () => {
    const { container: full } = render(<SublatticeScene group={s3} canvasTransform={ct} />)
    const { container } = render(<SublatticeScene group={s3} canvasTransform={ct} nodeScale={0.5} />)
    const wOf = (c: HTMLElement) => Number((c.querySelector('svg')!.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/)[2])
    expect(wOf(container)).toBeCloseTo(wOf(full) * 0.5)
  })

  it('reports the tier it chose and stays clickable in every tier', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="dots" onActivateNode={onActivate} />,
    )
    fireEvent.click(nodesIn(container)[1])
    expect(onActivate.mock.calls[0][0]).toBe(1)
    expect(onActivate.mock.calls[0][1]).toMatchObject({ order: expect.any(Number) })
    fireEvent.click(nodesIn(container)[1])
    expect(onActivate).toHaveBeenLastCalledWith(null, null)
  })

  it('hover bubble tracks hover node with full detail', () => {
    // 底部 caption 行已下线，hover 信息改为就地气泡（与 Cayley graph hover bubble 一致）。
    const { container } = render(
      <SublatticeScene group={s3} canvasTransform={ct} labelDetail="dots" />,
    )
    const bubble = container.querySelector('[data-testid="lattice-bubble"]')
    // 未 hover：气泡不渲染（节点没兴趣点时不挡视野）
    expect(bubble).toBeNull()
    fireEvent.mouseEnter(nodesIn(container)[1])
    const bubbleAfter = container.querySelector('[data-testid="lattice-bubble"]')
    expect(bubbleAfter).not.toBeNull()
    expect(bubbleAfter!.textContent ?? '').toMatch(/H/)
    fireEvent.mouseLeave(nodesIn(container)[1])
    expect(container.querySelector('[data-testid="lattice-bubble"]')).toBeNull()
  })

  it('renders the series panel only when a series and the panel flag are both present', () => {
    const series = { type: 'derived' as const, terms: [[s3.identity], s3.elements], solvable: true }
    const { container: without } = render(
      <SublatticeScene group={s3} canvasTransform={ct} series={series} />,
    )
    expect(without.querySelector('.series-panel')).not.toBeNull()
    const { container: withFlagOff } = render(
      <SublatticeScene group={s3} canvasTransform={ct} series={series} showSeriesPanel={false} />,
    )
    expect(withFlagOff.querySelector('.series-panel')).toBeNull()
  })

  it('shows a placeholder for a missing group and for lattices the backend must supply', () => {
    const { container } = render(<SublatticeScene group={null} canvasTransform={ct} />)
    expect(container.querySelector('.view-empty')).not.toBeNull()
    const { container: big } = render(
      <SublatticeScene group={createSymmetricGroup(5)!} canvasTransform={ct} />,
    )
    expect(big.querySelector('.view-empty')).not.toBeNull()
    expect(big.textContent).toContain('lattice.backendOnly')
  })
})

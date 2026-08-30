import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'

const c4 = createCyclicGroup(4)

describe('ViewWindow params panel (external overlay)', () => {
  beforeEach(() => localStorage.clear())

  it('opens the params panel as a sibling overlay docked right of the window', () => {
    const { container } = render(
      <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-right"
        defaultPosition={{ x: 100, y: 50 }} defaultSize={{ width: 400, height: 300 }} />
    )
    expect(screen.queryByText('View Config')).toBeNull()

    fireEvent.click(screen.getByTitle('Parameters'))

    const win = container.firstElementChild as HTMLElement
    const panel = screen.getByText('View Config').parentElement as HTMLElement
    // 兄弟浮层——不在窗口内部（窗口 overflow:hidden 会裁剪子元素）
    expect(win.contains(panel)).toBe(false)
    expect(container.children).toHaveLength(2)
    expect(panel.style.position).toBe('absolute')
    // 贴窗口右缘：left = x + w + gap = 100 + 400 + 8
    expect(panel.style.left).toBe('508px')
    expect(panel.style.top).toBe('50px')
    expect(panel.style.width).toBe('200px')
    // 与窗口同一堆叠层级，随窗口置顶/沉底
    expect(panel.style.zIndex).toBe(win.style.zIndex)
  })

  it('flips to the left side of the window when the right side would overflow the viewport', () => {
    render(
      <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-flip"
        defaultPosition={{ x: 900, y: 50 }} defaultSize={{ width: 400, height: 300 }} />
    )
    fireEvent.click(screen.getByTitle('Parameters'))
    const panel = screen.getByText('View Config').parentElement as HTMLElement
    // 900 + 400 + 8 + 200 > innerWidth(1024) → 翻转左侧：max(0, 900 - 8 - 200)
    expect(panel.style.left).toBe('692px')
  })

  it('toggles the panel closed again', () => {
    render(
      <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-toggle"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />
    )
    const btn = screen.getByTitle('Parameters')
    fireEvent.click(btn)
    expect(screen.getByText('View Config')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText('View Config')).toBeNull()
  })

  it('panel sliders still update set-view params', () => {
    render(
      <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-slider"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />
    )
    fireEvent.click(screen.getByTitle('Parameters'))
    const panel = screen.getByText('View Config').parentElement as HTMLElement
    const sliders = panel.querySelectorAll('input[type="range"]')
    expect(sliders.length).toBe(3)
    fireEvent.change(sliders[0], { target: { value: '40' } })
    expect(screen.getByText('40px')).toBeInTheDocument()
  })

  describe('resizable=false', () => {
    const countResizeHandles = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('div'))
        .filter(d => (d.style.cursor || '').includes('resize')).length

    it('renders 8 resize handles by default', () => {
      const { container } = render(
        <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-resize-def"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />
      )
      expect(countResizeHandles(container.firstElementChild as HTMLElement)).toBe(8)
    })

    it('hides all resize handles when resizable=false (window keeps movable via titlebar)', () => {
      const { container } = render(
        <ViewWindow view="set" group={c4} title="C₄" storageKey="vw-test-resize-off"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
          config={{ resizable: false }} />
      )
      const win = container.firstElementChild as HTMLElement
      expect(countResizeHandles(win)).toBe(0)
      // 标题栏仍在，可继续拖动移动窗口
      expect(win.textContent).toContain('C₄')
    })
  })

  describe('embed chrome (blog figure)', () => {
    beforeEach(() => localStorage.clear())

    it('showControls=false hides all titlebar buttons, title text remains', () => {
      render(
        <ViewWindow view="set" group={c4} title="图 1" storageKey="vw-test-nocontrols"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
          config={{ showControls: false }} />,
      )
      expect(screen.getByText('图 1')).toBeInTheDocument()
      expect(screen.queryByTitle('Lock move')).toBeNull()
      expect(screen.queryByTitle('Lock zoom')).toBeNull()
      expect(screen.queryByTitle('Parameters')).toBeNull()
      expect(screen.queryByTitle('Close')).toBeNull()
    })

    it('showZoomSlider=false hides the zoom slider overlay (ctrl+wheel zoom still active)', () => {
      const { container } = render(
        <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="vw-test-noslider"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
          config={{ showZoomSlider: false }} />,
      )
      const win = container.firstElementChild as HTMLElement
      // 参数面板未打开时，窗口内唯一的 range 控件就是缩放滑杆
      expect(win.querySelector('input[type="range"]')).toBeNull()

      // 默认（未配置）时滑杆存在
      const { container: withSlider } = render(
        <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="vw-test-slider-def"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
      )
      expect((withSlider.firstElementChild as HTMLElement).querySelector('input[type="range"]')).not.toBeNull()
    })

    it('hovering a node shows the element HUD (label + order), leaving hides it', () => {
      const { container } = render(
        <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="vw-test-hud"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
      )
      const win = container.firstElementChild as HTMLElement
      expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()

      // 节点 g：circle 的父级即携带 onMouseEnter 的节点容器
      const node = (win.querySelector('circle') as Element).closest('g') as Element
      fireEvent.mouseEnter(node)
      const hud = win.querySelector('[data-testid="hover-hud"]') as HTMLElement
      expect(hud).not.toBeNull()
      expect(hud.textContent).toContain('order')

      fireEvent.mouseLeave(node)
      expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
    })
  })
})

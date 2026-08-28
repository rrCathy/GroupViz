import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import type { CayleyViewParams, SetViewParams } from '../core/types/viewConfig'

const c4 = createCyclicGroup(4)
const c12 = createCyclicGroup(12)

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

describe('ViewWindow · cayley view', () => {
  beforeEach(() => localStorage.clear())

  it('renders the 2D cayley diagram with generator edges by default', () => {
    const { container } = render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 4 个节点 + 生成元 a 的 4 条有向边（circular 兜底布局）
    expect(win.querySelectorAll('circle')).toHaveLength(4)
    expect(win.querySelectorAll('path[marker-end]')).toHaveLength(4)
    expect(win.querySelectorAll('marker')).toHaveLength(1)
  })

  it('params panel offers shape/multiply/radius/labels/edge-action controls for cayley', () => {
    render(
      <ViewWindow view="cayley" group={c12} title="C₁₂ 凯莱" storageKey="cay-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Cayley View')).toBeInTheDocument()
    const select = panel.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    // C₁₂（>7 阶循环群）可用形状：circular/spiral/coil/cone，默认 circular
    expect(Array.from(select.options).map(o => o.value)).toEqual(['circular', 'spiral', 'coil', 'cone'])
    expect(select.value).toBe('circular')
    // 仅 1 个滑杆（节点半径）；面板整体复选框 = 4 窗口配置 + 标签 + 1 条作用边
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(panel.querySelectorAll('input[type="checkbox"]')).toHaveLength(6)
    expect(screen.getByText('Edge actions')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('fires onViewParamsChange when shape or multiply changes (controlled mode)', () => {
    // 受控模式：宿主持有状态并回灌 —— 与文档约定的使用方式一致
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<CayleyViewParams>({})
      const handleChange = (next: SetViewParams | CayleyViewParams) => {
        received.push({ ...next })
        setP(next as CayleyViewParams)
      }
      return (
        <ViewWindow view="cayley" group={c12} title="C₁₂ 凯莱" storageKey="cay-ctl"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    render(<Controlled />)
    const panel = openPanel()
    fireEvent.change(panel.querySelector('select')!, { target: { value: 'spiral' } })
    expect(received.at(-1)).toEqual({ shape2D: 'spiral' })

    fireEvent.click(screen.getByTitle('Left multiply c·a'))
    expect(received.at(-1)).toEqual({ shape2D: 'spiral', multiplyType: 'left' })

    fireEvent.click(screen.getByTitle('Right multiply a·c'))
    expect(received.at(-1)).toEqual({ shape2D: 'spiral', multiplyType: 'right' })
  })

  it('edge-action checkbox and All/None buttons update params.actions', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-actions"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    openPanel()
    // 默认作用 = 生成元 e1；勾选行 → enabled 翻转为 false
    const row = screen.getByTitle('e1')
    fireEvent.click(row.querySelector('input')!)
    let payload = onChange.mock.lastCall?.[0] as { actions: Array<{ elementId: string; enabled: boolean }> }
    expect(payload.actions).toHaveLength(1)
    expect(payload.actions[0]).toMatchObject({ elementId: 'e1', enabled: false })

    // None → 空数组（无任何边）
    fireEvent.click(screen.getByText('None'))
    const nonePayload = onChange.mock.lastCall?.[0] as { actions: unknown[] }
    expect(nonePayload.actions).toEqual([])

    // All → 全部 4 个元素成为作用（生成元默认启用）
    fireEvent.click(screen.getByText('All'))
    payload = onChange.mock.lastCall?.[0] as { actions: Array<{ elementId: string; enabled: boolean }> }
    expect(payload.actions).toHaveLength(4)
    expect(payload.actions.find(a => a.elementId === 'e1')?.enabled).toBe(true)
    expect(payload.actions.find(a => a.elementId === 'e0')?.enabled).toBe(false)
  })

  it('persists cayley params under the versioned envelope (debounced)', async () => {
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-persist"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    openPanel()
    fireEvent.click(screen.getByTitle('Left multiply c·a'))
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-cay-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { __gvVersion: number; data: { viewParams: { multiplyType?: string } } }
      expect(env.__gvVersion).toBe(1)
      expect(env.data.viewParams.multiplyType).toBe('left')
    }, { timeout: 1000 })
  })

  it('falls back to defaults when persisted params fail the per-view schema', () => {
    localStorage.setItem(
      'gv-vw-cay-bad',
      JSON.stringify({
        __gvVersion: 1,
        data: {
          position: { x: 10, y: 10 },
          size: { width: 300, height: 250 },
          config: {},
          viewParams: { shape2D: 'bogus', multiplyType: 'sideways' },
        },
      }),
    )
    const { container } = render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-bad"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 不崩溃，按默认参数渲染
    expect(win.querySelectorAll('circle')).toHaveLength(4)
    const panel = openPanel()
    expect((panel.querySelector('select') as HTMLSelectElement).value).toBe('circular')
  })

  it('default persist key includes the view name (set and cayley windows never collide)', async () => {
    render(
      <ViewWindow view="set" group={c4} title="C₄ 集合" defaultPosition={{ x: 20, y: 20 }} />,
    )
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" defaultPosition={{ x: 60, y: 60 }} />,
    )
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|set'))).toBe(true)
      expect(keys.some(k => k.endsWith('|cayley'))).toBe(true)
    }, { timeout: 1000 })
  })

  it('applies the viewport transform exactly once (no double pan/zoom)', () => {
    const { container } = render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-zoom"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 窗口内唯一 range 控件是缩放滑杆（参数面板未打开）
    const zoomSlider = win.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(zoomSlider, { target: { value: '2' } })
    // 视图组件自身 <g> 应用变换；窗口不得再包一层同变换的 <g>
    expect(win.querySelectorAll('g[transform*="scale(2"]')).toHaveLength(1)
  })
})

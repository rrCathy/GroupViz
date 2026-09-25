import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import type { CayleyViewParams } from '../core/types/viewConfig'

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
    // 滑杆 = 节点半径 + 边曲率 + 逐生成元边长（C₁₂ 默认 1 条作用边）+ 边线宽（VCL E4）→ 4
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(4)
    // 复选框 = 6 窗口配置 + 1 条作用边 + Live force-directed + VCL 新增（箭头/打印/图例/阶徽标/⟨g⟩高亮/中心/正规子群）
    //          + DEC-2 注释（Leader line）= 16
    expect(panel.querySelectorAll('input[type="checkbox"]')).toHaveLength(16)
    expect(screen.getByText('Edge actions')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
    // VCL 新增控件：边几何 / 路径高亮 / 动态力导向 / E 组边样式 / F 组语义装饰
    expect(screen.getByText('Edge curvature')).toBeInTheDocument()
    expect(screen.getByText('Edge width')).toBeInTheDocument()            // VCL E4 边线宽
    expect(screen.getByText('Path highlight')).toBeInTheDocument()
    expect(screen.getByText('Live force-directed')).toBeInTheDocument()
    expect(screen.getByTestId('cayley-arrows')).toBeInTheDocument()      // VCL E3 箭头开关
    expect(screen.getByTestId('cayley-print-palette')).toBeInTheDocument() // VCL E3 打印/单色
    expect(screen.getByTestId('cayley-legend')).toBeInTheDocument()      // VCL E2 图例
    expect(screen.getByTestId('cayley-order-badge')).toBeInTheDocument() // VCL F2 阶徽标
    expect(screen.getByTestId('cayley-gen-highlight')).toBeInTheDocument() // VCL F3 ⟨g⟩高亮
    expect(screen.getByTestId('cayley-mark-center')).toBeInTheDocument() // VCL F4 中心 Z(G)
    expect(screen.getByTestId('cayley-mark-normal')).toBeInTheDocument() // VCL F4 正规子群
    expect(screen.getByTestId('cayley-color-conj')).toBeInTheDocument()  // VCL F1 共轭类着色
    // VCL DEC-2 注释编辑器（锚点 = 节点 / 边 / 整图；文本 TeX）
    expect(screen.getByTestId('annotation-editor')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-anchor-type')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-ref')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-text')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-add')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-leader')).toBeInTheDocument()
    expect(screen.getByTestId('annotation-color')).toBeInTheDocument()
    // 锚点默认 node（边锚点才出现 Action element 输入）
    expect(screen.queryByTestId('annotation-action-ref')).not.toBeInTheDocument()
  })

  it('edge-curvature / path-highlight / force-directed controls write back params', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-vcl"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    openPanel()

    // 笔直：edgeCurvature = 0
    fireEvent.click(screen.getByText('Straight'))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ edgeCurvature: 0 })

    // 力导向开关：forceDirected = true（面板展开微调滑杆）
    fireEvent.click(screen.getByText('Live force-directed'))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ forceDirected: true })

    // 路径高亮：元素序列输入 → pathHighlight.elements
    const input = screen.getByPlaceholderText(/refs, e\.g\./)
    fireEvent.change(input, { target: { value: 'e0 e1 e2' } })
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pathHighlight: { elements: ['e0', 'e1', 'e2'] } })
  })

  it('adds / switches anchor / deletes an annotation through the panel and draws it on the canvas (DEC-2)', () => {
    const { container } = render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" storageKey="cay-decor"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    const panel = openPanel()

    // 初始：无注释叠层（缺省零行为变化）
    expect(win.querySelector('[data-testid="cayley-annotations"]')).toBeNull()

    // 节点锚点 + TeX 文本 → 添加
    const ref = c4.elements[1].label
    fireEvent.change(screen.getByTestId('annotation-ref'), { target: { value: ref } })
    fireEvent.change(screen.getByTestId('annotation-text'), { target: { value: 'a^2=e' } })
    fireEvent.click(screen.getByTestId('annotation-add'))

    // 面板列表出现该条 + 画布出现注释叠层（1 条 foreignObject 文本）
    expect(panel.querySelector('[data-testid^="annotation-row-"]')).not.toBeNull()
    const overlay = win.querySelector('[data-testid="cayley-annotations"]') as SVGGElement | null
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelectorAll('foreignObject')).toHaveLength(1)

    // 切到边锚点 → 出现 Action element 输入
    fireEvent.change(screen.getByTestId('annotation-anchor-type'), { target: { value: 'edge' } })
    expect(screen.getByTestId('annotation-action-ref')).toBeInTheDocument()

    // 删除 → 列表与叠层同时清空
    fireEvent.click(panel.querySelector('[data-testid^="annotation-delete-"]') as HTMLElement)
    expect(panel.querySelector('[data-testid^="annotation-row-"]')).toBeNull()
    expect(win.querySelector('[data-testid="cayley-annotations"]')).toBeNull()
  })

  it('fires onViewParamsChange when shape or multiply changes (controlled mode)', () => {
    // 受控模式：宿主持有状态并回灌 —— 与文档约定的使用方式一致
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<CayleyViewParams>({})
      const handleChange = (next: ViewParams) => {
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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import type { Cayley3DViewParams } from '../core/types/viewConfig'

// 与 Cayley3DView.component.test.tsx 同一套 R3F/i18n/theme stub（happy-dom 无 WebGL）
vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode }) => <div data-testid="r3f-canvas">{props.children}</div>,
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: {
      fov: 50, near: 0.1, far: 400, aspect: 1,
      position: { set() {} }, up: { set() {} }, lookAt() {},
    },
    scene: {},
  }),
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({
  Html: (props: { children?: ReactNode; wrapperClass?: string }) => (
    <div className={props.wrapperClass}>{props.children}</div>
  ),
  Line: (props: { points?: number[][]; lineWidth?: number; color?: string }) => (
    <div
      className="gv-three-line"
      data-points={JSON.stringify(props.points ?? [])}
      data-line-width={String(props.lineWidth ?? '')}
      data-color={props.color ?? ''}
    />
  ),
}))
vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const c4 = createCyclicGroup(4)

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

describe('ViewWindow · cayley3d view', () => {
  beforeEach(() => localStorage.clear())

  it('renders the 3D scene with generator edges by default (C₄)', () => {
    const { container } = render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    const tagAll = (tag: string) =>
      Array.from(win.querySelectorAll('*')).filter(e => e.tagName.toLowerCase() === tag.toLowerCase())
    expect(tagAll('spheregeometry')).toHaveLength(4)
    expect(tagAll('cylindergeometry')).toHaveLength(4)
  })

  it('params panel offers layout/multiply/node-size/autorotate/labels/path/edge-action controls', () => {
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Cayley 3D View')).toBeInTheDocument()
    const select = panel.querySelector('select') as HTMLSelectElement
    // C₄ 循环群可用 3D 形状：cone + circular，默认 circular（getDefaultLayout3D）
    expect(Array.from(select.options).map(o => o.value)).toEqual(['cone', 'circular'])
    expect(select.value).toBe('circular')
    // 滑杆 = Node size + 每启用作用边一条 len（C₄ 生成元 e1）；透明度滑杆仅在选中面子群后出现
    // 复选框 = 6 窗口配置 + Auto rotate + Show labels + Face fills + 1 条作用边（Path highlight 未设值时无复选框）
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(2)
    expect(panel.querySelectorAll('input[type="checkbox"]')).toHaveLength(10)
    expect(screen.getByText('Auto rotate')).toBeInTheDocument()
    expect(screen.getByText('Show labels')).toBeInTheDocument()
    expect(screen.getByText('Path highlight')).toBeInTheDocument()
    expect(screen.getByText('Edge actions')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('A₄: picking the C₃ subgroup lists its 4 coset faces with per-face colour + opacity', () => {
    const a4 = createAlternatingGroup(4)
    render(
      <ViewWindow view="3d" group={a4} title="A₄ 3D" storageKey="d3-faces"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const panel = openPanel()
    const selects = panel.querySelectorAll('select')
    // 3D 面板：Layout select + Face subgroup select（A₄ 有 1 个可用候选：C₃）
    const faceSelect = selects[selects.length - 1] as HTMLSelectElement
    expect(Array.from(faceSelect.options).map(o => o.value)).toEqual(['', expect.stringContaining(',')] as never)
    const c3Value = faceSelect.options[1].value
    fireEvent.change(faceSelect, { target: { value: c3Value } })
    // 4 个陪集三角面 → 4 个颜色行 + 透明度滑杆（滑杆另含 Node size + 2 条生成元 len）
    expect(panel.querySelectorAll('input[type="color"]')).toHaveLength(4)
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(4) // Node size + a/b len + Opacity
    // 改色写回参数并同步回颜色行（选中色随 faceFill.faceColors 持久化）
    const colors = panel.querySelectorAll('input[type="color"]')
    fireEvent.change(colors[1], { target: { value: '#123456' } })
    expect(panel.querySelectorAll('input[type="color"]')[1].getAttribute('value')).toBe('#123456')
  })

  it('hides the window zoom slider and its own range for 3d (camera owns zoom)', () => {
    const { container } = render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-zoom"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 2D 视图有底部缩放滑杆；3D 由相机自带滚轮缩放 → 窗口内容区无 range 控件
    expect(win.querySelectorAll('input[type="range"]')).toHaveLength(0)
  })

  it('fires onViewParamsChange when layout/multiply/autoRotate change (controlled mode)', () => {
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<Cayley3DViewParams>({})
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as Cayley3DViewParams)
      }
      return (
        <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-ctl"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    render(<Controlled />)
    const panel = openPanel()
    fireEvent.change(panel.querySelector('select')!, { target: { value: 'cone' } })
    expect(received.at(-1)).toEqual({ layout3D: 'cone' })

    fireEvent.click(screen.getByTitle('Left multiply c·a'))
    expect(received.at(-1)).toEqual({ layout3D: 'cone', multiplyType: 'left' })

    fireEvent.click(screen.getByText('Auto rotate').querySelector('input')!)
    expect(received.at(-1)).toEqual({ layout3D: 'cone', multiplyType: 'left', autoRotate: true })

    fireEvent.change(panel.querySelector('input[type="range"]')!, { target: { value: '1.5' } })
    expect(received.at(-1)).toEqual({ layout3D: 'cone', multiplyType: 'left', autoRotate: true, nodeScale: 1.5 })
  })

  it('edge-action checkbox and All/None buttons update params.actions', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-actions"
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

    // All → 全部 4 个元素成为作用（currentView='3d' 路径）
    fireEvent.click(screen.getByText('All'))
    payload = onChange.mock.lastCall?.[0] as { actions: Array<{ elementId: string; enabled: boolean }> }
    expect(payload.actions).toHaveLength(4)

    // None → 空数组（无任何边）
    fireEvent.click(screen.getByText('None'))
    const nonePayload = onChange.mock.lastCall?.[0] as { actions: unknown[] }
    expect(nonePayload.actions).toEqual([])
  })

  it('len slider writes per-generator lengthScale into params.actions (3D)', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-len"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    const panel = openPanel()
    // 滑杆顺序：Node size → e1 的 len
    const ranges = panel.querySelectorAll('input[type="range"]')
    expect(ranges).toHaveLength(2)
    fireEvent.change(ranges[1], { target: { value: '2' } })
    const payload = onChange.mock.lastCall?.[0] as { actions: Array<{ elementId: string; lengthScale?: number }> }
    expect(payload.actions).toHaveLength(1)
    expect(payload.actions[0]).toMatchObject({ elementId: 'e1', lengthScale: 2 })
  })

  it('path highlight editor writes pathHighlight into viewParams (3D)', () => {
    const onChange = vi.fn()
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-path"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{}} onViewParamsChange={onChange} />,
    )
    const panel = openPanel()
    const input = panel.querySelector('input[placeholder^="refs"]') as HTMLInputElement
    expect(input).not.toBeNull()
    fireEvent.change(input, { target: { value: 'e0 e1' } })
    const payload = onChange.mock.lastCall?.[0] as { pathHighlight?: { elements?: string[] } }
    expect(payload.pathHighlight?.elements).toEqual(['e0', 'e1'])
  })

  it('persists 3d params under the versioned envelope (debounced)', async () => {
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-persist"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    openPanel()
    fireEvent.click(screen.getByTitle('Left multiply c·a'))
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-d3-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { __gvVersion: number; data: { viewParams: { multiplyType?: string } } }
      expect(env.__gvVersion).toBe(1)
      expect(env.data.viewParams.multiplyType).toBe('left')
    }, { timeout: 1000 })
  })

  it('falls back to defaults when persisted params fail the 3d schema', () => {
    localStorage.setItem(
      'gv-vw-d3-bad',
      JSON.stringify({
        __gvVersion: 1,
        data: {
          position: { x: 10, y: 10 },
          size: { width: 300, height: 250 },
          config: {},
          viewParams: { layout3D: 'bogus', multiplyType: 'sideways', nodeScale: 99 },
        },
      }),
    )
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" storageKey="d3-bad"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const panel = openPanel()
    // 不崩溃，按 schema 回退默认（layout3D 默认 circular）
    expect((panel.querySelector('select') as HTMLSelectElement).value).toBe('circular')
  })

  it('default persist key includes the view name (3d and cayley windows never collide)', async () => {
    render(
      <ViewWindow view="3d" group={c4} title="C₄ 3D" defaultPosition={{ x: 20, y: 20 }} />,
    )
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ 凯莱" defaultPosition={{ x: 60, y: 60 }} />,
    )
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|3d'))).toBe(true)
      expect(keys.some(k => k.endsWith('|cayley'))).toBe(true)
    }, { timeout: 1000 })
  })
})

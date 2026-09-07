import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createQuaternion } from '../core/groups/SpecialGroup'
import type { SymmetryViewParams } from '../core/types/viewConfig'

// 与 Cayley3DWindowParams.component.test.tsx 同一套 R3F/i18n/theme stub（happy-dom 无 WebGL）。
// SymmetryScene 用 drei OrbitControls（需 stub 为 null），其余 R3F 元素由 Canvas mock 直出。
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
  OrbitControls: () => null,
}))
vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light', viewWindowTheme: 'dark' }),
}))

const c4 = createCyclicGroup(4)
const s4 = createSymmetricGroup(4)
const q8 = createQuaternion()

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

const rowsOf = (panel: HTMLElement) => Array.from(panel.querySelectorAll('[data-testid="sym-action-row"]'))

describe('ViewWindow · symmetry view', () => {
  beforeEach(() => localStorage.clear())

  it('renders the symmetry scene for a supported group (C₄ → cyclic n-gon) and a hint-free viewport', () => {
    const { container } = render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Sym" storageKey="sym-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }} />,
    )
    expect(container.querySelectorAll('[data-testid="r3f-canvas"]')).toHaveLength(1)
    // 3D 相机自管理：无底部 zoom slider / 无节点悬停引导
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(0)
    expect(screen.queryByTestId('figure-hint')).not.toBeInTheDocument()
  })

  it('shows the unsupported overlay for Q₈ (no scene canvas)', () => {
    const { container } = render(
      <ViewWindow view="symmetry" group={q8} title="Q₈ Sym" storageKey="sym-unsupported"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 380, height: 280 }} />,
    )
    expect(container.querySelectorAll('[data-testid="r3f-canvas"]')).toHaveLength(0)
    expect(screen.getByText('symmetry.unsupported')).toBeInTheDocument()
    expect(screen.getByText('symmetry.supported')).toBeInTheDocument()
  })

  it('params panel: show-action reveals the element list; no shape section for cyclic', () => {
    render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Sym" storageKey="sym-panel"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }} />,
    )
    const panel = openPanel()
    expect(screen.getByText('Symmetry View')).toBeInTheDocument()
    // speed 滑杆与元素列表仅在 Show action 开启后出现
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(0)
    expect(panel.querySelector('[data-testid="sym-action-list"]')).toBeNull()
    fireEvent.click(screen.getByText('Show element actions').querySelector('input')!)
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
    const list = panel.querySelector('[data-testid="sym-action-list"]')
    expect(list).not.toBeNull()
    expect(rowsOf(panel)).toHaveLength(4) // C₄ 全部元素
    expect(screen.getByText('Figure caption (group name + geometry, in-scene)')).toBeInTheDocument()
    // 循环群无对偶多面体 → 无 Solid shape 选项
    expect(screen.queryByText('Solid shape')).not.toBeInTheDocument()
  })

  it('offers shape options only for cube/icosahedron groups (S₄: Cube / Octahedron)', () => {
    render(
      <ViewWindow view="symmetry" group={s4} title="S₄ Sym" storageKey="sym-dual"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }} />,
    )
    openPanel()
    expect(screen.getByText('Solid shape')).toBeInTheDocument()
    expect(screen.getByText('Cube')).toBeInTheDocument()
    expect(screen.getByText('Octahedron')).toBeInTheDocument()
  })

  it('lists all elements; row click starts demo → re-click replays (no toggle-off) → Reset clears (controlled)', async () => {
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<SymmetryViewParams>({ showAction: true })
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as SymmetryViewParams)
      }
      return (
        <ViewWindow view="symmetry" group={c4} title="C₄ Sym" storageKey="sym-rows"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    const { container } = render(<Controlled />)
    const panel = openPanel()
    const rows = rowsOf(panel)
    expect(rows).toHaveLength(4)
    // 未选元素：无状态浮条、无面板 Reset 按钮
    expect(container.querySelector('[data-testid="sym-demo-hint"]')).toBeNull()
    expect(screen.queryByTestId('sym-panel-reset')).toBeNull()
    // 点第 2 行（非恒等）→ 上报该元素 id，且状态浮条出现
    fireEvent.click(rows[1]!)
    const last = received.at(-1) as { actionElementId?: string }
    expect(c4.elements.some(e => e.id === last.actionElementId)).toBe(true)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="sym-demo-hint"]')).not.toBeNull()
    })
    expect(screen.getByTestId('sym-panel-reset')).toBeInTheDocument()
    // 再点同一行 → 重播语义：不再 toggle 清空，onViewParamsChange 不上报、浮条保持可见
    const rc = received.length
    const rows2 = rowsOf(panel)
    expect(rows2[1]!.getAttribute('title')).toBe('Replay this action')
    fireEvent.click(rows2[1]!)
    expect(received.length).toBe(rc) // 本地重放信号，不触发受控回传
    expect(container.querySelector('[data-testid="sym-demo-hint"]')).not.toBeNull()
    // 浮条 ⟳ Replay 同样走本地重放，不触发受控回传
    fireEvent.click(screen.getByTestId('sym-demo-replay'))
    expect(received.length).toBe(rc)
    expect(container.querySelector('[data-testid="sym-demo-hint"]')).not.toBeNull()
    // 浮条 ✕ Reset → 上报 actionElementId null，浮条消失（几何体回到恒等姿态）
    fireEvent.click(screen.getByTestId('sym-demo-reset'))
    expect((received.at(-1) as { actionElementId?: string }).actionElementId).toBeNull()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="sym-demo-hint"]')).toBeNull()
    })
  })

  it('fires onViewParamsChange for shape (variant) / rotateSpeed (controlled mode)', () => {
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<SymmetryViewParams>({ showAction: true })
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as SymmetryViewParams)
      }
      return (
        <ViewWindow view="symmetry" group={s4} title="S₄ Sym" storageKey="sym-ctl"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    render(<Controlled />)
    const panel = openPanel()
    // 切到对偶形正八面体
    fireEvent.click(screen.getByText('Octahedron'))
    expect(received.at(-1)).toEqual({ showAction: true, variant: true })
    // 切回主形正方体
    fireEvent.click(screen.getByText('Cube'))
    expect(received.at(-1)).toEqual({ showAction: true, variant: false })
    // speed
    fireEvent.change(panel.querySelector('input[type="range"]')!, { target: { value: '2.5' } })
    expect(received.at(-1)).toEqual({ showAction: true, variant: false, rotateSpeed: 2.5 })
  })

  it('falls back to defaults when persisted params fail the symmetry schema', () => {
    localStorage.setItem(
      'gv-vw-sym-bad',
      JSON.stringify({
        __gvVersion: 1,
        data: {
          position: { x: 10, y: 10 },
          size: { width: 300, height: 260 },
          config: {},
          viewParams: { rotateSpeed: 99, showAction: 'yes', variant: 'bogus' },
        },
      }),
    )
    render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Sym" storageKey="sym-bad"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }} />,
    )
    const panel = openPanel()
    // 不崩溃，坏值整体回退默认（Show action 关 → 无 speed 滑杆 / 无元素列表）
    const actionBox = screen.getByText('Show element actions').querySelector('input') as HTMLInputElement
    expect(actionBox.checked).toBe(false)
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(0)
    expect(panel.querySelector('[data-testid="sym-action-list"]')).toBeNull()
  })

  it('actionLocked: element list & Reset are hidden, fixed element read-only; Replay still available, speed adjustable', async () => {
    const { container } = render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Fixed" storageKey="sym-fixed"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }}
        config={{ actionLocked: true }}
        viewParams={{ showAction: true, actionElementId: c4.elements[1]!.id }} />,
    )
    // 预置固定元素 mount 即演示 → 浮条出现，且只带 ⟳ Replay（✕ Reset 被 actionLocked 隐藏）
    await waitFor(() => {
      expect(container.querySelector('[data-testid="sym-demo-hint"]')).not.toBeNull()
    })
    expect(screen.queryByTestId('sym-demo-reset')).toBeNull()
    expect(screen.getByTestId('sym-demo-replay')).toBeInTheDocument()
    const panel = openPanel()
    // ⚙ 面板：无元素列表 / 无行 / 无面板 Reset；只读固定行显示当前钉住的元素
    expect(panel.querySelector('[data-testid="sym-action-list"]')).toBeNull()
    expect(panel.querySelectorAll('[data-testid="sym-action-row"]')).toHaveLength(0)
    expect(panel.querySelector('[data-testid="sym-panel-reset"]')).toBeNull()
    const fixed = panel.querySelector('[data-testid="sym-action-fixed"]')
    expect(fixed).not.toBeNull()
    expect(fixed!.textContent!.trim().length).toBeGreaterThan(0)
    // 仅锁演示元素：showAction 勾选保持、Speed 滑杆仍可调
    expect((screen.getByText('Show element actions').querySelector('input') as HTMLInputElement).checked).toBe(true)
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1)
    // 浮条 ⟳ Replay 本地重放仍可用，浮条保持
    fireEvent.click(screen.getByTestId('sym-demo-replay'))
    expect(container.querySelector('[data-testid="sym-demo-hint"]')).not.toBeNull()
  })

  it('actionLocked without a preset element shows the read-only placeholder (no list, no demo, no reset)', () => {
    const { container } = render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Fixed" storageKey="sym-fixed-empty"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 320 }}
        config={{ actionLocked: true }}
        viewParams={{ showAction: true }} />,
    )
    const panel = openPanel()
    expect(panel.querySelector('[data-testid="sym-action-list"]')).toBeNull()
    expect(panel.querySelector('[data-testid="sym-action-fixed"]')).not.toBeNull()
    expect(panel.textContent).toMatch(/No fixed element/)
    expect(screen.queryByTestId('sym-panel-reset')).toBeNull()
    // 无活跃元素 → 无演示浮条
    expect(container.querySelector('[data-testid="sym-demo-hint"]')).toBeNull()
  })

  it('default persist key includes the view name (symmetry windows never collide)', async () => {
    render(
      <ViewWindow view="symmetry" group={c4} title="C₄ Sym" defaultPosition={{ x: 20, y: 20 }} />,
    )
    render(
      <ViewWindow view="cayley" group={c4} title="C₄ Cay" defaultPosition={{ x: 60, y: 60 }} />,
    )
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|symmetry'))).toBe(true)
      expect(keys.some(k => k.endsWith('|cayley'))).toBe(true)
    }, { timeout: 1000 })
  })
})

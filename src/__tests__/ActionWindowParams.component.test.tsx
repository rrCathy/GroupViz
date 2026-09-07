import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import type { ActionViewParams } from '../core/types/viewConfig'

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string, params?: Record<string, string>) => {
    let out = k
    if (params) for (const [key, val] of Object.entries(params)) out = out.replace(`{${key}}`, val)
    return out
  } }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const s3 = createSymmetricGroup(3)!

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

const renderWindow = (storageKey: string, viewParams?: ActionViewParams, controlled?: { onChange: (p: ViewParams) => void }) =>
  render(
    controlled ? (
      <ControlledActionWindow storageKey={storageKey} viewParams={viewParams ?? {}} onChange={controlled.onChange} />
    ) : (
      <ViewWindow view="action" group={s3} title="S₃ action" storageKey={storageKey}
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} viewParams={viewParams} />
    ),
  )

function ControlledActionWindow({ storageKey, viewParams, onChange }: { storageKey: string; viewParams: ViewParams; onChange: (p: ViewParams) => void }) {
  const [p, setP] = useState<ViewParams>(viewParams)
  return (
    <ViewWindow view="action" group={s3} title="S₃ action" storageKey={storageKey}
      defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }}
      viewParams={p} onViewParamsChange={next => { onChange(next); setP(next) }} />
  )
}

describe('ViewWindow · action view (conjugation / regular / custom)', () => {
  beforeEach(() => localStorage.clear())

  it('conjugation 缺省渲染：6 环节点、3 条轨道 glow 圈、窗口单行 banner（公式）、无节点常驻标签', () => {
    const { container } = renderWindow('act-conj')
    const win = container.firstElementChild as HTMLElement
    expect(win.querySelectorAll('[data-testid^="action-node-"]')).toHaveLength(6)
    // S₃ 共轭类 = {e}(1) + {r,r²}(2) + {s,sr,sr²}(3) → 3 条轨道虚线 glow 圈
    expect(win.querySelectorAll('circle[stroke-dasharray="4 6"]')).toHaveLength(3)
    // 窗口 banner 收敛为一行公式（kind 名在窗口标题栏，主画布两行完整说明不受影响）
    expect(win.textContent).toContain('g·x = g·x·g⁻¹')
    expect(win.textContent).not.toContain('action.viewTitle.conjugation')
    expect(win.textContent).not.toContain('action.edgeBlurb')
    // 窗口缺省：节点空圈（无 foreignObject 标签、无顶部轨道 chips 区）
    expect(win.querySelectorAll('foreignObject')).toHaveLength(0)
  })

  it('参数面板切 Translation → regular 传递作用：单轨道 6 节点、banner 换公式', () => {
    const { container } = renderWindow('act-reg')
    const win = container.firstElementChild as HTMLElement
    openPanel()
    fireEvent.click(screen.getByTestId('action-kind-regular'))
    expect(win.querySelectorAll('[data-testid^="action-node-"]')).toHaveLength(6)
    // regular 传递 → 唯一轨道：1 条 glow 实线选中样式虚线 = 1
    expect(win.querySelectorAll('circle[stroke-dasharray="4 6"]')).toHaveLength(1)
    expect(win.textContent).toContain('g·x = g·x')
  })

  it('custom 编辑流：进入编辑器 → Complete & verify 空箭头平凡作用 → 6 不动点展示态', () => {
    const received: Array<Record<string, unknown>> = []
    const { container } = renderWindow('act-custom', {}, { onChange: p => received.push({ ...(p as Record<string, unknown>) }) })
    const win = container.firstElementChild as HTMLElement
    openPanel()
    fireEvent.click(screen.getByTestId('action-kind-custom'))
    // 编辑器：S₃ 生成元 chips（2 个 foreignObject）+ 数字节点 6
    expect(win.querySelectorAll('[data-testid^="action-edit-node-"]')).toHaveLength(6)
    expect(win.textContent).toContain('action.editHint')
    fireEvent.click(screen.getByTestId('action-edit-complete'))
    // 平凡作用（空 arrows）合法：写回 viewParams 并退出编辑
    expect(received.at(-1)).toEqual({ actionKind: 'custom', setSize: 6, arrows: [] })
    expect(win.querySelectorAll('[data-testid^="action-edit-node-"]')).toHaveLength(0)
    expect(win.querySelectorAll('[data-testid^="action-node-"]')).toHaveLength(6)
    // 全部不动点：custom 显示态为数字节点（1..6），6 个 ★ 标记
    const stars = Array.from(win.querySelectorAll('text')).filter(t => t.textContent === '★')
    expect(stars).toHaveLength(6)
  })

  it('hover 共轭节点 → 就地气泡出现并可移出关闭', () => {
    const { container } = renderWindow('act-hover')
    const win = container.firstElementChild as HTMLElement
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
    fireEvent.mouseEnter(win.querySelector('[data-testid="action-node-0"]')!)
    expect(win.querySelector('[data-testid="hover-hud"]')).not.toBeNull()
    fireEvent.mouseLeave(win.querySelector('[data-testid="action-node-0"]')!)
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
  })

  it('持久化坏 actionKind（sylow）→ schema 拒绝回退 conjugation；坏生成元 → noAction 兜底', () => {
    localStorage.setItem('gv-vw-act-bad-kind', JSON.stringify({
      position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, config: {},
      viewParams: { actionKind: 'sylow' },
    }))
    const { container } = renderWindow('act-bad-kind')
    const win = container.firstElementChild as HTMLElement
    expect(win.textContent).toContain('g·x = g·x·g⁻¹')

    localStorage.setItem('gv-vw-act-bad-gen', JSON.stringify({
      position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, config: {},
      viewParams: { actionKind: 'custom', setSize: 6, arrows: [{ generatorId: 'bogus', from: 0, to: 1 }] },
    }))
    const { container: c2 } = renderWindow('act-bad-gen')
    const win2 = c2.firstElementChild as HTMLElement
    // 箭头引用未知生成元 → buildActionComputation 失败 → computation null → noAction
    expect(win2.textContent).toContain('action.noAction')
  })

  it('Show labels 开启 → 顶部轨道 chips 区与节点标签出现（6 chips + 6 节点 foreignObject）', () => {
    const { container } = renderWindow('act-labels')
    const win = container.firstElementChild as HTMLElement
    expect(win.querySelectorAll('foreignObject')).toHaveLength(0)
    openPanel()
    fireEvent.click(screen.getByText('Show labels').querySelector('input')!)
    expect(win.querySelectorAll('foreignObject')).toHaveLength(12)
  })

  it('custom 已验证 arrows 持久化并恢复展示态（重开窗口直接显示）', async () => {
    renderWindow('act-persist')
    openPanel()
    fireEvent.click(screen.getByTestId('action-kind-custom'))
    fireEvent.click(screen.getByTestId('action-edit-complete'))
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-act-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { data: { viewParams: { actionKind?: string; setSize?: number; arrows?: unknown[] } } }
      expect(env.data.viewParams.actionKind).toBe('custom')
      expect(env.data.viewParams.setSize).toBe(6)
      expect(Array.isArray(env.data.viewParams.arrows)).toBe(true)
    }, { timeout: 1000 })
  })
})

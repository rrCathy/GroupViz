import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useContext } from 'react'
import { I18nProvider } from '../i18n/I18nContext'
import { GroupProvider, GroupContext } from '../context/GroupContext'
import { FloatingViewWindow } from '../components/Canvas/FloatingViewWindow'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { resetAllViewWindows } from '../utils/resetViewWindows'
import type { ViewMode } from '../core/types'

/**
 * 老式壳（应用浮窗）行为基线 —— 窗口框架融合（W-1）之前先钉住现状行为。
 *
 * 背景：`floatingView/FloatingViewWindow.tsx` 此前**零直接测试**，而 W-1 要把它自带的
 * 拖动/resize/z 序换成共享 hook（`useWindowDragResize` + `geometry.clampResize`）。
 * 没有基线就等于改了没人挡，所以本文件先锁四件事：渲染与视图分发、拖动、resize（含最小尺寸）、
 * 关闭、置顶。断言只写**行为**（位置/尺寸/存在性），不锁手柄数量——手柄数量是 W-1 要改的。
 */

function Harness({ group = 'S_{3}' }: { group?: string }) {
  const ctx = useContext(GroupContext)
  if (!ctx) return null
  return (
    <>
      <button data-testid="load" onClick={() => {
        const g = createGroupFromSymbol(group)
        if (g) ctx.setCurrentGroup(g)
      }}>load</button>
      {/* openFloatingView 被 multiViewMode 门控（GroupMultiViewContext.tsx:50），先开多视图模式 */}
      <button data-testid="multi" onClick={() => ctx.toggleMultiViewMode()}>multi</button>
      <button data-testid="open-cayley" onClick={() => ctx.openFloatingView('cayley')}>open cayley</button>
      <button data-testid="open-table" onClick={() => ctx.openFloatingView('table')}>open table</button>
      <button data-testid="open-sylow" onClick={() => ctx.openFloatingView('sylow')}>open sylow</button>
      <div data-testid="window-count">{ctx.floatingViews.length}</div>
      <div data-testid="sel-count">{ctx.selectedElements.size}</div>
      <div data-testid="element-1-label">{ctx.currentGroup?.elements[1].label ?? ''}</div>
      {ctx.floatingViews.map(fv => (
        <FloatingViewWindow key={fv.id} id={fv.id} view={fv.view as ViewMode} title={fv.title} />
      ))}
    </>
  )
}

const setup = (group = 'S_{3}') => {
  const utils = render(
    <I18nProvider>
      <GroupProvider>
        <Harness group={group} />
      </GroupProvider>
    </I18nProvider>,
  )
  fireEvent.click(screen.getByTestId('load'))
  fireEvent.click(screen.getByTestId('multi'))
  return utils
}

const openWindow = async (testId = 'open-cayley') => {
  const before = document.querySelectorAll('.floating-view-window').length
  fireEvent.click(screen.getByTestId(testId))
  await waitFor(() => expect(document.querySelectorAll('.floating-view-window').length).toBe(before + 1))
  // 开第二个窗时 document.querySelector 会返回第一个 ⇒ 一律取最后一个
  const all = document.querySelectorAll('.floating-view-window')
  return all[all.length - 1] as HTMLElement
}

beforeEach(() => localStorage.clear())

describe('老式壳基线 · 渲染与视图分发', () => {
  it('打开后渲染 fixed 定位窗口：标题 + 内容区', async () => {
    setup()
    const win = await openWindow()
    expect(win.style.position).toBe('fixed')
    // 标题来自 i18n 视图标签（随语言变化，故只断言非空）
    const bar = win.querySelector('.floating-view-titlebar') as HTMLElement
    expect(bar.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    expect(win.querySelector('.floating-view-content')).not.toBeNull()
    // 凯莱视图内容真的画出来了（自绘件里有 svg）
    expect(win.querySelector('.floating-view-content svg')).not.toBeNull()
  })

  it('不同 view 派发到不同内容（table 走表格路径）', async () => {
    setup()
    const win = await openWindow('open-table')
    expect(win.querySelector('.floating-view-content')).not.toBeNull()
    // 表格视图的稳定标志：TableView 的 svg 带 view-svg class（凯莱自绘件没有）
    expect(win.querySelector('.floating-view-content svg.view-svg')).not.toBeNull()
    // S₃ 非大表：不出策略条（策略条只在 isLargeTable 分支）
    expect(win.querySelector('.table-strategy-bar')).toBeNull()
  })
})

describe('老式壳基线 · 拖动与 resize', () => {
  it('标题栏拖动移动位置，且不允许移出左/上边界', async () => {
    setup()
    const win = await openWindow()
    const left0 = parseFloat(win.style.left)
    fireEvent.mouseDown(win.querySelector('.floating-view-titlebar') as HTMLElement, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(win, { clientX: 160, clientY: 140 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.left)).toBeCloseTo(left0 + 60, 0))

    // 反向拖到负值 → 钳到 0
    const leftNow = parseFloat(win.style.left)
    fireEvent.mouseDown(win.querySelector('.floating-view-titlebar') as HTMLElement, { clientX: 400, clientY: 400 })
    fireEvent.mouseMove(win, { clientX: 400 - leftNow - 200, clientY: 0 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.left)).toBe(0))
  })

  it('拖右下角改变尺寸，且不小于最小尺寸', async () => {
    setup()
    const win = await openWindow()
    const w0 = parseFloat(win.style.width)
    const h0 = parseFloat(win.style.height)
    // 右下角手柄（今天唯一的手柄；W-1 后是 se 角）
    const handle = (win.querySelector('.floating-view-resizer')
      ?? win.querySelector('[style*="nwse-resize"]')) as HTMLElement
    expect(handle).not.toBeNull()

    fireEvent.mouseDown(handle, { clientX: 500, clientY: 500 })
    fireEvent.mouseMove(win, { clientX: 560, clientY: 540 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.width)).toBeCloseTo(w0 + 60, 0))
    expect(parseFloat(win.style.height)).toBeCloseTo(h0 + 40, 0)

    // 反向拖到极小 → 钳到最小尺寸（不小于 280×180）
    fireEvent.mouseDown(handle, { clientX: 500, clientY: 500 })
    fireEvent.mouseMove(win, { clientX: 500 - w0 - 400, clientY: 500 - h0 - 400 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.width)).toBeGreaterThanOrEqual(280))
    expect(parseFloat(win.style.height)).toBeGreaterThanOrEqual(180)
  })
})

describe('W-1 共享几何（与 ViewWindow 同一份 hook + clampResize）', () => {
  it('窗口有 8 向 resize 手柄（改造前只有右下 1 个）', async () => {
    setup()
    const win = await openWindow()
    const dirs = Array.from(win.querySelectorAll('[data-resize-dir]')).map(e => e.getAttribute('data-resize-dir'))
    expect(dirs.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
    // 右下角保留原有装饰三角作抓取提示
    expect(win.querySelector('[data-resize-dir="se"] svg')).not.toBeNull()
  })

  it('拖左上角手柄同时改位置与尺寸（旧实现只有右下角，结构上做不到）', async () => {
    setup()
    const win = await openWindow()
    const p0 = { x: parseFloat(win.style.left), y: parseFloat(win.style.top) }
    const s0 = { w: parseFloat(win.style.width), h: parseFloat(win.style.height) }
    const handle = win.querySelector('[data-resize-dir="nw"]') as HTMLElement
    expect(handle).not.toBeNull()

    fireEvent.mouseDown(handle, { clientX: 300, clientY: 300 })
    fireEvent.mouseMove(win, { clientX: 340, clientY: 330 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.width)).toBeCloseTo(s0.w - 40, 0))
    // 西/北边内缩 ⇒ 左上角随之右移下移同样距离
    expect(parseFloat(win.style.left)).toBeCloseTo(p0.x + 40, 0)
    expect(parseFloat(win.style.top)).toBeCloseTo(p0.y + 30, 0)
    expect(parseFloat(win.style.height)).toBeCloseTo(s0.h - 30, 0)
  })

  it('拖东边手柄只改宽度、不动位置（四边手柄与角手柄区分）', async () => {
    setup()
    const win = await openWindow()
    const p0 = { x: parseFloat(win.style.left), y: parseFloat(win.style.top) }
    const w0 = parseFloat(win.style.width)
    const h0 = parseFloat(win.style.height)
    const handle = win.querySelector('[data-resize-dir="e"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 600, clientY: 300 })
    fireEvent.mouseMove(win, { clientX: 650, clientY: 380 })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.width)).toBeCloseTo(w0 + 50, 0))
    expect(parseFloat(win.style.height)).toBeCloseTo(h0, 1)
    expect(parseFloat(win.style.left)).toBeCloseTo(p0.x, 1)
    expect(parseFloat(win.style.top)).toBeCloseTo(p0.y, 1)
  })
})

describe('W-2 共享持久化（gv-vw-*，键由 view 派生）', () => {
  const DRAG = { dx: 90, dy: 55 }

  const dragTitlebarBy = async (win: HTMLElement, dx: number, dy: number) => {
    fireEvent.mouseDown(win.querySelector('.floating-view-titlebar') as HTMLElement, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(win, { clientX: 200 + dx, clientY: 200 + dy })
    fireEvent.mouseUp(win)
    await waitFor(() => expect(parseFloat(win.style.left)).toBeGreaterThan(0))
  }

  it('拖动后写入版本化信封（防抖），键为 gv-vw-fv-<view>', async () => {
    setup()
    const win = await openWindow()
    const left0 = parseFloat(win.style.left)
    await dragTitlebarBy(win, DRAG.dx, DRAG.dy)
    await waitFor(() => expect(parseFloat(win.style.left)).toBeCloseTo(left0 + DRAG.dx, 0))

    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-fv-cayley')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { __gvVersion: number; data: { position: { x: number; y: number } } }
      expect(env.__gvVersion).toBe(1)
      expect(Math.round(env.data.position.x)).toBe(Math.round(left0 + DRAG.dx))
    }, { timeout: 1500 })
  })

  it('重新挂载后从存档还原位置与尺寸（刷新即还原）', async () => {
    const first = setup()
    const win = await openWindow()
    const left0 = parseFloat(win.style.left)
    await dragTitlebarBy(win, DRAG.dx, DRAG.dy)
    await waitFor(() => expect(parseFloat(win.style.left)).toBeCloseTo(left0 + DRAG.dx, 0))
    const movedLeft = parseFloat(win.style.left)
    const movedTop = parseFloat(win.style.top)
    await vi.waitFor(() => expect(localStorage.getItem('gv-vw-fv-cayley')).not.toBeNull(), { timeout: 1500 })

    // 卸载整棵树（等价于刷新页面）后重新挂载 → 新窗口读存档
    first.unmount()
    setup()
    const win2 = await openWindow()
    expect(win2.style.left).toBe(`${movedLeft}px`)
    expect(win2.style.top).toBe(`${movedTop}px`)
  })

  it('全局重置广播：位置回默认并清掉本窗存档', async () => {
    setup()
    const win = await openWindow()
    const defaultLeft = parseFloat(win.style.left)
    await dragTitlebarBy(win, DRAG.dx, DRAG.dy)
    await waitFor(() => expect(parseFloat(win.style.left)).toBeCloseTo(defaultLeft + DRAG.dx, 0))
    await vi.waitFor(() => expect(localStorage.getItem('gv-vw-fv-cayley')).not.toBeNull(), { timeout: 1500 })

    act(() => resetAllViewWindows())

    await waitFor(() => expect(parseFloat(win.style.left)).toBeCloseTo(defaultLeft, 0))
    expect(parseFloat(win.style.width)).toBeCloseTo(500, 0)
  })
})

describe('W-3 应用浮窗内容与面板对齐内核', () => {
  it('标题栏 ⚙ 打开参数面板（与内核同一个 ViewParamsPanel）', async () => {
    setup()
    const win = await openWindow()
    expect(screen.queryByText('View Config')).toBeNull()
    fireEvent.click(screen.getByTestId('float-params-toggle'))
    expect(screen.getByText('View Config')).toBeInTheDocument()
    expect(screen.getByText('Cayley View')).toBeInTheDocument()
    // 面板在窗**外**（兄弟节点）：窗内会被 overflow:hidden 裁掉
    expect(win.contains(screen.getByText('View Config'))).toBe(false)
  })

  it('面板改参数真的改变画面：调节点半径 → 圆半径变；开阶徽标 → 出徽标文本', async () => {
    setup()
    const win = await openWindow()
    fireEvent.click(screen.getByTestId('float-params-toggle'))
    const content = win.querySelector('.floating-view-content') as HTMLElement

    // 迁移前这是自绘件（不消费 viewParams）⇒ 这里点任何控件都不会改变画面
    // ① 节点半径滑杆（cayley 面板第一个 range）
    const r0 = content.querySelector('circle')!.getAttribute('r')
    const range = document.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(range, { target: { value: '45' } })
    await waitFor(() => expect(content.querySelector('circle')!.getAttribute('r')).not.toBe(r0))

    // ② 阶徽标（F2）：打开后节点上多出 order 文本
    const texts0 = content.querySelectorAll('text').length
    fireEvent.click(screen.getByTestId('cayley-order-badge'))
    await waitFor(() => expect(content.querySelectorAll('text').length).toBeGreaterThan(texts0))
  })

  it('注释（DEC-2）在应用浮窗里可用：加一条 → 图上出现注释叠层', async () => {
    setup()
    const win = await openWindow()
    fireEvent.click(screen.getByTestId('float-params-toggle'))

    expect(win.querySelector('[data-testid="cayley-annotations"]')).toBeNull()
    const ref = screen.getByTestId('element-1-label').textContent!
    fireEvent.change(screen.getByTestId('annotation-ref'), { target: { value: ref } })
    fireEvent.change(screen.getByTestId('annotation-text'), { target: { value: 'g^2=e' } })
    fireEvent.click(screen.getByTestId('annotation-add'))

    await waitFor(() => {
      const overlay = win.querySelector('[data-testid="cayley-annotations"]') as SVGGElement | null
      expect(overlay).not.toBeNull()
      expect(overlay!.querySelectorAll('foreignObject')).toHaveLength(1)
    })
  })

  it('未迁视图（如 sylow）不给 ⚙ 入口——避免挂上一排不生效的死控件', async () => {
    setup()
    const win = await openWindow('open-sylow')
    expect(win.querySelector('[data-testid="float-params-toggle"]')).toBeNull()
  })

  it('已迁视图（table）给 ⚙ 入口，且内容仍是 TableView', async () => {
    setup()
    const win = await openWindow('open-table')
    expect(win.querySelector('[data-testid="float-params-toggle"]')).not.toBeNull()
    expect(win.querySelector('.floating-view-content svg.view-svg')).not.toBeNull()
  })

  it('选中仍与主画布共享（融合保留的行为）：浮窗里选中 → 主画布选中集合同步', async () => {
    setup()
    const win = await openWindow()
    const circle = win.querySelector('.floating-view-content circle') as SVGCircleElement
    expect(circle).not.toBeNull()

    expect(screen.getByTestId('sel-count').textContent).toBe('0')
    fireEvent.click(circle)
    await waitFor(() => expect(screen.getByTestId('sel-count').textContent).toBe('1'))
  })
})

describe('老式壳基线 · 关闭与置顶', () => {
  it('标题栏 × 关闭后窗口消失（走 closeFloatingView）', async () => {
    setup()
    const win = await openWindow()
    expect(screen.getByTestId('window-count').textContent).toBe('1')
    const closeBtn = Array.from(win.querySelectorAll('button')).find(b => b.textContent === '×') as HTMLElement
    expect(closeBtn).not.toBeUndefined()
    fireEvent.click(closeBtn)
    await waitFor(() => expect(screen.getByTestId('window-count').textContent).toBe('0'))
    expect(document.querySelector('.floating-view-window')).toBeNull()
  })

  it('点击窗口把它提到最前（zIndex 增大，且后开的窗更高）', async () => {
    setup()
    const w1 = await openWindow('open-cayley')
    const z1 = parseInt(w1.style.zIndex, 10)
    const w2 = await openWindow('open-table')
    const z2 = parseInt(w2.style.zIndex, 10)
    expect(z2).toBeGreaterThan(z1)

    // 点第一个窗 → 它反超
    fireEvent.mouseDown(w1)
    await waitFor(() => expect(parseInt(w1.style.zIndex, 10)).toBeGreaterThan(parseInt(w2.style.zIndex, 10)))
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContext } from 'react'
import { I18nProvider } from '../i18n/I18nContext'
import { GroupProvider, GroupContext } from '../context/GroupContext'
import { shouldKeepSelectionOnViewChange } from '../context/core/GroupCoreContext'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { RightPanel } from '../components/Panels/RightPanel'
import type { ViewMode } from '../core/types'

const ELEMENT_VIEWS: ViewMode[] = ['set', 'cayley', 'cycle', 'table', '3d']
const OTHER_VIEWS: ViewMode[] = [
  'symmetry', 'sublattice', 'homomorphism', 'cosetstrip', 'action', 'sylow', 'tree', 'prestable',
]

describe('shouldKeepSelectionOnViewChange', () => {
  it('元素族内部互切保留选中', () => {
    for (const a of ELEMENT_VIEWS) {
      for (const b of ELEMENT_VIEWS) {
        expect(shouldKeepSelectionOnViewChange(a, b), `${a} → ${b}`).toBe(true)
      }
    }
  })

  it('只要一端不是元素族就清空', () => {
    for (const o of OTHER_VIEWS) {
      for (const e of ELEMENT_VIEWS) {
        expect(shouldKeepSelectionOnViewChange(e, o), `${e} → ${o}`).toBe(false)
        expect(shouldKeepSelectionOnViewChange(o, e), `${o} → ${e}`).toBe(false)
      }
      expect(shouldKeepSelectionOnViewChange(o, o), `${o} → ${o}`).toBe(false)
    }
  })

  it('用户报的场景：陪集条带 ↔ sylow 不保留', () => {
    expect(shouldKeepSelectionOnViewChange('sylow', 'cosetstrip')).toBe(false)
    expect(shouldKeepSelectionOnViewChange('cosetstrip', 'sylow')).toBe(false)
  })
})

function Harness() {
  const ctx = useContext(GroupContext)
  if (!ctx) return null
  const group = ctx.currentGroup
  return (
    <>
      <button data-testid="load" onClick={() => {
        const g = createGroupFromSymbol('S_{3}')
        if (g) ctx.setCurrentGroup(g)
      }}>load</button>
      <button data-testid="load-s4" onClick={() => {
        const g = createGroupFromSymbol('S_{4}')
        if (g) ctx.setCurrentGroup(g)
      }}>load s4</button>
      <button data-testid="sel0" onClick={() => {
        if (group) ctx.selectElement(group.elements[0].id)
      }}>sel</button>
      <button data-testid="goto-cayley" onClick={() => ctx.setCurrentView('cayley')}>to cayley</button>
      <button data-testid="goto-sylow" onClick={() => ctx.setCurrentView('sylow')}>to sylow</button>
      <div data-testid="sel-count">{ctx.selectedElements.size}</div>
      <div data-testid="view">{ctx.currentView}</div>
      <RightPanel />
    </>
  )
}

function openSubgroupList(container: HTMLElement) {
  const header = Array.from(container.querySelectorAll('button.accordion-header'))
    .find(el => /子群|Subgroup/.test(el.textContent ?? ''))
  if (header) fireEvent.click(header)
}

function setup() {
  const r = render(
    <I18nProvider>
      <GroupProvider>
        <Harness />
      </GroupProvider>
    </I18nProvider>,
  )
  fireEvent.click(screen.getByTestId('load'))
  return r
}

function gotoButtonOf(item: Element): HTMLElement | null {
  const btns = Array.from(item.querySelectorAll('.sg-actions button')) as HTMLElement[]
  return btns.find(b => /跳转|Open/.test(b.textContent ?? '')) ?? null
}

/** 按钮文案绝不能是 i18n key 本身（t() 缺 key 时会回落成 key，界面上就是 `right.gotoCosetStrip`） */
function expectNotRawKey(el: HTMLElement | null, label: string) {
  expect(el, `${label} 不存在`).not.toBeNull()
  expect(el!.textContent ?? '', `${label} 回落成了 key`).not.toMatch(/^right\./)
  expect(el!.getAttribute('title') ?? '', `${label} 的 title 回落成了 key`).not.toMatch(/^right\./)
}

describe('RightPanel 子群列表与视图切换', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('① 同族切换保留选中、跨族切换清空', () => {
    setup()
    fireEvent.click(screen.getByTestId('sel0'))
    expect(screen.getByTestId('sel-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('goto-cayley'))
    expect(screen.getByTestId('sel-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('goto-sylow'))
    expect(screen.getByTestId('sel-count')).toHaveTextContent('0')
  })

  it('② 点子群项只设为陪集候选、不切视图，旁边出现「跳转」按钮', () => {
    const { container } = setup()
    openSubgroupList(container)

    const items = Array.from(container.querySelectorAll('.subgroup-item'))
    expect(items.length).toBeGreaterThan(1)
    expect(gotoButtonOf(items[0])).toBeNull()

    fireEvent.click(items[1])
    // 关键：视图仍是 set，没有被强行跳走
    expect(screen.getByTestId('view')).toHaveTextContent('set')
    // 该子群的元素被选中（作为陪集候选）
    expect(Number(screen.getByTestId('sel-count').textContent)).toBeGreaterThan(0)
    expectNotRawKey(gotoButtonOf(items[1]), '子群跳转按钮')

    fireEvent.click(gotoButtonOf(items[1])!)
    expect(screen.getByTestId('view')).toHaveTextContent('cosetstrip')
  })

  it('② 换一个子群：跳转按钮跟着转移，同时只有一个', () => {
    const { container } = setup()
    openSubgroupList(container)
    const items = Array.from(container.querySelectorAll('.subgroup-item'))

    fireEvent.click(items[1])
    fireEvent.click(items[2])

    const withGoto = items.filter(it => gotoButtonOf(it) !== null)
    expect(withGoto).toHaveLength(1)
    expect(withGoto[0]).toBe(items[2])
  })

  it('③ 列表项只给阶数 + 生成元，不再罗列全部元素', () => {
    const { container } = setup()
    // 用 S₄：A₄ 有 12 个元素，旧实现会把 12 个置换全列出来（约 100 字符），对比明显
    fireEvent.click(screen.getByTestId('load-s4'))
    openSubgroupList(container)

    const items = Array.from(container.querySelectorAll('.subgroup-item'))
    expect(items.length).toBeGreaterThan(5)
    for (const it of items) {
      const order = it.querySelector('.sg-order')?.textContent ?? ''
      // 只取 KaTeX 的视觉层：textContent 会把 MathML 层与 TeX annotation 一起算进来（三份文本）
      const infoEl = it.querySelector('.sg-info')
      const visible = infoEl?.querySelector('.katex-html') ?? infoEl
      const info = visible?.textContent ?? ''
      expect(order).toMatch(/^\d+$/)
      expect(info.length, `|H|=${order} 的列表项：${info}`).toBeLessThan(60)
    }
  })
})

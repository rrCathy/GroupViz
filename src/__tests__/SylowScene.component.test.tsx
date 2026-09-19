import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SylowScene } from '../components/Canvas/SylowScene'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'

// SylowView → SylowScene props 化（阶段 2 批次八）的契约测试。
// 关注三件事：① 受控面（选中/悬停回调、主题作用域）真的由 props 驱动；
// ② 三种布局模式的切换由右侧 chip 点击驱动（circle → coset → two）；
// ③ 空态与缺省 props 不崩。数学正确性由 core 的 sylow.test.ts 负责，这里不重复。

const s3 = createSymmetricGroup(3)
const c6 = createCyclicGroup(6)
const vb = { width: 900, height: 620 }
const ct = { x: 0, y: 0, scale: 1 }

/** 节点圈（r = nodeRadius = 28），按 group.elements 顺序 */
const nodesOf = (container: HTMLElement) => Array.from(container.querySelectorAll('circle[r="28"]'))
/** 右侧 Sylow 子群 chip（工具栏按钮是 .toggle-btn，不冲突） */
const chipsOf = (container: HTMLElement) => Array.from(container.querySelectorAll('button.panel-btn'))

describe('SylowScene 受控面', () => {
  it('节点点击 → onSelect(id, multi)，ctrl/⌘ 置 multi', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} onSelect={onSelect} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const nodes = nodesOf(container)
    expect(nodes).toHaveLength(6)

    fireEvent.click(nodes[0])
    expect(onSelect).toHaveBeenLastCalledWith(s3.elements[0].id, false)

    fireEvent.click(nodes[1], { ctrlKey: true })
    expect(onSelect).toHaveBeenLastCalledWith(s3.elements[1].id, true)

    fireEvent.click(nodes[2], { metaKey: true })
    expect(onSelect).toHaveBeenLastCalledWith(s3.elements[2].id, true)
  })

  it('未传 onSelect / onHover → 交互不抛错（窗口形态的最小配置）', () => {
    const { container } = render(<SylowScene group={s3} viewBoxSize={vb} />)
    expect(() => fireEvent.click(nodesOf(container)[0])).not.toThrow()
    expect(() => fireEvent.mouseEnter(nodesOf(container)[1].parentElement!)).not.toThrow()
  })

  it('selectedElements 受控：被选节点走选中配色（金色描边），其余不变', () => {
    const selected = s3.elements[2].id
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set([selected])} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const nodes = nodesOf(container)
    const strokes = nodes.map(n => n.getAttribute('stroke'))
    expect(strokes[2]).toBe('#ffd93d')
    expect(strokes.filter(s => s === '#ffd93d')).toHaveLength(1)
  })

  it('onHover：进入节点给元素、离开给 null', () => {
    const onHover = vi.fn()
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} onHover={onHover} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const g = nodesOf(container)[0].parentElement!
    fireEvent.mouseEnter(g)
    expect(onHover).toHaveBeenLastCalledWith(s3.elements[0])
    fireEvent.mouseLeave(g)
    expect(onHover).toHaveBeenLastCalledWith(null)
  })
})

describe('SylowScene 主题与空态', () => {
  it('缺省不注入 data-theme（跟随外层），显式传值才注入作用域', () => {
    const a = render(<SylowScene group={c6} viewBoxSize={vb} />)
    expect(a.container.querySelector('[data-theme]')).toBeNull()
    // 根为容器 div（工具栏 + svg 布局），非 svg 本身 —— 与 ActionScene 的形态一致
    expect(a.container.querySelector('svg.view-svg')).toBeTruthy()
    a.unmount()

    const b = render(<SylowScene group={c6} viewBoxSize={vb} theme="light" />)
    const root = b.container.querySelector('[data-theme="light"]')
    expect(root).toBeTruthy()
    expect(root!.querySelector('svg.view-svg')).toBeTruthy()
  })

  it('group=null → 空态文案（真实中文词典，非 key）', () => {
    const { container } = render(<SylowScene group={null} viewBoxSize={vb} />)
    expect(container.textContent).toContain('请先选择一个群')
    expect(container.querySelector('.sylow-view-toolbar')).toBeNull()
  })
})

describe('SylowScene 三种布局模式', () => {
  it('缺省 circle：无陪集条带、无共轭箭头，但出 p 选择与统计行', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelector('.sylow-view-toolbar')).toBeTruthy()
    expect(container.textContent).toContain('n')
    expect(container.querySelectorAll('path[marker-end="url(#sylow-conj-arrow)"]')).toHaveLength(0)
    // 统计行含 |G| = 2^1 · 3
    expect(container.querySelector('.sylow-view-stats')?.textContent ?? '').toContain('3')
  })

  it('点一个 Sylow chip → coset 模式：出陪集条带 + Lagrange 数值行', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const chips = chipsOf(container)
    expect(chips.length).toBe(3) // S₃ 的阶 2 子群有 3 个，全是 Sylow

    fireEvent.click(chips[0])
    // 陪集条带（cosetStripLayout 的 strip rect）+ 底部 |G| = |H|·[G:H] 行（S₃ 取阶 2 子群 → 2·3）
    expect(container.textContent).toContain('|G|=6 = 2·3')
    // 单子群模式下边作用说明切换为 ⟨生成元⟩
    expect(container.querySelector('.sylow-view-edgeaction')?.textContent ?? '').not.toBe('')
  })

  it('再 ctrl 点第二个 chip → two 模式：出 Sylow II 共轭箭头与共轭元标注', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const chips = chipsOf(container)
    fireEvent.click(chips[0])
    fireEvent.click(chips[1], { ctrlKey: true })

    expect(container.querySelectorAll('path[marker-end="url(#sylow-conj-arrow)"]').length).toBeGreaterThan(0)
    // 共轭元 g 的图内标注（conjLabel）出现在工具栏
    expect(container.querySelector('.sylow-view-edgeaction')?.textContent ?? '').toContain('=')
    // P / Q 子群边各自走自己的 marker
    expect(container.querySelector('#sylow-p-edge')).toBeTruthy()
    expect(container.querySelector('#sylow-q-edge')).toBeTruthy()
  })

  it('再点同一个 chip → 取消选择，回到 circle 模式', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const chip = chipsOf(container)[0]
    fireEvent.click(chip)
    expect(container.textContent).toContain('|G|=6 = 2·3')
    fireEvent.click(chipsOf(container)[0])
    expect(container.textContent).not.toContain('|G|=6 = 2·3')
  })

  it('切换 p（工具栏 toggle-btn）→ 统计行随之换素数', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const toggles = Array.from(container.querySelectorAll('button.toggle-btn'))
    expect(toggles.map(b => b.textContent)).toEqual(['p = 2', 'p = 3', '平面', '纤维化 3D'])

    const statsBefore = container.querySelector('.sylow-view-stats')?.textContent ?? ''
    fireEvent.click(toggles[1])
    const statsAfter = container.querySelector('.sylow-view-stats')?.textContent ?? ''
    expect(statsAfter).not.toBe(statsBefore)
    // S₃ 的 Sylow 3-子群只有 1 个（n₃ = 1）
    expect(chipsOf(container)).toHaveLength(1)
  })
})

describe('SylowScene 列表折叠', () => {
  it('折叠按钮收起右侧列表，展开按钮恢复', () => {
    const { container } = render(
      <SylowScene group={s3} selectedElements={new Set()} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelector('.sylow-view-list')).toBeTruthy()
    fireEvent.click(container.querySelector('button[title]')!) // ▶ 折叠
    expect(container.querySelector('.sylow-view-list')).toBeNull()
    fireEvent.click(container.querySelector('button[title]')!) // ◀ 展开
    expect(container.querySelector('.sylow-view-list')).toBeTruthy()
  })
})

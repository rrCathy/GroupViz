import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AutomorphismScene } from '../components/Canvas/AutomorphismScene'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { createAutomorphismGroup, getAutomorphismMap } from '../core/algebra/automorphisms'

// AutomorphismScene（自同构预览 props 化）契约测试。
// 关注四件事：① 受控面真的由 props 驱动（group + selectedElements）；
// ② 不动点高亮 / 映射表 / 计数与自同构映射一致；③ 空态不崩（四种空输入）；
// ④ 悬停回调与主题作用域。Aut(G) 的数学正确性由 automorphisms.test.ts 负责，这里不重复。

const s3 = createGroupFromSymbol('S_{3}')!
const autS3 = createAutomorphismGroup(s3)! // |Aut(S₃)| = 6
const vb = { width: 360, height: 320 }
const identityAutoId = autS3.elements[0].id
const nonTrivialAutoId = autS3.elements[1].id

/** 父群元素节点圈（circle 上带 data-el-id） */
const nodesOf = (c: HTMLElement) => Array.from(c.querySelectorAll('circle[data-el-id]'))
/** 不动点节点（渲染期打 data-fixed） */
const fixedOf = (c: HTMLElement) => Array.from(c.querySelectorAll('circle[data-fixed="1"]'))

describe('AutomorphismScene 受控面', () => {
  it('选中一个自同构 → 画出父群的图（节点数 = |G|）与重连边', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />,
    )
    expect(nodesOf(container)).toHaveLength(s3.order)
    expect(container.querySelector('svg')).toBeTruthy()

    // 重连边：至少有一条普通边或自环（S₃ 每个元素 × 生成元）
    const lines = container.querySelectorAll('line')
    const loops = container.querySelectorAll('[data-self-loop="1"]')
    expect(lines.length + loops.length).toBeGreaterThan(0)
  })

  it('不动点高亮与自同构映射一致（恒等自同构 → 全不动）', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([identityAutoId])} viewBoxSize={vb} />,
    )
    expect(fixedOf(container)).toHaveLength(s3.order)
  })

  it('非恒等自同构 → 不动点数 = 映射中 k ↦ k 的项数，且少于全群', () => {
    const auto = getAutomorphismMap(autS3)!.get(nonTrivialAutoId)!
    const expected = [...auto.map.entries()].filter(([k, v]) => k === v).length
    expect(expected).toBeGreaterThan(0)
    expect(expected).toBeLessThan(s3.order)

    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />,
    )
    expect(fixedOf(container)).toHaveLength(expected)
  })

  it('selectedElements 受控：换一个自同构 → 高亮跟着换', () => {
    const { container, rerender } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([identityAutoId])} viewBoxSize={vb} />,
    )
    expect(fixedOf(container)).toHaveLength(s3.order)

    rerender(<AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />)
    expect(fixedOf(container).length).toBeLessThan(s3.order)
  })

  it('映射表与计数行随选中出现；showMapping=false 收起映射表', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />,
    )
    expect(container.querySelector('[data-testid="automorphism-mapping"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="automorphism-counts"]')?.textContent).toContain('不动')

    const { container: noMap } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} showMapping={false} />,
    )
    expect(noMap.querySelector('[data-testid="automorphism-mapping"]')).toBeNull()
    expect(noMap.querySelector('svg')).toBeTruthy()
  })

  it('onHover：进入节点给父群元素、离开给 null；不传则不抛错', () => {
    const onHover = vi.fn()
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} onHover={onHover} />,
    )
    const g = nodesOf(container)[0].parentElement!
    fireEvent.mouseEnter(g)
    expect(onHover).toHaveBeenLastCalledWith(s3.elements[0])
    fireEvent.mouseLeave(g)
    expect(onHover).toHaveBeenLastCalledWith(null)

    const { container: bare } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />,
    )
    expect(() => fireEvent.mouseEnter(nodesOf(bare)[0].parentElement!)).not.toThrow()
  })

  it('theme=light → 该子树注入 data-theme 作用域；缺省不注入', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} theme="light" />,
    )
    expect(container.querySelector('[data-theme="light"]')).toBeTruthy()

    const { container: plain } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} viewBoxSize={vb} />,
    )
    expect(plain.querySelector('[data-theme]')).toBeNull()
  })
})

describe('AutomorphismScene 空态', () => {
  const scene = (c: HTMLElement) => c.querySelector('[data-testid="automorphism-scene"]')

  it('group=null → 空态容器，不画图', () => {
    const { container } = render(<AutomorphismScene group={null} viewBoxSize={vb} />)
    expect(scene(container)).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('非自同构群 → 空态（提示不是自同构群）', () => {
    const { container } = render(<AutomorphismScene group={s3} selectedElements={new Set()} viewBoxSize={vb} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(scene(container)?.textContent).toContain('不是自同构群')
  })

  it('自同构群但未选中 / 选中多个 → 空态', () => {
    const { container } = render(<AutomorphismScene group={autS3} selectedElements={new Set()} viewBoxSize={vb} />)
    expect(container.querySelector('svg')).toBeNull()

    const { container: multi } = render(
      <AutomorphismScene
        group={autS3}
        selectedElements={new Set([identityAutoId, nonTrivialAutoId])}
        viewBoxSize={vb}
      />,
    )
    expect(multi.querySelector('svg')).toBeNull()
  })

  it('选中 id 不在自同构表里 → 空态（不崩）', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set(['no-such-auto'])} viewBoxSize={vb} />,
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(scene(container)).toBeTruthy()
  })

  it('不传 viewBoxSize（尺寸自测）也不崩', () => {
    const { container } = render(
      <AutomorphismScene group={autS3} selectedElements={new Set([nonTrivialAutoId])} />,
    )
    expect(scene(container)).toBeTruthy()
  })
})

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CayleyView } from '../components/Canvas/CayleyView'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

const c4 = createCyclicGroup(4)
const d4 = createDihedralGroup(4)
const s3 = createSymmetricGroup(3)
const vb = { width: 600, height: 400 }
const ct = { x: 0, y: 0, scale: 1 }
const noSel = new Set<string>()

// 有向边 = 带 marker-end 的 path（marker 自身的内部 path 不带该属性，不会误计）
const directedEdges = (c: HTMLElement) => c.querySelectorAll('path[marker-end]')

describe('CayleyView (pure props)', () => {
  it('renders C₄ default: 4 nodes, generator edges directed with arrow markers', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(4)
    // C₄ 生成元 a（e1）非自逆 → 4 条右乘边全部有向
    expect(directedEdges(container)).toHaveLength(4)
    // 唯一启用作用 → 1 个 marker 定义
    expect(container.querySelectorAll('marker')).toHaveLength(1)
    // 默认显示标签
    expect(container.querySelectorAll('foreignObject')).toHaveLength(4)
  })

  it('renders identity action as no visible edges (self-loop culled by dist guard, same as main view)', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[{ elementId: c4.identity.id }]} />,
    )
    // 自环 from==to → dist=0 < 1 被裁剪：与主视图 renderEdgePath 行为一致
    expect(container.querySelectorAll('ellipse')).toHaveLength(0)
    expect(directedEdges(container)).toHaveLength(0)
    expect(
      Array.from(container.querySelectorAll('path')).filter(p => !p.closest('marker')),
    ).toHaveLength(0)
  })

  it('renders self-inverse action edges without arrowheads (undirected)', () => {
    // C₄ 的 e2 = a² 自逆：{e,e²} {a,a³} 两条无向边
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[{ elementId: 'e2' }]} />,
    )
    expect(directedEdges(container)).toHaveLength(0)
    const plainEdges = Array.from(container.querySelectorAll('path')).filter(
      p => !p.closest('marker') && !p.hasAttribute('marker-end'),
    )
    expect(plainEdges).toHaveLength(2)
  })

  it('left vs right multiplication produce different edge sets on non-abelian S₃', () => {
    const t = s3.elements.find(e => e.id !== s3.identity.id && s3.inverse(e).id === e.id)!
    const renderEdges = (multiplyType: 'right' | 'left') => {
      const { container } = render(
        <CayleyView group={s3} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
          actions={[{ elementId: t.id }]} multiplyType={multiplyType} />,
      )
      return Array.from(container.querySelectorAll('path'))
        .filter(p => !p.closest('marker'))
        .map(p => p.getAttribute('d'))
        .sort()
        .join(';')
    }
    const right = renderEdges('right')
    const left = renderEdges('left')
    expect(right).not.toBe(left)
  })

  it('renders D₄ default with two generator actions (rotation directed + reflection undirected)', () => {
    const { container } = render(
      <CayleyView group={d4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(8)
    expect(container.querySelectorAll('marker')).toHaveLength(2)
    // r（4 阶）：旋转/反射各 4 条有向边；s（自逆）：4 条无向边
    expect(directedEdges(container)).toHaveLength(8)
    const plainEdges = Array.from(container.querySelectorAll('path')).filter(
      p => !p.closest('marker') && !p.hasAttribute('marker-end'),
    )
    expect(plainEdges).toHaveLength(4)
  })

  it('applies nodeRadius and showLabels props', () => {
    const { container, rerender } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        nodeRadius={40} showLabels={false} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(4)
    container.querySelectorAll('circle').forEach(c => expect(c.getAttribute('r')).toBe('40'))
    expect(container.querySelectorAll('foreignObject')).toHaveLength(0)

    rerender(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        nodeRadius={40} />,
    )
    expect(container.querySelectorAll('foreignObject')).toHaveLength(4)
  })

  it('highlights edges and draws a gold ring for selected elements', () => {
    const sel = new Set(['e1'])
    const { container } = render(
      <CayleyView group={c4} selectedElements={sel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    // 选中金圈 overlay
    expect(container.querySelector('circle[stroke="#ffd93d"]')).not.toBeNull()
    // 与 e1 相关的 2 条边加粗重绘（基础 4 条 2.5 + 高亮 2 条 3.5）
    expect(container.querySelectorAll('path[stroke-width="3.5"]')).toHaveLength(2)
    expect(container.querySelectorAll('path[stroke-width="2.5"]')).toHaveLength(4)
  })

  it('uses unique marker ids per instance (multiple windows do not collide)', () => {
    render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const markers = Array.from(document.querySelectorAll('marker'))
    expect(markers).toHaveLength(2)
    const ids = markers.map(m => m.id)
    expect(new Set(ids).size).toBe(2)
    ids.forEach(id => expect(id).toMatch(/^cv\d+-arrow-\d+$/))
  })

  it('normalizes actions: filters unknown elementIds, defaults enabled/color', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[{ elementId: 'bogus' }, { elementId: 'e1' }]} />,
    )
    // bogus 被过滤，仅 e1 生效；默认 color = COLOR_PALETTE[0]
    expect(container.querySelectorAll('marker')).toHaveLength(1)
    expect(directedEdges(container)).toHaveLength(4)
    const markerPath = container.querySelector('marker path')
    expect(markerPath?.getAttribute('fill')).toBe('#ff6b6b')

    // enabled 缺省 true；显式 false 时不画任何边
    const { container: c2 } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[{ elementId: 'e1', enabled: false }]} />,
    )
    expect(c2.querySelectorAll('marker')).toHaveLength(0)
    expect(directedEdges(c2)).toHaveLength(0)
  })

  it('renders no edges when actions is an explicit empty list', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[]} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(4)
    expect(directedEdges(container)).toHaveLength(0)
  })

  it('shows an empty placeholder when group is null', () => {
    const { container } = render(
      <CayleyView group={null} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        noGroupText="No group" />,
    )
    expect(container.querySelector('.view-empty')).not.toBeNull()
    expect(container.textContent).toContain('No group')
  })
})

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

  it('hoveredElementId draws a cyan ring on that node (visual hover feedback)', () => {
    // 节点外圈 #4ecdc4 高亮环：让"悬停的就是这个节点"一眼可见，配合 ViewWindow 的 HUD 形成双重反馈
    const { container } = render(
      <CayleyView group={d4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        hoveredElementId={d4.elements[0].id} />,
    )
    // 4 个 d4 节点中只有一个高亮环
    const rings = container.querySelectorAll('svg circle[stroke="#4ecdc4"]')
    expect(rings).toHaveLength(1)
    // 环的半径 > 节点半径（nodeRadius=28，环 r=33）
    const ringR = Number((rings[0] as SVGCircleElement).getAttribute('r'))
    expect(ringR).toBeGreaterThan(28)
  })

  it('no hoveredElementId means no hover ring', () => {
    const { container } = render(
      <CayleyView group={d4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelectorAll('svg circle[stroke="#4ecdc4"]')).toHaveLength(0)
  })

  // 回归：宽扁容器（博客内嵌 900×360）里 circular 圆环半径须受高度约束，
  // 否则上下两端节点被裁到画布外（feedback/issue-circular-radius-overflow.md）
  it('keeps every node inside a wide-short viewBox (circular radius bounded by height)', () => {
    const w = 900
    const h = 360
    const r = 28
    const { container } = render(
      <CayleyView group={s3} selectedElements={noSel} canvasTransform={ct}
        viewBoxSize={{ width: w, height: h }} />,
    )
    const nodes = Array.from(container.querySelectorAll('svg circle[r="28"]'))
    expect(nodes).toHaveLength(6)
    let minY = Infinity
    let maxY = -Infinity
    nodes.forEach(c => {
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
        c.parentElement?.getAttribute('transform') ?? '',
      )!
      const y = Number(m[2])
      minY = Math.min(minY, y - r)
      maxY = Math.max(maxY, y + r)
    })
    expect(minY).toBeGreaterThanOrEqual(0)
    expect(maxY).toBeLessThanOrEqual(h)
  })
})

// ── VCL 批次：边曲率 / 路径高亮 / 逐生成元边长 / 动态力导向 ──

/** 解析边 path 的 `M sx sy Q cx cy ex ey` 几何 */
function parseEdgeGeometry(d: string) {
  const m = /^M ([-.\d]+) ([-.\d]+) Q ([-.\d]+) ([-.\d]+) ([-.\d]+) ([-.\d]+)$/.exec(d.trim())
  if (!m) return null
  return {
    sx: Number(m[1]), sy: Number(m[2]),
    cx: Number(m[3]), cy: Number(m[4]),
    ex: Number(m[5]), ey: Number(m[6]),
  }
}

const ctrlOffsetFromChord = (d: string) => {
  const g = parseEdgeGeometry(d)!
  return Math.hypot(g.cx - (g.sx + g.ex) / 2, g.cy - (g.sy + g.ey) / 2)
}

describe('CayleyView · VCL controls', () => {
  it('edgeCurvature=0 makes single-generator edges perfectly straight (ctrl on the chord midpoint)', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        edgeCurvature={0} />,
    )
    const paths = Array.from(container.querySelectorAll('path[marker-end]'))
    expect(paths).toHaveLength(4)
    for (const p of paths) {
      const g = parseEdgeGeometry(p.getAttribute('d')!)!
      expect(Math.abs(g.cx - (g.sx + g.ex) / 2)).toBeLessThan(0.5)
      expect(Math.abs(g.cy - (g.sy + g.ey) / 2)).toBeLessThan(0.5)
    }
  })

  it('default curvature bows the edges off the chord', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const p = container.querySelector('path[marker-end]')!
    expect(ctrlOffsetFromChord(p.getAttribute('d')!)).toBeGreaterThan(1)
  })

  it('parallel edges (two actions on one node pair) fan apart even in straight mode', () => {
    // C₄ 用 e1 / e3 两条作用 → 同一节点对出现两条方向相反的平行边
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        edgeCurvature={0} actions={[{ elementId: 'e1' }, { elementId: 'e3' }]} />,
    )
    const signed = Array.from(container.querySelectorAll('path[marker-end]')).map(p => {
      const g = parseEdgeGeometry(p.getAttribute('d')!)!
      return g.cx - (g.sx + g.ex) / 2
    })
    // 平行边不得双双落在弦上（否则完全重叠看不见），应左右分列
    expect(signed.some(v => v > 1)).toBe(true)
    expect(signed.some(v => v < -1)).toBe(true)
  })

  it('path highlight (word) draws one segment per step', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        pathHighlight={{ word: ['e1', 'e1'] }} />,
    )
    expect(container.querySelectorAll('line')).toHaveLength(2)
  })

  it('path highlight (elements) respects edge direction: unconnected pair → rings only', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        pathHighlight={{ elements: ['e0', 'e3'], color: '#ff0000' }} />,
    )
    expect(container.querySelectorAll('line')).toHaveLength(0)
    expect(container.querySelectorAll('circle[stroke="#ff0000"]')).toHaveLength(2)
  })

  it('path highlight order badges show only for the hovered path node (none without hover)', () => {
    const noHover = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        pathHighlight={{ elements: ['e0', 'e1', 'e2'], showOrder: true }} />,
    )
    expect(Array.from(noHover.container.querySelectorAll('text')).map(t => t.textContent)).toEqual([])
    noHover.unmount()

    // 悬停路径上的第 2 个节点（e1）→ 只显示它的次序徽标
    const hovered = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        hoveredElementId="e1"
        pathHighlight={{ elements: ['e0', 'e1', 'e2'], showOrder: true }} />,
    )
    expect(Array.from(hovered.container.querySelectorAll('text')).map(t => t.textContent)).toEqual(['2'])
  })

  it('path highlight dims every non-path edge by default (dimOthers)', () => {
    const edges = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('path[marker-end], path[stroke]'))
        .filter(p => p.getAttribute('d') !== null)
    const plain = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const plainOpacities = edges(plain.container).map(p => p.getAttribute('opacity'))
    expect(plainOpacities.every(o => o === '0.9')).toBe(true)
    plain.unmount()

    const hi = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        pathHighlight={{ word: ['e1', 'e1'] }} />,
    )
    const hiOpacities = edges(hi.container).map(p => p.getAttribute('opacity'))
    // 4 条生成元边中 2 条在路径上（保持 0.9）、2 条被淡化（0.12）
    expect(hiOpacities.filter(o => o === '0.12')).toHaveLength(2)
    expect(hiOpacities.filter(o => o === '0.9')).toHaveLength(2)
  })

  it('per-generator lengthScale is wired into the layout (node positions change)', () => {
    const nodeTransforms = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('svg circle[r="28"]'))
        .map(c => c.parentElement?.getAttribute('transform') ?? '')
        .sort()
    const plain = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const before = nodeTransforms(plain.container)
    plain.unmount()
    const stretched = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        actions={[{ elementId: 'e1', lengthScale: 2 }]} />,
    )
    const after = nodeTransforms(stretched.container)
    expect(after).toHaveLength(4)
    expect(after).not.toEqual(before)
  })

  it('forceDirected keeps rendering the graph (nodes + edges) with live positions', () => {
    const { container } = render(
      <CayleyView group={c4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb}
        forceDirected />,
    )
    expect(container.querySelectorAll('svg circle[r="28"]')).toHaveLength(4)
    expect(container.querySelectorAll('path[marker-end]')).toHaveLength(4)
  })
})

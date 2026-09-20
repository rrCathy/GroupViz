import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SetView } from '../components/Canvas/SetView'
import { CayleyView } from '../components/Canvas/CayleyView'
import { quotientInsetGeometry } from '../core/viewBox'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'

/**
 * 商群画布新形态（2026-09-20 用户报）：
 *  · 节点 = 普通节点（不再是把陪集成员塞进大圆的复合节点，r=72 → r=26）；
 *  · 正规子群 N 的凯莱图移到右侧独立面板，箭头从恒等陪集节点指过去。
 */
const s4 = createSymmetricGroup(4)!
const v4 = findAllSubgroups(s4).find(sg => sg.isNormal && sg.order === 4)!
const qg = computeQuotientGroup(s4, v4)!
const vb = { width: 800, height: 600 }
const ct = { x: 0, y: 0, scale: 1 }
const noSel = new Set<string>()

describe('商群画布：普通节点 + 正规子群凯莱图面板', () => {
  it('渲染独立面板，内含 |N| 个小节点与内部边', () => {
    const { container } = render(
      <SetView
        group={qg}
        selectedElements={noSel}
        canvasTransform={ct}
        viewBoxSize={vb}
        quotientInsetTitle="正规子群 N 的凯莱图"
      />,
    )
    const inset = container.querySelector('[data-testid="quotient-subgroup-inset"]')
    expect(inset).toBeTruthy()
    expect(inset!.querySelectorAll('[data-testid="inset-node"]').length).toBe(4)
    // N 的凯莱边 = N 自己的最小生成元（V₄ ≅ C₂×C₂：2 个生成元 ⇒ 4 条无向对）
    expect(inset!.querySelectorAll('[data-testid="inset-edge"]').length).toBe(4)
    // 面板标题与 |N| 标注
    expect(inset!.textContent).toContain('正规子群 N 的凯莱图')
    expect(inset!.textContent).toContain('|N| = 4')
  })

  it('悬浮窗可收起成药丸、点药丸再展开', () => {
    const { container } = render(
      <SetView
        group={qg}
        selectedElements={noSel}
        canvasTransform={ct}
        viewBoxSize={vb}
        quotientInsetTitle="正规子群 N 的凯莱图"
      />,
    )
    // 收起：药丸出现，小凯莱图消失
    fireEvent.click(container.querySelector('[data-testid="quotient-inset-toggle"]')!)
    const pill = container.querySelector('[data-testid="quotient-inset-pill"]')
    expect(pill).toBeTruthy()
    expect(container.querySelectorAll('[data-testid="inset-node"]').length).toBe(0)
    expect(pill!.textContent).toContain('|N| = 4')
    // 展开：pointerdown + 原地 pointerup（位移 < 4px 视为点击）
    fireEvent.pointerDown(pill!)
    fireEvent.pointerUp(pill!)
    expect(container.querySelector('[data-testid="quotient-inset-pill"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="inset-node"]').length).toBe(4)
  })

  it('节点是普通节点：不存在复合节点的大圆（r=72）', () => {
    const { container } = render(
      <SetView group={qg} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelectorAll('circle[r="72"]').length).toBe(0)
    // 6 个商群元素 → 6 个常规半径节点
    expect(container.querySelectorAll('circle[r="26"]').length).toBe(6)
  })

  it('图形主体让出右侧面板：圆心偏左（轴线带宽 = 面板宽 + 间距）', () => {
    const { container } = render(
      <SetView group={qg} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    const geom = quotientInsetGeometry(vb)
    expect(geom.drawWidth).toBeLessThan(vb.width)
    // 面板右贴边、上下居中
    expect(geom.panel.x + geom.panel.width).toBeCloseTo(vb.width - 16, 0)
    expect(geom.panel.y + geom.panel.height / 2).toBeCloseTo(vb.height / 2, 0)

    const nodes = [...container.querySelectorAll('circle[r="26"]')]
    const xs = nodes.map(n => Number(n.getAttribute('cx') ?? n.parentElement?.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1] ?? 0))
    // SetView 的网格以 drawWidth 居中：所有节点都在左带内
    expect(Math.max(...xs)).toBeLessThan(geom.panel.x)
  })

  it('平凡正规子群（N = {e}）不画面板（商群 ≅ G，面板无信息量）', () => {
    const trivial = findAllSubgroups(s4).find(sg => sg.order === 1)!
    const q = computeQuotientGroup(s4, trivial)!
    const { container } = render(
      <SetView group={q} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelector('[data-testid="quotient-subgroup-inset"]')).toBeNull()
  })

  it('非商群不画面板', () => {
    const { container } = render(
      <SetView group={s4} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelector('[data-testid="quotient-subgroup-inset"]')).toBeNull()
  })

  it('包内 CayleyView（Scene）同样渲染面板 —— 与主画布同一形态', () => {
    const { container } = render(
      <CayleyView
        group={qg}
        selectedElements={noSel}
        canvasTransform={ct}
        viewBoxSize={vb}
        quotientInsetTitle="正规子群 N 的凯莱图"
      />,
    )
    const inset = container.querySelector('[data-testid="quotient-subgroup-inset"]')
    expect(inset).toBeTruthy()
    expect(inset!.querySelectorAll('[data-testid="inset-node"]').length).toBe(4)
    expect(inset!.querySelectorAll('[data-testid="inset-edge"]').length).toBeGreaterThan(0)
  })
})

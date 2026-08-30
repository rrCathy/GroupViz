import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nContext'
import Workspace from '../Workspace'

function renderWorkspace() {
  return render(
    <I18nProvider>
      <Workspace />
    </I18nProvider>,
  )
}

function getViewCard(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.view-mode-card'))
    .find(b => (b.textContent ?? '').replace(/\s+/g, '').includes(label))
}

describe('Cycle view (Group Explorer style)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders S3 maximal cycles as petals: polygon leaf + order-2 line spokes (not a plain circle)', () => {
    const { container } = renderWorkspace()
    const card = getViewCard(container, '循环图')
    expect(card).toBeDefined()
    fireEvent.click(card!)

    const svg = container.querySelector('svg.view-svg')
    expect(svg).not.toBeNull()

    // GE 花瓣模式（showMaximalCycles 默认 true）：
    //   3 阶循环 → 闭合 <path> 三角叶子；3 个 2 阶循环 → <line> 叶柄。
    // 旧的「全部循环」圆形模式只有彩色虚线 <path>、没有 <line>，
    // 因此 <line> 的存在即证明走的是花瓣布局而非预置圆形。
    const lines = svg!.querySelectorAll('line')
    const paths = svg!.querySelectorAll('path')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(paths.length).toBeGreaterThanOrEqual(1)
  })
})

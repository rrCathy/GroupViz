import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetView } from '../components/Canvas/SetView'
import { CayleyView } from '../components/Canvas/CayleyView'
import { CosetStripScene } from '../components/Canvas/CosetStripScene'
import { SceneThemeRoot } from '../components/Canvas/SceneThemeRoot'
import { SceneHoverBubble } from '../components/Canvas/SceneHoverBubble'
import { useTranslation } from '../i18n/useTranslation'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

const c6 = createCyclicGroup(6)
const s3 = createSymmetricGroup(3)
const vb = { width: 600, height: 400 }
const ct = { x: 0, y: 0, scale: 1 }
const noSel = new Set<string>()

describe('theme 统一（2D Scene 的 theme prop）', () => {
  it('未传 theme → 不注入 data-theme（保留「跟随外层主题」的既有行为，零额外 DOM）', () => {
    const { container } = render(
      <SetView group={c6} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelector('[data-theme]')).toBeNull()
    // 根本身就是 svg（没有多包一层 div）
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('svg')
  })

  it('显式传 theme="light" → 子树内注入 data-theme 作用域', () => {
    const { container } = render(
      <SetView group={c6} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} theme="light" />,
    )
    const root = container.querySelector('[data-theme="light"]')
    expect(root).toBeTruthy()
    expect(root!.querySelector('svg')).toBeTruthy()
  })

  it('theme="dark" 同样注入（显式声明而非继承）', () => {
    const { container } = render(
      <SetView group={c6} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} theme="dark" />,
    )
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy()
  })

  it('CayleyView / CosetStripScene 也接 theme', () => {
    const a = render(
      <CayleyView group={c6} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} theme="light" />,
    )
    expect(a.container.querySelector('[data-theme="light"]')).toBeTruthy()
    a.unmount()

    const b = render(
      <CosetStripScene group={c6} viewBoxSize={vb} cosetElementMap={new Map()} theme="light" />,
    )
    expect(b.container.querySelector('[data-theme="light"]')).toBeTruthy()
  })

  it('SceneThemeRoot 独立可用：无 theme 时透传 children', () => {
    const { container } = render(<SceneThemeRoot><span data-testid="x">hi</span></SceneThemeRoot>)
    expect(container.querySelector('[data-theme]')).toBeNull()
    expect(screen.getByTestId('x')).toBeTruthy()
  })
})

describe('largeGroupThreshold（标签自适应阈值可覆盖）', () => {
  it('缺省 60：C₆ 全部节点显示常驻标签', () => {
    const { container } = render(
      <SetView group={c6} selectedElements={noSel} canvasTransform={ct} viewBoxSize={vb} />,
    )
    expect(container.querySelectorAll('foreignObject')).toHaveLength(6)
  })

  it('阈值调到 2：C₆ 视为大群，选中后仅选中节点显示标签', () => {
    const { container } = render(
      <SetView
        group={c6}
        selectedElements={new Set([c6.elements[1].id])}
        canvasTransform={ct}
        viewBoxSize={vb}
        largeGroupThreshold={2}
      />,
    )
    // 大群 + 有选中 → 只有被选中的那一个渲染常驻标签
    expect(container.querySelectorAll('foreignObject')).toHaveLength(1)
  })

  it('阈值调到 100：C₆ 不触发大群分支（等价缺省）', () => {
    const { container } = render(
      <SetView
        group={c6}
        selectedElements={new Set([c6.elements[1].id])}
        canvasTransform={ct}
        viewBoxSize={vb}
        largeGroupThreshold={100}
      />,
    )
    expect(container.querySelectorAll('foreignObject')).toHaveLength(6)
  })
})

describe('CosetStripScene 便捷入口 subgroup', () => {
  it('只给 H（label 亦可）即可出陪集条带，无需宿主拼三件套', () => {
    const empty = render(<CosetStripScene group={c6} viewBoxSize={vb} cosetElementMap={new Map()} />)
    const emptyRects = empty.container.querySelectorAll('rect').length
    empty.unmount()

    const { container } = render(
      <CosetStripScene group={c6} viewBoxSize={vb} subgroup={['0', '3']} />,
    )
    // 无陪集数据的空态文案不应出现，且实际画出了条带内容（rect 比空态多）
    expect(container.textContent ?? '').not.toContain('canvas.cosetStripNoCosets')
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(emptyRects)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('显式三件套优先于 subgroup 派生', () => {
    const explicit = new Map<string, number>([['e0', 0], ['e3', 0]])
    const { container } = render(
      <CosetStripScene group={c6} viewBoxSize={vb} subgroup={['e0', 'e1']} cosetElementMap={explicit} />,
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

describe('i18n 免 Provider 兜底', () => {
  // 无 <I18nProvider> 包裹时，缺省 t 查真实词典（不再回落成 key）
  function TProbe() {
    const { t } = useTranslation()
    return (
      <span>
        <i data-testid="t-no-group">{t('canvas.noGroup')}</i>
        <i data-testid="t-missing">{t('__definitely_missing_key__')}</i>
        <i data-testid="t-params">{t('canvas.orderTooLarge', { n: 42 })}</i>
      </span>
    )
  }

  it('无 Provider 时返回真实中文；真缺键才回落成 key；params 正常插值', () => {
    render(<TProbe />)
    expect(screen.getByTestId('t-no-group').textContent).toBe('请先选择一个群')
    expect(screen.getByTestId('t-missing').textContent).toBe('__definitely_missing_key__')
    expect(screen.getByTestId('t-params').textContent).toContain('42')
  })

  it('CosetStripScene 的缺省文案也随之为中文', () => {
    const { container } = render(
      <CosetStripScene group={c6} viewBoxSize={vb} cosetElementMap={new Map()} />,
    )
    expect(container.textContent).toContain('在右侧面板点击一个子群以查看陪集')
  })
})

describe('SceneHoverBubble', () => {
  it('有元素 + 锚点 → 渲染 label、id 与阶', () => {
    const el = s3.elements.find(e => e.label !== 'e')!
    render(<SceneHoverBubble element={el} anchor={{ x: 40, y: 60 }} group={s3} />)
    const bubble = screen.getByTestId('scene-hover-bubble')
    expect(bubble.textContent).toContain(el.label)
    expect(bubble.textContent).toContain('阶')
  })

  it('元素缺失或锚点缺失 → 不渲染（避免角落挂一个无主气泡）', () => {
    const a = render(<SceneHoverBubble element={null} anchor={{ x: 1, y: 1 }} />)
    expect(a.container.querySelector('[data-testid="scene-hover-bubble"]')).toBeNull()
    a.unmount()
    const b = render(<SceneHoverBubble element={s3.elements[1]} anchor={null} />)
    expect(b.container.querySelector('[data-testid="scene-hover-bubble"]')).toBeNull()
  })
})

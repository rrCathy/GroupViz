import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { listCosetStripSubgroups } from '../core/algebra/cosetStrip'
import type { CosetStripViewParams } from '../core/types/viewConfig'

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const s3 = createSymmetricGroup(3)!
const a4 = createAlternatingGroup(4)!

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

const stripCount = (container: HTMLElement) =>
  container.querySelectorAll('[data-coset-strip]').length
const nodeCount = (container: HTMLElement) =>
  container.querySelectorAll('[data-coset-node]').length

describe('ViewWindow · cosetstrip view', () => {
  beforeEach(() => localStorage.clear())

  it('renders default subgroup coset strips (S₃ → C₃ 首选，[G:H]=2 → 两条带 × 6 节点)，窗口缺省无标签与凯莱圈', () => {
    const { container } = render(
      <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" storageKey="cs-basic"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(stripCount(win)).toBe(2)
    expect(nodeCount(win)).toBe(6)
    // 窗口缺省：无节点常驻标签、无顶部 H-Cayley 小圈（无 foreignObject）
    expect(win.querySelectorAll('foreignObject')).toHaveLength(0)
    // H 条带标签 + 底部 |G|=|H|·[G:H] 公式行
    expect(win.textContent).toContain('H')
    expect(win.textContent).toContain('|G|=6 = 3·2')
  })

  it('A₄ 首选 H = V₄ → 3 条带；参数面板子群下拉含共轭合并候选（V₄/C₃/C₂）', () => {
    const { container } = render(
      <ViewWindow view="cosetstrip" group={a4} title="A₄ 陪集条带" storageKey="cs-a4"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 440, height: 340 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(stripCount(win)).toBe(3)
    expect(nodeCount(win)).toBe(12)

    const panel = openPanel()
    expect(screen.getByText('Coset Strip View')).toBeInTheDocument()
    const select = panel.querySelector('select') as HTMLSelectElement
    const opts = listCosetStripSubgroups(a4)
    expect(select.options.length).toBe(opts.length) // 3：V₄、C₃×4、C₂×3（共轭合并）
    expect(select.value).toBe(opts[0].key)
    expect(select.textContent).toContain('C₂×C₂')
    expect(select.textContent).toContain('[G:H]3')
  })

  it('切换子群 H（S₃ C₃ → C₂）条带数随之 2 → 3，受控载荷正确', () => {
    const received: Array<Record<string, unknown>> = []
    const opts = listCosetStripSubgroups(s3) // [C₃ (index2), C₂ (index3)]
    function Controlled() {
      const [p, setP] = useState<CosetStripViewParams>({})
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as CosetStripViewParams)
      }
      return (
        <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" storageKey="cs-ctl"
          defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    const { container } = render(<Controlled />)
    const win = container.firstElementChild as HTMLElement
    expect(stripCount(win)).toBe(2)
    const panel = openPanel()

    // C₃ → C₂（选中子群里第二候选）
    fireEvent.change(panel.querySelector('select')!, { target: { value: opts[1].key } })
    expect(received.at(-1)).toEqual({ subgroup: opts[1].elementIds })
    expect(stripCount(win)).toBe(3)

    // 切右陪集
    fireEvent.click(screen.getByTitle('Right cosets Hg (H · row element)'))
    expect(received.at(-1)).toEqual({ subgroup: opts[1].elementIds, cosetType: 'right' })

    // 开标签
    fireEvent.click(screen.getByText('Show node labels').querySelector('input')!)
    expect(received.at(-1)).toEqual({ subgroup: opts[1].elementIds, cosetType: 'right', showLabels: true })
    expect(win.querySelectorAll('foreignObject').length).toBeGreaterThan(0)
  })

  it('hover 节点 → 就地气泡出现并可关闭（窗口缺省无标签，读元素靠气泡）', () => {
    const { container } = render(
      <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" storageKey="cs-hover"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
    const node = win.querySelector('[data-coset-node]') as HTMLElement
    fireEvent.mouseEnter(node)
    const hud = win.querySelector('[data-testid="hover-hud"]')
    expect(hud).not.toBeNull()
    fireEvent.mouseLeave(node)
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
  })

  it('持久化 cosetstrip 参数（版本化信封，防抖后含 subgroup）', async () => {
    const opts = listCosetStripSubgroups(s3)
    render(
      <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" storageKey="cs-persist"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const panel = openPanel()
    fireEvent.change(panel.querySelector('select')!, { target: { value: opts[1].key } })
    fireEvent.click(screen.getByText('Show node labels').querySelector('input')!)
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-cs-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as {
        __gvVersion: number
        data: { viewParams: { subgroup?: string[]; showLabels?: boolean } }
      }
      expect(env.__gvVersion).toBe(1)
      expect(env.data.viewParams.subgroup).toEqual(opts[1].elementIds)
      expect(env.data.viewParams.showLabels).toBe(true)
    }, { timeout: 1000 })
  })

  it('坏持久化参数（cosetType 非法 / subgroup 非真子群键）→ schema 校验失败回退默认 H', () => {
    const opts = listCosetStripSubgroups(s3)
    localStorage.setItem(
      'gv-vw-cs-bad',
      JSON.stringify({
        __gvVersion: 1,
        data: {
          position: { x: 10, y: 10 },
          size: { width: 300, height: 250 },
          config: {},
          viewParams: { cosetType: 'diagonal', subgroup: ['not-a-subgroup'] },
        },
      }),
    )
    const { container } = render(
      <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" storageKey="cs-bad"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 420, height: 320 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 回退默认首候选 C₃ → 2 条带
    expect(stripCount(win)).toBe(2)
    const panel = openPanel()
    expect((panel.querySelector('select') as HTMLSelectElement).value).toBe(opts[0].key)
  })

  it('默认持久化键含视图名：cosetstrip 与 set 窗口不冲突', async () => {
    render(
      <ViewWindow view="cosetstrip" group={s3} title="S₃ 陪集条带" defaultPosition={{ x: 20, y: 20 }} />,
    )
    render(
      <ViewWindow view="set" group={s3} title="S₃ 集合" defaultPosition={{ x: 60, y: 60 }} />,
    )
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|cosetstrip'))).toBe(true)
      expect(keys.some(k => k.endsWith('|set'))).toBe(true)
    }, { timeout: 1000 })
  })
})

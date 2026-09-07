import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewWindow } from '../components/Canvas/FloatingViewWindow'
import type { ViewParams } from '../components/Canvas/FloatingViewWindow'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { naturalProjectionMapping, verifyHomomorphism } from '../core/algebra/homomorphisms'
import type { Homomorphism } from '../core/types'
import type { HomomorphismViewParams } from '../core/types/viewConfig'

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const c6 = createCyclicGroup(6)!
const c2 = createCyclicGroup(2)!
const s3 = createSymmetricGroup(3)!

// C₆ → C₂ 自然投影（mod 2）：Ker = C₃（3 元素）、Im = C₂（2 元素），满射非单射
const homoProj: Homomorphism = (() => {
  const mapping = naturalProjectionMapping(c6, c2)!
  return { id: 'h-proj', source: c6, target: c2, mapping, result: verifyHomomorphism(c6, c2, mapping), name: 'C₆ → C₂' }
})()

// S₃ → S₃ 恒等（同构）：Ker = {e}、满射单射
const homoId: Homomorphism = (() => {
  const mapping = new Map<string, string>(s3.elements.map(e => [e.id, e.id]))
  return { id: 'h-id', source: s3, target: s3, mapping, result: verifyHomomorphism(s3, s3, mapping), name: 'S₃ → S₃' }
})()

const openPanel = () => {
  fireEvent.click(screen.getByTitle('Parameters'))
  return screen.getByText('View Config').parentElement as HTMLElement
}

describe('ViewWindow · homomorphism view', () => {
  beforeEach(() => localStorage.clear())

  it('无 group 也可渲染：homomorphism prop 提供双群，映射图 + 核/像标注', () => {
    const { container } = render(
      <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂"
        storageKey="h-basic" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 双群节点：C₆ 源 6 节点 + C₂ 目标 2 节点
    expect(win.querySelectorAll('[data-homo-source-node]')).toHaveLength(6)
    expect(win.querySelectorAll('[data-homo-target-node]')).toHaveLength(2)
    // 核/像标注：Ker=C₃(3)、Im=C₂(2)，满射非单射
    expect(win.textContent).toContain('Ker=3')
    expect(win.textContent).toContain('Im=2')
    expect(win.textContent).toContain('homo.notInjective')
    expect(win.textContent).toContain('homo.surjective')
  })

  it('S₃ → S₃ 恒等同构 → isomorphism 标注', () => {
    const { container } = render(
      <ViewWindow view="homomorphism" homomorphism={homoId} title="S₃ → S₃"
        storageKey="h-id" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(win.textContent).toContain('homo.isomorphism')
    expect(win.textContent).toContain('homo.injective')
    expect(win.textContent).toContain('homo.surjective')
  })

  it('窗口缺省无节点常驻标签（仅标题+域+陪域 3 个 foreignObject），开标签后每节点一个', () => {
    const { container } = render(
      <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂"
        storageKey="h-label" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    // 缺省：标题 + 域 + 陪域 = 3 个 foreignObject（无节点标签）
    expect(win.querySelectorAll('foreignObject')).toHaveLength(3)
    openPanel()
    expect(screen.getByText('Homomorphism View')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Show labels').querySelector('input')!)
    // 开启：3 + 6 源 + 2 目标 = 11
    expect(win.querySelectorAll('foreignObject')).toHaveLength(11)
  })

  it('悬停源节点 → 就地气泡出现并可关闭', () => {
    const { container } = render(
      <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂"
        storageKey="h-hover" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
    const node = win.querySelector('[data-homo-source-node]') as HTMLElement
    fireEvent.mouseEnter(node)
    expect(win.querySelector('[data-testid="hover-hud"]')).not.toBeNull()
    fireEvent.mouseLeave(node)
    expect(win.querySelector('[data-testid="hover-hud"]')).toBeNull()
  })

  it('受控 showLabels 参数回传正确', () => {
    const received: Array<Record<string, unknown>> = []
    function Controlled() {
      const [p, setP] = useState<HomomorphismViewParams>({})
      const handleChange = (next: ViewParams) => {
        received.push({ ...next })
        setP(next as HomomorphismViewParams)
      }
      return (
        <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂"
          storageKey="h-ctl" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }}
          viewParams={p} onViewParamsChange={handleChange} />
      )
    }
    const { container } = render(<Controlled />)
    const win = container.firstElementChild as HTMLElement
    openPanel()
    fireEvent.click(screen.getByText('Show labels').querySelector('input')!)
    expect(received.at(-1)).toEqual({ showLabels: true })
    expect(win.querySelectorAll('foreignObject')).toHaveLength(11)
  })

  it('持久化 homomorphism 参数（版本化信封，showLabels 写入）', async () => {
    render(
      <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂"
        storageKey="h-persist" defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 560, height: 420 }} />,
    )
    openPanel()
    fireEvent.click(screen.getByText('Show labels').querySelector('input')!)
    await vi.waitFor(() => {
      const raw = localStorage.getItem('gv-vw-h-persist')
      expect(raw).not.toBeNull()
      const env = JSON.parse(raw!) as { __gvVersion: number; data: { viewParams: { showLabels?: boolean } } }
      expect(env.__gvVersion).toBe(1)
      expect(env.data.viewParams.showLabels).toBe(true)
    }, { timeout: 1000 })
  })

  it('默认持久化键含 homomorphism：同态与集合窗口不冲突', async () => {
    render(<ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂" defaultPosition={{ x: 20, y: 20 }} />)
    render(<ViewWindow view="set" group={c6} title="C₆ 集合" defaultPosition={{ x: 60, y: 60 }} />)
    await vi.waitFor(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gv-vw-'))
      expect(keys).toHaveLength(2)
      expect(keys.some(k => k.endsWith('|homomorphism'))).toBe(true)
      expect(keys.some(k => k.endsWith('|set'))).toBe(true)
    }, { timeout: 1000 })
  })

  it('无 homomorphism → 占位 "No homomorphism"', () => {
    const { container } = render(
      <ViewWindow view="homomorphism" homomorphism={null} title="空" storageKey="h-none"
        defaultPosition={{ x: 20, y: 20 }} defaultSize={{ width: 400, height: 300 }} />,
    )
    const win = container.firstElementChild as HTMLElement
    expect(win.textContent).toContain('No homomorphism')
  })
})

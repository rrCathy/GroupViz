import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, act, fireEvent } from '@testing-library/react'
import { Cayley3DScene } from '../components/Canvas/Cayley3DScene'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { getDefaultLayout3D } from '../core/types'

// 环面自转的相位推进由 useFrame 驱动（测试里没有真帧循环）⇒ 把回调收集下来手动喂 delta；
// compute3DPositions 包一层记录 layout 拿到的选项（tubePhase），验证「开关 → 帧 → 布局」整条管线
const h = vi.hoisted(() => ({
  frames: [] as Array<(state: unknown, delta: number) => void>,
  layoutOpts: [] as Array<{ tubePhase?: number } | undefined>,
}))

// happy-dom 无 WebGL：Canvas 渲染为容器 div、useThree 提供最小 stub、useFrame 收集回调、Html 透传 children。
// three 的纯数学（Vector3/Quaternion）保持真实实现。
vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode }) => <div data-testid="r3f-canvas">{props.children}</div>,
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: {
      fov: 50, near: 0.1, far: 400, aspect: 1,
      // copy/addScaledVector 需可链式（applyCameraFromOrbit 写成 position.copy(...).addScaledVector(...)）
      position: { set() { return this }, copy() { return this }, addScaledVector() { return this } },
      quaternion: { copy() { return this } },
      up: { set() {} }, lookAt() {},
    },
    scene: {},
  }),
  useFrame: (cb: (state: unknown, delta: number) => void) => { h.frames.push(cb) },
}))
vi.mock('../core/algebra/layout3D', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/algebra/layout3D')>()
  const real = actual.compute3DPositions
  return {
    ...actual,
    compute3DPositions: (
      g: Parameters<typeof real>[0],
      l: Parameters<typeof real>[1],
      o?: Parameters<typeof real>[2],
    ) => {
      h.layoutOpts.push(o)
      return real(g, l, o)
    },
  }
})
vi.mock('@react-three/drei', () => ({
  Html: (props: { children?: ReactNode; wrapperClass?: string }) => (
    <div className={props.wrapperClass}>{props.children}</div>
  ),
  Line: (props: { points?: number[][]; lineWidth?: number; color?: string }) => (
    <div
      className="gv-three-line"
      data-points={JSON.stringify(props.points ?? [])}
      data-line-width={String(props.lineWidth ?? '')}
      data-color={props.color ?? ''}
    />
  ),
}))
vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const c4 = createCyclicGroup(4)
const s3 = createSymmetricGroup(3)

const tagAll = (container: HTMLElement, tag: string) =>
  Array.from(container.querySelectorAll('*')).filter(e => e.tagName.toLowerCase() === tag.toLowerCase())

const geomArg = (el: Element, idx = 0): number => {
  const args = (el as unknown as { args?: number[] }).args
  if (Array.isArray(args)) return args[idx]
  const raw = el.getAttribute('args') ?? ''
  return Number(raw.split(',')[idx])
}

// React 19 在 happy-dom 下把对象 props 序列化为 attribute（'[object Object]'），不可读；
// 可序列化的 cylinderGeometry args[2]（边长）是边几何的稳定信号
const edgeLens = (container: HTMLElement): number[] =>
  tagAll(container, 'cylinderGeometry')
    .map(g => geomArg(g, 2))
    .sort((a, b) => a - b)

describe('Cayley3DScene · controlled 3D cayley view', () => {
  beforeEach(() => localStorage.clear())

  it('renders the .view-empty placeholder for a null group', () => {
    const { container } = render(
      <Cayley3DScene group={null} selectedElements={new Set()} />,
    )
    expect(container.querySelector('.view-empty')).not.toBeNull()
  })

  it('renders nodes and directed generator edges by default (C₄)', () => {
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()} />,
    )
    // 4 个节点球（无选中/子集 → 每节点 1 个主球）
    expect(tagAll(container, 'sphereGeometry')).toHaveLength(4)
    // 生成元 a（4 阶非自逆）→ 4 条有向直线边 + 4 个箭头锥
    expect(tagAll(container, 'cylinderGeometry')).toHaveLength(4)
    expect(tagAll(container, 'coneGeometry')).toHaveLength(4)
    // 无自环
    expect(tagAll(container, 'torusGeometry')).toHaveLength(0)
  })

  it('normalizes actions: bogus filtered, enabled:false removes edges, [] means no edges', () => {
    // bogus 元素被过滤、显式禁用的作用无边 → 无任何边，4 个节点仍在
    const { container: c1 } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        actions={[{ elementId: 'zz-bogus' }, { elementId: 'e1', enabled: false }]} />,
    )
    expect(tagAll(c1, 'cylinderGeometry')).toHaveLength(0)
    expect(tagAll(c1, 'sphereGeometry')).toHaveLength(4)

    const { container: c2 } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()} actions={[]} />,
    )
    expect(tagAll(c2, 'cylinderGeometry')).toHaveLength(0)
    expect(tagAll(c2, 'sphereGeometry')).toHaveLength(4)
  })

  it('identity action renders self-loop tori (not straight edges)', () => {
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        actions={[{ elementId: 'e0' }]} />,
    )
    // 恒等元作用：每元素 x·e=x → 4 个自环
    expect(tagAll(container, 'torusGeometry')).toHaveLength(4)
    expect(tagAll(container, 'cylinderGeometry')).toHaveLength(0)
  })

  it('left and right multiply produce different edge geometry on S₃', () => {
    const right = render(
      <Cayley3DScene group={s3} selectedElements={new Set()} multiplyType="right" />,
    )
    const rightLens = edgeLens(right.container)

    const left = render(
      <Cayley3DScene group={s3} selectedElements={new Set()} multiplyType="left" />,
    )
    const leftLens = edgeLens(left.container)

    // 双向边去重后各 6 条（s12 双向 3 条 + c 3-轮换往返 3 条）；hexagon 布局下边长多重集不同
    expect(rightLens).toHaveLength(6)
    expect(leftLens).toHaveLength(6)
    expect(leftLens).not.toEqual(rightLens)
  })

  it('球径只由 nodeScale 决定——元素阶不再参与编码（F2「阶→球径」已撤下）', () => {
    // C₄：阶为 1 / 2 / 4，跨度足够。旧实现在这里会产出多种半径（对数放大最大 +35%）
    const { container } = render(<Cayley3DScene group={c4} selectedElements={new Set()} />)
    const radii = tagAll(container, 'sphereGeometry').map(g => geomArg(g))
    expect(radii).toHaveLength(4)
    expect(new Set(radii).size).toBe(1)
    expect(radii[0]).toBeCloseTo(0.42, 5)
  })

  it('scales node spheres by nodeScale', () => {
    const plain = render(<Cayley3DScene group={c4} selectedElements={new Set()} />)
    const baseRadius = geomArg(tagAll(plain.container, 'sphereGeometry')[0])

    const scaled = render(<Cayley3DScene group={c4} selectedElements={new Set()} nodeScale={2} />)
    const scaledRadius = geomArg(tagAll(scaled.container, 'sphereGeometry')[0])

    expect(baseRadius).toBeCloseTo(0.42, 5)
    expect(scaledRadius).toBeCloseTo(0.84, 5)
  })

  it('reflects controlled autoRotate in the scene toolbar (❚❚ when on)', () => {
    const off = render(<Cayley3DScene group={c4} selectedElements={new Set()} />)
    expect(off.container.textContent).toContain('▶')
    expect(off.container.textContent).not.toContain('❚❚')

    const on = render(<Cayley3DScene group={c4} selectedElements={new Set()} autoRotate />)
    expect(on.container.textContent).toContain('❚❚')
  })

  // ── 环面 = S¹×S¹ 的两个自转（torusHex 专用） ──
  const s4star = () => createGroupFromSymbol('S_{4}')!

  it('环面自转按钮只在 torusHex 布局出现（S₄ 星图；其它布局/其它群不出现）', () => {
    const torus = render(<Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D="torusHex" />)
    const ring = torus.container.querySelector('[data-testid="cayley3d-spin-ring"]')
    const tube = torus.container.querySelector('[data-testid="cayley3d-spin-tube"]')
    expect(ring).not.toBeNull()
    expect(tube).not.toBeNull()
    // 默认关：不高亮（与 ▶ 同一套 active 样式）
    expect(ring!.getAttribute('style')).not.toContain('accent-teal')
    torus.unmount()

    for (const layout of ['cone', 'wordLengthSphere'] as const) {
      const other = render(<Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D={layout} />)
      expect(other.container.querySelector('[data-testid="cayley3d-spin-ring"]')).toBeNull()
      expect(other.container.querySelector('[data-testid="cayley3d-spin-tube"]')).toBeNull()
      other.unmount()
    }

    const c4Torus = render(<Cayley3DScene group={c4} selectedElements={new Set()} layout3D="torusHex" />)
    expect(c4Torus.container.querySelector('[data-testid="cayley3d-spin-ring"]')).toBeNull()
  })

  it('点击自转按钮翻转高亮（缺省受控 prop 时按钮本地态生效）；受控 prop 优先', () => {
    const local = render(<Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D="torusHex" />)
    const ringBtn = local.container.querySelector('[data-testid="cayley3d-spin-ring"]') as HTMLElement
    fireEvent.click(ringBtn)
    expect(ringBtn.getAttribute('style')).toContain('accent-teal')
    fireEvent.click(ringBtn)
    expect(ringBtn.getAttribute('style')).not.toContain('accent-teal')
    local.unmount()

    const controlled = render(
      <Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D="torusHex" spinBigCircle />,
    )
    const btn = controlled.container.querySelector('[data-testid="cayley3d-spin-ring"]') as HTMLElement
    expect(btn.getAttribute('style')).toContain('accent-teal')
    fireEvent.click(btn) // 本地态翻转，但 prop 说了算 ⇒ 仍高亮
    expect(btn.getAttribute('style')).toContain('accent-teal')
  })

  // 环面自转的相位推进由 useFrame 驱动（mock 里没有真帧循环）⇒ 手动喂 delta。
  // 注意：R3F 的 useFrame 每次渲染只订阅一次（回调经 ref 更新）；mock 朴素地每次渲染都 push，
  // 所以这里只喂「最新那个」回调，才与真实运行等价（否则一次 act 会被旧闭包重复推进）。
  const stepFrame = (delta: number) => {
    const cb = h.frames.at(-1)
    act(() => { cb?.({}, delta) })
  }

  it('绕管子自转：每帧把相位推进给 3D 布局（useFrame → tubePhase 真实管线）', () => {
    h.frames.length = 0
    h.layoutOpts.length = 0
    render(<Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D="torusHex" spinTube />)
    // 起始相位 0（画面 = 设计的镶嵌，逐位不变）
    expect(h.layoutOpts.at(-1)?.tubePhase).toBe(0)

    stepFrame(0.5)
    // 0.5s × 2π/8s ≈ 0.3927 弧度
    expect(h.layoutOpts.at(-1)?.tubePhase).toBeCloseTo((0.5 * 2 * Math.PI) / 8, 3)

    stepFrame(0.5)
    expect(h.layoutOpts.at(-1)?.tubePhase).toBeCloseTo((1.0 * 2 * Math.PI) / 8, 3)
  })

  it('两个自转都关时相位冻结（帧循环不改布局选项）', () => {
    h.frames.length = 0
    h.layoutOpts.length = 0
    render(<Cayley3DScene group={s4star()} selectedElements={new Set()} layout3D="torusHex" />)
    const before = h.layoutOpts.length
    act(() => { for (const cb of [...h.frames]) cb({}, 0.5) })
    expect(h.layoutOpts.at(-1)?.tubePhase).toBe(0)
    expect(h.layoutOpts.length).toBe(before) // 没有 setState ⇒ 不触发重渲染
  })

  it('shows hover/selected labels only when showLabels is not false', () => {
    const sel = new Set(['e1'])
    const withLabels = render(
      <Cayley3DScene group={c4} selectedElements={sel} />,
    )
    // 选中节点 → 标签渲染（wrapperClass 为 gv-html-overlay 的容器）
    expect(withLabels.container.querySelectorAll('.gv-html-overlay')).toHaveLength(1)

    const noLabels = render(
      <Cayley3DScene group={c4} selectedElements={sel} showLabels={false} />,
    )
    expect(noLabels.container.querySelectorAll('.gv-html-overlay')).toHaveLength(0)
  })

  it('resolves layout3D default from getDefaultLayout3D(group) and accepts overrides', () => {
    expect(getDefaultLayout3D(c4)).toBe('circular')
    // 默认（circular）与覆盖（cone）都应正常出图，不因布局值崩溃
    for (const layout of [undefined, 'cone' as const]) {
      const { container, unmount } = render(
        <Cayley3DScene group={c4} selectedElements={new Set()} layout3D={layout} />,
      )
      expect(tagAll(container, 'sphereGeometry')).toHaveLength(4)
      unmount()
    }
  })

  it('adds a translucent shell only for the wordLengthSphere layout', () => {
    const s4 = createSymmetricGroup(4)
    // 字长球：24 个节点球 + 1 个球壳（半径 = 5 × 1.55 = 7.75，S₄ 全体贴壳）
    const shell = render(
      <Cayley3DScene group={s4} selectedElements={new Set()} layout3D="wordLengthSphere" />,
    )
    const shellRadii = tagAll(shell.container, 'sphereGeometry').map(g => geomArg(g, 0))
    expect(shellRadii.filter(r => r > 5)).toHaveLength(1)
    expect(shellRadii.filter(r => r > 5)[0]).toBeCloseTo(7.75, 3)
    expect(shellRadii.filter(r => r < 5)).toHaveLength(24)

    // 其它布局不套壳（cone：仅 24 个节点球，无大半径球）
    const plain = render(
      <Cayley3DScene group={s4} selectedElements={new Set()} layout3D="cone" />,
    )
    const plainRadii = tagAll(plain.container, 'sphereGeometry').map(g => geomArg(g, 0))
    expect(plainRadii).toHaveLength(24)
    expect(plainRadii.some(r => r > 5)).toBe(false)
  })

  it('per-generator lengthScale stretches that generator’s edges (VCL 3D relax)', () => {
    const plain = render(<Cayley3DScene group={c4} selectedElements={new Set()} />)
    const before = edgeLens(plain.container)
    expect(before).toHaveLength(4)

    const scaled = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        actions={[{ elementId: 'e1', lengthScale: 2 }]} />,
    )
    const after = edgeLens(scaled.container)
    // 边数不变，边长被拉长（取最长边比较，避免排序位置抖动）
    expect(after).toHaveLength(4)
    expect(after[after.length - 1]).toBeGreaterThan(before[before.length - 1] * 1.05)
  })

  it('lengthScale = 1 keeps the base geometry unchanged (attach-safe)', () => {
    const plain = render(
      <Cayley3DScene group={c4} selectedElements={new Set()} actions={[{ elementId: 'e1' }]} />,
    )
    const explicit = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        actions={[{ elementId: 'e1', lengthScale: 1 }]} />,
    )
    expect(edgeLens(explicit.container)).toEqual(edgeLens(plain.container))
  })

  it('pathHighlight draws one segment per walk step plus node rings', () => {
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        pathHighlight={{ word: ['e1', 'e1'], color: '#ff6b6b' }} />,
    )
    const lines = container.querySelectorAll('.gv-three-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].getAttribute('data-line-width')).toBe('5')
    expect(lines[0].getAttribute('data-color')).toBe('#ff6b6b')
    // 3 个路径节点环（e0→e1→e2）叠加在 4 个基础节点球之上
    expect(tagAll(container, 'sphereGeometry')).toHaveLength(4 + 3)
  })

  it('pathHighlight highlights nodes only for pairs with no connecting edge', () => {
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        pathHighlight={{ elements: ['e0', 'e2'] }} />,
    )
    // e0→e2 需 e2 作用（默认只有生成元 e1）→ 只高亮 2 个节点，无线段
    expect(container.querySelectorAll('.gv-three-line')).toHaveLength(0)
    expect(tagAll(container, 'sphereGeometry')).toHaveLength(4 + 2)
  })

  it('showOrder badges appear only on the hovered path node (none by default)', () => {
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        pathHighlight={{ word: ['e1'], showOrder: true }} />,
    )
    expect(container.querySelectorAll('.gv-three-line')).toHaveLength(1)
    // 不常显序号（长路径上会互相遮挡）：无悬停时没有徽标
    expect(container.querySelectorAll('.gv-html-overlay')).toHaveLength(0)
  })

  it('hoveredElementId (controlled) drives the order badge on that path node', () => {
    // 受控悬停路径上的第 3 个节点（e2）→ 只显示它的次序徽标（③）
    const { container } = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        hoveredElementId="e2"
        pathHighlight={{ word: ['e1', 'e1'], showOrder: true }} />,
    )
    expect(container.querySelectorAll('.gv-three-line')).toHaveLength(2)
    const texts = Array.from(container.querySelectorAll('.gv-html-overlay')).map(el => el.textContent)
    expect(texts).toContain('3')
  })

  it('pathHighlight dims non-path edges by default (dimOthers)', () => {
    // 直线边的材质 opacity：淡化 = 0.2，正常 = 1（节点球材质不设 opacity → null）
    const edgeOpacities = (container: HTMLElement) =>
      tagAll(container, 'cylinderGeometry')
        .map(g => g.parentElement?.querySelector('meshStandardMaterial')?.getAttribute('opacity') ?? null)
    const plain = render(<Cayley3DScene group={c4} selectedElements={new Set()} />)
    expect(edgeOpacities(plain.container)).toEqual(['1', '1', '1', '1'])
    plain.unmount()

    // 路径 e0→e1→e2：4 条生成元边中 2 条在路径上 → 2 条淡化
    const hi = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        pathHighlight={{ word: ['e1', 'e1'] }} />,
    )
    expect(edgeOpacities(hi.container).filter(o => o === '0.2')).toHaveLength(2)
    hi.unmount()

    // 显式关闭 → 全部保持原状
    const off = render(
      <Cayley3DScene group={c4} selectedElements={new Set()}
        pathHighlight={{ word: ['e1', 'e1'], dimOthers: false }} />,
    )
    expect(edgeOpacities(off.container).filter(o => o === '0.2')).toHaveLength(0)
  })
})

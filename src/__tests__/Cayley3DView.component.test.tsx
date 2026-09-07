import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { Cayley3DScene } from '../components/Canvas/Cayley3DScene'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { getDefaultLayout3D } from '../core/types'

// happy-dom 无 WebGL：Canvas 渲染为容器 div、useThree 提供最小 stub、useFrame no-op、Html 透传 children。
// three 的纯数学（Vector3/Quaternion）保持真实实现。
vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode }) => <div data-testid="r3f-canvas">{props.children}</div>,
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: {
      fov: 50, near: 0.1, far: 400, aspect: 1,
      position: { set() {} }, up: { set() {} }, lookAt() {},
    },
    scene: {},
  }),
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({
  Html: (props: { children?: ReactNode; wrapperClass?: string }) => (
    <div className={props.wrapperClass}>{props.children}</div>
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
})

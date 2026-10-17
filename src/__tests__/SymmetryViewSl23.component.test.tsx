import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, fireEvent } from '@testing-library/react'
import * as THREE from 'three'
import { SymmetryViewScene } from '../components/Canvas/SymmetryViewScene'
import type { SymmetryViewSceneProps } from '../components/Canvas/SymmetryViewScene'
import { createTableGroup } from '../core/groups/SmallGroups/tableGroup'
import { sl23Quat, sl23Spin, sl23Matrix, sl23QuatFromMatrix } from '../core/groups/sl23'
import { readSymmetryCamera } from '../utils/symmetryCameraState'
import { BELT_ANCHOR_DIST } from '../components/Canvas/beltGeometry'
import { translations } from '../i18n/translations'

/**
 * SL(2,3) 对称性视图（2T + Dirac 开口皮带）：
 *  - 物体姿态 = SO(3)：落定四元数即该群元素的 Spin(3) 提升（q 与 −q 外观同一旋转）
 *  - 皮带 = SU(2) 记忆：每元素贡献 τ = 2ψ（正标量），compose 累计、homing 回 0
 *  - −I（唯一 2 阶元）：物体转满 360° 外观恒等（姿态 = (0,0,0,−1)）、皮带拧满一圈（2π）
 *
 * R3F stub 与 SymmetryViewCompose 同一套（useFrame 收集 + 手动喂 delta）；
 * 期望值取真实表群 + sl23 模块同源计算，不硬编码数字。
 */

const { frameCbs } = vi.hoisted(() => ({ frameCbs: [] as Array<(state: unknown, delta: number) => void> }))

// 真相机实例（轨道控制器需要 position/quaternion/matrix 全量 API；与 Canvas 默认
// [0,3,10] 一致）。useThree 在渲染期调用，此时模块级 let 已初始化，无 TDZ 问题。
let stubCamera: THREE.PerspectiveCamera | null = null

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode }) => <div data-testid="r3f-canvas">{props.children}</div>,
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: stubCamera ?? (stubCamera = new THREE.PerspectiveCamera()),
    scene: {},
  }),
  useFrame: (cb: (state: unknown, delta: number) => void) => { frameCbs.push(cb) },
}))
vi.mock('@react-three/drei', () => ({
  Html: (props: { children?: ReactNode; wrapperClass?: string }) => (
    <div className={props.wrapperClass}>{props.children}</div>
  ),
  OrbitControls: () => null,
}))
vi.mock('../i18n/useTranslation', () => ({
  // 查真实 zh 表 + 插值的 mock：无 params 的键仍返回 key（既有断言口径不变），
  // 带 {axis}/{deg} 占位的读数返回真实中文文案（说明框旋转读数要可断言）
  useTranslation: () => ({
    t: (k: string, params?: Record<string, string | number>) => {
      const table = (translations as Record<string, Record<string, string>>).zh
      let text = table[k] ?? k
      if (params) {
        for (const [pk, pv] of Object.entries(params)) text = text.split(`{${pk}}`).join(String(pv))
      }
      return text
    },
  }),
}))

const g = createTableGroup(24, 3)

/** 表索引 k → 元素的整数四元组 (a,b,c,d)（(a+bi+cj+dk)/2） */
const quatOf = (el: { value: number[] }): [number, number, number, number] => sl23Quat(el.value[0])

/** 同源 oracle：元素旋转四元数 = 整数四元数 (b/2, c/2, d/2, a/2)。
 *  （与场景 setFromAxisAngle(axis, 2ψ) 逐位等价——sl23Spin 的规范分解即
 *  q = cos ψ + sin ψ·û，(sin ψ·û, cos ψ) = (v, w) = (b/2, c/2, d/2, a/2)） */
function rotQuat(el: { value: number[] }): THREE.Quaternion {
  const [a, b, c, d] = quatOf(el)
  return new THREE.Quaternion(b / 2, c / 2, d / 2, a / 2)
}

/** 同源 oracle：皮带扭转贡献 τ = 2ψ（弧度，正标量） */
const twistOf = (el: { value: number[] }): number => sl23Spin(el.value[0]).beltTwist

/** 左乘合成（与场景一致：目标 = 元素旋转 × 当前姿态） */
function composeOnto(el: { value: number[] }, pose: THREE.Quaternion): THREE.Quaternion {
  return rotQuat(el).multiply(pose)
}

function feedFrames(dt = 0.05, ticks = 120) {
  for (let i = 0; i < ticks; i++) frameCbs.forEach(cb => cb({}, dt))
}

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function expectPoseClose(actual: [number, number, number, number] | undefined, expected: THREE.Quaternion | [number, number, number, number]) {
  expect(actual).toBeDefined()
  const [ex, ey, ez, ew] = expected instanceof THREE.Quaternion ? [expected.x, expected.y, expected.z, expected.w] : expected
  expect(actual![0]).toBeCloseTo(ex, 5)
  expect(actual![1]).toBeCloseTo(ey, 5)
  expect(actual![2]).toBeCloseTo(ez, 5)
  expect(actual![3]).toBeCloseTo(ew, 5)
}

/** 按阶找元素（同源 oracle：sl23Spin 的 angleRad） */
function findByAngle(angleRad: number) {
  return g.elements.find(e => Math.abs(sl23Spin(e.value[0]).angleRad - angleRad) < 1e-9)!
}

/** −I = 唯一 2 阶元（e·e = 恒等且 e ≠ 恒等） */
const negI = g.elements.find((e, i) => i !== 0 && g.multiply(e, e).id === g.identity.id)!
/** 4 阶元（ψ = π/2 ⇒ 物体旋转 180°） */
const j4 = findByAngle(Math.PI)
/** 3 阶元（钝角前形态：ψ = π/3 ⇒ 120°）与其对跖 −q（ψ = 2π/3 ⇒ 240°） */
const k3 = findByAngle((2 * Math.PI) / 3)
const negK3 = g.elements.find(e => {
  const q = sl23Quat(e.value[0])
  const qk = sl23Quat(k3.value[0])
  return q.every((v, i) => v === -qk[i])
})!

/** 挂载 harness：poses/belts 收集落定上报，rerender 合并 props */
function mountHarness(initial: Partial<SymmetryViewSceneProps> = {}) {
  const poses: [number, number, number, number][] = []
  const belts: number[] = []
  const hints: string[] = []
  let latest: Partial<SymmetryViewSceneProps> = { ...initial }
  const Harness = () => (
    <SymmetryViewScene
      group={g}
      showAction
      {...latest}
      onPoseChange={q => { poses.push(q) }}
      onBeltChange={t => { belts.push(t) }}
      onHint={m => { hints.push(m) }}
    />
  )
  const { rerender } = render(<Harness />)
  return {
    poses, belts, hints,
    rerender: (next: Partial<SymmetryViewSceneProps>) => {
      latest = { ...latest, ...next }
      rerender(<Harness />)
    },
  }
}

describe('SymmetryViewScene · SL(2,3) 2T + Dirac 皮带', () => {
  beforeEach(() => { frameCbs.length = 0 })

  it('群与类型接线：表群 (24,3) symbol = SL(2,3)，元素 label 已是矩阵', () => {
    expect(g.symbol).toBe('SL(2,3)')
    expect(g.order).toBe(24)
    expect(g.elements[0]!.label.startsWith('\\begin{smallmatrix}')).toBe(true)
    // 词标签 stash 在 wordLabel（面板/树视图兜底）
    expect(typeof g.elements[0]!.wordLabel).toBe('string')
  })

  it('恒等元素不演示（无姿态/皮带上报）', () => {
    const { poses, belts } = mountHarness({ actionElementId: g.identity.id })
    feedFrames()
    expect(poses.length).toBe(0)
    expect(belts.length).toBe(0)
  })

  it('非叠加：单元素落定 = 元素四元数 + 皮带 = 2ψ', () => {
    const { poses, belts } = mountHarness({ actionElementId: j4.id })
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(j4))
    expect(belts.at(-1)).toBeCloseTo(twistOf(j4), 9)
  })

  it('−I 皮带戏法：物体外观恒等（姿态 = (0,0,0,−1)）+ 皮带拧满一圈（2π）', () => {
    const { poses, belts } = mountHarness({ actionElementId: negI.id })
    feedFrames()
    // 姿态是 −I 的 Spin(3) 提升：与恒等同一 SO(3) 旋转，但四元数取反
    expectPoseClose(poses.at(-1), rotQuat(negI))
    expect(poses.at(-1)![3]).toBeCloseTo(-1, 5)
    // 皮带 = 一整圈（τ = 360° ⇔ q = −1）
    expect(belts.at(-1)).toBeCloseTo(2 * Math.PI, 9)
  })

  it('双覆盖画面可见：q 与 −q 同一物体旋转、不同皮带（120° vs 240°）', () => {
    const first = mountHarness({ actionElementId: k3.id })
    feedFrames()
    expectPoseClose(first.poses.at(-1), rotQuat(k3))
    expect(first.belts.at(-1)).toBeCloseTo((2 * Math.PI) / 3, 9)
    // 对跖元素：四元数逐分量取反（同一旋转），皮带 240°
    const second = mountHarness({ actionElementId: negK3.id })
    feedFrames()
    expectPoseClose(second.poses.at(-1), rotQuat(negK3))
    expect(second.belts.at(-1)).toBeCloseTo((4 * Math.PI) / 3, 9)
    // 两者旋转等价（q ≡ −q，angleTo 用 |dot| 判旋转差）但提升相反——
    // 画面差异由皮带承载（120° vs 240°）
    const a = rotQuat(k3)
    const b = rotQuat(negK3)
    expect(a.angleTo(b)).toBeCloseTo(0, 5)
    expect(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w).toBeCloseTo(-1, 5)
  })

  it('叠加 j,j：物体回家（姿态 = Q(−1)）+ 皮带 360°', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    expectPoseClose(h.poses.at(-1), rotQuat(j4))
    expect(h.belts.at(-1)).toBeCloseTo(Math.PI, 9)
    // 重复作用同一 4 阶元：j² = −1 ⇒ 物体回家、皮带再拧半圈（合计一整圈）
    h.rerender({ replaySignal: 1 })
    feedFrames()
    expectPoseClose(h.poses.at(-1), composeOnto(j4, rotQuat(j4)))
    expect(h.poses.at(-1)![3]).toBeCloseTo(-1, 5)
    expect(h.belts.at(-1)).toBeCloseTo(2 * Math.PI, 9)
  })

  it('叠加 j,j,j,j：姿态回恒等 + 皮带 720°（两整扭拓扑复原）', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    for (let n = 2; n <= 4; n++) {
      h.rerender({ replaySignal: n })
      feedFrames()
    }
    expectPoseClose(h.poses.at(-1), IDENTITY)
    expect(h.belts.at(-1)).toBeCloseTo(4 * Math.PI, 9)
  })

  it('叠加：复位信号 → homing（姿态恒等 + 皮带回 0）', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    h.rerender({ replaySignal: 1 })
    feedFrames()
    expect(h.belts.at(-1)).toBeCloseTo(2 * Math.PI, 9)
    h.rerender({ resetSignal: 1 })
    feedFrames()
    expectPoseClose(h.poses.at(-1), IDENTITY)
    expect(h.belts.at(-1)).toBe(0)
  })

  it('720° 复原演练：τ 不足两整扭时信号 no-op', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    h.rerender({ replaySignal: 1 })
    feedFrames()
    expect(h.belts.at(-1)).toBeCloseTo(2 * Math.PI, 9)
    const settled = h.belts.length
    // τ = 360°（单整扭拓扑上不可消）⇒ 演练信号无效
    h.rerender({ beltRestoreSignal: 1 })
    feedFrames()
    expect(h.belts.length).toBe(settled)
  })

  it('720° 复原演练：拧满两整扭后触发 → 落定 τ=0（绕过锚点解开）', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    for (let n = 2; n <= 4; n++) {
      h.rerender({ replaySignal: n })
      feedFrames()
    }
    expect(h.belts.at(-1)).toBeCloseTo(4 * Math.PI, 9)
    h.rerender({ beltRestoreSignal: 1 })
    feedFrames()
    // 演练（2.5s @ speed 1）走完：τ 一次性解开两整扭回 0
    expect(h.belts.at(-1)).toBe(0)
    expectPoseClose(h.poses.at(-1), IDENTITY)
  })

  it('非叠加换元素：皮带先 unwind 回 0 再扭到新元素贡献', () => {
    const h = mountHarness({ actionElementId: j4.id })
    feedFrames()
    expect(h.belts.at(-1)).toBeCloseTo(Math.PI, 9)
    h.rerender({ actionElementId: negI.id })
    feedFrames()
    // 落定 = 新元素贡献（2π），不是累计
    expect(h.belts.at(-1)).toBeCloseTo(2 * Math.PI, 9)
    expectPoseClose(h.poses.at(-1), rotQuat(negI))
  })

  it('提示行含累计皮带读数（皮带累计 N°）', () => {
    const h = mountHarness({ compose: true, actionElementId: j4.id })
    feedFrames()
    expect(h.hints.some(m => m.includes('皮带累计 180°'))).toBe(true)
    h.rerender({ replaySignal: 1 })
    feedFrames()
    expect(h.hints.some(m => m.includes('皮带累计 360°'))).toBe(true)
  })
})

describe('SymmetryViewScene · 2T 说明框（v6 点5：矩阵 → 四元数 → 旋转）', () => {
  beforeEach(() => { frameCbs.length = 0 })

  it('嵌入可收起说明框：默认收起，点标题栏展开 → 两步算式 + KaTeX 公式', () => {
    const { container } = render(
      <SymmetryViewScene group={g} showAction onHint={() => {}} />,
    )
    const box = container.querySelector('[data-testid="sym-belt-info"]')
    expect(box).not.toBeNull()
    // 默认收起：只有标题栏（不挡画布）
    expect(box!.textContent).toContain('SL(2,3)：矩阵怎样算出旋转')
    expect(box!.textContent).not.toContain('反解四元数')
    fireEvent.click(container.querySelector('[data-testid="sym-belt-info-toggle"]')!)
    // 展开后是真实中文文案（i18n mock 查 zh 表）：标题 + 两步算式
    expect(box!.textContent).toContain('SL(2,3)：矩阵怎样算出旋转')
    expect(box!.textContent).toContain('F₃ 上行列式为 1 的 2×2 矩阵')
    expect(box!.textContent).toContain('① 反解四元数')
    expect(box!.textContent).toContain('② 半角余弦')
    // KaTeX 公式：M、反解四元数、cos ψ = a₀/2 都渲染出 katex HTML
    expect(box!.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(3)
    expect(box!.innerHTML).toContain('det')
    // 未选元素：显示「点一个元素」提示而不是当前元素实例
    expect(box!.textContent).toContain('点一个元素')
    expect(box!.textContent).not.toContain('当前元素')
  })

  it('说明框可收起：再点标题栏正文消失', () => {
    const { container } = render(
      <SymmetryViewScene group={g} showAction onHint={() => {}} />,
    )
    const box = container.querySelector('[data-testid="sym-belt-info"]')!
    const toggle = container.querySelector('[data-testid="sym-belt-info-toggle"]')!
    fireEvent.click(toggle)
    expect(box.textContent).toContain('F₃ 上行列式为 1 的 2×2 矩阵')
    fireEvent.click(toggle)
    expect(box.textContent).not.toContain('F₃ 上行列式为 1 的 2×2 矩阵')
    expect(box.textContent).toContain('SL(2,3)：矩阵怎样算出旋转') // 标题栏仍在
  })

  it('有演示元素时把实际数字代进去：M → q 坐标 → 角度/轴/皮带', () => {
    const { container } = render(
      <SymmetryViewScene group={g} showAction actionElementId={j4.id} onHint={() => {}} />,
    )
    const box = container.querySelector('[data-testid="sym-belt-info"]')!
    fireEvent.click(container.querySelector('[data-testid="sym-belt-info-toggle"]')!)
    expect(box.textContent).toContain('当前元素')
    // 反解出的四元数坐标（q = (a₀+b₀i+c₀j+d₀k)/2）出现在 KaTeX 里
    const quat = sl23QuatFromMatrix(sl23Matrix(j4.value[0]))!
    expect(quat).not.toBeNull()
    expect(box.innerHTML).toContain(`\\tfrac{${quat[0]} + ${quat[1]}i + ${quat[2]}j + ${quat[3]}k}{2}`)
    // 旋转读数（4 阶元：180°，皮带 180°；轴取该元素自旋同源）
    const spin = sl23Spin(j4.value[0])
    const axisTxt = `(${spin.axis!.map(v => v.toFixed(2)).join(', ')})`
    expect(box.textContent).toContain(axisTxt)
    expect(box.textContent).toContain('皮带 180°')
    // 矩阵标签经 KaTeX 渲染（smallmatrix）
    expect(box.innerHTML).toContain('smallmatrix')
  })
})

describe('SymmetryViewScene · 画面中心 centerOn（v6 点3/点4）', () => {
  beforeEach(() => { frameCbs.length = 0 })

  it('centerOn=solid（缺省）：轨道目标 = 原点，相机保持默认姿态', () => {
    render(<SymmetryViewScene group={g} showAction actionElementId={j4.id} onHint={() => {}} />)
    feedFrames()
    const cam = readSymmetryCamera()
    // 默认相机 [0,9.2,31.8] 看原点
    expect(cam.position[0]).toBeCloseTo(0, 3)
    expect(cam.position[1]).toBeCloseTo(9.2, 3)
    expect(cam.position[2]).toBeCloseTo(31.8, 3)
  })

  it('centerOn=beltAnchor：目标平滑移到皮带固定端（锚点 = û·11.25）', () => {
    render(<SymmetryViewScene group={g} showAction actionElementId={j4.id} centerOn="beltAnchor" onHint={() => {}} />)
    feedFrames()
    const cam = readSymmetryCamera()
    // 期望相机位姿 = 锚点(û·11.25) + 默认方向·半径——轴取该元素自旋（j4 是首个 π 角
    // 元素，轴不一定是 Y；与 e2e spec 的 j4/i4 选法不同，别想当然）
    const axis = sl23Spin(j4.value[0]).axis!
    expect(cam.position[0]).toBeCloseTo(axis[0] * BELT_ANCHOR_DIST, 2)
    expect(cam.position[1]).toBeCloseTo(axis[1] * BELT_ANCHOR_DIST + 9.2, 2)
    expect(cam.position[2]).toBeCloseTo(axis[2] * BELT_ANCHOR_DIST + 31.8, 2)
    // 与 solid 中心的默认姿态明显不同（确实移到了固定端）
    expect(Math.abs(cam.position[0]) + Math.abs(cam.position[1] - 9.2) + Math.abs(cam.position[2] - 31.8)).toBeGreaterThan(1)
  })
})

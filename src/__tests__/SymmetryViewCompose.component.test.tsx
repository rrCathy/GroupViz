import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import * as THREE from 'three'
import { SymmetryViewScene } from '../components/Canvas/SymmetryViewScene'
import type { SymmetryViewSceneProps } from '../components/Canvas/SymmetryViewScene'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { computeElementRotation } from '../core/elementRotation'

// useFrame 回调收集：happy-dom 无 RAF 循环，测试手动喂 delta 驱动动画
// （与 Cayley3DWindowParams 同一套 R3F stub，useFrame 从 noop 改为收集）
const { frameCbs } = vi.hoisted(() => ({ frameCbs: [] as Array<(state: unknown, delta: number) => void> }))

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode }) => <div data-testid="r3f-canvas">{props.children}</div>,
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: { fov: 50, near: 0.1, far: 100, aspect: 1, position: { set() {} }, up: { set() {} }, lookAt() {} },
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
  useTranslation: () => ({ t: (k: string) => k }),
}))

const a4 = createAlternatingGroup(4)
const [elA, elB, elC] = [a4.elements[1]!, a4.elements[2]!, a4.elements[3]!]

/** 与场景同源的元素旋转四元数（computeGeometricRotation → setFromAxisAngle） */
function rotQuat(el: typeof a4.elements[number]): THREE.Quaternion {
  const r = computeElementRotation(a4, el)
  expect(r).not.toBeNull()
  expect(r!.angleRad).not.toBe(0)
  const q = new THREE.Quaternion()
  q.setFromAxisAngle(new THREE.Vector3(...r!.axis), r!.angleRad)
  return q
}

/** 左乘合成（与场景一致：目标 = 元素旋转 × 当前姿态） */
function composeOnto(el: typeof a4.elements[number], pose: THREE.Quaternion): THREE.Quaternion {
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

/** 挂载 harness：poses 收集落定上报，rerender 合并 props（换元素 / 触发信号） */
function mountComposeHarness() {
  const poses: [number, number, number, number][] = []
  let latest: Partial<SymmetryViewSceneProps> = {}
  const Harness = () => (
    <SymmetryViewScene
      group={a4}
      showAction
      compose
      {...latest}
      onPoseChange={q => { poses.push(q) }}
    />
  )
  const { rerender } = render(<Harness />)
  return {
    poses,
    rerender: (next: Partial<SymmetryViewSceneProps>) => {
      latest = { ...latest, ...next }
      rerender(<Harness />)
    },
  }
}

describe('SymmetryViewScene · compose mode（叠加演示合成语义）', () => {
  beforeEach(() => { frameCbs.length = 0 })

  it('非叠加：每个元素动画各自从恒等出发（互不叠加）', () => {
    const poses: [number, number, number, number][] = []
    const Harness = (props: Partial<SymmetryViewSceneProps>) => (
      <SymmetryViewScene group={a4} showAction {...props} onPoseChange={q => { poses.push(q) }} />
    )
    const { rerender } = render(<Harness actionElementId={elA.id} />)
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(elA))
    // 换元素 → 非叠加从恒等重播：落定 = 该元素自身旋转（非乘积）
    rerender(<Harness actionElementId={elB.id} />)
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(elB))
    // 非叠加重放（行为不变）：回恒等再旋转，落定仍是自身旋转
    rerender(<Harness replaySignal={1} />)
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(elB))
  })

  it('叠加：第二次作用 = Q_b·Q_a（左乘合成）', () => {
    const { poses, rerender } = mountComposeHarness()
    rerender({ actionElementId: elA.id })
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(elA))
    rerender({ actionElementId: elB.id })
    feedFrames()
    expectPoseClose(poses.at(-1), composeOnto(elB, rotQuat(elA)))
  })

  it('叠加：重复作用再合成（replay 信号 → Q_b²·Q_a）', () => {
    const { poses, rerender } = mountComposeHarness()
    rerender({ actionElementId: elA.id })
    feedFrames()
    rerender({ actionElementId: elB.id })
    feedFrames()
    // 同一元素再应用一次：元素旋转继续左乘当前姿态
    rerender({ replaySignal: 1 })
    feedFrames()
    expectPoseClose(poses.at(-1), composeOnto(elB, composeOnto(elB, rotQuat(elA))))
  })

  it('叠加：清除演示不动姿态，后续作用从保留姿态继续合成', () => {
    const { poses, rerender } = mountComposeHarness()
    rerender({ actionElementId: elA.id })
    feedFrames()
    rerender({ actionElementId: elB.id })
    feedFrames()
    const settledCount = poses.length
    rerender({ actionElementId: null })
    feedFrames()
    // 清除不产生新落定（姿态保持）
    expect(poses.length).toBe(settledCount)
    // 换元素再作用：从保留姿态（Q_b·Q_a）继续左乘，而非从恒等出发
    rerender({ actionElementId: elC.id })
    feedFrames()
    expectPoseClose(poses.at(-1), composeOnto(elC, composeOnto(elB, rotQuat(elA))))
  })

  it('叠加：复位信号 → homing 动画回恒等（落定上报 [0,0,0,1]）', () => {
    const { poses, rerender } = mountComposeHarness()
    rerender({ actionElementId: elA.id })
    feedFrames()
    rerender({ actionElementId: elB.id })
    feedFrames()
    expect(poses.at(-1)).not.toEqual(IDENTITY)
    rerender({ resetSignal: 1 })
    feedFrames()
    expectPoseClose(poses.at(-1), IDENTITY)
    // 复位后元素仍在 → replay 从恒等出发重播该元素
    rerender({ replaySignal: 2 })
    feedFrames()
    expectPoseClose(poses.at(-1), rotQuat(elB))
  })

  it('复位信号在恒等姿态下为 no-op（不产生多余落定）', () => {
    const poses: [number, number, number, number][] = []
    const Harness = (props: Partial<SymmetryViewSceneProps>) => (
      <SymmetryViewScene group={a4} showAction compose {...props} onPoseChange={q => { poses.push(q) }} />
    )
    // 无元素 → 姿态恒等；复位信号不产生多余动画/落定
    const { rerender } = render(<Harness actionElementId={null} />)
    feedFrames()
    rerender(<Harness resetSignal={5} />)
    feedFrames()
    expect(poses.length).toBe(0)
  })
})

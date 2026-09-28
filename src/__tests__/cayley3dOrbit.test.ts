import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  DEFAULT_SPIN_AXIS, FLICK_MIN_PIXELS, cameraDir, cameraRight, cameraUp, dragRotate, flickAxis,
  orbitFromQuat, quatFromOrbit, spinWorld,
} from '../components/Canvas/cayley3dOrbit'

// 3D 凯莱图轨道姿态：两组回归锁。
// ① 甩手惯性必须是**单轴旋转**（旧实现把拖拽向量拆成 θ̇/φ̇ 两个恒定速率分别积分，合成不是单轴旋转：
//    俯仰分量让相机无界漂移、反复翻越极点，可见旋向来回翻转。实测 6 秒：拖 (240,60) → 极点跨越 3 次 /
//    旋向反转 2 次 / 6 圈后未复位；拖 (240,240) → 9 / 8；拖 (60,240) → 12 / 5）。
// ② 拖拽必须**一直跟手**（2026-09-27 用户报「物体上下翻转后手势与运动完全反向」）：水平分量原先钉在
//    世界 Y 上，相机一滚转/翻到下半球，手的左右就被映射成世界反方向（滚转 90° 时甚至变成竖直位移）；
//    改成两个分量都取**相机局部轴**后与相机姿态无关。

const PHI0 = Math.acos(3 / Math.sqrt(3 ** 2 + 12 ** 2)) // 默认俯仰角（≈75.96°）
const K = 0.006 // DRAG_SENSITIVITY（与组件内一致）
const DT = 1 / 60
const R_CAM = 3.2 // 适配视角：相机距离 ≈ 3.2 × 外接球半径
const R_OBJ = 1.15 // "手抓住的球壳"半径（略大于节点云）
const Y_UP = new THREE.Vector3(0, 1, 0)

/** world 点在相机屏幕上的位置（严格按相机局部坐标算；近半球 = depth > 0） */
function screenOf(q: THREE.Quaternion, worldPt: THREE.Vector3) {
  const camPos = new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(R_CAM)
  const c = worldPt.clone().sub(camPos).applyQuaternion(q.clone().invert())
  const depth = -c.z
  if (depth < 0.2) return null // 远半球/相机后
  return { x: c.x / depth, y: c.y / depth, depth }
}

/** 物体表面采样点（球壳） */
const SHELL: THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < 400; i++) {
    const z = 1 - (2 * (i + 0.5)) / 400
    const r = Math.sqrt(1 - z * z)
    const a = i * 2.399963
    out.push(new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)).multiplyScalar(R_OBJ))
  }
  return out
})()

/** 抓取点 = 画面中央附近、可见、离相机最近的表面点（就是手压住的那块面） */
function grabPoint(q: THREE.Quaternion) {
  let best: { pt: THREE.Vector3; sx: number; sy: number; depth: number } | null = null
  for (const pt of SHELL) {
    const s = screenOf(q, pt)
    if (!s || Math.hypot(s.x, s.y) > 0.25) continue
    if (!best || s.depth < best.depth) best = { pt, sx: s.x, sy: s.y, depth: s.depth }
  }
  return best
}

/** 手势是否跟手：抓取点的屏幕位移与指针方向同向（屏幕 x 右为正、y 上为正；dy>0 = 指针向下） */
function followsHand(q: THREE.Quaternion, dx: number, dy: number): boolean | null {
  const g = grabPoint(q)
  if (!g) return null
  const q2 = q.clone()
  dragRotate(q2, dx, dy, K)
  const after = screenOf(q2, g.pt)
  if (!after) return null
  const mx = after.x - g.sx
  const my = after.y - g.sy
  const along = dx !== 0 ? mx * Math.sign(dx) : my * -Math.sign(dy)
  return along > 0
}

/** 旧实现的拖拽原语（水平钉在世界 Y 上，2026-09-27 前的实现），仅用于对照 */
function legacyDragRotate(q: THREE.Quaternion, dx: number, dy: number, sensitivity: number): THREE.Quaternion {
  if (dx) q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y_UP, -dx * sensitivity))
  if (dy) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * sensitivity))
  return q.normalize()
}

/** 世界系增量旋转（带符号）：deltaRot · qPrev === q */
function deltaRot(qPrev: THREE.Quaternion, q: THREE.Quaternion) {
  const qa = q.dot(qPrev) < 0 ? new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w) : q
  const d = qa.clone().multiply(qPrev.clone().invert())
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, d.w)))
  const axis = new THREE.Vector3(d.x, d.y, d.z)
  if (axis.lengthSq() < 1e-18) axis.set(0, 1, 0)
  else axis.normalize()
  return { angle: angle > Math.PI ? angle - 2 * Math.PI : angle, axis }
}

/**
 * 按给定每帧自旋函数积分 6 秒，返回单轴性 / 旋向稳定性指标。
 * 「可见旋向」= 球面标记点在屏幕上的绕心角 ψ 的方向（近投影中心处 ψ 变化率发散，
 * 该带域（屏幕半径 < 0.35）不采样，避免把投影奇点误判成旋向反转）。
 */
function measureSpin(step: (q: THREE.Quaternion) => void, radPerSec = 2 * Math.PI) {
  const q = quatFromOrbit(0, PHI0)
  const q0 = q.clone()
  const marker = new THREE.Vector3(1, 0, 0)
  let prev = q.clone()
  let firstAxis: THREE.Vector3 | null = null
  let maxAxisDev = 0
  let dirFlips = 0
  let lastSign = 0
  let prevPsi: { psi: number; r: number } | null = null
  let sumAngle = 0
  const upYs: number[] = []
  const steps = Math.round(6 / DT)
  for (let i = 0; i < steps; i++) {
    step(q)
    const d = deltaRot(prev, q)
    if (firstAxis === null) firstAxis = d.axis.clone()
    else {
      const dev = Math.acos(Math.max(-1, Math.min(1, Math.abs(d.axis.dot(firstAxis)))))
      maxAxisDev = Math.max(maxAxisDev, (dev * 180) / Math.PI)
    }
    sumAngle += Math.abs(d.angle)
    prev = q.clone()
    upYs.push(cameraDir(q).y)

    const s = screenOf(q, marker)
    if (!s) { prevPsi = null; continue }
    const r = Math.hypot(s.x, s.y)
    const psi = Math.atan2(s.y, s.x)
    if (prevPsi && prevPsi.r > 0.35 && r > 0.35) {
      let dpsi = psi - prevPsi.psi
      if (dpsi > Math.PI) dpsi -= 2 * Math.PI
      if (dpsi < -Math.PI) dpsi += 2 * Math.PI
      if (dpsi !== 0 && Math.abs(dpsi) < 0.35) {
        const sg = Math.sign(dpsi)
        if (lastSign !== 0 && sg !== lastSign) dirFlips++
        lastSign = sg
      }
    }
    prevPsi = r > 0.35 ? { psi, r } : null
  }
  return { q, q0, axis: firstAxis!, maxAxisDev, dirFlips, sumAngle, upYs, radPerSec }
}

/** 固定轴惯性（现实现）：轴向 = 释放瞬间冻结的那根轴 */
function spinFor6s(flick: { x: number; y: number }, radPerSec = 2 * Math.PI) {
  const axis = flickAxis(quatFromOrbit(0, PHI0), flick.x, flick.y)
  return { ...measureSpin(q => spinWorld(q, axis, radPerSec * DT), radPerSec), axis }
}

/** 旧实现的惯性（逐帧把甩手拆成 θ̇/φ̇ 两个恒定速率），用于对照 */
function legacySpinFor6s(flick: { x: number; y: number }, radPerSec = 2 * Math.PI) {
  const len = Math.hypot(flick.x, flick.y)
  return measureSpin(q => {
    if (len >= FLICK_MIN_PIXELS) {
      legacyDragRotate(q, ((flick.x / len) * radPerSec * DT) / K, ((flick.y / len) * radPerSec * DT) / K, K)
    } else {
      legacyDragRotate(q, (radPerSec * DT) / K, 0, K)
    }
  }, radPerSec)
}

describe('cayley3dOrbit：姿态基元', () => {
  it('quatFromOrbit 与旧球坐标视角一致（位置方向 + 屏幕上方 = 世界 Y 在视平面上的投影）', () => {
    for (const [theta, phi] of [[0, PHI0], [0.7, 1.1], [-1.3, 2.4]] as const) {
      const q = quatFromOrbit(theta, phi)
      const sinP = Math.sin(phi)
      const want = new THREE.Vector3(sinP * Math.sin(theta), Math.cos(phi), sinP * Math.cos(theta))
      expect(cameraDir(q).distanceTo(want)).toBeLessThan(1e-12)
      // 无滚转惯例：屏幕上方 = 世界 +Y 在视平面上的投影
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
      const fwd = cameraDir(q).negate()
      const projected = new THREE.Vector3(0, 1, 0).addScaledVector(fwd, -fwd.y).normalize()
      expect(up.distanceTo(projected)).toBeLessThan(1e-12)
    }
  })

  it('orbitFromQuat 是 quatFromOrbit 的逆（仅位置方向）', () => {
    for (const [theta, phi] of [[0.4, 0.9], [-2.1, 2.7]] as const) {
      const back = orbitFromQuat(quatFromOrbit(theta, phi))
      expect(back.phi).toBeCloseTo(phi, 12)
      expect(Math.sin(back.theta)).toBeCloseTo(Math.sin(theta), 12)
      expect(Math.cos(back.theta)).toBeCloseTo(Math.cos(theta), 12)
    }
  })

  it('dragRotate 的竖直分量与旧 θ/φ 标量实现逐帧等价（不超过极点的区域）', () => {
    const q = quatFromOrbit(0, PHI0)
    const legacyQ = quatFromOrbit(0, PHI0)
    let phi = PHI0
    for (let i = 0; i < 120; i++) {
      const dy = -0.35 + (i % 5) * 0.1
      dragRotate(q, 0, dy, K)
      phi -= dy * K
      // 旧实现的竖直分量 = 绕相机右轴转（局部 X），逐步重建
      const right = cameraRight(legacyQ, new THREE.Vector3())
      legacyQ.premultiply(
        new THREE.Quaternion().setFromAxisAngle(right, -dy * K),
      ).normalize()
    }
    expect(phi).toBeGreaterThan(0)
    expect(phi).toBeLessThan(Math.PI)
    expect(Math.abs(q.dot(legacyQ))).toBeGreaterThan(1 - 1e-9)
  })

  it('水平分量改走屏幕上方轴：正立视角下屏幕位移方向与旧实现同号（改动不改手感）', () => {
    const q = quatFromOrbit(0, PHI0)
    // 旧实现：水平 = 绕世界 Y
    const legacyQ = q.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(Y_UP, -6 * K))
    const newQ = q.clone()
    dragRotate(newQ, 6, 0, K)
    const grab = grabPoint(q)!
    const sLegacy = screenOf(legacyQ, grab.pt)!
    const sNew = screenOf(newQ, grab.pt)!
    const dLegacy = sLegacy.x - grab.sx
    const dNew = sNew.x - grab.sx
    expect(Math.sign(dLegacy)).toBe(Math.sign(dNew))
    // 幅度差 < 20%（两者只差一个 14° 的轴倾斜）
    expect(Math.abs(dNew - dLegacy) / Math.abs(dLegacy)).toBeLessThan(0.2)
  })

  it('flickAxis：位移 < 8px 回落默认竖轴；轴 = 释放瞬间的相机局部轴（与手势同系）', () => {
    const q = quatFromOrbit(0, PHI0)
    expect(flickAxis(q, 0, 0).distanceTo(DEFAULT_SPIN_AXIS)).toBeLessThan(1e-12)
    expect(flickAxis(q, FLICK_MIN_PIXELS - 1, 0).distanceTo(DEFAULT_SPIN_AXIS)).toBeLessThan(1e-12)
    // 水平甩手 → 转轴 = 屏幕上方轴（相机局部 +Y）；竖直甩手 → 转轴 = 屏幕右方轴（局部 +X）
    expect(Math.abs(flickAxis(q, 240, 0).dot(cameraUp(q)))).toBeCloseTo(1, 12)
    expect(Math.abs(flickAxis(q, 0, 240).dot(cameraRight(q)))).toBeCloseTo(1, 12)
    // 正立视角下屏幕上方轴与世界竖轴相差 ~14°（相机俯角），但屏幕手感同向
    const up = cameraUp(q)
    expect((Math.acos(Math.abs(up.dot(Y_UP))) * 180) / Math.PI).toBeCloseTo(14.04, 1)
  })

  it('惯性方向延续拖拽方向（不反向）', () => {
    const q = quatFromOrbit(0, PHI0)
    const dx = 7
    const dy = 3
    const before = cameraDir(q, new THREE.Vector3())
    dragRotate(q, dx, dy, K)
    const dragMove = cameraDir(q, new THREE.Vector3()).sub(before) // 拖拽一帧后相机移动方向
    const axis = flickAxis(q, dx, dy)
    const spinMove = new THREE.Vector3().crossVectors(axis, cameraDir(q, new THREE.Vector3()))
    expect(dragMove.dot(spinMove)).toBeGreaterThan(0)
  })
})

describe('cayley3dOrbit：拖拽一直跟手（回归，2026-09-27）', () => {
  const base = quatFromOrbit(0, PHI0)
  const spin = (q: THREE.Quaternion, axis: THREE.Vector3, angle: number) =>
    q.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).normalize()
  const orients: [string, THREE.Quaternion][] = [
    ['正立（默认视角）', base.clone()],
    ['上下颠倒（绕视轴 180°）', spin(base, cameraDir(base), Math.PI)],
    ['相机翻到下半球（绕屏幕右轴 180°）', spin(base, cameraRight(base, new THREE.Vector3()), Math.PI)],
    ['滚转 90°', spin(base, cameraDir(base), Math.PI / 2)],
    ['滚转 −90°', spin(base, cameraDir(base), -Math.PI / 2)],
  ]
  const drags: [string, number, number][] = [
    ['拖右', 8, 0], ['拖左', -8, 0], ['拖下', 0, 8], ['拖上', 0, -8],
  ]

  it('正立视角下两个方向都跟手（这条是基线，旧实现在此也成立）', () => {
    const q = quatFromOrbit(0, PHI0)
    for (const [, dx, dy] of drags) expect(followsHand(q, dx, dy)).toBe(true)
  })

  it.each(orients)('%s：四个方向都跟手（旧实现：水平反向 / 变成竖直位移）', (_label, q0) => {
    for (const [, dx, dy] of drags) expect(followsHand(q0, dx, dy)).toBe(true)
  })

  it('对照：把水平分量钉回世界 Y（旧实现）在翻转后即失效', () => {
    const legacyFollows = (q: THREE.Quaternion, dx: number, dy: number) => {
      const g = grabPoint(q)!
      const q2 = q.clone()
      legacyDragRotate(q2, dx, dy, K)
      const after = screenOf(q2, g.pt)!
      const along = dx !== 0 ? (after.x - g.sx) * Math.sign(dx) : (after.y - g.sy) * -Math.sign(dy)
      return along > 0
    }
    const flipped = spin(base, cameraDir(base), Math.PI)
    expect(legacyFollows(base.clone(), 8, 0)).toBe(true) // 正立时正常
    expect(legacyFollows(flipped, 8, 0)).toBe(false) // 翻转后水平反向 ← 用户报的现象
    expect(legacyFollows(flipped, 0, 8)).toBe(true) // 竖直分量本来就是局部轴，一直正常
  })
})

describe('cayley3dOrbit：释放后的惯性是单轴旋转（回归）', () => {
  it.each([
    ['纯水平拖拽', { x: 240, y: 0 }],
    ['轻微带竖直分量', { x: 240, y: 60 }],
    ['对角拖拽', { x: 240, y: 240 }],
    ['以竖直为主', { x: 60, y: 240 }],
  ])('%s：转轴不漂移、可见旋向不反转、整圈后姿态精确复位', (_label, flick) => {
    const { q, q0, axis, maxAxisDev, dirFlips, sumAngle, upYs } = spinFor6s(flick)
    // 转轴恒定（旧实现：28°~90° 漂移；1e-4° 已是浮点噪声量级）
    expect(maxAxisDev).toBeLessThan(1e-4)
    // 可见旋向从不反转（旧实现实测 2~8 次反转 —— 用户看到的「来回转」）
    expect(dirFlips).toBe(0)
    // 6 秒 = 6 整圈（ω = 2π rad/s）：姿态必须精确复位（旧实现末态 up.y = −0.999 / −0.197 / 0.637）
    expect(sumAngle / (2 * Math.PI)).toBeCloseTo(6, 3)
    expect(Math.abs(q.dot(q0))).toBeGreaterThan(1 - 1e-9)
    // 相机方向连续（无极点处跳变）
    let maxStep = 0
    for (let i = 1; i < upYs.length; i++) maxStep = Math.max(maxStep, Math.abs(upYs[i] - upYs[i - 1]))
    expect(maxStep).toBeLessThan(0.2)
    expect(axis.length()).toBeCloseTo(1, 12)
  })

  it('对照：旧实现的逐帧 θ̇/φ̇ 惯性在同一指标下会漂移且不复位（用例有鉴别力）', () => {
    const flick = { x: 240, y: 60 }
    const legacy = legacySpinFor6s(flick)
    const fixed = spinFor6s(flick)
    // 旧实现：转轴漂移 28°（实测）+ 6 整圈后姿态未复位（相机 up 的 y 分量 −0.999）
    expect(legacy.maxAxisDev).toBeGreaterThan(10)
    expect(Math.abs(legacy.q.dot(legacy.q0))).toBeLessThan(0.99)
    // 现实现：转轴不漂移、整圈精确复位
    expect(fixed.maxAxisDev).toBeLessThan(1e-4)
    expect(Math.abs(fixed.q.dot(fixed.q0))).toBeGreaterThan(1 - 1e-9)
  })

  it('轻微竖直分量不再让相机翻越极点（旧实现 6 秒内 3 次）', () => {
    const q = quatFromOrbit(0, PHI0)
    const axis = flickAxis(q, 240, 60)
    // 转轴 = 屏幕上方轴 + 屏幕右方轴的合成：与竖直方向夹角 ≈ 19.7°（水平分量取屏幕轴后，
    // 比旧实现取世界 Y 时的 14° 略大 —— 两者屏幕手感同向，仅自展示轴略偏）
    const tilt = Math.acos(Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))))
    expect((tilt * 180) / Math.PI).toBeCloseTo(19.75, 1)
    // 相机绕轴的锥面半角 ~76°：与极点仍差 ~56°，全程 |dir.y| ≤ 0.6（旧实现会到 ±1 并翻转 up）
    let maxAbsY = 0
    for (let i = 0; i < Math.round(6 / DT); i++) {
      spinWorld(q, axis, 2 * Math.PI * DT)
      maxAbsY = Math.max(maxAbsY, Math.abs(cameraDir(q, new THREE.Vector3()).y))
    }
    expect(maxAbsY).toBeLessThan(0.6)
  })
})

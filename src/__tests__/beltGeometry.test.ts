import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BELT_ANCHOR_DIST, BELT_SEGMENTS, BELT_WIDTH, BELT_RESTORE_AMOUNT, BELT_PIN_MARGIN,
  beltStations, beltTaper, beltTwistProfile, beltRestoreDirections, beltStationsFlat,
} from '../components/Canvas/beltGeometry'

/**
 * Dirac 开口皮带几何（beltGeometry.ts 纯函数直测，2026-10-15 v4）：
 * - **皮带与旋转轴同轴**：锚点 = û·L，中心线恒为直线（锚点→物体中心）；
 * - **扭转 = 带面绕自身中心线的翻转**（莫比乌斯式）：宽向量绕带轴 T = −û
 *   按 φ(s) = −τ·w(s) 递增（w = beltTwistProfile：固定端夹持区 0 → 线性 →
 *   入体点满扭），中心线不卷；
 * - **扭转分布收进可见段**（bodyRadius）：四面体内不堆扭、固定端留夹持平直区；
 * - **正反双色**由 FrontSide/BackSide 渲染（几何只提供带面，不在此测）。
 *
 * 断言口径：宽向 = e1−e2 归一化（只在 taper > 0 的站上量）；期望值用
 * beltTwistProfile 同源 oracle 计算（不硬编码站值）。
 */

const SEG = BELT_SEGMENTS
const MID = Math.round(SEG * 0.5)
const S075 = Math.round(SEG * 0.75)

/** 同源 oracle：期望宽向 W(s) = R(T, −τ·w(s))·W₀（T = −û；W₀ 由 ref 规则决定） */
function expectedWidthDir(tau: number, axis: [number, number, number], s: number, bodyRadius = 0): THREE.Vector3 {
  const u = new THREE.Vector3(...axis).normalize()
  const T = u.clone().negate()
  const ref = Math.abs(T.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  const W0 = new THREE.Vector3().crossVectors(ref, T).normalize()
  return W0.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(T, -tau * beltTwistProfile(s, bodyRadius, BELT_ANCHOR_DIST)))
}

const widthDirOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).sub(new THREE.Vector3(...s.e2)).normalize()
const widthOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).distanceTo(new THREE.Vector3(...s.e2))
/** 逐值容差比较（真 bug ≥1e-3 量级，1e-9 容差只放浮点噪声；toFixed+toEqual 会被
 *  0.9625 类舍入边界值随算术路径翻面） */
const expectCloseStations = (a: ReturnType<typeof beltStations>, b: ReturnType<typeof beltStations>) => {
  const fa = beltStationsFlat(a)
  const fb = beltStationsFlat(b)
  expect(fa).toHaveLength(fb.length)
  for (let i = 0; i < fa.length; i++) expect(Math.abs(fa[i]! - fb[i]!)).toBeLessThan(1e-9)
}

describe('beltGeometry · 常态（无演练）', () => {
  it('axis=null、τ=0：竖直直线，锚点 (0,L,0)、尖端正落中心、锚端满宽', () => {
    const st = beltStations({ tau: 0, axis: null })
    expect(st).toHaveLength(SEG + 1)
    expect(st[0]!.cx).toBeCloseTo(0, 9)
    expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
    expect(st[SEG]!.cx).toBeCloseTo(0, 9)
    expect(st[SEG]!.cy).toBeCloseTo(0, 9)
    for (const s of st) {
      expect(s.cx).toBeCloseTo(0, 9)
      expect(s.cz).toBeCloseTo(0, 9)
    }
    expect(widthOf(st[0]!)).toBeCloseTo(BELT_WIDTH, 6)
    expect(widthOf(st[SEG]!)).toBeCloseTo(0, 9)
    expect(widthDirOf(st[0]!).x).toBeCloseTo(1, 9)
  })

  it('锚点随轴重新对准：axis=(1,0,0) ⇒ 锚点 (L,0,0)，中心线躺在 X 轴上', () => {
    const st = beltStations({ tau: 0, axis: [1, 0, 0] })
    expect(st[0]!.cx).toBeCloseTo(BELT_ANCHOR_DIST, 9)
    expect(st[0]!.cy).toBeCloseTo(0, 9)
    for (const s of st) {
      expect(s.cy).toBeCloseTo(0, 9)
      expect(s.cz).toBeCloseTo(0, 9)
    }
    const wd = widthDirOf(st[0]!)
    expect(wd.y).toBeCloseTo(-1, 9)
  })

  it('扭转绕带自身轴（理发店柱）：中心线不动，宽向按剖面递增旋转', () => {
    const st = beltStations({ tau: Math.PI, axis: [0, 1, 0] })
    // 中心线仍在竖直线上（v2 的螺旋甩线在这里必然失败）
    for (const s of st) {
      expect(Math.hypot(s.cx, s.cz)).toBeCloseTo(0, 9)
    }
    // 中段宽向 = 同源 oracle
    const wd = widthDirOf(st[MID]!)
    const exp = expectedWidthDir(Math.PI, [0, 1, 0], MID / SEG)
    expect(wd.distanceTo(exp)).toBeLessThan(1e-9)
  })

  it('水平轴同样绕自身轴扭（中心线仍直线）——v2 螺旋 bug 的反例', () => {
    const st = beltStations({ tau: Math.PI, axis: [1, 0, 0] })
    for (const s of st) {
      expect(s.cy).toBeCloseTo(0, 9)
      expect(s.cz).toBeCloseTo(0, 9)
    }
    const wd = widthDirOf(st[MID]!)
    const exp = expectedWidthDir(Math.PI, [1, 0, 0], MID / SEG)
    expect(wd.distanceTo(exp)).toBeLessThan(1e-9)
  })

  it('锚点端 = 固定参考端：截面朝向不随 τ 变（夹持区语义）', () => {
    const a = beltStations({ tau: 0, axis: [0, 1, 0] })
    const b = beltStations({ tau: 3.7 * Math.PI, axis: [0, 1, 0] })
    expect(widthDirOf(a[0]!).distanceTo(widthDirOf(b[0]!))).toBeLessThan(1e-9)
    // 夹持区内（s < BELT_PIN_MARGIN）整段都不扭（floor：station 恰在边界之外的略过）
    const sMargin = Math.floor(SEG * BELT_PIN_MARGIN)
    for (let i = 1; i <= sMargin; i++) {
      expect(widthDirOf(a[i]!).distanceTo(widthDirOf(b[i]!))).toBeLessThan(1e-9)
    }
    expect(b[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
  })

  it('扭转分布收进可见段（bodyRadius=1.7, L=3.4 ⇒ 入体点 s=0.5）：入体后不再累扭、夹持区不扭', () => {
    const br = 1.7
    const st = beltStations({ tau: 2 * Math.PI, axis: [0, 1, 0], bodyRadius: br })
    const sEnter = 1 - br / BELT_ANCHOR_DIST
    expect(sEnter).toBeCloseTo(0.5, 9)
    const at = (f: number) => st[Math.round(SEG * f)]!
    // 入体点之后：宽向恒定（= 满扭姿态）
    const after = widthDirOf(at(0.6))
    for (const f of [0.7, 0.8, 0.9]) {
      expect(widthDirOf(at(f)).distanceTo(after)).toBeLessThan(1e-9)
    }
    expect(after.distanceTo(expectedWidthDir(2 * Math.PI, [0, 1, 0], sEnter + 0.01, br))).toBeLessThan(1e-9)
    // 夹持区：宽向 = W₀
    expect(widthDirOf(at(0.03)).x).toBeCloseTo(1, 9)
    // 剖面端点
    expect(beltTwistProfile(0, br, BELT_ANCHOR_DIST)).toBe(0)
    expect(beltTwistProfile(BELT_PIN_MARGIN - 1e-9, br, BELT_ANCHOR_DIST)).toBe(0)
    expect(beltTwistProfile(sEnter, br, BELT_ANCHOR_DIST)).toBe(1)
    expect(beltTwistProfile(1, br, BELT_ANCHOR_DIST)).toBe(1)
  })

  it('带约束：宽向 ⊥ 切线在每一站严格成立（τ 与轴任意）', () => {
    for (const axis of [[0, 1, 0], [1, 0, 0], [0.3, 0.8, -0.52]] as [number, number, number][]) {
      const st = beltStations({ tau: 2.3 * Math.PI, axis })
      for (let i = 1; i < SEG; i++) {
        const t = new THREE.Vector3(st[i + 1]!.cx - st[i - 1]!.cx, st[i + 1]!.cy - st[i - 1]!.cy, st[i + 1]!.cz - st[i - 1]!.cz).normalize()
        const wd = widthDirOf(st[i]!)
        expect(Math.abs(wd.dot(t))).toBeLessThan(1e-9)
      }
    }
  })

  it('180° 莫比乌斯式翻面：s=0.75 宽向与同源 oracle 一致（带面翻转可见）', () => {
    const st = beltStations({ tau: Math.PI, axis: [0, 1, 0] })
    const wd = widthDirOf(st[S075]!)
    const exp = expectedWidthDir(Math.PI, [0, 1, 0], S075 / SEG)
    expect(wd.distanceTo(exp)).toBeLessThan(1e-9)
  })

  it('削尖：末段线性收锥到 0，尖端正落旋转轴（物体中心）', () => {
    const st = beltStations({ tau: 2, axis: [0, 1, 0] })
    expect(widthOf(st[SEG]!)).toBeCloseTo(0, 9)
    expect(st[SEG]!.cy).toBeCloseTo(0, 9)
    let prev = Infinity
    for (const s of st) {
      const w = widthOf(s)
      expect(w).toBeLessThanOrEqual(prev + 1e-9)
      prev = w
    }
    expect(beltTaper(0)).toBe(1)
    expect(beltTaper(1)).toBe(0)
  })
})

describe('beltGeometry · 720° 复原演练', () => {
  const dirs = { restoreOrbitAxis: [0, 0, 1] as [number, number, number], restoreBow: [1, 0, 0] as [number, number, number] }

  it('restoreT→0 连续：位形趋近缠态（无跳变）', () => {
    const wound = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], bodyRadius: 1.7 })
    const start = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], bodyRadius: 1.7, restoreT: 1e-6, ...dirs })
    expect(start[SEG]!.cy).toBeCloseTo(wound[SEG]!.cy, 4)
    expect(start[S075]!.cx).toBeCloseTo(wound[S075]!.cx, 4)
    expect(start[S075]!.cz).toBeCloseTo(wound[S075]!.cz, 4)
  })

  it('restoreT=1（τ=4π 全解）：与平直带逐位一致（容差 1e-9）', () => {
    const done = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], restoreT: 1, ...dirs })
    const plain = beltStations({ tau: 0, axis: [0, 1, 0] })
    expectCloseStations(done, plain)
  })

  it('restoreT=0.5：物体端在公转轨道上（离中心），带约束仍成立', () => {
    const mid = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], restoreT: 0.5, ...dirs })
    // 物体端绕锚点公转半圈：锚点 (0,L,0)，端点 = 锚点 + R(Z,π)·(0,−L,0) = (0,2L,0)
    expect(mid[SEG]!.cy).toBeCloseTo(2 * BELT_ANCHOR_DIST, 5)
    expect(mid[SEG]!.cx).toBeCloseTo(0, 5)
    // 弓形曲线上宽向 ⊥ 切线仍然严格成立（平行输运保持垂直性）
    for (let i = 1; i < SEG; i++) {
      const t = new THREE.Vector3(mid[i + 1]!.cx - mid[i - 1]!.cx, mid[i + 1]!.cy - mid[i - 1]!.cy, mid[i + 1]!.cz - mid[i - 1]!.cz).normalize()
      const wd = widthDirOf(mid[i]!)
      expect(Math.abs(wd.dot(t))).toBeLessThan(1e-9)
    }
    // 锚点仍钉死
    expect(mid[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
  })

  it('τ > 720° 演练后残留扭转（τ=5π，restoreT=1 ⇒ τ_eff=π）', () => {
    const st = beltStations({ tau: 5 * Math.PI, axis: [0, 1, 0], restoreT: 1, ...dirs })
    for (const s of st) expect(Math.hypot(s.cx, s.cz)).toBeCloseTo(0, 6)
    const wd = widthDirOf(st[MID]!)
    const exp = expectedWidthDir(Math.PI, [0, 1, 0], MID / SEG)
    expect(wd.distanceTo(exp)).toBeLessThan(1e-9)
  })
})

describe('beltGeometry · 辅助', () => {
  it('beltRestoreDirections：公转轴水平、弓起朝相机右方', () => {
    // 真 Camera（isCamera ⇒ lookAt 用 −Z 朝目标），Object3D 会翻转方向
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 3, 10)
    cam.lookAt(0, 0, 0)
    cam.updateMatrix()
    const dirs = beltRestoreDirections(cam)
    const orbit = new THREE.Vector3(...dirs.orbitAxis)
    const bow = new THREE.Vector3(...dirs.bow)
    expect(Math.abs(orbit.y)).toBeLessThan(1e-9)
    expect(Math.abs(bow.y)).toBeLessThan(1e-9)
    expect(orbit.length()).toBeCloseTo(1, 9)
    expect(bow.length()).toBeCloseTo(1, 9)
    // 默认相机（+Z 处看原点）：右方 ≈ +X；公转轴 = right × up = (1,0,0)×(0,1,0) = (0,0,1)
    expect(orbit.z).toBeCloseTo(1, 6)
    expect(bow.x).toBeCloseTo(1, 6)
  })
})

import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BELT_ANCHOR_DIST, BELT_SEGMENTS, BELT_WIDTH, BELT_RESTORE_AMOUNT,
  beltStations, beltTaper, beltRestoreDirections, beltStationsFlat,
} from '../components/Canvas/beltGeometry'

/**
 * Dirac 开口皮带几何（beltGeometry.ts 纯函数直测，2026-10-15 v3）：
 * - **皮带与旋转轴同轴**：锚点 = û·L，中心线恒为直线（锚点→物体中心）；
 * - **扭转 = 带面绕自身中心线的翻转**（莫比乌斯式）：宽向量绕带轴 T = −û
 *   递增转 φ(s) = −τ·s，中心线不卷（v2 螺旋甩线的反例直接入测）；
 * - **锚点端 = 固定参考端**：截面朝向恒为 W₀（不随 τ 变）；
 * - **带面几何 4π 周期**：τ=720° 与 τ=0 逐位同形（拓扑复原的几何表现）；
 * - **720° 复原演练**：restoreT=0/1 与缠态/平直态两端连续，中段物体端离中心。
 *
 * 断言口径：宽向 = e1−e2 归一化（只在 taper > 0 的站上量，尖端带宽 0 退化不断）。
 */

const SEG = BELT_SEGMENTS
const MID = Math.round(SEG * 0.5)
const S075 = Math.round(SEG * 0.75) // taper(0.75) = 0.71，带宽仍饱满

const centers = (stations: ReturnType<typeof beltStations>) =>
  stations.map(s => new THREE.Vector3(s.cx, s.cy, s.cz))
/** 宽向（e1−e2 归一化） */
const widthDirOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).sub(new THREE.Vector3(...s.e2)).normalize()
const widthOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).distanceTo(new THREE.Vector3(...s.e2))
/** 逐值容差比较（真 bug ≥1e-3 量级，1e-9 容差只放过浮点末位噪声；
 *  不用 toFixed+toEqual——0.9625 这类恰在舍入边界的值会随算术路径翻面） */
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
    for (const c of centers(st)) {
      expect(c.x).toBeCloseTo(0, 9)
      expect(c.z).toBeCloseTo(0, 9)
    }
    expect(widthOf(st[0]!)).toBeCloseTo(BELT_WIDTH, 6)
    expect(widthOf(st[SEG]!)).toBeCloseTo(0, 9)
    // 锚端宽向 = (1,0,0)（带面法向 T×W₀ = +Z，默认相机可见）
    expect(widthDirOf(st[0]!).x).toBeCloseTo(1, 9)
  })

  it('锚点随轴重新对准：axis=(1,0,0) ⇒ 锚点 (L,0,0)，中心线躺在 X 轴上', () => {
    const st = beltStations({ tau: 0, axis: [1, 0, 0] })
    expect(st[0]!.cx).toBeCloseTo(BELT_ANCHOR_DIST, 9)
    expect(st[0]!.cy).toBeCloseTo(0, 9)
    for (const c of centers(st)) {
      expect(c.y).toBeCloseTo(0, 9)
      expect(c.z).toBeCloseTo(0, 9)
    }
    // 锚端宽向 (0,−1,0)，带面法向 T×W₀ = +Z 仍朝默认相机
    const wd = widthDirOf(st[0]!)
    expect(wd.y).toBeCloseTo(-1, 9)
  })

  it('扭转绕带自身轴（理发店柱）：中心线不动，宽向沿带递增旋转', () => {
    const st = beltStations({ tau: Math.PI, axis: [0, 1, 0] })
    // 中心线仍在竖直线上（v2 的螺旋甩线在这里必然失败）
    for (const c of centers(st)) {
      expect(Math.hypot(c.x, c.z)).toBeCloseTo(0, 9)
    }
    // W(s) = R(T=(0,−1,0), −πs)·(1,0,0)：s=0.5 ⇒ 转了 π/2 ⇒ 宽向 (0,0,−1)
    const mid = widthDirOf(st[MID]!)
    expect(mid.z).toBeCloseTo(-1, 6)
    expect(mid.x).toBeCloseTo(0, 6)
  })

  it('水平轴同样绕自身轴扭（中心线仍直线）——v2 螺旋 bug 的反例', () => {
    const st = beltStations({ tau: Math.PI, axis: [1, 0, 0] })
    for (const c of centers(st)) {
      expect(c.y).toBeCloseTo(0, 9)
      expect(c.z).toBeCloseTo(0, 9)
    }
    // W(0.5) = R(T=(−1,0,0), −π/2)·(0,−1,0) = (0,0,−1)
    const mid = widthDirOf(st[MID]!)
    expect(mid.z).toBeCloseTo(-1, 6)
    expect(mid.y).toBeCloseTo(0, 6)
  })

  it('锚点端 = 固定参考端：截面朝向不随 τ 变', () => {
    const a = beltStations({ tau: 0, axis: [0, 1, 0] })
    const b = beltStations({ tau: 3.7 * Math.PI, axis: [0, 1, 0] })
    const wa = widthDirOf(a[0]!)
    const wb = widthDirOf(b[0]!)
    expect(wa.distanceTo(wb)).toBeLessThan(1e-9)
    // 锚点位置也不动
    expect(b[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
  })

  it('180° 莫比乌斯式翻面：s=0.75 处宽向转了 135°（z 分量变号前夜）', () => {
    // W(0.75) = R((0,−1,0), −0.75π)·(1,0,0)：绕 +Y 转 +0.75π ⇒ (cos135°,0,−sin135°)
    const st = beltStations({ tau: Math.PI, axis: [0, 1, 0] })
    const wd = widthDirOf(st[S075]!)
    const c = Math.cos(0.75 * Math.PI)
    const s = Math.sin(0.75 * Math.PI)
    expect(wd.x).toBeCloseTo(c, 6)
    expect(wd.z).toBeCloseTo(-s, 6)
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

  it('扭转线性分布：中段恰转 τ/2（竖轴与水平轴同规律）', () => {
    // 竖轴 τ=2π：W(0.5) = R(T,−π)·W₀ = −W₀
    const v = beltStations({ tau: 2 * Math.PI, axis: [0, 1, 0] })
    expect(widthDirOf(v[MID]!).x).toBeCloseTo(-1, 6)
    // 水平轴 τ=2π：锚端宽向 (0,−1,0)，中段 = −(0,−1,0) = (0,1,0)
    const h = beltStations({ tau: 2 * Math.PI, axis: [1, 0, 0] })
    expect(widthDirOf(h[MID]!).y).toBeCloseTo(1, 6)
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
    const wound = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0] })
    const start = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], restoreT: 1e-6, ...dirs })
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
    // 物体端绕锚点公转半圈：锚点 (0,6.3,0)，端点 = 锚点 + R(Z,π)·(0,−6.3,0) = (0,12.6,0)
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
    // τ_eff = π ⇒ 中心线回直线、中段宽向 = R(T,−π/2)·W₀ = (0,0,−1)
    for (const c of centers(st)) expect(Math.hypot(c.x, c.z)).toBeCloseTo(0, 6)
    expect(widthDirOf(st[MID]!).z).toBeCloseTo(-1, 6)
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

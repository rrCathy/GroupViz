import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BELT_ANCHOR_Y, BELT_SEGMENTS, BELT_WIDTH, BELT_FULL_TURN,
  beltStations, beltTaper, beltWindProfile, beltRestoreDirections, beltStationsFlat,
} from '../components/Canvas/beltGeometry'

/**
 * Dirac 开口皮带几何（beltGeometry.ts 纯函数直测，2026-10-15 v2）：
 * 扭转轴与物体同轴（水平轴也缠）、物体端削尖、720° 复原演练弓形。
 *
 * 断言口径：带面方向用 **s=0.725 中段站**（windProfile=0.5，扭转角 = τ/2，带宽仍饱满）；
 * 尖端（s=1）带宽为 0（削尖），边方向退化，不断。
 */

const SEG = BELT_SEGMENTS
const MID = Math.round(SEG * 0.725)

const centers = (stations: ReturnType<typeof beltStations>) =>
  stations.map(s => new THREE.Vector3(s.cx, s.cy, s.cz))
/** 带面方向（e1−e2 归一化） */
const frameDirOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).sub(new THREE.Vector3(...s.e2)).normalize()
const widthOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).distanceTo(new THREE.Vector3(...s.e2))

describe('beltGeometry · 常态（无演练）', () => {
  it('tau=0：竖直直线，锚点固定、尖端正落中心、两端宽度', () => {
    const st = beltStations({ tau: 0, axis: [0, 1, 0] })
    expect(st).toHaveLength(SEG + 1)
    expect(st[0]!.cx).toBeCloseTo(0, 9)
    expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_Y, 9)
    expect(st[SEG]!.cx).toBeCloseTo(0, 9)
    expect(st[SEG]!.cy).toBeCloseTo(0, 9)
    for (const c of centers(st)) {
      expect(c.x).toBeCloseTo(0, 9)
      expect(c.z).toBeCloseTo(0, 9)
    }
    expect(widthOf(st[0]!)).toBeCloseTo(BELT_WIDTH, 6)
    expect(widthOf(st[SEG]!)).toBeCloseTo(0, 9)
    // 削尖单调收锥
    let prev = Infinity
    for (const s of st) {
      const w = widthOf(s)
      expect(w).toBeLessThanOrEqual(prev + 1e-9)
      prev = w
    }
  })

  it('水平轴 (1,0,0) 扭转 π：带体绕 X 轴缠（中部甩到 +Z），锚点与尖不动', () => {
    const st = beltStations({ tau: Math.PI, axis: [1, 0, 0] })
    // 中段站：静止高度 h、缠绕角 = π·windProfile(s)，绕 +X 转 ⇒ (0, h·cos, h·sin)
    const s = MID / SEG
    const h = BELT_ANCHOR_Y * (1 - s)
    const ang = Math.PI * beltWindProfile(s)
    expect(st[MID]!.cz).toBeCloseTo(h * Math.sin(ang), 5)
    expect(st[MID]!.cy).toBeCloseTo(h * Math.cos(ang), 5)
    expect(st[MID]!.cx).toBeCloseTo(0, 9)
    // 锚点/尖始终钉住（绕轴转不碰两端）
    expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_Y, 9)
    expect(st[SEG]!.cy).toBeCloseTo(0, 9)
    expect(st[SEG]!.cz).toBeCloseTo(0, 9)
  })

  it('竖轴 (0,1,0) 扭转 2π：中心线留在竖轴（缠在带面朝向里），中段带面拧一整扭', () => {
    const st = beltStations({ tau: 2 * Math.PI, axis: [0, 1, 0] })
    for (const c of centers(st)) {
      expect(Math.hypot(c.x, c.z)).toBeCloseTo(0, 9)
    }
    // 中段角 = 2π·w ⇒ R_y(2πw)·(1,0,0) = (cos, 0, −sin)
    const ang = 2 * Math.PI * beltWindProfile(MID / SEG)
    expect(frameDirOf(st[MID]!).x).toBeCloseTo(Math.cos(ang), 4)
    expect(frameDirOf(st[MID]!).z).toBeCloseTo(-Math.sin(ang), 4)
  })

  it('竖轴扭转 π：中段带面拧半圈（经典理发店柱，方向绕到 −Z）', () => {
    const st = beltStations({ tau: Math.PI, axis: [0, 1, 0] })
    const ang = Math.PI * beltWindProfile(MID / SEG)
    expect(frameDirOf(st[MID]!).z).toBeCloseTo(-Math.sin(ang), 4)
    // 缠向随轴翻转：绕 −Y 则反向
    const stNeg = beltStations({ tau: Math.PI, axis: [0, -1, 0] })
    expect(frameDirOf(stNeg[MID]!).z).toBeCloseTo(Math.sin(ang), 4)
  })

  it('扭转沿带递增（windProfile）：锚点端不扭、物体端满扭', () => {
    expect(beltWindProfile(0)).toBe(0)
    expect(beltWindProfile(1)).toBe(1)
    const st = beltStations({ tau: Math.PI, axis: [1, 0, 0] })
    // 缠向起点以下不离开竖轴
    expect(Math.abs(st[Math.round(SEG * 0.3)]!.cz)).toBeLessThan(1e-9)
    const z = (s: number) => Math.abs(st[Math.round(SEG * s)]!.cz)
    expect(z(0.725)).toBeGreaterThan(z(0.5))
    expect(z(0.5)).toBeGreaterThan(z(0.3))
    expect(beltTaper(1)).toBe(0)
    expect(beltTaper(0)).toBe(1)
  })
})

describe('beltGeometry · 720° 复原演练', () => {
  // 注意键名：接口字段是 restoreOrbitAxis / restoreBow（曾误写 orbitAxis/bow 静默走默认值）
  const dirs = { restoreOrbitAxis: [0, 0, 1] as [number, number, number], restoreBow: [1, 0, 0] as [number, number, number] }

  it('restoreT=0.5：尖端升到锚点等高（缠态→弓形混合），带体弓形外鼓，锚点钉死', () => {
    const st = beltStations({ tau: 4 * Math.PI, axis: [0, 1, 0], restoreT: 0.5, ...dirs })
    const tip = st[SEG]!
    // 混合位形：尖端 = lerp(缠态尖端(中心), 公转远端(0,2·anchorY,0), 0.5) = (0, anchorY, 0)
    expect(tip.cy).toBeCloseTo(BELT_ANCHOR_Y, 5)
    expect(tip.cx).toBeCloseTo(0, 9)
    // 弓起朝 +X：中段站离开 XY 平面
    expect(st[MID]!.cx).toBeGreaterThan(0.3)
    // 锚点仍钉死
    expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_Y, 9)
  })

  it('restoreT=1：端位回中心、扭转清零、带体回到竖直（与平直带逐位一致）', () => {
    const done = beltStations({ tau: 4 * Math.PI, axis: [0, 1, 0], restoreT: 1, ...dirs })
    expect(done[SEG]!.cy).toBeCloseTo(0, 6)
    for (const c of centers(done)) {
      expect(c.x).toBeCloseTo(0, 6)
      expect(c.z).toBeCloseTo(0, 6)
    }
    const flat = beltStations({ tau: 0, axis: [0, 1, 0] })
    // 三位小数（Bezier 与直接式末位有浮点差，且 5.11875 这类 .x75 边界值两侧
    // 表示不同，4 位会翻面）；-0 归一为 0（IEEE 坑，toEqual 不放过）
    const norm = (v: number) => { const r = +v.toFixed(3); return r === 0 ? 0 : r }
    expect(beltStationsFlat(done).map(norm)).toEqual(beltStationsFlat(flat).map(norm))
  })

  it('演练连续：restoreT→0 时位形趋近缠态（无跳变）', () => {
    const wound = beltStations({ tau: 4 * Math.PI, axis: [0, 1, 0] })
    const start = beltStations({ tau: 4 * Math.PI, axis: [0, 1, 0], restoreT: 1e-6, ...dirs })
    expect(start[SEG]!.cy).toBeCloseTo(wound[SEG]!.cy, 4)
    expect(start[MID]!.cx).toBeCloseTo(wound[MID]!.cx, 4)
    expect(start[MID]!.cz).toBeCloseTo(wound[MID]!.cz, 4)
  })

  it('演练收尾：τ=5π 程后残留半扭（中段带面拧到 −Z 侧）', () => {
    // 全程后 τ_eff = π；中段角 = π·w ⇒ 带面 (cos, 0, −sin)
    const rest = beltStations({ tau: 5 * Math.PI, axis: [0, 1, 0], restoreT: 1, ...dirs })
    const ang = Math.PI * beltWindProfile(MID / SEG)
    expect(frameDirOf(rest[MID]!).z).toBeCloseTo(-Math.sin(ang), 4)
  })
})

describe('beltGeometry · 可视方向', () => {
  it('相机在 +Z 前视：公转轴 +Z（摆动平面 = XY 正面可见）、弓起 +X', () => {
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 3, 10)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    const { orbitAxis, bow } = beltRestoreDirections(cam)
    expect(orbitAxis[2]).toBeCloseTo(1, 6)
    expect(bow[0]).toBeCloseTo(1, 6)
    expect(orbitAxis[1]).toBeCloseTo(0, 9)
    expect(bow[1]).toBeCloseTo(0, 9)
  })
})

describe('beltGeometry · 常量', () => {
  it('一整扭 = 2π（皮带戏法：τ=360° ⇔ q=−1）', () => {
    expect(BELT_FULL_TURN).toBeCloseTo(Math.PI * 2, 12)
  })
})

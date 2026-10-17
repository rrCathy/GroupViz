import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  BELT_ANCHOR_DIST, BELT_SEGMENTS, BELT_WIDTH, BELT_THICKNESS, BELT_TIP_WIDTH_RATIO,
  BELT_RESTORE_AMOUNT, BELT_PIN_MARGIN, BELT_TIP_MARGIN,
  BELT_RESTORE_SHRINK_MIN, beltTetraShrink,
  beltStations, beltTaper, beltTwistProfile, beltExitRadius, beltRestoreFlipDir, beltStationsFlat,
} from '../components/Canvas/beltGeometry'

/** 标准四面体（外接半径 R）：(±1,±1,±1)·R/√3，与场景 getTetrahedron 同构 */
const TETRA = (R: number): Array<[number, number, number]> => {
  const s = R / Math.sqrt(3)
  return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => [v[0] * s, v[1] * s, v[2] * s] as [number, number, number])
}

/**
 * Dirac 开口皮带几何（beltGeometry.ts 纯函数直测，v7 = 2026-10-17 折角模型）：
 * - **皮带与旋转轴同轴**：锚点 = û·L，中心线恒为直线（锚点→尖端）；
 * - **扭转 = 带面绕自身中心线的翻转**：宽向量 W(s) = R(T, −τ·w(s))·W₀，
 *   w = beltTwistProfile（**累计比例**）——固定端 30% 夹持不扭；活动端最后 12%
 *   扭转率 0（截面平行）但**携带累计 τ**（尖端粘在物体上）；扭转铺满中段 58%；
 * - **梯形尖端**：末段线性收窄到 TIP_WIDTH_RATIO（不再是尖点）；
 * - **复原演练 = 两端固定 + 折角搬运**（Egan 皮带戏法的皮带版）：两整扭可缩成
 *   两个折角 → 折角 B 轴摆到 −û（对跖点）→ 滑出两端消散；**端截面全程不动**。
 *
 * 断言口径：宽向 = e1−e2 归一化；期望值用 beltTwistProfile 同源 oracle（站点真实 s）。
 */

const SEG = BELT_SEGMENTS
const MID = Math.round(SEG * 0.5)
const S075 = Math.round(SEG * 0.75)

/** 同源 oracle：期望宽向 W(s) = R(T, −τ·w(s))·W₀（T = −û；W₀ 由 ref 规则决定） */
function expectedWidthDir(tau: number, axis: [number, number, number], s: number): THREE.Vector3 {
  const u = new THREE.Vector3(...axis).normalize()
  const T = u.clone().negate()
  const ref = Math.abs(T.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  const W0 = new THREE.Vector3().crossVectors(ref, T).normalize()
  return W0.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(T, -tau * beltTwistProfile(s)))
}

const widthDirOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).sub(new THREE.Vector3(...s.e2)).normalize()
const widthOf = (s: { e1: number[]; e2: number[] }) =>
  new THREE.Vector3(...s.e1).distanceTo(new THREE.Vector3(...s.e2))
const normalOf = (s: { n: number[] }) => new THREE.Vector3(...s.n)
/** 逐值容差比较（真 bug ≥1e-3 量级，1e-9 容差只放浮点噪声） */
const expectCloseStations = (a: ReturnType<typeof beltStations>, b: ReturnType<typeof beltStations>) => {
  const fa = beltStationsFlat(a)
  const fb = beltStationsFlat(b)
  expect(fa).toHaveLength(fb.length)
  for (let i = 0; i < fa.length; i++) expect(Math.abs(fa[i]! - fb[i]!)).toBeLessThan(1e-9)
}

describe('beltGeometry · 常态（无演练）', () => {
  it('axis=null、τ=0：竖直直线，锚点 (0,L,0)、尖端在中心、锚端满宽', () => {
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
    // 梯形尖端：保留 TIP_WIDTH_RATIO（v7，不再是尖点）
    expect(widthOf(st[SEG]!)).toBeCloseTo(BELT_WIDTH * BELT_TIP_WIDTH_RATIO, 6)
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

  it('固定端夹持区截面朝向不随 τ 变；尖端区无扭转率（截面平行、携带全 τ）', () => {
    const a = beltStations({ tau: 0, axis: [0, 1, 0] })
    const b = beltStations({ tau: 3.7 * Math.PI, axis: [0, 1, 0] })
    expect(widthDirOf(a[0]!).distanceTo(widthDirOf(b[0]!))).toBeLessThan(1e-9)
    // 固定端夹持区内（s < BELT_PIN_MARGIN）整段都不扭
    const sMargin = Math.floor(SEG * BELT_PIN_MARGIN)
    for (let i = 1; i <= sMargin; i++) {
      expect(widthDirOf(a[i]!).distanceTo(widthDirOf(b[i]!))).toBeLessThan(1e-9)
    }
    // 活动端平直区（s > 1 − BELT_TIP_MARGIN）：不再继续扭——截面互相平行（率 0），
    // 但整体携带累计 τ（尖端粘在物体上必须随物体转；v7.1 前误把累计在尖端降回 0）
    const sTip = Math.ceil(SEG * (1 - BELT_TIP_MARGIN))
    for (let i = sTip; i <= SEG; i++) {
      expect(widthDirOf(b[i]!).distanceTo(widthDirOf(b[SEG]!))).toBeLessThan(1e-9)
    }
    // 尖端截面 = 全扭转（同源 oracle）
    expect(widthDirOf(b[SEG]!).distanceTo(expectedWidthDir(3.7 * Math.PI, [0, 1, 0], 1))).toBeLessThan(1e-9)
    expect(b[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
  })

  it('尖端停在几何表面（û·attachRadius）：可见段与四面体直径相称', () => {
    // **场景真实半径 R=4**（SymmetryViewScene getTetrahedron(4)）
    const R = 4
    const attachR = beltExitRadius([0, 1, 0], TETRA(R))
    const st = beltStations({ tau: 2 * Math.PI, axis: [0, 1, 0], attachRadius: attachR })
    expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
    expect(st[SEG]!.cy).toBeCloseTo(attachR, 9)
    for (const s of st) {
      expect(s.cx).toBeCloseTo(0, 9)
      expect(s.cz).toBeCloseTo(0, 9)
    }
    // 可见段 ≈ 8.9（v7 加长 50% 后）且 ≫ 四面体直径——「太短」的量纲守卫
    const visible = BELT_ANCHOR_DIST - attachR
    expect(visible).toBeGreaterThan(8)
    expect(visible / (2 * R)).toBeGreaterThan(1.0)
  })

  it('beltExitRadius：顶点方向 = R（顶出顶点）、面方向 = R/√3、±轴对称', () => {
    const R = 1.7
    const verts = TETRA(R)
    const vdir = [1, 1, 1].map(v => v / Math.sqrt(3)) as [number, number, number]
    expect(beltExitRadius(vdir, verts)).toBeCloseTo(R, 6) // 顶点方向穿出顶点
    expect(beltExitRadius([0, 1, 0], verts)).toBeCloseTo(R / Math.sqrt(3), 6)
    expect(beltExitRadius([0, -1, 0], verts)).toBeCloseTo(R / Math.sqrt(3), 6) // 对称
    for (const axis of [[1, 0, 0], [0, 0, 1], [0.3, 0.8, -0.52]] as [number, number, number][]) {
      const t = beltExitRadius(axis, verts)
      expect(t).toBeGreaterThan(R / 3 - 1e-6)
      expect(t).toBeLessThanOrEqual(R + 1e-6)
    }
  })

  it('扭转分布：两端平直、中段按剖面（同源 oracle）；夹持区 ≥ 25%', () => {
    expect(BELT_PIN_MARGIN).toBeGreaterThanOrEqual(0.25)
    expect(BELT_TIP_MARGIN).toBeGreaterThanOrEqual(0.1)
    const st = beltStations({ tau: 2 * Math.PI, axis: [0, 1, 0], attachRadius: 0.98 })
    const at = (f: number) => st[Math.round(SEG * f)]!
    // 夹持区 = W₀
    expect(widthDirOf(at(0.25)).x).toBeCloseTo(1, 9)
    // 中段与 3/4 处 = oracle（站点真实 s）
    for (const f of [0.5, 0.75]) {
      const i = Math.round(SEG * f)
      expect(widthDirOf(st[i]!).distanceTo(expectedWidthDir(2 * Math.PI, [0, 1, 0], i / SEG))).toBeLessThan(1e-9)
    }
    // 剖面端点：锚端 0；尖端平直区保持满值（率 0、累计 1——v7.1 语义）
    expect(beltTwistProfile(0)).toBe(0)
    expect(beltTwistProfile(BELT_PIN_MARGIN - 1e-9)).toBe(0)
    expect(beltTwistProfile(1 - BELT_TIP_MARGIN)).toBe(1)
    expect(beltTwistProfile(1)).toBe(1)
    // 单调不减（单坡道）
    let prev = -1
    for (let i = 0; i <= 64; i++) {
      const v = beltTwistProfile(i / 64)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('扭转平滑无锯齿：相邻站宽向夹角处处小（v7.1 窄坡道锯齿的回归守卫）', () => {
    // v7 初版把全部扭转挤进两条 10% 窄坡道：720° 时相邻站 ~113°，渲染成锯齿
    // （用户 2026-10-17 截图「扭转错啦」）。修后坡道铺满中段 58%，192 段下
    // 720° 峰值 ~10°/站。
    for (const tau of [2 * Math.PI, BELT_RESTORE_AMOUNT]) {
      const st = beltStations({ tau, axis: [0, 1, 0], attachRadius: 0.98 })
      for (let i = 1; i <= SEG; i++) {
        expect(widthDirOf(st[i - 1]!).angleTo(widthDirOf(st[i]!))).toBeLessThan(0.32)
      }
    }
  })

  it('站点法向：|n|=1、⊥ 宽向、⊥ 切线（τ 与轴任意）', () => {
    for (const axis of [[0, 1, 0], [1, 0, 0], [0.3, 0.8, -0.52]] as [number, number, number][]) {
      const st = beltStations({ tau: 2.3 * Math.PI, axis })
      for (let i = 0; i < st.length; i++) {
        const n = normalOf(st[i]!)
        expect(n.length()).toBeCloseTo(1, 9)
        expect(Math.abs(n.dot(widthDirOf(st[i]!)))).toBeLessThan(1e-9)
        const t = i === 0
          ? new THREE.Vector3(st[1]!.cx - st[0]!.cx, st[1]!.cy - st[0]!.cy, st[1]!.cz - st[0]!.cz).normalize()
          : new THREE.Vector3(st[i]!.cx - st[i - 1]!.cx, st[i]!.cy - st[i - 1]!.cy, st[i]!.cz - st[i - 1]!.cz).normalize()
        expect(Math.abs(n.dot(t))).toBeLessThan(1e-9)
      }
    }
  })

  it('厚度常量：为正且远小于带宽（「稍微一点」）', () => {
    expect(BELT_THICKNESS).toBeGreaterThan(0)
    expect(BELT_THICKNESS).toBeLessThan(BELT_WIDTH / 4)
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

  it('梯形尖端：末段线性收窄到 TIP_WIDTH_RATIO，宽度单调不增', () => {
    const st = beltStations({ tau: 2, axis: [0, 1, 0], attachRadius: 0.98 })
    expect(widthOf(st[SEG]!)).toBeCloseTo(BELT_WIDTH * BELT_TIP_WIDTH_RATIO, 6)
    let prev = Infinity
    for (const s of st) {
      const w = widthOf(s)
      expect(w).toBeLessThanOrEqual(prev + 1e-9)
      prev = w
    }
    expect(beltTaper(0)).toBe(1)
    expect(beltTaper(1)).toBeCloseTo(BELT_TIP_WIDTH_RATIO, 9)
  })
})

describe('beltGeometry · 720° 复原演练（v9 Egan 编舞逐项对齐：中段鼓环越过物体端）', () => {
  const flip: [number, number, number] = [1, 0, 0]

  /** 厚板 4 角点（同渲染口径：e1/e2 ± n·半厚） */
  const slabCorners = (s: ReturnType<typeof beltStations>[number]): THREE.Vector3[] => {
    const h = BELT_THICKNESS / 2
    return [
      new THREE.Vector3(s.e1[0] + s.n[0] * h, s.e1[1] + s.n[1] * h, s.e1[2] + s.n[2] * h),
      new THREE.Vector3(s.e2[0] + s.n[0] * h, s.e2[1] + s.n[1] * h, s.e2[2] + s.n[2] * h),
      new THREE.Vector3(s.e2[0] - s.n[0] * h, s.e2[1] - s.n[1] * h, s.e2[2] - s.n[2] * h),
      new THREE.Vector3(s.e1[0] - s.n[0] * h, s.e1[1] - s.n[1] * h, s.e1[2] - s.n[2] * h),
    ]
  }
  /** 弧距 < 2.2 的站对豁免（弯道曲率贴合不是自交；带宽 0.72 + 弯曲半径量级） */
  const EXEMPT_ARC = 2.2

  /** 全 λ 扫描：厚板角点最小间距 + 相邻站切向夹角峰值（自交/粗糙守卫核心）。
   *  返回 {minGap, maxTurn}。与探针（2026-10-17 v8.6 基线 gap=0 显式接触、81°/站尖点）同口径。 */
  function sweep(attachR: number): { minGap: number; maxTurn: number } {
    let minGap = Infinity
    let maxTurn = 0
    for (let li = 0; li <= 50; li++) {
      const rt = li / 50
      const st = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: attachR, restoreT: rt, restoreFlipDir: flip })
      // 总弧长（材料坐标步长 = L/SEG，站点等弧长分布）
      let L = 0
      for (let i = 1; i < st.length; i++) {
        L += new THREE.Vector3(st[i]!.cx - st[i - 1]!.cx, st[i]!.cy - st[i - 1]!.cy, st[i]!.cz - st[i - 1]!.cz).length()
      }
      const step = L / SEG
      const centers = st.map(s => new THREE.Vector3(s.cx, s.cy, s.cz))
      const corners = st.map(slabCorners)
      for (let i = 0; i < st.length; i++) {
        for (let j = i + 1; j < st.length; j++) {
          if (Math.abs(j - i) * step < EXEMPT_ARC) continue
          const cd = centers[i]!.distanceTo(centers[j]!)
          if (cd > BELT_WIDTH * 2 + 1.0) continue
          let best = Infinity
          for (const p of corners[i]!) for (const q of corners[j]!) best = Math.min(best, p.distanceTo(q))
          if (best < minGap) minGap = best
        }
      }
      for (let i = 1; i < st.length - 1; i++) {
        const t1 = new THREE.Vector3(st[i]!.cx - st[i - 1]!.cx, st[i]!.cy - st[i - 1]!.cy, st[i]!.cz - st[i - 1]!.cz)
        const t2 = new THREE.Vector3(st[i + 1]!.cx - st[i]!.cx, st[i + 1]!.cy - st[i]!.cy, st[i + 1]!.cz - st[i]!.cz)
        if (t1.lengthSq() < 1e-18 || t2.lengthSq() < 1e-18) continue
        maxTurn = Math.max(maxTurn, t1.angleTo(t2))
      }
    }
    return { minGap, maxTurn }
  }

  it('两端全程冻结：锚端与尖端的**位置和截面方向**都不随 restoreT 动', () => {
    // Egan 皮带戏法：两端固定（GIF 与 Dirac.js 中扣与固定端全程不动）。
    // v9 中段鼓环，但两端站点仍在原位、截面朝向不变。
    const base = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98 })
    for (const rt of [0.1, 0.25, 0.35, 0.5, 0.6, 0.75, 0.9]) {
      const st = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98, restoreT: rt, restoreFlipDir: flip })
      // 锚端
      expect(st[0]!.cx).toBeCloseTo(0, 9)
      expect(st[0]!.cy).toBeCloseTo(BELT_ANCHOR_DIST, 9)
      expect(widthDirOf(st[0]!).distanceTo(widthDirOf(base[0]!))).toBeLessThan(1e-9)
      // 尖端（粘在四面体上，位置与朝向都不动）
      expect(st[SEG]!.cy).toBeCloseTo(0.98, 9)
      expect(st[SEG]!.cx).toBeCloseTo(0, 9)
      expect(widthDirOf(st[SEG]!).distanceTo(widthDirOf(base[SEG]!))).toBeLessThan(1e-9)
    }
  })

  it('restoreT→0 连续：位形趋近缠态（无跳变）', () => {
    const wound = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98 })
    const start = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98, restoreT: 1e-6, restoreFlipDir: flip })
    for (let i = 0; i <= SEG; i++) {
      expect(start[i]!.e1[0]).toBeCloseTo(wound[i]!.e1[0], 4)
      expect(start[i]!.e1[1]).toBeCloseTo(wound[i]!.e1[1], 4)
      expect(start[i]!.e1[2]).toBeCloseTo(wound[i]!.e1[2], 4)
    }
  })

  it('restoreT=1（τ=4π 全解）：与平直带逐位一致（容差 1e-9）', () => {
    const done = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98, restoreT: 1, restoreFlipDir: flip })
    const plain = beltStations({ tau: 0, axis: [0, 1, 0], attachRadius: 0.98 })
    expectCloseStations(done, plain)
  })

  it('中程鼓环（rt=0.5）：环鼻越过原大表面、两支链侧向分居（v9 Egan 编舞形态）', () => {
    // v9（用户 2026-10-17「不要管四面体…当正四面体不存在」）：按 Dirac.js 原样移植，
    // 四面体避让交给场景缩小脉冲（beltTetraShrink）——不再需要环鼻 8.2 / 带轮廓清障。
    // attachRadius=0.98（legacy 基准）：鼻子 = L − 1.5·(L−0.98) = −4.16 < −4；
    // 场景 attachRadius=beltExitRadius≈2.31 时鼻子 ≈ −2.16（ NM 场景侧由缩小覆盖）。
    const st = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98, restoreT: 0.5, restoreFlipDir: flip })
    const minCy = Math.min(...st.map(p => p.cy))
    expect(minCy).toBeLessThan(-4)
    // 两支链侧向分居两侧（split ±0.35·bell + sway 半贡献；λ=0.5 sway=0 ⇒ ±0.35·bell）
    const minSide = Math.min(...st.map(p => p.cx))
    const maxSide = Math.max(...st.map(p => p.cx))
    expect(minSide).toBeLessThan(-2.5)
    expect(maxSide).toBeGreaterThan(2.5)
  })

  it('v9 编舞守卫：全 λ 厚板无自交（角点最小间距 > 0.35）+ 全程无尖点（相邻站切向夹角 < 0.45 rad）', () => {
    // v8.6 基线（2026-10-17 探针）：gap=0.000 实接触（λ≈0.18-0.22）、81.5°/站尖点（λ≈0.16）、
    // 晚段 52°/站 + 0.18 间隙。v9（Egan 编舞 + 生命线 + 尖端两侧绕行）后必须全程干净。
    const { minGap, maxTurn } = sweep(0.98)
    expect(minGap).toBeGreaterThan(0.35)
    expect(maxTurn).toBeLessThan(0.45)
  })

  it('v9 编舞守卫（场景口径）：真实四面体出口半径下同样干净', () => {
    const R = 4
    const attachR = beltExitRadius([0, 1, 0], TETRA(R))
    const { minGap, maxTurn } = sweep(attachR)
    expect(minGap).toBeGreaterThan(0.35)
    expect(maxTurn).toBeLessThan(0.45)
  })

  it('缩小四面体避让：全 λ 无任何站点进入缩小后的四面体实体（beltTetraShrink 口径）', () => {
    // 场景侧演练期间把四面体缩到 beltTetraShrink(restoreT)；皮带按「四面体不存在」编舞走管，
    // 唯一硬守卫 = 带体不进缩小实体（含尖端贴表面处：贴的是**原大**表面，k<1 后表面内缩）。
    const verts = TETRA(4)
    // 缩放后的 4 面平面：法向不变、截距 ×k（过原点相似缩放）
    const planes: { n: THREE.Vector3; d: number }[] = []
    for (const [i, j, kk] of [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]] as [number, number, number][]) {
      const a = new THREE.Vector3(...verts[i]!)
      const b = new THREE.Vector3(...verts[j]!)
      const c = new THREE.Vector3(...verts[kk]!)
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
      const probe = a.clone().add(n)
      if (probe.length() < a.length()) n.negate()
      planes.push({ n, d: n.dot(a) })
    }
    const attachR = beltExitRadius([0, 1, 0], verts)
    let worstInside = 0
    for (let li = 0; li <= 50; li++) {
      const rt = li / 50
      const k = beltTetraShrink(rt)
      const st = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: attachR, restoreT: rt, restoreFlipDir: flip })
      for (const s of st) {
        // 站点中心逐点（角点是中心 ± 常量的平移，判断中心即可覆盖保守程度足够的问题；
        // 进实体 ⇔ 四面平面 slack 全 ≥ 0 ⇔ minSlack（进实体的深度）> 0）
        const p = new THREE.Vector3(s.cx, s.cy, s.cz)
        const minSlack = Math.min(...planes.map(pl => pl.d * k - pl.n.dot(p)))
        if (minSlack > 1e-9) worstInside = Math.max(worstInside, minSlack)
      }
    }
    expect(worstInside).toBe(0)
  })

  it('beltTetraShrink：两端原大、中段下限恒定、端点连续无跳变', () => {
    expect(beltTetraShrink(0)).toBe(1)
    expect(beltTetraShrink(1)).toBe(1)
    // 收缩下限区间：λ≥0.25 且 <0.78 全程等于下限
    expect(beltTetraShrink(0.25)).toBeCloseTo(BELT_RESTORE_SHRINK_MIN, 9)
    expect(beltTetraShrink(0.5)).toBeCloseTo(BELT_RESTORE_SHRINK_MIN, 9)
    expect(beltTetraShrink(0.75)).toBeCloseTo(BELT_RESTORE_SHRINK_MIN, 9)
    expect(beltTetraShrink(0.78)).toBeCloseTo(BELT_RESTORE_SHRINK_MIN, 9)
    // 居中区间之外单调回长
    expect(beltTetraShrink(0.1)).toBeGreaterThan(BELT_RESTORE_SHRINK_MIN)
    expect(beltTetraShrink(0.9)).toBeGreaterThan(BELT_RESTORE_SHRINK_MIN)
    // 连续性：0.25±ε、0.78±ε 无跳变
    const eps = 1e-6
    expect(Math.abs(beltTetraShrink(0.25 - eps) - beltTetraShrink(0.25 + eps))).toBeLessThan(1e-5)
    expect(Math.abs(beltTetraShrink(0.78 - eps) - beltTetraShrink(0.78 + eps))).toBeLessThan(1e-5)
  })

  it('中程也平滑：鼓环与翻面在弧长重采样下相邻站宽向夹角峰值可控（<0.4 rad）', () => {
    for (const rt of [0.25, 0.35, 0.5, 0.65, 0.75, 0.85]) {
      const st = beltStations({ tau: BELT_RESTORE_AMOUNT, axis: [0, 1, 0], attachRadius: 0.98, restoreT: rt, restoreFlipDir: flip })
      for (let i = 1; i <= SEG; i++) {
        expect(widthDirOf(st[i - 1]!).angleTo(widthDirOf(st[i]!))).toBeLessThan(0.4)
      }
    }
  })

  it('τ > 720° 演练后残留扭转（τ=5π，restoreT=1 ⇒ τ_eff=π）', () => {
    const st = beltStations({ tau: 5 * Math.PI, axis: [0, 1, 0], attachRadius: 0.98, restoreT: 1, restoreFlipDir: flip })
    for (const s of st) expect(Math.hypot(s.cx, s.cz)).toBeCloseTo(0, 6)
    for (const f of [0.5, 0.75]) {
      const i = Math.round(SEG * f)
      const exp = expectedWidthDir(Math.PI, [0, 1, 0], i / SEG)
      expect(widthDirOf(st[i]!).distanceTo(exp)).toBeLessThan(1e-9)
    }
  })
})

describe('beltGeometry · 辅助', () => {
  it('beltRestoreFlipDir：返回 ⊥ û 的单位向量（相机右方投影）', () => {
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 3, 10)
    cam.lookAt(0, 0, 0)
    cam.updateMatrix()
    const axis: [number, number, number] = [0, 1, 0]
    const d = beltRestoreFlipDir(cam, axis)
    const v = new THREE.Vector3(...d)
    expect(v.length()).toBeCloseTo(1, 9)
    expect(Math.abs(v.dot(new THREE.Vector3(...axis)))).toBeLessThan(1e-9)
    // 默认相机（+Z 看原点、右方 ≈ +X）⇒ 竖直轴的摆动方向 ≈ +X
    expect(v.x).toBeCloseTo(1, 6)
    // 轴与相机右方平行时退化兜底（仍返回单位垂直向量）
    const d2 = beltRestoreFlipDir(cam, [1, 0, 0])
    const v2 = new THREE.Vector3(...d2)
    expect(v2.length()).toBeCloseTo(1, 9)
    expect(Math.abs(v2.dot(new THREE.Vector3(1, 0, 0)))).toBeLessThan(1e-9)
  })
})

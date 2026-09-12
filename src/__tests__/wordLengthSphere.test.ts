import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import {
  findAdjacentTranspositionGenerators,
  wordLengthSphereActions,
  wordLengthSphereLayout3D,
  wordLengthColor,
  wordLengthOf,
} from '../core/algebra/layouts3D/wordLengthSphereLayout3D'
import { getAvailableShapes3D } from '../core/algebra/groupProps'
import { getSpecialCayleyActions } from '../context/cayleyActions'
import { compute3DPositions } from '../core/algebra/layout3D'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import type { Group } from '../core/types'
import { COLOR_PALETTE } from '../core/types'
import type { Vec3 } from '../core/algebra/layouts3D/shared'

const S4 = createSymmetricGroup(4)
const S5 = createSymmetricGroup(5)
// 球半径 = 5 × 放大系数（S₄ 1.55 / S₅ 3.0）
const R4 = 5 * 1.55
const R5 = 5 * 3
const TAU = 2 * Math.PI

const norm = (p: Vec3) => Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2])
const azimuth = (p: Vec3) => Math.atan2(p[2], p[0])
const wrap2pi = (a: number) => ((a % TAU) + TAU) % TAU

/** 元素的字长（Sₙ 相邻对换生成集下 = 逆序数） */
function inversionCount(g: Group, elIdx: number): number {
  const v = g.elements[elIdx].value
  let inv = 0
  for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) if (v[a] > v[b]) inv++
  return inv
}

/** S₅ 字长层分布（[5]_q! 系数）与逐层元素索引 */
const S5_LAYERS = [1, 4, 9, 15, 20, 22, 20, 15, 9, 4, 1]

/** 线段-线段最近距离（3D，Bradley 钳制算法）——边-边近距回归用 */
function segSegDist(p: Vec3, q: Vec3, r: Vec3, s: Vec3): number {
  const d1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
  const d2 = [s[0] - r[0], s[1] - r[1], s[2] - r[2]]
  const rv = [p[0] - r[0], p[1] - r[1], p[2] - r[2]]
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const a = dot(d1, d1)
  const e = dot(d2, d2)
  const f = dot(d2, rv)
  let u = 0
  let t = 0
  const EPS = 1e-12
  if (a <= EPS && e <= EPS) return Math.hypot(rv[0], rv[1], rv[2])
  if (a <= EPS) {
    t = Math.min(1, Math.max(0, f / e))
  } else {
    const c = dot(d1, rv)
    if (e <= EPS) {
      u = Math.min(1, Math.max(0, -c / a))
    } else {
      const b = dot(d1, d2)
      const den = a * e - b * b
      u = den > EPS ? Math.min(1, Math.max(0, (b * f - c * a) / den)) : 0
      t = (b * u + f) / e
      if (t < 0) {
        t = 0
        u = Math.min(1, Math.max(0, -c / a))
      } else if (t > 1) {
        t = 1
        u = Math.min(1, Math.max(0, (b - c) / a))
      }
    }
  }
  return Math.hypot(
    p[0] + d1[0] * u - (r[0] + d2[0] * t),
    p[1] + d1[1] * u - (r[1] + d2[1] * t),
    p[2] + d1[2] * u - (r[2] + d2[2] * t),
  )
}

describe('findAdjacentTranspositionGenerators', () => {
  it('S4: 找到全部 3 个相邻对换 (12),(23),(34)', () => {
    const gens = findAdjacentTranspositionGenerators(S4)
    expect(gens).not.toBeNull()
    expect(gens!.map(g => g.id)).toEqual(['2,1,3,4', '1,3,2,4', '1,2,4,3'])
  })

  it('S5: 找到全部 4 个相邻对换 (12),(23),(34),(45)', () => {
    const gens = findAdjacentTranspositionGenerators(S5)
    expect(gens).not.toBeNull()
    expect(gens!.map(g => g.id)).toEqual(['2,1,3,4,5', '1,3,2,4,5', '1,2,4,3,5', '1,2,3,5,4'])
  })

  it('非置换群（C₄）返回 null', () => {
    expect(findAdjacentTranspositionGenerators(createCyclicGroup(4))).toBeNull()
  })

  it('S3 拒绝（n < 4 门槛，专用形状更优）', () => {
    expect(findAdjacentTranspositionGenerators(createSymmetricGroup(3))).toBeNull()
  })
})

describe('wordLengthSphereLayout3D — S₄（分层球面重排）', () => {
  it('全部顶点贴球面（等模长 R）、e 在最北、w₀ 在最南', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    for (const p of pos) expect(norm(p)).toBeCloseTo(R4, 6)
    const idIdx = S4.elements.findIndex(el => el.id === S4.identity.id)
    const w0Idx = S4.elements.findIndex(el => el.id === '4,3,2,1')
    const maxY = Math.max(...pos.map(p => p[1]))
    const minY = Math.min(...pos.map(p => p[1]))
    expect(pos[idIdx][1]).toBeCloseTo(maxY, 6)
    expect(pos[w0Idx][1]).toBeCloseTo(minY, 6)
  })

  it('字长分层：同层同高 y = R·cos(πk/K)，分布 [1,3,5,6,5,3,1]', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    const counts = new Array(7).fill(0)
    for (let i = 0; i < S4.order; i++) counts[inversionCount(S4, i)]++
    expect(counts).toEqual([1, 3, 5, 6, 5, 3, 1])
    for (let i = 0; i < S4.order; i++) {
      const k = inversionCount(S4, i)
      expect(pos[i][1]).toBeCloseTo(R4 * Math.cos((Math.PI * k) / 6), 6)
    }
  })

  it('图结构 = 平面凯莱图：相邻对换生成集恰好 36 条边（= 截角八面体棱数）', () => {
    const actions = [
      { elementId: '2,1,3,4', enabled: true, color: '#ff6b6b' },
      { elementId: '1,3,2,4', enabled: true, color: '#4ecdc4' },
      { elementId: '1,2,4,3', enabled: true, color: '#ffd93d' },
    ]
    const edges = computeCayleyActionEdges(S4, actions, 'right')
    expect(edges).toHaveLength(36)
  })

  it('极点三方对称：e 与 w₀ 的三条出边周向角互成 120°（等角星形）', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    const gens = findAdjacentTranspositionGenerators(S4)!
    const idxOf = new Map(S4.elements.map((el, i) => [el.id, i]))
    const wrap = (d: number) => ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    for (const pole of [S4.identity.id, '4,3,2,1']) {
      const ei = idxOf.get(pole)!
      const e = pos[ei]
      const dirs = gens.map(g => {
        const nb = S4.multiply(S4.elements[ei], g)
        const n = pos[idxOf.get(nb.id)!]
        const d = [n[0] - e[0], n[1] - e[1], n[2] - e[2]]
        const L = Math.hypot(d[0], d[1], d[2])
        return [d[0] / L, d[1] / L, d[2] / L]
      })
      const azs = dirs.map(d => Math.atan2(d[2], d[0])).sort((a, b) => a - b)
      expect(wrap(azs[1] - azs[0])).toBeCloseTo((2 * Math.PI) / 3, 5)
      expect(wrap(azs[2] - azs[1])).toBeCloseTo((2 * Math.PI) / 3, 5)
      expect(wrap(azs[0] - azs[2])).toBeCloseTo((2 * Math.PI) / 3, 5)
      const ang = (u: number[], v: number[]) =>
        Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])))
      expect(ang(dirs[0], dirs[1])).toBeCloseTo(ang(dirs[1], dirs[2]), 6)
      expect(ang(dirs[0], dirs[2])).toBeCloseTo(ang(dirs[1], dirs[2]), 6)
    }
  })

  it('同层节点不重叠（层内周向保持骨架原始角度）', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    const layer3 = pos.filter((_, i) => inversionCount(S4, i) === 3)
    let minPair = Infinity
    for (let i = 0; i < layer3.length; i++) {
      for (let j = i + 1; j < layer3.length; j++) {
        const d = Math.hypot(layer3[i][0] - layer3[j][0], layer3[i][1] - layer3[j][1], layer3[i][2] - layer3[j][2])
        minPair = Math.min(minPair, d)
      }
    }
    expect(minPair).toBeGreaterThan(0.8)
  })

  it('C₄ 返回 null（compute3DPositions 自动回退 fibonacci 球）', () => {
    expect(wordLengthSphereLayout3D(createCyclicGroup(4), 5)).toBeNull()
  })

  it('compute3DPositions(S4, wordLengthSphere) 输出完整无 undefined', () => {
    const pos = compute3DPositions(S4, 'wordLengthSphere')
    expect(pos).toHaveLength(24)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true)
    }
  })
})

describe('wordLengthSphereLayout3D — S₅（字长实心球）', () => {
  /** 层 k 的元素索引 */
  const layerIdx = (k: number): number[] => {
    const out: number[] = []
    S5.elements.forEach((_, i) => {
      if (inversionCount(S5, i) === k) out.push(i)
    })
    return out
  }
  /** 纬度层名义高度 y_l = R·cos(πl/10)（e 与 w₀ 在两极） */
  const layerY = (l: number): number => R5 * Math.cos((Math.PI * l) / (S5_LAYERS.length - 1))
  /** 纬度层球截面半径 r_l = R·sin(πl/10) */
  const layerR = (l: number): number => R5 * Math.sin((Math.PI * l) / (S5_LAYERS.length - 1))
  /** 纬度带半高（节点可在带内浮动）：0.32 × 层间距 */
  const bandHalf = (l: number): number => {
    const up = l < 10 ? Math.abs(layerY(l) - layerY(l + 1)) : Infinity
    const dn = l > 0 ? Math.abs(layerY(l) - layerY(l - 1)) : Infinity
    return 0.32 * Math.min(up, dn)
  }

  it('纬度分层：层 l 名义高度 y_l = R·cos(πl/10)，节点在纬度带内浮动（±0.32×层间距）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    for (let l = 0; l <= 10; l++) {
      const band = bandHalf(l)
      for (const i of layerIdx(l)) {
        const dy = Math.abs(pos[i][1] - layerY(l))
        if (Number.isFinite(band)) expect(dy).toBeLessThanOrEqual(band + 1e-9)
      }
    }
    // 两极（e 与 w₀）精确钉在北极/南极；纬度层上下镜像
    const idIdx = S5.elements.findIndex(e => e.id === S5.identity.id)
    const wIdx = S5.elements.findIndex(e => e.id === '5,4,3,2,1')
    expect(pos[idIdx][0]).toBeCloseTo(0, 9)
    expect(pos[idIdx][1]).toBeCloseTo(R5, 9)
    expect(pos[idIdx][2]).toBeCloseTo(0, 9)
    expect(pos[wIdx][1]).toBeCloseTo(-R5, 9)
    for (let l = 0; l <= 10; l++) expect(layerY(10 - l)).toBeCloseTo(-layerY(l), 9)
  })

  it('实心球：全部 120 个节点在球内，外圈贴球面、内部有点（不是球壳）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    for (const p of pos) expect(norm(p)).toBeLessThanOrEqual(R5 + 1e-6)
    expect(Math.max(...pos.map(norm))).toBeCloseTo(R5, 6) // 外圈精确吸附球面
    // 层 1 / 层 9 的 4 点：整层贴球面圆环
    for (const l of [1, 9]) {
      for (const i of layerIdx(l)) {
        expect(Math.abs(Math.hypot(pos[i][0], pos[i][2]) - layerR(l))).toBeLessThan(0.01)
        expect(norm(pos[i])).toBeCloseTo(R5, 6)
      }
    }
    // 中间各层盘内铺满：既有内圈点也有贴壳点
    for (let l = 2; l <= 8; l++) {
      const rs = layerIdx(l).map(i => Math.hypot(pos[i][0], pos[i][2]) / layerR(l))
      expect(Math.max(...rs)).toBeGreaterThan(0.9)
      expect(Math.min(...rs)).toBeLessThan(0.45)
    }
    // 贴球面节点有一定数量（球壳轮廓），同时球内也有成片节点
    const rs = pos.map(norm).map(r => r / R5)
    expect(rs.filter(r => r > 0.995).length).toBeGreaterThan(15)
    expect(rs.filter(r => r < 0.7).length).toBeGreaterThan(15)
  })

  it('盘内近似等面积铺点：层内径向分布接近 n·t²（内密外疏）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    for (const l of [3, 5]) {
      const rs = layerIdx(l).map(i => Math.hypot(pos[i][0], pos[i][2]) / layerR(l))
      const inner = rs.filter(r => r < 0.5).length / rs.length // 等面积期望 ≈ 0.25
      expect(inner).toBeGreaterThan(0.1)
      expect(inner).toBeLessThan(0.45)
    }
  })

  it('北极四星：4 个生成元贴球面、方位近似互成 90°（四个生成元 = 四个方位瓣）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    const genIds = ['2,1,3,4,5', '1,3,2,4,5', '1,2,4,3,5', '1,2,3,5,4']
    const idxs = genIds.map(id => S5.elements.findIndex(e => e.id === id))
    const rhos = idxs.map(i => Math.hypot(pos[i][0], pos[i][2]))
    for (const r of rhos) expect(Math.abs(r - layerR(1))).toBeLessThan(0.01)
    for (const i of idxs) expect(norm(pos[i])).toBeCloseTo(R5, 6)
    // 方位按序相差约 90°（松弛后容许 4° 偏差）
    const azs = idxs.map(i => wrap2pi(azimuth(pos[i]))).sort((a, b) => a - b)
    for (let j = 0; j < 3; j++) expect(Math.abs(azs[j + 1] - azs[j] - Math.PI / 2)).toBeLessThan(0.07)
  })

  it('只有层间有边：240 条凯莱边全部连接相邻层（层内无边 ⇒ 字长差恒为 1）', () => {
    const gens = findAdjacentTranspositionGenerators(S5)!
    const idxOf = new Map(S5.elements.map((el, i) => [el.id, i]))
    const seen = new Set<string>()
    let edges = 0
    for (const el of S5.elements) {
      const la = inversionCount(S5, idxOf.get(el.id)!)
      for (const g of gens) {
        const nb = S5.multiply(el, g)
        const key = [el.id, nb.id].sort().join('>')
        if (seen.has(key)) continue
        seen.add(key)
        edges++
        const lb = inversionCount(S5, idxOf.get(nb.id)!)
        expect(Math.abs(la - lb)).toBe(1)
      }
    }
    expect(edges).toBe(240)
  })

  it('边倾向竖直（层间连接）：|Δy|/L 中位数 > 0.5，且没有穿球长边', () => {
    const gens = findAdjacentTranspositionGenerators(S5)!
    const pos = wordLengthSphereLayout3D(S5, 5)!
    const idxOf = new Map(S5.elements.map((el, i) => [el.id, i]))
    const seen = new Set<string>()
    const vert: number[] = []
    let maxLen = 0
    for (const el of S5.elements) {
      for (const g of gens) {
        const nb = S5.multiply(el, g)
        const key = [el.id, nb.id].sort().join('>')
        if (seen.has(key)) continue
        seen.add(key)
        const a = idxOf.get(el.id)!
        const b = idxOf.get(nb.id)!
        const dy = Math.abs(pos[a][1] - pos[b][1])
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1], pos[a][2] - pos[b][2])
        vert.push(dy / (d || 1))
        if (d > maxLen) maxLen = d
      }
    }
    vert.sort((x, y) => x - y)
    expect(vert[Math.floor(vert.length / 2)]).toBeGreaterThan(0.5)
    expect(maxLen).toBeLessThan(1.05 * R5) // 无穿球长弦
  })

  it('边距松弛：非共端点边对的最近距离都很大（非平面图只剩极个别交叠）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    const gens = findAdjacentTranspositionGenerators(S5)!
    const idxOf = new Map(S5.elements.map((el, i) => [el.id, i]))
    const seen = new Set<string>()
    const edgePairs: [number, number][] = []
    for (const el of S5.elements) {
      for (const g of gens) {
        const nb = S5.multiply(el, g)
        const a = idxOf.get(el.id)!
        const b = idxOf.get(nb.id)!
        const key = `${Math.min(a, b)}|${Math.max(a, b)}`
        if (seen.has(key)) continue
        seen.add(key)
        edgePairs.push([a, b])
      }
    }
    expect(edgePairs).toHaveLength(240)
    let minD = Infinity
    let near = 0
    for (let i = 0; i < edgePairs.length; i++) {
      for (let j = i + 1; j < edgePairs.length; j++) {
        const A = edgePairs[i]
        const B = edgePairs[j]
        if (A[0] === B[0] || A[0] === B[1] || A[1] === B[0] || A[1] === B[1]) continue // 共端点不算交叠
        const d = segSegDist(pos[A[0]], pos[A[1]], pos[B[0]], pos[B[1]])
        if (d < minD) minD = d
        if (d < 0.55) near++
      }
    }
    expect(minD).toBeGreaterThan(0.15)
    expect(near).toBeLessThanOrEqual(3)
  })

  it('布局确定性：同一群两次调用逐位一致（算法无随机）', () => {
    expect(wordLengthSphereLayout3D(S5, 5)).toEqual(wordLengthSphereLayout3D(S5, 5))
  })

  it('R / C 是图的自同构，并把生成元色 sᵢ 映到 s_{5−i}（i = 0..3）', () => {
    const gens = findAdjacentTranspositionGenerators(S5)!
    const w0 = S5.elements.find(e => e.id === '5,4,3,2,1')!
    const colorSwap: Record<string, string> = {}
    for (let i = 0; i < gens.length; i++) colorSwap[gens[i].id] = gens[gens.length - 1 - i].id
    // 自同构性质：σ(g·sᵢ) = σ(g)·s_{5−i} ⟺ 色 i 映到色 5−i
    for (const el of S5.elements) {
      for (const gi of gens) {
        const img = colorSwap[gi.id]
        // R: g ↦ g·w₀
        expect(S5.multiply(S5.multiply(el, gi), w0).id).toBe(S5.multiply(S5.multiply(el, w0), S5.elements.find(e => e.id === img)!).id)
        // C: g ↦ w₀·g·w₀
        const c = (x: typeof el) => S5.multiply(S5.multiply(w0, x), w0)
        expect(c(S5.multiply(el, gi)).id).toBe(S5.multiply(c(el), S5.elements.find(e => e.id === img)!).id)
      }
    }
    // 生成元层的色置换只是反转：sᵢ·w₀ = w₀·s_{5−i}
    for (let i = 0; i < gens.length; i++) {
      const target = S5.elements.find(e => e.id === gens[gens.length - 1 - i].id)!
      expect(S5.multiply(gens[i], w0).id).toBe(S5.multiply(w0, target).id)
    }
  })

  it('任意两节点不重叠：全局最小间距 > 2.0（节点直径 0.84）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    let minD = Infinity
    for (let i = 0; i < S5.order; i++) {
      for (let j = i + 1; j < S5.order; j++) {
        const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2])
        if (d < minD) minD = d
      }
    }
    expect(minD).toBeGreaterThan(2.0)
  })

  it('compute3DPositions(S5, wordLengthSphere) 输出完整无 undefined', () => {
    const pos = compute3DPositions(S5, 'wordLengthSphere')
    expect(pos).toHaveLength(120)
    for (const p of pos) {
      expect(p).toBeDefined()
      expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true)
    }
  })

  it('字长配色存在且同层同色（色阶随字长单调）', () => {
    const cols = S5.elements.map(el => wordLengthColor(S5, el))
    expect(cols.every(c => typeof c === 'string')).toBe(true)
    const byLayer = (k: number) => cols[layerIdx(k)[0]]
    expect(new Set(cols.map(c => c!)).size).toBe(11)
    expect(byLayer(0)).not.toBe(byLayer(10))
  })
})

describe('wordLengthSphere 形状注册', () => {
  it('getAvailableShapes3D: S₄/S₅ 提供 wordLengthSphere', () => {
    expect(getAvailableShapes3D(S4)).toContain('wordLengthSphere')
    expect(getAvailableShapes3D(S5)).toContain('wordLengthSphere')
    expect(getAvailableShapes3D(S4).filter(s => s === 'wordLengthSphere')).toHaveLength(1)
  })

  it('getSpecialCayleyActions: S₄ → 3 个相邻对换边配置', () => {
    const actions = getSpecialCayleyActions(S4, 'wordLengthSphere')
    expect(actions).not.toBeNull()
    expect(actions!.map(a => a.elementId)).toEqual(['2,1,3,4', '1,3,2,4', '1,2,4,3'])
    expect(actions!.every(a => a.enabled)).toBe(true)
  })

  it('getSpecialCayleyActions: S₅ → 4 个相邻对换边配置', () => {
    const actions = getSpecialCayleyActions(S5, 'wordLengthSphere')
    expect(actions).not.toBeNull()
    expect(actions!.map(a => a.elementId)).toEqual(['2,1,3,4,5', '1,3,2,4,5', '1,2,4,3,5', '1,2,3,5,4'])
  })

  it('其他形状不受影响：S₄ truncatedOctahedron2 边配置不变', () => {
    const actions = getSpecialCayleyActions(S4, 'truncatedOctahedron2')
    expect(actions!.map(a => a.elementId)).toEqual(['2,3,4,1', '2,1,3,4'])
  })
})

describe('wordLengthSphereActions（引擎公共面）', () => {
  it('S₄ → 3 条相邻对换，按调色板顺序配色', () => {
    const actions = wordLengthSphereActions(S4)
    expect(actions).not.toBeNull()
    expect(actions!.map(a => a.elementId)).toEqual(['2,1,3,4', '1,3,2,4', '1,2,4,3'])
    expect(actions!.map(a => a.color)).toEqual(COLOR_PALETTE.slice(0, 3))
    expect(actions!.every(a => a.enabled)).toBe(true)
  })

  it('S₅ → 4 条相邻对换（(12)(23)(34)(45)）', () => {
    expect(wordLengthSphereActions(S5)!.map(a => a.elementId))
      .toEqual(['2,1,3,4,5', '1,3,2,4,5', '1,2,4,3,5', '1,2,3,5,4'])
  })

  it('每条作用边把字长改变 ±1（本形状「只有层间有边」的结构根据）', () => {
    const gens = wordLengthSphereActions(S5)!.map(a => S5.elements.find(e => e.id === a.elementId)!)
    expect(gens.every(Boolean)).toBe(true)
    for (const g of gens) {
      for (const el of S5.elements) {
        const before = wordLengthOf(el)!
        const after = wordLengthOf(S5.multiply(el, g))!
        expect(Math.abs(before - after)).toBe(1)
      }
    }
  })

  it('结构不符或超出形状支持（C₄ / S₃ / S₆）返回 null', () => {
    expect(wordLengthSphereActions(createCyclicGroup(4))).toBeNull()
    expect(wordLengthSphereActions(createSymmetricGroup(3))).toBeNull()
    expect(wordLengthSphereActions(createSymmetricGroup(6))).toBeNull()
  })

  it('应用层委托同一实现（getSpecialCayleyActions 与核心逐位一致）', () => {
    expect(getSpecialCayleyActions(S4, 'wordLengthSphere')).toEqual(wordLengthSphereActions(S4))
    expect(getSpecialCayleyActions(S5, 'wordLengthSphere')).toEqual(wordLengthSphereActions(S5))
  })

  it('core 门面导出可达（@groupviz/core 公共面，打包重写后仍可解析）', async () => {
    const facade = await import('../core/index')
    expect(facade.wordLengthSphereActions).toBe(wordLengthSphereActions)
    expect(facade.wordLengthSphereLayout3D).toBe(wordLengthSphereLayout3D)
    expect(facade.wordLengthColor).toBe(wordLengthColor)
    expect(facade.wordLengthOf).toBe(wordLengthOf)
    expect(facade.findAdjacentTranspositionGenerators).toBe(findAdjacentTranspositionGenerators)
  })
})

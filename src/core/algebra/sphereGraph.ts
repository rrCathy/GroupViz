/**
 * 球面图嵌入（spherical 凯莱图专用）
 *
 * 纯函数模块：不依赖 three.js、不依赖 Group 类型，全部按元素索引操作。
 * 三档降级链：
 *  1. 单球面平面路由 —— 大圆短弧 + 切向绕行（detour），小群先做爬山消交叉；
 *  2. 内部弦（直径）—— 残留边转为穿过球内的弦（弦与表面弧数学上永不交叉）；
 *  3. 同心球面分层 —— 残留继续下沉到 0.8R / 0.64R 的内层球面，层间物理隔离。
 *
 * 所有随机过程（爬山、微扰）均使用种子 RNG（mulberry32），保证确定性。
 */

export type Vec3 = [number, number, number]

export interface SphereEdge {
  fromIdx: number
  toIdx: number
}

export interface SphereArcData {
  fromIdx: number
  toIdx: number
  /** 单位球面上的采样点（含两端点），实际渲染半径 = radiusFactor * R */
  samples: Vec3[]
}

export interface SphereChordData {
  fromIdx: number
  toIdx: number
  /** 弦 = 两端点之间的直线段，samples[0] / samples[1] 为端点（单位向量） */
  samples: Vec3[]
}

export interface SphereLayerData {
  /** 相对最外层球面的半径因子（1.0 / 0.8 / 0.64 ...） */
  radiusFactor: number
  arcs: SphereArcData[]
  /** 该层弧的端点（元素索引） */
  nodeIdxs: number[]
}

export type SphereMode = 'planar' | 'chord' | 'layered'

export interface SphereStemData {
  idx: number
  /** 该元素最外层所在层下标（>=1 时需画杆 + 小圆点） */
  layer: number
}

export interface SphereEmbedding {
  /** 所有元素在单位球上的方向（已精修，可能已被爬山调整） */
  directions: Vec3[]
  /** 每层球面的弧；layers[0] 恒为最外层（radiusFactor=1） */
  layers: SphereLayerData[]
  /** 内部弦（档2/档3 兜底） */
  chords: SphereChordData[]
  /** 需要杆 + 小圆点的元素（其最外层 > 0） */
  stems: SphereStemData[]
  mode: SphereMode
}

export interface EmbedOptions {
  /** 档2 弦数量上限，默认 max(6, floor(order/12)) */
  chordCap?: number
  /** 最多层数，默认 3 */
  maxLayers?: number
  seed?: number
  /** 是否做爬山消交叉（小群默认 true） */
  climb?: boolean
  /** 是否做切向排斥精修（默认 true） */
  refine?: boolean
}

const DEG = Math.PI / 180
const COINCIDE = 0.9999999
/** 采样邻近交叉检测阈值（度） */
const CROSS_THRESHOLD = 4.5 * DEG
/** 最终清扫触碰阈值（度）：弯弧对的实际几何触碰（管径+线宽量级）——
 * 大而化之的 4.5° 近贴标准在稠密图中会清掉大片合法并行弧（级联淘汰回归）；
 * 未弯直弧对用 greatArcsCross 精确判定（主循环已消干净，清扫纯兜底） */
const SWEEP_THRESHOLD = 1.0 * DEG
/** 采样邻近检测的细分步数 */
const SEGMENTS = 48
/** 共享端点判定半径 */
const ENDPOINT_EPS = 1e-4

/** 确定性种子 RNG（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 球面半径：与 layout3D 旧 spherical 公式一致 */
export function sphereRadiusFor(n: number): number {
  return Math.max(5, Math.pow(n, 1 / 3) * 2.2)
}

export function angularDist(a: Vec3, b: Vec3): number {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const c = Math.min(1, Math.max(-1, d))
  return Math.acos(c)
}

function norm3(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function normalize3(v: Vec3): Vec3 {
  const l = norm3(v)
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]
}

/** Rodrigues 旋转：v 绕单位轴 axis 旋转 angle（右手系） */
function rotateVec(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const ax = cross3(axis, v)
  const a1 = scale3(v, c)
  const a2 = scale3(ax, s)
  const a3 = scale3(axis, dot3(axis, v) * (1 - c))
  return [a1[0] + a2[0] + a3[0], a1[1] + a2[1] + a3[1], a1[2] + a2[2] + a3[2]]
}

/** 与 v 正交的确定性单位向量（交叉为 0 时的兜底轴） */
function deterministicPerp(v: Vec3): Vec3 {
  const ref: Vec3 = Math.abs(v[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
  return normalize3(cross3(v, ref))
}

/** 球面线性插值（单位向量），对径退化时沿确定性轴旋转 */
function slerpUnit(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = dot3(a, b)
  if (d > COINCIDE) return a
  let axis = cross3(a, b)
  const axisLen = norm3(axis)
  let theta = Math.atan2(axisLen, d)
  if (axisLen < 1e-9) {
    // 对径（或近对径）：确定性轴旋转
    axis = deterministicPerp(a)
    theta = Math.PI
  } else {
    axis = normalize3(axis)
  }
  return rotateVec(a, axis, theta * t)
}

/**
 * 大圆弧采样（含两端点，segments+1 个点）。
 * 两端重合（|dot| > COINCIDE）返回 null。
 */
export function greatArcSamples(u: Vec3, v: Vec3, segments: number): Vec3[] | null {
  const d = dot3(u, v)
  if (d > COINCIDE) return null
  const samples: Vec3[] = []
  for (let i = 0; i <= segments; i++) {
    samples.push(slerpUnit(u, v, i / segments))
  }
  return samples
}

/** 弯弧控制点：大圆弧中点 m 绕切向轴旋转 delta。
 * dir 指定弯弧方向（默认 = 弧平面法线 cross(u,v)，即切向绕行）；
 * 正交交叉（|nA·nB|≈0）时两法线互在对方平面内，单用任一法线作运动方向都会让
 * 控制点停留在对方大圆上（弯弧仍穿过交叉点，C6 环路实测踩坑）；45° 合成方向
 * 同时离开两平面。 */
function bendControl(u: Vec3, v: Vec3, delta: number, dir?: Vec3): Vec3 {
  const m = slerpUnit(u, v, 0.5)
  let nA = normalize3(cross3(u, v))
  if (norm3(nA) < 1e-9) {
    nA = deterministicPerp(u)
  }
  const d = dir && norm3(dir) > 1e-4 ? normalize3(dir) : nA
  if (norm3(d) < 1e-4) return m
  const axis = normalize3(cross3(d, m))
  return rotateVec(m, axis, delta)
}

/** 弯弧候选方向：按交叉对几何生成多组逃逸轴。
 * nB=对方弧平面法线（垂直逃离对方平面）、nA+nB 合成（同时离开两平面）、
 * nA=本弧平面法线（保持绕行）、slide=两平面交线方向（沿交叉线滑开）。 */
function bendAxes(a: { samples: Vec3[] }, b: { samples: Vec3[] }): Vec3[] {
  const nA = normalize3(cross3(a.samples[0], a.samples[a.samples.length - 1]))
  const nB = normalize3(cross3(b.samples[0], b.samples[b.samples.length - 1]))
  const out: Vec3[] = []
  for (const d of [nB, normalize3(add3(nA, nB)), nA, normalize3(cross3(nB, nA))]) {
    if (norm3(d) < 1e-4) continue
    if (out.some(o => dot3(o, d) > 0.9999)) continue
    out.push(d)
  }
  return out
}

/** 球形二次 Bezier 采样（单位球面上，含两端点） */
function bezierSamples(u: Vec3, v: Vec3, control: Vec3, segments: number): Vec3[] {
  const samples: Vec3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const s1 = slerpUnit(u, control, t)
    const s2 = slerpUnit(control, v, t)
    samples.push(slerpUnit(s1, s2, t))
  }
  return samples
}

/** 球形三次 Bezier 采样（平顶弯：两个控制点拉宽高偏离区，缓解二次弯弧回落过快二次穿越对方平面） */
function bezierSamplesCubic(u: Vec3, c1: Vec3, c2: Vec3, v: Vec3, segments: number): Vec3[] {
  const samples: Vec3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a0 = slerpUnit(u, c1, t)
    const a1 = slerpUnit(c1, c2, t)
    const a2 = slerpUnit(c2, v, t)
    const b0 = slerpUnit(a0, a1, t)
    const b1 = slerpUnit(a1, a2, t)
    samples.push(slerpUnit(b0, b1, t))
  }
  return samples
}

function isArcEndpoint(x: Vec3, a: Vec3, b: Vec3): boolean {
  return angularDist(x, a) < ENDPOINT_EPS || angularDist(x, b) < ENDPOINT_EPS
}

/**
 * 精确大圆交叉测试：两条大圆弧（端点单位向量）是否在内部相交。
 * 共享端点（同时为两端弧的端点）不算交叉；一端点落在另一弧内部算交叉。
 */
export function greatArcsCross(a1: Vec3, a2: Vec3, b1: Vec3, b2: Vec3): boolean {
  const nA = normalize3(cross3(a1, a2))
  const nB = normalize3(cross3(b1, b2))
  const denom = dot3(nA, nB)
if (Math.abs(denom) > 1 - 1e-9) {
    // 共面：两弧在同一大圆上。用弧上采样点相位 unwrap（沿弧方向连续累加，
    // 跨过参考方向的回转弧也能得到真实区间），两区间有内点重叠即交叉。
    const ref = a1
    const phase = (x: Vec3) => Math.atan2(dot3(cross3(ref, x), nA), dot3(ref, x))
    const intervalOf = (u: Vec3, v: Vec3): [number, number] => {
      let acc = 0
      let prev = phase(u)
      const start = prev
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const p = phase(slerpUnit(u, v, t))
        let d = p - prev
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        acc += d
        prev = p
      }
      return [start, start + acc]
    }
    const [aLo, aHi] = intervalOf(a1, a2)
    const [bLo, bHi] = intervalOf(b1, b2)
    return Math.min(aHi, bHi) - Math.max(aLo, bLo) > 1e-9
  }
  const x = normalize3(cross3(nA, nB))
  const candidates: Vec3[] = [x, scale3(x, -1) as Vec3]
  for (const cand of candidates) {
    const inA =
      angularDist(cand, a1) + angularDist(cand, a2) <= angularDist(a1, a2) + 1e-5
    const inB =
      angularDist(cand, b1) + angularDist(cand, b2) <= angularDist(b1, b2) + 1e-5
    if (inA && inB && !(isArcEndpoint(cand, a1, a2) && isArcEndpoint(cand, b1, b2))) {
      return true
    }
  }
  return false
}

/** 两条空间线段（含端点）之间的最短距离 */
function segSegDist(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): number {
  const d1: Vec3 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]]
  const d2: Vec3 = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]]
  const r: Vec3 = [a0[0] - b0[0], a0[1] - b0[1], a0[2] - b0[2]]
  const a = dot3(d1, d1)
  const e = dot3(d2, d2)
  const f = dot3(d2, r)
  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  let s = 0
  let t = 0
  if (a < 1e-12 && e < 1e-12) {
    return norm3(r)
  }
  if (a < 1e-12) {
    s = 0
    t = clamp01(f / e)
  } else {
    const c = dot3(d1, r)
    if (e < 1e-12) {
      t = 0
      s = clamp01(-c / a)
    } else {
      const b = dot3(d1, d2)
      const denom = a * e - b * b
      s = denom > 1e-12 ? clamp01((b * f - c * e) / denom) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp01(-c / a)
      } else if (t > 1) {
        t = 1
        s = clamp01((b - c) / a)
      }
    }
  }
      const c1: Vec3 = [a0[0] + d1[0] * s, a0[1] + d1[1] * s, a0[2] + d1[2] * s]
      const c2: Vec3 = [b0[0] + d2[0] * t, b0[1] + d2[1] * t, b0[2] + d2[2] * t]
  return norm3([c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]])
}

/** 折线（弧采样）交叉检测：逐段求两折线线段间最短距离 < threshold 即交叉。
 * 对弯弧精确——折线即实际渲染几何，不遗漏采样缝隙中的交叉。 */
export function polylinesNear(sa: Vec3[], sb: Vec3[], threshold: number, stride = 1): boolean {
  for (let i = 0; i < sa.length - 1; i += stride) {
    const ax0 = sa[i]
    const ax1 = sa[i + 1]
    for (let j = 0; j < sb.length - 1; j += stride) {
      if (segSegDist(ax0, ax1, sb[j], sb[j + 1]) < threshold) return true
    }
  }
  return false
}

/** 共享端点弧对的交叉检测：exDir 为两弧共用的节点方向。
 * 两弧在共享节点处汇合是合法接触（距离≈0），但离开节点后的
 * 并行/交叉才是视觉问题。排除沿弧距共享节点 2×阈值 以内的段对
 * （节点 blob 覆盖区 + 汇合扇区），其余段按线段级距离精确检测——
 * 弯弧后弧的端段仍会贴着共享节点汇入，若邻域太小弯弧永远无法被接受，
 * 导致级联淘汰（实测全图被清扫光的回归）。 */
export function polylinesNearEx(sa: Vec3[], sb: Vec3[], threshold: number, stride: number, exDir: Vec3): boolean {
  const zone = 2 * threshold
  for (let i = 0; i < sa.length - 1; i += stride) {
    const nearNodeA = angularDist(sa[i], exDir) < zone && angularDist(sa[i + 1], exDir) < zone
    for (let j = 0; j < sb.length - 1; j += stride) {
      if (nearNodeA && angularDist(sb[j], exDir) < zone && angularDist(sb[j + 1], exDir) < zone) continue
      if (segSegDist(sa[i], sa[i + 1], sb[j], sb[j + 1]) < threshold) return true
    }
  }
  return false
}

function aabbOf(samples: Vec3[]): [number, number, number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const p of samples) {
    if (p[0] < minX) minX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[2] < minZ) minZ = p[2]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] > maxY) maxY = p[1]
    if (p[2] > maxZ) maxZ = p[2]
  }
  return [minX, minY, minZ, maxX, maxY, maxZ]
}

function aabbOverlap(
  a: [number, number, number, number, number, number],
  b: [number, number, number, number, number, number],
): boolean {
  return a[0] <= b[3] && b[0] <= a[3] && a[1] <= b[4] && b[1] <= a[4] && a[2] <= b[5] && b[2] <= a[5]
}

interface ArcLike {
  fromIdx: number
  toIdx: number
  samples: Vec3[]
  bent: boolean
  nBends: number
}

/** 两弧共享端点时返回共享节点方向（= 对应端点采样），否则 null */
function sharedDirOf(a: ArcLike, b: ArcLike): Vec3 | null {
  if (a.fromIdx === b.fromIdx || a.fromIdx === b.toIdx) return a.samples[0]
  if (a.toIdx === b.fromIdx || a.toIdx === b.toIdx) return a.samples[a.samples.length - 1]
  return null
}

/** 端点 (u,v) 与弧 o 共享端点时返回 o 上对应方向，否则 null */
function sharedDirOfPair(u: number, v: number, o: ArcLike): Vec3 | null {
  if (u === o.fromIdx || v === o.fromIdx) return o.samples[0]
  if (u === o.toIdx || v === o.toIdx) return o.samples[o.samples.length - 1]
  return null
}

/** 两个弧是否交叉（a、b 均含 samples）。
 * 共享端点对不再整对跳过：未弯直弧用 greatArcsCross（已正确排除端点汇合、
 * 对径交叉可检出）；任一弯弧时用 polylinesNearEx（排除节点邻域接触，
 * 检测离开节点后的真实交叉/并行近贴）。 */
function arcsCross(a: ArcLike, b: ArcLike, threshold: number, exact: boolean): boolean {
  if (exact && !a.bent && !b.bent) {
    return greatArcsCross(a.samples[0], a.samples[a.samples.length - 1], b.samples[0], b.samples[b.samples.length - 1])
  }
  const exDir = sharedDirOf(a, b)
  if (exDir) {
    return polylinesNearEx(a.samples, b.samples, threshold, 1, exDir)
  }
  return polylinesNear(a.samples, b.samples, threshold)
}

function findAllCrossings(
  arcs: ArcLike[],
  threshold: number,
  exact: boolean,
): Array<{ ai: number; bi: number }> {
  // AABB 剪枝：外扩 threshold 防漏检——近贴对的盒子可能在某一轴上恰好不重叠
  const boxes = arcs.map(a => {
    const b = aabbOf(a.samples)
    return [b[0] - threshold, b[1] - threshold, b[2] - threshold, b[3] + threshold, b[4] + threshold, b[5] + threshold] as [number, number, number, number, number, number]
  })
  const out: Array<{ ai: number; bi: number }> = []
  for (let i = 0; i < arcs.length; i++) {
    for (let j = i + 1; j < arcs.length; j++) {
      if (!aabbOverlap(boxes[i], boxes[j])) continue
      if (arcsCross(arcs[i], arcs[j], threshold, exact)) {
        out.push({ ai: i, bi: j })
      }
    }
  }
  return out
}

/** 弧与「外来节点」的最小角距（排除自身两端点） */
function minAngularToNodes(samples: Vec3[], dirs: Vec3[], fromIdx: number, toIdx: number): number {
  let best = Infinity
  for (let i = 0; i < dirs.length; i++) {
    if (i === fromIdx || i === toIdx) continue
    const w = dirs[i]
    let b = Infinity
    for (const p of samples) {
      const d = angularDist(p, w)
      if (d < b) b = d
    }
    if (b < best) best = b
  }
  return best
}

/** 弯弧是否与其它弧交叉（折线线段级精确检测，quick 模式降采样；
 * 共享端点弧对用 polylinesNearEx 排除节点邻域合法接触） */
function bendsClearOtherArcs(
  samples: Vec3[],
  fromIdx: number,
  toIdx: number,
  others: ArcLike[],
  threshold: number,
  quick: boolean,
): boolean {
  const stride = quick ? 2 : 1
  for (const o of others) {
    const exDir = sharedDirOfPair(fromIdx, toIdx, o)
    if (exDir) {
      if (polylinesNearEx(samples, o.samples, threshold, stride, exDir)) return false
    } else if (polylinesNear(samples, o.samples, threshold, stride)) {
      return false
    }
  }
  return true
}

/**
 * 单层路由：把 edges 路由为球面上的弧。
 * @returns 成功路由的弧 + 残留（无法路由的边）
 */
function routeLayer(
  dirs: Vec3[],
  edges: SphereEdge[],
  clearance: number,
  segments: number,
  _seed: number,
): { arcs: ArcLike[]; residual: SphereEdge[] } {
  const arcs: ArcLike[] = []
  const residual: SphereEdge[] = []
  for (const e of edges) {
    const u = dirs[e.fromIdx]
    const v = dirs[e.toIdx]
    const samples = greatArcSamples(u, v, segments)
    if (samples === null) {
      residual.push(e)
      continue
    }
    arcs.push({ fromIdx: e.fromIdx, toIdx: e.toIdx, samples, bent: false, nBends: 0 })
  }
  const quick = arcs.length > 300

  // 交叉消除循环：不设迭代上限——每次迭代要么弯弧成功、要么淘汰一条弧
  // （nBends≥2 或弯不动），状态必然前进，循环必然终止；
  // 结束后再做一次全量交叉清扫，保证返回的表面弧零交叉。
  const maxIters = arcs.length * 5 + 100
  let guard = 0
  while (guard++ < maxIters) {
    const crossings = findAllCrossings(arcs, CROSS_THRESHOLD, true)
    if (crossings.length > 0) {
      const pair = crossings[0]
      const a = arcs[pair.ai]
      const b = arcs[pair.bi]
      const lenA = angularDist(a.samples[0], a.samples[a.samples.length - 1])
      const lenB = angularDist(b.samples[0], b.samples[b.samples.length - 1])
      const bendIdx = lenA >= lenB ? pair.ai : pair.bi
      const other = arcs[bendIdx === pair.ai ? pair.bi : pair.ai]
      const arc = arcs[bendIdx]
      if (arc.nBends >= 2) {
        residual.push({ fromIdx: arc.fromIdx, toIdx: arc.toIdx })
        arcs.splice(bendIdx, 1)
        continue
      }
      // 候选 delta：优先远离交叉目标；大 delta 用于双方都长的弧（交叉在相互中点，
      // 小幅偏离仍贴着对方弧的全长采样）。弯弧方向多组：垂直逃逸对方平面、
      // 45° 合成、本弧平面绕行、沿交叉线滑开——正交交叉时单方向可能失效。
      const deltas = [0.7, -0.7, 1.0, -1.0, 1.35, -1.35, 0.45, -0.45, 0.25, -0.25, 1.8, -1.8, 2.2, -2.2]
      const axes = bendAxes(arc, other)
      let accepted = false
      for (const axis of axes) {
        if (accepted) break
        for (const delta of deltas) {
          const control = bendControl(arc.samples[0], arc.samples[arc.samples.length - 1], delta, axis)
          const trial = bezierSamples(arc.samples[0], arc.samples[arc.samples.length - 1], control, segments)
          if (polylinesNear(trial, other.samples, CROSS_THRESHOLD)) continue
          if (minAngularToNodes(trial, dirs, arc.fromIdx, arc.toIdx) < clearance) continue
          const others = arcs.filter((_, k) => k !== bendIdx)
          if (!bendsClearOtherArcs(trial, arc.fromIdx, arc.toIdx, others, CROSS_THRESHOLD, quick)) continue
          arc.samples = trial
          arc.bent = true
          arc.nBends += 1
          accepted = true
          break
        }
      }
      if (!accepted) {
        // 二次弯全失败：尝试三次「平顶弯」（c1=δ/3、c2=δ），高偏离区拉宽后
        // 弯弧不再急落回自身测地线，避开对方弧的长距离延续段
        let cubicAccepted = false
        for (const axis of axes) {
          if (cubicAccepted) break
          for (const delta of [0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0]) {
            const c1 = bendControl(arc.samples[0], arc.samples[arc.samples.length - 1], delta / 3, axis)
            const c2 = bendControl(arc.samples[0], arc.samples[arc.samples.length - 1], delta, axis)
            const trial = bezierSamplesCubic(arc.samples[0], c1, c2, arc.samples[arc.samples.length - 1], segments)
            if (polylinesNear(trial, other.samples, CROSS_THRESHOLD)) continue
            if (minAngularToNodes(trial, dirs, arc.fromIdx, arc.toIdx) < clearance) continue
            const others = arcs.filter((_, k) => k !== bendIdx)
            if (!bendsClearOtherArcs(trial, arc.fromIdx, arc.toIdx, others, CROSS_THRESHOLD, quick)) continue
            arc.samples = trial
            arc.bent = true
            arc.nBends += 1
            cubicAccepted = true
            break
          }
        }
        if (cubicAccepted) {
          continue
        }
        // 弯本弧全部失败：尝试弯对方弧分担（双方都是长弧、交叉在相互中点时，
        // 单边弯会把交叉点沿对方弧推走，弧的侧翼仍贴着对方弧）
        const otherAxes = bendAxes(other, arc)
        let otherAccepted = false
        for (const axis of otherAxes) {
          if (otherAccepted) break
          for (const delta of deltas) {
            const control = bendControl(other.samples[0], other.samples[other.samples.length - 1], delta, axis)
            const trial = bezierSamples(other.samples[0], other.samples[other.samples.length - 1], control, segments)
            if (polylinesNear(trial, arc.samples, CROSS_THRESHOLD)) continue
            if (minAngularToNodes(trial, dirs, other.fromIdx, other.toIdx) < clearance) continue
            const others = arcs.filter((_, k) => k !== bendIdx)
            if (!bendsClearOtherArcs(trial, other.fromIdx, other.toIdx, others, CROSS_THRESHOLD, quick)) continue
            other.samples = trial
            other.bent = true
            other.nBends += 1
            otherAccepted = true
            break
          }
        }
        if (otherAccepted) {
          // 对方弧弯成功，下一轮迭代继续处理其余交叉
        } else {
          residual.push({ fromIdx: arc.fromIdx, toIdx: arc.toIdx })
          arcs.splice(bendIdx, 1)
        }
      }
      continue
    }
    // 无交叉：节点避让检查
    const violators: number[] = []
    for (let i = 0; i < arcs.length; i++) {
      if (minAngularToNodes(arcs[i].samples, dirs, arcs[i].fromIdx, arcs[i].toIdx) < clearance) {
        violators.push(i)
      }
    }
    if (violators.length === 0) break
    const vi = violators[0]
    const arc = arcs[vi]
    if (arc.nBends >= 2) {
      residual.push({ fromIdx: arc.fromIdx, toIdx: arc.toIdx })
      arcs.splice(vi, 1)
      continue
    }
    // 找出最近的外来节点，弯弧方向 = 从该节点方向反推（直接推离，比仅沿本弧
    // 法线绕行有效——绕行会把弧推过节点头顶，反推则从节点侧面滑开）
    let nodeIdx = -1
    let nodeDist = Infinity
    for (let i = 0; i < dirs.length; i++) {
      if (i === arc.fromIdx || i === arc.toIdx) continue
      const w = dirs[i]
      let b = Infinity
      for (const p of arc.samples) {
        const d = angularDist(p, w)
        if (d < b) b = d
      }
      if (b < nodeDist) {
        nodeDist = b
        nodeIdx = i
      }
    }
    const wNode = dirs[nodeIdx]
    const mNode = slerpUnit(arc.samples[0], arc.samples[arc.samples.length - 1], 0.5)
    const away = normalize3(add3(scale3(mNode, dot3(wNode, mNode)), scale3(wNode, -1)))
    let accepted = false
    for (const delta of [0.6, -0.6, 0.35, -0.35, 0.9, -0.9]) {
      for (const dir of [away, undefined]) {
        const control = bendControl(arc.samples[0], arc.samples[arc.samples.length - 1], delta, dir)
        const trial = bezierSamples(arc.samples[0], arc.samples[arc.samples.length - 1], control, segments)
        if (minAngularToNodes(trial, dirs, arc.fromIdx, arc.toIdx) < clearance) continue
        const others = arcs.filter((_, k) => k !== vi)
        if (!bendsClearOtherArcs(trial, arc.fromIdx, arc.toIdx, others, CROSS_THRESHOLD, quick)) continue
        arc.samples = trial
        arc.bent = true
        arc.nBends += 1
        accepted = true
        break
      }
      if (accepted) break
    }
    if (!accepted) {
      residual.push({ fromIdx: arc.fromIdx, toIdx: arc.toIdx })
      arcs.splice(vi, 1)
    }
  }
  // 最终清扫：仍处于交叉中的弧全部淘汰到残留（保证表面弧零交叉，
  // 兜住极端情况下循环上限提前耗尽的情形）。清扫用阈值检测（折线距离），
  // 未弯弧对的「近贴」也一并剔除——近贴视觉上与交叉无异。
  const crossed: Array<{ ai: number; bi: number }> = []
  const boxes = arcs.map(a => {
    const b = aabbOf(a.samples)
    return [b[0] - CROSS_THRESHOLD, b[1] - CROSS_THRESHOLD, b[2] - CROSS_THRESHOLD, b[3] + CROSS_THRESHOLD, b[4] + CROSS_THRESHOLD, b[5] + CROSS_THRESHOLD] as [number, number, number, number, number, number]
  })
  for (let i = 0; i < arcs.length; i++) {
    for (let j = i + 1; j < arcs.length; j++) {
      if (!aabbOverlap(boxes[i], boxes[j])) continue
      const a = arcs[i]
      const b = arcs[j]
      let hit = false
      if (!a.bent && !b.bent) {
        hit = greatArcsCross(a.samples[0], a.samples[a.samples.length - 1], b.samples[0], b.samples[b.samples.length - 1])
      } else {
        const exDir = sharedDirOf(a, b)
        if (exDir) {
          hit = polylinesNearEx(a.samples, b.samples, SWEEP_THRESHOLD, 1, exDir)
        } else {
          hit = polylinesNear(a.samples, b.samples, SWEEP_THRESHOLD)
        }
      }
if (hit) {
        crossed.push({ ai: i, bi: j })
      }
    }
  }
  if (crossed.length > 0) {
    const drop = new Set<number>()
    for (const { ai, bi } of crossed) {
      drop.add(ai)
      drop.add(bi)
    }
    const idxs = [...drop].sort((x, y) => y - x)
    for (const k of idxs) {
      residual.push({ fromIdx: arcs[k].fromIdx, toIdx: arcs[k].toIdx })
      arcs.splice(k, 1)
    }
  }
  const leftover: ArcLike[] = []
  for (const a of arcs) leftover.push(a)
  return { arcs: leftover, residual }
}

/** 弦（直线段）的 3D 最近距离：数值采样两段各 8 点 */
function segmentsNear(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3, minDist: number): boolean {
  for (let i = 0; i <= 8; i++) {
    const ta = i / 8
    const pa: Vec3 = [
      a0[0] + (a1[0] - a0[0]) * ta,
      a0[1] + (a1[1] - a0[1]) * ta,
      a0[2] + (a1[2] - a0[2]) * ta,
    ]
    for (let j = 0; j <= 8; j++) {
      const tb = j / 8
      const pb: Vec3 = [
        b0[0] + (b1[0] - b0[0]) * tb,
        b0[1] + (b1[1] - b0[1]) * tb,
        b0[2] + (b1[2] - b0[2]) * tb,
      ]
      const dx = pa[0] - pb[0]
      const dy = pa[1] - pb[1]
      const dz = pa[2] - pb[2]
      if (dx * dx + dy * dy + dz * dz < minDist * minDist) return true
    }
  }
  return false
}

/** 点 w 到线段 (a,b) 的最短距离 */
function distToSegment(w: Vec3, a: Vec3, b: Vec3): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const abz = b[2] - a[2]
  const len2 = abx * abx + aby * aby + abz * abz
  let t = 0
  if (len2 > 1e-12) {
    t = ((w[0] - a[0]) * abx + (w[1] - a[1]) * aby + (w[2] - a[2]) * abz) / len2
    t = Math.max(0, Math.min(1, t))
  }
  const px = a[0] + abx * t - w[0]
  const py = a[1] + aby * t - w[1]
  const pz = a[2] + abz * t - w[2]
  return Math.sqrt(px * px + py * py + pz * pz)
}

/** 构建内部弦：微扰端点避开其它弦与外来节点球 */
function buildChords(
  residual: SphereEdge[],
  dirs: Vec3[],
  clearance: number,
  seed: number,
): SphereChordData[] {
  const rng = mulberry32(seed)
  const chords: SphereChordData[] = []
  for (const e of residual) {
    let a = dirs[e.fromIdx]
    let b = dirs[e.toIdx]
    let ok = false
    for (let attempt = 0; attempt < 10 && !ok; attempt++) {
      ok = true
      for (const c of chords) {
        if (segmentsNear(a, b, c.samples[0], c.samples[1], 0.02)) {
          ok = false
          break
        }
      }
      if (ok) {
        for (let i = 0; i < dirs.length; i++) {
          if (i === e.fromIdx || i === e.toIdx) continue
          if (distToSegment(dirs[i], a, b) < clearance * 0.9) {
            ok = false
            break
          }
        }
      }
      if (!ok && attempt < 9) {
        // 微扰一个端点（小幅，保持仍贴着节点球）
        const axis = deterministicPerp(attempt % 2 === 0 ? a : b)
        const angle = (0.02 + rng() * 0.05) * (attempt % 2 === 0 ? 1 : -1)
        if (attempt % 2 === 0) {
          a = rotateVec(a, axis, angle)
        } else {
          b = rotateVec(b, axis, angle)
        }
      }
    }
    chords.push({ fromIdx: e.fromIdx, toIdx: e.toIdx, samples: [a, b] })
  }
  return chords
}

/**
 * Fibonacci 球面点（黄金角分布），n=1 返回北极。
 */
export function fibonacciUnitPoints(n: number): Vec3[] {
  if (n <= 1) return [[0, 0, 1]]
  const ga = Math.PI * (3 - Math.sqrt(5))
  const pts: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = ga * i
    pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r])
  }
  return pts
}

/** 切向排斥精修：把相邻点沿大圆弧推开，保证最小角距（确定性，无 RNG） */
function refineDirections(dirs: Vec3[]): Vec3[] {
  const n = dirs.length
  if (n <= 2) return dirs
  const thetaMin = Math.max(0.045, Math.min(0.5, (2.2 * 2 * Math.PI) / n))
  const iterations = n <= 160 ? 30 : 12
  const fullPairs = n <= 160
  const stride = Math.max(1, Math.floor(n / 8))
  let d = dirs.slice()
  for (let it = 0; it < iterations; it++) {
    const next = d.slice()
    for (let i = 0; i < n; i++) {
      const js = fullPairs ? Array.from({ length: n - i - 1 }, (_, k) => i + 1 + k) : Array.from({ length: 8 }, (_, k) => (i + (k + 1) * stride) % n)
      for (const j of js) {
        const sep = angularDist(next[i], next[j])
        if (sep >= thetaMin) continue
        const axis = normalize3(cross3(next[i], next[j]))
        if (norm3(axis) < 1e-9) continue
        const delta = (thetaMin - sep) / 2
        next[i] = rotateVec(next[i], axis, -delta)
        next[j] = rotateVec(next[j], axis, delta)
      }
    }
    d = next
  }
  return d
}

/** 爬山消交叉：随机小步移动单节点，接受减少交叉数（确定性 RNG）。
 * n≤12 时用平滑目标（近交叉罚分 + 硬交叉加权）——countCross 是离散的，
 * 从 1→0 无梯度可选，随机游走从 fibonacci 起点找不到 C6 六边形盆地；
 * 平滑罚分能引导下山。 */
function climbDirections(dirs: Vec3[], edges: SphereEdge[], seed: number): Vec3[] {
  const n = dirs.length
  if (n <= 1) return dirs
  const rng = mulberry32(seed)
  let d = dirs.slice()
  const smooth = n <= 12
  const pairList: { ai: number; bi: number }[] = []
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const ei = edges[i]
      const ej = edges[j]
      if (ei.fromIdx === ej.fromIdx || ei.fromIdx === ej.toIdx || ei.toIdx === ej.fromIdx || ei.toIdx === ej.toIdx) {
        continue
      }
      pairList.push({ ai: i, bi: j })
    }
  }
  const objective = (cand: Vec3[]): number => {
    let c = 0
    let pen = 0
    for (const { ai, bi } of pairList) {
      const a = edges[ai]
      const b = edges[bi]
      const u1 = cand[a.fromIdx]
      const u2 = cand[a.toIdx]
      const v1 = cand[b.fromIdx]
      const v2 = cand[b.toIdx]
      if (greatArcsCross(u1, u2, v1, v2)) {
        c++
        continue
      }
      if (smooth) {
        // 近交叉罚分：两弧最近采样距离 d<1.6 时加 (1.6-d)²（平滑引导——
        // 阈值须大于一般排布的最小弧距 ~1.2，否则罚分永远不激活退化回随机游走）
        let md = Infinity
        for (let k = 0; k <= 24; k += 3) {
          const p = slerpUnit(u1, u2, k / 24)
          for (let l = 0; l <= 24; l += 3) {
            const q = slerpUnit(v1, v2, l / 24)
            const dd = angularDist(p, q)
            if (dd < md) md = dd
          }
        }
        if (md < 1.6) pen += (1.6 - md) * (1.6 - md)
      }
    }
    return c * 1000 + pen
  }
  let best = objective(d)
  if (best === 0) return d
  // 小 n（≤16）用激进参数：更大步长+更多轮次，能找到六边形这类协调排布
  // （±0.2 rad×96 步的随机游走永远到不了 C6 平面嵌入的优点区）
  const aggressive = n <= 16
  const moves = aggressive ? n * 40 : n * 12
  const restarts = aggressive ? 6 : n <= 40 ? 3 : 2
  for (let restart = 0; restart < restarts; restart++) {
    let cur = d
    let curBest = best
    for (let m = 0; m < moves; m++) {
      const trial = cur.slice()
      if (rng() < 0.25 && n > 2) {
        // 节点方向交换：平面图（A4/D4/Q8/D5 等）的 0 交叉排布常需大范围
        // 协调移动，单点旋转爬不进去；交换两个节点方向是经典强移动
        const i = Math.floor(rng() * n)
        let j = Math.floor(rng() * n)
        if (j === i) j = (j + 1) % n
        trial[i] = cur[j]
        trial[j] = cur[i]
      } else {
        const i = Math.floor(rng() * n)
        const axis = normalize3([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1])
        const angle = aggressive ? (rng() - 0.5) * 0.8 : (rng() - 0.5) * 0.6
        trial[i] = rotateVec(trial[i], axis, angle)
      }
      const cnt = objective(trial)
      if (cnt < curBest) {
        cur = trial
        curBest = cnt
        if (cnt === 0) break
      } else if (cnt === curBest && rng() < 0.1) {
        cur = trial
      }
    }
    if (curBest < best) {
      d = cur
      best = curBest
      if (best === 0) break
    }
  }
  return d
}

/**
 * 球面节点方向：Fibonacci 初值 + 切向排斥精修（n<=400）。
 */
export function sphericalNodeDirections(n: number): Vec3[] {
  let d = fibonacciUnitPoints(n)
  if (n > 1 && n <= 400) {
    d = refineDirections(d)
  }
  return d
}

const DEFAULT_MAX_LAYERS = 3

/**
 * 主入口：把 order 阶群的边嵌入球面。
 */
/** 单环检测：边集恰为一个环时返回环序（节点下标数组），否则 null。
 * 判定：边数 = 节点数、每节点度 2、全图连通（union-find）。 */
function cycleSeeding(order: number, edges: SphereEdge[]): number[] | null {
  if (edges.length !== order) return null
  const deg = new Array<number>(order).fill(0)
  const adj = new Map<number, number[]>()
  const parent = Array.from({ length: order }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  for (const e of edges) {
    deg[e.fromIdx]++
    deg[e.toIdx]++
    if (!adj.has(e.fromIdx)) adj.set(e.fromIdx, [])
    adj.get(e.fromIdx)!.push(e.toIdx)
    if (!adj.has(e.toIdx)) adj.set(e.toIdx, [])
    adj.get(e.toIdx)!.push(e.fromIdx)
    const ra = find(e.fromIdx)
    const rb = find(e.toIdx)
    if (ra !== rb) parent[ra] = rb
  }
  if (deg.some(d => d !== 2)) return null
  for (let i = 1; i < order; i++) {
    if (find(i) !== find(0)) return null
  }
  const cyc: number[] = [0]
  let prev = -1
  let cur = 0
  for (let k = 1; k < order; k++) {
    const nbs = adj.get(cur)!
    const next = nbs.find(x => x !== prev)
    if (next === undefined) return null
    cyc.push(next)
    prev = cur
    cur = next
  }
  if (adj.get(cur)!.find(x => x !== prev) !== 0) return null
  return cyc
}

/** 多环并置播种：边集 = 若干不相交环（每连通分量 2-正则）时，把每个环独立
 * 放在一个「小圆」上（中心均匀分布、半径小），环间物理隔离——天然 0 交叉。
 * 单环整体（全图 1 个分量）返回 null 交给 cycleSeeding 的大圆摆法。 */
function cycleComponentsSeeding(order: number, edges: SphereEdge[]): Vec3[] | null {
  const deg = new Array<number>(order).fill(0)
  const adj = new Map<number, number[]>()
  const parent = Array.from({ length: order }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  for (const e of edges) {
    deg[e.fromIdx]++
    deg[e.toIdx]++
    if (!adj.has(e.fromIdx)) adj.set(e.fromIdx, [])
    adj.get(e.fromIdx)!.push(e.toIdx)
    if (!adj.has(e.toIdx)) adj.set(e.toIdx, [])
    adj.get(e.toIdx)!.push(e.fromIdx)
    const ra = find(e.fromIdx)
    const rb = find(e.toIdx)
    if (ra !== rb) parent[ra] = rb
  }
  if (deg.some(d => d !== 2)) return null
  const comps = new Map<number, number[]>()
  for (let i = 0; i < order; i++) {
    const r = find(i)
    if (!comps.has(r)) comps.set(r, [])
    comps.get(r)!.push(i)
  }
  const groups = [...comps.values()]
  if (groups.length <= 1) return null
  const cycles: number[][] = []
  for (const comp of groups) {
    const start = comp[0]
    const cyc: number[] = [start]
    let prev = -1
    let cur = start
    for (let k = 1; k < comp.length; k++) {
      const nbs = adj.get(cur)!
      const next = nbs.find(x => x !== prev)
      if (next === undefined) return null
      cyc.push(next)
      prev = cur
      cur = next
    }
    if (adj.get(cur)!.find(x => x !== prev) !== start) return null
    cycles.push(cyc)
  }
  const centers = fibonacciUnitPoints(cycles.length)
  const dirs = new Array<Vec3>(order)
  const rho = 0.32
  for (let k = 0; k < cycles.length; k++) {
    const c = centers[k]
    const ref: Vec3 = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const u1 = normalize3(cross3(ref, c))
    const u2 = normalize3(cross3(c, u1))
    const cyc = cycles[k]
    for (let i = 0; i < cyc.length; i++) {
      const angle = (2 * Math.PI * i) / cyc.length
      const p: Vec3 = [
        c[0] * Math.cos(rho) + (u1[0] * Math.cos(angle) + u2[0] * Math.sin(angle)) * Math.sin(rho),
        c[1] * Math.cos(rho) + (u1[1] * Math.cos(angle) + u2[1] * Math.sin(angle)) * Math.sin(rho),
        c[2] * Math.cos(rho) + (u1[2] * Math.cos(angle) + u2[2] * Math.sin(angle)) * Math.sin(rho),
      ]
      dirs[cyc[i]] = p
    }
  }
  return dirs
}

export function embedSphereGraph(order: number, edges: SphereEdge[], opts?: EmbedOptions): SphereEmbedding {
  const seed = opts?.seed ?? 12345
  const maxLayers = opts?.maxLayers ?? DEFAULT_MAX_LAYERS
  const chordCap = opts?.chordCap ?? Math.max(6, Math.floor(order / 12))
  const climb = opts?.climb !== false
  const refine = opts?.refine !== false

  // 去重（同端点对只保留一条）
  const seen = new Set<string>()
  const uniq: SphereEdge[] = []
  for (const e of edges) {
    const key = e.fromIdx <= e.toIdx ? `${e.fromIdx}|${e.toIdx}` : `${e.toIdx}|${e.fromIdx}`
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push(e)
  }

  let dirs = sphericalNodeDirections(order)
  if (refine === false) {
    dirs = fibonacciUnitPoints(order)
  }
  // 单环图种子：n 条边、每节点度 2、全图连通 ⟺ 边集恰为一个环（如 Cₙ 单生成元
  // 凯莱图）。按环序均匀摆上大圆，天然 0 交叉且确定——爬山从 fibonacci 起点
  // 找不到这类协调排布（交叉数离散无梯度，1→0 需要定点大范围协调移动）。
  const cycleOrder = cycleSeeding(order, uniq)
  if (cycleOrder && order >= 3) {
    dirs = []
    for (let k = 0; k < order; k++) {
      const angle = (2 * Math.PI * k) / order
      dirs.push([Math.cos(angle), Math.sin(angle), 0])
    }
    // 按环序重排：dirs 下标 = 环序中的位置
    const perm = new Array<number>(order)
    for (let k = 0; k < order; k++) {
      perm[cycleOrder[k]] = k
    }
    dirs = perm.map(p => dirs[p])
  } else {
    const cycDirs = cycleComponentsSeeding(order, uniq)
    if (cycDirs) {
      dirs = cycDirs
    } else if (order <= 60 && uniq.length <= 400 && climb) {
      dirs = climbDirections(dirs, uniq, seed + 1)
    }
  }

  const R = sphereRadiusFor(order)
  const layers: SphereLayerData[] = [{ radiusFactor: 1, arcs: [], nodeIdxs: [] }]
  const stems: SphereStemData[] = []
  const chords: SphereChordData[] = []
  let residual = uniq.slice()

  while (residual.length > 0) {
    const layerIdx = layers.length - 1
    const factor = layers[layerIdx].radiusFactor
    const nodeRad = layerIdx === 0 ? 0.42 : 0.18
    const tubeRad = layerIdx === 0 ? 0.05 : 0.035
    const clearance = (nodeRad + tubeRad) / (R * factor)
    const { arcs, residual: rest } = routeLayer(dirs, residual, clearance, SEGMENTS, seed + 7 + layerIdx)
    for (const a of arcs) {
      layers[layerIdx].arcs.push({ fromIdx: a.fromIdx, toIdx: a.toIdx, samples: a.samples })
    }
    residual = rest
    if (residual.length === 0) break
    if (residual.length <= chordCap || layers.length >= maxLayers) {
      chords.push(...buildChords(residual, dirs, (0.42 + 0.05) / R, seed + 31))
      break
    }
    // 下沉到内层球面
    layers.push({ radiusFactor: factor * 0.8, arcs: [], nodeIdxs: [] })
  }

  // 每层端点集合
  const outermost = new Map<number, number>()
  for (let l = 0; l < layers.length; l++) {
    const idxs = new Set<number>()
    for (const a of layers[l].arcs) {
      idxs.add(a.fromIdx)
      idxs.add(a.toIdx)
    }
    layers[l].nodeIdxs = [...idxs].sort((x, y) => x - y)
    for (const idx of idxs) {
      const prev = outermost.get(idx)
      if (prev === undefined || l < prev) outermost.set(idx, l)
    }
  }
  for (const [idx, layer] of outermost) {
    if (layer > 0) {
      stems.push({ idx, layer })
    }
  }

  const mode: SphereMode = layers.length > 1 ? 'layered' : chords.length > 0 ? 'chord' : 'planar'
  return { directions: dirs, layers, chords, stems, mode }
}

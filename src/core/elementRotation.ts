import type { Group, GroupElement } from './types'

export interface RotationInfo {
  axis: [number, number, number]
  angleRad: number
  label: string
}

type Vec3 = [number, number, number]
type Mat3 = number[][]

function getCycleType(elements: number[]): string {
  const n = elements.length
  const visited = new Array(n).fill(false)
  const cycles: number[] = []
  const normalized = elements.map((v: number) => v - 1)
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    let len = 0
    let j = i
    while (j >= 0 && j < n && !visited[j]) {
      visited[j] = true
      const next = normalized[j]
      if (next === undefined || next < 0 || next >= n) break
      j = next
      len++
    }
    if (len > 1) cycles.push(len)
  }
  return cycles.sort().join('-') || '1'
}

/* ------------------------------------------------------------------ *
 * 几何反解：由置换直接导出旋转（替代此前的 hash(id) % n 选轴——那样
 * 任意排列都撞进同一桶，A₄/S₄/A₅ 的 3-循环全部塌到同一根轴）。
 *
 *   R = A · P · A⁺      A = 点模型坐标(3×n)，P = 置换矩阵
 *
 * 点模型：A₄ / S₄ 取正四面体顶点（恰为立方体的 4 条体对角线方向），
 * S₄ 的奇置换会得到 det=-1 的非固有正交阵，取 -R 即对应的旋转
 * （对偶/直线语义下二者表示同一作用）。A₅ ≅ 正二十面体旋转群，
 * 由生成元 (12345)、(12)(34) 的几何像经 BFS 建同构。
 * ------------------------------------------------------------------ */

const SQRT3 = Math.sqrt(3)

/** 正四面体顶点（= 立方体四条体对角线方向），第 i 项对应置换标签 i+1。 */
const TETRA_VERTICES: readonly Vec3[] = [
  [1 / SQRT3, 1 / SQRT3, 1 / SQRT3],
  [1 / SQRT3, -1 / SQRT3, -1 / SQRT3],
  [-1 / SQRT3, 1 / SQRT3, -1 / SQRT3],
  [-1 / SQRT3, -1 / SQRT3, 1 / SQRT3],
]

const GOLDEN = (1 + Math.sqrt(5)) / 2

/** 正二十面体顶点（12 个，归一化）。 */
const ICOSA_VERTICES: readonly Vec3[] = (() => {
  const p = GOLDEN
  const raw: Vec3[] = [
    [0, 1, p], [0, -1, p], [0, 1, -p], [0, -1, -p],
    [1, p, 0], [-1, p, 0], [1, -p, 0], [-1, -p, 0],
    [p, 0, 1], [p, 0, -1], [-p, 0, 1], [-p, 0, -1],
  ]
  return raw.map(normalize)
})()

function normalize(v: readonly number[]): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function matMul(A: Mat3, B: Mat3): Mat3 {
  return A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
}

function det3(M: Mat3): number {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  )
}

function invert3(M: Mat3): Mat3 {
  const d = det3(M) || 1
  return [
    [(M[1][1] * M[2][2] - M[1][2] * M[2][1]) / d, (M[0][2] * M[2][1] - M[0][1] * M[2][2]) / d, (M[0][1] * M[1][2] - M[0][2] * M[1][1]) / d],
    [(M[1][2] * M[2][0] - M[1][0] * M[2][2]) / d, (M[0][0] * M[2][2] - M[0][2] * M[2][0]) / d, (M[0][2] * M[1][0] - M[0][0] * M[1][2]) / d],
    [(M[1][0] * M[2][1] - M[1][1] * M[2][0]) / d, (M[0][1] * M[2][0] - M[0][0] * M[2][1]) / d, (M[0][0] * M[1][1] - M[0][1] * M[1][0]) / d],
  ]
}

function rotationFromAxisAngle(axis: Vec3, angleRad: number): Mat3 {
  const [x, y, z] = normalize(axis)
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  const C = 1 - c
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ]
}

function matPow(M: Mat3, k: number): Mat3 {
  let R: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (let i = 0; i < k; i++) R = matMul(R, M)
  return R
}

function isIdentity(M: Mat3): boolean {
  return M.every((row, i) => row.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-9))
}

/** R = A·P·A⁺（最小二乘；正交代数下恰为（非）固有正交阵）。 */
function rotationFromPermutation(points: readonly Vec3[], perm: readonly number[]): Mat3 {
  const n = points.length
  const aat: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < n; k++) s += points[k][i] * points[k][j]
      aat[i][j] = s
    }
  }
  const ap: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < n; k++) s += points[perm[k] - 1][i] * points[k][j]
      ap[i][j] = s
    }
  }
  const R = matMul(ap, invert3(aat))
  // 奇置换（S₄）得到 det=-1 的非固有正交阵；-R 才是对应旋转
  return det3(R) < 0 ? R.map(row => row.map(v => -v)) : R
}

/** 从旋转矩阵读轴角（规范化为：轴首个非零分量 ≥ 0、角度 ∈ (-π, π]）。 */
function rotationAxisAngle(R: Mat3): { axis: Vec3; angleRad: number } {
  const trace = R[0][0] + R[1][1] + R[2][2]
  const cosT = Math.max(-1, Math.min(1, (trace - 1) / 2))
  const skew: Vec3 = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]]
  const sinT = Math.hypot(skew[0], skew[1], skew[2]) / 2

  let angleRad = Math.atan2(sinT, cosT)
  let axis: Vec3
  if (sinT > 1e-9) {
    axis = normalize(skew)
  } else if (cosT < 0) {
    // 180° 旋转：轴 = 特征值 1 的特征向量（取 R+I 模最大的一列）
    let best: Vec3 = [0, 1, 0]
    let bestLen = -1
    for (let j = 0; j < 3; j++) {
      const col: Vec3 = [R[0][j] + (j === 0 ? 1 : 0), R[1][j] + (j === 1 ? 1 : 0), R[2][j] + (j === 2 ? 1 : 0)]
      const len = Math.hypot(col[0], col[1], col[2])
      if (len > bestLen) { bestLen = len; best = col }
    }
    axis = normalize(best)
    angleRad = Math.PI
  } else {
    return { axis: [0, 1, 0], angleRad: 0 }
  }

  const first = axis.find(v => Math.abs(v) > 1e-9)
  if (first !== undefined && first < 0) {
    axis = [-axis[0], -axis[1], -axis[2]]
    angleRad = -angleRad
  }
  return { axis, angleRad }
}

function isPermutation(val: readonly number[], n: number): boolean {
  if (val.length !== n) return false
  const seen = new Set<number>()
  for (const v of val) {
    if (!Number.isInteger(v) || v < 1 || v > n || seen.has(v)) return false
    seen.add(v)
  }
  return true
}

/** 去重直线方向（±v 视为同一根轴）。 */
function uniqueAxes(dirs: readonly Vec3[]): Vec3[] {
  const seen = new Set<string>()
  const out: Vec3[] = []
  for (const d of dirs) {
    const r = d.map(x => Math.round(x * 1e6) / 1e6)
    const key = r.join(',')
    const negKey = r.map(x => -x).join(',')
    if (seen.has(key) || seen.has(negKey)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

/** 正二十面体的 15 根二阶轴（棱中点方向）。 */
function icosahedronEdgeAxes(): Vec3[] {
  const n = ICOSA_VERTICES.length
  let minD2 = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = ICOSA_VERTICES[i][0] - ICOSA_VERTICES[j][0]
      const dy = ICOSA_VERTICES[i][1] - ICOSA_VERTICES[j][1]
      const dz = ICOSA_VERTICES[i][2] - ICOSA_VERTICES[j][2]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < minD2) minD2 = d2
    }
  }
  const mids: Vec3[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = ICOSA_VERTICES[i][0] - ICOSA_VERTICES[j][0]
      const dy = ICOSA_VERTICES[i][1] - ICOSA_VERTICES[j][1]
      const dz = ICOSA_VERTICES[i][2] - ICOSA_VERTICES[j][2]
      if (Math.abs(dx * dx + dy * dy + dz * dz - minD2) > 1e-9) continue
      mids.push(normalize([
        ICOSA_VERTICES[i][0] + ICOSA_VERTICES[j][0],
        ICOSA_VERTICES[i][1] + ICOSA_VERTICES[j][1],
        ICOSA_VERTICES[i][2] + ICOSA_VERTICES[j][2],
      ]))
    }
  }
  return uniqueAxes(mids)
}

const A5_GENERATOR_A: readonly number[] = [2, 3, 4, 5, 1]     // (12345)
const A5_GENERATOR_B: readonly number[] = [2, 1, 4, 3, 5]     // (12)(34)

let a5Rotations: Map<string, Mat3> | null = null

/**
 * 置换 → 旋转：A₅ ≅ 正二十面体旋转群。以 (12345) ↦ 72° 顶点轴旋转、
 * (12)(34) ↦ 满足 ord(gh)=3 的 180° 棱轴旋转（⟨g,h⟩ 阶 60）建立同构，
 * 再按生成元左乘 BFS 覆盖全部 60 个偶置换（键 = 置换数组 join(',')）。
 */
function getA5Rotations(): Map<string, Mat3> {
  if (a5Rotations) return a5Rotations
  const vertexAxes = uniqueAxes([...ICOSA_VERTICES])
  const g = rotationFromAxisAngle(vertexAxes[0], (2 * Math.PI) / 5)
  let h: Mat3 | null = null
  for (const edgeAxis of icosahedronEdgeAxes()) {
    const cand = rotationFromAxisAngle(edgeAxis, Math.PI)
    const gh = matMul(g, cand)
    if (isIdentity(matPow(gh, 3)) && !isIdentity(gh)) { h = cand; break }
  }

  const map = new Map<string, Mat3>()
  const identity: number[] = [1, 2, 3, 4, 5]
  map.set(identity.join(','), [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  if (h) {
    const gens: { perm: readonly number[]; R: Mat3 }[] = [
      { perm: A5_GENERATOR_A, R: g },
      { perm: A5_GENERATOR_B, R: h },
    ]
    const queue: number[][] = [identity]
    while (queue.length > 0) {
      const p = queue.shift()!
      const R = map.get(p.join(','))!
      for (const gen of gens) {
        // 生成元左乘：next = gen ∘ p（与 groups 的 multiply 约定一致）
        const next = p.map((_, i) => gen.perm[p[i] - 1])
        const key = next.join(',')
        if (!map.has(key)) {
          map.set(key, matMul(gen.R, R))
          queue.push(next)
        }
      }
    }
  }
  a5Rotations = map
  return map
}

/** 把角度规范化到 (−π, π]。 */
function normalizeAngle(angleRad: number): number {
  const twoPi = 2 * Math.PI
  let a = angleRad % twoPi
  if (a > Math.PI) a -= twoPi
  if (a <= -Math.PI) a += twoPi
  return a
}

/** 轴在 XZ 平面内与 +X 轴的夹角，规范化到 [0, 180)——旋转轴是**直线**，±v 同一根。 */
function lineAngleDeg(angleRad: number): number {
  const deg = (angleRad * 180) / Math.PI
  return ((Math.round(deg) % 180) + 180) % 180
}

/* ------------------------------------------------------------------ *
 * V₄ ≅ C₂ × C₂ ≅ 矩形的对称群：三个非单位元 ↦ 三根互相垂直的 180° 轴。
 *
 * 此前的实现在这里放了一张按置换 pattern 硬编码的表（'1,3,2,4' 等），但
 * createKleinFour() 的元素值是 [i]，永远匹配不上，整表成了死代码，实际落进
 * 「按序号均分 360°」的兜底，给出 90°/180°/270°——而 V₄ 三个非单位元全是
 * 2 阶，正确结果是三根互相垂直的 180° 轴。C₂² 符号以 'C' 开头，更会先撞进
 * 循环群分支（(0,0)/(0,1) 都映 0°、(1,0)/(1,1) 都映 90°）。
 *
 * 现改为由**群自身的 multiply 推导**：取首个非单位元 x ↦ X 轴、次个 y ↦ Y 轴、
 * x·y ↦ Z 轴。不依赖元素命名、值编码或符号写法。
 * ------------------------------------------------------------------ */

const KLEIN_SYMBOLS = new Set(['V_{4}', 'C_{2}^{2}', 'C_{2}\\times C_{2}'])

interface AxisAssignment {
  axis: Vec3
  angleRad: number
  label: string
}

function kleinFourAxes(group: Group): Map<string, AxisAssignment> | null {
  const identity = group.identity ?? group.elements[0]
  const others = group.elements.filter(el => el.id !== identity.id)
  for (const x of others) {
    for (const y of others) {
      if (y.id === x.id) continue
      const z = group.multiply(x, y)
      if (z.id === identity.id || z.id === x.id || z.id === y.id) continue
      return new Map<string, AxisAssignment>([
        [identity.id, { axis: [0, 1, 0], angleRad: 0, label: '恒等变换' }],
        [x.id, { axis: [1, 0, 0], angleRad: Math.PI, label: '绕 X 轴翻转 180°' }],
        [y.id, { axis: [0, 1, 0], angleRad: Math.PI, label: '绕 Y 轴翻转 180°' }],
        [z.id, { axis: [0, 0, 1], angleRad: Math.PI, label: '绕 Z 轴翻转 180°' }],
      ])
    }
  }
  return null
}

const LABELS: Record<string, Record<string, string>> = {
  'A_{4}': { '3': '体对角线', '2-2': '边中点' },
  'S_{4}': { '4': '面心', '3': '体对角线', '2-2': '面心', '2': '边中点' },
  'A_{5}': { '5': '五阶', '3': '三阶', '2-2': '二阶' },
}

const FALLBACK: RotationInfo = { axis: [0, 1, 0], angleRad: 0, label: '' }

function formatLabel(sym: string, cycleType: string, angleRad: number): string {
  const kind = LABELS[sym]?.[cycleType]
  if (!kind) return ''
  const deg = Math.round((Math.abs(angleRad) * 180) / Math.PI)
  return `绕${kind}轴旋转 ${deg}°`
}

export function computeElementRotation(group: Group, element: GroupElement): RotationInfo | null {
  const sym = group.symbol
  const val = element.value
  const order = group.order
  const idx = group.elements.findIndex(e => e.id === element.id)

  if (idx === 0) {
    return { axis: [0, 1, 0], angleRad: 0, label: '恒等变换' }
  }

  if (KLEIN_SYMBOLS.has(sym)) {
    const assigned = kleinFourAxes(group)?.get(element.id)
    if (!assigned) return null
    return {
      axis: [assigned.axis[0], assigned.axis[1], assigned.axis[2]],
      angleRad: assigned.angleRad,
      label: assigned.label,
    }
  }

  if (sym.startsWith('C')) {
    const count = val[0] ?? 0
    const deg = Math.round((count * 360) / order) % 360
    return { axis: [0, 1, 0], angleRad: (count * 2 * Math.PI) / order, label: `绕 Y 轴旋转 ${deg}°` }
  }

  if (sym.startsWith('D')) {
    const n = order / 2
    const k = val[0]
    const s = val[1] ?? 0
    if (s === 0) {
      const deg = Math.round((k * 360) / n) % 360
      return { axis: [0, 1, 0], angleRad: (k * 2 * Math.PI) / n, label: `绕 Y 轴旋转 ${deg}°` }
    }
    // 反射 = 绕所画正 n 边形镜线的 180° 翻转。顶点角 = 2πi/n − π/2
    // （SymmetryViewScene.getDihedralFigure），故镜线角 = −π/2 + kπ/n。
    // 元素 [k,1] = r^k·s，由 ρ(r^k s) = rotY(kθ)·R(β₀) = R(β₀ − kπ/n) 解得
    // β₀ = −π/2；取 0（即 ±kπ/n）会破坏群同态——n 偶数时镜线"集合"恰好
    // 重合，所以肉眼只看得出"哪个元素配错了线"，n 奇数时连集合都错。
    const refAngle = -Math.PI / 2 - (k * Math.PI) / n
    return {
      axis: [Math.cos(refAngle), 0, Math.sin(refAngle)],
      angleRad: Math.PI,
      label: `绕 ${lineAngleDeg(refAngle)}° 轴翻转 180°`,
    }
  }

  if (sym === 'S_{3}' && val.length >= 3) {
    const ct = getCycleType(val)
    if (ct === '3') {
      // 与所画三角形一致：顶点角 = 2πi/3 − π/2，rotY(θ) 把角 α 送到 α−θ，
      // 故 θ = (i − (v[i]−1))·2π/3（对 3-循环的任意 i 同值）。据此 (132) 得
      // +120°、(123) 得 −120°——原实现的 `id.charCodeAt(0) % 2` 恰好取反。
      const i = val.findIndex((v, idx) => v - 1 !== idx)
      const angleRad = normalizeAngle((i - (val[i] - 1)) * ((2 * Math.PI) / 3))
      const deg = Math.round((Math.abs(angleRad) * 180) / Math.PI)
      return { axis: [0, 1, 0], angleRad, label: `绕 Y 轴旋转 ${deg}°` }
    }
    if (ct === '2') {
      // 对换固定三角形的一个顶点，反射轴即过该顶点的镜线（与 D₃ 约定一致）
      const normalized = val.map((v: number) => v - 1)
      let fixed = 0
      for (let i = 0; i < normalized.length; i++) if (normalized[i] === i) { fixed = i; break }
      const refAngle = (2 * Math.PI * fixed) / 3 - Math.PI / 2
      return { axis: [Math.cos(refAngle), 0, Math.sin(refAngle)], angleRad: Math.PI, label: `绕 ${lineAngleDeg(refAngle)}° 轴翻转 180°` }
    }
    return { axis: [0, 1, 0], angleRad: 0, label: '' }
  }

  if (sym === 'A_{4}' && isPermutation(val, 4)) {
    const ct = getCycleType(val)
    if (ct !== '3' && ct !== '2-2') return FALLBACK
    const { axis, angleRad } = rotationAxisAngle(rotationFromPermutation(TETRA_VERTICES, val))
    return { axis, angleRad, label: formatLabel(sym, ct, angleRad) }
  }

  if (sym === 'S_{4}' && isPermutation(val, 4)) {
    const ct = getCycleType(val)
    if (!LABELS['S_{4}'][ct]) return FALLBACK
    // S₄ ≅ 立方体旋转群；其 4 条体对角线方向 = 正四面体顶点，故沿用同一点模型
    const { axis, angleRad } = rotationAxisAngle(rotationFromPermutation(TETRA_VERTICES, val))
    return { axis, angleRad, label: formatLabel(sym, ct, angleRad) }
  }

  if (sym === 'A_{5}' && val.length === 5) {
    const R = getA5Rotations().get(val.join(','))
    if (!R) return FALLBACK
    const { axis, angleRad } = rotationAxisAngle(R)
    const ct = getCycleType(val)
    return { axis, angleRad, label: formatLabel(sym, ct, angleRad) }
  }

  return null
}

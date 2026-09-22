import type { Group } from '../../types'
import { fibonacciSphere, type Vec3 } from './shared'

/**
 * S₄ 星形对换生成集 {(12),(13),(14)} 的凯莱图在环面上的**全六边形镶嵌**布局。
 *
 * 数学事实（本次实测确立，见 .workbuddy/memory/2026-09-21.md）：
 * - 该凯莱图（= 互连网络里的「星图」ST₄：24 顶点、36 边、3 正则、girth 6、直径 4）
 *   存在**全六边形**环面嵌入：12 个面 = 三个 S₃ 子群（分别固定 4 / 3 / 2）的 12 个右陪集，
 *   每顶点恰属 3 面、每边恰属 2 面 ⇒ χ = 24 − 36 + 12 = 0（环面）。
 *   穷举 2²⁴ 个旋转系统后只有 2 个解（互为镜像）⇒ 该嵌入唯一。
 * - 周期格是 **60° 菱形** ⟨(3√3,3),(0,6)⟩（两向量等长 6）。S₄ **不存在矩形（无剪切）基本域**
 *   （水平周期只能是 6√3·k、竖直只能是 6m，凑指标 12 需 (k,m)=(6,1) 而 (0,3)∉Λ），
 *   所以"S4 的环面粘合必然斜着绕"，六边形在环面上呈仿射正六边形。
 *
 * 因此本模块**不能**沿用"6 六边形 × 2 行"那类无剪切镶嵌的坐标（那张图与 S₄ 星图不同构：
 * 它有 24 个四环、girth 4，而星图 girth 6），平面坐标表由「面 → 有向边赋向（Z6）→
 * BFS 展开 → 取周期代表」推导而来，这里按 GE 元素顺序（与 polyhedraVerts 同序）落表。
 *
 * 与乘法方向的约定：坐标按**右乘**（`group.multiply(g, s)`，场景默认 multiplyType='right'）
 * 的凯莱边对齐。左乘给的是另一套边（= 右乘边集在元素取逆下的像，见 torusHex.test.ts），
 * 与既有那些多面体形状同款限制（它们的坐标也只按右乘摆）。
 */

/** 平面周期格（笛卡尔；两边长 6、夹角 60°） */
export const TORUS_HEX_B1: readonly [number, number] = [3 * Math.sqrt(3), 3]
export const TORUS_HEX_B2: readonly [number, number] = [0, 6]

/** 星形对换生成元（一行记法，与 core 的置换群 id 一致） */
export const TORUS_HEX_STAR_GENERATORS: readonly string[] = ['2,1,3,4', '3,2,1,4', '4,2,3,1']

/** GE（Group Explorer）元素顺序：polyhedraVerts.placeS4Elements 用的同一张表 */
const GE_VALUES: readonly (readonly number[])[] = [
  [0, 1, 2, 3], [0, 3, 1, 2], [0, 2, 3, 1],
  [1, 0, 2, 3], [1, 3, 0, 2], [1, 2, 3, 0],
  [3, 0, 1, 2], [3, 2, 0, 1], [3, 1, 2, 0],
  [3, 1, 0, 2], [3, 2, 1, 0], [3, 0, 2, 1],
  [2, 0, 3, 1], [2, 1, 0, 3], [2, 3, 1, 0],
  [2, 1, 3, 0], [2, 0, 1, 3], [2, 3, 0, 1],
  [1, 2, 0, 3], [1, 3, 2, 0], [1, 0, 3, 2],
  [0, 2, 1, 3], [0, 3, 2, 1], [0, 1, 3, 2],
]

/** 24 个平面坐标（GE 顺序；点之间可差一个周期格向量，取环面点时按 mod Λ 归一） */
const S4_PLANAR_GE: readonly (readonly [number, number])[] = [
  [0, 0], [3.464102, 0], [1.732051, 3], [0.866025, 0.5],
  [-0.866025, -2.5], [-2.598076, 0.5], [2.598076, 0.5], [0.866025, -2.5],
  [-0.866025, 0.5], [-0.866025, -1.5], [2.598076, -1.5], [0.866025, 1.5],
  [1.732051, 2], [0, -1], [-1.732051, 2], [-1.732051, 0],
  [1.732051, 0], [0, 3], [0.866025, -1.5], [-0.866025, 1.5],
  [2.598076, 1.5], [1.732051, -1], [0, 2], [-1.732051, -1],
]

/**
 * 管截面形状。**大圆半径 / 管轴向半轴**比 1.5；**管径向半轴 / 轴向半轴** = 0.6（径向压扁）。
 *
 * 为什么压扁：环面内圈周长天然小于外圈（ρ 从 R−a 到 R+a），节点在参数平面上是均匀的
 * （4 个/纬线 × 6 条纬线），所以切向间距 ∝ ρ ⇒ 内圈密、外圈疏。压扁只动 a（径向半径，
 * 决定 ρ 的变化幅度）而不动 b（轴向半轴，决定沿管方向的间距）⇒ **密度差从 1:5 降到 1:2.3，
 * 同时六边形边长一个都不被拉伸**；代价是管截面从正圆变成椭圆（外形更像"厚贝果"，
 * 孔洞反而更清楚）。想更接近正圆就调大 FLATTEN，想更均匀就调小（0.5 时内/外 = 1:2）。
 */
const BIG_OVER_AXIAL = 1.5
const RADIAL_FLATTEN = 0.6

/** 平面坐标 → (α, β)（周期格坐标，落在 [0,1)） */
function toAlphaBeta(x: number, y: number): [number, number] {
  const det = TORUS_HEX_B1[0] * TORUS_HEX_B2[1] - TORUS_HEX_B1[1] * TORUS_HEX_B2[0]
  const a = (x * TORUS_HEX_B2[1] - y * TORUS_HEX_B2[0]) / det
  const b = (TORUS_HEX_B1[0] * y - TORUS_HEX_B1[1] * x) / det
  return [((a % 1) + 1) % 1, ((b % 1) + 1) % 1]
}

/** 环面上两点间的最短平面位移（mod Λ） */
export function torusHexMinDelta(
  from: readonly [number, number],
  to: readonly [number, number],
): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  let best: [number, number] = [dx, dy]
  let bestLen = Infinity
  for (let m = -2; m <= 2; m++) {
    for (let n = -2; n <= 2; n++) {
      const x = dx - m * TORUS_HEX_B1[0] - n * TORUS_HEX_B2[0]
      const y = dy - m * TORUS_HEX_B1[1] - n * TORUS_HEX_B2[1]
      const len = Math.hypot(x, y)
      if (len < bestLen) {
        bestLen = len
        best = [x, y]
      }
    }
  }
  return best
}

export interface TorusHexGeometry {
  /** 大圆半径（环面中心线到轴的距离） */
  bigR: number
  /** 管截面径向半轴（决定内/外半径 = bigR ∓ tubeRadial） */
  tubeRadial: number
  /** 管截面轴向半轴（决定沿管方向的间距） */
  tubeAxial: number
  /** 元素 id → 平面坐标（GE 表按群元素落位后的结果） */
  planar: Map<string, readonly [number, number]>
  /** 12 个六边形面：每个是 6 个元素 id 的环序（相邻两两是凯莱边） */
  hexagons: string[][]
  /** 元素 id → 所属六边形下标（恰 3 个） */
  hexagonsOf: Map<string, number[]>
  /** 平面坐标 → 环面曲面点（off = 沿法线抬升量） */
  surfacePoint: (x: number, y: number, off?: number) => Vec3
  /** (α,β) 周期格参数 → 曲面点（扫整片环面壳时用，避免自己反解平面坐标） */
  surfacePointAB: (alpha: number, beta: number, off?: number) => Vec3
  /** 平面坐标 → 曲面单位外法线（面片着色用，有闭式解不需求导） */
  surfaceNormal: (x: number, y: number) => Vec3
}

/**
 * 结构检测 + 平面坐标落位：要求 24 阶、GE 表 24 个 id 全在群中、
 * 三个星形对换都在群中、且每个 Cayley 边在环面上都是单位步长（mod Λ）。
 * 任一不满足 → null（调用方回退 fibonacci 球）。
 */
export function torusHexPlanarCoords(group: Group): Map<string, readonly [number, number]> | null {
  if (group.order !== 24) return null
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const planar = new Map<string, readonly [number, number]>()
  for (let i = 0; i < GE_VALUES.length; i++) {
    const id = GE_VALUES[i].map(v => v + 1).join(',')
    if (!byId.has(id)) return null
    planar.set(id, S4_PLANAR_GE[i])
  }
  const gens = TORUS_HEX_STAR_GENERATORS.map(id => byId.get(id))
  if (gens.some(g => !g)) return null
  // 结构校验：每个元素 × 每个星形对换 → 环面上的单位步长
  for (const el of group.elements) {
    const p = planar.get(el.id)!
    for (const g of gens) {
      const target = group.multiply(el, g!)
      const q = planar.get(target.id)
      if (!q) return null
      const d = torusHexMinDelta(p, q)
      if (Math.abs(Math.hypot(d[0], d[1]) - 1) > 1e-4) return null
    }
  }
  return planar
}

/** 12 个六边形面（元素 id 环序）：三个星形对换两两生成的 S₃ 子群的右陪集 */
export function torusHexHexagons(group: Group): string[][] | null {
  const planar = torusHexPlanarCoords(group)
  if (!planar) return null
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const out: string[][] = []
  const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]]
  for (const [i, j] of pairs) {
    const a = byId.get(TORUS_HEX_STAR_GENERATORS[i])!
    const b = byId.get(TORUS_HEX_STAR_GENERATORS[j])!
    const visited = new Set<string>()
    for (const seed of group.elements) {
      if (visited.has(seed.id)) continue
      const cycle: string[] = []
      let cur = seed
      for (let t = 0; t < 6; t++) {
        cycle.push(cur.id)
        cur = group.multiply(cur, t % 2 === 0 ? a : b)
      }
      if (cur.id !== seed.id || new Set(cycle).size !== 6) return null
      cycle.forEach(id => visited.add(id))
      out.push(cycle)
    }
  }
  if (out.length !== 12) return null
  // 稳定排序（持久化/配色一致）
  const orderOf = new Map(group.elements.map((e, i) => [e.id, i]))
  out.sort((x, y) => {
    const mx = Math.min(...x.map(id => orderOf.get(id) ?? 0))
    const my = Math.min(...y.map(id => orderOf.get(id) ?? 0))
    return mx - my
  })
  return out
}

/** 环面几何（布局 + 面 + 曲面映射），供 3D 场景画弧边与六边形面片 */
export function torusHexGeometry(group: Group, radius: number): TorusHexGeometry | null {
  const planar = torusHexPlanarCoords(group)
  const hexagons = torusHexHexagons(group)
  if (!planar || !hexagons) return null
  // 外形半径固定为 radius：bigR + tubeRadial = radius（内圈半径 = bigR − tubeRadial）
  const bigR = radius / (1 + RADIAL_FLATTEN / BIG_OVER_AXIAL)
  const tubeAxial = bigR / BIG_OVER_AXIAL
  const tubeRadial = RADIAL_FLATTEN * tubeAxial
  // 椭圆截面环面：p = ((R + a cos v) cos u, (R + a cos v) sin u, b sin v)
  // 椭圆截面法线：n ∝ (b cos v cos u, b cos v sin u, a sin v)（单位化）
  const normalAt = (u: number, v: number): Vec3 => {
    const cv = Math.cos(v)
    const nx = tubeAxial * cv * Math.cos(u)
    const ny = tubeAxial * cv * Math.sin(u)
    const nz = tubeRadial * Math.sin(v)
    const len = Math.hypot(nx, ny, nz) || 1
    return [nx / len, ny / len, nz / len]
  }
  /** (α,β) 参数（周期格坐标）→ 曲面点；画整片环面壳/网格时用它 */
  const surfacePointAB = (alpha: number, beta: number, off = 0): Vec3 => {
    const u = 2 * Math.PI * alpha
    const v = 2 * Math.PI * beta
    const w = bigR + tubeRadial * Math.cos(v)
    const [nx, ny, nz] = normalAt(u, v)
    return [
      w * Math.cos(u) + nx * off,
      w * Math.sin(u) + ny * off,
      tubeAxial * Math.sin(v) + nz * off,
    ]
  }
  /** 平面坐标 → 曲面点（节点/弧边/面片用；同一环面点的不同周期代表给出同一点） */
  const surfacePoint = (x: number, y: number, off = 0): Vec3 => {
    const [alpha, beta] = toAlphaBeta(x, y)
    return surfacePointAB(alpha, beta, off)
  }
  const surfaceNormal = (x: number, y: number): Vec3 => {
    const [alpha, beta] = toAlphaBeta(x, y)
    return normalAt(2 * Math.PI * alpha, 2 * Math.PI * beta)
  }
  const hexagonsOf = new Map<string, number[]>()
  hexagons.forEach((hex, hi) => {
    for (const id of hex) {
      const list = hexagonsOf.get(id)
      if (list) list.push(hi)
      else hexagonsOf.set(id, [hi])
    }
  })
  return {
    bigR, tubeRadial, tubeAxial, planar, hexagons, hexagonsOf,
    surfacePoint, surfaceNormal, surfacePointAB,
  }
}

/**
 * S₄ 星形对换凯莱图的环面全六边形镶嵌（24 节点落在环面曲面上）。
 * 结构不匹配返回 null。
 */
export function torusHexLayout3D(group: Group, radius: number): Vec3[] | null {
  const geom = torusHexGeometry(group, radius)
  if (!geom) return null
  const positions: Vec3[] = []
  for (const el of group.elements) {
    const p = geom.planar.get(el.id)
    if (!p) {
      positions.push(fibonacciSphere(group.order, radius)[positions.length])
      continue
    }
    positions.push(geom.surfacePoint(p[0], p[1], 0))
  }
  return positions
}

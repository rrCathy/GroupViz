import type { Group, GroupElement, CayleyAction } from '../../types'
import { COLOR_PALETTE } from '../../types'
import type { Vec3 } from './shared'
import { truncatedOctahedron3Layout3D } from './archimedeanLayouts3D'

/**
 * 字长球（word-length sphere）：相邻对换生成集的**字长分层**布局。
 *
 * 目标群 S₄ / S₅，字长分布硬编码（HARDCODED_LAYERS，与 BFS 字长分布核对）：
 *  - S₄ = [1,3,5,6,5,3,1]（7 层）、S₅ = [1,4,9,15,20,22,20,15,9,4,1]（11 层）。
 *
 * **S₄（平面图 → 分层球面重排）**：借截角八面体骨架（= 相邻对换凯莱图）顶点的
 * 周向角保住边连接的局部性（层间边不交叉），把顶点重排到字长层：字长 k 的顶点
 * 统一放高度 y_k = R·cos(πk/K)、半径 ρ_k = R·sin(πk/K) 的纬圈。额外把两极
 * （e 与 w₀）所在的第一层 / 第 K−1 层的周向角**重新均匀成 120°**——极点的三条
 * 出边构成等角星形（三臂 120° 展开），同时保持各点所在的纬圈。
 *
 * **S₅（非平面图 → 球形分层 + 边距松弛）**：11 个字长层 = 11 个纬度层，层内点
 * 落在球截面圆盘内；相邻层之间由凯莱边相连（相邻对换使字长恰 ±1 ⇒ 240 条边
 * 全部跨层、层内无边）。
 *
 *  1. **纬度层**：y_l = R·cos(πl/K)（e 与 w₀ 在两极），第 l 层球截面半径
 *     r_l = R·sin(πl/K)。小层（n ≤ 6，即层 1 / 层 9 的 4 点）直接贴球面圆环；
 *     大层按下面的半径规则铺满圆盘。
 *  2. **正根胞格向量初值**（本布局的核心）：把 A₄ 的 10 个正根（= 10 个值对）
 *     手工投影成 2D 向量 CELL_VECTORS——四个单根 (1 2)(2 3)(3 4)(4 5) 恰好落在
 *     +x / +y / −x / −y 四个方向（**四个生成元 = 四个花瓣方向**），其余六个正根
 *     落在中间方位且模长更小。每个置换的投影 = 其**逆序集**上这些向量的和
 *     （反转胞格向量求和）。于是父节点与子节点（相差一次相邻对换）的投影方向
 *     天然相邻 ⇒ 边近似沿"经线"从上往下流动，四个生成元各占一个方位瓣。
 *     层内半径：大层按投影模长排名取 r_l·√((rank+0.5)/n)——盘心、盘中、盘缘
 *     都有点（实心球，不是球壳）。
 *  3. **边距松弛**：S₅ 相邻对换凯莱图**非平面**（二部图要求面数 F ≤ E/2 = 120，
 *     而欧拉公式 V−E+F=2 要求 F = 122，矛盾），固定纬度平面 + 直线边必然有少量
 *     视觉交叠。松弛把交叠摊开：
 *       - 节点-节点斥力（同层，作用半径 ≈ 1.9·r_l/√n，顶到球面边界为止）；
 *       - **边-边斥力**（AABB 预筛 + 每条边取 3 个采样点做线段-线段最近距离），
 *         把"看起来交叉"的边在 3D 中真正错开；
 *       - 角度弱锚定（拉回初值方位，保持偶极场结构）+ y 弹簧（拉回名义纬度）；
 *       - 硬约束：y 限于纬度带内（±0.32×层间距），水平半径 ≤ min(r_l, √(R²−y²))；
 *       - 收尾把半径 > 0.9·r_l 的节点**精确吸附到球面**（外圈贴壳、内部保留）。
 *
 * 注：4 个生成元在图上并不等价（Coxeter 图 A₄ 的自同构只有反转 i ↔ 5−i），
 * 按「e 的生成元子树」分瓣规模为 61/40/15/4；本布局用四个方位瓣表达"四个生成
 * 元各推一个方向"，是**投影构造**而非图的对称群。
 *
 * 两级均配字长色阶（`wordLengthColor`），同层同色直接读出分层；
 * 不添加任何辅助线（凯莱图中多余线条会被读成边）。
 *
 * 生成集检测纯群论：全体元素 value 为 1..n 的 one-line 置换、n ≥ 4、
 * n−1 个相邻对换齐备；任一不符返回 null（调用方回退 fibonacci 球）。
 */

/** 硬编码字长层配置（相邻对换生成集下的字长分布；Sₙ 的 [n]_q! 系数） */
const HARDCODED_LAYERS: Record<number, number[]> = {
  4: [1, 3, 5, 6, 5, 3, 1],
  5: [1, 4, 9, 15, 20, 22, 20, 15, 9, 4, 1],
}

/**
 * S₅ 球半径放大系数。相机按外接球自适应取景（球恒占满视口），
 * 故该系数只决定「节点相对球的大小」。
 */
const SPHERE_RADIUS_SCALE = 3
/** S₄ 球半径放大系数 */
const S4_RADIUS_SCALE = 1.55
const TAU = 2 * Math.PI

/** 极坐标 → 2D 向量（度、模长） */
function polarVec(deg: number, len: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [len * Math.cos(a), len * Math.sin(a)]
}

/**
 * A₄ 的 10 个正根在 2D 上的手工投影（键为值对 "a b"，a < b）。
 *  - 四个单根（相邻值对）落在 +x / +y / −x / −y 四个方向 ⇒ 四瓣；
 *  - 其余六个正根落在对角/中间方位，模长略小。
 * 一个置换的投影 = 其逆序集中所有正根向量之和（见 `sphericalLayeredLayout`）。
 */
const CELL_VECTORS: Record<string, [number, number]> = {
  '1 2': [1.0, 0.0],
  '2 3': [0.0, 1.03],
  '3 4': [-0.97, 0.0],
  '4 5': [0.0, -1.01],
  '1 3': polarVec(45, 0.9),
  '2 4': polarVec(135, 0.88),
  '3 5': polarVec(225, 0.92),
  '1 4': polarVec(315, 0.72),
  '2 5': polarVec(200, 0.75),
  '1 5': polarVec(340, 0.65),
}

/** 球形分层布局的松弛参数 */
const RELAX_ITERS = 320
/** 边-边近距作用距离 d0 */
const EDGE_CLEARANCE = 1.05
/** 纬度带半高 = BAND_RATIO × 层间距 */
const BAND_RATIO = 0.32
/** 收尾吸附：水平半径 > SNAP_RATIO·r_l 的节点精确贴球面 */
const SNAP_RATIO = 0.9

/** 检测群是否为 one-line 置换群并返回全部相邻对换元素；否则 null。 */
export function findAdjacentTranspositionGenerators(group: Group): GroupElement[] | null {
  const els = group.elements
  if (els.length < 4) return null
  const n = els[0].value.length
  if (n < 4) return null
  const isPerm = (v: number[]) =>
    v.length === n && new Set(v).size === n && v.every(x => Number.isInteger(x) && x >= 1 && x <= n)
  if (!els.every(e => isPerm(e.value))) return null

  const result: GroupElement[] = []
  for (let i = 0; i < n - 1; i++) {
    const perm = Array.from({ length: n }, (_, k) => k + 1)
    ;[perm[i], perm[i + 1]] = [perm[i + 1], perm[i]]
    const el = els.find(e => e.value.every((v, j) => v === perm[j]))
    if (!el) return null
    result.push(el)
  }
  return result
}

/**
 * 字长球的**标准作用边** = 相邻对换生成集（S₄ 3 条 / S₅ 4 条），按 `COLOR_PALETTE`
 * 顺序配色。引擎消费者在 `layout3D: 'wordLengthSphere'` 时应把它传给视图的 `actions`
 * ——视图缺省用群的抽象生成元（Sₙ 自动生成的生成元未必是相邻对换），字长分层会失效。
 *
 * 判定纯结构（不查群符号）：非「n = 4/5 的 one-line 置换群且 n−1 个相邻对换齐备」
 * 一律返回 null，与 `wordLengthSphereLayout3D` 的可用性一致。
 */
export function wordLengthSphereActions(group: Group): CayleyAction[] | null {
  const n = group.elements[0]?.value.length ?? 0
  if (n !== 4 && n !== 5) return null
  const gens = findAdjacentTranspositionGenerators(group)
  if (!gens) return null
  return gens.map((el, i) => ({
    elementId: el.id,
    enabled: true,
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }))
}

/** 字长层数据（BFS 字长 + 逐层元素 + 最长元 w₀） */
interface WordLayers {
  layers: GroupElement[][]
  len: Map<string, number>
  w0: GroupElement
  K: number
}

/** BFS：按字长分层；覆盖不全返回 null。 */
function buildWordLayers(group: Group, gens: GroupElement[]): WordLayers | null {
  const len = new Map<string, number>([[group.identity.id, 0]])
  let frontier: GroupElement[] = [group.identity]
  const layers: GroupElement[][] = [[group.identity]]
  while (frontier.length > 0) {
    const next: GroupElement[] = []
    for (const cur of frontier) {
      for (const g of gens) {
        const nbr = group.multiply(cur, g)
        if (!len.has(nbr.id)) {
          len.set(nbr.id, len.get(cur.id)! + 1)
          next.push(nbr)
        }
      }
    }
    if (next.length > 0) layers.push(next)
    frontier = next
  }
  if (len.size !== group.order) return null
  const K = layers.length - 1
  return { layers, len, w0: layers[K][0], K }
}

/** 角度差（归一到 (−π, π]） */
function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU
  if (d <= -Math.PI) d += TAU
  if (d > Math.PI) d -= TAU
  return d
}

/**
 * S₄：分层球面重排——层内保留骨架原始的周向角（保住边连接的局部性 ⇒
 * 交叉最少），半径统一到该字长层的球纬度半径 ρ_k = R·sin(πk/K)、
 * 高度 y_k = R·cos(πk/K)：球状轮廓 + 字长分层。
 * 极点层（k=1 与 k=K−1，各 3 点）的周向角再均匀成 120° 星形：
 * 整体相位取「新角与旧角的圆周距离之和最小」者（保持循环序 ⇒ 挪动最小）。
 */
function layeredRingLayout(group: Group, len: Map<string, number>, K: number, radius: number): Vec3[] | null {
  const base = truncatedOctahedron3Layout3D(group, 5)
  if (!base || base.length !== group.order || base.some(p => !p)) return null
  const pts = base as Vec3[]
  const R = radius * S4_RADIUS_SCALE
  const positions: Vec3[] = new Array(group.order)

  for (let i = 0; i < group.order; i++) {
    const k = len.get(group.elements[i].id)!
    const y = R * Math.cos((Math.PI * k) / K)
    const rho = R * Math.sin((Math.PI * k) / K)
    const hLen = Math.hypot(pts[i][0], pts[i][2])
    if (rho < 1e-9 || hLen < 1e-9) {
      positions[i] = [0, y, 0]
      continue
    }
    positions[i] = [(rho * pts[i][0]) / hLen, y, (rho * pts[i][2]) / hLen]
  }

  // 极点层三方对称校正：第一层与第 K−1 层（e 与 w₀ 的邻居）周向角均匀 120°
  for (const kk of [1, K - 1]) {
    if (kk < 1 || kk > K - 1) continue
    const layer: { i: number; a: number }[] = []
    for (let i = 0; i < group.order; i++) {
      if (len.get(group.elements[i].id) !== kk) continue
      const rho = Math.hypot(positions[i][0], positions[i][2])
      if (rho < 1e-9) continue
      layer.push({ i, a: Math.atan2(positions[i][2], positions[i][0]) })
    }
    if (layer.length !== 3) continue
    layer.sort((x, y) => x.a - y.a)
    let bestOff = 0
    let bestCost = Infinity
    for (let s = 0; s < 120; s++) {
      const off = (TAU * s) / 120
      let cost = 0
      for (let j = 0; j < 3; j++) cost += Math.abs(angDiff(off + (TAU * j) / 3, layer[j].a))
      if (cost < bestCost) {
        bestCost = cost
        bestOff = off
      }
    }
    const rho = Math.hypot(positions[layer[0].i][0], positions[layer[0].i][2])
    const y = positions[layer[0].i][1]
    for (let j = 0; j < 3; j++) {
      const lon = bestOff + (TAU * j) / 3
      positions[layer[j].i] = [rho * Math.cos(lon), y, rho * Math.sin(lon)]
    }
  }

  // 整球绕 y 轴刚性旋转（不动相对结构）：把极点星形相位转到默认相机正对角度
  const rot = Math.PI / 6
  const cosR = Math.cos(rot)
  const sinR = Math.sin(rot)
  return positions.map(p => [p[0] * cosR + p[2] * sinR, p[1], -p[0] * sinR + p[2] * cosR] as Vec3)
}

/**
 * S₅：球形分层布局（纬度层 + 正根胞格向量初值 + 边距松弛）。
 * 设计说明见文件头；返回与 group.elements 同序的位置。
 */
function sphericalLayeredLayout(
  group: Group,
  gens: GroupElement[],
  data: WordLayers,
  radius: number,
): Vec3[] | null {
  const { layers, K } = data
  if (K !== 10 || layers.length !== K + 1) return null
  const M = group.order
  const N = gens.length + 1
  const NL = K + 1
  const R = radius * SPHERE_RADIUS_SCALE
  const idx = new Map(group.elements.map((el, i) => [el.id, i]))

  // 层 → 元素下标（BFS 顺序，确定性）
  const layerIdx: number[][] = layers.map(layer => layer.map(e => idx.get(e.id)!))
  const layerOf = new Int32Array(M)
  for (let l = 0; l < NL; l++) {
    for (const i of layerIdx[l]) layerOf[i] = l
  }

  const layerY = (l: number) => R * Math.cos((Math.PI * l) / (NL - 1))
  const rMaxL = new Float64Array(NL)
  for (let l = 0; l < NL; l++) rMaxL[l] = R * Math.sin((Math.PI * l) / (NL - 1))

  // ── 边（低层 → 高层；每条凯莱边恰好出现一次）──
  const edges: [number, number][] = []
  for (let i = 0; i < M; i++) {
    for (const g of gens) {
      const j = idx.get(group.multiply(group.elements[i], g).id)
      if (j === undefined) return null
      if (layerOf[j] === layerOf[i] + 1) edges.push([i, j])
    }
  }
  const E = edges.length
  if (E === 0) return null

  // ── 初值：每个置换的 2D 投影 = 逆序集上正根胞格向量之和 ──
  const sumX = new Float64Array(M)
  const sumZ = new Float64Array(M)
  const posOf = new Int32Array(N + 1)
  for (let i = 0; i < M; i++) {
    const v = group.elements[i].value
    for (let k = 0; k < v.length; k++) posOf[v[k]] = k
    for (let a = 1; a <= N; a++) {
      for (let b = a + 1; b <= N; b++) {
        if (posOf[a] > posOf[b]) {
          const cell = CELL_VECTORS[a + ' ' + b]
          sumX[i] += cell[0]
          sumZ[i] += cell[1]
        }
      }
    }
  }

  const px = new Float64Array(M)
  const py = new Float64Array(M)
  const pz = new Float64Array(M)
  for (let l = 0; l < NL; l++) {
    const arr = layerIdx[l]
    const n = arr.length
    const rMax = rMaxL[l]
    const y = layerY(l)
    if (n === 1) {
      // 极点：e 与 w₀
      const i = arr[0]
      px[i] = 0
      py[i] = y
      pz[i] = 0
      continue
    }
    if (n <= 6) {
      // 小层（层 1 / 层 9 的 4 点）：直接贴球面圆环
      for (const i of arr) {
        const a = Math.atan2(sumZ[i], sumX[i])
        px[i] = rMax * Math.cos(a)
        py[i] = y
        pz[i] = rMax * Math.sin(a)
      }
      continue
    }
    // 大层：按投影模长排名铺满圆盘（盘心 → 盘缘）
    const info = arr.map(i => ({ i, m: Math.hypot(sumX[i], sumZ[i]), a: Math.atan2(sumZ[i], sumX[i]) }))
    const rank = new Map<number, number>()
    ;[...info].sort((u, v) => u.m - v.m).forEach((u, j) => rank.set(u.i, j))
    for (const u of info) {
      const rr = rMax * Math.sqrt((rank.get(u.i)! + 0.5) / n)
      px[u.i] = rr * Math.cos(u.a)
      py[u.i] = y
      pz[u.i] = rr * Math.sin(u.a)
    }
  }

  // ── 边距松弛 ──
  const initA = new Float64Array(M)
  for (let i = 0; i < M; i++) initA[i] = Math.atan2(pz[i], px[i])
  const bandHalf = new Float64Array(NL)
  for (let l = 0; l < NL; l++) {
    const up = l < NL - 1 ? Math.abs(layerY(l) - layerY(l + 1)) : Infinity
    const dn = l > 0 ? Math.abs(layerY(l) - layerY(l - 1)) : Infinity
    bandHalf[l] = BAND_RATIO * Math.min(up, dn)
  }
  const FX = new Float64Array(M)
  const FY = new Float64Array(M)
  const FZ = new Float64Array(M)
  const bmin = new Float64Array(E * 3)
  const bmax = new Float64Array(E * 3)
  const TS = [0.2, 0.5, 0.8]

  for (let it = 0; it < RELAX_ITERS; it++) {
    const t = it / RELAX_ITERS
    FX.fill(0)
    FY.fill(0)
    FZ.fill(0)
    const wE = 0.55 * (1 - 0.7 * t)
    const wN = 0.5 * (1 - 0.7 * t)

    // 1) 节点-节点斥力（同层，3D）：让节点铺开、外圈顶到球面边界
    for (let l = 1; l < NL - 1; l++) {
      const arr = layerIdx[l]
      const n = arr.length
      const s = Math.min((1.9 * rMaxL[l]) / Math.sqrt(n), 3.2)
      for (let u = 0; u < n; u++) {
        for (let v = u + 1; v < n; v++) {
          const i = arr[u]
          const j = arr[v]
          let dx = px[i] - px[j]
          let dy = py[i] - py[j]
          let dz = pz[i] - pz[j]
          let d = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (d < 1e-6) {
            dx = 0.01
            dy = 0.01
            dz = 0.01
            d = 0.0173
          }
          if (d < s) {
            const m = (wN * (1 - d / s)) / d
            FX[i] += dx * m
            FY[i] += dy * m
            FZ[i] += dz * m
            FX[j] -= dx * m
            FY[j] -= dy * m
            FZ[j] -= dz * m
          }
        }
      }
    }

    // 2) 边-边斥力：AABB 预筛选 + 采样点近距离排斥（把交叉的边在 3D 中错开）
    for (let k = 0; k < E; k++) {
      const a = edges[k][0]
      const b = edges[k][1]
      bmin[k * 3] = Math.min(px[a], px[b]) - EDGE_CLEARANCE
      bmax[k * 3] = Math.max(px[a], px[b]) + EDGE_CLEARANCE
      bmin[k * 3 + 1] = Math.min(py[a], py[b]) - EDGE_CLEARANCE
      bmax[k * 3 + 1] = Math.max(py[a], py[b]) + EDGE_CLEARANCE
      bmin[k * 3 + 2] = Math.min(pz[a], pz[b]) - EDGE_CLEARANCE
      bmax[k * 3 + 2] = Math.max(pz[a], pz[b]) + EDGE_CLEARANCE
    }
    for (let k1 = 0; k1 < E; k1++) {
      for (let k2 = k1 + 1; k2 < E; k2++) {
        const o1 = k1 * 3
        const o2 = k2 * 3
        if (bmax[o1] < bmin[o2] || bmax[o2] < bmin[o1]) continue
        if (bmax[o1 + 1] < bmin[o2 + 1] || bmax[o2 + 1] < bmin[o1 + 1]) continue
        if (bmax[o1 + 2] < bmin[o2 + 2] || bmax[o2 + 2] < bmin[o1 + 2]) continue
        const A = edges[k1]
        const B = edges[k2]
        for (let q1 = 0; q1 < 3; q1++) {
          for (let q2 = 0; q2 < 3; q2++) {
            const t1 = TS[q1]
            const t2 = TS[q2]
            const p1x = px[A[0]] + (px[A[1]] - px[A[0]]) * t1
            const p1y = py[A[0]] + (py[A[1]] - py[A[0]]) * t1
            const p1z = pz[A[0]] + (pz[A[1]] - pz[A[0]]) * t1
            const p2x = px[B[0]] + (px[B[1]] - px[B[0]]) * t2
            const p2y = py[B[0]] + (py[B[1]] - py[B[0]]) * t2
            const p2z = pz[B[0]] + (pz[B[1]] - pz[B[0]]) * t2
            const dx = p1x - p2x
            const dy = p1y - p2y
            const dz = p1z - p2z
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
            if (d < 1e-6 || d >= EDGE_CLEARANCE) continue
            const m = (wE * (1 - d / EDGE_CLEARANCE)) / d
            const fx = dx * m
            const fy = dy * m
            const fz = dz * m
            FX[A[0]] += fx * (1 - t1)
            FY[A[0]] += fy * (1 - t1)
            FZ[A[0]] += fz * (1 - t1)
            FX[A[1]] += fx * t1
            FY[A[1]] += fy * t1
            FZ[A[1]] += fz * t1
            FX[B[0]] -= fx * (1 - t2)
            FY[B[0]] -= fy * (1 - t2)
            FZ[B[0]] -= fz * (1 - t2)
            FX[B[1]] -= fx * t2
            FY[B[1]] -= fy * t2
            FZ[B[1]] -= fz * t2
          }
        }
      }
    }

    // 3) 锚定 + 积分 + 硬约束
    const step = 0.55 * (1 - t) + 0.05
    for (let i = 0; i < M; i++) {
      const l = layerOf[i]
      if (l === 0 || l === NL - 1) {
        // 两极固定
        px[i] = 0
        py[i] = layerY(l)
        pz[i] = 0
        continue
      }
      let r = Math.hypot(px[i], pz[i])
      if (r > 0.25) {
        // 角度弱锚定：切向弹簧拉回初始方位（保持四瓣/偶极场结构）
        const a = Math.atan2(pz[i], px[i])
        const da = angDiff(initA[i], a)
        const ka = 0.14
        FX[i] += -Math.sin(a) * ka * da * r
        FZ[i] += Math.cos(a) * ka * da * r
      }
      FY[i] += 0.3 * (layerY(l) - py[i]) // y 弹簧：拉回名义纬度
      const fmag = Math.hypot(FX[i], FY[i], FZ[i])
      const sc = fmag > 1.1 ? 1.1 / fmag : 1
      px[i] += FX[i] * sc * step
      py[i] += FY[i] * sc * step
      pz[i] += FZ[i] * sc * step
      // 约束：y 限在纬度带内；水平半径限定在球内
      py[i] = Math.min(Math.max(py[i], layerY(l) - bandHalf[l]), layerY(l) + bandHalf[l])
      r = Math.hypot(px[i], pz[i])
      const rCap = Math.min(rMaxL[l], Math.sqrt(Math.max(R * R - py[i] * py[i], 0)))
      if (r > rCap && r > 1e-9) {
        const k = rCap / r
        px[i] *= k
        pz[i] *= k
      }
    }
  }

  // 收尾：把贴近边界的节点精确吸附到球面上（外圈贴壳、内部保留 ⇒ 实心球）
  for (let i = 0; i < M; i++) {
    const l = layerOf[i]
    if (l === 0 || l === NL - 1) continue
    const r = Math.hypot(px[i], pz[i])
    if (r > SNAP_RATIO * rMaxL[l] && r > 1e-9) {
      const rT = Math.sqrt(Math.max(R * R - py[i] * py[i], 0.04))
      const k = rT / r
      px[i] *= k
      pz[i] *= k
    }
  }

  const positions: Vec3[] = new Array(M)
  for (let i = 0; i < M; i++) positions[i] = [px[i], py[i], pz[i]]
  return positions
}

/**
 * 字长球布局主函数。
 * 返回与 group.elements 同序的位置数组；结构不满足时返回 null。
 */
export function wordLengthSphereLayout3D(group: Group, radius: number): Vec3[] | null {
  const gens = findAdjacentTranspositionGenerators(group)
  if (!gens) return null
  const n = gens.length + 1
  const layerCounts = HARDCODED_LAYERS[n]
  if (!layerCounts) return null

  const data = buildWordLayers(group, gens)
  if (!data) return null
  const K = layerCounts.length - 1
  if (data.K !== K) return null

  const counts = new Array(K + 1).fill(0)
  for (const el of group.elements) {
    const l = data.len.get(el.id)
    if (l === undefined) return null
    counts[l]++
  }
  for (let k = 0; k <= K; k++) if (counts[k] !== layerCounts[k]) return null

  return n === 4
    ? layeredRingLayout(group, data.len, K, radius)
    : sphericalLayeredLayout(group, gens, data, radius)
}

/** 元素的字长（相邻对换生成集 = one-line 置换的逆序数）；非置换元素返回 null。 */
export function wordLengthOf(el: GroupElement): number | null {
  const v = el.value
  const n = v.length
  if (n < 4 || !v.every(x => Number.isInteger(x) && x >= 1 && x <= n) || new Set(v).size !== n) return null
  let inv = 0
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (v[a] > v[b]) inv++
  return inv
}

/**
 * 字长球节点配色：字长色阶（北极 e 冷色 → 南极 w₀ 暖色），
 * 让「同层同色」直接读出字长分层；非目标群返回 null（调用方回退默认配色）。
 */
export function wordLengthColor(group: Group, el: GroupElement): string | null {
  const counts = HARDCODED_LAYERS[group.elements[0]?.value.length ?? 0]
  const k = wordLengthOf(el)
  if (!counts || k === null) return null
  const K = counts.length - 1
  const t = K === 0 ? 0 : k / K
  const hue = 205 + 125 * t // 205°（青蓝，字长 0）→ 330°（品红，字长 K）
  const light = 46 + 18 * Math.sin(Math.PI * t)
  return `hsl(${hue.toFixed(1)}, 68%, ${light.toFixed(1)}%)`
}

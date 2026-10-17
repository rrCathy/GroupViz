/**
 * SL(2,3) ≅ 二元四面体群 2T：四元数同构 + F₃ 矩阵嵌入（纯计算，无 three/R3F 依赖）。
 *
 * 注册表 SmallGroup(24,3)（GAP 表群，元素 value=[k]、id g{k}）的元素以**矩阵形式为显示
 * 别名**（label := smallmatrix TeX，词标签 stash 进 wordLabel），代数仍由 GAP 乘法表承担。
 * 本模块提供两张打表：
 *   - `sl23Quat(k)`：表索引 k → 四元数（BFS 配对一次算好，24×24 同态逐格验证）
 *   - `sl23MatrixLabel(k)`：表索引 k → 2×2 矩阵 TeX（经四元数经 F₃ 矩阵嵌入）
 *
 * 四元数用**整数四元组** (a,b,c,d) 表示 (a + bi + cj + dk)/2——2T 恰为
 * 8 个 (±2,0,0,0) 型 + 16 个 (±1,±1,±1,±1)，坐标全整数、乘法精确无浮点误差。
 *
 * 几何语义（全部固化进 `src/__tests__/sl23.test.ts`，原 `.tmp-sl23/verify.mjs`
 * 一次性脚本已删）：规范分解 q = cos ψ + sin ψ·û ⇒
 * 物体旋转 (û, 2ψ)、皮带扭转 τ = 2ψ；τ=360° ⇔ q=−1（皮带戏法核心态）。
 */
import { multiplyGL2, detGL2, matrixLabel, type GL2Matrix } from './GeneralLinearGroup'
import { SMALL_GROUP_DATA } from './smallGroupData'

/** 四元数 (a + bi + cj + dk)/2 的整数表示（2T 内四坐标同奇偶）。 */
export type Quat = [number, number, number, number]

const ONE: Quat = [2, 0, 0, 0]

/** 四元数乘法（整数精确：2T 内乘积分子均为偶数，除 2 回到 /2 表示）。
 *  出口逐分量归一 -0：IEEE 下 `(-k)*0` 产 -0，join/字符串自检会掩盖它，
 *  但 toEqual 断言与显示路径不会（曾致 sl23 测试假失败一轮）。 */
function qmul(p: Quat, q: Quat): Quat {
  const [a1, b1, c1, d1] = p
  const [a2, b2, c2, d2] = q
  const nz = (v: number): number => (v === 0 ? 0 : v)
  return [
    nz((a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2) / 2),
    nz((a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2) / 2),
    nz((a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2) / 2),
    nz((a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2) / 2),
  ]
}

/** 2T 的 24 个元素（固定枚举序：8 个 (±2,0,0,0) 型 + 16 个 (±1,±1,±1,±1)）。 */
const QUATS: Quat[] = (() => {
  const out: Quat[] = []
  for (let axis = 0; axis < 4; axis++) {
    for (const s of [2, -2]) {
      const q: Quat = [0, 0, 0, 0]
      q[axis] = s
      out.push(q)
    }
  }
  for (let mask = 0; mask < 16; mask++) {
    out.push([
      mask & 1 ? -1 : 1,
      mask & 2 ? -1 : 1,
      mask & 4 ? -1 : 1,
      mask & 8 ? -1 : 1,
    ])
  }
  return out
})()

const qkey = (q: Quat): string => q.join(',')

function quatOrder(q: Quat): number {
  let cur = ONE
  for (let n = 1; n <= 24; n++) {
    cur = qmul(cur, q)
    if (cur.join(',') === qkey(ONE)) return n
  }
  return -1
}

/** 矩阵嵌入：ı ↦ [[0,1],[2,0]]、ȷ ↦ [[1,1],[1,2]]（手验 j²=−I；k=ij 测试锁定）。 */
const MAT_I: GL2Matrix = [0, 1, 2, 0]
const MAT_J: GL2Matrix = [1, 1, 1, 2]
const MAT_K: GL2Matrix = multiplyGL2(MAT_I, MAT_J, 3)

const F3 = 3
function addMul(m: GL2Matrix, c: number, e: GL2Matrix): GL2Matrix {
  return [
    (m[0] + c * e[0]) % F3,
    (m[1] + c * e[1]) % F3,
    (m[2] + c * e[2]) % F3,
    (m[3] + c * e[3]) % F3,
  ]
}

/** 四元数 → SL(2,3) 矩阵：M = 2·(a·I + b·Mi + c·Mj + d·Mk) mod 3（1/2 ≡ 2 mod 3）。
 *  出口**归一到 [0,3)**：JS `%` 保号（`(-1)%3 = -1`），而 matrixLabel 直接插值、
 *  multiplyGL2 的键查找与 GL(2,p) 全链路都假定规范入口——不归一会让标签显示
 *  `-1/-2` 且矩阵乘法键失配（与 GL(2,3) 出厂矩阵标签同一口径）。 */
function quatToMatrix(q: Quat): GL2Matrix {
  let m: GL2Matrix = [0, 0, 0, 0]
  const coeffs = [q[0], q[1], q[2], q[3]]
  const bases = [
    [1, 0, 0, 1] as GL2Matrix,
    MAT_I,
    MAT_J,
    MAT_K,
  ]
  for (let i = 0; i < 4; i++) m = addMul(m, coeffs[i], bases[i])
  // ×2（即 1/2 的 F3 逆）后归一到 [0,3)
  const canon = (v: number): number => ((v % F3) + F3) % F3
  return [canon(2 * m[0]), canon(2 * m[1]), canon(2 * m[2]), canon(2 * m[3])]
}

/** 表索引 → 四元数的同构打表（惰性算一次；确定性 BFS 配对 + 24×24 同态验证）。 */
let _iso: Quat[] | null = null

function buildIsomorphism(): Quat[] {
  const rec = SMALL_GROUP_DATA.find(r => r.n === 24 && r.i === 3)
  if (!rec) throw new Error('sl23: SmallGroup(24,3) data missing')
  const table = rec.table
  const n = 24
  // GAP gens 是 1-based 元素位置
  const genIdx = rec.gens.map(g => g - 1)
  const tableOrder = (k: number): number => {
    // 从恒等元出发连乘 k：第 cnt 步得到 k^cnt，首次回到恒等即阶
    let cur = 0
    for (let cnt = 1; cnt <= n; cnt++) {
      cur = table[cur][k] - 1
      if (cur === 0) return cnt
    }
    return -1
  }
  const genOrders = genIdx.map(tableOrder)

  // 候选四元数按固定枚举序过滤出与生成元同阶者
  const cands = genOrders.map(o => QUATS.filter(q => quatOrder(q) === o))

  for (const q1 of cands[0]) {
    for (const q2 of cands[1]) {
      const qg = [q1, q2]
      const phi = new Map<number, Quat>([[0, ONE]])
      const queue = [0]
      while (queue.length > 0) {
        const x = queue.shift()!
        for (let gi = 0; gi < genIdx.length; gi++) {
          const y = table[x][genIdx[gi]] - 1
          if (!phi.has(y)) {
            phi.set(y, qmul(phi.get(x)!, qg[gi]))
            queue.push(y)
          }
        }
      }
      if (phi.size !== n) continue
      // 24×24 同态逐格验证
      let ok = true
      for (let x = 0; x < n && ok; x++) {
        for (let y = 0; y < n && ok; y++) {
          const want = phi.get(table[x][y] - 1)!
          const got = qmul(phi.get(x)!, phi.get(y)!)
          if (want.join(',') !== got.join(',')) ok = false
        }
      }
      if (ok) {
        const out: Quat[] = new Array(n)
        for (let k = 0; k < n; k++) out[k] = phi.get(k)!
        return out
      }
    }
  }
  throw new Error('sl23: isomorphism pairing failed')
}

function iso(): Quat[] {
  if (!_iso) _iso = buildIsomorphism()
  return _iso
}

/** 表索引 k（GAP (24,3) 元素 g{k}）→ 四元数。只读，不得改写。 */
export function sl23Quat(k: number): Quat {
  return iso()[k]
}

/** 表索引 k → 2×2 矩阵（F₃，行主序）。 */
export function sl23Matrix(k: number): GL2Matrix {
  return quatToMatrix(iso()[k])
}

/** 表索引 k → 矩阵 TeX 标签（smallmatrix，与 GL(2,3) 同款）。 */
export function sl23MatrixLabel(k: number): string {
  return matrixLabel(sl23Matrix(k))
}

/** 元素自旋：物体旋转 (axis, angleRad) 与皮带扭转贡献（均为 2ψ，用户模型 τ=2ψ）。 */
export interface Sl23Spin {
  /** 旋转轴（单位向量）；恒等与 −I（纯皮带态）为 null */
  axis: [number, number, number] | null
  /** 物体旋转角（弧度，= 2ψ ∈ [0, 2π]） */
  angleRad: number
  /** 皮带扭转贡献（正标量；−I 恰为 2π——皮带戏法核心态） */
  beltTwist: number
  /** −I 标记：物体转满一圈外观不变，只有皮带动（场景据此隐藏轴标记） */
  fullTurn: boolean
}

/** 表索引 k → 自旋分解（axis/angleRad/beltTwist/fullTurn）。 */
export function sl23Spin(k: number): Sl23Spin {
  return spinOfQuat(iso()[k])
}

/** 四元数整数坐标 → 自旋分解（sl23Spin / sl23SpinFromMatrix 共用）。 */
function spinOfQuat(q: Quat): Sl23Spin {
  const [a, b, c, d] = q
  const w = a / 2
  const vx = b / 2, vy = c / 2, vz = d / 2
  const vlen = Math.hypot(vx, vy, vz)
  if (vlen < 1e-9) {
    if (w > 0) return { axis: null, angleRad: 0, beltTwist: 0, fullTurn: false }
    // −I：物体转满 360°（外观恒等），皮带拧一整圈
    return { axis: [0, 1, 0], angleRad: Math.PI * 2, beltTwist: Math.PI * 2, fullTurn: true }
  }
  const psi = Math.atan2(vlen, w)
  const axis: [number, number, number] = [vx / vlen, vy / vlen, vz / vlen]
  const angleRad = 2 * psi
  return { axis, angleRad, beltTwist: angleRad, fullTurn: false }
}

/* ------------------------------------------------------------------ *
 * 矩阵 → 旋转的**闭式反解**（2026-10-17，用户「矩阵 abcd 怎么转换成旋转度数」）。
 *
 * 正问题是 M = 2·(a₀·I + b₀·Mᵢ + c₀·Mⱼ + d₀·Mₖ) mod 3（1/2 ≡ 2），
 * 其中 Mᵢ = [[0,1],[2,0]]、Mⱼ = [[1,1],[1,2]]、Mₖ = MᵢMⱼ = [[1,2],[2,2]]。
 * 展开四个分量后解 4×4 线性方程组，得反解（全部按 mod 3）：
 *
 *   a₀ ≡ a + d            （= tr M，迹决定旋转角）
 *   b₀ ≡ 2(c − b)
 *   c₀ ≡ d − a − b − c
 *   d₀ ≡ b + c − a + d
 *
 * 坐标从 {0,1,2} 提升回 2T 的整数 (±2,0,0,0) / (±1,±1,±1,±1)：模 3 坐标含 0
 * ⇒ 轴型（非零位取 ±2：2→+2、1→−2），否则全非零 ⇒ 全 ±1（2→−1、1→+1）。
 * 24 个元素的 mod-3 坐标组两两互异 ⇒ 反解唯一（sl23.test.ts 逐元素对照验证）。
 *
 * 旋转角：q = (a₀+b₀i+c₀j+d₀k)/2 = cos ψ + sin ψ·û ⇒ **物体绕 û 转 2ψ**，
 * 即 cos(角/2) = a₀/2 —— a₀ = +2 → 0°、+1 → 120°、0 → 180°、−1 → 240°、
 * −2 → 360°（−I，物体外观恒等、皮带拧满一圈：皮带戏法核心态）。
 * ------------------------------------------------------------------ */

/** 矩阵（F₃ 行主序）→ 2T 四元数整数坐标 (a₀,b₀,c₀,d₀)；非 SL(2,3) 矩阵返回 null */
export function sl23QuatFromMatrix(m: GL2Matrix): Quat | null {
  const [a, b, c, d] = m
  const mod3 = (v: number): number => { const r = v % 3; return r < 0 ? r + 3 : r }
  const raw = [mod3(a + d), mod3(2 * (c - b)), mod3(d - a - b - c), mod3(b + c - a + d)]
  const isAxis = raw.some(v => v === 0)
  const coords: Quat = [
    raw[0] === 0 ? 0 : isAxis ? (raw[0] === 2 ? 2 : -2) : (raw[0] === 2 ? -1 : 1),
    raw[1] === 0 ? 0 : isAxis ? (raw[1] === 2 ? 2 : -2) : (raw[1] === 2 ? -1 : 1),
    raw[2] === 0 ? 0 : isAxis ? (raw[2] === 2 ? 2 : -2) : (raw[2] === 2 ? -1 : 1),
    raw[3] === 0 ? 0 : isAxis ? (raw[3] === 2 ? 2 : -2) : (raw[3] === 2 ? -1 : 1),
  ]
  const key = coords.join(',')
  return QUATS.some(q => q.join(',') === key) ? coords : null
}

/** 矩阵（F₃）→ 自旋分解（闭式反解；非 SL(2,3) 矩阵返回 null）。 */
export function sl23SpinFromMatrix(m: GL2Matrix): Sl23Spin | null {
  const q = sl23QuatFromMatrix(m)
  return q ? spinOfQuat(q) : null
}

// 模块自检（构造即失败快）：嵌入矩阵都落在 SL(2,3)、MAT_K 满足四元数关系
void ((): void => {
  for (const m of [MAT_I, MAT_J, MAT_K]) {
    if (detGL2(m, F3) !== 1) throw new Error('sl23: embedding matrix not in SL(2,3)')
  }
  const neg = (m: GL2Matrix): GL2Matrix => [(-m[0] + F3) % F3, (-m[1] + F3) % F3, (-m[2] + F3) % F3, (-m[3] + F3) % F3]
  const eq = (x: GL2Matrix, y: GL2Matrix): boolean => x.every((v, i) => v === y[i])
  // i²=j²=k²=−I、ij=k、ji=−k
  if (!eq(multiplyGL2(MAT_I, MAT_I, F3), neg([1, 0, 0, 1]))) throw new Error('sl23: Mi^2 != -I')
  if (!eq(multiplyGL2(MAT_J, MAT_J, F3), neg([1, 0, 0, 1]))) throw new Error('sl23: Mj^2 != -I')
  if (!eq(multiplyGL2(MAT_K, MAT_K, F3), neg([1, 0, 0, 1]))) throw new Error('sl23: Mk^2 != -I')
  if (!eq(MAT_K, multiplyGL2(MAT_I, MAT_J, F3))) throw new Error('sl23: Mk != Mi*Mj')
  if (!eq(neg(MAT_K), multiplyGL2(MAT_J, MAT_I, F3))) throw new Error('sl23: Mj*Mi != -Mk')
  void detGL2
})()

import type { CayleyEdgeData } from '../types'
import type { Vec3 } from './layouts3D/shared'
import { isIdentityScale } from './edgeLengthRelax'

/**
 * 逐生成元边长 —— 3D 通用后处理（VCL）。
 *
 * 与 2D 版（edgeLengthRelax.ts）同一套力模型（目标长度 = 各作用元素平均基础边长 × 倍率 →
 * 弹簧 + 弱锚定 + 近邻斥力），差别有二：
 *  1. 位置为三维 `Vec3`（项目 3D 位置约定），距离用三维欧氏距离；
 *  2. **斥力按布局尺度自适应** —— 3D 各布局的世界尺度差异大（cone 半径 5、wordLengthSphere R=15、
 *     小群布局 1–5），2D 的固定斥力常数（40 / 作用半径 30px，约 0.25×边长）在 3D 尺度上会失效。
 *     这里以基础布局平均边长 `ref` 为参考尺度，同比例取值：斥力 f = repulsion × ref² / d²、
 *     作用半径 0.25·ref（默认 repulsion = 0.0025 使 d = 0.25·ref 处推力 ≈ 0.04，与 2D 版同量级）
 *     —— 只在节点快要叠死时起作用，不干扰正常的边长调整。
 *
 * 无边界钳制（3D 没有视口边界），整体形状靠锚定力保持。
 *
 * **零配置安全**：所有 scale 均为 1（或缺失）时直接返回基础布局（逐位不变），
 * 因此不传 `lengthScale` 的既有插图外观完全不受影响。
 *
 * 纯函数、零 UI 依赖。
 */
export interface RelaxEdgeLengths3DOptions {
  /** 作用元素 id → 长度倍率（缺省 1） */
  lengthScales: Map<string, number>
  /** 迭代次数；缺省 160 */
  iterations?: number
  /** 锚定强度（拉回基础位置）；缺省 0.06 */
  anchorStrength?: number
  /** 弹簧强度；缺省 0.22 */
  springStrength?: number
  /** 斥力强度（相对参考尺度 ref² 的倍率）；缺省 0.0025（d = 0.25·ref 处推力 ≈ 0.04，与 2D 版同量级） */
  repulsion?: number
}

const EPS = 1e-3

export function relaxEdgeLengths3D(
  base: Map<string, Vec3>,
  edges: CayleyEdgeData[],
  options: RelaxEdgeLengths3DOptions,
): Map<string, Vec3> {
  const { lengthScales } = options
  if (base.size === 0) return base
  if (isIdentityScale(lengthScales)) return base

  const ids = [...base.keys()]
  const pos = new Map<string, Vec3>()
  for (const id of ids) {
    const p = base.get(id)!
    pos.set(id, [p[0], p[1], p[2]])
  }

  const activeEdges = edges.filter(e => !e.isSelfLoop && e.fromId !== e.toId)

  // 每个作用元素的平均基础边长 → 目标长度；顺带得到整体参考尺度 ref
  const sumLen = new Map<string, number>()
  const cntLen = new Map<string, number>()
  let refSum = 0
  let refCnt = 0
  for (const e of activeEdges) {
    const a = base.get(e.fromId)
    const b = base.get(e.toId)
    if (!a || !b) continue
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    sumLen.set(e.actionElementId, (sumLen.get(e.actionElementId) ?? 0) + d)
    cntLen.set(e.actionElementId, (cntLen.get(e.actionElementId) ?? 0) + 1)
    refSum += d
    refCnt += 1
  }
  const ref = refCnt > 0 ? refSum / refCnt : 1
  const targetLen = new Map<string, number>()
  for (const [action, sum] of sumLen) {
    const mean = sum / (cntLen.get(action) || 1)
    targetLen.set(action, mean * (lengthScales.get(action) ?? 1))
  }

  const iterations = options.iterations ?? 160
  const kAnchor = options.anchorStrength ?? 0.06
  const kSpring = options.springStrength ?? 0.22
  const kRep = (options.repulsion ?? 0.0025) * ref * ref
  const repRadius2 = (0.25 * ref) ** 2
  const step = 0.35

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, Vec3>()
    for (const id of ids) disp.set(id, [0, 0, 0])

    // 锚定：拉回基础布局
    for (const id of ids) {
      const p = pos.get(id)!
      const b = base.get(id)!
      const d = disp.get(id)!
      d[0] += (b[0] - p[0]) * kAnchor
      d[1] += (b[1] - p[1]) * kAnchor
      d[2] += (b[2] - p[2]) * kAnchor
    }

    // 弹簧：每条边朝其生成元的目标长度靠拢
    for (const e of activeEdges) {
      const a = pos.get(e.fromId)
      const b = pos.get(e.toId)
      if (!a || !b) continue
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const dz = b[2] - a[2]
      const d = Math.hypot(dx, dy, dz)
      if (d < EPS) continue
      const target = targetLen.get(e.actionElementId) ?? d
      const f = (d - target) * kSpring
      const ux = dx / d
      const uy = dy / d
      const uz = dz / d
      const da = disp.get(e.fromId)!
      const db = disp.get(e.toId)!
      da[0] += ux * f
      da[1] += uy * f
      da[2] += uz * f
      db[0] -= ux * f
      db[1] -= uy * f
      db[2] -= uz * f
    }

    // 近邻斥力：防止缩短边长后节点叠死（作用半径 3·ref，力按 ref² 归一化）
    for (let i = 0; i < ids.length; i++) {
      const pi = pos.get(ids[i])!
      for (let j = i + 1; j < ids.length; j++) {
        const pj = pos.get(ids[j])!
        const dx = pi[0] - pj[0]
        const dy = pi[1] - pj[1]
        const dz = pi[2] - pj[2]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 > 1e-6 && d2 < repRadius2) {
          const d = Math.sqrt(d2)
          const f = kRep / d2
          const di = disp.get(ids[i])!
          const dj = disp.get(ids[j])!
          di[0] += (dx / d) * f
          di[1] += (dy / d) * f
          di[2] += (dz / d) * f
          dj[0] -= (dx / d) * f
          dj[1] -= (dy / d) * f
          dj[2] -= (dz / d) * f
        }
      }
    }

    // 积分
    for (const id of ids) {
      const p = pos.get(id)!
      const d = disp.get(id)!
      p[0] += d[0] * step
      p[1] += d[1] * step
      p[2] += d[2] * step
    }
  }

  return pos
}

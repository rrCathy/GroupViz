import type { CayleyEdgeData, NodePosition } from '../types'

/**
 * 逐生成元边长 —— 通用后处理（VCL）。
 *
 * 固定几何布局（circular / grid / cylinder / torus / rewiring …）的边长由形状决定，无法通过
 * 改形状来"调某条边的长度"。这里在**任意基础布局之上**跑一轮长度约束松弛：
 *
 *  1. 对每个作用元素 g，取其所有边在基础布局中的平均长度 baseLen_g，目标长度 target_g = baseLen_g × scale_g；
 *  2. 各条边按 (当前长 − 目标长) 施加弹簧力（目标统一 → 同一生成元的边被"拉齐"，教学上更整齐）；
 *  3. 每个节点同时受**弱锚定力**拉向基础布局位置，保证整体形状不散架、
 *     局部调整而非全局重排；
 *  4. 近邻之间加一点斥力防止节点叠死。
 *
 * **零配置安全**：所有 scale 均为 1（或缺失）时直接返回基础布局（逐位不变），
 * 因此不传 `lengthScale` 的既有插图外观完全不受影响。
 *
 * 纯函数、零 UI 依赖。力导向布局另有弹簧静止长度通路（见 cayleyForce.ts），二者共用同一倍率语义。
 */
export interface RelaxEdgeLengthOptions {
  /** 作用元素 id → 长度倍率（缺省 1） */
  lengthScales: Map<string, number>
  /** 迭代次数；缺省 160 */
  iterations?: number
  /** 锚定强度（拉回基础位置）；缺省 0.06 */
  anchorStrength?: number
  /** 弹簧强度；缺省 0.22 */
  springStrength?: number
  /** 近邻斥力强度；缺省 40 */
  repulsion?: number
  /** 边界钳制（给定时越界节点被拉回） */
  clamp?: { width: number; height: number; pad?: number }
}

const EPS = 1e-3

/** 倍率与 1 的差是否可忽略 */
function isIdentityScale(scales: Map<string, number>): boolean {
  for (const s of scales.values()) {
    if (Math.abs(s - 1) > EPS) return false
  }
  return true
}

export function relaxEdgeLengths(
  base: Map<string, NodePosition>,
  edges: CayleyEdgeData[],
  options: RelaxEdgeLengthOptions,
): Map<string, NodePosition> {
  const { lengthScales } = options
  if (base.size === 0) return base
  if (isIdentityScale(lengthScales)) return base

  const ids = [...base.keys()]
  const pos = new Map<string, NodePosition>()
  for (const id of ids) {
    const p = base.get(id)!
    pos.set(id, { x: p.x, y: p.y })
  }

  // 每个作用元素的平均基础边长 → 目标长度
  const sumLen = new Map<string, number>()
  const cntLen = new Map<string, number>()
  for (const e of edges) {
    if (e.isSelfLoop || e.fromId === e.toId) continue
    const a = base.get(e.fromId)
    const b = base.get(e.toId)
    if (!a || !b) continue
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    sumLen.set(e.actionElementId, (sumLen.get(e.actionElementId) ?? 0) + d)
    cntLen.set(e.actionElementId, (cntLen.get(e.actionElementId) ?? 0) + 1)
  }
  const targetLen = new Map<string, number>()
  for (const [action, sum] of sumLen) {
    const mean = sum / (cntLen.get(action) || 1)
    const scale = lengthScales.get(action) ?? 1
    targetLen.set(action, mean * scale)
  }

  const iterations = options.iterations ?? 160
  const kAnchor = options.anchorStrength ?? 0.06
  const kSpring = options.springStrength ?? 0.22
  const kRep = options.repulsion ?? 40
  const step = 0.35

  const activeEdges = edges.filter(e => !e.isSelfLoop && e.fromId !== e.toId)

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { x: number; y: number }>()
    for (const id of ids) disp.set(id, { x: 0, y: 0 })

    // 锚定：拉回基础布局
    for (const id of ids) {
      const p = pos.get(id)!
      const b = base.get(id)!
      const d = disp.get(id)!
      d.x += (b.x - p.x) * kAnchor
      d.y += (b.y - p.y) * kAnchor
    }

    // 弹簧：每条边朝其生成元的目标长度靠拢
    for (const e of activeEdges) {
      const a = pos.get(e.fromId)
      const b = pos.get(e.toId)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d < EPS) continue
      const target = targetLen.get(e.actionElementId) ?? d
      const f = (d - target) * kSpring
      const ux = dx / d
      const uy = dy / d
      const da = disp.get(e.fromId)!
      const db = disp.get(e.toId)!
      da.x += ux * f
      da.y += uy * f
      db.x -= ux * f
      db.y -= uy * f
    }

    // 近邻斥力：防止缩短边长后节点叠死
    for (let i = 0; i < ids.length; i++) {
      const pi = pos.get(ids[i])!
      for (let j = i + 1; j < ids.length; j++) {
        const pj = pos.get(ids[j])!
        const dx = pi.x - pj.x
        const dy = pi.y - pj.y
        const d2 = dx * dx + dy * dy
        if (d2 > 1e-6 && d2 < 900) {
          const d = Math.sqrt(d2)
          const f = kRep / d2
          const di = disp.get(ids[i])!
          const dj = disp.get(ids[j])!
          di.x += (dx / d) * f
          di.y += (dy / d) * f
          dj.x -= (dx / d) * f
          dj.y -= (dy / d) * f
        }
      }
    }

    // 积分
    for (const id of ids) {
      const p = pos.get(id)!
      const d = disp.get(id)!
      p.x += d.x * step
      p.y += d.y * step
    }
  }

  if (options.clamp) {
    const { width, height, pad = 24 } = options.clamp
    for (const id of ids) {
      const p = pos.get(id)!
      p.x = Math.max(pad, Math.min(width - pad, p.x))
      p.y = Math.max(pad, Math.min(height - pad, p.y))
    }
  }

  return pos
}

/** 倍率是否全为 1（供渲染层判断是否需要跑松弛，避免无谓计算） */
export { isIdentityScale }

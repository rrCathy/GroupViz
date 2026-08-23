import type { Group, GroupElement, NodePosition } from '../../types'
import { isC2Cube, isGroupDihedral } from '../../types'
import {
  ringOrder, detectS3PermSet, S3_PERM_IDS, powerRingOrder,
  splitDihedralElements, quaternionCosetMap,
} from '../ringOrder'
import { getConjugacyClasses } from '../subgroups'
import { computeElementOrder } from './shared'

// ─── Concentric Layout (by conjugacy classes) ─────────────────────────

export function concentricLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const idToEl = new Map<string, GroupElement>()
  group.elements.forEach(el => idToEl.set(el.id, el))

  const conjugacyClasses: GroupElement[][] = []
  const used = new Set<string>()

  for (const a of group.elements) {
    if (used.has(a.id)) continue
    const conjugates: GroupElement[] = []
    const maxIters = group.order > 60 ? 10 : group.order
    const sample = group.order > 60
      ? [group.identity, ...group.elements.slice(0, Math.min(maxIters - 1, group.order - 1))]
      : group.elements
    for (const g of sample) {
      const conj = group.multiply(group.multiply(g, a), group.inverse(g))
      if (!used.has(conj.id)) {
        conjugates.push(conj)
        used.add(conj.id)
      }
    }
    if (conjugates.length > 0) conjugacyClasses.push(conjugates)
  }

  conjugacyClasses.sort((a, b) => a.length - b.length)

  const maxRadius = Math.min(width, height) * 0.44
  const minRadius = 0
  const ringCount = conjugacyClasses.length
  const idClass = conjugacyClasses.find(cls => cls.length === 1 && cls[0].id === group.identity.id)

  let ringIndex = 0
  for (const cls of conjugacyClasses) {
    const isIdentityRing = cls === idClass
    const m = cls.length

    let ringRadius: number
    if (isIdentityRing) {
      ringRadius = 0
    } else {
      const effectiveRingIdx = ringIndex
      const totalRings = idClass ? ringCount - 1 : ringCount
      const t = totalRings > 1 ? effectiveRingIdx / (totalRings - 1) : 0.5
      ringRadius = minRadius + (maxRadius - minRadius) * (0.15 + t * 0.85)
    }

    for (let i = 0; i < m; i++) {
      let x: number, y: number
      if (m === 1) {
        x = cx
        y = cy + ringRadius
      } else {
        const angle = (i * 2 * Math.PI) / m - Math.PI / 2
        x = cx + ringRadius * Math.cos(angle)
        y = cy + ringRadius * Math.sin(angle)
      }
      result.set(cls[i].id, { x, y })
    }

    if (!isIdentityRing) ringIndex++
  }

  return result
}

// ─── Cone Layout (2D 同心环，圆锥俯视) ───────────────────────────────────

export interface ConeRingOrderInfo {
  /** 元素 id → 元素阶 */
  orderOf: Map<string, number>
  /** 最大元素阶 */
  maxK: number
  /** 元素 id → 环内格号（共轭类分扇区，≤60 阶；>60 为 null 走原序） */
  slots: Map<string, number> | null
  /** 环 k → 该环总格数（类内元素 + 类间 gap） */
  totalSlots: Map<number, number>
}

/**
 * cone 布局的环序计算：按元素阶分环，环内按共轭类分扇区
 * （同类元素连续摆放，类间留 1 格 gap）。共轭保持元素阶，
 * 故每个共轭类完整落在单一环内。>60 阶时退化每元素单类，
 * 直接返回 null slots 走原序（性能守卫）。
 */
export function computeConeRingOrder(group: Group): ConeRingOrderInfo {
  const orderOf = new Map<string, number>()
  let maxK = 1
  for (const el of group.elements) {
    const k = computeElementOrder(el, group)
    orderOf.set(el.id, k)
    if (k > maxK) maxK = k
  }
  const totalSlots = new Map<number, number>()
  for (const k of orderOf.values()) {
    totalSlots.set(k, (totalSlots.get(k) ?? 0) + 1)
  }
  let slots: Map<string, number> | null = null
  if (group.order > 0 && group.order <= 60) {
    const classesByK = new Map<number, GroupElement[][]>()
    for (const cls of getConjugacyClasses(group, false)) {
      const k = orderOf.get(cls[0].id) ?? 1
      const list = classesByK.get(k) ?? []
      list.push(cls)
      classesByK.set(k, list)
    }
    slots = new Map<string, number>()
    for (const [k, clsList] of classesByK) {
      let cursor = 0
      for (const cls of clsList) {
        for (const el of cls) {
          slots.set(el.id, cursor)
          cursor++
        }
        cursor++
      }
      totalSlots.set(k, cursor)
    }
  }
  return { orderOf, maxK, slots, totalSlots }
}

/**
 * 圆锥布局的 2D 俯视版本：恒等元在中心，其余元素按阶 k=2..maxOrder
 * 分同心环（无 k 阶元素则空环跳过），每环元素按共轭类分扇区分布。
 */
export function coneLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()
  if (n === 0) return result

  const { orderOf, maxK, slots, totalSlots } = computeConeRingOrder(group)

  for (let i = 0; i < n; i++) {
    const el = group.elements[i]
    const k = orderOf.get(el.id) ?? 1
    if (k <= 1) {
      result.set(el.id, { x: cx, y: cy })
      continue
    }
    let slot: number
    if (slots) {
      slot = slots.get(el.id) ?? 0
    } else {
      let s = 0
      for (let j = 0; j < i; j++) {
        if ((orderOf.get(group.elements[j].id) ?? 1) === k) s++
      }
      slot = s
    }
    const total = totalSlots.get(k) ?? 1
    const t = k / maxK
    const ringRadius = Math.min(width, height) * 0.42 * t
    const angle = -Math.PI / 2 + (slot * 2 * Math.PI) / total
    result.set(el.id, { x: cx + ringRadius * Math.cos(angle), y: cy + ringRadius * Math.sin(angle) })
  }
  return result
}

// ─── Dual Ring Layout (for Dihedral groups) ───────────────────────────

/**
 * C₂³ as a D₄-style dual ring: outer square {e, a, ab, b} (generator-power
 * order) with the inner ring {·c} at the same angles. Returns null when the
 * generators do not produce a clean 4+4 split.
 */
function c2CubeDualRing(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()
  const identity = group.identity
  const gens = group.generators
    .map((g) => g.apply(identity))
    .filter((el) => el.id !== identity.id)
  if (gens.length < 3) return null
  const [a, b, c] = gens
  const ab = group.multiply(a, b)
  const outer = [identity, a, ab, b]
  const inner = outer.map((el) => group.multiply(el, c))
  if (outer.some((el) => !el) || inner.some((el) => !el)) return null
  const ids = new Set([...outer.map((el) => el.id), ...inner.map((el) => el.id)])
  if (ids.size !== group.order) return null
  const outerR = Math.min(width, height) * 0.38
  const innerR = outerR * 0.55
  for (let i = 0; i < 4; i++) {
    const angle = (i * 2 * Math.PI) / 4 - Math.PI / 2
    result.set(outer[i].id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
    result.set(inner[i].id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
  }
  return result
}

export function dualRingLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result

  // C₂³（阶 8 基本阿贝尔群）：大正方形套小正方形（D₄ 双环）。
  // 必须优先于 value 分支——pipe 直积群的 value 分支按 value[0] 排序环序，
  // 会把 ⟨a,c⟩ 摆成 [e,c,a,ac]，c→a 与 ac→e 为穿心对角弦（非真实边），
  // 横穿内方造成交叉；c2CubeDualRing 用交替生成元环序 [e,a,ab,b]，
  // 四边全为真实生成元边（信步无交叉），内方 = 外方·分隔生成元（径向连线）。
  if (isC2Cube(group)) {
    const cube = c2CubeDualRing(group, width, height)
    if (cube) return cube
  }

  const m = n / 2

  const rotations: GroupElement[] = []
  const reflections: GroupElement[] = []

  for (const el of group.elements) {
    if (el.value.length >= 2 && el.value[1] === 0) {
      rotations.push(el)
    } else {
      reflections.push(el)
    }
  }

  if (rotations.length === 0 || reflections.length === 0) {
    // 注册表二面体群等 value=[k] 一维元素：按元素阶分类旋转/反射
    const split = splitDihedralElements(group)
    if (split) {
      const { rotations: rots, reflectPair } = split
      const cnt = rots.length
      const outerR = Math.min(width, height) * 0.38
      const innerR = outerR * 0.55
      for (let i = 0; i < cnt; i++) {
        const angle = (i * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(rots[i].id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
      }
      for (const [refId, ri] of reflectPair) {
        const angle = (ri * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(refId, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
      }
      return result
    }
    // Fallback: plain circle. For S₃-as-permutations use the ring order so the
    // hexagon Cayley graph (generators (12),(23)) is drawn without crossings.
    const keys = group.elements.map(e => e.id)
    const s3Order = detectS3PermSet(keys) ? S3_PERM_IDS : null
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const r = Math.min(width, height) * 0.38
      const el = s3Order ? (group.elements.find(e => e.id === s3Order[i]) ?? group.elements[i]) : group.elements[i]
      result.set(el.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return result
  }

  rotations.sort((a, b) => (a.value[0] ?? 0) - (b.value[0] ?? 0))
  reflections.sort((a, b) => (a.value[0] ?? 0) - (b.value[0] ?? 0))

  const outerR = Math.min(width, height) * 0.38
  const innerR = outerR * 0.55

  const refByRotIndex = new Map<number, GroupElement>()
  for (const ref of reflections) {
    refByRotIndex.set(ref.value[0] ?? 0, ref)
  }

  const rotationLabelOrder = new Map<string, number>()
  rotations.forEach((el, i) => rotationLabelOrder.set(el.id, i))

  for (let i = 0; i < rotations.length; i++) {
    const el = rotations[i]
    const angle = (i * 2 * Math.PI) / m - Math.PI / 2
    result.set(el.id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
  }

  for (let i = 0; i < rotations.length; i++) {
    const rotIdx = rotations[i].value[0] ?? 0
    const ref = refByRotIndex.get(rotIdx)
    const angle = (i * 2 * Math.PI) / m - Math.PI / 2
    if (ref) {
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
  }

  for (const ref of reflections) {
    if (!result.has(ref.id)) {
      const idx = reflections.indexOf(ref)
      const angle = (idx * 2 * Math.PI) / reflections.length - Math.PI / 2
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
  }

  return result
}

// ─── Q₁₆（广义四元数群）2D 布局：4 个同心陪集环 ────────────────────────────

/**
 * Q₁₆ 2D 凯莱图布局（参考 Group Explorer 的 Q16 圆柱俯视/侧视）：
 * 4 个右陪集 a^j⟨b⟩（j = 0..3）画成同心圆，节点 a^j·b^i 位于圆 j 上
 * 角度 90°·i（四环对齐）。b 边 = 环内 90° 弧（4 个干净的正方形 b-循环）；
 * a 边 = 纯径向线：i 偶（i=0,2）从环 j 到 j+1（外侧），i 奇（i=1,3）从
 * 环 j 到 j−1（内侧），共 12 条径向辐条；剩下 4 条 wrap 边
 * （(3,0)→(0,2)、(0,1)→(3,3)、(3,2)→(0,0)、(0,3)→(3,1)）为穿过
 * 中心的 2 条直径（各自两条反向边）——教科书式 Q16 画法，
 * 与 GE 圆柱的「4 层 ⟨b⟩ 环 + a 沿轴」同构。数值扫描确认这是
 * 全部 4 环布局中交叉最少的（4 处交叉集中在圆心）。
 * 结构不匹配（order≠16 或陪集分解失败）返回 null。
 */
export function quaternionRingLayout2D(
  group: Group,
  cx: number,
  cy: number,
  radius: number
): Map<string, NodePosition> | null {
  const dec = quaternionCosetMap(group)
  if (!dec) return null
  const result = new Map<string, NodePosition>()
  for (const el of group.elements) {
    const { j, i } = dec.byElement.get(el.id)!
    const r = radius * (0.34 + (j * 0.66) / 3)
    const angle = ((90 * i) * Math.PI) / 180 - Math.PI / 2
    result.set(el.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }
  return result
}

// ─── Cayley Circle Layout (crossing-free for dihedral / S₃ structures) ──

/**
 * Single-circle Cayley layout that avoids edge crossings for the classic
 * dihedral structures:
 *
 * - D* groups (element value = [r, s] with s ∈ {0,1}): rotations on the outer
 *   ring, reflections on the inner ring. Each reflection is placed radially
 *   under its s-edge partner (multiply convention: r_j · s = s_j) so the
 *   spokes and both triangles never cross.
 * - S₃ as permutations: ring order gives the plain 6-cycle (generators
 *   (12), (23)) drawn as a crossing-free hexagon.
 * - Direct-product ids ('a|b'): factor-wise ring order (legacy behavior).
 * - Everything else: ring order on a single circle.
 */
export function cayleyCircleLayout(
  group: Group,
  cx: number,
  cy: number,
  radius: number
): Map<string, NodePosition> {
  const result = new Map<string, NodePosition>()
  const n = group.order
  if (n === 0) return result

  const angleAt = (idx: number) => (idx * 2 * Math.PI) / n - Math.PI / 2

  const isPipe = group.elements.length > 0 && group.elements[0].id.includes('|')
  if (isPipe) {
    const numFactors = group.elements[0].id.split('|').length
    const factorOrders: Map<string, number>[] = []
    for (let col = 0; col < numFactors; col++) {
      const keys = Array.from(new Set(group.elements.map(el => {
        const parts = el.id.split('|')
        return parts[col] ?? ''
      })))
      const ordered = ringOrder(keys)
      factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
    }
    const sorted = [...group.elements].sort((a, b) => {
      const pa = a.id.split('|')
      const pb = b.id.split('|')
      for (let col = 0; col < numFactors; col++) {
        const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
        const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
        if (ai !== bi) return ai - bi
      }
      return 0
    })
    sorted.forEach((el, i) => {
      const angle = angleAt(i)
      result.set(el.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    })
    return result
  }

  // Q₁₆（广义四元数群）：4 个交错同心 ⟨b⟩-陪集环（GE 圆柱俯视），
  // 结构不匹配时返回 null 走下方兜底
  const q16 = quaternionRingLayout2D(group, cx, cy, radius)
  if (q16) return q16

  const rotations: GroupElement[] = []
  const reflections: GroupElement[] = []
  let dihedralLike = isGroupDihedral(group)
  if (dihedralLike) {
    for (const el of group.elements) {
      const v = el.value
      if (Array.isArray(v) && v.length >= 2 && (v[1] === 0 || v[1] === 1)) {
        if (v[1] === 0) rotations.push(el)
        else reflections.push(el)
      } else {
        dihedralLike = false
        break
      }
    }
  }
  if (dihedralLike && rotations.length > 0 && reflections.length > 0) {
    const m = rotations.length
    const outerR = radius
    const innerR = radius * 0.55
    const rotAngle = new Map<number, number>()
    for (const el of rotations) {
      const j = el.value[0] as number
      const angle = (j * 2 * Math.PI) / m - Math.PI / 2
      rotAngle.set(j, angle)
      result.set(el.id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
    }
    for (const ref of reflections) {
      const k = ref.value[0] as number
      const partner = k % m
      const angle = rotAngle.get(partner) ?? 0
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
    return result
  }

  // 注册表二面体群等 value=[k] 一维元素：按元素阶分类旋转/反射（双环免交叉）
  if (dihedralLike) {
    const split = splitDihedralElements(group)
    if (split) {
      const cnt = split.rotations.length
      const innerR = radius * 0.55
      for (let i = 0; i < cnt; i++) {
        const angle = (i * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(split.rotations[i].id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
      }
      for (const [refId, ri] of split.reflectPair) {
        const angle = (ri * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(refId, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
      }
      return result
    }
  }

  const keys = group.elements.map(e => e.id)
  const order = keys.every(k => /^[eg]\d+$/.test(k)) ? powerRingOrder(group) : ringOrder(keys)
  const idxOf = new Map(order.map((k, i) => [k, i]))
  for (const el of group.elements) {
    const idx = idxOf.get(el.id)
    if (idx === undefined) continue
    const angle = angleAt(idx)
    result.set(el.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return result
}

// ─── Archimedean Spiral Layout ─────────────────────────────────────────

export function archimedeanSpiralLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.44
  const turns = Math.max(2, Math.ceil(n / 8))
  const a = maxR / (turns * 2 * Math.PI)

  const elementsWithOrder = group.elements.map(el => ({
    el,
    order: computeElementOrder(el, group)
  }))
  elementsWithOrder.sort((a, b) => {
    if (a.el.id === group.identity.id && b.el.id !== group.identity.id) return -1
    if (a.el.id !== group.identity.id && b.el.id === group.identity.id) return 1
    return a.order - b.order || a.el.id.localeCompare(b.el.id)
  })

  for (let i = 0; i < elementsWithOrder.length; i++) {
    const t = i / (n - 1)
    const theta = t * turns * 2 * Math.PI
    const r = a * theta

    result.set(elementsWithOrder[i].el.id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

// ─── Spiral Layout (optimized for Cyclic groups Cn) ────────────────────

export function spiralLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.42
  const turns = Math.max(3, Math.ceil(n / 5))

  // r ∝ √t and θ ∝ √t keep arc lengths between consecutive points even
  // (Archimedean spiral with uniform spacing), so large cycles like C16
  // do not pile up inside and stretch apart outside.
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const sq = Math.sqrt(t)
    const r = maxR * sq
    const theta = sq * turns * 2 * Math.PI

    result.set(group.elements[i].id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

// ─── Coil Layout (variable-pitch spiral, only wrap-edge crosses) ────────

export function coilLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.42
  const turns = Math.max(2, Math.ceil(n / 6))
  const alpha = 0.7

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const r = maxR * t
    const theta = Math.pow(t, alpha) * turns * 2 * Math.PI

    result.set(group.elements[i].id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

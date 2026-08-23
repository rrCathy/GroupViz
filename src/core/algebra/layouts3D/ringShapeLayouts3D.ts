import type { Group } from '../../types'
import { isGroupDihedral } from '../../types'
import {
  ringOrder, powerRingOrder,
  splitDihedralElements, dihedralSnakeOrder,
  quaternionCosetMap,
} from '../ringOrder'
import { getSemidirectProductMeta, semidirectFactorMap } from '../semidirectDecompositions'
import { computeConeRingOrder } from '../layouts/ringShapeLayouts'
import { fibonacciSphere, type Vec3 } from './shared'

// ─── Q₁₆（广义四元数群）圆柱（Group Explorer 风格） ───────────────────────

/**
 * Q₁₆ 3D 凯莱图布局（对齐 Group Explorer 的 Q16 圆柱）：4 个 ⟨b⟩-陪集
 * a^j⟨b⟩（j = 0..3）为 4 层圆环沿 y 轴堆叠，每层节点 a^j·b^i 圆角
 * 90°·i（各层对齐，a 边 = 竖直直线、b 边 = 层内 90° 弧——GE 圆柱原貌）。
 * 结构不匹配返回 null（调用方回退 fibonacci 球）。
 */
function quaternionCylinder3D(group: Group, radius: number): Vec3[] | null {
  const dec = quaternionCosetMap(group)
  if (!dec) return null
  const sizeS = 4
  const sizeC = 4
  const ringRadius = Math.max(radius * 0.55, (sizeS * 0.9) / (2 * Math.PI))
  const verticalGap = Math.max(0.9, (radius * 1.8) / sizeC)
  const halfH = ((sizeC - 1) * verticalGap) / 2
  const positions: Vec3[] = []
  for (const el of group.elements) {
    const { j, i } = dec.byElement.get(el.id)!
    const angle = (90 * i * Math.PI) / 180
    positions.push([
      Math.cos(angle) * ringRadius,
      j * verticalGap - halfH,
      Math.sin(angle) * ringRadius
    ])
  }
  return positions
}

/**
 * 3D 圆环的元素排序（推广 2D cayleyCircleLayout 的排序策略）：
 * pipe 直积按因子 ringOrder 字典序（生成元边相邻）；S₃ 置换集 → 六边形序
 * （detectS3PermSet 在 powerRingOrder 内处理）；表群 gN 等 → 生成元幂序
 * powerRingOrder（BFS，生成元边相邻），失败回退 ringOrder。
 */
function circularOrder3D(group: Group): string[] {
  const n = group.order
  if (n === 0) return []
  if (group.elements[0]?.id.includes('|')) {
    const numFactors = group.elements[0].id.split('|').length
    const factorOrders: Map<string, number>[] = []
    for (let col = 0; col < numFactors; col++) {
      const colKeys = Array.from(new Set(group.elements.map(el => el.id.split('|')[col] ?? '')))
      const ordered = ringOrder(colKeys)
      factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
    }
    return [...group.elements]
      .sort((a, b) => {
        const pa = a.id.split('|')
        const pb = b.id.split('|')
        for (let col = 0; col < numFactors; col++) {
          const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
          const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
          if (ai !== bi) return ai - bi
        }
        return 0
      })
      .map(el => el.id)
  }
  return powerRingOrder(group)
}

export function semidirectCylinderLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  const sd = getSemidirectProductMeta(group)
  const factorMap = sd ? semidirectFactorMap(group, sd) : null
  if (!sd || !factorMap) {
    // Q₁₆（广义四元数群，GE 记为 Q₈）：⟨b⟩-陪集圆柱（见 quaternionCylinder3D）
    const q16 = quaternionCylinder3D(group, radius)
    if (q16) return q16
    for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    return positions
  }
  const hOrder = powerRingOrder(sd.acting)
  // N 盘内环序：二面体蛇形（rotations 幂序正排 + reflections 配对角反排，
  // 生成元边外环相邻、反射边径向），无二面体结构回退生成元幂序
  const nOrder = dihedralSnakeOrder(sd.normal) ?? powerRingOrder(sd.normal)
  const sizeC = Math.max(1, sd.acting.order)
  const sizeS = Math.max(1, sd.normal.order)
  const ringRadius = Math.max(radius * 0.55, (sizeS * 0.9) / (2 * Math.PI))
  const verticalGap = Math.max(0.9, (radius * 1.8) / sizeC)
  const halfH = ((sizeC - 1) * verticalGap) / 2
  for (let i = 0; i < n; i++) {
    const fm = factorMap.get(group.elements[i].id)
    if (!fm) {
      positions[i] = fibonacciSphere(n, radius)[i]
      continue
    }
    const hIdx = hOrder.indexOf(fm.h.id)
    const nIdx = nOrder.indexOf(fm.n.id)
    // Layer-stagger the ring so the points spread uniformly around the
    // cylinder surface (not an aligned triangular prism). The acting
    // subgroup H = {e, y, y², y³} then forms a visible helical 4-cycle
    // instead of collapsing onto a single vertical column.
    const stagger = (2 * Math.PI) / (sizeS * sizeC)
    const angle = (Math.max(0, nIdx) * 2 * Math.PI) / sizeS + Math.max(0, hIdx) * stagger
    positions[i] = [
      Math.cos(angle) * ringRadius,
      Math.max(0, hIdx) * verticalGap - halfH,
      Math.sin(angle) * ringRadius
    ]
  }
  return positions
}

export function coneLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  // 圆锥兜底：恒等元（1 阶）在顶点，其余元素按阶 k=2..maxOrder
  // 沿母线分圈向下摆（无 k 阶元素则空圈跳过），每圈按共轭类分扇区
  const { orderOf, maxK, slots, totalSlots } = computeConeRingOrder(group)
  for (let i = 0; i < n; i++) {
    const el = group.elements[i]
    const k = orderOf.get(el.id) ?? 1
    if (k <= 1) {
      positions[i] = [0, radius, 0]
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
    const angle = -Math.PI / 2 + (slot * 2 * Math.PI) / total
    positions[i] = [Math.cos(angle) * radius * t, radius - 2 * radius * t, Math.sin(angle) * radius * t]
  }
  return positions
}

export function circularLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  // 二面体结构：单环无法免交叉 → 双环（旋转外环 + 反射内环，径向配对），
  // 与 2D cayleyCircleLayout 对 Dₙ 的处理一致（需符号守卫，循环群
  // C₂ₘ 含阶 m 元素会被 splitDihedralElements 误配，2D 同样用 isGroupDihedral 守卫）
  if (isGroupDihedral(group)) {
    const split = splitDihedralElements(group)
    if (split) {
      const cnt = split.rotations.length
      const rRadius = radius * 0.85
      const rotIdx = new Map(split.rotations.map((e, i) => [e.id, i]))
      const refIdx = split.reflectPair
      for (let i = 0; i < n; i++) {
        const id = group.elements[i].id
        const rot = rotIdx.get(id)
        if (rot !== undefined) {
          const angle = (rot * 2 * Math.PI) / cnt
          positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
        } else {
          const angle = ((refIdx.get(id) ?? 0) * 2 * Math.PI) / cnt
          positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
        }
      }
      return positions
    }
  }
  const order = circularOrder3D(group)
  const idxOf = new Map(order.map((k, i) => [k, i]))
  for (let i = 0; i < n; i++) {
    const idx = idxOf.get(group.elements[i].id)
    const angle = (idx ?? i) * 2 * Math.PI / n
    positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
  }
  return positions
}

export function hexagonLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  // S₃ 置换集 → 六边形序（circularOrder3D 经 powerRingOrder 的 detectS3PermSet）；
  // 其他群退化为通用圆环排序
  const order = circularOrder3D(group)
  const idxOf = new Map(order.map((k, i) => [k, i]))
  for (let i = 0; i < n; i++) {
    const idx = idxOf.get(group.elements[i].id)
    const angle = (idx ?? i) * 2 * Math.PI / n
    positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
  }
  return positions
}

export function dihedralLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  const positions: Vec3[] = new Array(n)
  const halfN = Math.floor(n / 2)
  const rRadius = radius * 0.85
  // 注册表二面体群（value=[k]）等：按元素阶分类旋转/反射并径向配对
  const split = isGroupDihedral(group) ? splitDihedralElements(group) : null
  if (split && split.rotations.length === halfN) {
    const cnt = split.rotations.length
    const rotIdx = new Map(split.rotations.map((e, i) => [e.id, i]))
    const refIdx = split.reflectPair
    for (let i = 0; i < n; i++) {
      const id = group.elements[i].id
      const rot = rotIdx.get(id)
      if (rot !== undefined) {
        const angle = (rot * 2 * Math.PI) / cnt
        positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
      } else {
        const angle = ((refIdx.get(id) ?? 0) * 2 * Math.PI) / cnt
        positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
      }
    }
    return positions
  }
  for (let i = 0; i < halfN; i++) {
    const angle = (i * 2 * Math.PI) / halfN
    positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
  }
  for (let i = halfN; i < n; i++) {
    const angle = ((i - halfN) * 2 * Math.PI) / (n - halfN)
    positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
  }
  return positions
}

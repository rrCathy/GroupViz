/**
 * 「元素 → 旋转」映射的**法则型**性质测试工具（law-based oracle）。
 *
 * 为什么需要它
 * ------------
 * 2026-09-10 的 rotation-axis bug：`elementRotation.ts` 用 `hash(element.id) % n`
 * 从候选轴表里挑轴。它**不崩溃、类型正确、角度也对**，只是轴和元素的置换无关——
 * A₄/A₅ 全部置换的 id 等长同字符集，于是 8 个三循环全塌到同一根轴、同一方向。
 * 这类「值看着对、语义错」的缺陷，示例测试（断言「非空」「角度 = π」）必然漏过，
 * code review 也拦不住（hash 选轴读起来像个合理的确定性回退）。
 *
 * 出路是把**数学事实**编码成断言，而不是提高审查强度。下面的法则全部
 * **不依赖任何已知答案表**——它们只要求映射满足数学结构本身：
 *
 *   L1  已定义        每个元素都能拿到旋转（映射覆盖完整）
 *   L2  单位轴        |axis| = 1
 *   L3  轴不动        R·axis = axis（轴与角互相自洽）
 *   L4  角度范围      |θ| ≤ 2π
 *   L5  固有旋转      det R = +1 且 RᵀR = I（sanity）
 *   L6  迹-角一致     cos θ = (tr R − 1) / 2
 *   L7  群同态 ★      R(gh) = R(g)·R(h)，遍历所有元素对
 *   L8  逆元          R(g⁻¹) = R(g)⁻¹（同轴反角）
 *   L9  阶            R(g)^{ord(g)} = I
 *   L10 旋转阶=元素阶 ord(R(g)) = ord(g)
 *   L11 单射 ★        不同元素 ↦ 不同旋转（不撞桶）
 *
 * ★ = 两条「杀手锏」。只做 L9 是不够的：hash 实现给三循环统一 +120°，R³ = I
 * 照样成立；只有 L7/L11 能把「所有三循环同一根轴」判成错。
 *
 * 用法
 * ----
 *   const v = checkRotationLaws(group)
 *   expect(v, formatViolations(group, v)).toEqual([])
 *
 * 换映射只需传 `rotationFn`（见 `elementRotationLaws.test.ts` 的负向对照）。
 */

import type { Group, GroupElement } from '../../core/types'
import { computeElementRotation, type RotationInfo } from '../../core/elementRotation'
import { elementOrder } from '../../core/algebra/elementOrder'

export type Mat3 = number[][]

const IDENTITY_MAT: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

/** 数值容差。旋转量纲为 1，1e-6 远大于 double 噪声、远小于任何真实差异。 */
export const LAW_EPS = 1e-6

/* ----------------------------- 线性代数小工具 ----------------------------- */

export function matMul(a: Mat3, b: Mat3): Mat3 {
  return a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]))
}

export function matPow(m: Mat3, k: number): Mat3 {
  let r: Mat3 = IDENTITY_MAT
  for (let i = 0; i < k; i++) r = matMul(r, m)
  return r
}

export function transpose(m: Mat3): Mat3 {
  return [0, 1, 2].map(i => [m[0][i], m[1][i], m[2][i]])
}

export function det3(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  )
}

export function matVec(m: Mat3, v: readonly number[]): number[] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

export function matMaxDiff(a: Mat3, b: Mat3): number {
  let m = 0
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) m = Math.max(m, Math.abs(a[i][j] - b[i][j]))
  }
  return m
}

/** 轴角 → 旋转矩阵（被检对象通常已有轴角，这里反推回矩阵来验证结构）。 */
export function rodrigues(axis: readonly number[], angleRad: number): Mat3 {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const x = axis[0] / len
  const y = axis[1] / len
  const z = axis[2] / len
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  const C = 1 - c
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ]
}

/* ----------------------------- 置换工具 ----------------------------- */

/** 非平凡循环的长度（升序），如 (12)(345) → [2, 3]。 */
export function cyclesOf(value: readonly number[]): number[] {
  const n = value.length
  const visited = new Array<boolean>(n).fill(false)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    let len = 0
    let j = i
    while (j >= 0 && j < n && !visited[j]) {
      visited[j] = true
      const next = value[j] - 1
      if (!Number.isInteger(next) || next < 0 || next >= n) break
      j = next
      len++
    }
    if (len > 1) out.push(len)
  }
  return out.sort((a, b) => a - b)
}

/** 循环型字符串，如 '3'、'2-2'、'1'（恒等）。 */
export function cycleTypeOf(value: readonly number[]): string {
  return cyclesOf(value).join('-') || '1'
}

/** 轴向去重键：±v 视为同一根轴（首非零分量取正）。 */
export function axisKeyOf(axis: readonly number[]): string {
  const r = axis.map(x => Math.round(x * 1e6) / 1e6)
  const first = r.find(v => Math.abs(v) > 1e-9)
  const canon = first !== undefined && first < 0 ? r.map(x => -x) : r
  return canon.join(',')
}

/* ----------------------------- 映射取样 ----------------------------- */

export type RotationFn = (group: Group, element: GroupElement) => RotationInfo | null

export interface SampledRotation {
  el: GroupElement
  axis: number[]
  angleRad: number
  R: Mat3
}

/** 采样一个元素的旋转。映射返回 null 时也给出来，交给 L1 判。 */
export function rotationOf(
  group: Group,
  el: GroupElement,
  rotationFn: RotationFn = computeElementRotation,
): SampledRotation | null {
  const info = rotationFn(group, el)
  if (!info) return null
  return {
    el,
    axis: [info.axis[0], info.axis[1], info.axis[2]],
    angleRad: info.angleRad,
    R: rodrigues(info.axis, info.angleRad),
  }
}

/** 采样整群（映射未覆盖的元素被丢弃，L1 会另行报告）。 */
export function rotationsOf(group: Group, rotationFn: RotationFn = computeElementRotation): SampledRotation[] {
  return group.elements
    .map(el => rotationOf(group, el, rotationFn))
    .filter((r): r is SampledRotation => r !== null)
}

/* ----------------------------- 法则检查 ----------------------------- */

export interface Violation {
  law: string
  detail: string
}

export interface LawOptions {
  /** 是否检查单射（L11）。默认 true——「撞桶」正是 2026-09-10 bug 的形态。 */
  faithful?: boolean
  /** 被检映射，默认 `computeElementRotation`。 */
  rotationFn?: RotationFn
}

/**
 * 跑全部法则，返回违规清单（空数组 = 全部通过）。
 *
 * 返回清单而非直接断言，是为了让调用方能打印出**可读的失败报告**，
 * 也便于把同一个 harness 复用到别的「元素 → 数学对象」映射上。
 */
export function checkRotationLaws(group: Group, opts: LawOptions = {}): Violation[] {
  const rotationFn = opts.rotationFn ?? computeElementRotation
  const v: Violation[] = []
  const R = new Map<string, Mat3>()
  const ord = new Map<string, number>()
  const name = (el: GroupElement) => el.label || el.id

  for (const el of group.elements) {
    const sampled = rotationOf(group, el, rotationFn)
    if (!sampled) {
      v.push({ law: 'L1 已定义', detail: `${name(el)} → null（映射未覆盖此元素）` })
      continue
    }
    const { axis, angleRad, R: m } = sampled
    R.set(el.id, m)
    ord.set(el.id, elementOrder(group, el))

    const axisLen = Math.hypot(axis[0], axis[1], axis[2])
    if (Math.abs(axisLen - 1) > LAW_EPS) {
      v.push({ law: 'L2 单位轴', detail: `${name(el)} |axis| = ${axisLen}` })
    }

    const image = matVec(m, axis)
    const fixedDiff = Math.max(
      Math.abs(image[0] - axis[0]),
      Math.abs(image[1] - axis[1]),
      Math.abs(image[2] - axis[2]),
    )
    if (fixedDiff > LAW_EPS) {
      v.push({ law: 'L3 轴不动', detail: `${name(el)} R·axis 与 axis 偏差 ${fixedDiff.toExponential(2)}` })
    }

    if (!(Math.abs(angleRad) <= 2 * Math.PI + 1e-9)) {
      v.push({ law: 'L4 角度范围', detail: `${name(el)} |θ| = ${Math.abs(angleRad)} > 2π` })
    }

    const det = det3(m)
    if (Math.abs(det - 1) > LAW_EPS) {
      v.push({ law: 'L5 固有旋转', detail: `${name(el)} det R = ${det}` })
    }
    const orthoDiff = matMaxDiff(matMul(transpose(m), m), IDENTITY_MAT)
    if (orthoDiff > LAW_EPS) {
      v.push({ law: 'L5 固有旋转', detail: `${name(el)} RᵀR ≠ I，偏差 ${orthoDiff.toExponential(2)}` })
    }

    const cosFromTrace = (m[0][0] + m[1][1] + m[2][2] - 1) / 2
    if (Math.abs(cosFromTrace - Math.cos(angleRad)) > LAW_EPS) {
      v.push({
        law: 'L6 迹-角一致',
        detail: `${name(el)} (tr R−1)/2 = ${cosFromTrace}，cos θ = ${Math.cos(angleRad)}`,
      })
    }
  }

  // L7 群同态：R(gh) = R(g)R(h)。遍历全部元素对（有限群，穷举比随机采样强）。
  for (const a of group.elements) {
    const ra = R.get(a.id)
    if (!ra) continue
    for (const b of group.elements) {
      const rb = R.get(b.id)
      if (!rb) continue
      const product = group.multiply(a, b)
      const rab = R.get(product.id)
      if (!rab) continue
      const diff = matMaxDiff(rab, matMul(ra, rb))
      if (diff > LAW_EPS) {
        v.push({
          law: 'L7 群同态',
          detail: `R(${name(a)}·${name(b)}) ≠ R(${name(a)})·R(${name(b)})，偏差 ${diff.toExponential(2)}`,
        })
      }
    }
  }

  // L8 逆元：R(g⁻¹) = R(g)⁻¹
  for (const el of group.elements) {
    const m = R.get(el.id)
    if (!m) continue
    const inv = group.inverse(el)
    const rInv = R.get(inv.id)
    if (!rInv) continue
    // 正交阵的逆 = 转置
    const diff = matMaxDiff(rInv, transpose(m))
    if (diff > LAW_EPS) {
      v.push({
        law: 'L8 逆元',
        detail: `R(${name(inv)}) ≠ R(${name(el)})⁻¹，偏差 ${diff.toExponential(2)}`,
      })
    }
  }

  // L9 阶：R(g)^ord(g) = I    L10 旋转阶 = 元素阶
  for (const el of group.elements) {
    const m = R.get(el.id)
    const k = ord.get(el.id)
    if (!m || k === undefined) continue
    if (matMaxDiff(matPow(m, k), IDENTITY_MAT) > LAW_EPS) {
      v.push({ law: 'L9 阶', detail: `R(${name(el)})^{${k}} ≠ I（元素阶 = ${k}）` })
    }
    let rotationOrder = 1
    while (rotationOrder <= group.order && matMaxDiff(matPow(m, rotationOrder), IDENTITY_MAT) > LAW_EPS) {
      rotationOrder++
    }
    if (rotationOrder !== k) {
      v.push({ law: 'L10 旋转阶=元素阶', detail: `${name(el)} 元素阶 = ${k}，旋转阶 = ${rotationOrder}` })
    }
  }

  // L11 单射：不同元素 ↦ 不同旋转（撞桶检测，直击 2026-09-10 bug）
  if (opts.faithful !== false) {
    for (let i = 0; i < group.elements.length; i++) {
      const a = group.elements[i]
      const ra = R.get(a.id)
      if (!ra) continue
      for (let j = i + 1; j < group.elements.length; j++) {
        const b = group.elements[j]
        const rb = R.get(b.id)
        if (!rb) continue
        if (matMaxDiff(ra, rb) <= LAW_EPS) {
          v.push({ law: 'L11 单射', detail: `${name(a)} 与 ${name(b)} 映射到同一旋转（撞桶）` })
        }
      }
    }
  }

  return v
}

/** 把违规清单压成可读报告（按法则归并，每类最多列 3 条）。 */
export function formatViolations(group: Group, violations: readonly Violation[]): string {
  if (violations.length === 0) return `${group.symbol}：全部法则通过`
  const byLaw = new Map<string, string[]>()
  for (const { law, detail } of violations) {
    const list = byLaw.get(law) ?? []
    list.push(detail)
    byLaw.set(law, list)
  }
  const body = [...byLaw.entries()]
    .map(([law, details]) => {
      const shown = details.slice(0, 3).map(d => `      · ${d}`).join('\n')
      const more = details.length > 3 ? `\n      · …同类共 ${details.length} 处` : ''
      return `  [${law}] ${details.length} 处\n${shown}${more}`
    })
    .join('\n')
  return `${group.symbol} 违反 ${byLaw.size} 条法则（共 ${violations.length} 处）：\n${body}`
}

/** 按循环型统计「不同轴数 / 元素数」，用于数学常数 oracle。 */
export function axisStatsByCycleType(group: Group, rotationFn: RotationFn = computeElementRotation): Map<string, { axes: Set<string>; count: number }> {
  const out = new Map<string, { axes: Set<string>; count: number }>()
  for (const el of group.elements) {
    const sampled = rotationOf(group, el, rotationFn)
    if (!sampled) continue
    const ct = cycleTypeOf(el.value)
    const entry = out.get(ct) ?? { axes: new Set<string>(), count: 0 }
    if (Math.abs(sampled.angleRad) > LAW_EPS) entry.axes.add(axisKeyOf(sampled.axis))
    entry.count++
    out.set(ct, entry)
  }
  return out
}

/** 该群映射到的不同旋转个数（= 像的势）。满单射时等于群阶。 */
export function distinctRotationCount(group: Group, rotationFn: RotationFn = computeElementRotation): number {
  const seen: Mat3[] = []
  for (const sampled of rotationsOf(group, rotationFn)) {
    if (!seen.some(m => matMaxDiff(m, sampled.R) <= LAW_EPS)) seen.push(sampled.R)
  }
  return seen.length
}

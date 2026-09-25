import type { Group, GroupElement } from '../types'
import { ENUMERATION_LIMIT } from '../guards'
import { elementOrder } from './elementOrder'
import { getConjugacyClasses, getGroupCenter } from './subgroups/conjugacy'
import { suggestQuotientSubgroup } from './subgroups/quotient'

/**
 * 节点语义装饰 —— **纯计算**（VCL 的 F 组能力）。
 *
 * 「共轭类着色 / 元素阶 / ⟨g⟩ 闭包 / 中心与最小正规子群标记」这四类装饰的数学内容
 * 全部在此算完，渲染层只负责把结果画成颜色 / 徽标 / 外圈。零 UI 依赖、可序列化无关。
 *
 * 边界纪律：与 `subgroups/conjugacy` 一样受 `ENUMERATION_LIMIT`（144 阶）约束 ——
 * 超限时该模块返回**退化但可用**的结果（共轭类退化为单元素类、中心退化为 {e}），
 * 不抛错、不阻塞渲染；调用方无需额外判阶。
 */

/** 共轭类调色板：按色相均分，奇偶类明度错开（相邻类在暗/亮主题下都能分辨） */
export function conjugacyClassColor(classIndex: number, classCount: number): string {
  const n = Math.max(1, classCount)
  const hue = (360 * classIndex) / n
  const light = 54 + 9 * (classIndex % 2)
  return `hsl(${hue.toFixed(1)}, 62%, ${light}%)`
}

/**
 * 元素 id → 共轭类序号（0 起）。
 *
 * 类序由 `getConjugacyClasses` 的产出顺序决定（沿 `group.elements` 迭代、首次遇到
 * 未归属元素即开新类）⇒ 同一群每次调用结果一致，可安全用于渲染与预设。
 *
 * 注意：**交换群的共轭类全是单元素类**，此时每元素各占一色（与逐元素彩虹配色同观感）
 * —— 这是数学事实而非退化 bug，面板上以「N classes」读数如实呈现。
 */
export function conjugacyClassIndexMap(group: Group): Map<string, number> {
  const map = new Map<string, number>()
  const classes = getConjugacyClasses(group)
  classes.forEach((cls, i) => {
    for (const el of cls) map.set(el.id, i)
  })
  return map
}

/** 共轭类总数（与 `conjugacyClassIndexMap` 同口径） */
export function conjugacyClassCount(group: Group): number {
  return getConjugacyClasses(group).length
}

/**
 * 元素 `g` 生成的循环子群 ⟨g⟩ 的元素列表。
 *
 * 顺序为幂次序 `[e, g, g², …, g^(ord−1)]`（不是群元素序）——渲染层按它连成环时
 * 天然是「一条边走一圈」的循环图，无需再排序。元素阶为 1（g = e）时只返回 [e]。
 */
export function cyclicSubgroupElements(group: Group, element: GroupElement): GroupElement[] {
  const ord = elementOrder(group, element)
  if (!Number.isFinite(ord) || ord <= 0) return [group.identity]
  const out: GroupElement[] = []
  let cur = group.identity
  for (let k = 0; k < ord; k++) {
    out.push(cur)
    cur = group.multiply(cur, element)
  }
  return out
}

/**
 * 中心 Z(G) 的元素 id 集合。
 *
 * 大群（> `ENUMERATION_LIMIT`）沿用 `getGroupCenter` 的退化口径：交换群返回全群、
 * 非交换群返回 {e} —— 渲染层据此画出的「全体双环」正是「这个群交换」的正确读数。
 */
export function centerElementIds(group: Group): Set<string> {
  return new Set(getGroupCenter(group).map(e => e.id))
}

/**
 * 最小非平凡正规子群 N 的元素 id（升序，与 `suggestQuotientSubgroup` 同策略）。
 *
 * 无可用 N（单群 / 群阶 ≤ 1 / 超 `ENUMERATION_LIMIT`）返回 `null` —— 渲染层不画标记，
 * 不报错。选它作为「正规子群标记」的理由：它是唯一**典则**的候选（不依赖用户选择），
 * 且与商群悬浮窗默认取的 N 是同一个 ⇒ 图上标记与窗内子图天然对得上。
 */
export function smallestNormalSubgroupIds(group: Group): string[] | null {
  if (group.order > ENUMERATION_LIMIT) return null
  const sub = suggestQuotientSubgroup(group, 'smallest')
  if (!sub || sub.elements.length <= 1 || sub.elements.length >= group.order) return null
  return sub.elements.map(e => e.id).sort()
}

/** 逐元素阶映射（徽标渲染用；一次算完避免每帧重复求阶） */
export function elementOrderMap(group: Group): Map<string, number> {
  const m = new Map<string, number>()
  for (const el of group.elements) m.set(el.id, elementOrder(group, el))
  return m
}

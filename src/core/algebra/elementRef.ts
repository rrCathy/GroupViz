import type { Group, GroupElement } from '../types'

/**
 * 元素引用（element reference）解析 —— 面向包消费端的便利层。
 *
 * 背景：`GroupElement` 同时携带两种人类/机器记号——
 *   - `id`    机器键（置换群为逗号串 `"1,3,4,2"`，循环群为幂次串），所有受控 props 都用它；
 *   - `label` 人类记号（置换群为 `(234)`，同构群为 `\alpha_3` …）。
 * 宿主拿 `label` 去填需要 `id` 的 prop（`actionElementId` / `actions[].elementId` /
 * 陪集 H 列表）时，旧实现会**静默查不到**（无告警、动画不动、相机被 showAction 连带锁死）。
 *
 * 本模块让 core 侧统一接受「任一记号」，匹配优先级：
 *   1. `id` 精确（含去空白归一化）—— 保持既有传 id 的宿主零改动；
 *   2. `label` 精确（含去空白归一化）；
 *   3. `value` 归一化（`[1,3,4,2]` → `"1,3,4,2"`，兼容手写置换数组串）。
 * 全都不中返回 `null`，由调用方决定告警/回退，不再静默。
 */

/** 归一化引用：去首尾空白 + 去全部内部空白（`"1, 3, 4, 2"` → `"1,3,4,2"`）。 */
export function normalizeElementRef(ref: string): string {
  return ref.trim().replace(/\s+/g, '')
}

/**
 * 把元素引用解析为群元素；接受 `id` / `label` / `value` 串任一种记号。
 *
 * @param group 目标群（`null`/`undefined` 时直接返回 `null`，便于宿主传可空群）
 * @param ref   元素引用字符串
 * @returns 命中元素；未命中返回 `null`
 */
export function resolveElement(
  group: Group | null | undefined,
  ref: string | null | undefined,
): GroupElement | null {
  if (!group || ref == null) return null
  const raw = String(ref)
  const key = normalizeElementRef(raw)
  if (!key) return null

  for (const el of group.elements) {
    if (el.id === raw || el.id === key) return el
  }
  for (const el of group.elements) {
    if (el.label === raw || el.label === key) return el
  }
  for (const el of group.elements) {
    if (el.value.length > 0 && normalizeElementRef(el.value.join(',')) === key) return el
  }
  return null
}

/**
 * `resolveElement` 的别名 —— 提供反馈中期望的 `findElement(group, ref)` 命名，
 * 便于按名检索（grep）发现该能力。语义与 `resolveElement` 完全一致。
 */
export const findElement = resolveElement

/**
 * 批量解析 + 未命中回收。保持输入顺序，去掉重复项。
 *
 * 用途：`subsets[].elementIds` / 陪集 H 列表 / `actions[]` 这类数组入参一次解析完，
 * 同时拿到「哪些引用没解析到」以便宿主统一 `console.warn`。
 */
export function resolveElementRefs(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
): { elements: GroupElement[]; ids: string[]; unresolved: string[] } {
  const elements: GroupElement[] = []
  const ids: string[] = []
  const unresolved: string[] = []
  const seen = new Set<string>()
  if (!group || !refs) return { elements, ids, unresolved }

  for (const ref of refs) {
    const el = resolveElement(group, ref)
    if (!el) {
      unresolved.push(ref)
      continue
    }
    if (seen.has(el.id)) continue
    seen.add(el.id)
    elements.push(el)
    ids.push(el.id)
  }
  return { elements, ids, unresolved }
}

/**
 * 一次性解析任意元素引用数组为规范 id 数组（丢弃未命中项，重复项去重）。
 * 需要区分未命中时用 `resolveElementRefs`。
 */
export function resolveElementIds(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
): string[] {
  return resolveElementRefs(group, refs).ids
}

/** 反向：取元素的规范 id（已就绪时直接给 `el.id`，此处仅为对称入口）。 */
export function elementRefId(el: GroupElement): string {
  return el.id
}

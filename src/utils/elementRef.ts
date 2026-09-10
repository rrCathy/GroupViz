import type { Group, GroupElement } from '../core/types'
import { resolveElement } from '../core/algebra/elementRef'

/**
 * 元素引用解析的「告警版」——把此前的**静默失败**变成一次可见的 `console.warn`。
 *
 * 用于所有「宿主经 props 传元素引用」的入口（`actionElementId` / `actions[].elementId` /
 * 陪集 H 列表 / `subsets[].elementIds`）：解析不到时不再假装无事发生，而是：
 *   1. 返回 `null`，让组件走「忽略该项」的既有降级路径（渲染不炸，与反馈要求的 warn+忽略一致）；
 *   2. 按 `上下文 + 群 + 引用` 去重后 `console.warn` 一次（避免每帧刷屏）。
 *
 * 需要判断「有没有解析到」但不想告警时，直接用 core 的 `resolveElement`。
 */
const warned = new Set<string>()

/** 清空去重缓存（测试用；宿主一般不需要调用）。 */
export function clearElementRefWarnCache(): void {
  warned.clear()
}

export function resolveElementWarn(
  group: Group | null | undefined,
  ref: string | null | undefined,
  context: string,
): GroupElement | null {
  const el = resolveElement(group, ref)
  if (el) return el
  // 群本身缺席（尚未载入 / 已卸载）或引用为空属正常态，不是错误，不告警
  if (!group || ref == null || ref === '') return null
  const key = `${context}|${group.symbol}|${ref}`
  if (!warned.has(key)) {
    warned.add(key)
    console.warn(
      `[groupviz] ${context}: 元素引用 ${JSON.stringify(ref)} 在群 ${group?.symbol ?? '?'} 中解析不到` +
      `（已试 id / label / value 三种记号），该项已忽略。`
    )
  }
  return null
}

/**
 * 批量解析元素引用（`subsets[].elementIds` / 陪集 H 这类数组入参）。
 * 保留顺序、去重、丢掉未命中项，并逐项走一次去重告警。
 */
export function resolveElementIdsWarn(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
  context: string,
): string[] {
  if (!refs) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const el = resolveElementWarn(group, ref, context)
    if (!el || seen.has(el.id)) continue
    seen.add(el.id)
    out.push(el.id)
  }
  return out
}

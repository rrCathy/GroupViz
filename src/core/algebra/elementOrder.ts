import type { Group, GroupElement } from '../types'
import { computeElementOrder } from './layouts/shared'
import { computeElementOrderInGroup } from './subgroups/detection'

/**
 * 元素阶的**公共便利入口**。
 *
 * core 内部已有两个等价实现，参数序相同但名字易混，且都没挂在 `GroupElement` 上：
 *   - `computeElementOrder(el, group)`            （`algebra/layouts/shared`，布局用）
 *   - `computeElementOrderInGroup(el, group)`     （`algebra/subgroups/detection`，检测用）
 * 包消费端只想要「这个元素的阶」，却要先在类型定义里翻到这两个名字之一。
 *
 * 本函数提供与 store 其它公共 API 一致的 **group-first** 签名，作为对外唯一推荐入口；
 * 原两个函数保留（内部与既有宿主继续可用）。
 */

/** 元素阶。`elementOrder(group, el)`。 */
export function elementOrder(group: Group, element: GroupElement): number {
  return computeElementOrder(element, group)
}

/** 按阶分组的元素多重集（元素 → 该阶元素的个数）。等价于 `detection` 内私有实现的公开版。 */
export function elementOrderDistribution(group: Group): Map<number, number> {
  return elementOrderDistributionOf(group.elements, group)
}

/** 对任意元素子集（如某个子群/陪集）求阶分布。 */
export function elementOrderDistributionOf(
  elements: readonly GroupElement[],
  group: Group,
): Map<number, number> {
  const dist = new Map<number, number>()
  for (const el of elements) {
    const ord = computeElementOrderInGroup(el, group)
    dist.set(ord, (dist.get(ord) ?? 0) + 1)
  }
  return dist
}

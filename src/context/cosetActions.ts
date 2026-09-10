import type { Group, Subset } from '../core/types'
import { SUBSET_COLORS } from '../core/types'
import type { CosetInfo } from '../core/algebra/subgroups'
import { computeCosets } from '../core/algebra/subgroups'
import { subgroupFromElementIds } from '../core/algebra/cosetView'

/**
 * 主应用陪集装配层。
 *
 * 注意：三件套（`computeCosetElementMap` / `computeCosetColors` /
 * `computeCosetHighlightSet`）的**实现已下沉到 `@groupviz/core`**
 * （`core/algebra/cosetView.ts`），此处仅转发以保持主应用既有 import 路径稳定；
 * 包消费端应直接从 `@groupviz/core` 取用，或更省事地用 `buildCosetViewData` 一键装配。
 */
export {
  computeCosetElementMap,
  computeCosetColors,
  computeCosetHighlightSet,
} from '../core/algebra/cosetView'

export function computeCosetData(
  currentGroup: Group | null,
  cosetSubsetId: string | null,
  subsets: Subset[],
  cosetSubgroupElementIds?: string[] | null
): CosetInfo | null {
  if (!currentGroup) return null

  let elementIds: string[] | undefined
  let isNormal = false

  if (cosetSubgroupElementIds && cosetSubgroupElementIds.length > 0) {
    elementIds = cosetSubgroupElementIds
  } else if (cosetSubsetId) {
    const subset = subsets.find(s => s.id === cosetSubsetId)
    if (!subset || !subset.isSubgroup) return null
    elementIds = subset.elementIds
    isNormal = subset.isNormalSubgroup
  }

  if (!elementIds || elementIds.length === 0) return null

  // validate:false + computeGenerators:false —— 与历史行为逐位对齐（此处不重复做闭包校验，
  // 子群合法性由调用方（subset 判定 / findCosetStripSubgroup）保证），避免热路径额外开销。
  const subgroup = subgroupFromElementIds(currentGroup, elementIds, {
    isNormal,
    validate: false,
    computeGenerators: false,
  })
  if (!subgroup) return null
  return computeCosets(currentGroup, subgroup)
}

let _subsetNextId = 1

export function createSubset(
  elementIds: string[],
  result: { type: string; label: string; color: string },
  _existingCount: number
): Subset {
  return {
    id: `subset-${_subsetNextId++}`,
    elementIds,
    label: result.label,
    color: SUBSET_COLORS[(_subsetNextId - 1) % SUBSET_COLORS.length],
    isSubgroup: result.type === 'subgroup' || result.type === 'normal-subgroup',
    isNormalSubgroup: result.type === 'normal-subgroup',
    type: result.type as Subset['type'],
  }
}

import type { Group, GroupElement, Subset } from '../core/types'
import { SUBSET_COLORS, COSET_COLORS } from '../core/types'
import { computeCosets, type Subgroup, type CosetInfo } from '../core/algebra/subgroups'

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

  const subgroupElements = elementIds
    .map(id => currentGroup.elements.find(e => e.id === id))
    .filter((el): el is GroupElement => el !== undefined)
  if (subgroupElements.length === 0) return null
  const subgroup: Subgroup = {
    elements: subgroupElements,
    order: subgroupElements.length,
    index: currentGroup.order / subgroupElements.length,
    generators: [],
    isNormal,
  }
  return computeCosets(currentGroup, subgroup)
}

export function computeCosetElementMap(
  cosetData: CosetInfo | null,
  cosetType: 'left' | 'right'
): Map<string, number> {
  const map = new Map<string, number>()
  if (!cosetData) return map
  const cosets = cosetType === 'left' ? cosetData.leftCosets : cosetData.rightCosets
  cosets.forEach((coset, idx) => {
    coset.forEach(el => map.set(el.id, idx))
  })
  return map
}

export function computeCosetColors(
  cosetData: CosetInfo | null,
  cosetType: 'left' | 'right'
): string[] {
  if (!cosetData) return []
  const count = cosetType === 'left' ? cosetData.leftCosets.length : cosetData.rightCosets.length
  return Array.from({ length: count }, (_, i) => COSET_COLORS[i % COSET_COLORS.length])
}

export function computeCosetHighlightSet(
  cosetData: CosetInfo | null,
  cosetType: 'left' | 'right',
  showAllCosets: boolean,
  selectedElements: Set<string>,
  cosetElementMap: Map<string, number>
): Set<number> {
  const set = new Set<number>()
  if (!cosetData) return set
  if (showAllCosets) {
    const count = cosetType === 'left' ? cosetData.leftCosets.length : cosetData.rightCosets.length
    for (let i = 0; i < count; i++) set.add(i)
  } else {
    for (const id of selectedElements) {
      const idx = cosetElementMap.get(id)
      if (idx !== undefined) set.add(idx)
    }
  }
  return set
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

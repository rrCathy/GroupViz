import type { Group } from '../../core/types'
import { computeQuotientGroup, type Subgroup } from '../../core/algebra/subgroups'
import { createGroupFromSymbol } from '../../utils/groupFactory'

const STORAGE_KEY = 'groupviz-quotients'

interface StoredQuotient {
  id: string
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}

export function saveQuotientsToStorage(entries: Array<{
  id: string
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}>): void {
  try {
    const stored: StoredQuotient[] = entries.map(e => ({
      id: e.id,
      parentSymbol: e.parentSymbol,
      normalSubgroupElementIds: e.normalSubgroupElementIds,
      normalSubgroupLabel: e.normalSubgroupLabel,
      order: e.order,
      isoSymbol: e.isoSymbol,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

export function loadAndReconstructQuotients(): Array<{
  id: string
  group: Group
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored: StoredQuotient[] = JSON.parse(raw)
    const results: Array<{
      id: string
      group: Group
      parentSymbol: string
      normalSubgroupElementIds: string[]
      normalSubgroupLabel: string
      order: number
      isoSymbol: string | null
    }> = []

    for (const s of stored) {
      const parentGroup = createGroupFromSymbol(s.parentSymbol)
      if (!parentGroup) continue

      if (!s.normalSubgroupElementIds) continue
      const subgroupElements = s.normalSubgroupElementIds
        .map(id => parentGroup.elements.find(e => e.id === id))
        .filter((e): e is import('../../core/types').GroupElement => e !== undefined)

      if (subgroupElements.length === 0) continue

      const normalSubgroup: Subgroup = {
        elements: subgroupElements,
        order: subgroupElements.length,
        index: parentGroup.order / subgroupElements.length,
        generators: [],
        isNormal: true,
      }

      const quotientGroup = computeQuotientGroup(parentGroup, normalSubgroup)
      if (!quotientGroup) continue

      quotientGroup.isoSymbol = s.isoSymbol ?? undefined

        results.push({
          id: s.id,
          group: quotientGroup,
          parentSymbol: s.parentSymbol,
          normalSubgroupElementIds: quotientGroup.normalSubgroupElementIds ?? [],
          normalSubgroupLabel: s.normalSubgroupLabel,
          order: quotientGroup.order,
          isoSymbol: s.isoSymbol,
        })
    }

    return results
  } catch { /* ignore */ }
  return []
}

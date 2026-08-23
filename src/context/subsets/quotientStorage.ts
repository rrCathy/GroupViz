import { z } from 'zod'
import type { Group } from '../../core/types'
import { computeQuotientGroup, type Subgroup } from '../../core/algebra/subgroups'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import {
  loadStoredArray,
  saveStoredJson,
} from '../../utils/persistence'

export const QUOTIENTS_STORAGE_KEY = 'groupviz-quotients'

interface StoredQuotient {
  id: string
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}

/** 共享 entry schema：GroupSubsetContext 的会话内恢复读取同一 key（逐条校验）。 */
export const storedQuotientEntrySchema = z.object({
  id: z.string(),
  parentSymbol: z.string(),
  normalSubgroupElementIds: z.array(z.string()),
  normalSubgroupLabel: z.string(),
  isoSymbol: z.string().nullable(),
})

const fullStoredQuotientSchema = z.object({
  id: z.string(),
  parentSymbol: z.string(),
  normalSubgroupElementIds: z.array(z.string()),
  normalSubgroupLabel: z.string(),
  order: z.number(),
  isoSymbol: z.string().nullable(),
})

export function saveQuotientsToStorage(entries: Array<{
  id: string
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}>): void {
  const stored: StoredQuotient[] = entries.map(e => ({
    id: e.id,
    parentSymbol: e.parentSymbol,
    normalSubgroupElementIds: e.normalSubgroupElementIds,
    normalSubgroupLabel: e.normalSubgroupLabel,
    order: e.order,
    isoSymbol: e.isoSymbol,
  }))
  saveStoredJson(QUOTIENTS_STORAGE_KEY, stored)
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
  const stored = loadStoredArray(QUOTIENTS_STORAGE_KEY, fullStoredQuotientSchema) as StoredQuotient[]
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
}

import { z } from 'zod'
import type { Group } from '../../core/types'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { createAutomorphismGroup } from '../../core/algebra/automorphisms'
import { loadStoredArray, saveStoredJson } from '../../utils/persistence'

export const AUTOMORPHISMS_STORAGE_KEY = 'groupviz-automorphisms'

interface StoredAutomorphism {
  id: string
  parentSymbol: string
  order: number
  isoSymbol: string | null
}

/** 共享 entry schema：GroupSubsetContext 的会话内恢复读取同一 key（逐条校验）。 */
export const storedAutomorphismEntrySchema = z.object({
  id: z.string(),
  parentSymbol: z.string(),
  isoSymbol: z.string().nullable(),
})

const fullStoredSchema = z.object({
  id: z.string(),
  parentSymbol: z.string(),
  order: z.number(),
  isoSymbol: z.string().nullable(),
})

export function saveAutomorphismsToStorage(entries: Array<{
  id: string
  parentSymbol: string
  order: number
  isoSymbol: string | null
}>): void {
  const stored: StoredAutomorphism[] = entries.map(e => ({
    id: e.id,
    parentSymbol: e.parentSymbol,
    order: e.order,
    isoSymbol: e.isoSymbol,
  }))
  saveStoredJson(AUTOMORPHISMS_STORAGE_KEY, stored)
}

export function loadAndReconstructAutomorphisms(): Array<{
  id: string
  group: Group
  parentSymbol: string
  order: number
  isoSymbol: string | null
}> {
  const stored = loadStoredArray(AUTOMORPHISMS_STORAGE_KEY, fullStoredSchema) as StoredAutomorphism[]
  const results: Array<{
    id: string
    group: Group
    parentSymbol: string
    order: number
    isoSymbol: string | null
  }> = []

  for (const s of stored) {
    const parentGroup = createGroupFromSymbol(s.parentSymbol)
    if (!parentGroup) continue

    const autoGroup = createAutomorphismGroup(parentGroup)
    if (!autoGroup) continue

    autoGroup.isoSymbol = s.isoSymbol ?? undefined

    results.push({
      id: s.id,
      group: autoGroup,
      parentSymbol: s.parentSymbol,
      order: autoGroup.order,
      isoSymbol: s.isoSymbol,
    })
  }

  return results
}

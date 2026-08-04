import type { Group } from '../../core/types'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { createAutomorphismGroup } from '../../core/algebra/automorphisms'

const STORAGE_KEY = 'groupviz-automorphisms'

interface StoredAutomorphism {
  id: string
  parentSymbol: string
  order: number
  isoSymbol: string | null
}

export function saveAutomorphismsToStorage(entries: Array<{
  id: string
  parentSymbol: string
  order: number
  isoSymbol: string | null
}>): void {
  try {
    const stored: StoredAutomorphism[] = entries.map(e => ({
      id: e.id,
      parentSymbol: e.parentSymbol,
      order: e.order,
      isoSymbol: e.isoSymbol,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

export function loadAndReconstructAutomorphisms(): Array<{
  id: string
  group: Group
  parentSymbol: string
  order: number
  isoSymbol: string | null
}> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored: StoredAutomorphism[] = JSON.parse(raw)
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
  } catch { /* ignore */ }
  return []
}

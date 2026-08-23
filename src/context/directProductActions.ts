import type { Group } from '../core/types'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createGroupFromSymbol } from '../utils/groupFactory'
import { loadStoredJson, saveStoredJson } from '../utils/persistence'
import { z } from 'zod'

const DP_STORAGE_KEY = 'groupviz-dp-groups'

const symbolsSchema = z.array(z.string())

export function loadDirectProductGroupsFromStorage(): Group[] {
  const symbols = loadStoredJson(DP_STORAGE_KEY, symbolsSchema)
  if (!symbols) return []
  const uniqueSymbols = Array.from(new Set(symbols))
  return uniqueSymbols.map(s => createGroupFromSymbol(s)).filter(Boolean) as Group[]
}

export function saveDirectProductGroupsToStorage(groups: Group[]): void {
  const symbols = groups.map(g => g.symbol)
  saveStoredJson(DP_STORAGE_KEY, symbols)
}

export function deduplicateGroups(groups: Group[]): Group[] {
  const seen = new Map<string, Group>()
  for (const g of groups) seen.set(g.symbol, g)
  return Array.from(seen.values())
}

export function executeDirectProductHelper(
  source: Group | null,
  target: Group | null
): { group: Group | null; error?: string } {
  if (!source || !target) {
    return { group: null, error: 'dp.selectBoth' }
  }
  const order = source.order * target.order
  if (order > 144) {
    return { group: null, error: 'dp.orderTooLarge' }
  }
  try {
    return { group: createDirectProduct(source, target) }
  } catch {
    return { group: null, error: 'dp.createFailed' }
  }
}

export function updateDirectProductGroupsHelper(
  prev: Group[],
  value: Group[] | ((prev: Group[]) => Group[])
): Group[] {
  const raw = typeof value === 'function' ? value(prev) : value
  const next = deduplicateGroups(raw)
  saveDirectProductGroupsToStorage(next)
  return next
}

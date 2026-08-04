import type { Group } from '../core/types'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createGroupFromSymbol } from '../utils/groupFactory'

const DP_STORAGE_KEY = 'groupviz-dp-groups'

export function loadDirectProductGroupsFromStorage(): Group[] {
  try {
    const raw = localStorage.getItem(DP_STORAGE_KEY)
    if (raw) {
      const symbols: string[] = JSON.parse(raw)
      const uniqueSymbols = Array.from(new Set(symbols))
      return uniqueSymbols.map(s => createGroupFromSymbol(s)).filter(Boolean) as Group[]
    }
  } catch { /* ignore */ }
  return []
}

export function saveDirectProductGroupsToStorage(groups: Group[]): void {
  try {
    const symbols = groups.map(g => g.symbol)
    localStorage.setItem(DP_STORAGE_KEY, JSON.stringify(symbols))
  } catch { /* ignore */ }
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

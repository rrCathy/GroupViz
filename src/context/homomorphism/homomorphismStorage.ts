import type { Homomorphism, HomomorphismResult } from '../../core/types'
import { createGroupFromSymbol } from '../../utils/groupFactory'

const HOMO_STORAGE_KEY = 'groupviz-homomorphisms'

interface StoredHomomorphism {
  id: string
  sourceSymbol: string
  targetSymbol: string
  mapping: Record<string, string>
  result?: HomomorphismResult
  name?: string
}

export function loadHomomorphismsFromStorage(): Homomorphism[] {
  try {
    const raw = localStorage.getItem(HOMO_STORAGE_KEY)
    if (!raw) return []
    const stored: StoredHomomorphism[] = JSON.parse(raw)
    return stored
      .map(s => {
        const source = createGroupFromSymbol(s.sourceSymbol)
        const target = createGroupFromSymbol(s.targetSymbol)
        if (!source || !target) return null
        return {
          id: s.id,
          source,
          target,
          mapping: new Map(Object.entries(s.mapping)),
          result: s.result,
          name: s.name,
        } as Homomorphism
      })
      .filter(Boolean) as Homomorphism[]
  } catch { /* ignore */ }
  return []
}

export function saveHomomorphismsToStorage(homomorphisms: Homomorphism[]): void {
  try {
    const stored: StoredHomomorphism[] = homomorphisms.map(h => ({
      id: h.id,
      sourceSymbol: h.source.symbol,
      targetSymbol: h.target.symbol,
      mapping: Object.fromEntries(h.mapping),
      result: h.result,
      name: h.name,
    }))
    localStorage.setItem(HOMO_STORAGE_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

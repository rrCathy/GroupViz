import type { GroupActionArrow } from '../../core/types'

const ACTIONS_STORAGE_KEY = 'groupviz-actions'

export interface StoredGroupAction {
  id: string
  symbol: string
  setSize: number
  arrows: GroupActionArrow[]
  savedAt: number
}

export function loadGroupActionsFromStorage(): StoredGroupAction[] {
  try {
    const raw = localStorage.getItem(ACTIONS_STORAGE_KEY)
    if (!raw) return []
    const stored: StoredGroupAction[] = JSON.parse(raw)
    return stored.filter(s =>
      typeof s.id === 'string' &&
      typeof s.symbol === 'string' &&
      typeof s.setSize === 'number' &&
      Array.isArray(s.arrows))
  } catch { /* ignore */ }
  return []
}

export function saveGroupActionsToStorage(actions: StoredGroupAction[]): void {
  try {
    localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions))
  } catch { /* ignore */ }
}

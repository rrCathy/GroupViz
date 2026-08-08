import type { GroupActionArrow } from '../../core/types'

const ACTION_DRAFT_KEY = 'groupviz-action-custom-draft'

export interface StoredActionDraft {
  symbol: string
  setSize: number
  arrows: GroupActionArrow[]
  savedAt: number
}

export function loadCustomActionDraft(): StoredActionDraft | null {
  try {
    const raw = localStorage.getItem(ACTION_DRAFT_KEY)
    if (!raw) return null
    const d: StoredActionDraft = JSON.parse(raw)
    if (!d || typeof d.symbol !== 'string' || typeof d.setSize !== 'number' || !Array.isArray(d.arrows)) {
      return null
    }
    return d
  } catch { /* ignore */ }
  return null
}

export function saveCustomActionDraft(draft: StoredActionDraft): void {
  try {
    localStorage.setItem(ACTION_DRAFT_KEY, JSON.stringify(draft))
  } catch { /* ignore */ }
}

export function removeCustomActionDraft(): void {
  try {
    localStorage.removeItem(ACTION_DRAFT_KEY)
  } catch { /* ignore */ }
}

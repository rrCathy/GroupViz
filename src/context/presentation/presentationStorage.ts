import type { Group } from '../../core/types'
import { buildGroupFromPresentation } from '../../core/algebra/presentations'

export interface StoredPresentation {
  id: string
  generators: string[]
  relators: string[]
  symbol: string
}

export interface PresentationDraft {
  text: string
}

const PRESENTATION_STORAGE_KEY = 'groupviz-presentation-groups'
const PRESENTATION_DRAFT_KEY = 'groupviz-presentation-draft'

export function loadPresentationSpecsFromStorage(): StoredPresentation[] {
  try {
    const raw = localStorage.getItem(PRESENTATION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPresentation[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

export function savePresentationSpecsToStorage(specs: StoredPresentation[]): void {
  try {
    localStorage.setItem(PRESENTATION_STORAGE_KEY, JSON.stringify(specs))
  } catch { /* ignore */ }
}

export function reconstructPresentationGroup(spec: StoredPresentation): Group | null {
  try {
    const res = buildGroupFromPresentation({
      generators: spec.generators,
      relators: spec.relators,
    })
    return res.ok && res.group ? res.group : null
  } catch {
    return null
  }
}

export function loadPresentationDraft(): string {
  try {
    const raw = localStorage.getItem(PRESENTATION_DRAFT_KEY)
    if (raw) {
      const d = JSON.parse(raw) as PresentationDraft
      if (typeof d.text === 'string') return d.text
    }
  } catch { /* ignore */ }
  return ''
}

export function savePresentationDraft(text: string): void {
  try {
    localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify({ text }))
  } catch { /* ignore */ }
}

export function removePresentationDraft(): void {
  try {
    localStorage.removeItem(PRESENTATION_DRAFT_KEY)
  } catch { /* ignore */ }
}

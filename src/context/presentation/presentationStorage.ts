import { z } from 'zod'
import type { Group } from '../../core/types'
import { buildGroupFromPresentation } from '../../core/algebra/presentations'
import {
  loadStoredArray,
  loadStoredJson,
  saveStoredJson,
  removeStoredKey,
} from '../../utils/persistence'

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

const storedSpecSchema = z.object({
  id: z.string(),
  generators: z.array(z.string()),
  relators: z.array(z.string()),
  symbol: z.string(),
})

const draftSchema = z.object({ text: z.string() })

export function loadPresentationSpecsFromStorage(): StoredPresentation[] {
  return loadStoredArray(PRESENTATION_STORAGE_KEY, storedSpecSchema)
}

export function savePresentationSpecsToStorage(specs: StoredPresentation[]): void {
  saveStoredJson(PRESENTATION_STORAGE_KEY, specs)
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
  return loadStoredJson(PRESENTATION_DRAFT_KEY, draftSchema)?.text ?? ''
}

export function savePresentationDraft(text: string): void {
  saveStoredJson(PRESENTATION_DRAFT_KEY, { text })
}

export function removePresentationDraft(): void {
  removeStoredKey(PRESENTATION_DRAFT_KEY)
}

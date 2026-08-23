import { z } from 'zod'
import type { GroupActionArrow } from '../../core/types'
import {
  loadStoredJson,
  saveStoredJson,
  removeStoredKey,
} from '../../utils/persistence'

const ACTION_DRAFT_KEY = 'groupviz-action-custom-draft'

export interface StoredActionDraft {
  symbol: string
  setSize: number
  arrows: GroupActionArrow[]
  savedAt: number
}

const arrowSchema: z.ZodType<GroupActionArrow> = z.object({
  generatorId: z.string().nullable(),
  from: z.number(),
  to: z.number(),
})

const storedActionDraftSchema: z.ZodType<StoredActionDraft> = z.object({
  symbol: z.string(),
  setSize: z.number(),
  arrows: z.array(arrowSchema),
  savedAt: z.number(),
})

export function loadCustomActionDraft(): StoredActionDraft | null {
  return loadStoredJson(ACTION_DRAFT_KEY, storedActionDraftSchema)
}

export function saveCustomActionDraft(draft: StoredActionDraft): void {
  saveStoredJson(ACTION_DRAFT_KEY, draft)
}

export function removeCustomActionDraft(): void {
  removeStoredKey(ACTION_DRAFT_KEY)
}

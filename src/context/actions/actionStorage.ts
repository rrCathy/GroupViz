import { z } from 'zod'
import type { GroupActionArrow } from '../../core/types'
import { loadStoredArray, saveStoredJson } from '../../utils/persistence'

const ACTIONS_STORAGE_KEY = 'groupviz-actions'

export interface StoredGroupAction {
  id: string
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

const storedActionSchema: z.ZodType<StoredGroupAction> = z.object({
  id: z.string(),
  symbol: z.string(),
  setSize: z.number(),
  arrows: z.array(arrowSchema),
  savedAt: z.number(),
})

export function loadGroupActionsFromStorage(): StoredGroupAction[] {
  // 逐条校验：坏条目丢弃，合法条目保留（历史语义）
  return loadStoredArray(ACTIONS_STORAGE_KEY, storedActionSchema)
}

export function saveGroupActionsToStorage(actions: StoredGroupAction[]): void {
  saveStoredJson(ACTIONS_STORAGE_KEY, actions)
}

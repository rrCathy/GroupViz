import { z } from 'zod'
import type { Homomorphism, HomomorphismResult } from '../../core/types'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { loadStoredArray, saveStoredJson } from '../../utils/persistence'

const HOMO_STORAGE_KEY = 'groupviz-homomorphisms'

interface StoredHomomorphism {
  id: string
  sourceSymbol: string
  targetSymbol: string
  mapping: Record<string, string>
  result?: HomomorphismResult
  name?: string
}

// result 的完整结构含 violation 数组等运行时字段，历史数据形态多样——
// 这里只做「存在且为对象」级别的校验，具体消费方已自带防御。
const storedHomomorphismSchema: z.ZodType<StoredHomomorphism> = z.object({
  id: z.string(),
  sourceSymbol: z.string(),
  targetSymbol: z.string(),
  mapping: z.record(z.string(), z.string()),
  result: z.record(z.string(), z.unknown()).optional(),
  name: z.string().optional(),
}) as z.ZodType<StoredHomomorphism>

export function loadHomomorphismsFromStorage(): Homomorphism[] {
  // 逐条校验：坏条目（缺 mapping 等）丢弃，合法条目保留
  const stored = loadStoredArray(HOMO_STORAGE_KEY, storedHomomorphismSchema)
  return stored
    .map(s => {
      try {
        const source = createGroupFromSymbol(s.sourceSymbol)
        const target = createGroupFromSymbol(s.targetSymbol)
        if (!source || !target) return null
        return {
          id: s.id,
          source,
          target,
          mapping: new Map(Object.entries(s.mapping)),
          result: s.result as HomomorphismResult | undefined,
          name: s.name,
        } as Homomorphism
      } catch { /* skip corrupt entry */ return null }
    })
    .filter(Boolean) as Homomorphism[]
}

export function saveHomomorphismsToStorage(homomorphisms: Homomorphism[]): void {
  const stored: StoredHomomorphism[] = homomorphisms.map(h => ({
    id: h.id,
    sourceSymbol: h.source.symbol,
    targetSymbol: h.target.symbol,
    mapping: Object.fromEntries(h.mapping),
    result: h.result,
    name: h.name,
  }))
  saveStoredJson(HOMO_STORAGE_KEY, stored)
}

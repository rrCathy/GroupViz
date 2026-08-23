import type { Group } from '../../types'
import { findMinimalGenerators, type Subgroup } from './shared'

export function findAllSubgroups(group: Group, allowLarge = false): Subgroup[] {
  // Short-circuit for large groups to avoid combinatorial explosion
  if (group.order > 60 && !allowLarge) return []

  const n = group.order
  const elems = group.elements

  // Index-based multiplication table + inverse table (much faster than
  // repeated group.multiply / group.inverse calls for large groups)
  const idToIdx = new Map<string, number>()
  for (let i = 0; i < n; i++) idToIdx.set(elems[i].id, i)
  const table: number[][] = new Array(n)
  const invIdx: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const row = new Array(n)
    const ei = elems[i]
    for (let j = 0; j < n; j++) {
      row[j] = idToIdx.get(group.multiply(ei, elems[j]).id) ?? 0
    }
    table[i] = row
    invIdx[i] = idToIdx.get(group.inverse(ei).id) ?? 0
  }

  const subgroups: Subgroup[] = []
  const subgroupKeys = new Set<string>()

  function addSubgroup(idx: number[]): void {
    if (idx.length >= n) return
    const key = idx.sort((a, b) => a - b).join(',')
    if (subgroupKeys.has(key)) return
    subgroupKeys.add(key)
    const elements = idx.map(i => elems[i])
    subgroups.push({
      elements,
      order: elements.length,
      index: n / elements.length,
      generators: findMinimalGenerators(elements, group),
      isNormal: isNormalIdx(idx),
    })
  }

  function closeIdx(seed: number[]): number[] {
    const result: number[] = []
    const resultSet = new Set<number>()
    for (const x of seed) {
      if (!resultSet.has(x)) {
        resultSet.add(x)
        result.push(x)
      }
    }
    let changed = true
    while (changed) {
      changed = false
      const k = result.length
      for (let i = 0; i < k; i++) {
        const ri = result[i]
        const row = table[ri]
        for (let j = i; j < k; j++) {
          const p = row[result[j]]
          if (!resultSet.has(p)) {
            resultSet.add(p)
            result.push(p)
            changed = true
          }
        }
      }
    }
    return result
  }

  function isNormalIdx(sub: number[]): boolean {
    const subSet = new Set(sub)
    for (let i = 0; i < n; i++) {
      const invI = invIdx[i]
      for (const h of sub) {
        if (!subSet.has(table[table[i][h]][invI])) return false
      }
    }
    return true
  }

  // Phase 1: all cyclic subgroups
  for (let gen = 0; gen < n; gen++) {
    const cyc: number[] = []
    const seen = new Set<number>()
    let cur = gen
    while (!seen.has(cur)) {
      seen.add(cur)
      cyc.push(cur)
      cur = table[cur][gen]
    }
    addSubgroup(cyc)
  }

  // Phase 2: pair-join closure — expand to non-cyclic subgroups
  for (let prevCount = -1; subgroups.length !== prevCount;) {
    prevCount = subgroups.length
    const all = subgroups.slice()
    for (let i = 0; i < all.length; i++) {
      const ai = all[i]
      for (let j = i + 1; j < all.length; j++) {
        // Skip pairs whose union already covers the whole group
        if (ai.order + all[j].order >= n) continue
        const join = closeIdx([...ai.elements.map(e => idToIdx.get(e.id)!), ...all[j].elements.map(e => idToIdx.get(e.id)!)])
        addSubgroup(join)
      }
    }
  }

  subgroups.sort((a, b) => a.order - b.order)
  return subgroups
}

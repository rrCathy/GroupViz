import type { Group, GroupElement } from '../../types'
import { computeElementOrderInGroup } from './detection'

export interface Subgroup {
  elements: GroupElement[]
  order: number
  index: number
  generators: GroupElement[]
  isNormal: boolean
}

/** Greedy minimal generating set (largest orders first, for readable labels). */
export function findMinimalGenerators(elements: GroupElement[], group: Group): GroupElement[] {
  const sorted = elements
    .slice()
    .sort((a, b) => computeElementOrderInGroup(b, group) - computeElementOrderInGroup(a, group))
  const gens: GroupElement[] = []
  for (const el of sorted) {
    if (gens.length === 0) {
      gens.push(el)
      continue
    }
    const closure = closeUnderMultiply(group, gens)
    if (closure.some(c => c.id === el.id)) continue
    gens.push(el)
  }
  return gens
}

export function closeUnderMultiply(group: Group, seed: GroupElement[]): GroupElement[] {
  const result: GroupElement[] = []
  const resultSet = new Set<string>()
  for (const el of seed) {
    if (!resultSet.has(el.id)) {
      resultSet.add(el.id)
      result.push(el)
    }
  }
  let changed = true
  while (changed) {
    changed = false
    const cur = result.slice()
    for (let i = 0; i < cur.length; i++) {
      for (let j = 0; j < cur.length; j++) {
        const prod = group.multiply(cur[i], cur[j])
        if (!resultSet.has(prod.id)) {
          resultSet.add(prod.id)
          result.push(prod)
          changed = true
        }
      }
    }
  }
  return result
}

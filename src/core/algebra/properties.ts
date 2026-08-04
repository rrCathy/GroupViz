import type { Group, GroupElement } from '../types'
import { closeUnderMultiply } from './subgroups'

// Group-theoretic properties computed from the multiplication table.
// Local computation is only feasible for small groups (matching the hybrid
// cutoff used by the rest of the algebra layer); larger groups should be
// computed on the backend.

export const PROPERTIES_CUTOFF = 60

export interface GroupProperties {
  derivedSeries: GroupElement[][]
  solvable: boolean
  nilpotent: boolean
  perfect: boolean
}

// [x, y] = x·y·x⁻¹·y⁻¹ for every pair, closed under multiplication.
function commutatorClosure(group: Group, left: GroupElement[], right: GroupElement[]): GroupElement[] {
  const seeds: GroupElement[] = []
  const seedSet = new Set<string>()
  for (const a of left) {
    for (const b of right) {
      const c = group.multiply(group.multiply(group.multiply(a, b), group.inverse(a)), group.inverse(b))
      if (!seedSet.has(c.id)) {
        seedSet.add(c.id)
        seeds.push(c)
      }
    }
  }
  return closeUnderMultiply(group, seeds)
}

function elementsMatch(a: GroupElement[], b: GroupElement[]): boolean {
  if (a.length !== b.length) return false
  const ids = new Set(a.map(e => e.id))
  return b.every(e => ids.has(e.id))
}

/**
 * Computes derived series G ⊇ G′ ⊇ G″ ⊇ … (stops when it stabilizes),
 * solvability, nilpotence (lower central series γ₁=G, γₖ₊₁=[G, γₖ])
 * and perfection (G = G′).
 *
 * Returns null when the group is too large for local computation.
 */
export function computeGroupProperties(group: Group, allowLarge = false): GroupProperties | null {
  if (group.order > PROPERTIES_CUTOFF && !allowLarge) return null

  // Derived series
  const derivedSeries: GroupElement[][] = [group.elements]
  let current = group.elements
  for (;;) {
    const next = commutatorClosure(group, current, current)
    if (elementsMatch(next, current)) break
    derivedSeries.push(next)
    current = next
  }
  const solvable = current.length === 1
  const perfect = derivedSeries.length === 1
    ? current.length === group.order
    : derivedSeries[1].length === group.order

  // Lower central series for nilpotence
  let lower = group.elements
  let nilpotent = true
  for (;;) {
    const next = commutatorClosure(group, group.elements, lower)
    if (next.length === 1) break
    if (elementsMatch(next, lower)) {
      nilpotent = false
      break
    }
    lower = next
  }

  return { derivedSeries, solvable, nilpotent, perfect }
}

export function isSolvable(group: Group): boolean {
  return computeGroupProperties(group)?.solvable ?? false
}

export function isNilpotent(group: Group): boolean {
  return computeGroupProperties(group)?.nilpotent ?? false
}

export function isPerfect(group: Group): boolean {
  return computeGroupProperties(group)?.perfect ?? false
}

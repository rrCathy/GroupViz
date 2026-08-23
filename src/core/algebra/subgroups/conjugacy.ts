import type { Group, GroupElement } from '../../types'

export function getGroupCenter(group: Group, allowLarge = false): GroupElement[] {
  if (group.order > 60 && !allowLarge) return group.isAbelian ? [...group.elements] : [group.identity]
  const center: GroupElement[] = []

  for (const a of group.elements) {
    let commutes = true
    for (const g of group.elements) {
      if (group.multiply(g, a).id !== group.multiply(a, g).id) {
        commutes = false
        break
      }
    }
    if (commutes) center.push(a)
  }

  return center
}

export function getCentralizer(group: Group, elements: GroupElement[]): GroupElement[] {
  if (elements.length === 0) return [...group.elements]
  const result: GroupElement[] = []

  for (const g of group.elements) {
    let centralizes = true
    for (const x of elements) {
      if (group.multiply(g, x).id !== group.multiply(x, g).id) {
        centralizes = false
        break
      }
    }
    if (centralizes) result.push(g)
  }

  return result
}

export function getNormalizer(group: Group, elements: GroupElement[]): GroupElement[] {
  if (elements.length === 0) return [...group.elements]
  const eSet = new Set(elements.map(e => e.id))
  const result: GroupElement[] = []

  for (const g of group.elements) {
    const conjSet = new Set<string>()
    for (const x of elements) {
      conjSet.add(group.multiply(group.multiply(g, x), group.inverse(g)).id)
    }
    if (conjSet.size === eSet.size && [...conjSet].every(id => eSet.has(id))) {
      result.push(g)
    }
  }

  return result
}

export function getConjugacyClasses(group: Group, allowLarge = false): GroupElement[][] {
  if (group.order > 60 && !allowLarge) {
    return group.elements.map(e => [e])
  }
  const classes: GroupElement[][] = []
  const used = new Set<string>()

  for (const a of group.elements) {
    if (used.has(a.id)) continue

    const seen = new Set<string>()
    const conjugates: GroupElement[] = []
    for (const g of group.elements) {
      const conj = group.multiply(group.multiply(g, a), group.inverse(g))
      if (!seen.has(conj.id)) {
        seen.add(conj.id)
        conjugates.push(conj)
        used.add(conj.id)
      }
    }
    classes.push(conjugates)
  }

  return classes
}

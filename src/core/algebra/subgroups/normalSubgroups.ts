import type { Group, GroupElement } from '../../types'
import { type Subgroup, findMinimalGenerators } from './shared'
import { findAllSubgroups } from './enumerate'
import { getConjugacyClasses } from './conjugacy'

export function isSimpleGroup(group: Group): boolean {
  if (group.order <= 1) return false

  if (group.isAbelian) {
    return isPrime(group.order)
  }

  // Short-circuit for large groups to avoid main thread freeze
  if (group.order > 60) return false

  const normalSubgroups = findAllNormalSubgroups(group)
  return normalSubgroups.length <= 2
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n === 2) return true
  if (n % 2 === 0) return false
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false
  }
  return true
}

export function findAllNormalSubgroups(group: Group): Subgroup[] {
  // Short-circuit for large groups to avoid 2^N conjugacy class combinations freeze
  if (group.order > 60) return []

  const classes = getConjugacyClasses(group)
  const identityClass = classes.find(c =>
    c.some(e => e.id === group.identity.id)
  )
  if (!identityClass) return []

  const otherClasses = classes.filter(c => c !== identityClass)

  // JS bitwise shifts operate on 32-bit ints; >=31 classes causes 1<<31 overflow.
  // 2^k subset enumeration freezes the main thread for k >= 20 (e.g. S3 x C10 has
  // 3x10 = 30 conjugacy classes -> 2^29 iterations), so fall back below that.
  if (otherClasses.length >= 20 || group.isAbelian) {
    const all = findAllSubgroups(group)
    const subgs: Subgroup[] = []
    const seen = new Set<string>()
    for (const sg of all) {
      const key = sg.elements.map(e => e.id).sort().join(',')
      if (seen.has(key)) continue
      seen.add(key)
      let isNormal = true
      for (const h of sg.elements) {
        for (const g of group.elements) {
          const conj = group.multiply(group.multiply(g, h), group.inverse(g))
          if (!sg.elements.some(e => e.id === conj.id)) { isNormal = false; break }
        }
        if (!isNormal) break
      }
      // fallback reuses findAllSubgroups which lists ALL subgroups; only normal
      // ones may be returned (mask path only yields normal candidates).
      if (!isNormal) continue
      subgs.push({ ...sg, isNormal })
    }
    // findAllSubgroups excludes the full group; the mask path includes it, so
    // keep both paths consistent (G is always a normal subgroup).
    subgs.push({
      elements: group.elements,
      order: group.order,
      index: 1,
      generators: findMinimalGenerators(group.elements, group),
      isNormal: true,
    })
    return subgs.sort((a, b) => a.order - b.order)
  }

  const normalSubgroups: Subgroup[] = []
  const seen = new Set<string>()

  for (let mask = 0; mask < (1 << otherClasses.length); mask++) {
    const candidate: GroupElement[] = [...identityClass]

    for (let j = 0; j < otherClasses.length; j++) {
      if (mask & (1 << j)) {
        candidate.push(...otherClasses[j])
      }
    }

    if (!isSubgroupClosed(group, candidate)) continue

    const key = candidate.map(e => e.id).sort().join(',')
    if (seen.has(key)) continue
    seen.add(key)

    let isNormal = true
    for (const h of candidate) {
      for (const g of group.elements) {
        const conj = group.multiply(group.multiply(g, h), group.inverse(g))
        if (!candidate.some(e => e.id === conj.id)) {
          isNormal = false
          break
        }
      }
      if (!isNormal) break
    }

    normalSubgroups.push({
      elements: candidate,
      order: candidate.length,
      index: group.order / candidate.length,
      generators: findMinimalGenerators(candidate, group),
      isNormal
    })
  }

  return normalSubgroups.sort((a, b) => a.order - b.order)
}

function isSubgroupClosed(group: Group, elements: GroupElement[]): boolean {
  if (elements.length === 0) return false
  const set = new Set(elements.map(e => e.id))
  for (const a of elements) {
    for (const b of elements) {
      if (!set.has(group.multiply(a, b).id)) return false
    }
  }
  return true
}

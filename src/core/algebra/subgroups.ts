import type { Group, GroupElement } from '../types'

export interface Subgroup {
  elements: GroupElement[]
  order: number
  index: number
  generators: GroupElement[]
  isNormal: boolean
}

export function isSimpleGroup(group: Group): boolean {
  if (group.order <= 1) return false
  
  if (group.isAbelian) {
    return group.order === 2 || group.order === 3
  }
  
  if (group.order === 6) {
    return false
  }
  
  if (group.order === 8) {
    return false
  }
  
  const primeFactors = getPrimeFactors(group.order)
  if (primeFactors.length === 1 && primeFactors[0] > 1) {
    return false
  }
  
  return false
}

function getPrimeFactors(n: number): number[] {
  const factors: number[] = []
  let d = 2
  let temp = n
  while (d * d <= temp) {
    if (temp % d === 0) {
      factors.push(d)
      while (temp % d === 0) temp /= d
    }
    d++
  }
  if (temp > 1) factors.push(temp)
  return factors
}

export function findAllSubgroups(group: Group): Subgroup[] {
  const subgroups: Subgroup[] = []
  
  function getCyclicSubgroup(generator: GroupElement): GroupElement[] {
    const elements: GroupElement[] = []
    const set = new Set<string>()
    let current = generator
    
    while (!set.has(current.id)) {
      set.add(current.id)
      elements.push(current)
      current = group.multiply(current, generator)
    }
    
    return elements
  }
  
  const subgroupKeys = new Set<string>()
  
  for (const gen of group.elements) {
    const cyclicElements = getCyclicSubgroup(gen)
    const key = cyclicElements.map(e => e.id).sort().join(',')
    
    if (!subgroupKeys.has(key) && cyclicElements.length < group.order) {
      subgroupKeys.add(key)
      
      let isNormal = true
      for (const h of cyclicElements) {
        for (const g of group.elements) {
          const conj = group.multiply(group.multiply(g, h), group.inverse(g))
          if (!cyclicElements.some(e => e.id === conj.id)) {
            isNormal = false
            break
          }
        }
        if (!isNormal) break
      }
      
      subgroups.push({
        elements: cyclicElements,
        order: cyclicElements.length,
        index: group.order / cyclicElements.length,
        generators: [gen],
        isNormal
      })
    }
  }
  
  subgroups.sort((a, b) => a.order - b.order)
  
  return subgroups
}

export function getGroupCenter(group: Group): GroupElement[] {
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

export function getConjugacyClasses(group: Group): GroupElement[][] {
  const classes: GroupElement[][] = []
  const used = new Set<string>()
  
  for (const a of group.elements) {
    if (used.has(a.id)) continue
    
    const conjugates: GroupElement[] = []
    for (const g of group.elements) {
      const conj = group.multiply(group.multiply(g, a), group.inverse(g))
      conjugates.push(conj)
      used.add(conj.id)
    }
    classes.push(conjugates)
  }
  
  return classes
}

export interface CosetInfo {
  subgroup: Subgroup
  leftCosets: GroupElement[][]
  rightCosets: GroupElement[][]
  isNormal: boolean
}

export function computeCosets(group: Group, subgroup: Subgroup): CosetInfo {
  const leftCosets: GroupElement[][] = []
  const rightCosets: GroupElement[][] = []
  const usedLeft = new Set<string>()
  const usedRight = new Set<string>()
  
  for (const g of group.elements) {
    const cosetLeft = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(g, sh).id === h.id
      })
      return exists
    })
    const key = cosetLeft.map(e => e.id).sort().join(',')
    if (!usedLeft.has(key)) {
      usedLeft.add(key)
      leftCosets.push(cosetLeft)
    }
  }
  
  for (const g of group.elements) {
    const cosetRight = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(sh, g).id === h.id
      })
      return exists
    })
    const key = cosetRight.map(e => e.id).sort().join(',')
    if (!usedRight.has(key)) {
      usedRight.add(key)
      rightCosets.push(cosetRight)
    }
  }
  
  const isNormal = leftCosets.every((lc, i) => 
    lc.map(e => e.id).sort().join(',') === rightCosets[i]?.map(e => e.id).sort().join(',')
  )
  
  return { subgroup, leftCosets, rightCosets, isNormal }
}
import type { Group, GroupElement } from '../types'

export interface Subgroup {
  elements: GroupElement[]
  order: number
  index: number
  generators: GroupElement[]
  isNormal: boolean
}

export interface SubgroupLatticeNode {
  id: string
  label: string
  elementIds: string[]
  order: number
  index: number
  isNormal: boolean
  level: number
}

export interface SubgroupLatticeEdge {
  from: number
  to: number
}

export function computeSubgroupLattice(group: Group): {
  nodes: SubgroupLatticeNode[]
  edges: SubgroupLatticeEdge[]
} {
  const cyclicSubgroups = findAllSubgroups(group)
  const identityEl = group.identity

  const nodes: SubgroupLatticeNode[] = []

  const identityElementIds = [identityEl.id]
  const identityKey = identityEl.id

  const seenKeys = new Set<string>()

  nodes.push({
    id: 'sg-trivial',
    label: '{e}',
    elementIds: identityElementIds,
    order: 1,
    index: group.order,
    isNormal: true,
    level: 0
  })
  seenKeys.add(identityKey)

  cyclicSubgroups.forEach((sg, i) => {
    const elementIds = sg.elements.map(e => e.id)
    const key = elementIds.sort().join(',')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    nodes.push({
      id: `sg-${i}`,
      label: formatSubgroupLabel(sg),
      elementIds,
      order: sg.order,
      index: sg.index,
      isNormal: sg.isNormal,
      level: 0
    })
  })

  const fullKey = group.elements.map(e => e.id).sort().join(',')
  if (!seenKeys.has(fullKey)) {
    nodes.push({
      id: 'sg-full',
      label: group.symbol,
      elementIds: group.elements.map(e => e.id),
      order: group.order,
      index: 1,
      isNormal: true,
      level: 0
    })
  }

  const byOrder = new Map<number, number[]>()
  nodes.forEach((node, i) => {
    const arr = byOrder.get(node.order) || []
    arr.push(i)
    byOrder.set(node.order, arr)
  })

  const sortedOrders = Array.from(byOrder.keys()).sort((a, b) => a - b)

  const n = nodes.length
  const contains: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))
  const elementSet = nodes.map(node => new Set(node.elementIds))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      let isSub = true
      for (const eid of nodes[i].elementIds) {
        if (!elementSet[j].has(eid)) {
          isSub = false
          break
        }
      }
      contains[i][j] = isSub
    }
  }

  const hasseEdges: SubgroupLatticeEdge[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!contains[i][j] || nodes[i].order >= nodes[j].order) continue

      let isDirect = true
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue
        if (contains[i][k] && contains[k][j]) {
          isDirect = false
          break
        }
      }
      if (isDirect) {
        hasseEdges.push({ from: i, to: j })
      }
    }
  }

  const levelMap = new Map<number, number>()
  sortedOrders.forEach((order, idx) => {
    levelMap.set(order, idx)
  })
  const maxLevel = sortedOrders.length - 1

  nodes.forEach(node => {
    node.level = maxLevel - (levelMap.get(node.order) ?? 0)
  })

  return { nodes, edges: hasseEdges }
}

function formatSubgroupLabel(sg: Subgroup): string {
  if (sg.order === 1) return '{e}'
  const genLabels = sg.generators.map(g => g.label).join(', ')
  return `⟨${genLabels}⟩`
}

export const SUBLATTICE_COLORS = [
  '#a78bfa', '#4ecdc4', '#ffd93d', '#f97316',
  '#38bdf8', '#84cc16', '#f43f5e', '#eab308',
  '#6366f1', '#14b8a6', '#ec4899', '#0ea5e9',
  '#ff6b6b', '#a855f7', '#22c55e', '#06b6d4',
]

export function isSimpleGroup(group: Group): boolean {
  if (group.order <= 1) return false

  if (group.isAbelian) {
    return isPrime(group.order)
  }

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
  const classes = getConjugacyClasses(group)
  const identityClass = classes.find(c =>
    c.some(e => e.id === group.identity.id)
  )
  if (!identityClass) return []

  const otherClasses = classes.filter(c => c !== identityClass)
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
      generators: [],
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
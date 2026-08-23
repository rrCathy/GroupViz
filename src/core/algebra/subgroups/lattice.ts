import type { Group } from '../../types'
import { findAllSubgroups } from './enumerate'
import type { Subgroup } from './shared'

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

export function computeSubgroupLattice(
  group: Group,
  allowLarge = false
): {
  nodes: SubgroupLatticeNode[]
  edges: SubgroupLatticeEdge[]
} {
  const cyclicSubgroups = findAllSubgroups(group, allowLarge)
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
    const key = elementIds.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(',')
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

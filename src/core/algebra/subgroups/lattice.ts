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

  const levels = levelsByOrderRank(nodes.map(nd => nd.order))
  nodes.forEach((node, i) => {
    node.level = levels[i]
  })

  return { nodes, edges: hasseEdges }
}

/**
 * 按"阶值分档"给子群格节点定层：同一阶的子群同层，阶越大层号越小（画在上方）。
 * 这是子群格的通用约定（G 在顶、⟨e⟩ 在底），computeSubgroupLattice 与共轭合并
 * 后的轨道格共用此函数，避免两处规则漂移。
 */
export function levelsByOrderRank(orders: number[]): number[] {
  const unique = Array.from(new Set(orders)).sort((a, b) => a - b)
  const rank = new Map<number, number>()
  unique.forEach((order, idx) => rank.set(order, idx))
  const maxLevel = unique.length - 1
  return orders.map(order => maxLevel - (rank.get(order) ?? 0))
}

/**
 * 传递归约：给定有向边（约定 from 的阶 < to 的阶，即自下而上），删去所有
 * "可经中间节点到达"的边，留下覆盖关系（Hasse 边）。
 *
 * computeSubgroupLattice 本身用的是基于完整包含矩阵的 O(n³) 直接覆盖判定
 * （更快、且手上就有 contains）；此函数供共轭合并后的轨道格使用——那里只
 * 拿到候选边集，没有包含矩阵。
 */
export function transitiveReduce(
  nodeCount: number,
  edges: SubgroupLatticeEdge[]
): SubgroupLatticeEdge[] {
  // 先去掉平行边：否则"去掉自身后仍可达"的判定会把一对重复边同时删掉
  const unique: SubgroupLatticeEdge[] = []
  const seen = new Set<string>()
  for (const e of edges) {
    const k = `${e.from}>${e.to}`
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(e)
  }

  const out: number[][] = Array.from({ length: nodeCount }, () => [])
  unique.forEach((e, i) => {
    if (e.from >= 0 && e.from < nodeCount) out[e.from].push(i)
  })

  // 边 u→v 冗余 ⟺ 在删去该边的图里 v 仍从 u 可达（去重后可达路径必然 ≥2 跳）
  const stillReachable = (u: number, v: number, skip: number): boolean => {
    const visited = new Set<number>([u])
    const stack = [u]
    while (stack.length > 0) {
      const cur = stack.pop()!
      for (const ei of out[cur]) {
        if (ei === skip) continue
        const next = unique[ei].to
        if (next === v) return true
        if (visited.has(next)) continue
        visited.add(next)
        stack.push(next)
      }
    }
    return false
  }

  return unique.filter((e, i) => !stillReachable(e.from, e.to, i))
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

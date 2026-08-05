import type { Group, GroupElement, CayleyAction, CayleyEdgeData, MultiplyType, NodePosition } from '../types'

export interface ForceLayoutEdge {
  source: string
  target: string
}

export interface ForceLayoutOptions {
  initialPositions?: Map<string, NodePosition>
  cycleSubgroups?: number[][]
}

export function computeCayleyActionEdges(
  group: Group,
  actions: CayleyAction[],
  multiplyType: MultiplyType
): CayleyEdgeData[] {
  const idToIdx = new Map<string, number>()
  const idToEl = new Map<string, GroupElement>()
  group.elements.forEach((el, i) => {
    idToIdx.set(el.id, i)
    idToEl.set(el.id, el)
  })

  const enabledActions = actions.filter(a => a.enabled)
  if (enabledActions.length === 0) return []

  const maxEdges = group.order > 60 ? Math.max(120, group.order * 3) : Number.POSITIVE_INFINITY

  const actionElementMap = new Map<string, GroupElement>()
  for (const action of enabledActions) {
    const el = idToEl.get(action.elementId)
    if (el) actionElementMap.set(action.elementId, el)
  }

  const allEdges: CayleyEdgeData[] = []

  for (let i = 0; i < group.elements.length; i++) {
    const fromEl = group.elements[i]
    for (const action of enabledActions) {
      const actionEl = actionElementMap.get(action.elementId)
      if (!actionEl) continue

      let toEl: GroupElement | undefined
      if (multiplyType === 'right') {
        toEl = group.multiply(fromEl, actionEl)
      } else {
        toEl = group.multiply(actionEl, fromEl)
      }

      if (!toEl) continue
      const toIdx = idToIdx.get(toEl.id)
      if (toIdx === undefined) continue

      const isSelfLoop = fromEl.id === toEl.id
      const isSelfInverse = group.inverse(actionEl).id === actionEl.id

      allEdges.push({
        fromIdx: i,
        toIdx,
        fromId: fromEl.id,
        toId: toEl.id,
        actionElementId: action.elementId,
        color: action.color,
        isBidirectional: isSelfInverse,
        isSelfLoop,
      })

      if (allEdges.length >= maxEdges) break
    }
    if (allEdges.length >= maxEdges) break
  }

  const processedEdges = new Map<string, CayleyEdgeData>()
  allEdges.forEach(edge => {
    const key = `${Math.min(edge.fromIdx, edge.toIdx)}|${Math.max(edge.fromIdx, edge.toIdx)}|${edge.actionElementId}`
    if (!processedEdges.has(key)) {
      processedEdges.set(key, edge)
    }
  })

  return Array.from(processedEdges.values())
}

import type { Group, GroupElement, ViewMode } from '../core/types'
import { isGroupDirectProduct, type CayleyShape2D } from '../core/types'
import { getViewBoxSize } from '../core/viewBox'
import { directProductGridLayout2D, ringOrder } from '../core/algebra/forceLayout'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'

export type NodePositionsMap = Map<string, Map<string, { x: number; y: number }>>

const GROUP_ID_PARTS_CACHE = new Map<string, string[]>()
const GROUP_ID_PARTS_CACHE_MAX = 5000

function getIdParts(id: string): string[] {
  const cached = GROUP_ID_PARTS_CACHE.get(id)
  if (cached) return cached
  const parts = id.split('|')
  if (GROUP_ID_PARTS_CACHE.size >= GROUP_ID_PARTS_CACHE_MAX) {
    const firstKey = GROUP_ID_PARTS_CACHE.keys().next().value
    if (firstKey !== undefined) GROUP_ID_PARTS_CACHE.delete(firstKey)
  }
  GROUP_ID_PARTS_CACHE.set(id, parts)
  return parts
}

export function initializeNodePositions(group: Group, view: ViewMode, shape2D?: CayleyShape2D, force = false): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = group.elements.length

  const vbs = getViewBoxSize(n, view, force)
  const centerX = vbs.width / 2
  const centerY = vbs.height / 2

  if (view === 'cayley' && shape2D) {
    const pos = computeShape2DPositions(group, shape2D, vbs.width, vbs.height)
    if (pos) {
      if ('positions' in pos) {
        if (pos.positions.size > 0) return pos.positions
      } else if (pos.size > 0) {
        return pos
      }
    }
  }

  if (view === 'cayley' && isGroupDirectProduct(group) && shape2D !== 'circular') {
    const gridPos = directProductGridLayout2D(group, vbs.width, vbs.height)
    if (gridPos && gridPos.size > 0) return gridPos
  }

  if (view === 'set') {
    const nodeRadius = 26
    const gap = 8
    const cellSize = nodeRadius * 2 + gap
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const totalWidth = cols * cellSize
    const totalHeight = rows * cellSize
    const startX = Math.max(nodeRadius, (vbs.width - totalWidth) / 2 + cellSize / 2)
    const startY = Math.max(nodeRadius, (vbs.height - totalHeight) / 2 + cellSize / 2)

    group.elements.forEach((element, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      positions.set(element.id, {
        x: startX + col * cellSize,
        y: startY + row * cellSize
      })
    })
    return positions
  }

  let radius: number
  if (view === 'cycle') {
    radius = Math.min(vbs.width * 0.28, 50 + n * 20)
  } else {
    radius = Math.min(vbs.width * 0.3, 180 + n * 10)
  }

  let ordered: GroupElement[]
  const isPipe = group.elements.length > 0 && group.elements[0]?.id.includes('|')
  if (isPipe) {
    const numFactors = group.elements[0].id.split('|').length
    const factorOrders: Map<string, number>[] = []
    for (let col = 0; col < numFactors; col++) {
      const keys = Array.from(new Set(group.elements.map(el => {
        const parts = getIdParts(el.id)
        return parts[col] ?? ''
      })))
      const ordered = ringOrder(keys)
      factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
    }
    ordered = [...group.elements].sort((a, b) => {
      const pa = getIdParts(a.id)
      const pb = getIdParts(b.id)
      for (let col = 0; col < numFactors; col++) {
        const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
        const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
        if (ai !== bi) return ai - bi
      }
      return 0
    })
  } else {
    const keys = group.elements.map(e => e.id)
    const order = ringOrder(keys)
    const idxMap = new Map(order.map((k, i) => [k, i]))
    ordered = [...group.elements].sort((a, b) => {
      const ai = idxMap.get(a.id) ?? 0
      const bi = idxMap.get(b.id) ?? 0
      return ai - bi
    })
  }
  ordered.forEach((element, i) => {
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2
    positions.set(element.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    })
  })

  return positions
}

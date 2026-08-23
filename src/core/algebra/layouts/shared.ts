import type { Group, GroupElement, NodePosition } from '../../types'

/**
 * 布局归一化：平移至原点并按最大半宽/半高缩放到单位圆，返回单位坐标与半径。
 */
export function normalizeLayout2D(
  pos: Map<string, NodePosition>
): { unit: Map<string, NodePosition>; radius: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!isFinite(minX)) return { unit: pos, radius: 1 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radius = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1e-6)
  const unit = new Map<string, NodePosition>()
  for (const [id, p] of pos) unit.set(id, { x: (p.x - cx) / radius, y: (p.y - cy) / radius })
  return { unit, radius }
}

// ─── Element Order ─────────────────────────────────────────────────────────

export function computeElementOrder(el: GroupElement, group: Group): number {
  if (el.id === group.identity.id) return 1
  let current = el
  let ord = 0
  do {
    current = group.multiply(current, el)
    ord++
    if (ord > group.order) return group.order
  } while (current.id !== el.id)
  return ord
}

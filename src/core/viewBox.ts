import type { ViewMode } from './types'

export interface ViewBoxSize {
  width: number
  height: number
}

const TABLE_CELL_SIZE = 50
const TABLE_CELL_GAP = 2
const TABLE_PADDING = 60

export function getViewBoxSize(order: number, view: ViewMode, force = false): ViewBoxSize {
  if (view === 'tree') {
    return { width: 1600, height: 1000 }
  }

  if (view === 'table' || view === 'prestable') {
    const cells = Math.min(order, 20)
    const tableSize = cells * (TABLE_CELL_SIZE + TABLE_CELL_GAP)
    const size = tableSize + TABLE_PADDING * 2 + 60
    const finalSize = Math.max(400, Math.min(size, 1800))
    return { width: finalSize, height: finalSize }
  }

  if (view === 'sublattice') {
    return { width: 2000, height: 2000 }
  }

  if (order <= 16) {
    return { width: 2000, height: 2000 }
  }

  if (order <= 30) {
    return { width: 3000, height: 3000 }
  }

  if (force) {
    const size = Math.max(3000, order * 70 + 400)
    return { width: size, height: size }
  }

  return { width: 3000, height: 3000 }
}

export function isTooLarge(order: number, view: ViewMode): boolean {
  if (view === 'table') {
    return order > 100
  }
  if (view === 'symmetry' || view === 'sublattice' || view === 'action') {
    return order > 120
  }
  if (view === 'sylow') {
    return order > 240
  }
  if (view === 'tree') {
    return false
  }
  if (view === '3d') {
    return order > 100
  }
  return order > 100
}

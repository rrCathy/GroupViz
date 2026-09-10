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

/**
 * 各视图「过大」判定的**默认**阶阈值。
 *
 * 这些数字原本写死在 `isTooLarge` 里，嵌入方无法覆盖（如博客插图想强行展开一张
 * 120 阶的文字乘法表）。现在既可从外围读取，也可经 `isTooLarge` 的第三参逐次覆盖。
 */
export function sizeLimitFor(view: ViewMode): number {
  if (view === 'table' || view === 'prestable') {
    return 100
  }
  if (view === 'heatmap' || view === 'sylow') {
    // 热力图聚合缩略图，超大群也能展示宏观结构，阈值放宽到 240（与 sylow 一致）
    return 240
  }
  if (view === 'symmetry' || view === 'sublattice' || view === 'action') {
    return 120
  }
  if (view === 'tree') {
    return Number.POSITIVE_INFINITY
  }
  if (view === '3d') {
    return 100
  }
  return 100
}

/**
 * 视图是否「过大」而需先出占位 / 告警。
 *
 * @param limitOverride 覆盖该视图的默认阈值（`sizeLimitFor(view)`）——
 *                      供包消费端放开/收紧限制（如嵌入时允许更大群直接渲染）
 */
export function isTooLarge(order: number, view: ViewMode, limitOverride?: number): boolean {
  return order > (limitOverride ?? sizeLimitFor(view))
}

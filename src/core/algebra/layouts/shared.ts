import type { Group, GroupElement, NodePosition } from '../../types'

/**
 * 布局层错误处理约定（双轨制第三轨）：
 * 布局函数对不适用的群返回 `null`，由调用方回退到通用布局（如 circular）。
 * 这是性能路径上的既有约定——布局探测每帧可能被调用，不构造 Error 对象、
 * 也不走 Result 包装；仅解析/守卫类失败才使用 core/result.ts 的 EngineError。
 */

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

// ─── Circle radius ─────────────────────────────────────────────────────────

/** `circleLayoutRadius` 的可选参数（各有缺省，调用方只覆盖需要的一项） */
export interface CircleRadiusOptions {
  /** 宽度占比上界（缺省 0.3） */
  widthFactor?: number
  /** 阶数基准半径（缺省 180） */
  base?: number
  /** 每阶增量（缺省 10） */
  growth?: number
  /** 容器内边留白（缺省 16） */
  padding?: number
}

/**
 * 圆环布局半径——**同时**受容器宽、高、群阶约束。
 *
 * 历史实现只取 `min(width × widthFactor, base + n × growth)`，两项都没有引用 `height`：
 * 宽扁容器（如博客内嵌 900×360）里半径会超过 `height / 2`，圆环上下两端节点被裁到画布外。
 * 这里把「半宽/半高扣掉节点半径与留白」也纳入上界——半径 r 时节点外沿到 r + nodeRadius，
 * 故可用空间必须减去节点自身尺寸。
 *
 * 容器小到装不下一个节点时用 `nodeRadius` 兜底，避免半径退化为 0（所有节点叠在中心）；
 * 此时溢出不可避免，仅保证图形可读。
 *
 * 注：方形 viewBox（内部 `getViewBoxSize` 恒返回正方形）下阶数上界始终最紧，
 * 本函数与原公式取值完全一致，不改变既有布局。
 */
export function circleLayoutRadius(
  width: number,
  height: number,
  n: number,
  nodeRadius: number,
  opts: CircleRadiusOptions = {},
): number {
  const widthFactor = opts.widthFactor ?? 0.3
  const base = opts.base ?? 180
  const growth = opts.growth ?? 10
  const padding = opts.padding ?? 16

  const halfW = Math.max(0, width / 2 - nodeRadius - padding)
  const halfH = Math.max(0, height / 2 - nodeRadius - padding)
  const bounded = Math.min(width * widthFactor, halfW, halfH, base + n * growth)
  return Math.max(nodeRadius, bounded)
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

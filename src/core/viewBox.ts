import type { ViewMode } from './types'
import { STATIC_LIMIT, ENUMERATION_LIMIT, RENDER_3D_LIMIT } from './guards'

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
 * 口径对齐 docs/PERF.md 的实测三条线（常量定义在 guards.ts）：
 * - 图形类（set / cayley / cycle / table / prestable / heatmap）→ **静态可用线**
 *   `STATIC_LIMIT`（240 阶静态 60 fps、交互 26–45 fps——超出只是交互会卡，
 *   静态/出图完全可用，警告文案已按此措辞）；
 * - 子群枚举类（sylow / symmetry / sublattice / action / homomorphism / cosetstrip）
 *   → **枚举 2 秒线** `ENUMERATION_LIMIT`（144 阶 1.81s，168 阶 3.45s 超预算；
 *   sylow 原值 240 会让枚举跑 19s）；
 * - `3d` → `RENDER_3D_LIMIT`：DOM 恒定（1 个 canvas），S₆(720) 缩放 20–43 fps，
 *   与 2D 完全不同量级，原值 100 严重偏紧；
 * - `tree` → ∞（逐节点惰性展开）。
 *
 * 这些数字原本写死在 `isTooLarge` 里，嵌入方无法覆盖（如博客插图想强行展开一张
 * 120 阶的文字乘法表）。现在既可从外围读取，也可经 `isTooLarge` 的第三参逐次覆盖。
 */
export function sizeLimitFor(view: ViewMode): number {
  if (view === 'tree') {
    return Number.POSITIVE_INFINITY
  }
  if (view === '3d') {
    return RENDER_3D_LIMIT
  }
  if (
    view === 'sylow' || view === 'symmetry' || view === 'sublattice' ||
    view === 'action' || view === 'homomorphism' || view === 'cosetstrip'
  ) {
    return ENUMERATION_LIMIT
  }
  // set / cayley / cycle / table / prestable / heatmap：图形类，静态可用线
  // （heatmap 原本就是 240，与静态线天然一致）
  return STATIC_LIMIT
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

/**
 * 商群视图「正规子群 N 凯莱图」右侧内嵌面板的几何。
 *
 * 商群视图把画布右侧让出一条带作为面板（箭头从恒等陪集节点指过去），图形主体
 * 在左侧剩余区域居中。**位置初始化（context/positionUtils）与渲染
 * （CayleyGraphView / SetView）必须用同一份几何** —— 否则预置节点位置会把
 * 图形居中到整幅画布中央，被面板压住。
 */
export interface QuotientInsetGeometry {
  panel: { x: number; y: number; width: number; height: number }
  /** 让出面板后图形的可用宽度（调用方用它算圆心 / 网格起点） */
  drawWidth: number
}

export function quotientInsetGeometry(viewBoxSize: ViewBoxSize): QuotientInsetGeometry {
  const panelWidth = Math.max(160, Math.min(320, viewBoxSize.width * 0.24))
  const panelHeight = Math.max(140, Math.min(300, viewBoxSize.height * 0.32))
  const margin = 16
  const gap = 26
  return {
    panel: {
      x: viewBoxSize.width - panelWidth - margin,
      y: (viewBoxSize.height - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
    },
    drawWidth: Math.max(140, viewBoxSize.width - panelWidth - margin - gap),
  }
}

/** svg 元素度量 → 悬浮窗坐标换算参数（纯函数，导出便于单测锁公式） */
export interface InsetSvgMetrics {
  /** SVG 用户单位 / 屏幕 px（等比）——窗体以设计 px 记账，渲染时 ×k 落进 SVG */
  k: number
  /** svg 元素左上角在 SVG 用户坐标系中的位置（`xMidYMid meet` 的居中留白由此体现） */
  originX: number
  originY: number
  /** svg 元素屏幕尺寸（px，clamp 位置/尺寸用） */
  rectW: number
  rectH: number
}

/**
 * 由 svg 元素的 rect / viewBox / CTM 计算窗体换算参数。
 *
 * ⚠ **不要退回 `viewBox.width / rect.width`**：浏览器按 `preserveAspectRatio="xMidYMid meet"`
 * **等比**缩放并居中，实际 px/单位 = `min(rectW/vbW, rectH/vbH)`。容器宽高比 ≠ viewBox
 * 宽高比时两者差很远（2026-09-21 实测消费页卡片 1532×428 装 860×520 的 viewBox：
 * 宽度比 0.5614 vs 实际 0.8231），窗体被算小到 46%（360×300 设计 → 屏上 166×139），
 * 用户观感就是「窗口被限高」。CTM 的 a/d 即浏览器实际缩放，天然含该语义。
 *
 * `origin` 补偿内容居中留白：元素左上角（视口 px）→ 用户单位。屏幕 px 记账的拖动位置
 * 必须经 `origin + px × k` 才落到正确的 SVG 坐标。
 */
export function computeInsetMetrics(
  rect: { left: number; top: number; width: number; height: number },
  vb: { width: number; height: number },
  ctm: { a: number; d: number; e: number; f: number } | null,
): InsetSvgMetrics {
  const vbW = vb.width || rect.width || 1
  const vbH = vb.height || rect.height || 1
  const pxPerUnit = ctm && ctm.a > 0 && ctm.d > 0
    ? Math.min(ctm.a, ctm.d)
    : Math.min(rect.width / vbW, rect.height / vbH)
  const k = pxPerUnit > 0 ? 1 / pxPerUnit : 1
  const originX = ctm && ctm.a !== 0 ? (rect.left - ctm.e) / ctm.a : 0
  const originY = ctm && ctm.d !== 0 ? (rect.top - ctm.f) / ctm.d : 0
  return { k, originX, originY, rectW: rect.width, rectH: rect.height }
}

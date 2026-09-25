/* eslint-disable react-refresh/only-export-components */
// renderViewContent（非组件分发函数）必须与它私有的包装组件同文件——拆开反而
// 迫使包装组件全部导出。跟随 context 层既有先例，文件级 disable。
//
// ── 老式窗（应用浮窗）的**兜底**内容分发 ──
// 2026-09-25（W-5 收口）：`set` / `cayley` / `cycle` / `table` / `3d` / `symmetry` / `sublattice` /
// `cosetstrip` 八个视图已迁到内核内容分发（`FloatingViewWindow` 的 `KERNEL_VIEWS` 前置分发 →
// `ViewContent`，那才消费 viewParams / decorations）。本文件随之删掉对应的自绘件与包装件
// （`CayleyGraphViewLocal` / `TableZoomable` / `CosetStripWindowView`，以及 3D 的 lazy 分支）。
//
// 仍留在这里的 5 个视图：
//   · `sylow`        —— 内核 `ViewContent` 尚无该分支（要迁得先给内核加分支）
//   · `tree`         —— 无限群方向视图，归拓展包轨道
//   · `prestable`    —— 同上
//   · `action` / `homomorphism` —— 应用多视图入口打不开，且老式壳没有同态源（保留以免直接
//                       渲染 `FloatingViewWindow view="action"` 时落到空内容）
// 这 5 个视图**不消费 viewParams**，因此 `FloatingViewWindow` 不给它们 ⚙ 入口（见其 `KERNEL_VIEWS`）。
import { useRef, useCallback, lazy, Suspense } from 'react'
import { useGroup } from '../../../context/useGroup'
import type { ViewMode } from '../../../core/types'
import type { CosetStripSubgroupOption } from '../../../core/algebra/cosetStrip'
import { ENUMERATION_LIMIT } from '../../../core/guards'
import { HomomorphismView } from '../HomomorphismView'
import { ActionView } from '../ActionView'
import { SylowView } from '../SylowView'
import { PresentationTableView } from '../PresentationTableView'

const FreeGroupTreeViewLazy = lazy(() => import('../FreeGroupTreeView').then(m => ({ default: m.FreeGroupTreeView })))

/** 窗内平移/缩放包装：把滚轮缩放与拖拽平移写回**本窗**的 canvasTransform（外层 Provider 覆盖后是窗口局部值） */
function SvgPanZoom({ children }: { children: React.ReactNode }) {
  const { canvasTransform, setCanvasTransform, viewBoxSize, resetCanvasTransform } = useGroup()
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const svgEl = containerRef.current.querySelector('svg')
    const vb = svgEl?.viewBox?.baseVal
    const vw = vb && vb.width > 0 ? vb.width : viewBoxSize.width
    const vh = vb && vb.height > 0 ? vb.height : viewBoxSize.height
    const scale = Math.min(rect.width / vw, rect.height / vh)
    const offX = (rect.width - vw * scale) / 2
    const offY = (rect.height - vh * scale) / 2
    const mouseX = (e.clientX - rect.left - offX) / scale
    const mouseY = (e.clientY - rect.top - offY) / scale
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.25, Math.min(8, canvasTransform.scale * scaleFactor))
    const scaleChange = newScale / canvasTransform.scale
    const newX = mouseX - (mouseX - canvasTransform.x) * scaleChange
    const newY = mouseY - (mouseY - canvasTransform.y) * scaleChange
    setCanvasTransform({ x: newX, y: newY, scale: newScale })
  }, [canvasTransform, setCanvasTransform, viewBoxSize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, tx: canvasTransform.x, ty: canvasTransform.y }
  }, [canvasTransform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setCanvasTransform({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy })
  }, [setCanvasTransform])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // 双击空白处复位 pan/zoom（节点上双击不触发，保留选中语义）
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    resetCanvasTransform()
  }, [resetCanvasTransform])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {children}
    </div>
  )
}

export function renderViewContent(view: ViewMode) {
  switch (view) {
    case 'homomorphism':
      return <SvgPanZoom><HomomorphismView /></SvgPanZoom>
    case 'action':
      return <SvgPanZoom><ActionView /></SvgPanZoom>
    case 'sylow':
      return <SvgPanZoom><SylowView /></SvgPanZoom>
    case 'tree':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><FreeGroupTreeViewLazy /></Suspense>
    case 'prestable':
      return <SvgPanZoom><PresentationTableView /></SvgPanZoom>
    default:
      // 13 个 ViewMode 已全覆盖（KERNEL_VIEWS 8 个 + 上面 5 个）；兜底返回空，不再挂自绘件
      return null
  }
}

/**
 * 候选子群为空时的说明。阈值取自 guards（曾硬编码 60，与 ENUMERATION_LIMIT=144 脱节）。
 *
 * ⚠ 仅用于**窗口参数面板**（该面板整体是英文文案）。主画布语境走 i18n：
 * `canvas.cosetStripOverEnumerationLimit` / `canvas.cosetStripNoProperSubgroup` —— 中文界面下
 * 不能出现这句英文，且「无非平凡真子群」与「枚举超限」是两种成因，不能共用一句（2026-09-21 修）。
 */
export const COSETSTRIP_NO_LOCAL_SUBGROUPS = `Local subgroup enumeration is limited to groups of order ≤ ${ENUMERATION_LIMIT}`

/** TeX 结构符号 → unicode（供 <select> 选项纯文本展示）：C_{2}\\times C_{2} → C₂×C₂、D_{4} → D₄ */
function csUnicodeStruct(sym: string): string {
  return sym
    .replace(/\\times /g, '×')
    .replace(/([A-Z])_\{(\d+)\}/g, (_m, ch: string, digs: string) => ch + digs.split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join(''))
}

/** 子群候选 → <select> 选项文本：结构（或兜底 ⟨H⟩）· |H| · [G:H] 条带数 · ×轨道长 */
export function csOptionLabel(o: CosetStripSubgroupOption): string {
  const struct = o.structure ? csUnicodeStruct(o.structure) : `⟨H⟩·${o.order}`
  const orbit = o.orbitSize > 1 ? ` · ×${o.orbitSize}` : ''
  return `${struct} |H|${o.order} · [G:H]${o.index}${orbit}`
}

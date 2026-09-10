import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react'
import { GroupContext } from '../../context/GroupContext'
import type { GroupContextType } from '../../context/GroupContext'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import type { ViewMode, CanvasTransform } from '../../core/types'
import type { Group, GroupElement, Homomorphism } from '../../core/types'
import { SetView, type SetViewProps } from './SetView'
import { SetViewFromContext } from './SetViewFromContext'
import { CycleView } from './CycleView'
import { CycleViewFromContext } from './CycleViewFromContext'
import { TableView, TABLE_PAD_W, TABLE_PAD_H } from './TableView'
import { TableViewFromContext } from './TableViewFromContext'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { HomomorphismView } from './HomomorphismView'
import { HomomorphismScene } from './HomomorphismScene'
import { CosetStripScene } from './CosetStripScene'
import { CosetStripView } from './CosetStripView'
import { ActionView } from './ActionView'
import { ActionScene } from './ActionScene'
import { SylowView } from './SylowView'
import { PresentationTableView } from './PresentationTableView'
import { computeCayleyActionEdges, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { compute3DPositions } from '../../core/algebra/layout3D'
import { listFaceSubgroups, buildUndirectedEdgeKeys, FACE_COLOR_PALETTE, type FaceSubgroupResult } from '../../core/algebra/faces3D'
import { verifyHomomorphism } from '../../core/algebra/homomorphisms'
import { texify, renderTex } from '../../utils/texify'
import type { CayleyEdgeData } from '../../core/types'
import type { ViewWindowConfig, SetViewParams, CayleyViewParams, Cayley3DViewParams, Cayley3DFaceFillParams, CycleViewParams, TableViewParams, TableStrategy, SublatticeViewParams, CosetStripViewParams, SymmetryViewParams, HomomorphismViewParams, ActionViewParams } from '../../core/types/viewConfig'
import { setViewParamsSchema, cayleyViewParamsSchema, cayley3DViewParamsSchema, cycleViewParamsSchema, tableViewParamsSchema, sublatticeViewParamsSchema, cosetStripViewParamsSchema, symmetryViewParamsSchema, homomorphismViewParamsSchema, actionViewParamsSchema } from '../../core/types/viewConfig'
import { getDefaultShape2D, getAvailableShapesForView } from '../../core/types'
import { getDefaultLayout3D, getAvailableShapes3D } from '../../core/types'
import { getViewBoxSize } from '../../core/viewBox'
import type { CayleyShape2D, Layout3D, LatticeLabelDetail } from '../../core/types'
import { toggleCayleyActionReducer, addAllCayleyActionsHelper, normalizeCayleyActions } from '../../context/cayleyActions'
import { CayleyView } from './CayleyView'
import { Cayley3DScene } from './Cayley3DScene'
import { SymmetryView } from './SymmetryView'
import { SymmetryViewScene } from './SymmetryViewScene'
import { getSymmetryType } from '../../core/symmetryType'
import { SublatticeScene } from './SublatticeScene'
import { listCosetStripSubgroups, cosetDataForSubgroup, type CosetStripSubgroupOption } from '../../core/algebra/cosetStrip'
import { buildActionComputation, arrowListAdd, arrowListBind, arrowListRemove, arrowListReplaceGen, type CustomArrowError } from '../../core/algebra/actions'
import type { GroupActionArrow, GroupActionComputation } from '../../core/types'
import { computeCosetElementMap, computeCosetColors, computeCosetHighlightSet } from '../../context/cosetActions'
import { loadVersionedJson, saveVersionedJson, removeStoredKey } from '../../utils/persistence'
import { VIEWWINDOW_RESET_EVENT } from '../../utils/resetViewWindows'
import { z } from 'zod'

const Cayley3DViewLazy = lazy(() => import('./Cayley3DView').then(m => ({ default: m.Cayley3DView })))
const FreeGroupTreeViewLazy = lazy(() => import('./FreeGroupTreeView').then(m => ({ default: m.FreeGroupTreeView })))

function CayleyGraphViewLocal() {
  const { currentGroup, selectedElements, selectElement, getNodePosition, setNodePosition, canvasTransform, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets } = useGroup()
  const { setHoverElement } = useHover()
  const { t } = useTranslation()

  const nodeRadius = 28
  const cx = currentGroup ? viewBoxSize.width / 2 : 0
  const cy = currentGroup ? viewBoxSize.height / 2 : 0
  const graphRadius = currentGroup ? Math.min(viewBoxSize.width * 0.3, 180 + currentGroup.order * 10) : 0
  const n = currentGroup ? currentGroup.order : 0

  const circLayout = useMemo(() => {
    if (!currentGroup) return new Map<string, { x: number; y: number }>()
    return cayleyCircleLayout(currentGroup, cx, cy, graphRadius)
  }, [cx, cy, graphRadius, currentGroup])

  const edges = useMemo(() => currentGroup ? computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType) : [], [currentGroup, cayleyActions, cayleyMultiplyType])

  const isLargeGraph = n > 60

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, typeof subsets[0]>()
    subsets.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const enabledActions = cayleyActions.filter(a => a.enabled)
  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    enabledActions.forEach((a, idx) => m.set(a.elementId, idx))
    return m
  }, [enabledActions])

  const getNodePos = useCallback((elId: string) => {
    const defPos = circLayout.get(elId)
    if (!defPos) return { x: cx, y: cy }
    const saved = getNodePosition(elId)
    if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
      return saved
    }
    return defPos
  }, [circLayout, cx, cy, getNodePosition])

  const nodePositionsCache = useMemo(() => {
    const cache = new Map<string, { x: number; y: number }>()
    currentGroup?.elements.forEach((el) => {
      cache.set(el.id, getNodePos(el.id))
    })
    return cache
  }, [currentGroup, getNodePos])

  if (!currentGroup) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-dim)' }}>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} style={{ width: '100%', height: '100%', userSelect: 'none', background: 'var(--bg-primary)' }}>
      <defs>
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {enabledActions.map((action, idx) => (
          <marker key={idx} id={`fv-arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edges.map((edge: CayleyEdgeData) => {
          const fromPos = nodePositionsCache.get(edge.fromId)
          const toPos = nodePositionsCache.get(edge.toId)
          if (!fromPos || !toPos) return null

          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 1) return null
          
          const isHighlighted = selectedElements.has(edge.fromId) || selectedElements.has(edge.toId)
          const baseColor = edge.color
          const color = isHighlighted ? baseColor : `${baseColor}99`

          if (edge.isSelfLoop) {
            const scx = fromPos.x
            const scy = fromPos.y - nodeRadius - 20
            return (
              <g key={`${edge.fromId}-${edge.actionElementId}`}>
                <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={isHighlighted ? 3.5 : 2.5} />
                <polygon points={`${scx-5},${scy-2} ${scx+5},${scy-2} ${scx},${scy-14}`} fill={baseColor} />
              </g>
            )
          }
          
          const midX = (fromPos.x + toPos.x) / 2
          const midY = (fromPos.y + toPos.y) / 2
          const nx = -dy / dist
          const ny = dx / dist
          
          const curvature = 35
          const ctrlX = midX + nx * curvature
          const ctrlY = midY + ny * curvature
          
          const startX = fromPos.x + (dx / dist) * nodeRadius
          const startY = fromPos.y + (dy / dist) * nodeRadius
          const endX = toPos.x - (dx / dist) * nodeRadius
          const endY = toPos.y - (dy / dist) * nodeRadius
          
          const actionIdx = enabledActionIndexMap.get(edge.actionElementId) ?? 0
          const markerId = `fv-arrow-${actionIdx}`

          return (
            <path
              key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
              d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
              stroke={color}
              strokeWidth={isHighlighted ? 3.5 : 2.5}
              fill="none"
              markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
              opacity={0.9}
            />
          )
        })}
        
        {currentGroup.elements.map((el) => {
          const pos = getNodePos(el.id)
          const isSelected = selectedElements.has(el.id)
          const parentSubset = subsetDetailMap.get(el.id)
          
          let fillColor = 'var(--node-fill)'
          let strokeColor = 'var(--node-stroke)'
          let strokeWidth = 2.5
          
          if (isSelected) {
            fillColor = 'var(--node-fill-selected)'
            strokeColor = '#ffd93d'
            strokeWidth = 3
          } else if (parentSubset) {
            fillColor = parentSubset.color + '33'
            strokeColor = parentSubset.color
            strokeWidth = 2.5
          }
          
          return (
            <g
              key={el.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={(e) => {
                e.stopPropagation()
                selectElement(el.id, e.ctrlKey || e.metaKey)
              }}
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.stopPropagation()
                  const svg = e.currentTarget.closest('svg')
                  if (!svg) return
                  const svgRect = svg.getBoundingClientRect()
                  const vw = viewBoxSize.width
                  const vh = viewBoxSize.height
                  const scaleX = vw / svgRect.width
                  const scaleY = vh / svgRect.height
                  
                  const startX2 = (e.clientX - svgRect.left) * scaleX
                  const startY2 = (e.clientY - svgRect.top) * scaleY
                  const startPos = getNodePos(el.id)
                  const initialOffsetX = startPos.x
                  const initialOffsetY = startPos.y
                  
                  const handleMove = (moveEvent: MouseEvent) => {
                    const currentX = (moveEvent.clientX - svgRect.left) * scaleX
                    const currentY = (moveEvent.clientY - svgRect.top) * scaleY
                    const newX = initialOffsetX + (currentX - startX2) / canvasTransform.scale
                    const newY = initialOffsetY + (currentY - startY2) / canvasTransform.scale
                    setNodePosition(el.id, newX, newY)
                  }
                  
                  const handleUp = () => {
                    window.removeEventListener('mousemove', handleMove)
                    window.removeEventListener('mouseup', handleUp)
                  }
                  
                  window.addEventListener('mousemove', handleMove)
                  window.addEventListener('mouseup', handleUp)
                }
              }}
              onMouseEnter={() => setHoverElement(el)}
              onMouseLeave={() => setHoverElement(null)}
              style={{ cursor: 'grab' }}
            >
              <circle
                r={nodeRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                filter="url(#node-shadow)"
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {(!isLargeGraph || isSelected || selectedElements.size === 0) && (
                <foreignObject
                  x={-nodeRadius}
                  y={-16}
                  width={nodeRadius * 2}
                  height={32}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                       width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLargeGraph ? '10px' : '15px'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderTex(texify(el.label))
                    }}
                  />
                </foreignObject>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function TableZoomable({ children }: { children: React.ReactNode }) {
  const [tableZoom, setTableZoom] = useState(1)
  const [tablePan, setTablePan] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTableZoom(prev => Math.max(0.25, Math.min(10, prev * factor)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('text') || (e.target as HTMLElement).closest('rect')) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: tablePan.x, py: tablePan.y }
  }, [tablePan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    setTablePan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    })
  }, [])

  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])

  // 双击空白处复位缩放与平移（表头/单元格上双击不触发，保留交互）
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('text') || (e.target as HTMLElement).closest('rect')) return
    setTableZoom(1)
    setTablePan({ x: 0, y: 0 })
  }, [])

  return (
    <div
      style={{
        width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translate(${tablePan.x}px, ${tablePan.y}px) scale(${tableZoom})`,
        transformOrigin: 'center center',
      }}>
        {children}
      </div>
    </div>
  )
}

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

function renderViewContent(view: ViewMode) {
  switch (view) {
    case 'set':
      return <SvgPanZoom><SetViewFromContext /></SvgPanZoom>
    case 'cayley':
      return <SvgPanZoom><CayleyGraphViewLocal /></SvgPanZoom>
    case 'cycle':
      return <SvgPanZoom><CycleViewFromContext /></SvgPanZoom>
    case 'table':
      return <TableZoomable><TableViewFromContext /></TableZoomable>
    case '3d':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><Cayley3DViewLazy /></Suspense>
    case 'symmetry':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><SymmetryView /></Suspense>
    case 'sublattice':
      return <SvgPanZoom><SubgroupLatticeView /></SvgPanZoom>
    case 'homomorphism':
      return <SvgPanZoom><HomomorphismView /></SvgPanZoom>
    case 'cosetstrip':
      return <SvgPanZoom><CosetStripView /></SvgPanZoom>
    case 'action':
      return <SvgPanZoom><ActionView /></SvgPanZoom>
    case 'sylow':
      return <SvgPanZoom><SylowView /></SvgPanZoom>
    case 'tree':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><FreeGroupTreeViewLazy /></Suspense>
    case 'prestable':
      return <SvgPanZoom><PresentationTableView /></SvgPanZoom>
    default:
      return <SvgPanZoom><SetViewFromContext /></SvgPanZoom>
  }
}

const COSETSTRIP_NO_LOCAL_SUBGROUPS = 'Local subgroup enumeration is limited to groups of order ≤ 60'

/** TeX 结构符号 → unicode（供 <select> 选项纯文本展示）：C_{2}\\times C_{2} → C₂×C₂、D_{4} → D₄ */
function csUnicodeStruct(sym: string): string {
  return sym
    .replace(/\\times /g, '×')
    .replace(/([A-Z])_\{(\d+)\}/g, (_m, ch: string, digs: string) => ch + digs.split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join(''))
}

/** 子群候选 → <select> 选项文本：结构（或兜底 ⟨H⟩）· |H| · [G:H] 条带数 · ×轨道长 */
function csOptionLabel(o: CosetStripSubgroupOption): string {
  const struct = o.structure ? csUnicodeStruct(o.structure) : `⟨H⟩·${o.order}`
  const orbit = o.orbitSize > 1 ? ` · ×${o.orbitSize}` : ''
  return `${struct} |H|${o.order} · [G:H]${o.index}${orbit}`
}

let globalZCounter = 1000

export function FloatingViewWindow({ id, view, title }: { id: string; view: ViewMode; title: string }) {
  const globalCtx = useGroup()
  const { viewWindowTheme } = useTheme()
  
  const [position, setPosition] = useState({ x: 100 + globalCtx.floatingViews.length * 40, y: 80 + globalCtx.floatingViews.length * 30 })
  // 乘法表窗口最小尺寸：含文字需看清，最小 = viewBox + 标题栏
  const legacyTableMin = (() => {
    if (view !== 'table') return null
    const g = globalCtx.currentGroup
    if (!g || g.order > 100) return null
    const vb = getViewBoxSize(g.order, 'table')
    return {
      width: Math.min(900, vb.width),
      height: Math.min(900, vb.height + 40),
    }
  })()
  const [size, setSize] = useState(() => {
    if (legacyTableMin) return { width: Math.max(500, legacyTableMin.width), height: Math.max(400, legacyTableMin.height) }
    return { width: 500, height: 400 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [zIndex, setZIndex] = useState(() => ++globalZCounter)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const bringToFront = useCallback(() => {
    setZIndex(++globalZCounter)
  }, [])

  const [localTransform, setLocalTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const [localNodePositions, setLocalNodePositions] = useState<Map<string, Map<string, { x: number; y: number }>>>(new Map())

  const setCanvasTransformLocal = useCallback((t: Partial<CanvasTransform>) => {
    setLocalTransform(prev => ({ ...prev, ...t }))
  }, [])

  const resetCanvasTransformLocal = useCallback(() => {
    setLocalTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  const getNodePositionLocal = useCallback((elementId: string) => {
    return localNodePositions.get(view)?.get(elementId)
  }, [localNodePositions, view])

  const setNodePositionLocal = useCallback((elementId: string, x: number, y: number) => {
    setLocalNodePositions(prev => {
      const next = new Map(prev)
      const viewPositions = next.get(view) || new Map()
      const updated = new Map(viewPositions)
      updated.set(elementId, { x, y })
      next.set(view, updated)
      return next
    })
  }, [view])

  const batchSetNodePositionsLocal = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setLocalNodePositions(prev => {
      const next = new Map(prev)
      next.set(view, positions)
      return next
    })
  }, [view])

  const localOverrides = {
    ...globalCtx,
    currentView: view,
    canvasTransform: localTransform,
    setCanvasTransform: setCanvasTransformLocal,
    resetCanvasTransform: resetCanvasTransformLocal,
    getNodePosition: getNodePositionLocal,
    setNodePosition: setNodePositionLocal,
    batchSetNodePositions: batchSetNodePositionsLocal,
    nodePositions: localNodePositions,
    // 悬浮窗用自身视图计算 viewBox（尤其 table 的紧凑 400~1800 尺寸，避免误用主画布的 2000×2000 导致表格被缩得很小）
    viewBoxSize: globalCtx.currentGroup
      ? getViewBoxSize(globalCtx.currentGroup.order, view, globalCtx.forceShowLargeGroupViews.has(view))
      : globalCtx.viewBoxSize,
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y }
  }, [position])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    bringToFront()
    setIsResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
  }, [size, bringToFront])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: Math.max(0, dragStart.current.px + dx),
        y: Math.max(0, dragStart.current.py + dy)
      })
    }
    if (isResizing) {
      const dw = e.clientX - resizeStart.current.x
      const dh = e.clientY - resizeStart.current.y
      setSize({
        width: Math.max(legacyTableMin?.width ?? 280, resizeStart.current.w + dw),
        height: Math.max(legacyTableMin?.height ?? 200, resizeStart.current.h + dh)
      })
    }
  }, [isDragging, isResizing, legacyTableMin])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  return (
    <GroupContext.Provider value={localOverrides as GroupContextType}>
      <div
        className="floating-view-window"
        data-theme={viewWindowTheme}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: zIndex,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          background: 'var(--bg-primary)',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={bringToFront}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="floating-view-titlebar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            background: 'var(--bg-interactive)',
            borderBottom: '1px solid var(--border-primary)',
            cursor: 'grab',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            userSelect: 'none',
            flexShrink: 0,
          }}
          onMouseDown={handleDragStart}
        >
          <span style={{ fontWeight: 500 }}>{title}</span>
          <button
            onClick={() => globalCtx.closeFloatingView(id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = '#f44')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-dim)')}
          >
            ×
          </button>
        </div>
        
        <div
          className="floating-view-content"
          onMouseDownCapture={bringToFront}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {renderViewContent(view)}
        </div>
        
        <div
          className="floating-view-resizer"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 28,
            height: 28,
            cursor: 'nwse-resize',
            zIndex: 9999,
            borderRadius: '0 0 8px 0',
          }}
          onMouseDown={handleResizeStart}
        >
          <svg width={28} height={28} style={{ display: 'block', opacity: 0.5 }}>
            <path d="M26 26 L26 14 L14 26 Z M26 26 L26 20 L20 26 Z" fill="#555" />
          </svg>
        </div>
      </div>
    </GroupContext.Provider>
  )
}

// ── Controlled ViewWindow (FGVE engine) ─────────────────────

export type ViewParams = SetViewParams | CayleyViewParams | Cayley3DViewParams | CycleViewParams | TableViewParams | SublatticeViewParams | CosetStripViewParams | SymmetryViewParams | HomomorphismViewParams | ActionViewParams

interface ViewWindowProps {
  view: ViewMode
  /** 展示群；同态视图（view==='homomorphism'）可省略，改由 homomorphism prop 提供双群 */
  group?: Group | null
  /** 同态视图双群输入（source+target+mapping 打包）。view==='homomorphism' 时优先于 group（group 可为 null） */
  homomorphism?: Homomorphism | null
  title?: string
  storageKey?: string
  config?: ViewWindowConfig
  onConfigChange?: (c: ViewWindowConfig) => void
  viewParams?: ViewParams
  onViewParamsChange?: (p: ViewParams) => void
  defaultPosition?: { x: number; y: number }
  defaultSize?: { width: number; height: number }
  onClose?: () => void
}

const VW_PERSIST_SCHEMA = z.object({
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number().min(200), height: z.number().min(150) }),
  config: z.object({
    locked: z.boolean().optional(),
    zoomLocked: z.boolean().optional(),
    showInfo: z.boolean().optional(),
    viewportFixed: z.boolean().optional(),
    resizable: z.boolean().optional(),
    showControls: z.boolean().optional(),
    showZoomSlider: z.boolean().optional(),
    actionLocked: z.boolean().optional(),
  }),
  viewParams: z.record(z.string(), z.unknown()),
})

const RESIZE_H = 8
const TBAR_H = 32
const MIN_W = 280
const MIN_H = 180
const PARAMS_W = 200
const PARAMS_GAP = 8
let _vwZ = 5000

function loadVwPersist(key: string) {
  return loadVersionedJson(`gv-vw-${key}`, VW_PERSIST_SCHEMA)
}

function saveVwPersist(key: string, data: z.infer<typeof VW_PERSIST_SCHEMA>) {
  saveVersionedJson(`gv-vw-${key}`, data)
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
}

const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// 边 8px、角 22px —— 角更大易抓取，resize 跟手。
const CORNER_H = 22

function resizeHandleStyle(dir: ResizeDir): React.CSSProperties {
  const s = RESIZE_H
  const c = CORNER_H
  const base: React.CSSProperties = {
    position: 'absolute', zIndex: 10, cursor: RESIZE_CURSORS[dir],
  }
  switch (dir) {
    case 'n': return { ...base, top: 0, left: s, right: s, height: s }
    case 's': return { ...base, bottom: 0, left: s, right: s, height: s }
    case 'e': return { ...base, right: 0, top: s, bottom: s, width: s }
    case 'w': return { ...base, left: 0, top: s, bottom: s, width: s }
    case 'ne': return { ...base, top: 0, right: 0, width: c, height: c }
    case 'nw': return { ...base, top: 0, left: 0, width: c, height: c }
    case 'se': return { ...base, bottom: 0, right: 0, width: c, height: c }
    case 'sw': return { ...base, bottom: 0, left: 0, width: c, height: c }
  }
}

interface VwGeometry { position: { x: number; y: number }; size: { width: number; height: number } }

function clampResize(dir: ResizeDir, startGeo: VwGeometry, dx: number, dy: number, min?: { width: number; height: number }): VwGeometry {
  const mw = min?.width ?? MIN_W
  const mh = min?.height ?? MIN_H
  let { x: px, y: py } = startGeo.position
  let { width: w, height: h } = startGeo.size
  if (dir.includes('e')) { w = Math.max(mw, startGeo.size.width + dx) }
  if (dir.includes('w')) { const nw = Math.max(mw, startGeo.size.width - dx); px += startGeo.size.width - nw; w = nw }
  if (dir.includes('s')) { h = Math.max(mh, startGeo.size.height + dy) }
  if (dir.includes('n')) { const nh = Math.max(mh, startGeo.size.height - dy); py += startGeo.size.height - nh; h = nh }
  return { position: { x: px, y: py }, size: { width: w, height: h } }
}

const TBAR_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 6px 0 10px', height: TBAR_H,
  background: 'var(--bg-interactive)', borderBottom: '1px solid var(--border-primary)',
  cursor: 'grab', fontSize: '13px', color: 'var(--text-secondary)',
  userSelect: 'none', flexShrink: 0, gap: 4,
}

const BTN_STYLE: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
  fontSize: '14px', padding: '2px 5px', lineHeight: 1, borderRadius: 4,
}

function tglBtn(on: boolean, color: string): React.CSSProperties {
  return { ...BTN_STYLE, color: on ? color : 'var(--text-dim)' }
}

// 分段按钮（左右乘切换）
function segBtn(on: boolean): React.CSSProperties {
  return {
    ...BTN_STYLE, flex: 1, padding: '3px 6px', fontSize: 11,
    border: '1px solid var(--border-primary)', borderRadius: 4,
    background: on ? 'var(--bg-interactive)' : 'none',
    color: on ? 'var(--text-secondary)' : 'var(--text-dim)',
  }
}

const MINI_BTN: React.CSSProperties = {
  ...BTN_STYLE, fontSize: 10, padding: '2px 10px',
  border: '1px solid var(--border-primary)', borderRadius: 4,
  background: 'var(--bg-interactive)', color: 'var(--text-secondary)',
}

export function ViewWindow({
  view,
  group,
  homomorphism,
  title,
  storageKey,
  config: configProp,
  onConfigChange,
  viewParams: viewParamsProp,
  onViewParamsChange,
  defaultPosition = { x: 120, y: 80 },
  defaultSize = { width: 520, height: 420 },
  onClose,
}: ViewWindowProps) {

  // 视图窗口独立深浅色（与主界面 theme 解耦），通过 data-theme 覆盖子树
  const { viewWindowTheme } = useTheme()

  // 默认持久化键含视图名：同群的 set/cayley 窗口各自独立持久化，互不覆盖
  const persistKey = storageKey ?? (group ? `${group.symbol}|${group.order}|${view}` : (view === 'homomorphism' && homomorphism ? `${homomorphism.source.symbol}|${homomorphism.target.symbol}|homomorphism` : null))
  const persisted = useMemo(() => persistKey ? loadVwPersist(persistKey) : null, [persistKey])

  const [geometry, setGeometry] = useState<VwGeometry>(() => {
    if (persisted) return { position: persisted.position, size: persisted.size }
    return { position: defaultPosition, size: defaultSize }
  })

  const [configState, setConfigState] = useState<ViewWindowConfig>(() =>
    configProp ?? persisted?.config ?? {})
  const [viewParamsState, setViewParamsState] = useState<ViewParams>(() => {
    if (viewParamsProp) return viewParamsProp
    if (persisted) {
      // 按视图用对应 schema 校验持久化参数：键残留他视图参数/手改坏值时回退默认
      const schema = view === 'cayley' ? cayleyViewParamsSchema
        : view === '3d' ? cayley3DViewParamsSchema
          : view === 'set' ? setViewParamsSchema
            : view === 'cycle' ? cycleViewParamsSchema
              : (view === 'table' || view === 'heatmap') ? tableViewParamsSchema
                : view === 'sublattice' ? sublatticeViewParamsSchema
                  : view === 'cosetstrip' ? cosetStripViewParamsSchema
                    : view === 'symmetry' ? symmetryViewParamsSchema
                      : view === 'homomorphism' ? homomorphismViewParamsSchema
                        : view === 'action' ? actionViewParamsSchema
                          : null
      if (schema) {
        const parsed = schema.safeParse(persisted.viewParams)
        if (parsed.success) return parsed.data as ViewParams
      } else {
        return persisted.viewParams as ViewParams
      }
    }
    return {}
  })
  // 受控判定：是否传入对应 onXxxChange。宿主「同时传 xx + onXxxChange」为严格受控
  // （渲染读 prop、交互回传宿主）；「只传 xx」视为非受控的初始默认值（内部 state 接管
  // 后续交互）——否则预设默认参数的窗口（如博客锁定插图）会因既无回调又不更新 state
  // 而冻结，任何参数点击都无效。
  const config = (configProp && onConfigChange) ? configProp : configState
  const viewParams = (viewParamsProp && onViewParamsChange) ? viewParamsProp : viewParamsState

  const [z, setZ] = useState(() => ++_vwZ)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeDir | null>(null)
  const [paramsOpen, setParamsOpen] = useState(false)
  // 乘法表实际渲染内容尺寸（TableView 经 onLayoutSize 上报），用于设定最小窗口尺寸
  const [tableLayoutSize, setTableLayoutSize] = useState<{ width: number; height: number } | null>(null)
  // action 视图窗口本地态：金色箭头联动的悬停群元素 id / 选中集合元素索引（OST 交互）/
  // custom 编辑态（不持久化——viewParams 只存已验证结果，编辑中断刷新回已验证态）
  const [actionHoverId, setActionHoverId] = useState<string | null>(null)
  const [actionSel, setActionSel] = useState<number | null>(null)
  const [actionEdit, setActionEdit] = useState<{ setSize: number; arrows: GroupActionArrow[]; error: CustomArrowError | null } | null>(null)
  // resizable=false：宿主禁止用户调整窗口尺寸（隐藏 resize 手柄，移动不受影响）
  const resizable = config.resizable !== false

  const dragRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 })
  const resizeRef = useRef({ sx: 0, sy: 0, geo: geometry })

  const bringFront = useCallback(() => setZ(++_vwZ), [])

  // Update resizeRef when geometry changes (but NOT during active drag/resize —
  // resize needs the original start geometry as its baseline).
  useEffect(() => {
    if (!dragging && !resizing) resizeRef.current.geo = geometry
  }, [geometry, dragging, resizing])

  // Persist on geometry + config + viewParams change
  const persistTimer = useRef<ReturnType<typeof setTimeout>>(null as unknown as ReturnType<typeof setTimeout>)
  useEffect(() => {
    if (!persistKey) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      saveVwPersist(persistKey, { position: geometry.position, size: geometry.size, config, viewParams: viewParams as Record<string, unknown> })
    }, 300)
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current) }
  }, [geometry, config, viewParams, persistKey])

  const updateConfig = useCallback((p: Partial<ViewWindowConfig>) => {
    // 与「有效值」合并（受控时 prop 优先）：受控模式下内部 state 不更新，
    // 若与陈旧的内部快照合并，连续调整多个开关时后续载荷会丢失之前的值
    const next = { ...config, ...p }
    if (onConfigChange) onConfigChange(next)
    else setConfigState(next)
  }, [config, onConfigChange])

  const updateViewParams = useCallback((p: Partial<SetViewParams> | Partial<CayleyViewParams> | Partial<Cayley3DViewParams> | Partial<CycleViewParams> | Partial<TableViewParams> | Partial<SublatticeViewParams> | Partial<CosetStripViewParams> | Partial<SymmetryViewParams> | Partial<HomomorphismViewParams> | Partial<ActionViewParams>) => {
    // 参数对象按 view 判别（同一时刻只属于一种视图），跨类型合并不需要判别字段
    const next = { ...viewParams, ...p } as ViewParams
    if (onViewParamsChange) onViewParamsChange(next)
    else setViewParamsState(next)
  }, [viewParams, onViewParamsChange])

  // ── 乘法表窗口最小尺寸 ──────────────────────────────────────
  // 最小尺寸 = 完整表格内容（行数×cellSize + 表头/页脚）+ 标题栏，保证整张表可见。
  // 优先用 TableView 上报的精确尺寸（覆盖大群抽样/随机策略）；小群（≤16 阶）回调未
  // 到前可直接推导 k=n，避免首帧跳动。仅普通乘法表（含文字）设置最小尺寸；热力图不设。
  const tableVp = viewParams as TableViewParams
  const tableMinSize = useMemo<{ width: number; height: number } | null>(() => {
    if (view !== 'table' || !group) return null
    if (tableLayoutSize) {
      return {
        width: Math.max(MIN_W, tableLayoutSize.width),
        height: Math.max(MIN_H, tableLayoutSize.height + TBAR_H),
      }
    }
    if (group.order <= 16) {
      const cell = tableVp.cellSize ?? 50
      const k = group.order
      return {
        width: Math.max(MIN_W, k * cell + TABLE_PAD_W),
        height: Math.max(MIN_H, k * cell + TABLE_PAD_H + TBAR_H),
      }
    }
    return null
  }, [view, group, tableLayoutSize, tableVp.cellSize])

  // 渲染期调整：表格尺寸变大（换群/改策略/改单元格尺寸）时把窗口撑到最小所需尺寸
  if (tableMinSize && (geometry.size.width < tableMinSize.width || geometry.size.height < tableMinSize.height)) {
    setGeometry(g =>
      g.size.width < tableMinSize.width || g.size.height < tableMinSize.height
        ? { ...g, size: { width: Math.max(g.size.width, tableMinSize.width), height: Math.max(g.size.height, tableMinSize.height) } }
        : g,
    )
  }

  // Drag
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (config.locked) return
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: geometry.position.x, py: geometry.position.y }
  }, [geometry.position, config.locked])

  // Resize
  const onResizeStart = useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    if (config.locked || !resizable) return
    e.stopPropagation()
    bringFront()
    setResizing(dir)
    resizeRef.current = { sx: e.clientX, sy: e.clientY, geo: geometry }
  }, [bringFront, geometry, config.locked, resizable])

  // Window drag/resize — rAF-throttled so it stays smooth even on slow frames.
  const windowMoveRaf = useRef<number>(0)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging && !resizing) return
      if (windowMoveRaf.current) return
      windowMoveRaf.current = requestAnimationFrame(() => {
        windowMoveRaf.current = 0
        const dx = e.clientX - dragRef.current.sx
        const dy = e.clientY - dragRef.current.sy
        if (resizing) {
          const rdx = e.clientX - resizeRef.current.sx
          const rdy = e.clientY - resizeRef.current.sy
          setGeometry(clampResize(resizing, resizeRef.current.geo, rdx, rdy, tableMinSize ?? undefined))
        } else if (dragging) {
          setGeometry(prev => ({
            ...prev,
            position: {
              x: Math.max(0, dragRef.current.px + dx),
              y: Math.max(0, dragRef.current.py + dy),
            }
          }))
        }
      })
    }
    const onUp = () => { setDragging(false); setResizing(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (windowMoveRaf.current) { cancelAnimationFrame(windowMoveRaf.current); windowMoveRaf.current = 0 }
    }
  }, [dragging, resizing, tableMinSize])

  // Content area pan/zoom
  const viewportRef = useRef<HTMLDivElement>(null)
  const [ct, setCt] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const ctDragRef = useRef({ sx: 0, sy: 0, tx: 0, ty: 0, active: false })

  const contentH = geometry.size.height - TBAR_H
  const contentW = geometry.size.width
  const vbSize = { width: contentW, height: contentH }

  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 8

  // 原生非 passive wheel 监听 —— React 合成 wheel 是 passive，preventDefault 失效且会报错。
  // 仅 Ctrl/Cmd+滚轮 缩放；普通滚轮放行给页面滚动，避免与长页滚动冲突。
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (view === '3d' || view === 'symmetry') return
      // action custom 编辑模式：滚轮缩放会缩走编辑器（主画布编辑态同样不吃 transform），禁用
      if (view === 'action' && actionEdit) return
      if (!e.ctrlKey && !e.metaKey) return
      if (config.zoomLocked) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vw = contentW; const vh = contentH
      const scale = Math.min(rect.width / vw, rect.height / vh)
      const offX = (rect.width - vw * scale) / 2
      const offY = (rect.height - vh * scale) / 2
      const mx = (e.clientX - rect.left - offX) / scale
      const my = (e.clientY - rect.top - offY) / scale
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, ct.scale * factor))
      const sc = ns / ct.scale
      setCt({ x: mx - (mx - ct.x) * sc, y: my - (my - ct.y) * sc, scale: ns })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ct, config.zoomLocked, contentW, contentH, view, actionEdit])

  const onCtMDown = useCallback((e: React.MouseEvent) => {
    if (view === '3d' || view === 'symmetry') return
    // action custom 编辑模式：拖拽平移与画箭头手势冲突，禁用
    if (view === 'action' && actionEdit) return
    if (config.locked || config.zoomLocked) return
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    ctDragRef.current = { sx: e.clientX, sy: e.clientY, tx: ct.x, ty: ct.y, active: true }
  }, [ct, config.locked, config.zoomLocked, view, actionEdit])

  // 缩放围绕视图中心而非原点：避免凯莱图（默认居中）被"推"向左上并被裁剪
  const setZoomScale = useCallback((v: number) => {
    const cx = vbSize.width / 2
    const cy = vbSize.height / 2
    setCt(prev => {
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v))
      const sc = ns / prev.scale
      return { x: cx - (cx - prev.x) * sc, y: cy - (cy - prev.y) * sc, scale: ns }
    })
  }, [vbSize.width, vbSize.height])

  const zoomBy = useCallback((f: number) => {
    const cx = vbSize.width / 2
    const cy = vbSize.height / 2
    setCt(prev => {
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.scale * f))
      const sc = ns / prev.scale
      return { x: cx - (cx - prev.x) * sc, y: cy - (cy - prev.y) * sc, scale: ns }
    })
  }, [vbSize.width, vbSize.height])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ctDragRef.current.active) return
      const dx = e.clientX - ctDragRef.current.sx
      const dy = e.clientY - ctDragRef.current.sy
      setCt(prev => ({ ...prev, x: ctDragRef.current.tx + dx, y: ctDragRef.current.ty + dy }))
    }
    const onUp = () => { ctDragRef.current.active = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const resetCt = useCallback(() => setCt({ x: 0, y: 0, scale: 1 }), [])

  // Reset to factory defaults: clear persisted state, restore default position/size,
  // default config, default view params and reset the viewport transform.
  const resetAll = useCallback(() => {
    if (persistKey) removeStoredKey(`gv-vw-${persistKey}`)
    // 重置尺寸也受表格最小尺寸约束，避免 reset 后表格被裁切
    const resetSize = tableMinSize
      ? { width: Math.max(defaultSize.width, tableMinSize.width), height: Math.max(defaultSize.height, tableMinSize.height) }
      : defaultSize
    setGeometry({ position: defaultPosition, size: resetSize })
    if (onConfigChange) onConfigChange({})
    else setConfigState({})
    if (onViewParamsChange) onViewParamsChange({})
    else setViewParamsState({})
    resetCt()
  }, [persistKey, defaultPosition, defaultSize, tableMinSize, onConfigChange, onViewParamsChange, resetCt])

  // Global "reset all windows" broadcast: every ViewWindow resets itself.
  useEffect(() => {
    const onResetAll = () => resetAll()
    window.addEventListener(VIEWWINDOW_RESET_EVENT, onResetAll)
    return () => window.removeEventListener(VIEWWINDOW_RESET_EVENT, onResetAll)
  }, [resetAll])

  // selection for set/cayley views（窗口本地会话态，独立于主应用选中）
  const [sel, setSel] = useState<Set<string>>(new Set())
  const handleSelect = useCallback((id: string, add: boolean) => {
    setSel(s => {
      const n = new Set(s)
      if (add) { if (n.has(id)) n.delete(id); else n.add(id) }
      else { n.clear(); n.add(id) }
      return n
    })
  }, [])

  // 悬停就地气泡（C 方案）：标签随 LOD 隐藏时，悬停节点在节点旁浮出元素名与阶。
  // 切换展示群/视图时清空悬停：渲染期状态调整（React 官方 pattern，避免 effect 内 setState）
  const [hoverEl, setHoverEl] = useState<GroupElement | null>(null)
  const [hoverAnchor, setHoverAnchor] = useState<{ x: number; y: number } | null>(null)
  // 对称性视图演示状态浮条文本（scene onHint 上抛）
  const [symHintText, setSymHintText] = useState<string | null>(null)
  // 对称性视图重放信号：自增即让 SymmetryViewScene 对当前演示元素重播一次（同元素可反复观看）
  const [symReplay, setSymReplay] = useState(0)
  const displayKey = view + (group ? `|${group.symbol}|${group.order}` : (view === 'homomorphism' && homomorphism ? `|${homomorphism.source.symbol}|${homomorphism.target.symbol}` : ''))
  const [curDisplayKey, setCurDisplayKey] = useState(displayKey)
  if (curDisplayKey !== displayKey) {
    setCurDisplayKey(displayKey)
    setHoverEl(null)
    setHoverAnchor(null)
    setSymHintText(null)
    setActionHoverId(null)
    setActionSel(null)
    setActionEdit(null)
  }
  const handleHover = useCallback(
    (el: GroupElement | null, anchor?: { x: number; y: number } | null) => {
      setHoverEl(el)
      setHoverAnchor(anchor ?? null)
    },
    [],
  )
  const hoverOrder = useMemo(() => {
    if (!hoverEl) return 0
    // homomorphism 窗口无 group：hover 元素可能属 source 或 target，按 id 归属判定其群
    const g = group
      ?? (homomorphism && homomorphism.source.elements.some(e => e.id === hoverEl.id) ? homomorphism.source : null)
      ?? (homomorphism?.target ?? null)
    if (!g) return 0
    let cur = hoverEl
    for (let i = 1; i <= g.order; i++) {
      if (cur.id === g.identity.id) return i
      cur = g.multiply(cur, hoverEl)
    }
    return 0
  }, [group, homomorphism, hoverEl])
  const showControls = config.showControls !== false
  const showZoomSlider = config.showZoomSlider !== false

  // ── symmetry 窗口派生（unsupported 群 → SymmetryViewScene 内部提示 overlay，无演示/状态浮条） ──
  const symVp = viewParams as SymmetryViewParams
  const symType = view === 'symmetry' && group ? getSymmetryType(group) : null
  const symSupported = !!symType && symType !== 'unsupported'
  const symCanDual = symType === 'cube' || symType === 'icosahedron'
  const symShowAction = !!symVp.showAction
  const symActiveId = symVp.actionElementId ?? null

  const infoText = useMemo(() => {
    if (!config.showInfo) return ''
    if (group) return `${group.symbol} · ${group.order} ord`
    if (view === 'homomorphism' && homomorphism) return `|G|=${homomorphism.source.order} → |H|=${homomorphism.target.order}`
    return ''
  }, [group, config.showInfo, view, homomorphism])

  // ── cosetstrip 窗口数据派生（自包含，不依赖主应用 subsets 状态） ──────
  // 候选子群 = listCosetStripSubgroups（共轭轨道合并、index 升序）；viewParams.subgroup
  // 失效（换群/手改坏值/非真子群）→ 回退默认首候选。H 确定后经 cosetDataForSubgroup
  // → elementMap/colors/highlight 喂给 CosetStripScene（与主画布同一渲染内核）。
  const cosetStripVp = viewParams as CosetStripViewParams
  const csOpts = useMemo<CosetStripSubgroupOption[]>(
    () => (view === 'cosetstrip' && group ? listCosetStripSubgroups(group) : []),
    [view, group],
  )
  const csSubgroup = useMemo<CosetStripSubgroupOption | null>(() => {
    if (view !== 'cosetstrip' || !group || csOpts.length === 0) return null
    const want = cosetStripVp.subgroup ? [...cosetStripVp.subgroup].sort().join(',') : null
    const match = want ? csOpts.find(o => o.key === want) : undefined
    return match ?? csOpts[0]
  }, [view, group, csOpts, cosetStripVp.subgroup])
  const csType = cosetStripVp.cosetType ?? 'left'
  const csCosetData = useMemo(() => {
    if (view !== 'cosetstrip' || !group || !csSubgroup) return null
    return cosetDataForSubgroup(group, csSubgroup.elementIds)
  }, [view, group, csSubgroup])
  const csElementMap = useMemo(
    () => (csCosetData ? computeCosetElementMap(csCosetData, csType) : null),
    [csCosetData, csType],
  )
  const csColors = useMemo(
    () => (csCosetData ? computeCosetColors(csCosetData, csType) : []),
    [csCosetData, csType],
  )
  const csHighlight = useMemo(
    () => (csCosetData && csElementMap
      ? computeCosetHighlightSet(csCosetData, csType, false, sel, csElementMap)
      : new Set<number>()),
    [csCosetData, csType, sel, csElementMap],
  )

  // ── action 窗口数据派生（自包含，不依赖主应用 GroupActionContext） ──────
  // conjugation/regular：buildActionComputation 直算；custom：viewParams 里的
  // 已验证箭头自算（坏值/换群失效 → computation 为 null，渲染 noAction，
  // 参数面板 Edit arrows 重新进入编辑）。编辑态（actionEdit 非空）时不算。
  const actionVp = viewParams as ActionViewParams
  const actionKind = actionVp.actionKind ?? 'conjugation'
  const actionComputation = useMemo<GroupActionComputation | null>(() => {
    if (view !== 'action' || !group || actionEdit) return null
    if (actionKind === 'custom') {
      // 空 arrows = 平凡作用（全部不动点），同样合法可显示
      if (!actionVp.setSize || !actionVp.arrows) return null
      const r = buildActionComputation(group, { kind: 'custom', setSize: actionVp.setSize }, actionVp.arrows)
      return r.computation && r.computation.isHomomorphism ? r.computation : null
    }
    if (actionKind !== 'conjugation' && actionKind !== 'regular') return null
    return buildActionComputation(group, { kind: actionKind }).computation ?? null
  }, [view, group, actionKind, actionVp.setSize, actionVp.arrows, actionEdit])
  // custom 编辑流：进入编辑（从已验证态/缺省继承）、箭头操作（纯变换直接改编辑态）、
  // 完成并验证（通过才写回 viewParams 持久化）、取消（丢弃编辑态）
  const startOrEditCustom = useCallback(() => {
    if (!group) return
    setActionEdit({ setSize: actionVp.setSize ?? 6, arrows: actionVp.arrows ?? [], error: null })
    updateViewParams({ actionKind: 'custom' })
  }, [group, actionVp.setSize, actionVp.arrows, updateViewParams])
  const verifyAndSaveCustom = useCallback(() => {
    if (!group || !actionEdit) return
    const r = buildActionComputation(group, { kind: 'custom', setSize: actionEdit.setSize }, actionEdit.arrows)
    if (r.error) { setActionEdit({ ...actionEdit, error: r.error }); return }
    if (r.computation && !r.computation.isHomomorphism && r.computation.violation) {
      const v = r.computation.violation
      setActionEdit({ ...actionEdit, error: { generatorId: v.a, from: v.x, to: -1, g: v.g, type: 'homomorphism' } })
      return
    }
    updateViewParams({ actionKind: 'custom', setSize: actionEdit.setSize, arrows: actionEdit.arrows })
    setActionEdit(null)
    setActionSel(null)
  }, [group, actionEdit, updateViewParams])

  const renderContent = () => {
    if (view === 'homomorphism') {
      if (!homomorphism) {
        return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>No homomorphism</div>
      }
      const homoVp = viewParams as HomomorphismViewParams
      const homoResult = homomorphism.mapping.size === 0
        ? null
        : (homomorphism.result ?? verifyHomomorphism(homomorphism.source, homomorphism.target, homomorphism.mapping))
      return (
        <HomomorphismScene
          key={`homomorphism-${homomorphism.source.symbol}-${homomorphism.target.symbol}`}
          source={homomorphism.source}
          target={homomorphism.target}
          mapping={homomorphism.mapping}
          result={homoResult}
          name={homomorphism.name}
          showLabels={homoVp.showLabels ?? false}
          onHover={handleHover}
        />
      )
    }
    if (!group) return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>No group</div>

    if (view === 'cayley') {
      const cvp = viewParams as CayleyViewParams
      const effShape = cvp.shape2D ?? getDefaultShape2D(group)
      return (
        <CayleyView
          key={`cayley-${group.symbol}-${group.order}-${effShape}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          shape2D={cvp.shape2D}
          multiplyType={cvp.multiplyType}
          actions={cvp.actions}
          nodeRadius={cvp.nodeRadius}
          showLabels={false}
          locked={config.locked}
          onSelect={handleSelect}
          onHover={handleHover}
          hoveredElementId={hoverEl?.id ?? null}
        />
      )
    }

    if (view === '3d') {
      // 3D 相机自管理（轨道/滚轮/平移），不吃窗口 ct；hover 反馈由 3D 场景内 Html 标签承担
      const p3 = viewParams as Cayley3DViewParams
      return (
        <Cayley3DScene
          key={`3d-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          onSelectElement={handleSelect}
          actions={p3.actions}
          multiplyType={p3.multiplyType}
          layout3D={p3.layout3D}
          nodeScale={p3.nodeScale}
          autoRotate={p3.autoRotate}
          showLabels={p3.showLabels}
          locked={config.locked}
          faceFill={p3.faceFill}
        />
      )
    }

    if (view === 'cycle') {
      const cyvp = viewParams as CycleViewParams
      return (
        <CycleView
          key={`cycle-${group.symbol}-${group.order}-${cyvp.showMaximalCycles ? 'max' : 'all'}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          showMaximalCycles={cyvp.showMaximalCycles}
          nodeRadius={cyvp.nodeRadius}
          showLabels={false}
          showCycleLabels={cyvp.showCycleLabels}
          locked={config.locked}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      )
    }

    if (view === 'table') {
      const tvp = viewParams as TableViewParams
      return (
        <TableView
          key={`table-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          strategy={tvp.strategy}
          cellSize={tvp.cellSize}
          onStrategyChange={s => updateViewParams({ strategy: s })}
          onLayoutSize={setTableLayoutSize}
          onSelect={handleSelect}
          onHover={() => {}}
        />
      )
    }

    if (view === 'heatmap') {
      // 热力图独立窗口：无文字、纯色块；不设最小尺寸，颜色密度呈现宏观结构
      const tvp = viewParams as TableViewParams
      return (
        <TableView
          key={`heatmap-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          strategy={tvp.strategy}
          cellSize={tvp.cellSize}
          showHeatmap
          onStrategyChange={s => updateViewParams({ strategy: s })}
          onSelect={handleSelect}
          onHover={() => {}}
        />
      )
    }

    if (view === 'sublattice') {
      // 子群格：内核自测绘图区像素并据此自动降级 LOD，故不传 viewBoxSize
      const slp = viewParams as SublatticeViewParams
      return (
        <SublatticeScene
          key={`sublattice-${group.symbol}-${group.order}`}
          group={group}
          canvasTransform={ct}
          labelDetail={slp.labelDetail}
          mergeConjugates={slp.mergeConjugates}
          nodeScale={slp.nodeScale}
          showSeriesPanel={slp.showSeriesPanel}
        />
      )
    }

    if (view === 'cosetstrip') {
      // 窗口缺省：节点常驻标签关闭（读元素靠悬停就地气泡）、顶部 H-Cayley 小圈关闭
      // （省空间给条带区）；两开关都在参数面板可开回主画布观感。
      return (
        <CosetStripScene
          key={`cosetstrip-${group.symbol}-${group.order}-${csSubgroup?.key ?? 'none'}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          cosetElementMap={csElementMap}
          cosetColors={csColors}
          cosetHighlightSet={csHighlight}
          showLabels={cosetStripVp.showLabels ?? false}
          showSubgroupCayley={cosetStripVp.showSubgroupCayley ?? false}
          noCosetsText={csOpts.length === 0 ? COSETSTRIP_NO_LOCAL_SUBGROUPS : undefined}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      )
    }

    if (view === 'action') {
      // 窗口缺省：节点常驻标签 + 顶部轨道 chips 区关闭（读元素靠悬停就地气泡，
      // 与 homo/cosetstrip 窗口一致），参数面板 Show labels 可开回主画布观感。
      // 编辑态渲染编辑器（不吃窗口 ct）；conjugation/regular 显示态吃窗口 ct。
      const effKind = actionEdit ? 'custom' : actionKind
      return (
        <ActionScene
          key={`action-${group.symbol}-${group.order}-${effKind}`}
          group={group}
          kind={effKind}
          computation={actionComputation}
          editing={!!actionEdit}
          setSize={actionEdit ? actionEdit.setSize : (actionVp.setSize ?? null)}
          arrows={actionEdit ? actionEdit.arrows : (actionVp.arrows ?? [])}
          error={actionEdit ? actionEdit.error : null}
          onAddArrow={(from, to, genId) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListAdd(prev.arrows, from, to, genId ?? null), error: null } : prev)}
          onBindArrow={(from, to, genId) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListBind(prev.arrows, from, to, genId), error: null } : prev)}
          onRemoveArrow={(from, genId, to) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListRemove(prev.arrows, from, genId ?? null, to) } : prev)}
          onReplaceGenArrows={(genId, pairs) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListReplaceGen(prev.arrows, genId, pairs), error: null } : prev)}
          selectedElement={actionSel}
          onSelectedElementChange={setActionSel}
          hoveredElement={actionHoverId}
          onHoverElementChange={setActionHoverId}
          showLabels={actionVp.showLabels ?? false}
          onHover={handleHover}
          canvasTransform={ct}
          viewBoxSize={vbSize}
        />
      )
    }

    if (view === 'symmetry') {
      // 对称性视图：3D 相机自管理（不吃窗口 ct/zoom）；unsupported 群由 SymmetryViewScene 内部渲染提示 overlay
      const symVp = viewParams as SymmetryViewParams
      return (
        <SymmetryViewScene
          key={`symmetry-${group.symbol}-${group.order}`}
          group={group}
          dark={viewWindowTheme === 'dark'}
          variant={symVp.variant}
          showAction={symVp.showAction}
          actionElementId={symVp.actionElementId ?? null}
          rotateSpeed={symVp.rotateSpeed}
          // 窗口标题栏已显示群名，场景内图注默认关闭（避免「标题一个群名、场景又一个群名+几何」重复）
          showFigureTitle={symVp.showFigureTitle ?? false}
          locked={config.locked}
          hintOnIdle={false}
          replaySignal={symReplay}
          onHint={msg => setSymHintText(msg)}
        />
      )
    }

    if (view !== 'set') return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>View "{view}" coming soon</div>

    const svp = viewParams as SetViewParams
    const sp: SetViewProps = {
      group,
      selectedElements: sel,
      canvasTransform: ct,
      viewBoxSize: vbSize,
      nodeRadius: svp.nodeRadius,
      gap: svp.gap,
      columns: svp.columns,
      showLabels: svp.showLabels,
      onSelect: handleSelect,
      onHover: handleHover,
    }
    return (
      <SetView
        key={`set-${group.symbol}-${group.order}`}
        {...sp}
      />
    )
  }

  // ── sublattice 视图参数面板数据 ──
  const sublatticeParams = viewParams as SublatticeViewParams

  // ── cayley 视图参数面板数据（与 CayleyView 渲染层同一套缺省/归一化规则） ──
  const cayleyShapes = useMemo<CayleyShape2D[]>(
    () => (view === 'cayley' && group ? getAvailableShapesForView(group, 'cayley') : []),
    [view, group],
  )
  const cayleyVp = viewParams as CayleyViewParams
  const setVp = viewParams as SetViewParams
  const cycleVp = viewParams as CycleViewParams
  const homoVp = viewParams as HomomorphismViewParams
  const cayleyDefaultShape = useMemo<CayleyShape2D>(
    () => (group ? getDefaultShape2D(group) : 'circular'),
    [group],
  )
  const cayleyShapeValue: CayleyShape2D =
    view === 'cayley' && cayleyVp.shape2D && cayleyShapes.includes(cayleyVp.shape2D)
      ? cayleyVp.shape2D
      : cayleyDefaultShape
  const cayleyActionsList = useMemo(
    () => (view === 'cayley' && group ? normalizeCayleyActions(group, cayleyVp.actions) : []),
    [view, group, cayleyVp.actions],
  )
  const cayleyEnabledCount = useMemo(
    () => cayleyActionsList.filter(a => a.enabled).length,
    [cayleyActionsList],
  )

  // ── cayley3d 视图参数面板数据（与 Cayley3DScene 渲染层同一套缺省/归一化规则） ──
  const shapes3d = useMemo<Layout3D[]>(
    () => (view === '3d' && group ? getAvailableShapes3D(group) : []),
    [view, group],
  )
  const p3d = viewParams as Cayley3DViewParams
  const layout3dDefault = useMemo<Layout3D>(
    () => (group ? getDefaultLayout3D(group) : 'cone'),
    [group],
  )
  const layout3dValue: Layout3D =
    view === '3d' && p3d.layout3D && shapes3d.includes(p3d.layout3D)
      ? p3d.layout3D
      : layout3dDefault
  const cayley3dActionsList = useMemo(
    () => (view === '3d' && group ? normalizeCayleyActions(group, p3d.actions) : []),
    [view, group, p3d.actions],
  )
  const cayley3dEnabledCount = useMemo(
    () => cayley3dActionsList.filter(a => a.enabled).length,
    [cayley3dActionsList],
  )

  // ── 3D 面填充：几何上有陪集面可用的子群候选（作者在此选择 H） ──
  const faceSubgroupCands = useMemo<FaceSubgroupResult[]>(() => {
    if (view !== '3d' || !group) return []
    const actions = cayley3dActionsList.filter(a => a.enabled)
    const positions = compute3DPositions(group, layout3dValue)
    const edges = computeCayleyActionEdges(group, actions, p3d.multiplyType ?? 'right')
    const edgeKeys = buildUndirectedEdgeKeys(edges.map(e => [e.fromIdx, e.toIdx] as [number, number]))
    return (
      listFaceSubgroups(
        group,
        positions.map(v => [v[0], v[1], v[2]] as [number, number, number]),
        edgeKeys,
      ) ?? []
    )
  }, [view, group, cayley3dActionsList, layout3dValue, p3d.multiplyType])
  // 当前选中的 H（与候选匹配 → 其分面渲染在面板上）；换群/换布局后失效则回到未选
  const faceSelSubgroup = useMemo<FaceSubgroupResult | null>(() => {
    const ff = p3d.faceFill
    if (!ff?.subgroup || ff.subgroup.length === 0) return null
    const key = ff.subgroup.join(',')
    return faceSubgroupCands.find(c => c.elementIds.join(',') === key) ?? null
  }, [faceSubgroupCands, p3d.faceFill])
  const faceOn = p3d.faceFill?.enabled !== false && !!faceSelSubgroup
  const patchFaceFill = useCallback(
    (patch: Partial<Cayley3DFaceFillParams>) => {
      updateViewParams({ faceFill: { ...(p3d.faceFill ?? {}), ...patch } } as Partial<Cayley3DViewParams>)
    },
    [updateViewParams, p3d.faceFill],
  )

  // Params panel floats OUTSIDE the window frame as a sibling overlay (a child would be
  // clipped by the window's overflow:hidden): docked to the window's right edge, flipping
  // to its left side when that would overflow the viewport. Follows drag/resize because
  // it derives from the same geometry state.
  const placeLeft = geometry.position.x + geometry.size.width + PARAMS_GAP + PARAMS_W > window.innerWidth
  const paramsLeft = placeLeft
    ? Math.max(0, geometry.position.x - PARAMS_GAP - PARAMS_W)
    : geometry.position.x + geometry.size.width + PARAMS_GAP

  return (
    <>
      <div
        data-theme={viewWindowTheme}
        style={{
          position: config.viewportFixed ? 'fixed' : 'absolute', left: geometry.position.x, top: geometry.position.y,
          width: geometry.size.width, height: geometry.size.height, zIndex: z,
          display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          background: 'var(--bg-primary)',
          cursor: dragging ? 'grabbing' : 'default',
        }}
        onMouseDown={bringFront}
      >
        {/* titlebar */}
        <div style={TBAR_STYLE} onMouseDown={onDragStart}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title ?? (group ? group.symbol : (view === 'homomorphism' && homomorphism ? (homomorphism.name || `${homomorphism.source.symbol} → ${homomorphism.target.symbol}`) : 'View'))}
            {infoText && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{infoText}</span>}
          </span>
          {/* 博客插图等专注阅读场景可 config.showControls=false 整组隐藏 */}
          {showControls && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button title="Lock move" style={tglBtn(!!config.locked, '#f97316')}
                onClick={() => updateConfig({ locked: !config.locked })}>{config.locked ? '📌' : '📍'}</button>
              <button title="Lock zoom" style={tglBtn(!!config.zoomLocked, '#38bdf8')}
                onClick={() => updateConfig({ zoomLocked: !config.zoomLocked })}>{config.zoomLocked ? '🔒' : '🔍'}</button>
              <button title="Toggle info" style={tglBtn(!!config.showInfo, '#84cc16')}
                onClick={() => updateConfig({ showInfo: !config.showInfo })}>i</button>
              <button title="Parameters" style={tglBtn(paramsOpen, '#a78bfa')}
                onClick={() => {
                  const next = !paramsOpen
                  setParamsOpen(next)
                  // 打开面板时窗口置顶，避免外置面板被更高层的相邻窗口盖住
                  if (next) bringFront()
                }}>⚙</button>
              <button title="Close" style={BTN_STYLE}
                onClick={onClose}
                onMouseEnter={e => (e.currentTarget.style.color = '#f44')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>×</button>
            </div>
          )}
        </div>

        {/* content */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* main viewport */}
          <div
            ref={viewportRef}
            style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}
            onMouseDown={onCtMDown}
            onDoubleClick={(e) => {
              if (!(e.target instanceof SVGElement && e.target.tagName === 'svg')) return
              resetCt()
            }}
          >
            {/* 视图组件自含 canvasTransform（SetView/CayleyView 在自身 <g> 上应用），
                直接渲染，不再包外层 <svg>（避免嵌套 svg 冗余 viewport） */}
            {renderContent()}

            {/* zoom slider overlay (avoids wheel/page-scroll conflict)；
                3D 相机自带滚轮缩放，窗口滑杆/ct 不参与 */}
            {showZoomSlider && view !== '3d' && view !== 'symmetry' && view !== 'homomorphism' && !(view === 'action' && actionEdit) && (
              <div style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-interactive)', borderRadius: 6, padding: '2px 6px',
                border: '1px solid var(--border-primary)', zIndex: 5, fontSize: 12,
                color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                opacity: config.zoomLocked ? 0.4 : 0.85, pointerEvents: config.zoomLocked ? 'none' : 'auto',
              }}>
                <button title="Zoom out" style={BTN_STYLE} onClick={() => zoomBy(0.8)}>−</button>
                <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.05}
                  value={ct.scale}
                  onChange={e => setZoomScale(Number(e.target.value))}
                  style={{ width: 120 }} />
                <button title="Zoom in" style={BTN_STYLE} onClick={() => zoomBy(1.25)}>+</button>
                <button title="Reset view" style={BTN_STYLE} onClick={resetCt}>⟲</button>
              </div>
            )}

            {/* 概览引导：未悬停时显示底部居中提示，让"悬停可读元素"主动被发现（标签隐藏态下唯一的信息取回方式）。
                对称性视图无节点可悬停，不显示（其演示说明只走底部状态浮条） */}
            {!hoverEl && view !== 'symmetry' && !(view === 'action' && actionEdit) && (
              <div
                data-testid="figure-hint"
                style={{
                  position: 'absolute',
                  bottom: showZoomSlider && view !== '3d' ? 48 : 12, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(78,205,196,0.4)',
                  borderRadius: 8, padding: '5px 14px', zIndex: 6, fontSize: 12,
                  color: '#94a3b8', pointerEvents: 'none', backdropFilter: 'blur(4px)',
                }}
              >
                <span style={{ color: '#4ecdc4' }}>💡</span>
                悬停节点查看元素名与阶
              </div>
            )}

            {/* 就地气泡：悬停节点旁浮出元素名+阶（HTML 层、字号不随图缩放），带指向节点的小三角，
                节点靠近顶部时翻转到节点下方，配合节点青色高亮环形成"环+就近气泡"双重反馈 */}
            {hoverEl && hoverAnchor && (
              <div
                data-testid="hover-hud"
                style={{
                  position: 'absolute', left: hoverAnchor.x, top: hoverAnchor.y,
                  zIndex: 8, pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0,
                    transform: hoverAnchor.y < 72 ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(15,23,42,0.95)', border: '1px solid #4ecdc4',
                    borderRadius: 9, padding: '6px 14px', fontSize: 16,
                    color: '#f1f5f9', whiteSpace: 'nowrap',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.45), 0 0 0 2px rgba(78,205,196,0.15)',
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(hoverEl.label)) }} />
                  <span style={{ color: '#64748b', fontSize: 12 }}>·</span>
                  <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>order {hoverOrder}</span>
                  {/* 指向节点的小三角 */}
                  <span
                    style={{
                      position: 'absolute',
                      ...(hoverAnchor.y < 72
                        ? { top: -7, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '7px solid #4ecdc4' }
                        : { bottom: -7, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid #4ecdc4' }),
                      left: '50%', transform: 'translateX(-50%)',
                      width: 0, height: 0,
                    }}
                  />
                </div>
              </div>
            )}
            {/* 对称性视图：演示状态浮条 —— 演示说明的唯一展示位置（场景内不再浮动状态行）。
                仅当选定元素且确有几何旋转（真实状态）时显示；元素选择与引导文案在 ⚙ 面板内。
                浮条自带 ⟳ 重放（同元素可反复观看）与 ✕ 复位（回恒等姿态），是窗口内的演示操作区 */}
            {view === 'symmetry' && group && symSupported && symActiveId && symHintText && (
              <div
                data-testid="sym-demo-hint"
                style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6, maxWidth: '94%',
                  background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(78,205,196,0.45)',
                  borderRadius: 8, padding: '4px 6px 4px 12px', zIndex: 6, fontSize: 12,
                  color: '#cbd5e1', pointerEvents: 'auto', backdropFilter: 'blur(4px)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: '#4ecdc4', flexShrink: 0 }}>⟳</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
                  dangerouslySetInnerHTML={{ __html: symHintText }} />
                <span style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
                  <button
                    title="Replay this action"
                    data-testid="sym-demo-replay"
                    onClick={() => setSymReplay(n => n + 1)}
                    style={{
                      background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.5)',
                      color: '#4ecdc4', borderRadius: 4, padding: '2px 8px', fontSize: 11,
                      cursor: 'pointer', lineHeight: 1.5, userSelect: 'none',
                    }}
                  >
                    ⟳ Replay
                  </button>
                  {!config.actionLocked && (
                    <button
                      title="Reset pose (identity)"
                      data-testid="sym-demo-reset"
                      onClick={() => updateViewParams({ actionElementId: null })}
                      style={{
                        background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.4)',
                        color: '#cbd5e1', borderRadius: 4, padding: '2px 8px', fontSize: 11,
                        cursor: 'pointer', lineHeight: 1.5, userSelect: 'none',
                      }}
                    >
                      ✕ Reset
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        {resizable && RESIZE_DIRS.map(dir => (
          <div key={dir} style={resizeHandleStyle(dir)}
            onMouseDown={onResizeStart(dir)}
          />
        ))}
      </div>

      {/* params panel — outside the window so it never covers the view */}
      {paramsOpen && (
        <div
          data-theme={viewWindowTheme}
          style={{
            position: config.viewportFixed ? 'fixed' : 'absolute',
            left: paramsLeft, top: geometry.position.y, width: PARAMS_W,
            maxHeight: geometry.size.height, overflowY: 'auto', zIndex: z,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)',
          }}
          onMouseDown={bringFront}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>View Config</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={!!config.locked} onChange={e => updateConfig({ locked: e.target.checked })} />
            Lock move
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={!!config.zoomLocked} onChange={e => updateConfig({ zoomLocked: e.target.checked })} />
            Lock zoom
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={!!config.showInfo} onChange={e => updateConfig({ showInfo: e.target.checked })} />
            Show info
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input type="checkbox" checked={!!config.viewportFixed} onChange={e => updateConfig({ viewportFixed: e.target.checked })} />
            Fixed to viewport
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={config.showControls !== false} onChange={e => updateConfig({ showControls: e.target.checked })} />
            Show controls
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input type="checkbox" checked={config.showZoomSlider !== false} onChange={e => updateConfig({ showZoomSlider: e.target.checked })} />
            Show zoom slider
          </label>

          {view === 'set' && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Set View</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Node radius</div>
                <input type="range" min={8} max={60} value={setVp.nodeRadius ?? 26}
                  onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.nodeRadius ?? 26}px</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Gap</div>
                <input type="range" min={0} max={40} value={setVp.gap ?? 8}
                  onChange={e => updateViewParams({ gap: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.gap ?? 8}px</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Columns (0=auto)</div>
                <input type="range" min={0} max={20} value={setVp.columns ?? 0}
                  onChange={e => updateViewParams({ columns: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.columns ?? 0}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={setVp.showLabels !== false}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show labels
              </label>
            </>
          )}

          {view === 'homomorphism' && homomorphism && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Homomorphism View</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={homoVp.showLabels === true}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show labels
              </label>
            </>
          )}

          {view === 'action' && group && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Action View</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Action kind</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button data-testid="action-kind-conjugation" style={segBtn(actionKind === 'conjugation')}
                    onClick={() => { setActionEdit(null); updateViewParams({ actionKind: 'conjugation' }) }}>Conjugation</button>
                  <button data-testid="action-kind-regular" style={segBtn(actionKind === 'regular')}
                    onClick={() => { setActionEdit(null); updateViewParams({ actionKind: 'regular' }) }}>Translation</button>
                  <button data-testid="action-kind-custom" style={segBtn(actionKind === 'custom')}
                    onClick={startOrEditCustom}>Custom</button>
                </div>
              </div>
              {actionKind === 'custom' && (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ marginBottom: 2 }}>|X| (1–20)</div>
                    <input data-testid="action-set-size" type="number" min={1} max={20}
                      value={actionEdit ? actionEdit.setSize : (actionVp.setSize ?? 6)}
                      onChange={e => {
                        const v = Math.max(1, Math.min(20, Math.round(Number(e.target.value)) || 1))
                        if (actionEdit) setActionEdit({ ...actionEdit, setSize: v })
                        else updateViewParams({ setSize: v, arrows: undefined })
                      }}
                      style={{
                        width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                      }} />
                  </div>
                  {actionEdit ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      <button data-testid="action-edit-complete" style={MINI_BTN}
                        onClick={verifyAndSaveCustom}>Complete &amp; verify</button>
                      <button style={MINI_BTN}
                        onClick={() => setActionEdit(p => p ? { ...p, arrows: [], error: null } : p)}>Clear arrows</button>
                      <button data-testid="action-edit-cancel" style={MINI_BTN}
                        onClick={() => setActionEdit(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 6 }}>
                      <button data-testid="action-edit-start" style={MINI_BTN}
                        onClick={startOrEditCustom}>Edit arrows</button>
                    </div>
                  )}
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={actionVp.showLabels === true}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show labels
              </label>
            </>
          )}

          {view === 'cayley' && group && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cayley View</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Shape</div>
                <select
                  value={cayleyShapeValue}
                  onChange={e => updateViewParams({ shape2D: e.target.value as CayleyShape2D })}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }}
                >
                  {cayleyShapes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Multiply</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button title="Right multiply a·c" style={segBtn(cayleyVp.multiplyType !== 'left')}
                    onClick={() => updateViewParams({ multiplyType: 'right' })}>a·c</button>
                  <button title="Left multiply c·a" style={segBtn(cayleyVp.multiplyType === 'left')}
                    onClick={() => updateViewParams({ multiplyType: 'left' })}>c·a</button>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Node radius</div>
                <input type="range" min={8} max={60} value={cayleyVp.nodeRadius ?? 28}
                  onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.nodeRadius ?? 28}px</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Edge actions</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyEnabledCount}/{cayleyActionsList.length}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <button title="Add every element as an action" style={MINI_BTN}
                    onClick={() => updateViewParams({ actions: addAllCayleyActionsHelper(group, 'cayley', 'cone', cayleyActionsList) })}>All</button>
                  <button title="Clear all actions (no edges)" style={MINI_BTN}
                    onClick={() => updateViewParams({ actions: [] })}>None</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {cayleyActionsList.map(a => {
                    const el = group.elements.find(e => e.id === a.elementId)
                    return (
                      <label key={a.elementId} title={a.elementId} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, cursor: 'pointer' }}>
                        <input type="checkbox" checked={a.enabled}
                          onChange={() => updateViewParams({ actions: toggleCayleyActionReducer(cayleyActionsList, a.elementId) })} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label ?? a.elementId)) }}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {view === '3d' && group && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cayley 3D View</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Layout</div>
                <select
                  value={layout3dValue}
                  onChange={e => updateViewParams({ layout3D: e.target.value as Layout3D })}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }}
                >
                  {shapes3d.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Multiply</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button title="Right multiply a·c" style={segBtn(p3d.multiplyType !== 'left')}
                    onClick={() => updateViewParams({ multiplyType: 'right' })}>a·c</button>
                  <button title="Left multiply c·a" style={segBtn(p3d.multiplyType === 'left')}
                    onClick={() => updateViewParams({ multiplyType: 'left' })}>c·a</button>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Node size</div>
                <input type="range" min={0.5} max={2} step={0.1} value={p3d.nodeScale ?? 1}
                  onChange={e => updateViewParams({ nodeScale: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(p3d.nodeScale ?? 1).toFixed(1)}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <input type="checkbox" checked={!!p3d.autoRotate}
                  onChange={e => updateViewParams({ autoRotate: e.target.checked })} />
                Auto rotate
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={p3d.showLabels !== false}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show labels
              </label>
              <div style={{ marginBottom: 6, borderTop: '1px solid var(--border-secondary)', paddingTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <input type="checkbox" checked={p3d.faceFill?.enabled !== false}
                    onChange={e => patchFaceFill({ enabled: e.target.checked })} />
                  Face fills (subgroup cosets)
                </label>
                <select
                  value={faceSelSubgroup ? faceSelSubgroup.elementIds.join(',') : ''}
                  onChange={e => {
                    const cand = faceSubgroupCands.find(c => c.elementIds.join(',') === e.target.value)
                    patchFaceFill({ enabled: true, subgroup: cand ? cand.elementIds : undefined })
                  }}
                  disabled={faceSubgroupCands.length === 0}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }}
                >
                  <option value="">
                    {faceSubgroupCands.length === 0
                      ? 'No selectable subgroup (order ≤ 60, coset faces must match geometry)'
                      : '— select subgroup —'}
                  </option>
                  {faceSubgroupCands.map(c => (
                    <option key={c.elementIds.join(',')} value={c.elementIds.join(',')} title={c.elementIds.join(',')}>
                      {c.structure ?? `order ${c.order}`} ⟨{c.genLabel}⟩ · {c.faces.length} face{c.faces.length > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                {faceOn && faceSelSubgroup && (
                  <>
                    <div style={{ marginTop: 4 }}>
                      <div style={{ marginBottom: 2 }}>Opacity</div>
                      <input type="range" min={0.15} max={0.9} step={0.05} value={p3d.faceFill?.opacity ?? 0.45}
                        onChange={e => patchFaceFill({ opacity: Number(e.target.value) })}
                        style={{ width: '100%' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 2px' }}>
                      {faceSelSubgroup.faces.length} coset face{faceSelSubgroup.faces.length > 1 ? 's' : ''} — colour each:
                    </div>
                    <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                      {faceSelSubgroup.faces.map((f, i) => (
                        <label key={f.key} title={f.hullElementIds.join(' · ')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, cursor: 'pointer' }}>
                          <input type="color"
                            value={p3d.faceFill?.faceColors?.[f.key] ?? FACE_COLOR_PALETTE[i % FACE_COLOR_PALETTE.length]}
                            onChange={e => patchFaceFill({ faceColors: { ...(p3d.faceFill?.faceColors ?? {}), [f.key]: e.target.value } })}
                            style={{ width: 26, height: 18, border: 'none', background: 'none', padding: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            dangerouslySetInnerHTML={{
                              __html: renderTex(texify(
                                faceSelSubgroup.faces[i].hullElementIds[0]
                                  ? group.elements.find(el => el.id === faceSelSubgroup.faces[i].hullElementIds[0])?.label ?? ''
                                  : '',
                              )),
                            }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{f.size}·H</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Edge actions</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayley3dEnabledCount}/{cayley3dActionsList.length}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <button title="Add every element as an action" style={MINI_BTN}
                    onClick={() => updateViewParams({ actions: addAllCayleyActionsHelper(group, '3d', layout3dValue, cayley3dActionsList) })}>All</button>
                  <button title="Clear all actions (no edges)" style={MINI_BTN}
                    onClick={() => updateViewParams({ actions: [] })}>None</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {cayley3dActionsList.map(a => {
                    const el = group.elements.find(e => e.id === a.elementId)
                    return (
                      <label key={a.elementId} title={a.elementId} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, cursor: 'pointer' }}>
                        <input type="checkbox" checked={a.enabled}
                          onChange={() => updateViewParams({ actions: toggleCayleyActionReducer(cayley3dActionsList, a.elementId) })} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label ?? a.elementId)) }}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {view === 'cycle' && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cycle View</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={!!cycleVp.showMaximalCycles}
                  onChange={e => updateViewParams({ showMaximalCycles: e.target.checked })} />
                Maximal cycles only
              </label>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Node radius</div>
                <input type="range" min={8} max={60} value={cycleVp.nodeRadius ?? 24}
                  onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cycleVp.nodeRadius ?? 24}px</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={cycleVp.showCycleLabels !== false}
                  onChange={e => updateViewParams({ showCycleLabels: e.target.checked })} />
                Show ⟨g⟩ ≅ Zₙ captions
              </label>
            </>
          )}

          {(view === 'table' || view === 'heatmap') && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>{view === 'table' ? 'Table View' : 'Heatmap View'}</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Strategy</div>
                <select
                  value={tableVp.strategy ?? 'subgroup'}
                  onChange={e => updateViewParams({ strategy: e.target.value as TableStrategy })}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }}
                >
                  <option value="subgroup">subgroup</option>
                  <option value="random">random</option>
                  <option value="full">full</option>
                </select>
              </div>
              {view === 'table' && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ marginBottom: 2 }}>Cell size</div>
                  <input type="range" min={20} max={120} value={tableVp.cellSize ?? 50}
                    onChange={e => updateViewParams({ cellSize: Number(e.target.value) })} style={{ width: '100%' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tableVp.cellSize ?? 50}px</span>
                </div>
              )}
            </>
          )}

          {view === 'sublattice' && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Lattice View</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Label detail</div>
                <select
                  value={sublatticeParams.labelDetail ?? 'auto'}
                  onChange={e => updateViewParams({ labelDetail: e.target.value as LatticeLabelDetail })}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }}
                >
                  <option value="auto">auto</option>
                  <option value="full">full cards</option>
                  <option value="compact">pills</option>
                  <option value="dots">dots</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <input
                  type="checkbox"
                  checked={sublatticeParams.mergeConjugates ?? false}
                  onChange={e => updateViewParams({ mergeConjugates: e.target.checked })}
                />
                Merge conjugates
              </label>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
                One node per conjugacy orbit; ×n badge is |G : N<sub>G</sub>(H)|
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Card size</div>
                <input type="range" min={0.6} max={1.6} step={0.1} value={sublatticeParams.nodeScale ?? 1}
                  onChange={e => updateViewParams({ nodeScale: Number(e.target.value) })} style={{ width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(sublatticeParams.nodeScale ?? 1).toFixed(1)}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={sublatticeParams.showSeriesPanel ?? false}
                  onChange={e => updateViewParams({ showSeriesPanel: e.target.checked })}
                />
                Series panel
              </label>
            </>
          )}

          {view === 'cosetstrip' && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Coset Strip View</div>
              {csOpts.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                  No non-trivial subgroup available here. {COSETSTRIP_NO_LOCAL_SUBGROUPS}.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ marginBottom: 2 }}>Subgroup H</div>
                    <select
                      value={csSubgroup?.key ?? ''}
                      onChange={e => {
                        const opt = csOpts.find(o => o.key === e.target.value)
                        if (opt) updateViewParams({ subgroup: opt.elementIds })
                      }}
                      title={csSubgroup ? `${csSubgroup.key} · orbit ${csSubgroup.orbitSize}` : undefined}
                      style={{
                        width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                        fontSize: 11,
                      }}
                    >
                      {csOpts.map(o => (
                        <option key={o.key} value={o.key}>{csOptionLabel(o)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ marginBottom: 2 }}>Coset type</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button title="Left cosets gH (row element · H)" style={segBtn(csType !== 'right')}
                        onClick={() => updateViewParams({ cosetType: 'left' })}>gH</button>
                      <button title="Right cosets Hg (H · row element)" style={segBtn(csType === 'right')}
                        onClick={() => updateViewParams({ cosetType: 'right' })}>Hg</button>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <input type="checkbox" checked={cosetStripVp.showLabels ?? false}
                      onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                    Show node labels
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <input type="checkbox" checked={cosetStripVp.showSubgroupCayley ?? false}
                      onChange={e => updateViewParams({ showSubgroupCayley: e.target.checked })} />
                    Subgroup Cayley ring
                  </label>
                </>
              )}
            </>
          )}

          {view === 'symmetry' && group && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Symmetry View</div>
              {symType === 'unsupported' ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                  This group type does not support the symmetry view (supported: cyclic Cₙ · dihedral Dₙ · A₄ · S₄ · A₅ · V₄).
                </div>
              ) : (
                <>
                  {symCanDual && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ marginBottom: 2, fontSize: 11, color: 'var(--text-secondary)' }}>Solid shape</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="Primary solid" style={segBtn(!symVp.variant)}
                          onClick={() => updateViewParams({ variant: false })}>
                          {symType === 'cube' ? 'Cube' : 'Icosahedron'}
                        </button>
                        <button title="Dual solid" style={segBtn(!!symVp.variant)}
                          onClick={() => updateViewParams({ variant: true })}>
                          {symType === 'cube' ? 'Octahedron' : 'Dodecahedron'}
                        </button>
                      </div>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <input type="checkbox" checked={symShowAction}
                      onChange={e => updateViewParams({ showAction: e.target.checked, actionElementId: e.target.checked ? symActiveId : null })} />
                    Show element actions
                  </label>
                  {symShowAction && (
                    <>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ marginBottom: 2 }}>Speed</div>
                        <input type="range" min={0.2} max={5} step={0.1} value={symVp.rotateSpeed ?? 1}
                          onChange={e => updateViewParams({ rotateSpeed: Number(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(symVp.rotateSpeed ?? 1).toFixed(1)}</span>
                      </div>
                      <div style={{ marginBottom: 3, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Action element</span>
                        {!config.actionLocked && symActiveId && (
                          <button
                            title="Reset pose (identity)"
                            data-testid="sym-panel-reset"
                            onClick={() => updateViewParams({ actionElementId: null })}
                            style={{
                              background: 'transparent', border: '1px solid var(--border-primary)',
                              color: 'var(--text-dim)', borderRadius: 4, padding: '1px 6px',
                              fontSize: 10, cursor: 'pointer',
                            }}
                          >
                            ✕ Reset pose
                          </button>
                        )}
                      </div>
                      {config.actionLocked ? (
                        /* 固定模式（actionLocked）：演示元素由宿主动作参数决定且不可切换 ——
                           Action element 列表与 Reset 隐藏，只读显示当前固定元素；
                           反复重看走窗口底部浮条 ⟳ Replay（重放不改变演示元素） */
                        <div
                          data-testid="sym-action-fixed"
                          style={{
                            border: '1px solid var(--border-primary)', borderRadius: 6, marginBottom: 6,
                            padding: '5px 8px', background: 'var(--bg-interactive)',
                          }}
                        >
                          {(() => {
                            const fixed = group.elements.find(el => el.id === symActiveId)
                            if (!fixed) return (
                              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                                No fixed element — set viewParams.actionElementId
                              </span>
                            )
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                                  dangerouslySetInnerHTML={{ __html: renderTex(texify(fixed.label)) }} />
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                  fixed · ⟳ replay only
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <div
                          data-testid="sym-action-list"
                          style={{
                            maxHeight: 150, overflowY: 'auto',
                            border: '1px solid var(--border-primary)', borderRadius: 6, marginBottom: 6,
                          }}
                        >
                          {group.elements.map(el => {
                            const active = el.id === symActiveId
                            return (
                              <button
                                key={el.id}
                                data-testid="sym-action-row"
                                title={active ? 'Replay this action' : el.id}
                                onClick={() => { if (active) setSymReplay(n => n + 1); else updateViewParams({ actionElementId: el.id }) }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  width: '100%', gap: 8, padding: '3px 8px',
                                  border: 'none', borderBottom: '1px solid var(--border-primary)',
                                  background: active ? 'var(--accent-teal)' : 'transparent',
                                  color: active ? '#04222a' : 'var(--text-secondary)',
                                  fontSize: 12, cursor: 'pointer', textAlign: 'left',
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                                {active && <span style={{ fontSize: 10, fontWeight: 700 }}>▶</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <input type="checkbox" checked={symVp.showFigureTitle === true}
                      onChange={e => updateViewParams({ showFigureTitle: e.target.checked })} />
                    Figure caption (group name + geometry, in-scene)
                  </label>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-primary)', paddingTop: 8 }}>
            <button
              title="Reset to default parameters"
              style={{
                ...BTN_STYLE, fontSize: 11, padding: '4px 8px', width: '100%',
                border: '1px solid var(--border-primary)', borderRadius: 4,
                background: 'var(--bg-interactive)', color: 'var(--text-secondary)',
              }}
              onClick={resetAll}
            >↺ Reset to defaults</button>
          </div>
        </div>
      )}
    </>
  )
}

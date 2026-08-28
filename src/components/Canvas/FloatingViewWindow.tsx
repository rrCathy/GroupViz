import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react'
import { GroupContext } from '../../context/GroupContext'
import type { GroupContextType } from '../../context/GroupContext'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import type { ViewMode, CanvasTransform } from '../../core/types'
import type { Group } from '../../core/types'
import { SetView, type SetViewProps } from './SetView'
import { SetViewFromContext } from './SetViewFromContext'
import { CycleView } from './CycleView'
import { TableView } from './TableView'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { HomomorphismView } from './HomomorphismView'
import { CosetStripView } from './CosetStripView'
import { ActionView } from './ActionView'
import { SylowView } from './SylowView'
import { PresentationTableView } from './PresentationTableView'
import { computeCayleyActionEdges, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import type { CayleyEdgeData } from '../../core/types'
import type { ViewWindowConfig, SetViewParams, CayleyViewParams } from '../../core/types/viewConfig'
import { setViewParamsSchema, cayleyViewParamsSchema } from '../../core/types/viewConfig'
import { getDefaultShape2D, getAvailableShapesForView } from '../../core/types'
import type { CayleyShape2D } from '../../core/types'
import { toggleCayleyActionReducer, addAllCayleyActionsHelper, normalizeCayleyActions } from '../../context/cayleyActions'
import { CayleyView } from './CayleyView'
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

  const isLargeGraph = n > 100

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

  if (!currentGroup) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-dim)' }}>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const getNodePos = (elId: string) => {
    const defPos = circLayout.get(elId)
    if (!defPos) return { x: cx, y: cy }
    const saved = getNodePosition(elId)
    if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
      return saved
    }
    return defPos
  }

  const nodePositionsCache = new Map<string, { x: number; y: number }>()
  currentGroup.elements.forEach((el) => {
    nodePositionsCache.set(el.id, getNodePos(el.id))
  })

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

  return (
    <div
      style={{
        width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={{
        transform: `translate(${tablePan.x}px, ${tablePan.y}px) scale(${tableZoom})`,
        transformOrigin: 'center center',
      }}>
        {children}
      </div>
    </div>
  )
}

function SvgPanZoom({ children }: { children: React.ReactNode }) {
  const { canvasTransform, setCanvasTransform, viewBoxSize } = useGroup()
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

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
      return <SvgPanZoom><CycleView /></SvgPanZoom>
    case 'table':
      return <TableZoomable><TableView /></TableZoomable>
    case '3d':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><Cayley3DViewLazy /></Suspense>
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

let globalZCounter = 1000

export function FloatingViewWindow({ id, view, title }: { id: string; view: ViewMode; title: string }) {
  const globalCtx = useGroup()
  
  const [position, setPosition] = useState({ x: 100 + globalCtx.floatingViews.length * 40, y: 80 + globalCtx.floatingViews.length * 30 })
  const [size, setSize] = useState({ width: 500, height: 400 })
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
        width: Math.max(280, resizeStart.current.w + dw),
        height: Math.max(200, resizeStart.current.h + dh)
      })
    }
  }, [isDragging, isResizing])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  return (
    <GroupContext.Provider value={localOverrides as GroupContextType}>
      <div
        className="floating-view-window"
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

interface ViewWindowProps {
  view: ViewMode
  group: Group | null
  title?: string
  storageKey?: string
  config?: ViewWindowConfig
  onConfigChange?: (c: ViewWindowConfig) => void
  viewParams?: SetViewParams | CayleyViewParams
  onViewParamsChange?: (p: SetViewParams | CayleyViewParams) => void
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

function clampResize(dir: ResizeDir, startGeo: VwGeometry, dx: number, dy: number): VwGeometry {
  let { x: px, y: py } = startGeo.position
  let { width: w, height: h } = startGeo.size
  if (dir.includes('e')) { w = Math.max(MIN_W, startGeo.size.width + dx) }
  if (dir.includes('w')) { const nw = Math.max(MIN_W, startGeo.size.width - dx); px += startGeo.size.width - nw; w = nw }
  if (dir.includes('s')) { h = Math.max(MIN_H, startGeo.size.height + dy) }
  if (dir.includes('n')) { const nh = Math.max(MIN_H, startGeo.size.height - dy); py += startGeo.size.height - nh; h = nh }
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

  // 默认持久化键含视图名：同群的 set/cayley 窗口各自独立持久化，互不覆盖
  const persistKey = storageKey ?? (group ? `${group.symbol}|${group.order}|${view}` : null)
  const persisted = useMemo(() => persistKey ? loadVwPersist(persistKey) : null, [persistKey])

  const [geometry, setGeometry] = useState<VwGeometry>(() => {
    if (persisted) return { position: persisted.position, size: persisted.size }
    return { position: defaultPosition, size: defaultSize }
  })

  const [config, setConfig] = useState<ViewWindowConfig>(() =>
    configProp ?? persisted?.config ?? {})
  const [viewParams, setViewParams] = useState<SetViewParams | CayleyViewParams>(() => {
    if (viewParamsProp) return viewParamsProp
    if (persisted) {
      // 按视图用对应 schema 校验持久化参数：键残留他视图参数/手改坏值时回退默认
      const schema = view === 'cayley' ? cayleyViewParamsSchema : view === 'set' ? setViewParamsSchema : null
      if (schema) {
        const parsed = schema.safeParse(persisted.viewParams)
        if (parsed.success) return parsed.data as SetViewParams | CayleyViewParams
      } else {
        return persisted.viewParams as SetViewParams | CayleyViewParams
      }
    }
    return {}
  })

  const [z, setZ] = useState(() => ++_vwZ)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeDir | null>(null)
  const [paramsOpen, setParamsOpen] = useState(false)
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
      // Persist the effective (controlled-aware) values so reset/refresh round-trips match the UI.
      const effConfig = configProp ?? config
      const effViewParams = viewParamsProp ?? viewParams
      saveVwPersist(persistKey, { position: geometry.position, size: geometry.size, config: effConfig, viewParams: effViewParams as Record<string, unknown> })
    }, 300)
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current) }
  }, [geometry, config, viewParams, configProp, viewParamsProp, persistKey])

  const updateConfig = useCallback((p: Partial<ViewWindowConfig>) => {
    // 与「有效值」合并（受控时 prop 优先）：受控模式下内部 state 不更新，
    // 若与陈旧的内部快照合并，连续调整多个开关时后续载荷会丢失之前的值
    const next = { ...(configProp ?? config), ...p }
    if (!configProp) setConfig(next)
    onConfigChange?.(next)
  }, [config, configProp, onConfigChange])

  const updateViewParams = useCallback((p: Partial<SetViewParams> | Partial<CayleyViewParams>) => {
    // 参数对象按 view 判别（同一时刻只属于一种视图），跨类型合并不需要判别字段
    const next = { ...(viewParamsProp ?? viewParams), ...p } as SetViewParams | CayleyViewParams
    if (!viewParamsProp) setViewParams(next)
    onViewParamsChange?.(next)
  }, [viewParams, viewParamsProp, onViewParamsChange])

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
          setGeometry(clampResize(resizing, resizeRef.current.geo, rdx, rdy))
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
  }, [dragging, resizing])

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
  }, [ct, config.zoomLocked, contentW, contentH])

  const onCtMDown = useCallback((e: React.MouseEvent) => {
    if (config.locked || config.zoomLocked) return
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    ctDragRef.current = { sx: e.clientX, sy: e.clientY, tx: ct.x, ty: ct.y, active: true }
  }, [ct, config.locked, config.zoomLocked])

  const setZoomScale = useCallback((v: number) => {
    setCt(prev => ({ ...prev, scale: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v)) }))
  }, [])

  const zoomBy = useCallback((f: number) => {
    setCt(prev => ({ ...prev, scale: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.scale * f)) }))
  }, [])

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
    setGeometry({ position: defaultPosition, size: defaultSize })
    if (!configProp) setConfig({})
    onConfigChange?.({})
    if (!viewParamsProp) setViewParams({})
    onViewParamsChange?.({})
    resetCt()
  }, [persistKey, defaultPosition, defaultSize, configProp, onConfigChange, viewParamsProp, onViewParamsChange, resetCt])

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

  const infoText = useMemo(() => {
    if (!group || !config.showInfo) return ''
    return `${group.symbol} · ${group.order} ord`
  }, [group, config.showInfo])

  const renderContent = () => {
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
          showLabels={cvp.showLabels}
          onSelect={handleSelect}
          onHover={() => {}}
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
      onHover: () => {},
    }
    return (
      <SetView
        key={`set-${group.symbol}-${group.order}`}
        {...sp}
      />
    )
  }

  // ── cayley 视图参数面板数据（与 CayleyView 渲染层同一套缺省/归一化规则） ──
  const cayleyShapes = useMemo<CayleyShape2D[]>(
    () => (view === 'cayley' && group ? getAvailableShapesForView(group, 'cayley') : []),
    [view, group],
  )
  const cayleyVp = viewParams as CayleyViewParams
  const setVp = viewParams as SetViewParams
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
            {title ?? (group ? group.symbol : 'View')}
            {infoText && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{infoText}</span>}
          </span>
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
            <svg viewBox={`0 0 ${vbSize.width} ${vbSize.height}`}
              style={{ width: '100%', height: '100%', userSelect: 'none' }}>
              {/* 视图组件自含 canvasTransform（SetView/CayleyView 在自身 <g> 上应用）；
                  此处再包一层 <g transform> 会造成平移/缩放双重应用 */}
              {renderContent()}
            </svg>

            {/* zoom slider overlay (avoids wheel/page-scroll conflict) */}
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
          </div>
        </div>

        {/* resize handles */}
        {resizable && RESIZE_DIRS.map(dir => (
          <div key={dir} style={resizeHandleStyle(dir)}
            onMouseDown={onResizeStart(dir)}
          />
        ))}
      </div>

      {/* params panel — outside the window so it never covers the view */}
      {paramsOpen && (
        <div
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={cayleyVp.showLabels !== false}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show labels
              </label>
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

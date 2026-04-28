import { useState, useCallback, useRef } from 'react'
import { GroupContext } from '../../context/GroupContext'
import type { GroupContextType } from '../../context/GroupContext'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import type { ViewMode, CanvasTransform } from '../../core/types'
import { SetView } from './SetView'
import { CycleView } from './CycleView'
import { TableView } from './TableView'
import { Cayley3DView } from './Cayley3DView'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { computeCayleyActionEdges } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import type { CayleyEdgeData } from '../../core/types'

function CayleyGraphViewLocal() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, getNodePosition, setNodePosition, canvasTransform, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: '#888' }}>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const nodeRadius = 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + currentGroup.order * 10)

  const getNodePos = (elId: string, index: number) => {
    if ((currentGroup.symbol === 'S3' || currentGroup.symbol === 'S\u2083') && currentGroup.order === 6) {
      const hexagonOrder = [
        [1,2,3], [2,1,3], [3,1,2], [3,2,1], [2,3,1], [1,3,2]
      ]
      const el = currentGroup.elements.find(e => e.id === elId)
      if (el) {
        const perm = el.value
        const hexIndex = hexagonOrder.findIndex(h =>
          h.length === perm.length && h.every((v, i) => v === perm[i])
        )
        if (hexIndex !== -1) {
          const angle = (hexIndex * 2 * Math.PI / 6) - Math.PI / 2
          const defaultPos = {
            x: cx + graphRadius * Math.cos(angle),
            y: cy + graphRadius * Math.sin(angle)
          }
          const saved = getNodePosition(elId)
          if (saved && (Math.abs(saved.x - defaultPos.x) > 0.5 || Math.abs(saved.y - defaultPos.y) > 0.5)) {
            return saved
          }
          return defaultPos
        }
      }
    }

    const saved = getNodePosition(elId)
    if (saved) return saved

    const angle = (index * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: cx + graphRadius * Math.cos(angle),
      y: cy + graphRadius * Math.sin(angle)
    }
  }

  const edges = computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType)

  const nodePositionsCache = new Map<string, { x: number; y: number }>()
  currentGroup.elements.forEach((el, i) => {
    nodePositionsCache.set(el.id, getNodePos(el.id, i))
  })

  const enabledActions = cayleyActions.filter(a => a.enabled)

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} style={{ width: '100%', height: '100%', userSelect: 'none', background: '#0f0f1a' }}>
      <defs>
        {enabledActions.map((action, idx) => (
          <marker key={idx} id={`fv-arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edges.map((edge: CayleyEdgeData) => {
          const fromPos = nodePositionsCache.get(edge.fromId)!
          const toPos = nodePositionsCache.get(edge.toId)!
          if (!fromPos || !toPos) return null

          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          const isHighlighted = selectedElements.has(edge.fromId) || selectedElements.has(edge.toId)
          const baseColor = edge.color
          const color = isHighlighted ? baseColor : `${baseColor}66`

          if (edge.isSelfLoop) {
            const scx = fromPos.x
            const scy = fromPos.y - nodeRadius - 20
            return (
              <g key={`${edge.fromId}-${edge.actionElementId}`}>
                <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={isHighlighted ? 3 : 2} />
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
          
          const actionIdx = cayleyActions.findIndex(a => a.elementId === edge.actionElementId)
          const markerId = `fv-arrow-${actionIdx}`

          return (
            <path
              key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
              d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
              stroke={color}
              strokeWidth={isHighlighted ? 3 : 2}
              fill="none"
              markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
              opacity={0.7}
            />
          )
        })}
        
        {currentGroup.elements.map((el, i) => {
          const pos = getNodePos(el.id, i)
          const isSelected = selectedElements.has(el.id)
          const parentSubset = subsets.find(s => s.elementIds.includes(el.id))
          
          let fillColor = '#1a1a2e'
          let strokeColor = 'white'
          let strokeWidth = 2
          
          if (isSelected) {
            fillColor = '#2d2d4a'
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
                  const startPos = getNodePos(el.id, i)
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
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
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
                    width: '100%', height: '100%', color: 'white', fontSize: '15px'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderTex(texify(el.label))
                  }}
                />
              </foreignObject>
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
    setTableZoom(prev => Math.max(0.25, Math.min(5, prev * factor)))
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
    const vw = viewBoxSize.width
    const vh = viewBoxSize.height
    const scaleX = vw / rect.width
    const scaleY = vh / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.25, Math.min(4, canvasTransform.scale * scaleFactor))
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
      return <SvgPanZoom><SetView /></SvgPanZoom>
    case 'cayley':
      return <SvgPanZoom><CayleyGraphViewLocal /></SvgPanZoom>
    case 'cycle':
      return <SvgPanZoom><CycleView /></SvgPanZoom>
    case 'table':
      return <TableZoomable><TableView /></TableZoomable>
    case '3d':
      return <Cayley3DView />
    case 'sublattice':
      return <SvgPanZoom><SubgroupLatticeView /></SvgPanZoom>
    default:
      return <SvgPanZoom><SetView /></SvgPanZoom>
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
          border: '1px solid #333',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          background: '#111',
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
            background: '#1a1a2e',
            borderBottom: '1px solid #333',
            cursor: 'grab',
            fontSize: '13px',
            color: '#ccc',
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
              color: '#888',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = '#f44')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = '#888')}
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

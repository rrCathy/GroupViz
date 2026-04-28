import { useRef, useState, useCallback, useEffect } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { SetView } from './SetView'
import { CycleView } from './CycleView'
import { TableView } from './TableView'
import { Cayley3DView } from './Cayley3DView'
import { SymmetryView } from './SymmetryView'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { isTooLarge } from '../../core/viewBox'
import { computeCayleyActionEdges } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import type { CayleyEdgeData } from '../../core/types'

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  initialTransformX: number
  initialTransformY: number
}

export function GroupCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialTransformX: 0,
    initialTransformY: 0
  })
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialTransformX: 0,
    initialTransformY: 0
  })
  
  const { t } = useTranslation()
  const {
    currentView,
    canvasTransform,
    operationHistory,
    setCanvasTransform,
    currentGroup,
    hintMessage,
    viewBoxSize,
    forceShowLargeGroup,
    setForceShowLargeGroup
  } = useGroup()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialTransformX: canvasTransform.x,
      initialTransformY: canvasTransform.y
    })
    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialTransformX: canvasTransform.x,
      initialTransformY: canvasTransform.y
    }
  }, [canvasTransform.x, canvasTransform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    if (dragStateRef.current.isDragging) {
      const dx = e.clientX - dragStateRef.current.startX
      const dy = e.clientY - dragStateRef.current.startY
      
      setCanvasTransform({
        x: dragStateRef.current.initialTransformX + dx,
        y: dragStateRef.current.initialTransformY + dy
      })
    }
  }, [setCanvasTransform])

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      initialTransformX: 0,
      initialTransformY: 0
    }
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      initialTransformX: 0,
      initialTransformY: 0
    })
  }, [])

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
    
    setCanvasTransform({
      x: newX,
      y: newY,
      scale: newScale
    })
  }, [canvasTransform, setCanvasTransform, viewBoxSize])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragStateRef.current.isDragging) {
        handleMouseUp()
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [handleMouseUp])

  const renderView = () => {
    if (currentGroup && isTooLarge(currentGroup.order, currentView) && !forceShowLargeGroup) {
      return (
        <div className="large-group-warning">
          <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
          <button className="panel-btn" onClick={() => setForceShowLargeGroup(true)}>
            {t('canvas.show')}
          </button>
        </div>
      )
    }

    switch (currentView) {
      case 'set':
        return <SetView />
      case 'cayley':
        return <CayleyGraphView />
      case 'cycle':
        return <CycleView />
      case 'table':
        return <TableView />
      case '3d':
        return <Cayley3DView />
      case 'symmetry':
        return <SymmetryView />
      case 'sublattice':
        return <SubgroupLatticeView />
      default:
        return <SetView />
    }
  }

  return (
    <div className="canvas-container">
      <div
        ref={containerRef}
        className="canvas-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ 
          cursor: dragState.isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {renderView()}
      </div>
      
      {hintMessage && (
        <div className="hint-box">
          <div className="hint-box-header">
            <span>{`💡 ${t('canvas.hintBox')}`}</span>
          </div>
          <div className="hint-box-body" dangerouslySetInnerHTML={{ __html: hintMessage }} />
        </div>
      )}
      
      <div className="history-panel">
        <h4>{t('canvas.history')}</h4>
        <div className="history-list">
          {operationHistory.slice(-5).map((op, i) => (
            <div key={i} className="history-item">{op}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CayleyGraphView() {
  const { currentGroup, selectedElements, canvasTransform, selectElement, setHoverElement, getNodePosition, setNodePosition, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets, selfInverseElementId } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const nodeRadius = 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + currentGroup.order * 10)

  const getNodePos = (elId: string, index: number) => {
    // 计算六边形默认位置（S3 专用）
    if ((currentGroup.symbol === 'S3' || currentGroup.symbol === 'S₃') && currentGroup.order === 6) {
      const hexagonOrder = [
        [1,2,3], // e
        [2,1,3], // (12)
        [3,1,2], // (132)
        [3,2,1], // (13)
        [2,3,1], // (123)
        [1,3,2]  // (23)
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
          // 检查是否有用户拖拽过的位置
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



  const edgeElements = edges.map((edge: CayleyEdgeData) => {
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
    const markerId = `arrow-${actionIdx}`

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
  })

  const enabledActions = cayleyActions.filter(a => a.enabled)

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        {enabledActions.map((action, idx) => (
          <marker key={idx} id={`arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edgeElements}
        
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
                  const viewBoxWidth = viewBoxSize.width
                  const viewBoxHeight = viewBoxSize.height
                  const scaleX = viewBoxWidth / svgRect.width
                  const scaleY = viewBoxHeight / svgRect.height
                  
                  const startX = (e.clientX - svgRect.left) * scaleX
                  const startY = (e.clientY - svgRect.top) * scaleY
                  const startPos = getNodePos(el.id, i)
                  const initialOffsetX = startPos.x
                  const initialOffsetY = startPos.y
                  
                  const handleMove = (moveEvent: MouseEvent) => {
                    const currentX = (moveEvent.clientX - svgRect.left) * scaleX
                    const currentY = (moveEvent.clientY - svgRect.top) * scaleY
                    const newX = initialOffsetX + (currentX - startX) / canvasTransform.scale
                    const newY = initialOffsetY + (currentY - startY) / canvasTransform.scale
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
               {selfInverseElementId === el.id && (
                 <g>
                   <circle r={nodeRadius + 6} fill="none" stroke="#ffd93d" strokeWidth={2.5} strokeDasharray="6 3" opacity={0.85}>
                     <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
                   </circle>
                   <path
                     d={`M ${nodeRadius + 3},-8 L ${nodeRadius + 14},-5 L ${nodeRadius + 10},-1`}
                     fill="#ffd93d"
                     opacity={0.85}
                   />
                 </g>
               )}
            </g>
          )
        })}
      </g>
      
    </svg>
  )
}

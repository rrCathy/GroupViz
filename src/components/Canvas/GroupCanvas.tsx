import { useRef, useState, useCallback, useEffect } from 'react'
import { useGroup } from '../../context/GroupContext'
import { SetView } from './SetView'
import { CycleView } from './CycleView'
import { TableView } from './TableView'

interface SelectionBox {
  active: boolean
  startX: number
  startY: number
  endX: number
  endY: number
  shape: 'circle' | 'rect'
}

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
}

export function GroupCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0
  })
  
  const {
    currentView,
    lassoMode,
    lassoShape,
    canvasTransform,
    operationHistory,
    nodePositions,
    selectElement,
    setCanvasTransform,
    checkSubsetProperty,
    currentGroup,
    hintMessage
  } = useGroup()

  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const svg = e.currentTarget.closest('svg')
    if (!svg) return { x: 0, y: 0 }
    
    const rect = svg.getBoundingClientRect()
    const viewBoxWidth = 800
    const viewBoxHeight = 560
    
    const scaleX = viewBoxWidth / rect.width
    const scaleY = viewBoxHeight / rect.height
    
    const rawX = (e.clientX - rect.left) * scaleX
    const rawY = (e.clientY - rect.top) * scaleY
    
    return {
      x: (rawX - canvasTransform.x) / canvasTransform.scale,
      y: (rawY - canvasTransform.y) / canvasTransform.scale
    }
  }, [canvasTransform])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const coords = getCanvasCoords(e)
    
    if (lassoMode) {
      setSelectionBox({
        active: true,
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
        shape: lassoShape
      })
      return
    }
    
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY
    })
  }, [canvasTransform, lassoMode, lassoShape, getCanvasCoords])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const coords = getCanvasCoords(e)
    
    if (selectionBox && selectionBox.active) {
      setSelectionBox(prev => prev ? { ...prev, endX: coords.x, endY: coords.y } : null)
      return
    }
    
    if (dragState.isDragging) {
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      
      setCanvasTransform({
        x: canvasTransform.x + dx,
        y: canvasTransform.y + dy
      })
      setDragState(prev => ({
        ...prev,
        startX: e.clientX,
        startY: e.clientY
      }))
    }
  }, [canvasTransform, selectionBox, dragState, getCanvasCoords, setCanvasTransform])

  const handleMouseUp = useCallback(() => {
    if (selectionBox && selectionBox.active && currentGroup) {
      const positions = nodePositions.get(currentView)
      if (positions) {
        const selectedIds: string[] = []
        
        if (selectionBox.shape === 'rect') {
          const minX = Math.min(selectionBox.startX, selectionBox.endX)
          const maxX = Math.max(selectionBox.startX, selectionBox.endX)
          const minY = Math.min(selectionBox.startY, selectionBox.endY)
          const maxY = Math.max(selectionBox.startY, selectionBox.endY)
          
          positions.forEach((pos, id) => {
            if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
              selectedIds.push(id)
            }
          })
        } else {
          const cx = selectionBox.startX
          const cy = selectionBox.startY
          const r = Math.sqrt(
            Math.pow(selectionBox.endX - cx, 2) + 
            Math.pow(selectionBox.endY - cy, 2)
          )
          
          positions.forEach((pos, id) => {
            const dist = Math.sqrt(Math.pow(pos.x - cx, 2) + Math.pow(pos.y - cy, 2))
            if (dist <= r) {
              selectedIds.push(id)
            }
          })
        }
        
        if (selectedIds.length > 0) {
          selectedIds.forEach(id => selectElement(id, true))
          checkSubsetProperty(selectedIds)
        }
      }
    }
    
    setSelectionBox(null)
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0
    })
  }, [selectionBox, currentGroup, nodePositions, currentView, selectElement, checkSubsetProperty])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
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
  }, [canvasTransform, setCanvasTransform])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (selectionBox || dragState.isDragging) {
        handleMouseUp()
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [selectionBox, dragState.isDragging, handleMouseUp])

  const renderView = () => {
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
        return <div className="view-empty"><p>3D视图 - 开发中</p></div>
      default:
        return <SetView />
    }
  }

  const renderSelectionBox = () => {
    if (!selectionBox || !selectionBox.active) return null
    
    const { x: tx, y: ty, scale } = canvasTransform
    
    if (selectionBox.shape === 'rect') {
      const sx = Math.min(selectionBox.startX, selectionBox.endX)
      const sy = Math.min(selectionBox.startY, selectionBox.endY)
      const sw = Math.abs(selectionBox.endX - selectionBox.startX)
      const sh = Math.abs(selectionBox.endY - selectionBox.startY)
      
      const screenX = sx * scale + tx
      const screenY = sy * scale + ty
      const screenW = sw * scale
      const screenH = sh * scale
      
      return (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={screenX}
            y={screenY}
            width={screenW}
            height={screenH}
            fill="rgba(78, 205, 196, 0.2)"
            stroke="#4ecdc4"
            strokeWidth={2}
            strokeDasharray="6"
          />
        </g>
      )
    } else {
      const cx = selectionBox.startX * scale + tx
      const cy = selectionBox.startY * scale + ty
      const r = Math.sqrt(
        Math.pow(selectionBox.endX - selectionBox.startX, 2) + 
        Math.pow(selectionBox.endY - selectionBox.startY, 2)
      ) * scale
      
      return (
        <g style={{ pointerEvents: 'none' }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="rgba(78, 205, 196, 0.15)"
            stroke="#4ecdc4"
            strokeWidth={2}
            strokeDasharray="6"
          />
        </g>
      )
    }
  }

  return (
    <div className="canvas-container">
      <div
        ref={containerRef}
        className="canvas-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        style={{ 
          cursor: dragState.isDragging ? 'grabbing' : lassoMode ? 'crosshair' : 'grab',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {renderView()}
        <svg viewBox="0 0 800 560" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {renderSelectionBox()}
        </svg>
      </div>
      
      {hintMessage && (
        <div className="hint-box">
          {hintMessage}
        </div>
      )}
      
      <div className="history-panel">
        <h4>操作历史</h4>
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
  const { currentGroup, selectedElements, canvasTransform, selectElement, setHoverElement, getNodePosition, setNodePosition } = useGroup()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>请先选择一个群</p>
      </div>
    )
  }

  const nodeRadius = 28

  const getNodePos = (elId: string, index: number) => {
    const saved = getNodePosition(elId)
    if (saved) return saved
    
    const angle = (index * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: 400 + 180 * Math.cos(angle),
      y: 280 + 180 * Math.sin(angle)
    }
  }

  const edges = currentGroup.elements.flatMap((fromEl, fromIdx) => {
    const pos = getNodePos(fromEl.id, fromIdx)
    return currentGroup.generators.map((gen) => {
      const toEl = gen.apply(fromEl)
      const toIdx = currentGroup.elements.findIndex(e => e.id === toEl.id)
      const toPos = getNodePos(toEl.id, toIdx)
      
      return { fromEl, toEl, gen, fromPos: pos, toPos }
    })
  })

  return (
    <svg viewBox="0 0 800 560" className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <marker id="arrow" markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#888" />
        </marker>
      </defs>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edges.map(({ fromEl, toEl, gen, fromPos, toPos }) => {
          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          const midX = (fromPos.x + toPos.x) / 2
          const midY = (fromPos.y + toPos.y) / 2
          const len = Math.sqrt(midX * midX + midY * midY)
          const nx = len > 0 ? -midY / len : 0
          const ny = len > 0 ? midX / len : 0
          
          const curvature = 35
          const ctrlX = midX + nx * curvature
          const ctrlY = midY + ny * curvature
          
          const startX = fromPos.x + (dx / dist) * nodeRadius
          const startY = fromPos.y + (dy / dist) * nodeRadius
          const endX = toPos.x - (dx / dist) * nodeRadius
          const endY = toPos.y - (dy / dist) * nodeRadius
          
          const isHighlighted = selectedElements.has(fromEl.id) || selectedElements.has(toEl.id)
          const isSelfLoop = fromEl.id === toEl.id
          
          if (isSelfLoop) {
            const cx = fromPos.x
            const cy = fromPos.y - nodeRadius - 20
            return (
              <g key={`${fromEl.id}-${gen.name}`}>
                <ellipse cx={cx} cy={cy} rx={14} ry={12} fill="none" stroke={isHighlighted ? gen.color : `${gen.color}66`} strokeWidth={isHighlighted ? 3 : 2} />
                <polygon points={`${cx-5},${cy-2} ${cx+5},${cy-2} ${cx},${cy-14}`} fill={gen.color} />
              </g>
            )
          }
          
          return (
            <path
              key={`${fromEl.id}-${gen.name}`}
              d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
              stroke={isHighlighted ? gen.color : `${gen.color}66`}
              strokeWidth={isHighlighted ? 3 : 2}
              fill="none"
              markerEnd="url(#arrow)"
              opacity={0.7}
            />
          )
        })}
        
        {currentGroup.elements.map((el, i) => {
          const pos = getNodePos(el.id, i)
          const isSelected = selectedElements.has(el.id)
          
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
                  const viewBoxWidth = 800
                  const viewBoxHeight = 560
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
                fill={isSelected ? '#2d2d4a' : '#1a1a2e'}
                stroke={isSelected ? '#ffd93d' : 'white'}
                strokeWidth={isSelected ? 3 : 2}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={14}
                fontFamily="serif"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {el.label}
              </text>
            </g>
          )
        })}
      </g>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`} style={{ pointerEvents: 'none' }}>
        <g transform={`translate(30, 530)`}>
          {currentGroup.generators.map((gen, i) => (
            <g key={gen.name} transform={`translate(${i * 80}, 0)`}>
              <line x1={0} y1={0} x2={30} y2={0} stroke={gen.color} strokeWidth={2} />
              <polygon points="30,0 24,-4 24,4" fill={gen.color} />
              <text x={35} y={4} fill={gen.color} fontSize={12} fontFamily="serif">{gen.symbol}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

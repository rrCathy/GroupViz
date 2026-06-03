import { useRef, useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { SetView } from './SetView'
import { CycleView } from './CycleView'
import { TableView } from './TableView'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { isTooLarge } from '../../core/viewBox'

const Cayley3DViewLazy = lazy(() => import('./Cayley3DView').then(m => ({ default: m.Cayley3DView })))
const SymmetryViewLazy = lazy(() => import('./SymmetryView').then(m => ({ default: m.SymmetryView })))
import { computeCayleyActionEdges, directProductGridLayout2D, fibonacci2DLayout, concentricLayout, dualRingLayout, cosetStripLayout, archimedeanSpiralLayout, spiralLayout, coilLayout, projection3DLayout, ringOrder } from '../../core/algebra/forceLayout'
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
  const gRef = useRef<SVGGElement>(null)
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialTransformX: 0,
    initialTransformY: 0
  })
  const [isDragging, setIsDragging] = useState(false)
  
  const { t } = useTranslation()
  const {
    currentView,
    canvasTransform,
    operationHistory,
    setCanvasTransform,
    currentGroup,
    hintMessage,
    viewBoxSize,
    forceShowLargeGroupViews,
    setForceShowLargeGroupForView
  } = useGroup()

  const applyTransformToDom = useCallback((x: number, y: number, scale: number) => {
    if (gRef.current) {
      gRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    setIsDragging(true)
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
      const newX = dragStateRef.current.initialTransformX + dx
      const newY = dragStateRef.current.initialTransformY + dy
      // Direct DOM update — no React re-render
      applyTransformToDom(newX, newY, canvasTransform.scale)
    }
  }, [canvasTransform.scale, applyTransformToDom])

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current.isDragging) {
      // Commit final position to state
      const g = gRef.current
      if (g) {
        const transform = g.getAttribute('transform') || ''
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/)
        if (match) {
          setCanvasTransform({ x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) })
        }
      }
    }
    dragStateRef.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      initialTransformX: 0,
      initialTransformY: 0
    }
    setIsDragging(false)
  }, [setCanvasTransform])

  const wheelRafRef = useRef<number>(0)
  const pendingTransformRef = useRef<{ x: number; y: number; scale: number } | null>(null)

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
    const curX = pendingTransformRef.current?.x ?? canvasTransform.x
    const curY = pendingTransformRef.current?.y ?? canvasTransform.y
    const curScale = pendingTransformRef.current?.scale ?? canvasTransform.scale
    const newScale = Math.max(0.25, Math.min(8, curScale * scaleFactor))
    
    const scaleChange = newScale / curScale
    const newX = mouseX - (mouseX - curX) * scaleChange
    const newY = mouseY - (mouseY - curY) * scaleChange
    
    pendingTransformRef.current = { x: newX, y: newY, scale: newScale }
    applyTransformToDom(newX, newY, newScale)
    
    if (!wheelRafRef.current) {
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = 0
        if (pendingTransformRef.current) {
          setCanvasTransform(pendingTransformRef.current)
          pendingTransformRef.current = null
        }
      })
    }
  }, [canvasTransform, setCanvasTransform, viewBoxSize, applyTransformToDom])

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
    if (currentGroup && isTooLarge(currentGroup.order, currentView) && !forceShowLargeGroupViews.has(currentView)) {
      return (
        <div className="large-group-warning">
          <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
          <button className="panel-btn" onClick={() => setForceShowLargeGroupForView(currentView, true)}>
            {t('canvas.show')}
          </button>
        </div>
      )
    }

    switch (currentView) {
      case 'set':
        return <SetView />
      case 'cayley':
        return <CayleyGraphView gRef={gRef} />
      case 'cycle':
        return <CycleView />
      case 'table':
        return <TableView />
      case '3d':
        return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><Cayley3DViewLazy /></Suspense>
      case 'symmetry':
        return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><SymmetryViewLazy /></Suspense>
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
          cursor: isDragging ? 'grabbing' : 'grab',
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

function CayleyGraphView({ gRef }: { gRef: React.RefObject<SVGGElement | null> }) {
  const { currentGroup, selectedElements, canvasTransform, selectElement, setHoverElement, getNodePosition, setNodePosition, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets, selfInverseElementId, cosetElementMap, cosetHighlightSet, cosetColors, cayleyShape2D } = useGroup()
  const { t } = useTranslation()

  // Stable computed values so hooks are invoked in the same order every render.
  const n = currentGroup?.order ?? 0
  const nodeRadius = 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + n * 10)

  const cosetStripData = useMemo(() => {
    if (!currentGroup) return null
    if (cayleyShape2D !== 'cosetStrip') return null
    return cosetStripLayout(
      currentGroup,
      viewBoxSize.width,
      viewBoxSize.height,
      undefined,
      cosetElementMap,
      cosetElementMap.size > 0 ? new Set(cosetElementMap.values()).size : undefined,
      cosetColors,
    )
  }, [cayleyShape2D, currentGroup, viewBoxSize.width, viewBoxSize.height, cosetElementMap, cosetColors])

  const gridPositions = useMemo(() => {
    if (!currentGroup) return null
    if (cayleyShape2D === 'cosetStrip') {
      return cosetStripData?.positions ?? null
    }
    if (cayleyShape2D === 'spherical') {
      return fibonacci2DLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'grid') {
      return directProductGridLayout2D(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'concentric') {
      return concentricLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'dualRing') {
      return dualRingLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'archimedean') {
      return archimedeanSpiralLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'spiral') {
      return spiralLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'coil') {
      return coilLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    if (cayleyShape2D === 'projection3D') {
      return projection3DLayout(currentGroup, viewBoxSize.width, viewBoxSize.height)
    }
    return null
  }, [cayleyShape2D, currentGroup, viewBoxSize.width, viewBoxSize.height, cosetStripData])

  const circlePositions = useMemo(() => {
    const m = new Map<number, { x: number; y: number }>()
    if (!currentGroup || n === 0) return m
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      m.set(i, {
        x: cx + graphRadius * Math.cos(angle),
        y: cy + graphRadius * Math.sin(angle)
      })
    }
    return m
  }, [cx, cy, graphRadius, n, currentGroup])

  const indexMap = useMemo(() => {
    const m = new Map<string, number>()
    if (!currentGroup) return m
    const isPipe = currentGroup.elements.length > 0 && currentGroup.elements[0]?.id.includes('|')
    if (isPipe) {
      const numFactors = currentGroup.elements[0].id.split('|').length
      const factorOrders: Map<string, number>[] = []
      for (let col = 0; col < numFactors; col++) {
        const keys = Array.from(new Set(currentGroup.elements.map(el => {
          const parts = el.id.split('|')
          return parts[col] ?? ''
        })))
        const ordered = ringOrder(keys)
        factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
      }
      const sorted = [...currentGroup.elements].sort((a, b) => {
        const pa = a.id.split('|')
        const pb = b.id.split('|')
        for (let col = 0; col < numFactors; col++) {
          const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
          const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
          if (ai !== bi) return ai - bi
        }
        return 0
      })
      sorted.forEach((el, i) => m.set(el.id, i))
    } else {
      const keys = currentGroup.elements.map(e => e.id)
      const order = ringOrder(keys)
      order.forEach((key, i) => m.set(key, i))
    }
    return m
  }, [currentGroup])

  // Map enabled action elementId -> marker index so arrow colors align
  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    const enabled = cayleyActions.filter(a => a.enabled)
    enabled.forEach((a, idx) => m.set(a.elementId, idx))
    return m
  }, [cayleyActions])

  const edges = useMemo(() => currentGroup ? computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType) : [], [currentGroup, cayleyActions, cayleyMultiplyType])

  const isLargeGraph = n > 60

  const isNodeOnScreen = (px: number, py: number) => {
    if (!isLargeGraph) return true
    const sx = px * canvasTransform.scale + canvasTransform.x
    const sy = py * canvasTransform.scale + canvasTransform.y
    const m = nodeRadius * canvasTransform.scale * 1.5
    return sx + m > 0 && sx - m < viewBoxSize.width &&
           sy + m > 0 && sy - m < viewBoxSize.height
  }

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, typeof subsets[0]>()
    subsets.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const getNodePos = useCallback((elId: string) => {
    let defPos: { x: number; y: number }
    if (gridPositions) {
      const gp = gridPositions.get(elId)
      if (!gp) return { x: cx, y: cy }
      defPos = gp
    } else {
      const idx = indexMap.get(elId)
      if (idx === undefined) return { x: cx, y: cy }
      defPos = circlePositions.get(idx) || { x: cx, y: cy }
    }
    const saved = getNodePosition(elId)
    if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
      return saved
    }
    return defPos
  }, [gridPositions, indexMap, circlePositions, getNodePosition, cx, cy])

  const nodePositionsCache = useMemo(() => {
    const cache = new Map<string, { x: number; y: number }>()
    if (!currentGroup) return cache
    currentGroup.elements.forEach((el) => {
      cache.set(el.id, getNodePos(el.id))
    })
    return cache
  }, [currentGroup, getNodePos])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const edgeElements = edges.map((edge: CayleyEdgeData) => {
    const fromPos = nodePositionsCache.get(edge.fromId)
    const toPos = nodePositionsCache.get(edge.toId)
    if (!fromPos || !toPos) return null

    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
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
    
    const curvature = Math.min(dist * 0.08, 18)
    const ctrlX = midX + nx * curvature
    const ctrlY = midY + ny * curvature
    
    const startX = fromPos.x + (dx / dist) * nodeRadius
    const startY = fromPos.y + (dy / dist) * nodeRadius
    const endX = toPos.x - (dx / dist) * nodeRadius
    const endY = toPos.y - (dy / dist) * nodeRadius
    
    const actionIdx = enabledActionIndexMap.get(edge.actionElementId)
    const markerId = actionIdx !== undefined ? `arrow-${actionIdx}` : undefined

    return (
      <path
        key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
        d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
        stroke={color}
        strokeWidth={isHighlighted ? 3.5 : 2.5}
        fill="none"
        markerEnd={edge.isBidirectional || !markerId ? undefined : `url(#${markerId})`}
        opacity={0.9}
      />
    )
  })

  const enabledActions = cayleyActions.filter(a => a.enabled)

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {enabledActions.map((action, idx) => (
          <marker key={idx} id={`arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>
      
      <g ref={gRef} transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {cosetStripData && cosetStripData.strips.length > 0 && cosetStripData.strips.map((strip, si) => (
          <g key={`coset-bg-${si}`}>
            <rect
              x={strip.x}
              y={strip.y}
              width={strip.w}
              height={strip.h}
              rx={8}
              fill={strip.color + (strip.isSubgroup ? '18' : '10')}
              stroke={strip.isSubgroup ? strip.color + '55' : strip.color + '28'}
              strokeWidth={strip.isSubgroup ? 2 : 1}
              strokeDasharray={strip.isSubgroup ? undefined : '4 6'}
            />
            <text
              x={strip.x + strip.w / 2}
              y={strip.y - 10}
              textAnchor="middle"
              fill={strip.color}
              fontSize={13}
              fontWeight={strip.isSubgroup ? 700 : 400}
              opacity={0.85}
              style={{ fontFamily: 'KaTeX_Main, monospace', fontStyle: 'italic' }}
            >{strip.label}</text>
          </g>
        ))}
        {edgeElements}
        
        {cosetStripData && cosetStripData.strips.length > 0 && (
          (() => {
            const shSize = cosetStripData.strips[0]?.elementIds.length || 0
            const n = currentGroup!.order
            const index = cosetStripData.strips.length
            return (
              <text
                x={viewBoxSize.width / 2}
                y={viewBoxSize.height - 14}
                textAnchor="middle"
                fill="#999"
                fontSize={12}
                opacity={0.7}
                style={{ fontFamily: 'KaTeX_Main, monospace' }}
              >{`|G|=${n} = ${shSize}\u00b7${index}   |H|\u00b7[G:H]`}</text>
            )
          })()
        )}
        
        {currentGroup.elements.map((el) => {
          const pos = nodePositionsCache.get(el.id) || { x: cx, y: cy }
          if (!isNodeOnScreen(pos.x, pos.y)) return null
          const isSelected = selectedElements.has(el.id)
          const parentSubset = subsetDetailMap.get(el.id)
          const cosetIdx = cosetElementMap.get(el.id)
          const isInHighlightedCoset = cosetIdx !== undefined && cosetHighlightSet.has(cosetIdx)
          
          let fillColor = 'var(--node-fill)'
          let strokeColor = 'var(--node-stroke)'
          let strokeWidth = 2.5
          
          if (isSelected) {
            fillColor = 'var(--node-fill-selected)'
            strokeColor = '#ffd93d'
            strokeWidth = 3
          } else if (isInHighlightedCoset && cosetIdx !== undefined) {
            fillColor = cosetColors[cosetIdx] + '33'
            strokeColor = cosetColors[cosetIdx]
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
                  const startPos = getNodePos(el.id)
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
                filter={isLargeGraph ? undefined : "url(#node-shadow)"}
              />
               {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {isInHighlightedCoset && cosetIdx !== undefined && (
                <circle
                  r={nodeRadius}
                  fill={`${cosetColors[cosetIdx]}22`}
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

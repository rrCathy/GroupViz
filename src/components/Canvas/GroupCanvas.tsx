import { useRef, useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { SetView } from './SetView'
import { CycleView } from './CycleView'
import { TableView } from './TableView'
import { SubgroupLatticeView } from './SubgroupLatticeView'
import { HomomorphismView } from './HomomorphismView'
import { CosetStripView } from './CosetStripView'
import { ActionView } from './ActionView'
import { SylowView } from './SylowView'
import { isTooLarge } from '../../core/viewBox'
import { useAutoFade } from '../../hooks/useAutoFade'

const Cayley3DViewLazy = lazy(() => import('./Cayley3DView').then(m => ({ default: m.Cayley3DView })))
const SymmetryViewLazy = lazy(() => import('./SymmetryView').then(m => ({ default: m.SymmetryView })))
import { computeCayleyActionEdges, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { computeShape2DPositions } from '../../core/algebra/shapeLayouts'
import { texify, renderTex } from '../../utils/texify'
import type { CayleyEdgeData, InternalEdgeData, Group } from '../../core/types'
import type { Automorphism } from '../../core/algebra/automorphisms'

const INNER_NODE_COLORS = [
  '#ff6b6b','#4ecdc4','#ffd93d','#a78bfa','#f97316','#06b6d4',
  '#84cc16','#f43f5e','#38bdf8','#a855f7','#14b8a6','#eab308',
  '#6366f1','#ec4899','#0ea5e9','#22c55e',
]

function renderCompoundNode(
  el: { cosetMemberLabels?: string[]; cosetInternalEdges?: InternalEdgeData[]; cosetInternalLayout?: { x: number; y: number }[] },
  outerR: number,
  isSelected: boolean,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  showInternalEdges: boolean = true,
) {
  const members = el.cosetMemberLabels!
  const maxShow = 12
  const showCount = Math.min(members.length, maxShow)
  // Inner node radius scales with the compound node but remains readable.
  const innerR = Math.min(10, Math.max(4, Math.floor(outerR / (Math.max(3, Math.sqrt(showCount)) * 1.8))))
  const layoutScale = outerR * 0.72

  const hasLayout = el.cosetInternalLayout && el.cosetInternalLayout.length >= showCount
  const innerPos = (idx: number) => {
    if (hasLayout) {
      const p = el.cosetInternalLayout![idx]
      return { x: p.x * layoutScale, y: p.y * layoutScale }
    }
    // Fallback circular layout for the internal Cayley graph.
    const angle = (idx / showCount) * 2 * Math.PI - Math.PI / 2
    return {
      x: Math.cos(angle) * (outerR * 0.55),
      y: Math.sin(angle) * (outerR * 0.55),
    }
  }

  const circles = []
  for (let i = 0; i < showCount; i++) {
    const pos = innerPos(i)
    circles.push(
      <circle
        key={i}
        cx={pos.x}
        cy={pos.y}
        r={innerR}
        fill={INNER_NODE_COLORS[i % INNER_NODE_COLORS.length]}
        stroke="var(--node-stroke)"
        strokeWidth={0.8}
      />
    )
  }

  const internalEdges = showInternalEdges ? el.cosetInternalEdges : undefined
  const edgeElements: React.ReactNode[] = []
  if (internalEdges && internalEdges.length > 0) {
    for (let i = 0; i < internalEdges.length; i++) {
      const edge = internalEdges[i]
      if (edge.fromInnerIdx >= showCount || edge.toInnerIdx >= showCount) continue
      const from = innerPos(edge.fromInnerIdx)
      const to = innerPos(edge.toInnerIdx)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.1) continue
      const ux = dx / dist
      const uy = dy / dist
      const sx = from.x + ux * innerR
      const sy = from.y + uy * innerR
      const ex = to.x - ux * innerR
      const ey = to.y - uy * innerR
      const midX = (sx + ex) / 2
      const midY = (sy + ey) / 2

      const edgeTitle = edge.actionLabel || edge.actionElementId || ''
      const titleEl = edgeTitle ? <title>{edgeTitle}</title> : null
      if (edge.isBidirectional) {
        edgeElements.push(
          <g key={`edge-${i}`}>
            <line
              x1={sx} y1={sy} x2={ex} y2={ey}
              stroke={edge.color}
              strokeWidth={1.5}
              strokeOpacity={0.75}
              strokeLinecap="round"
            >{titleEl}</line>
            {/* Transparent thick hover target for easier tooltip discovery */}
            <line
              x1={sx} y1={sy} x2={ex} y2={ey}
              stroke="transparent"
              strokeWidth={8}
              strokeLinecap="round"
              style={{ pointerEvents: 'stroke' }}
            >{titleEl}</line>
          </g>
        )
      } else {
        const curveOffset = 2.5
        const nx = -uy * curveOffset
        const ny = ux * curveOffset
        const c1x = midX + nx
        const c1y = midY + ny
        const arrowSize = 2.5
        edgeElements.push(
          <g key={`edge-${i}`}>
            <path
              d={`M${sx},${sy} Q${c1x},${c1y} ${ex},${ey}`}
              stroke={edge.color}
              strokeWidth={1.5}
              strokeOpacity={0.75}
              fill="none"
            >{titleEl}</path>
            {/* Transparent thick hover target for easier tooltip discovery */}
            <path
              d={`M${sx},${sy} Q${c1x},${c1y} ${ex},${ey}`}
              stroke="transparent"
              strokeWidth={8}
              fill="none"
              style={{ pointerEvents: 'stroke' }}
            >{titleEl}</path>
          </g>
        )
        const ax = ex - c1x
        const ay = ey - c1y
        const alen = Math.sqrt(ax * ax + ay * ay) || 1
        const aux = ax / alen
        const auy = ay / alen
        edgeElements.push(
          <polygon
            key={`arrow-${i}`}
            points={`${ex},${ey} ${ex - aux * arrowSize + auy * arrowSize * 0.5},${ey - auy * arrowSize - aux * arrowSize * 0.5} ${ex - aux * arrowSize - auy * arrowSize * 0.5},${ey - auy * arrowSize + aux * arrowSize * 0.5}`}
            fill={edge.color}
            stroke={edge.color}
            strokeWidth={0.5}
          />
        )
      }
    }
  }

  return (
    <>
      <circle
        r={outerR}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isSelected ? undefined : "4 2"}
        filter="url(#node-shadow)"
      />
      {edgeElements}
      {circles}
      {members.length > maxShow && (
        <text
          x={0} y={outerR - 2}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize={10}
        >
          +{members.length - maxShow}
        </text>
      )}
    </>
  )
}

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  initialTransformX: number
  initialTransformY: number
  currentX: number
  currentY: number
}

export function GroupCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialTransformX: 0,
    initialTransformY: 0,
    currentX: 0,
    currentY: 0
  })
  const [isDragging, setIsDragging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  
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

  const hintFade = useAutoFade(hintMessage)
  const historyFade = useAutoFade(operationHistory.length)

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
      initialTransformY: canvasTransform.y,
      currentX: canvasTransform.x,
      currentY: canvasTransform.y
    }
  }, [canvasTransform.x, canvasTransform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return

    if (dragStateRef.current.isDragging) {
      const dx = e.clientX - dragStateRef.current.startX
      const dy = e.clientY - dragStateRef.current.startY
      const newX = dragStateRef.current.initialTransformX + dx
      const newY = dragStateRef.current.initialTransformY + dy
      dragStateRef.current.currentX = newX
      dragStateRef.current.currentY = newY
      if (gRef.current) {
        // Cayley view: direct DOM update for smooth dragging without re-render.
        applyTransformToDom(newX, newY, canvasTransform.scale)
      } else {
        // Dedicated views (coset strip, set, cycle, etc.) render their own
        // <g transform> from state, so we update state directly.
        setCanvasTransform({ x: newX, y: newY, scale: canvasTransform.scale })
      }
    }
  }, [canvasTransform.scale, applyTransformToDom, setCanvasTransform])

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current.isDragging) {
      // Commit final position to state. For the Cayley graph view we read the
      // live DOM transform; for other views (coset strip, set, cycle, etc.) the
      // gRef is not attached, so we fall back to the drag delta computed from the
      // initial state (which is the same as what applyTransformToDom wrote to gRef).
      const g = gRef.current
      if (g) {
        const transform = g.getAttribute('transform') || ''
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/)
        if (match) {
          setCanvasTransform({ x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) })
        }
      } else {
        // Fallback for views whose root <g> is not attached to gRef.
        // We already updated the transform via applyTransformToDom on gRef,
        // but gRef is null for these views, so commit the last computed drag
        // position stored in dragStateRef instead.
        setCanvasTransform({
          x: dragStateRef.current.currentX,
          y: dragStateRef.current.currentY,
          scale: canvasTransform.scale
        })
      }
    }
    dragStateRef.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      initialTransformX: 0,
      initialTransformY: 0,
      currentX: 0,
      currentY: 0
    }
    setIsDragging(false)
  }, [setCanvasTransform, canvasTransform.scale])

  const wheelRafRef = useRef<number>(0)
  const pendingTransformRef = useRef<{ x: number; y: number; scale: number } | null>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
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
    return () => {
      if (wheelRafRef.current) {
        cancelAnimationFrame(wheelRafRef.current)
        wheelRafRef.current = 0
      }
    }
  }, [])

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
      case 'homomorphism':
        return <HomomorphismView />
      case 'cosetstrip':
        return <CosetStripView />
      case 'action':
        return <ActionView />
      case 'sylow':
        return <SylowView />
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
        onDoubleClick={(e) => {
          if (e.target instanceof SVGElement && e.target.tagName === 'svg') {
            setCanvasTransform({ x: 0, y: 0, scale: 1 })
          }
        }}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {renderView()}
      </div>
      
      {hintMessage && (
        <div
          className="hint-box"
          style={{ opacity: hintFade.visible ? 1 : 0 }}
          onMouseEnter={hintFade.onMouseEnter}
          onMouseLeave={hintFade.onMouseLeave}
        >
          <div className="hint-box-header">
            <span>{`💡 ${t('canvas.hintBox')}`}</span>
          </div>
          <div className="hint-box-body" dangerouslySetInnerHTML={{ __html: hintMessage }} />
        </div>
      )}
      
      {operationHistory.length > 0 && (
      <div
        className="history-panel"
        style={{ opacity: historyOpen || historyFade.visible ? 1 : 0.85, pointerEvents: 'auto' }}
        onMouseEnter={historyFade.onMouseEnter}
        onMouseLeave={historyFade.onMouseLeave}
      >
        <button
          className="history-toggle"
          onClick={() => setHistoryOpen(o => !o)}
        >
          {`🕘 ${t('canvas.history')} (${operationHistory.length}) ${historyOpen ? '▾' : '▸'}`}
        </button>
        {historyOpen && (
          <div className="history-list">
            {operationHistory.slice(-5).map((op, i) => (
              <div key={i} className="history-item">{op}</div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function CayleyGraphView({ gRef }: { gRef: React.RefObject<SVGGElement | null> }) {
  const { currentGroup, selectedElements, canvasTransform, selectElement, setHoverElement, getNodePosition, setNodePosition, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets, selfInverseElementId, cosetElementMap, cosetHighlightSet, cosetColors, cayleyShape2D } = useGroup()
  const { t } = useTranslation()

  // Stable computed values so hooks are invoked in the same order every render.
  const n = currentGroup?.order ?? 0
  const hasCompoundNodes = currentGroup ? currentGroup.elements.some(el => el.cosetMemberLabels && el.cosetMemberLabels.length > 0) : false
  const nodeRadius = hasCompoundNodes ? 72 : 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + n * 10)

  const gridPositions = useMemo(() => {
    if (!currentGroup) return null
    return computeShape2DPositions(currentGroup, cayleyShape2D, viewBoxSize.width, viewBoxSize.height)
  }, [cayleyShape2D, currentGroup, viewBoxSize.width, viewBoxSize.height])

  const circLayout = useMemo(() => {
    if (!currentGroup || n === 0) return new Map<string, { x: number; y: number }>()
    return cayleyCircleLayout(currentGroup, cx, cy, graphRadius)
  }, [currentGroup, cx, cy, graphRadius, n])

  // Semidirect-product metadata: used by the rewiring shape to highlight
  // φ(h)-fixed points and draw the x ↦ φ(x) wiring arcs inside each ring.
  const sdMeta = useMemo(() => {
    if (!currentGroup) return null
    return (currentGroup as Group & { _semidirectProduct?: { normal: Group; acting: Group; phiMap: Map<string, Automorphism> } })._semidirectProduct ?? null
  }, [currentGroup])

  const sdFixedMap = useMemo(() => {
    const m = new Map<string, boolean>()
    if (!sdMeta) return m
    for (const hEl of sdMeta.acting.elements) {
      const phiH = sdMeta.phiMap.get(hEl.id)
      if (!phiH) continue
      const entries: Array<[string, boolean]> = []
      let fixedCount = 0
      for (const nEl of sdMeta.normal.elements) {
        const fixed = phiH.map.get(nEl.id) === nEl.id
        entries.push([`${nEl.id}|${hEl.id}`, fixed])
        if (fixed) fixedCount++
      }
      // The reference copy (φ(h) = identity) is left unhighlighted — only
      // rings whose φ(h) actually moves elements show their fixed points.
      if (fixedCount === sdMeta.normal.order) continue
      for (const [k, v] of entries) m.set(k, v)
    }
    return m
  }, [sdMeta])

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
      const pos = circLayout.get(elId)
      if (!pos) return { x: cx, y: cy }
      defPos = pos
    }
    const saved = getNodePosition(elId)
    if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
      return saved
    }
    return defPos
  }, [gridPositions, circLayout, getNodePosition, cx, cy])

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
        {edgeElements}

        {currentGroup.elements.map((el) => {
          const pos = nodePositionsCache.get(el.id) || { x: cx, y: cy }
          if (!isNodeOnScreen(pos.x, pos.y)) return null
          const isSelected = selectedElements.has(el.id)
          const parentSubset = subsetDetailMap.get(el.id)
          const cosetIdx = cosetElementMap.get(el.id)
          const isInHighlightedCoset = cosetIdx !== undefined && cosetHighlightSet.has(cosetIdx)
          const isSdFixed = cayleyShape2D === 'rewiring' && !!sdMeta && sdFixedMap.get(el.id) === true
          
          let fillColor = 'var(--node-fill)'
          let strokeColor = 'var(--node-stroke)'
          let strokeWidth = 2.5
          
          if (isSelected) {
            fillColor = 'var(--node-fill-selected)'
            strokeColor = '#ffd93d'
            strokeWidth = 3
          } else if (isSdFixed) {
            fillColor = 'var(--accent-teal)22'
            strokeColor = 'var(--accent-teal)'
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
               {el.cosetMemberLabels && el.cosetMemberLabels.length > 0 ? (
                  renderCompoundNode(el, nodeRadius, isSelected, fillColor, strokeColor, strokeWidth, true)
                ) : (
                 <>
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
                             width: '100%', height: '100%', color: isSdFixed ? 'var(--accent-teal)' : 'var(--node-text)', fontSize: isLargeGraph ? '10px' : '15px', fontWeight: isSdFixed ? 700 : 400
                          }}
                         dangerouslySetInnerHTML={{
                           __html: renderTex(texify(el.label))
                         }}
                       />
                     </foreignObject>
                   )}
                 </>
               )}
               {el.cosetMemberLabels && el.cosetMemberLabels.length > 0 && isInHighlightedCoset && cosetIdx !== undefined && (
                 <circle
                   r={nodeRadius + 2}
                   fill={`${cosetColors[cosetIdx]}22`}
                   stroke="none"
                 />
               )}
               {el.cosetMemberLabels && el.cosetMemberLabels.length > 0 && parentSubset && (
                 <circle
                   r={nodeRadius + 2}
                   fill={`${parentSubset.color}22`}
                   stroke="none"
                 />
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

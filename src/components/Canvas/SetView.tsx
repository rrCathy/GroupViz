import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import type { InternalEdgeData } from '../../core/types'

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
  const innerR = Math.min(10, Math.max(4, Math.floor(outerR / (Math.max(3, Math.sqrt(showCount)) * 1.8))))
  const layoutScale = outerR * 0.72

  const hasLayout = el.cosetInternalLayout && el.cosetInternalLayout.length >= showCount
  const innerPos = (idx: number) => {
    if (hasLayout) {
      const p = el.cosetInternalLayout![idx]
      return { x: p.x * layoutScale, y: p.y * layoutScale }
    }
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

export function SetView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, canvasTransform, viewBoxSize, subsets, selfInverseElementId, cosetElementMap, cosetHighlightSet, cosetColors } = useGroup()
  const { t } = useTranslation()

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, typeof subsets[0]>()
    subsets.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const isLarge = currentGroup.order > 60
  const hasCompoundNodes = currentGroup.elements.some(el => el.cosetMemberLabels && el.cosetMemberLabels.length > 0)
  const nodeRadius = hasCompoundNodes ? 72 : 26
  const gap = hasCompoundNodes ? 12 : 8
  const cellSize = nodeRadius * 2 + gap
  const cols = hasCompoundNodes
    ? Math.min(currentGroup.order, Math.max(1, Math.floor(viewBoxSize.width / cellSize)))
    : Math.ceil(Math.sqrt(currentGroup.order))
  const rows = currentGroup.order / cols
  const totalWidth = cols * cellSize
  const totalHeight = rows * cellSize
  const startX = Math.max(nodeRadius, (viewBoxSize.width - totalWidth) / 2 + cellSize / 2)
  const startY = Math.max(nodeRadius, (viewBoxSize.height - totalHeight) / 2 + cellSize / 2)

  const getPos = (_elId: string, index: number) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      x: startX + col * cellSize,
      y: startY + row * cellSize
    }
  }

  // Viewport culling for large groups — skip off-screen nodes
  const isNodeOnScreen = (px: number, py: number) => {
    if (!isLarge) return true
    const sx = px * canvasTransform.scale + canvasTransform.x
    const sy = py * canvasTransform.scale + canvasTransform.y
    const m = nodeRadius * canvasTransform.scale * 1.5
    return sx + m > 0 && sx - m < viewBoxSize.width &&
           sy + m > 0 && sy - m < viewBoxSize.height
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      {!isLarge && (
        <defs>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {currentGroup.elements.map((el, i) => {
          const pos = getPos(el.id, i)
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
          
          const isCompound = !!(el.cosetMemberLabels && el.cosetMemberLabels.length > 0)
          
          return (
            <g
              key={el.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={(e) => {
                e.stopPropagation()
                selectElement(el.id, e.ctrlKey || e.metaKey)
              }}
              onMouseEnter={() => setHoverElement(el)}
              onMouseLeave={() => setHoverElement(null)}
              style={{ cursor: 'pointer' }}
            >
              {isCompound ? (
                renderCompoundNode(el, nodeRadius, isSelected, fillColor, strokeColor, strokeWidth, true)
              ) : (
                <>
                  <circle
                    r={nodeRadius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    filter={isLarge ? undefined : "url(#node-shadow)"}
                  />
                  {isInHighlightedCoset && cosetIdx !== undefined && (
                    <circle
                      r={nodeRadius}
                      fill={`${cosetColors[cosetIdx]}22`}
                      stroke="none"
                    />
                  )}
                  {parentSubset && (
                    <circle
                      r={nodeRadius}
                      fill={`${parentSubset.color}22`}
                      stroke="none"
                    />
                  )}
                  {(!isLarge || isSelected || selectedElements.size === 0) && (
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
                            width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLarge ? '10px' : '15px'
                         }}
                         dangerouslySetInnerHTML={{
                           __html: renderTex(texify(el.label))
                         }}
                       />
                     </foreignObject>
                   )}
                </>
              )}
              {isInHighlightedCoset && cosetIdx !== undefined && isCompound && (
                <circle
                  r={nodeRadius + 2}
                  fill={`${cosetColors[cosetIdx]}22`}
                  stroke="none"
                />
              )}
              {parentSubset && isCompound && (
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

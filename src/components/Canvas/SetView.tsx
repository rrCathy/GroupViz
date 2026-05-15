import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'

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
  const nodeRadius = 26
  const gap = 8
  const cellSize = nodeRadius * 2 + gap
  const cols = Math.ceil(Math.sqrt(currentGroup.order))
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

import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'

export function SetView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, getNodePosition, setNodePosition, canvasTransform, viewBoxSize, subsets, selfInverseElementId } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const nodeRadius = 26
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.32, 150 + currentGroup.order * 16)

  const getPos = (elId: string, index: number) => {
    const saved = getNodePosition(elId)
    if (saved) return saved
    
    const angle = (index * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: cx + graphRadius * Math.cos(angle),
      y: cy + graphRadius * Math.sin(angle)
    }
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        <circle cx={cx} cy={cy} r={graphRadius} fill="none" stroke="#2d2d4a" strokeWidth={1} strokeDasharray="4" />
        
        {currentGroup.elements.map((el, i) => {
          const pos = getPos(el.id, i)
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
                  const startPos = getPos(el.id, i)
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

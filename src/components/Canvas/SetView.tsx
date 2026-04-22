import { useGroup } from '../../context/GroupContext'

export function SetView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, getNodePosition, setNodePosition, canvasTransform } = useGroup()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>请先选择一个群</p>
      </div>
    )
  }

  const nodeRadius = 26

  const getPos = (elId: string, index: number) => {
    const saved = getNodePosition(elId)
    if (saved) return saved
    
    const angle = (index * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: 400 + 150 * Math.cos(angle),
      y: 280 + 150 * Math.sin(angle)
    }
  }

  return (
    <svg viewBox="0 0 800 560" className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        <circle cx={400} cy={280} r={150} fill="none" stroke="#2d2d4a" strokeWidth={1} strokeDasharray="4" />
        
        {currentGroup.elements.map((el, i) => {
          const pos = getPos(el.id, i)
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
    </svg>
  )
}

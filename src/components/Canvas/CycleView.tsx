import { useMemo } from 'react'
import { useGroup } from '../../context/GroupContext'

export function CycleView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, getNodePosition, setNodePosition, canvasTransform, showMaximalCycles } = useGroup()

  const cycles = useMemo(() => {
    if (!currentGroup) return []
    
    const allCycles: { generatorId: string; generatorLabel: string; elements: { id: string; label: string }[]; order: number }[] = []
    const visitedKeys = new Set<string>()
    
    for (const el of currentGroup.elements) {
      const subgroup: { id: string; label: string }[] = []
      const seen = new Set<string>()
      let current = el
      
      while (!seen.has(current.id)) {
        seen.add(current.id)
        subgroup.push({ id: current.id, label: current.label })
        current = currentGroup.multiply(current, el)
      }
      
      if (subgroup.length > 1) {
        const key = subgroup.map(e => e.id).sort().join(',')
        if (!visitedKeys.has(key)) {
          visitedKeys.add(key)
          allCycles.push({
            generatorId: el.id,
            generatorLabel: el.label,
            elements: subgroup,
            order: subgroup.length
          })
        }
      }
    }
    
    if (!showMaximalCycles) {
      return allCycles.sort((a, b) => a.order - b.order)
    }
    
    const maximalCycles = allCycles.filter(cycle => {
      const cycleSet = new Set(cycle.elements.map(e => e.id))
      return !allCycles.some(other => {
        if (other.generatorId === cycle.generatorId) return false
        const otherSet = new Set(other.elements.map(e => e.id))
        return [...cycleSet].every(id => otherSet.has(id))
      })
    })
    
    return maximalCycles.sort((a, b) => a.order - b.order)
  }, [currentGroup, showMaximalCycles])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>请先选择一个群</p>
      </div>
    )
  }

  const nodeRadius = 24
  const colors = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6', '#3498db', '#e67e22']
  
  const getPos = (elId: string) => {
    const saved = getNodePosition(elId)
    if (saved) return saved
    
    const idx = currentGroup.elements.findIndex(e => e.id === elId)
    const angle = (idx * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: 400 + 160 * Math.cos(angle),
      y: 280 + 160 * Math.sin(angle)
    }
  }

  return (
    <svg viewBox="0 0 800 560" className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {cycles.map((cycle, cycleIdx) => {
          const color = colors[cycleIdx % colors.length]
          const positions = cycle.elements.map(el => getPos(el.id))
          
          const cx = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
          const cy = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
          
          const pathD = positions.map((p, i) => 
            i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
          ).join(' ') + ' Z'
          
          return (
            <g key={cycleIdx}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeDasharray="6"
                opacity={0.5}
              />
              <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.3} />
              <text x={cx} y={cy - 12} textAnchor="middle" fill={color} fontSize={10} fontFamily="serif">
                ⟨{cycle.generatorLabel}⟩ ≅ Z{cycle.order}
              </text>
            </g>
          )
        })}
        
        {currentGroup.elements.map((el) => {
          const pos = getPos(el.id)
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
                  const startPos = getPos(el.id)
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
                fontSize={13}
                fontFamily="serif"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {el.label}
              </text>
            </g>
          )
        })}
      </g>
      
      <text x={400} y={30} textAnchor="middle" fill="#888" fontSize={11} style={{ userSelect: 'none' }}>
        循环图 - 每个多边形是一个循环子群 ⟨g⟩ ≅ Zₙ
      </text>
    </svg>
  )
}

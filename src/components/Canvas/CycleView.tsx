import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { planarCycleLayout } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'

export function CycleView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, getNodePosition, setNodePosition, canvasTransform, showMaximalCycles, viewBoxSize, subsets, selfInverseElementId } = useGroup()
  const { t } = useTranslation()

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

  const planarPositions = useMemo(() => {
    if (!currentGroup || !showMaximalCycles || cycles.length === 0) return null
    const existing = new Map<string, { x: number; y: number }>()
    for (const el of currentGroup.elements) {
      const p = getNodePosition(el.id)
      if (p) existing.set(el.id, p)
    }
    return planarCycleLayout(
      currentGroup.elements,
      cycles,
      viewBoxSize.width,
      viewBoxSize.height,
      { initialPositions: existing.size > 0 ? existing : undefined }
    )
  }, [currentGroup, showMaximalCycles, cycles, viewBoxSize.width, viewBoxSize.height, getNodePosition])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const colors = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6', '#3498db', '#e67e22']
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.32, 160 + currentGroup.order * 16)
  
  const getPos = (elId: string) => {
    const saved = getNodePosition(elId)
    if (saved) return saved
    
    if (planarPositions) {
      const p = planarPositions.get(elId)
      if (p) return p
    }
    
    const idx = currentGroup.elements.findIndex(e => e.id === elId)
    const angle = (idx * 2 * Math.PI / currentGroup.order) - Math.PI / 2
    return {
      x: cx + graphRadius * Math.cos(angle),
      y: cy + graphRadius * Math.sin(angle)
    }
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {cycles.map((cycle, cycleIdx) => {
          const color = colors[cycleIdx % colors.length]
          const positions = cycle.elements.map(el => getPos(el.id))
          
          const pcx = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
          const pcy = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
          
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
              <circle cx={pcx} cy={pcy} r={8} fill={color} opacity={0.3} />
              <text x={pcx} y={pcy - 12} textAnchor="middle" fill={color} fontSize={10} fontFamily="serif">
                ⟨{cycle.generatorLabel}⟩ ≅ Z{cycle.order}
              </text>
            </g>
          )
        })}
        
        {currentGroup.elements.map((el) => {
          const pos = getPos(el.id)
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
                  const scaleX = viewBoxSize.width / svgRect.width
                  const scaleY = viewBoxSize.height / svgRect.height
                  
                  const startX = (e.clientX - svgRect.left) * scaleX
                  const startY = (e.clientY - svgRect.top) * scaleY
                  const initialOffsetX = pos.x
                  const initialOffsetY = pos.y
                  
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
                r={24}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              {parentSubset && (
                <circle
                  r={24}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              <foreignObject
                 x={-24}
                 y={-15}
                 width={48}
                 height={30}
                 style={{ pointerEvents: 'none', userSelect: 'none' }}
               >
                 <div
                   style={{
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     width: '100%', height: '100%', color: 'white', fontSize: '14px'
                   }}
                   dangerouslySetInnerHTML={{
                     __html: renderTex(texify(el.label))
                   }}
                 />
               </foreignObject>
               {selfInverseElementId === el.id && (
                 <g>
                   <circle r={30} fill="none" stroke="#ffd93d" strokeWidth={2.5} strokeDasharray="6 3" opacity={0.85}>
                     <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
                   </circle>
                   <path
                     d="M 27,-8 L 38,-5 L 34,-1"
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
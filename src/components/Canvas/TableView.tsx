import { useMemo } from 'react'
import { useGroup } from '../../context/GroupContext'

const elementColors = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6', 
  '#3498db', '#e67e22', '#1abc9c', '#e74c3c', '#2ecc71',
  '#f39c12', '#8e44ad', '#3071a9', '#d35400', '#c0392b'
]

export function TableView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement } = useGroup()

  const table = useMemo(() => {
    if (!currentGroup) return null
    
    const { elements, multiply } = currentGroup
    const n = elements.length
    
    const tableData: string[][] = []
    
    for (let i = 0; i < n; i++) {
      const row: string[] = []
      for (let j = 0; j < n; j++) {
        const result = multiply(elements[j], elements[i])
        row.push(result.label)
      }
      tableData.push(row)
    }
    
    return tableData
  }, [currentGroup])

  const getElementColor = (label: string): string => {
    if (!currentGroup) return '#ccc'
    const idx = currentGroup.elements.findIndex(e => e.label === label)
    return elementColors[idx % elementColors.length]
  }

  if (!currentGroup || !table) {
    return (
      <div className="view-empty">
        <p>请先选择一个群</p>
      </div>
    )
  }

  const { elements } = currentGroup
  const cellSize = 50
  const tableWidth = elements.length * cellSize
  const tableHeight = elements.length * cellSize
  const offsetX = 400 - tableWidth / 2
  const offsetY = 280 - tableHeight / 2

  return (
    <svg viewBox="0 0 800 560" className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        {elements.map((rowEl, rowIdx) => (
          <g key={rowEl.id} transform={`translate(0, ${rowIdx * cellSize})`}>
            <text
              x={-35}
              y={cellSize / 2 + 5}
              textAnchor="end"
              fill={elementColors[rowIdx % elementColors.length]}
              fontSize={14}
              fontFamily="serif"
              style={{ userSelect: 'none' }}
            >
              {rowEl.label}
            </text>
          </g>
        ))}
        
        {elements.map((colEl, colIdx) => (
          <text
            key={colEl.id}
            x={colIdx * cellSize + cellSize / 2}
            y={-12}
            textAnchor="middle"
            fill={elementColors[colIdx % elementColors.length]}
            fontSize={14}
            fontFamily="serif"
            style={{ userSelect: 'none' }}
          >
            {colEl.label}
          </text>
        ))}
        
        {elements.map((rowEl, rowIdx) =>
          elements.map((colEl, colIdx) => {
            const result = table[rowIdx][colIdx]
            const resultColor = getElementColor(result)
            const isSelected = selectedElements.size === 1 && 
              Array.from(selectedElements).some(id => 
                elements.find(e => e.id === id)?.label === result
              )
            
            return (
              <g
                key={`${rowEl.id}-${colEl.id}`}
                transform={`translate(${colIdx * cellSize}, ${rowIdx * cellSize})`}
                onClick={() => {
                  const targetEl = elements.find(e => e.label === result)
                  if (targetEl) selectElement(targetEl.id, true)
                }}
                onMouseEnter={() => {
                  const targetEl = elements.find(e => e.label === result)
                  if (targetEl) setHoverElement(targetEl)
                }}
                onMouseLeave={() => setHoverElement(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width={cellSize - 2}
                  height={cellSize - 2}
                  fill={isSelected ? '#2d4a4a' : resultColor + '22'}
                  stroke={resultColor}
                  strokeWidth={isSelected ? 2 : 0.5}
                  rx={4}
                />
                <text
                  x={cellSize / 2}
                  y={cellSize / 2 + 5}
                  textAnchor="middle"
                  fill={resultColor}
                  fontSize={13}
                  fontFamily="serif"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {result}
                </text>
              </g>
            )
          })
        )}
      </g>

      <text x={400} y={tableHeight + offsetY + 35} textAnchor="middle" fill="#666" fontSize={11} style={{ userSelect: 'none' }}>
        列 × 行 = 结果
      </text>
      
      <text x={400} y={tableHeight + offsetY + 50} textAnchor="middle" fill="#666" fontSize={10} style={{ userSelect: 'none' }}>
        颜色对应结果元素
      </text>
    </svg>
  )
}
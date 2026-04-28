import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { isTooLarge } from '../../core/viewBox'

const elementColors = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6',
  '#3498db', '#e67e22', '#1abc9c', '#e74c3c', '#2ecc71',
  '#f39c12', '#8e44ad', '#3071a9', '#d35400', '#c0392b'
]

export function TableView() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    setHoverElement,
    viewBoxSize,
    forceShowLargeGroup,
    setForceShowLargeGroup,
    subsets,
  } = useGroup()
  const { t } = useTranslation()

  const table = useMemo(() => {
    if (!currentGroup) return null
    const { elements, multiply } = currentGroup
    const n = elements.length
    const tableData: { label: string; id: string }[][] = []
    for (let i = 0; i < n; i++) {
      const row: { label: string; id: string }[] = []
      for (let j = 0; j < n; j++) {
        const result = multiply(elements[j], elements[i])
        row.push({ label: result.label, id: result.id })
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

  const selectedIndices = useMemo(() => {
    if (!currentGroup) return new Set<number>()
    const set = new Set<number>()
    selectedElements.forEach(id => {
      const idx = currentGroup.elements.findIndex(e => e.id === id)
      if (idx !== -1) set.add(idx)
    })
    return set
  }, [currentGroup, selectedElements])

  const subgroupIndexSets = useMemo(() => {
    if (!currentGroup) return [] as { color: string; indices: Set<number> }[]
    return subsets
      .filter(s => s.isSubgroup)
      .map(s => {
        const indices = new Set<number>()
        s.elementIds.forEach(elId => {
          const idx = currentGroup.elements.findIndex(e => e.id === elId)
          if (idx !== -1) indices.add(idx)
        })
        return { color: s.color, indices }
      })
  }, [currentGroup, subsets])

  const nonSubgroupSubsetIndices = useMemo(() => {
    if (!currentGroup) return new Set<number>()
    const set = new Set<number>()
    for (const subset of subsets) {
      if (subset.isSubgroup) continue
      for (const elId of subset.elementIds) {
        const idx = currentGroup.elements.findIndex(e => e.id === elId)
        if (idx !== -1) set.add(idx)
      }
    }
    return set
  }, [currentGroup, subsets])

  const subsetElemMap = useMemo(() => {
    if (!currentGroup) return new Map<number, { color: string; isSubgroup: boolean }>()
    const map = new Map<number, { color: string; isSubgroup: boolean }>()
    for (const subset of subsets) {
      for (const elId of subset.elementIds) {
        const idx = currentGroup.elements.findIndex(e => e.id === elId)
        if (idx !== -1) {
          if (!map.has(idx)) {
            map.set(idx, { color: subset.color, isSubgroup: subset.isSubgroup })
          }
        }
      }
    }
    return map
  }, [currentGroup, subsets])

  const subgroupCellColors = useMemo(() => {
    if (!currentGroup) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const sg of subgroupIndexSets) {
      for (const ri of sg.indices) {
        for (const ci of sg.indices) {
          map.set(`${ri},${ci}`, sg.color)
        }
      }
    }
    return map
  }, [subgroupIndexSets, currentGroup])

  const elementsInAnySubgroup = useMemo(() => {
    const set = new Set<number>()
    for (const sg of subgroupIndexSets) {
      for (const i of sg.indices) set.add(i)
    }
    return set
  }, [subgroupIndexSets])

  if (!currentGroup || !table) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  if (isTooLarge(currentGroup.order, 'table') && !forceShowLargeGroup) {
    return (
      <div className="large-group-warning">
        <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
        <button className="panel-btn" onClick={() => setForceShowLargeGroup(true)}>
          {t('canvas.show')}
        </button>
      </div>
    )
  }

  const { elements } = currentGroup
  const cellSize = 50
  const tableWidth = elements.length * cellSize
  const tableHeight = elements.length * cellSize
  const vw = viewBoxSize.width
  const vh = viewBoxSize.height
  const offsetX = vw / 2 - tableWidth / 2
  const offsetY = vh / 2 - tableHeight / 2

  const identityIdx = elements.findIndex(e =>
    e.id === currentGroup.identity.id
  )

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${offsetX}, ${offsetY})`}>

        {/* Row headers */}
        {elements.map((rowEl, rowIdx) => {
          const isSelected = selectedIndices.has(rowIdx)
          const sInfo = subsetElemMap.get(rowIdx)
          const inSubgroup = elementsInAnySubgroup.has(rowIdx)

          let headerFill = elementColors[rowIdx % elementColors.length]
          let bg: string | null = null
          if (isSelected) bg = '#ffd93d33'
          else if (inSubgroup && sInfo) bg = sInfo.color + '33'
          if (isSelected) headerFill = '#ffd93d'

          return (
            <g
              key={rowEl.id}
              transform={`translate(0, ${rowIdx * cellSize})`}
              onClick={() => selectElement(rowEl.id, true)}
              style={{ cursor: 'pointer' }}
            >
              {bg && (
                <rect x={-38} y={2} width={33} height={cellSize - 4} fill={bg} rx={4} />
              )}
              <text
                x={-35}
                y={cellSize / 2 + 5}
                textAnchor="end"
                fill={headerFill}
                fontSize={14}
                fontFamily="serif"
                fontWeight={isSelected ? 'bold' : 'normal'}
                style={{ userSelect: 'none' }}
              >
                {rowEl.label}
              </text>
            </g>
          )
        })}

        {/* Column headers */}
        {elements.map((colEl, colIdx) => {
          const isSelected = selectedIndices.has(colIdx)
          const sInfo = subsetElemMap.get(colIdx)
          const inSubgroup = elementsInAnySubgroup.has(colIdx)

          let headerFill = elementColors[colIdx % elementColors.length]
          let bg: string | null = null
          if (isSelected) bg = '#ffd93d33'
          else if (inSubgroup && sInfo) bg = sInfo.color + '33'
          if (isSelected) headerFill = '#ffd93d'

          return (
            <g
              key={`head-${colEl.id}`}
              onClick={() => selectElement(colEl.id, true)}
              style={{ cursor: 'pointer' }}
            >
              {bg && (
                <rect x={colIdx * cellSize + 2} y={-16} width={cellSize - 4} height={18} fill={bg} rx={4} />
              )}
              <text
                x={colIdx * cellSize + cellSize / 2}
                y={-12}
                textAnchor="middle"
                fill={headerFill}
                fontSize={14}
                fontFamily="serif"
                fontWeight={isSelected ? 'bold' : 'normal'}
                style={{ userSelect: 'none' }}
              >
                {colEl.label}
              </text>
            </g>
          )
        })}

        {/* Table cells */}
        {elements.map((rowEl, rowIdx) =>
          elements.map((colEl, colIdx) => {
            const result = table[rowIdx][colIdx]
            const resultColor = getElementColor(result.label)

            const isRowSel = selectedIndices.has(rowIdx)
            const isColSel = selectedIndices.has(colIdx)

            const sgKey = `${rowIdx},${colIdx}`
            const sgColor = subgroupCellColors.get(sgKey)

            const nonSubRow = identityIdx >= 0 && rowIdx === identityIdx && nonSubgroupSubsetIndices.has(colIdx)
            const nonSubCol = identityIdx >= 0 && colIdx === identityIdx && nonSubgroupSubsetIndices.has(rowIdx)

            let cellFill = resultColor + '22'
            let cellStroke = resultColor
            let cellStrokeW = 0.5

            if (sgColor) {
              cellFill = sgColor + '28'
              cellStroke = sgColor
              cellStrokeW = 2
            } else if (isRowSel && isColSel) {
              cellFill = '#ffd93d22'
              cellStroke = '#ffd93d'
              cellStrokeW = 2
            } else if (isRowSel || isColSel) {
              cellFill = '#ffd93d15'
              cellStroke = '#ffd93d88'
              cellStrokeW = 1
            } else if (nonSubRow || nonSubCol) {
              cellFill = '#ffffff0e'
              cellStroke = '#ffffff44'
              cellStrokeW = 1.5
            }

            return (
              <g
                key={`${rowEl.id}-${colEl.id}`}
                transform={`translate(${colIdx * cellSize}, ${rowIdx * cellSize})`}
                onClick={() => {
                  const targetEl = elements.find(e => e.id === result.id)
                  if (targetEl) selectElement(targetEl.id, true)
                }}
                onMouseEnter={() => {
                  const targetEl = elements.find(e => e.id === result.id)
                  if (targetEl) setHoverElement(targetEl)
                }}
                onMouseLeave={() => setHoverElement(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width={cellSize - 2}
                  height={cellSize - 2}
                  fill={cellFill}
                  stroke={cellStroke}
                  strokeWidth={cellStrokeW}
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
                  {result.label}
                </text>
              </g>
            )
          })
        )}
      </g>

      <text x={vw / 2} y={tableHeight + offsetY + 35} textAnchor="middle" fill="#666" fontSize={11} style={{ userSelect: 'none' }}>
        {t('table.footer1')}
      </text>

      <text x={vw / 2} y={tableHeight + offsetY + 50} textAnchor="middle" fill="#666" fontSize={10} style={{ userSelect: 'none' }}>
        {t('table.footer2')}
      </text>
    </svg>
  )
}

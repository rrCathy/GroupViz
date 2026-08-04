import { useMemo, useCallback } from 'react'
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
    forceShowLargeGroupViews,
    setForceShowLargeGroupForView,
    subsets,
    cosetElementMap,
    cosetColors,
    cosetData,
    cosetType,
    showAllCosets,
  } = useGroup()
  const { t } = useTranslation()
  const isLargeTable = currentGroup ? currentGroup.order > 36 : false

  const idToIdx = useMemo(() => {
    if (!currentGroup) return new Map<string, number>()
    const m = new Map<string, number>()
    currentGroup.elements.forEach((el, i) => m.set(el.id, i))
    return m
  }, [currentGroup])

  const labelToIdx = useMemo(() => {
    if (!currentGroup) return new Map<string, number>()
    const m = new Map<string, number>()
    currentGroup.elements.forEach((el, i) => m.set(el.label, i))
    return m
  }, [currentGroup])

  const table = useMemo(() => {
    if (!currentGroup || isLargeTable) return null
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
  }, [currentGroup, isLargeTable])

  const getCell = useCallback((rowIdx: number, colIdx: number) => {
    if (!currentGroup) return null
    return currentGroup.multiply(currentGroup.elements[colIdx], currentGroup.elements[rowIdx])
  }, [currentGroup])

  const visibleIndices = useMemo(() => {
    if (!currentGroup) return [] as number[]
    if (!isLargeTable) return currentGroup.elements.map((_, i) => i)
    const indices = new Set<number>([0])
    for (const id of selectedElements) {
      const idx = idToIdx.get(id)
      if (idx !== undefined && indices.size < 12) indices.add(idx)
    }
    const step = Math.max(1, Math.ceil(currentGroup.order / 12))
    for (let i = 0; i < currentGroup.order; i += step) indices.add(i)
    return [...indices].sort((a, b) => a - b).slice(0, 20)
  }, [currentGroup, isLargeTable, selectedElements, idToIdx])

  const getElementColor = (label: string): string => {
    const idx = labelToIdx.get(label)
    if (idx === undefined) return '#ccc'
    return elementColors[idx % elementColors.length]
  }

  const selectedIndices = useMemo(() => {
    const set = new Set<number>()
    selectedElements.forEach(id => {
      const idx = idToIdx.get(id)
      if (idx !== undefined) set.add(idx)
    })
    return set
  }, [selectedElements, idToIdx])

  const subgroupIndexSets = useMemo(() => {
    if (!currentGroup) return [] as { color: string; indices: Set<number> }[]
    return subsets
      .filter(s => s.isSubgroup)
      .map(s => {
        const indices = new Set<number>()
        s.elementIds.forEach(elId => {
          const idx = idToIdx.get(elId)
          if (idx !== undefined) indices.add(idx)
        })
        return { color: s.color, indices }
      })
  }, [subsets, idToIdx, currentGroup])

  const nonSubgroupSubsetIndices = useMemo(() => {
    const set = new Set<number>()
    for (const subset of subsets) {
      if (subset.isSubgroup) continue
      for (const elId of subset.elementIds) {
        const idx = idToIdx.get(elId)
        if (idx !== undefined) set.add(idx)
      }
    }
    return set
  }, [subsets, idToIdx])

  const subsetElemMap = useMemo(() => {
    const map = new Map<number, { color: string; isSubgroup: boolean }>()
    for (const subset of subsets) {
      for (const elId of subset.elementIds) {
        const idx = idToIdx.get(elId)
        if (idx !== undefined) {
          if (!map.has(idx)) {
            map.set(idx, { color: subset.color, isSubgroup: subset.isSubgroup })
          }
        }
      }
    }
    return map
  }, [subsets, idToIdx])

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

  const cosetSubgroupIndices = useMemo(() => {
    const set = new Set<number>()
    if (!currentGroup || !cosetData) return set
    for (const el of cosetData.subgroup.elements) {
      const idx = idToIdx.get(el.id)
      if (idx !== undefined) set.add(idx)
    }
    return set
  }, [currentGroup, cosetData, idToIdx])

  const cosetActiveRowIds = useMemo(() => {
    if (!currentGroup || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'left' ? cosetData.leftCosets : cosetData.rightCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [currentGroup, cosetData, showAllCosets, cosetType, selectedElements])

  const cosetActiveColIds = useMemo(() => {
    if (!currentGroup || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'right' ? cosetData.rightCosets : cosetData.leftCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [currentGroup, cosetData, showAllCosets, cosetType, selectedElements])

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

  if (isTooLarge(currentGroup.order, 'table') && !forceShowLargeGroupViews.has('table')) {
    return (
      <div className="large-group-warning">
        <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
        <button className="panel-btn" onClick={() => setForceShowLargeGroupForView('table', true)}>
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

  if (isLargeTable) {
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} className="view-svg" style={{ userSelect: 'none' }}>
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          <text x={0} y={0} fill="var(--text-muted)" fontSize={16}>{t('canvas.orderTooLarge', { n: currentGroup.order })}</text>
          <text x={0} y={26} fill="var(--text-subtle)" fontSize={12}>{t('canvas.tableSampled')}</text>
          {visibleIndices.map((rowIdx, ri) => (
            visibleIndices.map((colIdx, ci) => {
              const result = getCell(rowIdx, colIdx)
              if (!result) return null
              return (
                <g key={`${rowIdx}-${colIdx}`} transform={`translate(${ci * cellSize}, ${ri * cellSize + 50})`}>
                  <rect width={cellSize - 2} height={cellSize - 2} fill="#1f293733" stroke="#334155" rx={4} />
                  <text x={cellSize / 2} y={cellSize / 2 + 5} textAnchor="middle" fill="#e5e7eb" fontSize={10}>
                    {result.label}
                  </text>
                </g>
              )
            })
          ))}
        </g>
      </svg>
    )
  }

  const identityIdx = idToIdx.get(currentGroup.identity.id) ?? -1

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="view-svg" style={{ userSelect: 'none' }}>
      <g transform={`translate(${offsetX}, ${offsetY})`}>

        {/* Row headers */}
        {elements.map((rowEl, rowIdx) => {
          const isSelected = selectedIndices.has(rowIdx)
          const sInfo = subsetElemMap.get(rowIdx)
          const inSubgroup = elementsInAnySubgroup.has(rowIdx)
          const cosetMode = cosetData !== null
          const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
          const rowCosetIdx = cosetElementMap.get(rowEl.id)
          const rowCosetHl = rowIsCosetAnchor && rowCosetIdx !== undefined

          let headerFill = elementColors[rowIdx % elementColors.length]
          let bg: string | null = null
          if (!cosetMode && isSelected) bg = '#ffd93d33'
          else if (rowCosetHl) bg = cosetColors[rowCosetIdx] + '33'
          else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
          if (!cosetMode && isSelected) headerFill = '#ffd93d'

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
          const cosetMode = cosetData !== null
          const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)
          const colCosetIdx = cosetElementMap.get(colEl.id)
          const colCosetHl = colIsCosetAnchor && colCosetIdx !== undefined

          let headerFill = elementColors[colIdx % elementColors.length]
          let bg: string | null = null
          if (!cosetMode && isSelected) bg = '#ffd93d33'
          else if (colCosetHl) bg = cosetColors[colCosetIdx] + '33'
          else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
          if (!cosetMode && isSelected) headerFill = '#ffd93d'

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

            const colInSubgroup = cosetSubgroupIndices.has(colIdx)
            const rowInSubgroup = cosetSubgroupIndices.has(rowIdx)
            const cosetMode = cosetData !== null
            const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
            const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)

            const isLeftCosetCell = cosetType === 'left' && rowIsCosetAnchor && colInSubgroup
            const isRightCosetCell = cosetType === 'right' && colIsCosetAnchor && rowInSubgroup
            const isCosetCell = isLeftCosetCell || isRightCosetCell

            let cellFill = resultColor + '22'
            let cellStroke = resultColor
            let cellStrokeW = 0.5

            if (isCosetCell) {
              const elId = cosetType === 'left' ? rowEl.id : colEl.id
              const cIdx = cosetElementMap.get(elId)
              const cColor = cIdx !== undefined ? cosetColors[cIdx] : '#888'
              cellFill = cColor + '40'
              cellStroke = cColor
              cellStrokeW = 2.5
            } else if (sgColor) {
              cellFill = sgColor + '28'
              cellStroke = sgColor
              cellStrokeW = 2
            } else if (!cosetMode && isRowSel && isColSel) {
              cellFill = '#ffd93d22'
              cellStroke = '#ffd93d'
              cellStrokeW = 2
            } else if (!cosetMode && (isRowSel || isColSel)) {
              cellFill = '#ffd93d15'
              cellStroke = '#ffd93d88'
              cellStrokeW = 1
            } else if (nonSubRow || nonSubCol) {
              cellFill = 'var(--table-cell-bg)'
              cellStroke = 'var(--table-cell-border)'
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

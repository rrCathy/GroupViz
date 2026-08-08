import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { presentationOf, formatPresentation } from '../../core/algebra/presentations'
import { isTooLarge } from '../../core/viewBox'

const elementColors = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6',
  '#3498db', '#e67e22', '#1abc9c', '#e74c3c', '#2ecc71',
  '#f39c12', '#8e44ad', '#3071a9', '#d35400', '#c0392b',
]

export function PresentationTableView() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    setHoverElement,
    viewBoxSize,
    forceShowLargeGroupViews,
    setForceShowLargeGroupForView,
  } = useGroup()
  const { t } = useTranslation()

  const pres = useMemo(() => {
    if (!currentGroup) return null
    try {
      return presentationOf(currentGroup)
    } catch {
      return null
    }
  }, [currentGroup])

  const idToIdx = useMemo(() => {
    if (!currentGroup) return new Map<string, number>()
    const m = new Map<string, number>()
    currentGroup.elements.forEach((el, i) => m.set(el.id, i))
    return m
  }, [currentGroup])

  const isLargeTable = useMemo(() => (currentGroup ? currentGroup.order > 36 : false), [currentGroup])

  const visibleIndices = useMemo(() => {
    if (!currentGroup || !isLargeTable) return currentGroup ? currentGroup.elements.map((_, i) => i) : [] as number[]
    const indices = new Set<number>([0])
    for (const id of selectedElements) {
      const idx = idToIdx.get(id)
      if (idx !== undefined && indices.size < 12) indices.add(idx)
    }
    const step = Math.max(1, Math.ceil(currentGroup.order / 12))
    for (let i = 0; i < currentGroup.order; i += step) indices.add(i)
    return [...indices].sort((a, b) => a - b).slice(0, 20)
  }, [currentGroup, isLargeTable, selectedElements, idToIdx])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  if (!pres || pres.relators.length === 0) {
    return (
      <div className="view-empty">
        <p>{t('prestable.noPresentation')}</p>
      </div>
    )
  }

  if (isTooLarge(currentGroup.order, 'prestable') && !forceShowLargeGroupViews.has('prestable')) {
    return (
      <div className="large-group-warning">
        <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
        <button className="panel-btn" onClick={() => setForceShowLargeGroupForView('prestable', true)}>
          {t('canvas.show')}
        </button>
      </div>
    )
  }

  const { elements, multiply } = currentGroup

  const cellSize = 50
  const gridN = isLargeTable ? visibleIndices.length : elements.length
  const tableWidth = gridN * cellSize
  const tableHeight = gridN * cellSize
  const vw = viewBoxSize.width
  const vh = viewBoxSize.height
  const offsetX = vw / 2 - tableWidth / 2
  const offsetY = vh / 2 - tableHeight / 2

  return (
    <>
      <div className="relator-bar">
        <span className="relator-bar-title">
          <span dangerouslySetInnerHTML={{ __html: renderTex(texify(formatPresentation(pres.generators, pres.relators))) }} />
        </span>
      </div>
      <svg viewBox={`0 0 ${vw} ${vh}`} className="view-svg" style={{ userSelect: 'none' }}>
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {isLargeTable && (
            <text x={0} y={0} fill="var(--text-muted)" fontSize={16}>{t('canvas.tableSampled')}</text>
          )}

          {visibleIndices.map((ri, rr) => {
            const el = elements[ri]
            const isSel = selectedElements.has(el.id)
            return (
              <g key={el.id} transform={`translate(0, ${rr * cellSize})`} onClick={() => selectElement(el.id, true)} style={{ cursor: 'pointer' }}>
                <text
                  x={-35}
                  y={cellSize / 2 + 5}
                  textAnchor="end"
                  fill={isSel ? '#ffd93d' : elementColors[ri % elementColors.length]}
                  fontSize={14}
                  fontFamily="serif"
                  fontWeight={isSel ? 'bold' : 'normal'}
                  style={{ userSelect: 'none' }}
                >
                  {el.label}
                </text>
              </g>
            )
          })}
          {visibleIndices.map((ci, cc) => {
            const el = elements[ci]
            const isSel = selectedElements.has(el.id)
            return (
              <g key={`head-${el.id}`} onClick={() => selectElement(el.id, true)} style={{ cursor: 'pointer' }}>
                <text
                  x={cc * cellSize + cellSize / 2}
                  y={-12}
                  textAnchor="middle"
                  fill={isSel ? '#ffd93d' : elementColors[ci % elementColors.length]}
                  fontSize={14}
                  fontFamily="serif"
                  fontWeight={isSel ? 'bold' : 'normal'}
                  style={{ userSelect: 'none' }}
                >
                  {el.label}
                </text>
              </g>
            )
          })}

          {visibleIndices.map((ri, rr) =>
            visibleIndices.map((ci, cc) => {
              const result = multiply(elements[ci], elements[ri])
              const resultIdx = idToIdx.get(result.id) ?? -1
              const resColor = elementColors[resultIdx % elementColors.length]

              return (
                <g
                  key={`${elements[ri].id}-${elements[ci].id}`}
                  transform={`translate(${cc * cellSize}, ${rr * cellSize})`}
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
                  <rect width={cellSize - 2} height={cellSize - 2} fill={resColor + '22'} stroke={resColor} strokeWidth={0.5} rx={4} />
                  <text
                    x={cellSize / 2}
                    y={cellSize / 2 + 5}
                    textAnchor="middle"
                    fill={resColor}
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
      </svg>
    </>
  )
}

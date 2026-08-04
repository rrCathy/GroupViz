import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { cosetStripLayout } from '../../core/algebra/forceLayout'
import { renderTex, texify } from '../../utils/texify'
import type { CosetStripInfo } from '../../core/algebra/forceLayout'

export function CosetStripView() {
  const { t } = useTranslation()
  const {
    currentGroup,
    selectedElements,
    selectElement,
    setHoverElement,
    canvasTransform,
    cosetElementMap,
    cosetColors,
    cosetHighlightSet,
    viewBoxSize,
    subsets,
  } = useGroup()

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, typeof subsets[0]>()
    subsets.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const cosetStripData = useMemo(() => {
    if (!currentGroup) return null
    if (!cosetElementMap || cosetElementMap.size === 0) return null
    return cosetStripLayout(
      currentGroup,
      viewBoxSize.width,
      viewBoxSize.height,
      undefined,
      cosetElementMap,
      new Set(cosetElementMap.values()).size,
      cosetColors,
    )
  }, [currentGroup, viewBoxSize.width, viewBoxSize.height, cosetElementMap, cosetColors])

  const nodeRadius = 28
  const NO_GROUP = !currentGroup

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id="cs-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>

      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {cosetStripData && cosetStripData.strips.length > 0 && cosetStripData.strips.map((strip: CosetStripInfo, si: number) => (
          <g key={`coset-bg-${si}`}>
            <rect
              x={strip.x}
              y={strip.y}
              width={strip.w}
              height={strip.h}
              rx={8}
              fill={strip.color + (strip.isSubgroup ? '18' : '10')}
              stroke={strip.isSubgroup ? strip.color + '55' : strip.color + '28'}
              strokeWidth={strip.isSubgroup ? 2 : 1}
              strokeDasharray={strip.isSubgroup ? undefined : '4 6'}
            />
            <text
              x={strip.x + strip.w / 2}
              y={strip.y - 10}
              textAnchor="middle"
              fill={strip.color}
              fontSize={13}
              fontWeight={strip.isSubgroup ? 700 : 400}
              opacity={0.85}
              style={{ fontFamily: 'KaTeX_Main, monospace', fontStyle: 'italic' }}
            >{strip.label}</text>
          </g>
        ))}

        {cosetStripData && cosetStripData.strips.length > 0 && (
          (() => {
            const shSize = cosetStripData.strips[0]?.elementIds.length || 0
            const n = currentGroup!.order
            const index = cosetStripData.strips.length
            return (
              <text
                x={viewBoxSize.width / 2}
                y={viewBoxSize.height - 14}
                textAnchor="middle"
                fill="#999"
                fontSize={12}
                opacity={0.7}
                style={{ fontFamily: 'KaTeX_Main, monospace' }}
              >{`|G|=${n} = ${shSize}\u00b7${index}   |H|\u00b7[G:H]`}</text>
            )
          })()
        )}

        {cosetStripData && currentGroup && currentGroup.elements.map((el) => {
          const pos = cosetStripData.positions.get(el.id)
          if (!pos) return null
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
                filter="url(#cs-node-shadow)"
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {isInHighlightedCoset && cosetIdx !== undefined && (
                <circle
                  r={nodeRadius}
                  fill={`${cosetColors[cosetIdx]}22`}
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
                    width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '15px'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderTex(texify(el.label))
                  }}
                />
              </foreignObject>
            </g>
          )
        })}

        {NO_GROUP && (
          <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="18">
            {t('canvas.cosetStripNoSubgroup')}
          </text>
        )}

        {currentGroup && (!cosetStripData || cosetStripData.strips.length === 0) && (
          <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="18">
            {t('canvas.cosetStripNoCosets')}
          </text>
        )}
      </g>
    </svg>
  )
}

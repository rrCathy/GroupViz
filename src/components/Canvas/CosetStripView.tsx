import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { cosetStripLayout, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { findMinimalGenerators } from '../../core/algebra/sylow'
import { renderTex, texify } from '../../utils/texify'
import type { CosetStripInfo } from '../../core/algebra/forceLayout'
import { COLOR_PALETTE } from '../../core/types'

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

  const subgroupInfo = useMemo(() => {
    if (!cosetElementMap || cosetElementMap.size === 0) return null
    let hSize = 0
    for (const ci of cosetElementMap.values()) { if (ci === 0) hSize++ }
    if (hSize < 2 || hSize > 12) return null
    const r = Math.max(40, Math.min(96, hSize * 16))
    return { hSize, r, topPad: 2 * r + 64 }
  }, [cosetElementMap])

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
      subgroupInfo ? subgroupInfo.topPad : undefined,
    )
  }, [currentGroup, viewBoxSize.width, viewBoxSize.height, cosetElementMap, cosetColors, subgroupInfo])

  const subgroupCayley = useMemo(() => {
    if (!currentGroup || !cosetElementMap || cosetElementMap.size === 0) return null
    const hIds: string[] = []
    for (const [id, ci] of cosetElementMap) { if (ci === 0) hIds.push(id) }
    if (hIds.length < 2 || hIds.length > 12) return null
    const hIdSet = new Set(hIds)
    const hElements = currentGroup.elements.filter(el => hIdSet.has(el.id))
    const hGenerators = findMinimalGenerators(hElements, currentGroup)
    if (hGenerators.length === 0) return null
    const genIndex = new Map<string, number>()
    const actions = hGenerators.map((g, i) => {
      genIndex.set(g.id, i)
      return { elementId: g.id, enabled: true, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }
    })
    const edges = computeCayleyActionEdges(currentGroup, actions, 'right')
      .filter(e => !e.isSelfLoop && hIdSet.has(e.fromId) && hIdSet.has(e.toId))
    return { hIdSet, hElements, hGenerators, genIndex, edges }
  }, [currentGroup, cosetElementMap])

  const nodeRadius = 28
  const NO_GROUP = !currentGroup

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id="cs-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {subgroupCayley && subgroupCayley.hGenerators.map((g, i) => (
          <marker key={g.id} id={`cs-cayley-arrow-${i}`} markerWidth={13} markerHeight={13} refX={10} refY={6.5} orient="auto">
            <path d="M0,0 L13,6.5 L0,13 Z" fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
          </marker>
        ))}
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

          {subgroupCayley && cosetStripData && cosetStripData.strips[0] && subgroupInfo && (() => {
          const strip = cosetStripData.strips[0]
          const cx = strip.x + strip.w / 2
          const cy = strip.y - subgroupInfo.r - 24
          const hGroup = { ...currentGroup!, order: subgroupInfo.hSize, elements: subgroupCayley.hElements }
          const positions = cayleyCircleLayout(hGroup, cx, cy, subgroupInfo.r)
          const maxLabelLen = Math.max(...subgroupCayley.hElements.map(el => el.label.length))
          const labelFs = maxLabelLen <= 4 ? 15 : maxLabelLen <= 6 ? 13 : maxLabelLen <= 8 ? 11 : 9.5
          const hNodeR = Math.max(16, Math.min((maxLabelLen * labelFs * 0.62 + 10) / 2, subgroupInfo.r * 0.85))
          return (
            <g key="subgroup-cayley">
              <text
                x={cx}
                y={cy - subgroupInfo.r - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize={13}
                fontFamily="KaTeX_Main, monospace"
              >{t('canvas.cosetStripCayley')}</text>
              {subgroupCayley.edges.map(edge => {
                const fp = positions.get(edge.fromId)
                const tp = positions.get(edge.toId)
                if (!fp || !tp) return null
                const gi = subgroupCayley.genIndex.get(edge.actionElementId) ?? 0
                return (
                  <line
                    key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
                    x1={fp.x}
                    y1={fp.y}
                    x2={tp.x}
                    y2={tp.y}
                    stroke={edge.color}
                    strokeWidth={2.2}
                    opacity={0.9}
                    markerEnd={edge.isBidirectional ? undefined : `url(#cs-cayley-arrow-${gi})`}
                  />
                )
              })}
              {subgroupCayley.hElements.map(el => {
                const p = positions.get(el.id)
                if (!p) return null
                return (
                  <g key={`h-cayley-${el.id}`} transform={`translate(${p.x}, ${p.y})`}>
                    <circle
                      r={hNodeR}
                      fill="var(--node-fill)"
                      stroke={el.id === currentGroup!.identity.id ? '#ffd93d' : 'var(--node-stroke)'}
                      strokeWidth={1.8}
                    />
                    <foreignObject
                      x={-hNodeR}
                      y={-hNodeR}
                      width={hNodeR * 2}
                      height={hNodeR * 2}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', height: '100%', color: 'var(--node-text)', fontSize: `${labelFs}px`
                        }}
                        dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
                      />
                    </foreignObject>
                  </g>
                )
              })}
            </g>
          )
        })()}

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
                    width: '100%', height: '100%', color: 'var(--node-text)',
                    fontSize: el.label.length <= 4 ? '15px' : el.label.length <= 6 ? '13px' : '10px'
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

import { useId, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import { cosetStripLayout, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { findMinimalGenerators } from '../../core/algebra/sylow'
import { renderTex, texify } from '../../utils/texify'
import type { CosetStripInfo } from '../../core/algebra/forceLayout'
import { COLOR_PALETTE } from '../../core/types'
import type { Group, GroupElement } from '../../core/types'

// ─── Coset Strip props-化内核 ──────────────────────────────────────────
// 受控 ViewWindow (FGVE) 与主画布（经 context 壳）共用。除 group / viewBoxSize 外
// 全部可选：主画布壳由全局 Provider 组装装饰数据（陪集/子集高亮、选中、变换），
// 窗口引擎自包含时只传 group + 由 H 派生的陪集数据，其余缺省即安全空值。

export interface CosetStripSceneProps {
  group: Group | null
  selectedElements?: Set<string>
  canvasTransform?: { x: number; y: number; scale: number }
  viewBoxSize: { width: number; height: number }
  /** 元素 → 陪集下标（与 SetView 同约定）。缺省空 Map 显示空态文案 */
  cosetElementMap?: Map<string, number> | null
  /** 每条陪集的条带颜色 */
  cosetColors?: string[]
  /** 被高亮的陪集下标集合（点击选中元素 → 其所在陪集） */
  cosetHighlightSet?: Set<number>
  /** 已保存子集（元素集合 + 颜色），命中元素描边用子集色 */
  subsets?: Array<{ elementIds: string[]; color: string }>
  /** 节点常驻标签；缺省 true（主画布行为）；嵌入窗口默认关，读元素靠 hover */
  showLabels?: boolean
  /** H 条带上方的 H-Cayley 小圈；缺省 true（主画布行为），嵌入窗口默认关省空间 */
  showSubgroupCayley?: boolean
  /** 点击节点：缺省无操作（主画布壳接全局选中，窗口引擎自己维护会话态） */
  onSelect?: (elId: string, additive: boolean) => void
  /** 悬停节点：主画布走全局 Hover，窗口经 anchor 就地气泡 */
  onHover?: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  noGroupText?: string
  /** 有群但无陪集数据时的文案（缺省 i18n canvas.cosetStripNoCosets，主应用语境）；
   *  窗口引擎可传自定义提示（如本地枚举上限） */
  noCosetsText?: string
}

export function CosetStripScene({
  group,
  selectedElements,
  canvasTransform,
  viewBoxSize,
  cosetElementMap,
  cosetColors,
  cosetHighlightSet,
  subsets,
  showLabels = true,
  showSubgroupCayley = true,
  onSelect,
  onHover,
  noGroupText,
  noCosetsText,
}: CosetStripSceneProps) {
  const { t } = useTranslation()
  // 多实例（主画布 + 多窗口）并存时避免 marker/filter id 冲突
  const uid = useId()
  const shadowId = `${uid}-cs-node-shadow`
  const arrowId = (i: number) => `${uid}-cs-cayley-arrow-${i}`

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, { color: string }>()
    ;(subsets ?? []).forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const subgroupInfo = useMemo(() => {
    if (!group || !cosetElementMap || cosetElementMap.size === 0) return null
    // The subgroup is the coset containing the identity (eH = H); coset index 0
    // may correspond to any coset depending on group element ordering.
    const hCi = cosetElementMap.get(group.identity.id)
    if (hCi === undefined) return null
    let hSize = 0
    for (const ci of cosetElementMap.values()) { if (ci === hCi) hSize++ }
    if (hSize < 2 || hSize > 12) return null
    const r = Math.max(40, Math.min(96, hSize * 16))
    return { hSize, r, topPad: 2 * r + 64 }
  }, [group, cosetElementMap])

  const cosetStripData = useMemo(() => {
    if (!group) return null
    if (!cosetElementMap || cosetElementMap.size === 0) return null
    return cosetStripLayout(
      group,
      viewBoxSize.width,
      viewBoxSize.height,
      undefined,
      cosetElementMap,
      new Set(cosetElementMap.values()).size,
      cosetColors,
      subgroupInfo && showSubgroupCayley ? subgroupInfo.topPad : undefined,
    )
  }, [group, viewBoxSize.width, viewBoxSize.height, cosetElementMap, cosetColors, subgroupInfo, showSubgroupCayley])

  const subgroupCayley = useMemo(() => {
    if (!group || !cosetElementMap || cosetElementMap.size === 0) return null
    if (!showSubgroupCayley) return null
    // Same coset-of-identity logic as subgroupInfo: the subgroup H is the coset eH.
    const hCi = cosetElementMap.get(group.identity.id)
    if (hCi === undefined) return null
    const hIds: string[] = []
    for (const [id, ci] of cosetElementMap) { if (ci === hCi) hIds.push(id) }
    if (hIds.length < 2 || hIds.length > 12) return null
    const hIdSet = new Set(hIds)
    const hElements = group.elements.filter(el => hIdSet.has(el.id))
    const hGenerators = findMinimalGenerators(hElements, group)
    if (hGenerators.length === 0) return null
    const genIndex = new Map<string, number>()
    const actions = hGenerators.map((g, i) => {
      genIndex.set(g.id, i)
      return { elementId: g.id, enabled: true, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }
    })
    const edges = computeCayleyActionEdges(group, actions, 'right')
      .filter(e => !e.isSelfLoop && hIdSet.has(e.fromId) && hIdSet.has(e.toId))
    return { hIdSet, hElements, hGenerators, genIndex, edges }
  }, [group, cosetElementMap, showSubgroupCayley])

  const nodeRadius = useMemo(() => {
    if (!group) return 28
    const maxLen = Math.max(...group.elements.map(el => el.label.length))
    if (maxLen > 15) return 20
    if (maxLen > 8) return 24
    return 28
  }, [group])
  const NO_GROUP = !group

  const handleHover = (el: GroupElement | null, anchor?: { x: number; y: number } | null) => {
    if (onHover) onHover(el, anchor)
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {subgroupCayley && subgroupCayley.hGenerators.map((g, i) => (
          <marker key={g.id} id={arrowId(i)} markerWidth={13} markerHeight={13} refX={10} refY={6.5} orient="auto">
            <path d="M0,0 L13,6.5 L0,13 Z" fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
          </marker>
        ))}
      </defs>

      <g transform={`translate(${canvasTransform?.x ?? 0}, ${canvasTransform?.y ?? 0}) scale(${canvasTransform?.scale ?? 1})`}>
        {cosetStripData && cosetStripData.strips.length > 0 && cosetStripData.strips.map((strip: CosetStripInfo, si: number) => (
          <g key={`coset-bg-${si}`} data-coset-strip={si}>
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

          {subgroupCayley && cosetStripData && cosetStripData.strips[0] && subgroupInfo && group && (() => {
          const strip = cosetStripData.strips[0]
          const cx = strip.x + strip.w / 2
          const cy = strip.y - subgroupInfo.r - 24
          const hGroup = { ...group, order: subgroupInfo.hSize, elements: subgroupCayley.hElements }
          const positions = cayleyCircleLayout(hGroup, cx, cy, subgroupInfo.r)
          const maxLabelLen = Math.max(...subgroupCayley.hElements.map(el => {
            const l = el.label
            if (l.startsWith('\\begin{smallmatrix}')) return 4
            return l.length
          }))
          const labelFs = maxLabelLen <= 4 ? 15 : maxLabelLen <= 6 ? 13 : maxLabelLen <= 8 ? 11 : 9.5
          const hNodeR = Math.max(12, Math.min((maxLabelLen * labelFs * 0.62 + 10) / 2, subgroupInfo.r * 0.35))
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
                    markerEnd={edge.isBidirectional ? undefined : `url(#${arrowId(gi)})`}
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
                      stroke={el.id === group.identity.id ? '#ffd93d' : 'var(--node-stroke)'}
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

        {cosetStripData && cosetStripData.strips.length > 0 && group && (
          (() => {
            const shSize = cosetStripData.strips[0]?.elementIds.length || 0
            const n = group.order
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

        {cosetStripData && group && group.elements.map((el) => {
          const pos = cosetStripData.positions.get(el.id)
          if (!pos) return null
          const isSelected = selectedElements?.has(el.id) ?? false
          const parentSubset = subsetDetailMap.get(el.id)
          const cosetIdx = cosetElementMap?.get(el.id)
          const isInHighlightedCoset = cosetIdx !== undefined && (cosetHighlightSet?.has(cosetIdx) ?? false)

          let fillColor = 'var(--node-fill)'
          let strokeColor = 'var(--node-stroke)'
          let strokeWidth = 2.5

          if (isSelected) {
            fillColor = 'var(--node-fill-selected)'
            strokeColor = '#ffd93d'
            strokeWidth = 3
          } else if (isInHighlightedCoset && cosetIdx !== undefined && cosetColors) {
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
              data-coset-node={el.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={(e) => {
                e.stopPropagation()
                if (onSelect) onSelect(el.id, e.ctrlKey || e.metaKey)
              }}
              onMouseEnter={() => {
                // anchor 用世界→视口换算（与 CycleView 同约定）：窗口 hover 气泡据此定位
                const s = canvasTransform?.scale ?? 1
                handleHover(el, {
                  x: pos.x * s + (canvasTransform?.x ?? 0),
                  y: pos.y * s + (canvasTransform?.y ?? 0),
                })
              }}
              onMouseLeave={() => handleHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={nodeRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                filter="url(#${shadowId})"
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {isInHighlightedCoset && cosetIdx !== undefined && cosetColors && (
                <circle
                  r={nodeRadius}
                  fill={`${cosetColors[cosetIdx]}22`}
                  stroke="none"
                />
              )}
              {showLabels && (
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
              )}
            </g>
          )
        })}

        {NO_GROUP && (
          <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="18">
            {noGroupText ?? t('canvas.cosetStripNoSubgroup')}
          </text>
        )}

        {group && (!cosetStripData || cosetStripData.strips.length === 0) && (
          <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="18">
            {noCosetsText ?? t('canvas.cosetStripNoCosets')}
          </text>
        )}
      </g>
    </svg>
  )
}

// ─── context 组装壳（主画布 / 老浮动窗口零改动）─────────────────────────
export function CosetStripView() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    canvasTransform,
    cosetElementMap,
    cosetColors,
    cosetHighlightSet,
    viewBoxSize,
    subsets,
  } = useGroup()
  const { setHoverElement } = useHover()
  const subsetMap = useMemo(
    () => (subsets ?? []).map(({ elementIds, color }) => ({ elementIds, color })),
    [subsets]
  )
  return (
    <CosetStripScene
      group={currentGroup}
      selectedElements={selectedElements}
      canvasTransform={canvasTransform}
      viewBoxSize={viewBoxSize}
      cosetElementMap={cosetElementMap}
      cosetColors={cosetColors}
      cosetHighlightSet={cosetHighlightSet}
      subsets={subsetMap}
      showLabels={true}
      showSubgroupCayley={true}
      onSelect={selectElement}
      onHover={setHoverElement}
    />
  )
}

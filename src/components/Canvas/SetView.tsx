import { useMemo } from 'react'
import { SceneThemeRoot, type SceneTheme } from './SceneThemeRoot'
import { texify, renderTex } from '../../utils/texify'
import type { Group } from '../../core/types'
import { isQuotientGroup } from '../../core/types'
import { INTERACTIVE_LIMIT } from '../../core/guards'
import { QuotientSubgroupInset } from './QuotientSubgroupInset'
import { quotientInsetGeometry } from '../../core/viewBox'

export interface SetViewProps {
  group: Group | null
  selectedElements: Set<string>
  canvasTransform: { x: number; y: number; scale: number }
  viewBoxSize: { width: number; height: number }
  subsets?: Array<{ elementIds: string[]; color: string }>
  selfInverseElementId?: string | null
  cosetElementMap?: Map<string, number>
  cosetHighlightSet?: Set<number>
  cosetColors?: string[]
  onSelect?: (elId: string, additive: boolean) => void
  onHover?: (el: Group['elements'][number] | null, anchor?: { x: number; y: number } | null) => void
  noGroupText?: string
  nodeRadius?: number
  gap?: number
  columns?: number
  showLabels?: boolean
  /** 节点标签自适应阈值：`group.order > 该值` 时仅选中节点显示常驻标签；缺省 60（主画布规则） */
  largeGroupThreshold?: number
  /** 视图主题作用域（`'dark' | 'light'`）。缺省不注入、跟随外层主题；显式传值时在本子树内
   *  应用 `theme.css` 对应变量块（需宿主已 `import '@groupviz/react/theme.css'`） */
  theme?: SceneTheme
  /** 商群视图里「正规子群 N 的凯莱图」面板标题（宿主本地化文案；缺省只画记号 N） */
  quotientInsetTitle?: string
}

export function SetView(props: SetViewProps) {
  return (
    <SceneThemeRoot theme={props.theme}>
      <SetViewBody {...props} />
    </SceneThemeRoot>
  )
}

function SetViewBody({
  group,
  selectedElements,
  canvasTransform,
  viewBoxSize,
  subsets,
  selfInverseElementId,
  cosetElementMap,
  cosetHighlightSet,
  cosetColors,
  onSelect,
  onHover,
  noGroupText,
  nodeRadius: nodeRadiusOverride,
  gap: gapOverride,
  columns: columnsOverride,
  showLabels: showLabelsOverride,
  largeGroupThreshold = INTERACTIVE_LIMIT,
  quotientInsetTitle,
}: SetViewProps) {
  type SubsetView = { elementIds: string[]; color: string }
  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, SubsetView>()
    subsets?.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  // KaTeX 标签 HTML 开销大：每群只渲染一次（与 CayleyView 的 labelHtmlCache 一致）
  const labelHtmlCache = useMemo(() => {
    const m = new Map<string, string>()
    group?.elements.forEach(el => m.set(el.id, renderTex(texify(el.label))))
    return m
  }, [group])

  const cosetPalette = cosetColors ?? []

  if (!group) {
    return (
      <div className="view-empty">
        <p>{noGroupText ?? ''}</p>
      </div>
    )
  }

  const isLarge = group.order > largeGroupThreshold
  // 商群：节点半径走常规值（旧的复合节点用 72 才塞得下成员小点），
  // 正规子群 N 的凯莱图改为右侧独立面板（见 QuotientSubgroupInset）
  const insetGeom = isQuotientGroup(group) ? quotientInsetGeometry(viewBoxSize) : null
  const showInset = !!insetGeom && (group.identity.cosetMemberLabels?.length ?? 0) > 1
  const drawWidth = insetGeom?.drawWidth ?? viewBoxSize.width
  const nodeRadius = nodeRadiusOverride ?? 26
  const gap = gapOverride ?? 8
  const cellSize = nodeRadius * 2 + gap
  const cols = columnsOverride
    ? columnsOverride > 0 ? columnsOverride : Math.ceil(Math.sqrt(group.order))
    : Math.ceil(Math.sqrt(group.order))
  const rows = group.order / cols
  const totalWidth = cols * cellSize
  const totalHeight = rows * cellSize
  const startX = Math.max(nodeRadius, (drawWidth - totalWidth) / 2 + cellSize / 2)
  const startY = Math.max(nodeRadius, (viewBoxSize.height - totalHeight) / 2 + cellSize / 2)

  const getPos = (_elId: string, index: number) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      x: startX + col * cellSize,
      y: startY + row * cellSize
    }
  }

  // 恒等陪集节点（= N）的屏幕位置：指针线从这里拉到右侧面板
  const identityIndex = group.elements.findIndex(e => e.id === group.identity.id)
  const identityPos = getPos(group.identity.id, identityIndex < 0 ? 0 : identityIndex)
  const identityScreen = {
    x: identityPos.x * canvasTransform.scale + canvasTransform.x,
    y: identityPos.y * canvasTransform.scale + canvasTransform.y,
  }

  // Viewport culling for large groups — skip off-screen nodes
  const isNodeOnScreen = (px: number, py: number) => {
    if (!isLarge) return true
    const sx = px * canvasTransform.scale + canvasTransform.x
    const sy = py * canvasTransform.scale + canvasTransform.y
    const m = nodeRadius * canvasTransform.scale * 1.5
    return sx + m > 0 && sx - m < viewBoxSize.width &&
           sy + m > 0 && sy - m < viewBoxSize.height
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      {!isLarge && (
        <defs>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {group.elements.map((el, i) => {
          const pos = getPos(el.id, i)
          if (!isNodeOnScreen(pos.x, pos.y)) return null
          const isSelected = selectedElements.has(el.id)
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
          } else if (isInHighlightedCoset && cosetIdx !== undefined && cosetPalette[cosetIdx]) {
            fillColor = cosetPalette[cosetIdx] + '33'
            strokeColor = cosetPalette[cosetIdx]
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
                onSelect?.(el.id, e.ctrlKey || e.metaKey)
              }}
              onMouseEnter={() => onHover?.(el, { x: pos.x * canvasTransform.scale + canvasTransform.x, y: pos.y * canvasTransform.scale + canvasTransform.y })}
              onMouseLeave={() => onHover?.(null, null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={nodeRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                filter={isLarge ? undefined : "url(#node-shadow)"}
              />
              {isInHighlightedCoset && cosetIdx !== undefined && cosetPalette[cosetIdx] && (
                <circle
                  r={nodeRadius}
                  fill={`${cosetPalette[cosetIdx]}22`}
                  stroke="none"
                />
              )}
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {showLabelsOverride !== false && (!isLarge || isSelected || selectedElements.size === 0) && (
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
                      width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLarge ? '10px' : '15px'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: labelHtmlCache.get(el.id) ?? ''
                    }}
                  />
                </foreignObject>
              )}
                {selfInverseElementId === el.id && (
                 <g>
                   <circle r={nodeRadius + 6} fill="none" stroke="#ffd93d" strokeWidth={2.5} strokeDasharray="6 3" opacity={0.85}>
                     <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
                   </circle>
                   <path
                     d={`M ${nodeRadius + 3},-8 L ${nodeRadius + 14},-5 L ${nodeRadius + 10},-1`}
                     fill="#ffd93d"
                     opacity={0.85}
                   />
                 </g>
               )}
            </g>
          )
        })}
      </g>
      {showInset && insetGeom && (
        <QuotientSubgroupInset
          group={group}
          anchor={identityScreen}
          anchorRadius={nodeRadius * canvasTransform.scale}
          geometry={insetGeom}
          title={quotientInsetTitle}
        />
      )}
    </svg>
  )
}

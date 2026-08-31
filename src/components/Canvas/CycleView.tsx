import { useCallback, useMemo, useState } from 'react'
import { cycleGraphLayout } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import type { CanvasTransform, Group, GroupElement, NodePosition } from '../../core/types'

export interface CycleViewProps {
  group: Group | null
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  viewBoxSize: { width: number; height: number }
  /** 缺省 false（显示全部循环子群）；true 时仅显示极大循环并启用 planar 布局 */
  showMaximalCycles?: boolean
  /** 节点半径；缺省 24 */
  nodeRadius?: number
  /** 是否显示节点标签；缺省 true（>60 阶自适应） */
  showLabels?: boolean
  /** 是否显示每个循环的 ⟨g⟩ ≅ Z_n 标注；缺省 true */
  showCycleLabels?: boolean
  /** 缺省 false；true 时禁用节点拖拽（供 ViewWindow 锁定状态使用，点击选中仍保留） */
  locked?: boolean
  /** 子集着色（子集→元素映射）；缺省空 */
  subsets?: Array<{ elementIds: string[]; color: string }>
  selfInverseElementId?: string | null
  cosetElementMap?: Map<string, number>
  cosetHighlightSet?: Set<number>
  cosetColors?: string[]
  /** 外部持久化节点位置（主画布共享位置）；缺省使用本地拖拽态 */
  getNodePosition?: (elId: string) => NodePosition | undefined
  /** 拖拽回写节点位置；缺省写入本地拖拽态 */
  onNodePositionChange?: (elId: string, x: number, y: number) => void
  onSelect?: (elId: string, additive: boolean) => void
  onHover?: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  noGroupText?: string
}

interface CycleEntry {
  generatorId: string
  generatorLabel: string
  elements: { id: string; label: string }[]
  order: number
}

// 每实例唯一前缀：同一文档内多个窗口 + 主画布的 <defs> filter id 不冲突
let _cycleViewInst = 0

const CYCLE_COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6', '#3498db', '#e67e22']

export function CycleView({
  group,
  selectedElements,
  canvasTransform,
  viewBoxSize,
  showMaximalCycles = true,
  nodeRadius = 24,
  showLabels = true,
  showCycleLabels = true,
  locked = false,
  subsets,
  selfInverseElementId,
  cosetElementMap,
  cosetHighlightSet,
  cosetColors,
  getNodePosition,
  onNodePositionChange,
  onSelect,
  onHover,
  noGroupText,
}: CycleViewProps) {
  // 惰性初始化的每实例唯一前缀（useState 初始化器每实例只执行一次）
  const [filterPrefix] = useState(() => `cyv${++_cycleViewInst}`)

  // 本地拖拽覆盖位置（ViewWindow 无外部存储时使用）
  const posKey = group ? `${group.symbol}|${group.order}|${showMaximalCycles}` : ''
  const [dragState, setDragState] = useState<{ key: string; map: Map<string, NodePosition> }>({
    key: posKey,
    map: new Map(),
  })
  if (dragState.key !== posKey) {
    setDragState({ key: posKey, map: new Map() })
  }
  const localDragPositions = useMemo(
    () => (dragState.key === posKey ? dragState.map : new Map<string, NodePosition>()),
    [dragState, posKey],
  )
  const setLocalDragPosition = useCallback((elId: string, pos: NodePosition) => {
    setDragState(prev => {
      if (prev.key !== posKey) return prev
      const map = new Map(prev.map)
      map.set(elId, pos)
      return { key: prev.key, map }
    })
  }, [posKey])

  const cycles = useMemo<CycleEntry[]>(() => {
    if (!group) return []

    const allCycles: CycleEntry[] = []
    const visitedKeys = new Set<string>()

    for (const el of group.elements) {
      const subgroup: { id: string; label: string }[] = []
      const seen = new Set<string>()
      let current = el

      while (!seen.has(current.id)) {
        seen.add(current.id)
        subgroup.push({ id: current.id, label: current.label })
        current = group.multiply(current, el)
      }

      if (subgroup.length > 1) {
        const key = subgroup.map(e => e.id).sort().join(',')
        if (!visitedKeys.has(key)) {
          visitedKeys.add(key)
          allCycles.push({
            generatorId: el.id,
            generatorLabel: el.label,
            elements: subgroup,
            order: subgroup.length,
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
  }, [group, showMaximalCycles])

  const planarPositions = useMemo(() => {
    if (!group || !showMaximalCycles || cycles.length === 0) return null
    return cycleGraphLayout(
      group.elements,
      cycles.map(c => ({ elementIds: c.elements.map(e => e.id) })),
      viewBoxSize.width,
      viewBoxSize.height,
      group.identity.id,
    )
  }, [group, showMaximalCycles, cycles, viewBoxSize.width, viewBoxSize.height])

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, { elementIds: string[]; color: string }>()
    subsets?.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const cosetPalette = cosetColors ?? []

  const labelHtmlCache = useMemo(() => {
    const m = new Map<string, string>()
    group?.elements.forEach(el => m.set(el.id, renderTex(texify(el.label))))
    return m
  }, [group])

  if (!group) {
    return (
      <div className="view-empty">
        <p>{noGroupText ?? ''}</p>
      </div>
    )
  }

  const isLarge = group.order > 60
  const isNodeOnScreen = (px: number, py: number) => {
    if (!isLarge) return true
    const sx = px * canvasTransform.scale + canvasTransform.x
    const sy = py * canvasTransform.scale + canvasTransform.y
    const m = nodeRadius * canvasTransform.scale * 1.5
    return sx + m > 0 && sx - m < viewBoxSize.width &&
           sy + m > 0 && sy - m < viewBoxSize.height
  }

  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.32, 160 + group.order * 16)

  const getPos = (elId: string): NodePosition => {
    const external = getNodePosition?.(elId)
    if (external) return external

    const local = localDragPositions.get(elId)
    if (local) return local

    if (planarPositions) {
      const p = planarPositions.get(elId)
      if (p) return p
    }

    const idx = group.elements.findIndex(e => e.id === elId)
    const angle = (idx * 2 * Math.PI / group.order) - Math.PI / 2
    return {
      x: cx + graphRadius * Math.cos(angle),
      y: cy + graphRadius * Math.sin(angle),
    }
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      {!isLarge && (
        <defs>
          <filter id={`${filterPrefix}-node-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {cycles.map((cycle, cycleIdx) => {
          const positions = cycle.elements.map(el => getPos(el.id))
          if (positions.length < 2) return null
          const pathD = positions.map((p, i) =>
            i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
          ).join(' ') + ' Z'

          const isHighlighted =
            selectedElements.size > 0 && cycle.elements.some(el => selectedElements.has(el.id))
          const cycleColor = CYCLE_COLORS[cycleIdx % CYCLE_COLORS.length]

          if (showMaximalCycles) {
            // GE 风格：细实线，无填充、无虚线、无 ⟨g⟩≅Z_n 标注；2 阶循环画成线段
            // 高亮模式（窗口点击元素后显示它所在的循环）：彩色填充 + 加粗 + ⟨g⟩≅Z_n 标注
            if (positions.length === 2) {
              return (
                <line
                  key={cycleIdx}
                  x1={positions[0].x}
                  y1={positions[0].y}
                  x2={positions[1].x}
                  y2={positions[1].y}
                  stroke={isHighlighted ? cycleColor : 'var(--text-muted)'}
                  strokeWidth={isHighlighted ? 4 : 1.5}
                  strokeLinecap="round"
                />
              )
            }
            const midX = positions.reduce((s, p) => s + p.x, 0) / positions.length
            const midY = positions.reduce((s, p) => s + p.y, 0) / positions.length
            return (
              <g key={cycleIdx}>
                <path
                  d={pathD}
                  fill={isHighlighted ? cycleColor : 'none'}
                  fillOpacity={isHighlighted ? 0.18 : undefined}
                  stroke={isHighlighted ? cycleColor : 'var(--text-muted)'}
                  strokeWidth={isHighlighted ? 4 : 1.5}
                  strokeLinejoin="round"
                />
                {isHighlighted && showCycleLabels && (
                  <text
                    x={midX}
                    y={midY - 12}
                    textAnchor="middle"
                    fill={cycleColor}
                    fontSize={10}
                    fontFamily="serif"
                  >
                    {'⟨'}{cycle.generatorLabel}{'⟩ ≅ Z'}{cycle.order}
                  </text>
                )}
              </g>
            )
          }

          // 非极大模式：保留彩色虚线 + 循环标注（诊断对比用）
          if (!showCycleLabels) return null
          const color = CYCLE_COLORS[cycleIdx % CYCLE_COLORS.length]
          const pcx = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
          const pcy = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
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
                {'⟨'}{cycle.generatorLabel}{'⟩ ≅ Z'}{cycle.order}
              </text>
            </g>
          )
        })}

        {group.elements.map((el) => {
          const pos = getPos(el.id)
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
              onMouseDown={(e) => {
                if (locked) return
                if (e.button !== 0) return
                e.stopPropagation()
                const svg = e.currentTarget.closest('svg')
                if (!svg) return
                const svgRect = svg.getBoundingClientRect()
                if (svgRect.width === 0 || svgRect.height === 0) return
                const scaleX = viewBoxSize.width / svgRect.width
                const scaleY = viewBoxSize.height / svgRect.height

                const startX = (e.clientX - svgRect.left) * scaleX
                const startY = (e.clientY - svgRect.top) * scaleY
                const startPos = getPos(el.id)

                const handleMove = (moveEvent: MouseEvent) => {
                  const currentX = (moveEvent.clientX - svgRect.left) * scaleX
                  const currentY = (moveEvent.clientY - svgRect.top) * scaleY
                  const newX = startPos.x + (currentX - startX) / canvasTransform.scale
                  const newY = startPos.y + (currentY - startY) / canvasTransform.scale
                  if (onNodePositionChange) onNodePositionChange(el.id, newX, newY)
                  else setLocalDragPosition(el.id, { x: newX, y: newY })
                }

                const handleUp = () => {
                  window.removeEventListener('mousemove', handleMove)
                  window.removeEventListener('mouseup', handleUp)
                }

                window.addEventListener('mousemove', handleMove)
                window.addEventListener('mouseup', handleUp)
              }}
              onMouseEnter={() => onHover?.(el, { x: pos.x * canvasTransform.scale + canvasTransform.x, y: pos.y * canvasTransform.scale + canvasTransform.y })}
              onMouseLeave={() => onHover?.(null, null)}
              style={{ cursor: 'grab' }}
            >
              <circle
                r={nodeRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                filter={isLarge ? undefined : `url(#${filterPrefix}-node-shadow)`}
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {isInHighlightedCoset && cosetIdx !== undefined && cosetPalette[cosetIdx] && (
                <circle
                  r={nodeRadius}
                  fill={`${cosetPalette[cosetIdx]}22`}
                  stroke="none"
                />
              )}
              {showLabels && (!isLarge || isSelected || selectedElements.size === 0) && (
                <foreignObject
                  x={-nodeRadius}
                  y={-15}
                  width={nodeRadius * 2}
                  height={30}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLarge ? '10px' : '14px'
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
    </svg>
  )
}

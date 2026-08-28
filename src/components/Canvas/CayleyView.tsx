import { useCallback, useMemo, useState } from 'react'
import { computeCayleyActionEdges, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { getSemidirectProductMeta, semidirectFactorMap, semidirectFixedPoints } from '../../core/algebra/semidirectDecompositions'
import { computeShape2DPositions } from '../../core/algebra/shapeLayouts'
import { texify, renderTex } from '../../utils/texify'
import { getDefaultShape2D } from '../../core/types'
import type { CanvasTransform, CayleyEdgeData, CayleyShape2D, Group, GroupElement, MultiplyType, NodePosition } from '../../core/types'
import type { CayleyActionParam } from '../../core/types/viewConfig'
// 纯函数模块（无 react 依赖），FGVE 打包期随视图层迁入 core
import { normalizeCayleyActions } from '../../context/cayleyActions'

export interface CayleyViewProps {
  group: Group | null
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  viewBoxSize: { width: number; height: number }
  /** 缺省 getDefaultShape2D(group) */
  shape2D?: CayleyShape2D
  /** 缺省 'right'（右乘 a·c） */
  multiplyType?: MultiplyType
  /** 缺省 = 群生成元集合；条目缺省 enabled=true、color=COLOR_PALETTE 按序 */
  actions?: CayleyActionParam[]
  /** 缺省 28（与主视图非复合节点一致） */
  nodeRadius?: number
  /** 缺省 true；>60 阶沿用主视图自适应规则（选中后仅选中节点显示标签） */
  showLabels?: boolean
  onSelect?: (elId: string, additive: boolean) => void
  onHover?: (el: GroupElement | null) => void
  noGroupText?: string
}

/**
 * 归一化见 context/cayleyActions.ts 的 normalizeCayleyActions（渲染层与参数面板共用）。
 */

// 每实例唯一前缀：同一文档内多个窗口 + 主画布的 <defs> marker/filter id 不冲突
let _cayleyViewInst = 0

function renderEdgePath(
  edge: CayleyEdgeData,
  nodePositionsCache: Map<string, NodePosition>,
  nodeRadius: number,
  enabledActionIndexMap: Map<string, number>,
  isHighlighted: boolean,
  markerPrefix: string,
) {
  const fromPos = nodePositionsCache.get(edge.fromId)
  const toPos = nodePositionsCache.get(edge.toId)
  if (!fromPos || !toPos) return null

  const dx = toPos.x - fromPos.x
  const dy = toPos.y - fromPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) return null

  const baseColor = edge.color
  const color = isHighlighted ? baseColor : `${baseColor}99`

  if (edge.isSelfLoop) {
    const scx = fromPos.x
    const scy = fromPos.y - nodeRadius - 20
    return (
      <g key={`${edge.fromId}-${edge.actionElementId}`}>
        <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={isHighlighted ? 3.5 : 2.5} />
        <polygon points={`${scx - 5},${scy - 2} ${scx + 5},${scy - 2} ${scx},${scy - 14}`} fill={baseColor} />
      </g>
    )
  }

  const midX = (fromPos.x + toPos.x) / 2
  const midY = (fromPos.y + toPos.y) / 2
  const nx = -dy / dist
  const ny = dx / dist

  const curvature = Math.min(dist * 0.08, 18)
  const ctrlX = midX + nx * curvature
  const ctrlY = midY + ny * curvature

  const startX = fromPos.x + (dx / dist) * nodeRadius
  const startY = fromPos.y + (dy / dist) * nodeRadius
  const endX = toPos.x - (dx / dist) * nodeRadius
  const endY = toPos.y - (dy / dist) * nodeRadius

  const actionIdx = enabledActionIndexMap.get(edge.actionElementId)
  const markerId = actionIdx !== undefined ? `${markerPrefix}-arrow-${actionIdx}` : undefined

  return (
    <path
      key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
      d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
      stroke={color}
      strokeWidth={isHighlighted ? 3.5 : 2.5}
      fill="none"
      markerEnd={edge.isBidirectional || !markerId ? undefined : `url(#${markerId})`}
      opacity={0.9}
    />
  )
}

export function CayleyView({
  group,
  selectedElements,
  canvasTransform,
  viewBoxSize,
  shape2D: shapeProp,
  multiplyType: multiplyProp,
  actions: actionsProp,
  nodeRadius: nodeRadiusProp,
  showLabels: showLabelsProp,
  onSelect,
  onHover,
  noGroupText,
}: CayleyViewProps) {
  // 惰性初始化的每实例唯一前缀（useState 初始化器每实例只执行一次）
  const [markerPrefix] = useState(() => `cv${++_cayleyViewInst}`)

  const n = group?.order ?? 0
  const shape: CayleyShape2D = group ? (shapeProp ?? getDefaultShape2D(group)) : 'circular'
  const multiplyType: MultiplyType = multiplyProp ?? 'right'
  const nodeRadius = nodeRadiusProp ?? 28
  const isLargeGraph = n > 60

  const effectiveActions = useMemo(
    () => (group ? normalizeCayleyActions(group, actionsProp) : []),
    [group, actionsProp],
  )

  // 拖拽覆盖位置为窗口本地会话态；群/形状变化时重置（key 校验在渲染期完成，
  // 避免 key 变化后的一帧读到旧群的坐标）
  const posKey = group ? `${group.symbol}|${group.order}|${shape}` : ''
  const [dragState, setDragState] = useState<{ key: string; map: Map<string, NodePosition> }>({
    key: posKey,
    map: new Map(),
  })
  if (dragState.key !== posKey) {
    setDragState({ key: posKey, map: new Map() })
  }
  const dragPositions = useMemo(
    () => (dragState.key === posKey ? dragState.map : new Map<string, NodePosition>()),
    [dragState, posKey],
  )

  const setDragPositionsEntry = useCallback(
    (elId: string, pos: NodePosition) => {
      setDragState(prev => {
        if (prev.key !== posKey) return prev
        const map = new Map(prev.map)
        map.set(elId, pos)
        return { key: prev.key, map }
      })
    },
    [posKey],
  )

  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + n * 10)

  const gridPositions = useMemo(() => {
    if (!group) return null
    return computeShape2DPositions(group, shape, viewBoxSize.width, viewBoxSize.height)
  }, [group, shape, viewBoxSize.width, viewBoxSize.height])

  const circLayout = useMemo(() => {
    if (!group || n === 0) return new Map<string, NodePosition>()
    return cayleyCircleLayout(group, cx, cy, graphRadius)
  }, [group, cx, cy, graphRadius, n])

  // rewiring 形状：半直积 φ-不动点青色高亮（与主视图同源纯计算）
  const sdMeta = useMemo(() => (group ? getSemidirectProductMeta(group) : null), [group])
  const sdFixedMap = useMemo(() => {
    const m = new Map<string, boolean>()
    if (!group || !sdMeta) return m
    const factorMap = semidirectFactorMap(group, sdMeta)
    if (!factorMap) return m
    return semidirectFixedPoints(group, sdMeta, factorMap)
  }, [group, sdMeta])

  const enabledActions = useMemo(() => effectiveActions.filter(a => a.enabled), [effectiveActions])
  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    enabledActions.forEach((a, idx) => m.set(a.elementId, idx))
    return m
  }, [enabledActions])

  const edges = useMemo(
    () => (group ? computeCayleyActionEdges(group, effectiveActions, multiplyType) : []),
    [group, effectiveActions, multiplyType],
  )

  const getNodePos = useCallback(
    (elId: string): NodePosition => {
      let defPos: NodePosition
      if (gridPositions) {
        const gp = gridPositions.get(elId)
        if (!gp) return { x: cx, y: cy }
        defPos = gp
      } else {
        const pos = circLayout.get(elId)
        if (!pos) return { x: cx, y: cy }
        defPos = pos
      }
      const saved = dragPositions.get(elId)
      if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
        return saved
      }
      return defPos
    },
    [gridPositions, circLayout, dragPositions, cx, cy],
  )

  const nodePositionsCache = useMemo(() => {
    const cache = new Map<string, NodePosition>()
    if (!group) return cache
    group.elements.forEach(el => cache.set(el.id, getNodePos(el.id)))
    return cache
  }, [group, getNodePos])

  // KaTeX 标签 HTML 开销大：每群只渲染一次
  const labelHtmlCache = useMemo(() => {
    const m = new Map<string, string>()
    if (!group) return m
    group.elements.forEach(el => m.set(el.id, renderTex(texify(el.label))))
    return m
  }, [group])

  const selectedCount = useMemo(() => selectedElements.size, [selectedElements])

  const edgeElements = useMemo(() => {
    if (!group) return null
    return edges.map(edge =>
      renderEdgePath(edge, nodePositionsCache, nodeRadius, enabledActionIndexMap, false, markerPrefix),
    )
  }, [edges, nodePositionsCache, enabledActionIndexMap, nodeRadius, group, markerPrefix])

  // 选中相关边全色加粗重绘于基础边之上
  const highlightedEdges = useMemo(() => {
    if (!group || selectedElements.size === 0) return null
    return edges
      .filter(edge => selectedElements.has(edge.fromId) || selectedElements.has(edge.toId))
      .map(edge =>
        renderEdgePath(edge, nodePositionsCache, nodeRadius, enabledActionIndexMap, true, markerPrefix),
      )
  }, [edges, selectedElements, nodePositionsCache, enabledActionIndexMap, nodeRadius, group, markerPrefix])

  const nodeElements = useMemo(() => {
    if (!group) return null
    return group.elements.map(el => {
      const pos = nodePositionsCache.get(el.id) || { x: cx, y: cy }
      const sx = pos.x * canvasTransform.scale + canvasTransform.x
      const sy = pos.y * canvasTransform.scale + canvasTransform.y
      const cullMargin = nodeRadius * canvasTransform.scale * 1.5
      const onScreen =
        !isLargeGraph ||
        (sx + cullMargin > 0 &&
          sx - cullMargin < viewBoxSize.width &&
          sy + cullMargin > 0 &&
          sy - cullMargin < viewBoxSize.height)
      if (!onScreen) return null
      const isSdFixed = shape === 'rewiring' && !!sdMeta && sdFixedMap.get(el.id) === true

      let fillColor = 'var(--node-fill)'
      let strokeColor = 'var(--node-stroke)'
      let strokeWidth = 2.5
      if (isSdFixed) {
        fillColor = 'var(--accent-teal)22'
        strokeColor = 'var(--accent-teal)'
        strokeWidth = 3
      }

      return (
        <g
          key={el.id}
          transform={`translate(${pos.x}, ${pos.y})`}
          onClick={e => {
            e.stopPropagation()
            onSelect?.(el.id, e.ctrlKey || e.metaKey)
          }}
          onMouseDown={e => {
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
            const startPos = getNodePos(el.id)

            let pendingPos: NodePosition | null = null
            const rafId = { current: 0 }
            const commit = () => {
              if (pendingPos) setDragPositionsEntry(el.id, pendingPos)
            }
            const handleMove = (moveEvent: MouseEvent) => {
              const currentX = (moveEvent.clientX - svgRect.left) * scaleX
              const currentY = (moveEvent.clientY - svgRect.top) * scaleY
              pendingPos = {
                x: startPos.x + (currentX - startX) / canvasTransform.scale,
                y: startPos.y + (currentY - startY) / canvasTransform.scale,
              }
              // rAF 节流：每帧至多一次位置写入
              if (rafId.current === 0) {
                rafId.current = requestAnimationFrame(() => {
                  rafId.current = 0
                  commit()
                })
              }
            }
            const handleUp = () => {
              window.removeEventListener('mousemove', handleMove)
              window.removeEventListener('mouseup', handleUp)
              if (rafId.current !== 0) {
                cancelAnimationFrame(rafId.current)
                rafId.current = 0
              }
              commit()
            }
            window.addEventListener('mousemove', handleMove)
            window.addEventListener('mouseup', handleUp)
          }}
          onMouseEnter={() => onHover?.(el)}
          onMouseLeave={() => onHover?.(null)}
          style={{ cursor: 'grab' }}
        >
          <circle
            r={nodeRadius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            filter={isLargeGraph ? undefined : `url(#${markerPrefix}-node-shadow)`}
          />
          {showLabelsProp !== false && (!isLargeGraph || selectedCount === 0) && (
            <foreignObject
              x={-nodeRadius}
              y={-16}
              width={nodeRadius * 2}
              height={32}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: isSdFixed ? 'var(--accent-teal)' : 'var(--node-text)',
                  fontSize: isLargeGraph ? '10px' : '15px',
                  fontWeight: isSdFixed ? 700 : 400,
                }}
                dangerouslySetInnerHTML={{ __html: labelHtmlCache.get(el.id) ?? '' }}
              />
            </foreignObject>
          )}
        </g>
      )
    })
  }, [
    group, nodePositionsCache, selectedCount, sdMeta, sdFixedMap, nodeRadius, isLargeGraph,
    canvasTransform, viewBoxSize, cx, cy, labelHtmlCache, shape, getNodePos, onSelect, onHover,
    markerPrefix, showLabelsProp, setDragPositionsEntry,
  ])

  // 选中金圈 overlay（大群时附带选中节点标签），绘制于节点之上
  const selectionOverlay = useMemo(() => {
    if (!group || selectedElements.size === 0) return null
    return [...selectedElements].map(id => {
      const pos = nodePositionsCache.get(id) || { x: cx, y: cy }
      const sx = pos.x * canvasTransform.scale + canvasTransform.x
      const sy = pos.y * canvasTransform.scale + canvasTransform.y
      const cullMargin = nodeRadius * canvasTransform.scale * 1.5
      if (
        isLargeGraph &&
        !(sx + cullMargin > 0 && sx - cullMargin < viewBoxSize.width && sy + cullMargin > 0 && sy - cullMargin < viewBoxSize.height)
      ) {
        return null
      }
      return (
        <g key={`selected-${id}`} transform={`translate(${pos.x}, ${pos.y})`}>
          <circle r={nodeRadius + 3} fill="none" stroke="#ffd93d" strokeWidth={3} opacity={0.95} />
          {isLargeGraph && (
            <foreignObject x={-nodeRadius} y={-16} width={nodeRadius * 2} height={32} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '10px' }}
                dangerouslySetInnerHTML={{ __html: labelHtmlCache.get(id) ?? '' }}
              />
            </foreignObject>
          )}
        </g>
      )
    })
  }, [group, selectedElements, nodePositionsCache, nodeRadius, canvasTransform, viewBoxSize, isLargeGraph, cx, cy, labelHtmlCache])

  if (!group) {
    return (
      <div className="view-empty">
        <p>{noGroupText ?? ''}</p>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id={`${markerPrefix}-node-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {enabledActions.map((action, idx) => (
          <marker
            key={idx}
            id={`${markerPrefix}-arrow-${idx}`}
            markerWidth={10}
            markerHeight={10}
            refX={9}
            refY={3}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>

      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edgeElements}
        {highlightedEdges}

        {nodeElements}
        {selectionOverlay}
      </g>
    </svg>
  )
}

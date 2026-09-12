import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SceneThemeRoot, type SceneTheme } from './SceneThemeRoot'
import {
  computeCayleyActionEdges, cayleyCircleLayout, circleLayoutRadius,
  relaxEdgeLengths, isIdentityScale, resolveCayleyPath, createCayleyForceSim,
  type CayleyForceSim,
} from '../../core/algebra/forceLayout'
import { getSemidirectProductMeta, semidirectFactorMap, semidirectFixedPoints } from '../../core/algebra/semidirectDecompositions'
import { computeShape2DPositions } from '../../core/algebra/shapeLayouts'
import { texify, renderTex } from '../../utils/texify'
import { getDefaultShape2D } from '../../core/types'
import type { CanvasTransform, CayleyEdgeData, CayleyShape2D, Group, GroupElement, MultiplyType, NodePosition } from '../../core/types'
import type { CayleyActionParam, CayleyPathHighlight, CayleyForceParams } from '../../core/types/viewConfig'
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
  /** 缺省 true；>60 阶沿用主视图自适应规则（选中后仅选中节点显示标签）。嵌入小窗（ViewWindow）传 false 彻底不显示节点标签、读元素靠悬停就地气泡 */
  showLabels?: boolean
  /** 缺省 false；true 时禁用节点拖拽（供 ViewWindow 锁定状态使用，点击选中仍保留） */
  locked?: boolean
  onSelect?: (elId: string, additive: boolean) => void
  /**
   * 悬停回调：第一个参数是元素，第二个是节点在 viewport 内的屏幕锚点
   * （viewBox 坐标经 canvasTransform 映射，供上层渲染"就地气泡"tooltip）。
   */
  onHover?: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  /** 当前悬停元素 id；用于在该节点外圈绘制高亮环（让"悬停→信息"在视觉上立得住） */
  hoveredElementId?: string | null
  noGroupText?: string
  /** 节点标签自适应阈值：`group.order > 该值` 时仅选中节点显示常驻标签；缺省 60（主画布规则） */
  largeGroupThreshold?: number
  /** 视图主题作用域（`'dark' | 'light'`）。缺省不注入、跟随外层主题；显式传值时在本子树内
   *  应用 `theme.css` 对应变量块（需宿主已 `import '@groupviz/react/theme.css'`） */
  theme?: SceneTheme
  /** 边弯曲度倍率；缺省 1（自适应弧 ≈ min(dist*0.08, 18)）。**0 = 笔直**；2 = 更弯。
   *  同一对节点间的平行边（多条作用边）自动左右分开，避免笔直时重叠 */
  edgeCurvature?: number
  /** 路径高亮（VCL）：元素序列或生成元单词，见 core.resolveCayleyPath */
  pathHighlight?: CayleyPathHighlight | null
  /** 动态力导向**开关**（在**当前选定形状**之上启用，让静图"活"起来；不是一种新形状） */
  forceDirected?: boolean
  /** 力导向微调（forceDirected 为 true 时生效） */
  force?: CayleyForceParams
}

export function CayleyView(props: CayleyViewProps) {
  return (
    <SceneThemeRoot theme={props.theme}>
      <CayleyViewBody {...props} />
    </SceneThemeRoot>
  )
}

/**
 * 归一化见 context/cayleyActions.ts 的 normalizeCayleyActions（渲染层与参数面板共用）。
 */

// 每实例唯一前缀：同一文档内多个窗口 + 主画布的 <defs> marker/filter id 不冲突
let _cayleyViewInst = 0

/** 力导向拖拽启动阈值（屏幕 px）：小于它一律视为点击 —— 不钉住、不升温
 *  （否则"点一下就放开"会把整张图重新加热，布局大幅收缩/纠缠） */
const FORCE_DRAG_THRESHOLD = 4

/** 平行边（同一对节点间多条作用边）排序键：渲染与曲率分摊共用 */
function edgeKey(edge: CayleyEdgeData): string {
  return `${edge.fromId}-${edge.toId}-${edge.actionElementId}`
}

function renderEdgePath(
  edge: CayleyEdgeData,
  nodePositionsCache: Map<string, NodePosition>,
  nodeRadius: number,
  enabledActionIndexMap: Map<string, number>,
  isHighlighted: boolean,
  markerPrefix: string,
  curvatureMul: number,
  parallelIndex: number,
  parallelCount: number,
  dimmed = false,
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
      <g key={`${edge.fromId}-${edge.actionElementId}`} opacity={dimmed ? 0.12 : 1}>
        <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={isHighlighted ? 3.5 : 2.5} />
        <polygon points={`${scx - 5},${scy - 2} ${scx + 5},${scy - 2} ${scx},${scy - 14}`} fill={baseColor} />
      </g>
    )
  }

  const midX = (fromPos.x + toPos.x) / 2
  const midY = (fromPos.y + toPos.y) / 2
  const nx = -dy / dist
  const ny = dx / dist

  // 平行边分摊：0/1 条时 offset=0；多条时按序号左右铺开
  const offset = parallelCount > 1 ? (parallelIndex - (parallelCount - 1) / 2) : 0
  const baseCurvature = Math.min(dist * 0.08, 18)
  let curvature: number
  if (curvatureMul === 0) {
    // 笔直模式：单条边真直；平行边仍小幅分开，否则完全重叠看不见
    curvature = parallelCount > 1 ? offset * 16 : 0
  } else {
    curvature = baseCurvature * curvatureMul * (parallelCount > 1 ? 1 + offset * 0.7 : 1)
  }

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
      strokeWidth={isHighlighted ? 3.5 : dimmed ? 1.6 : 2.5}
      fill="none"
      markerEnd={edge.isBidirectional || !markerId ? undefined : `url(#${markerId})`}
      opacity={dimmed ? 0.12 : 0.9}
    />
  )
}

function CayleyViewBody({
  group,
  selectedElements,
  canvasTransform,
  viewBoxSize,
  shape2D: shapeProp,
  multiplyType: multiplyProp,
  actions: actionsProp,
  nodeRadius: nodeRadiusProp,
  showLabels: showLabelsProp,
  locked = false,
  onSelect,
  onHover,
  hoveredElementId,
  noGroupText,
  largeGroupThreshold = 60,
  edgeCurvature: edgeCurvatureProp,
  pathHighlight = null,
  forceDirected = false,
  force,
}: CayleyViewProps) {
  // 惰性初始化的每实例唯一前缀（useState 初始化器每实例只执行一次）
  const [markerPrefix] = useState(() => `cv${++_cayleyViewInst}`)

  const n = group?.order ?? 0
  const shape: CayleyShape2D = group ? (shapeProp ?? getDefaultShape2D(group)) : 'circular'
  const multiplyType: MultiplyType = multiplyProp ?? 'right'
  const nodeRadius = nodeRadiusProp ?? 28
  const isLargeGraph = n > largeGroupThreshold
  const edgeCurvatureMul = edgeCurvatureProp ?? 1

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
  // 半径同时受容器宽/高约束：嵌入方给的 viewBox 可能宽扁（如 900×360），
  // 只按宽度取半径会让圆环上下两端节点出画布（见 feedback/issue-circular-radius-overflow.md）
  const graphRadius = circleLayoutRadius(viewBoxSize.width, viewBoxSize.height, n, nodeRadius)

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

  // 平行边索引（同一对节点间多条作用边）：按 actionElementId 稳定排序，供曲率分摊
  const parallelInfo = useMemo(() => {
    const buckets = new Map<string, CayleyEdgeData[]>()
    for (const e of edges) {
      const key = e.fromIdx < e.toIdx ? `${e.fromIdx}|${e.toIdx}` : `${e.toIdx}|${e.fromIdx}`
      const arr = buckets.get(key)
      if (arr) arr.push(e)
      else buckets.set(key, [e])
    }
    const m = new Map<string, { index: number; count: number }>()
    for (const arr of buckets.values()) {
      const sorted = [...arr].sort((a, b) => a.actionElementId.localeCompare(b.actionElementId))
      sorted.forEach((e, i) => m.set(edgeKey(e), { index: i, count: sorted.length }))
    }
    return m
  }, [edges])

  // 基础几何布局（形状决定）→ 逐生成元长度松弛后处理
  const baseLayoutPositions = useMemo(() => {
    const m = new Map<string, NodePosition>()
    if (!group) return m
    group.elements.forEach(el => {
      if (gridPositions) {
        const gp = gridPositions.get(el.id)
        if (gp) {
          m.set(el.id, gp)
          return
        }
      }
      m.set(el.id, circLayout.get(el.id) ?? { x: cx, y: cy })
    })
    return m
  }, [group, gridPositions, circLayout, cx, cy])

  const lengthScaleMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of enabledActions) {
      if (a.lengthScale !== undefined && a.lengthScale !== 1) m.set(a.elementId, a.lengthScale)
    }
    return m
  }, [enabledActions])

  const layoutPositions = useMemo(() => {
    if (!group) return baseLayoutPositions
    if (isIdentityScale(lengthScaleMap)) return baseLayoutPositions
    return relaxEdgeLengths(baseLayoutPositions, edges, {
      lengthScales: lengthScaleMap,
      clamp: { width: viewBoxSize.width, height: viewBoxSize.height },
    })
  }, [group, baseLayoutPositions, edges, lengthScaleMap, viewBoxSize.width, viewBoxSize.height])

  // ── 动态力导向（开关：在所选形状之上把静图"激活"） ──
  const forceActive = !!forceDirected && !!group
  const simRef = useRef<CayleyForceSim | null>(null)
  const wakeRef = useRef<(() => void) | null>(null)
  // 力模拟位置以 state 暴露给渲染层：ref 只在 effect / 事件处理器内访问，
  // 避免 React Compiler 的 react-hooks/refs「render 期读 ref」规则
  const [forcePositions, setForcePositions] = useState<Map<string, NodePosition>>(() => new Map())

  useEffect(() => {
    if (!forceActive || !group) {
      simRef.current = null
      wakeRef.current = null
      return
    }
    const prev = simRef.current?.positions
    const init = prev && prev.size === group.order ? prev : layoutPositions
    const sim = createCayleyForceSim(group, effectiveActions, multiplyType, {
      width: viewBoxSize.width,
      height: viewBoxSize.height,
      repulsion: force?.repulsion,
      linkScale: force?.linkScale,
      gravity: force?.gravity,
      damping: force?.damping,
      stiffness: force?.stiffness,
      initialPositions: init,
      // 启动 alpha=0（冻结）—— Obsidian 风格：力系统不持续运行，
      // 激活时由下面的 settle() 一次性投影到力平衡态。
    })
    simRef.current = sim
    // 一次性 settle 到力平衡态（≈200ms 动画感），per-edge rest 让平衡态
    // ≈ 原始静态布局的均匀化版本（不塌成圆），之后冻结
    sim.settle()
    setForcePositions(new Map(sim.positions))
    let raf = 0
    let running = false
    const loop = () => {
      const moving = sim.step()
      setForcePositions(new Map(sim.positions))
      if (moving) {
        raf = requestAnimationFrame(loop)
      } else {
        running = false
        raf = 0
      }
    }
    const wake = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(loop)
      }
    }
    wakeRef.current = wake
    // settle 后图谱已冻结（alpha=0），不需持续 rAF
    return () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      wakeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // 只依赖"结构"：群 / 作用边 / 方向 / 视口尺寸。
    // 力参数（link/rep/gravity/damping/stiffness）走下面的 setOptions 就地更新，
    // 不重建模拟器 —— 否则每动一下滑杆都会重新收敛，形状大变样
    forceActive, group, effectiveActions, multiplyType, viewBoxSize.width, viewBoxSize.height,
  ])

  // 力参数变化 → 就地更新 + 一次性 settle（保留初始形状，仅按新参数均匀化）。
  // 比"持续 rAF 自然收敛"更稳定：参数变化不会让图谱慢慢漂走，而是清晰投影。
  useEffect(() => {
    if (!forceActive) return
    simRef.current?.setOptions({
      repulsion: force?.repulsion ?? 1,
      linkScale: force?.linkScale ?? 1,
      gravity: force?.gravity ?? 1,
      damping: force?.damping ?? 0.82,
      stiffness: force?.stiffness ?? 1,
    })
    simRef.current?.settle()
    setForcePositions(new Map(simRef.current!.positions))
  }, [forceActive, force?.repulsion, force?.linkScale, force?.gravity, force?.damping, force?.stiffness])

  // settleSignal 自增 → 硬重置回给定形状（⟳ Re-settle：位置与弹簧 rest 都恢复
  // 初始，拖拽探索出的新形状被清除；对齐 SymmetryView.replaySignal 语义）。
  // 不用「resetRests + settle 投影」——大形变时投影收敛不到位甚至震荡
  useEffect(() => {
    if (!forceActive) return
    simRef.current?.resetShape()
    setForcePositions(new Map(simRef.current!.positions))
  }, [force?.settleSignal, forceActive])

  const getNodePos = useCallback(
    (elId: string): NodePosition => {
      if (forceActive) {
        const sp = forcePositions.get(elId)
        if (sp) return sp
      }
      const defPos = layoutPositions.get(elId)
      if (!defPos) return { x: cx, y: cy }
      if (!forceActive) {
        const saved = dragPositions.get(elId)
        if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
          return saved
        }
      }
      return defPos
    },
    [forceActive, forcePositions, layoutPositions, dragPositions, cx, cy],
  )

  // 力模拟每帧更新 forcePositions（state）→ getNodePos 身份变化 → 位置缓存随之重算
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

  // ── 路径高亮（VCL）：解析 + 路径边集合（其余边淡化，让"只有路径"一眼可见） ──
  const resolvedPath = useMemo(() => {
    if (!group || !pathHighlight) return null
    return resolveCayleyPath(group, effectiveActions, multiplyType, pathHighlight)
  }, [group, effectiveActions, multiplyType, pathHighlight])

  const pathEdgeKeys = useMemo(() => {
    if (!resolvedPath || resolvedPath.edges.length === 0) return null
    if (pathHighlight?.dimOthers === false) return null
    const s = new Set<string>()
    for (const e of resolvedPath.edges) {
      if (!e.actionElementId) continue
      s.add(`${e.fromId}|${e.toId}|${e.actionElementId}`)
      s.add(`${e.toId}|${e.fromId}|${e.actionElementId}`)
    }
    return s
  }, [resolvedPath, pathHighlight?.dimOthers])

  const edgeElements = useMemo(() => {
    if (!group) return null
    return edges.map(edge => {
      const pi = parallelInfo.get(edgeKey(edge))
      const dimmed = !!pathEdgeKeys &&
        !pathEdgeKeys.has(`${edge.fromId}|${edge.toId}|${edge.actionElementId}`)
      return renderEdgePath(
        edge, nodePositionsCache, nodeRadius, enabledActionIndexMap, false, markerPrefix,
        edgeCurvatureMul, pi?.index ?? 0, pi?.count ?? 1, dimmed,
      )
    })
  }, [edges, nodePositionsCache, enabledActionIndexMap, nodeRadius, group, markerPrefix, edgeCurvatureMul, parallelInfo, pathEdgeKeys])

  // 选中相关边全色加粗重绘于基础边之上
  const highlightedEdges = useMemo(() => {
    if (!group || selectedElements.size === 0) return null
    return edges
      .filter(edge => selectedElements.has(edge.fromId) || selectedElements.has(edge.toId))
      .map(edge => {
        const pi = parallelInfo.get(edgeKey(edge))
        return renderEdgePath(
          edge, nodePositionsCache, nodeRadius, enabledActionIndexMap, true, markerPrefix,
          edgeCurvatureMul, pi?.index ?? 0, pi?.count ?? 1,
        )
      })
  }, [edges, selectedElements, nodePositionsCache, enabledActionIndexMap, nodeRadius, group, markerPrefix, edgeCurvatureMul, parallelInfo])

  // 路径动画：用「渲染期 key 校正 + 定时器自增」代替在 effect 里同步 setState
  const pathAnimKey = resolvedPath
    ? `${resolvedPath.nodeIds.join(',')}|${resolvedPath.edges.map(e => e.actionElementId).join(',')}|${pathHighlight?.animate ? 1 : 0}`
    : ''
  const [revealState, setRevealState] = useState<{ key: string; tick: number }>({ key: '', tick: 0 })
  if (revealState.key !== pathAnimKey) {
    setRevealState({ key: pathAnimKey, tick: 0 })
  }
  const pathReveal = revealState.key === pathAnimKey ? revealState.tick : 0

  useEffect(() => {
    const total = resolvedPath?.edges.length ?? 0
    if (!resolvedPath || !pathHighlight?.animate || total === 0) return
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setRevealState(prev => (prev.key === pathAnimKey ? { key: pathAnimKey, tick: i } : prev))
      if (i >= total) window.clearInterval(timer)
    }, 320)
    return () => window.clearInterval(timer)
  }, [pathAnimKey, resolvedPath, pathHighlight?.animate])

  const pathOverlay = useMemo(() => {
    if (!group || !resolvedPath) return null
    const color = pathHighlight?.color ?? '#ffd93d'
    const width = pathHighlight?.width ?? 5
    const animate = !!pathHighlight?.animate
    const total = resolvedPath.edges.length
    const visible = animate ? Math.min(pathReveal, total) : total

    const segments = resolvedPath.edges.map((e, i) => {
      if (i >= visible) return null
      if (!e.actionElementId) return null
      const a = nodePositionsCache.get(e.fromId)
      const b = nodePositionsCache.get(e.toId)
      if (!a || !b) return null
      return (
        <line
          key={`ph-seg-${i}`}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.95}
        />
      )
    })

    const nodeLimit = animate ? Math.min(visible + 1, resolvedPath.nodeIds.length) : resolvedPath.nodeIds.length
    const rings = resolvedPath.nodeIds.slice(0, nodeLimit).map((id, i) => {
      const p = nodePositionsCache.get(id)
      if (!p) return null
      // 序号不常显（路径长时互相遮挡）：仅悬停该节点时显示它的次序
      const showBadge = !!pathHighlight?.showOrder && hoveredElementId === id
      return (
        <g key={`ph-node-${id}-${i}`}>
          <circle cx={p.x} cy={p.y} r={nodeRadius + 6} fill="none" stroke={color} strokeWidth={3} opacity={0.9} />
          {showBadge && (
            <g>
              <circle cx={p.x} cy={p.y - nodeRadius - 13} r={9} fill={color} />
              <text
                x={p.x} y={p.y - nodeRadius - 9.5}
                textAnchor="middle" fontSize={11} fontWeight={700} fill="#111111"
                style={{ userSelect: 'none' }}
              >{i + 1}</text>
            </g>
          )}
        </g>
      )
    })

    return <g>{segments}{rings}</g>
  }, [group, resolvedPath, nodePositionsCache, nodeRadius, pathHighlight, pathReveal, hoveredElementId])

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
            // 快照拖拽起点：getNodePos 返回 forcePositions 里的**对象引用**，而 sim.pin 会原地
            // 改写该对象 —— 直接持有引用会让每次 mousemove 都基于上一次结果叠加（位移被放大、
            // 节点"越拖越跑"）。这里复制一份不可变起点。
            const startPosRaw = getNodePos(el.id)
            const startPos = { x: startPosRaw.x, y: startPosRaw.y }

            // 力导向模式：**移动超过阈值才算拖拽**（单纯点击不 pin、不升温——否则一次点击就把
            // 整张图重新加热收缩）；拖拽 = 钉住 + 邻居轻微让位（低热度），松手解钉缓慢回稳
            if (forceActive && simRef.current) {
              const sim = simRef.current
              const downX = e.clientX
              const downY = e.clientY
              let dragging = false
              const handleForceMove = (moveEvent: MouseEvent) => {
                if (!dragging) {
                  if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) < FORCE_DRAG_THRESHOLD) return
                  dragging = true
                  sim.pin(el.id, startPos.x, startPos.y)
                }
                const currentX = (moveEvent.clientX - svgRect.left) * scaleX
                const currentY = (moveEvent.clientY - svgRect.top) * scaleY
                sim.pin(
                  el.id,
                  startPos.x + (currentX - startX) / canvasTransform.scale,
                  startPos.y + (currentY - startY) / canvasTransform.scale,
                )
                // 立即同步渲染位置（不等 rAF 的下一帧 step）——拖拽严格跟手
                setForcePositions(new Map(sim.positions))
                wakeRef.current?.()
              }
              const handleForceUp = () => {
                window.removeEventListener('mousemove', handleForceMove)
                window.removeEventListener('mouseup', handleForceUp)
                if (dragging) {
                  sim.unpin(el.id)
                  wakeRef.current?.()
                }
              }
              window.addEventListener('mousemove', handleForceMove)
              window.addEventListener('mouseup', handleForceUp)
              return
            }

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
          onMouseEnter={() => onHover?.(el, { x: sx, y: sy })}
          onMouseLeave={() => onHover?.(null, null)}
          style={{ cursor: 'grab' }}
        >
          <circle
            r={nodeRadius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            filter={isLargeGraph ? undefined : `url(#${markerPrefix}-node-shadow)`}
          />
          {/* 悬停高亮环：让"我悬停的就是这个节点"一眼可见，配合就地气泡形成"节点环+元素名"双重反馈 */}
          {el.id === hoveredElementId && (
            <circle
              r={nodeRadius + 5}
              fill="none"
              stroke="#4ecdc4"
              strokeWidth={3.5}
              opacity={0.95}
              style={{ filter: 'drop-shadow(0 0 4px rgba(78,205,196,0.7))' }}
            />
          )}
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
    markerPrefix, showLabelsProp, setDragPositionsEntry, locked, hoveredElementId, forceActive,
    setForcePositions,
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
        {pathOverlay}
      </g>
    </svg>
  )
}

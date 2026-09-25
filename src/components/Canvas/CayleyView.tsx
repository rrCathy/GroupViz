import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SceneThemeRoot, type SceneTheme } from './SceneThemeRoot'
import {
  computeCayleyActionEdges, cayleyCircleLayout, circleLayoutRadius,
  relaxEdgeLengths, isIdentityScale, resolveCayleyPath, createCayleyForceSim,
  type CayleyForceSim,
} from '../../core/algebra/forceLayout'
import { getSemidirectProductMeta, semidirectFactorMap, semidirectFixedPoints } from '../../core/algebra/semidirectDecompositions'
import { computeShape2DPositions } from '../../core/algebra/shapeLayouts'
import {
  conjugacyClassIndexMap, conjugacyClassCount, conjugacyClassColor,
  cyclicSubgroupElements, centerElementIds, smallestNormalSubgroupIds, elementOrderMap,
} from '../../core/algebra/nodeSemantics'
import { texify, renderTex } from '../../utils/texify'
import { resolveElement } from '../../core/algebra/elementRef'
import { resolveAnnotationAnchor, type AnchorLookup, type Decorations } from '../../core/types/decorations'
import { getDefaultShape2D, isQuotientGroup } from '../../core/types'
import { quotientInsetGeometry } from '../../core/viewBox'
import { QuotientSubgroupInset } from './QuotientSubgroupInset'
import type { CanvasTransform, CayleyEdgeData, CayleyShape2D, Group, GroupElement, MultiplyType, NodePosition } from '../../core/types'
import type { CayleyActionParam, CayleyPathHighlight, CayleyForceParams, CayleyNodeColorMode } from '../../core/types/viewConfig'
import { INTERACTIVE_LIMIT } from '../../core/guards'
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
  /** 商群视图里「正规子群 N 的凯莱图」面板标题（宿主本地化文案；缺省只画记号 N） */
  quotientInsetTitle?: string
  // ── VCL F 组：节点语义装饰 ──
  /** 节点着色方案；缺省 'none'（主题默认填充） */
  nodeColorMode?: CayleyNodeColorMode
  /** 节点右上角元素阶徽标；缺省 false */
  showOrderBadge?: boolean
  /** 高亮选中元素生成的循环子群 ⟨g⟩（节点外圈 + 组内边）；缺省 false */
  highlightGenerated?: boolean
  /** 中心 Z(G) 双环标记；缺省 false */
  markCenter?: boolean
  /** 最小非平凡正规子群 N 成员虚线外圈标记；缺省 false */
  markNormalSubgroup?: boolean
  // ── VCL E 组：边样式与图例 ──
  /** 打印/黑白友好单色配色（同色 + 线型/线宽区分）；缺省 false */
  printPalette?: boolean
  /** 边线宽总倍率；缺省 1 */
  edgeWidthScale?: number
  /** 是否画方向箭头；缺省 true */
  showArrows?: boolean
  /** 显示生成元图例（点击色块切换该生成元显隐，需配合 `onToggleAction`）；缺省 false */
  showLegend?: boolean
  /** 图例点击回调：宿主收到 elementId 后自行改 actions（缺省图例为只读展示） */
  onToggleAction?: (elementId: string) => void
  // ── VCL Decorations（DEC-2）：注释叠层 ──
  /** 图上注释（锚点 = 节点 / 边 / 整图，相对位置）；缺省 null = 不画，零行为变化。
   *  引用解析走 core `resolveElement`，解析不出的条目静默跳过（换群后残留注释自然消失） */
  decorations?: Decorations | null
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

/** printPalette 的墨色：随主题取节点描边色（暗底 = 白线、亮底 = 深线），保证单色也看得见 */
const PRINT_INK = 'var(--node-stroke)'
/** VCL F 组标记色（与选中金 #ffd93d / 悬停青 #4ecdc4 区分开，避免误读） */
const RING_CENTER = '#a78bfa'
const RING_NORMAL = '#f97316'
const RING_GENERATED = '#4ecdc4'
/** 各类标记环相对节点半径的外扩量（px，节点坐标系内） */
const RING_GEN_OFFSET = 12
const RING_NORMAL_OFFSET = 9.5
const RING_CENTER_INNER = 4
const RING_CENTER_OUTER = 6.5
/** 图例最多列出的生成元条数（超过折叠为「+N more」——「All」一键会把全群元素变成作用边） */
const LEGEND_MAX_ROWS = 12

/** 平行边（同一对节点间多条作用边）排序键：渲染与曲率分摊共用 */
function edgeKey(edge: CayleyEdgeData): string {
  return `${edge.fromId}-${edge.toId}-${edge.actionElementId}`
}

/**
 * 2D 边渲染的**样式上下文**（VCL E 组）。
 *
 * 用 ctx 收口而不是继续加位置参数：`renderEdgePath` 原本已有 10 个参数，
 * 再加线型/线宽/箭头/单色 4 个会彻底不可读，也不利于两处调用点（基础边 + 选中重绘）保持一致。
 */
interface EdgeRenderCtx {
  nodeRadius: number
  enabledActionIndexMap: Map<string, number>
  markerPrefix: string
  /** 边弯曲度倍率（0 = 笔直） */
  curvatureMul: number
  /** 线宽总倍率（VCL edgeWidthScale） */
  widthScale: number
  /** 是否画箭头（VCL showArrows） */
  showArrows: boolean
  /** 逐作用元素颜色覆盖（printPalette 单色时启用）；未命中回退 edge.color */
  colorOverride: Map<string, string>
  /** 逐作用元素虚线集合（逐生成元 dash / printPalette 自动交替） */
  dashSet: Set<string>
}

/** dimmed 边把颜色压到 60% 透明；CSS 变量（printPalette 的单色墨）不能拼 alpha，只靠 opacity 压暗 */
function withAlpha(color: string, dimmed: boolean, isHighlighted: boolean): string {
  if (isHighlighted || dimmed || !color.startsWith('#')) return color
  return `${color}99`
}

function renderEdgePath(
  edge: CayleyEdgeData,
  nodePositionsCache: Map<string, NodePosition>,
  ctx: EdgeRenderCtx,
  isHighlighted: boolean,
  parallelIndex: number,
  parallelCount: number,
  dimmed = false,
) {
  const {
    nodeRadius, enabledActionIndexMap, markerPrefix,
    curvatureMul, widthScale, showArrows, colorOverride, dashSet,
  } = ctx
  const fromPos = nodePositionsCache.get(edge.fromId)
  const toPos = nodePositionsCache.get(edge.toId)
  if (!fromPos || !toPos) return null

  const dx = toPos.x - fromPos.x
  const dy = toPos.y - fromPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) return null

  const baseColor = colorOverride.get(edge.actionElementId) ?? edge.color
  const color = withAlpha(baseColor, dimmed, isHighlighted)
  const strokeWidth = (isHighlighted ? 3.5 : dimmed ? 1.6 : 2.5) * widthScale
  const dashed = dashSet.has(edge.actionElementId)
  // 虚线按线宽等比放大，细线也看得清、粗线不糊成实线
  const dashArray = dashed ? `${5.5 * widthScale} ${3.5 * widthScale}` : undefined

  if (edge.isSelfLoop) {
    const scx = fromPos.x
    const scy = fromPos.y - nodeRadius - 20
    return (
      <g key={`${edge.fromId}-${edge.actionElementId}`} opacity={dimmed ? 0.12 : 1}>
        <ellipse
          cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color}
          strokeWidth={(isHighlighted ? 3.5 : 2.5) * widthScale} strokeDasharray={dashArray}
        />
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
      strokeWidth={strokeWidth}
      strokeDasharray={dashArray}
      fill="none"
      markerEnd={showArrows && !edge.isBidirectional && markerId ? `url(#${markerId})` : undefined}
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
  largeGroupThreshold = INTERACTIVE_LIMIT,
  edgeCurvature: edgeCurvatureProp,
  pathHighlight = null,
  forceDirected = false,
  force,
  quotientInsetTitle,
  nodeColorMode = 'none',
  showOrderBadge = false,
  highlightGenerated = false,
  markCenter = false,
  markNormalSubgroup = false,
  printPalette = false,
  edgeWidthScale: edgeWidthScaleProp,
  showArrows = true,
  showLegend = false,
  onToggleAction,
  decorations = null,
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

  // 商群：右侧让出一条带画「正规子群 N 的凯莱图」面板，图形主体在左侧带内居中
  // （与主画布 GroupCanvas / SetView / positionUtils 用同一份几何）
  const insetGeom = group && isQuotientGroup(group) ? quotientInsetGeometry(viewBoxSize) : null
  const showInset = !!insetGeom && (group?.identity.cosetMemberLabels?.length ?? 0) > 1
  // 让位宽度只在真出窗时生效（N = {e} 时窗不画，见 GroupCanvas 同名注释）
  const drawWidth = showInset && insetGeom ? insetGeom.drawWidth : viewBoxSize.width
  const cx = drawWidth / 2
  const cy = viewBoxSize.height / 2
  // 半径同时受容器宽/高约束：嵌入方给的 viewBox 可能宽扁（如 900×360），
  // 只按宽度取半径会让圆环上下两端节点出画布（见 feedback/issue-circular-radius-overflow.md）
  const graphRadius = circleLayoutRadius(drawWidth, viewBoxSize.height, n, nodeRadius)

  const gridPositions = useMemo(() => {
    if (!group) return null
    return computeShape2DPositions(group, shape, drawWidth, viewBoxSize.height)
  }, [group, shape, drawWidth, viewBoxSize.height])

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

  // ── VCL E 组：边样式上下文（线宽/线型/箭头/单色） ──
  const edgeWidthScale = edgeWidthScaleProp ?? 1
  const styleCtx = useMemo<EdgeRenderCtx>(() => {
    const colorOverride = new Map<string, string>()
    const dashSet = new Set<string>()
    if (printPalette) {
      // 打印/黑白：全体同色（墨色随主题：暗底白线 / 亮底深线），靠虚实交替区分生成元
      for (const a of effectiveActions) colorOverride.set(a.elementId, PRINT_INK)
      for (const a of enabledActions) {
        const idx = enabledActionIndexMap.get(a.elementId) ?? 0
        if (a.dash ?? idx % 2 === 1) dashSet.add(a.elementId)
      }
    } else {
      for (const a of effectiveActions) if (a.dash) dashSet.add(a.elementId)
    }
    return {
      nodeRadius, enabledActionIndexMap, markerPrefix,
      curvatureMul: edgeCurvatureMul, widthScale: edgeWidthScale, showArrows,
      colorOverride, dashSet,
    }
  }, [
    printPalette, effectiveActions, enabledActions, enabledActionIndexMap,
    nodeRadius, markerPrefix, edgeCurvatureMul, edgeWidthScale, showArrows,
  ])

  // ── VCL F 组：节点语义装饰（全部按需计算：关掉时零开销、零内存） ──
  const conjClassIdx = useMemo(
    () => (group && nodeColorMode === 'conjugacy' ? conjugacyClassIndexMap(group) : null),
    [group, nodeColorMode],
  )
  const conjClassN = useMemo(
    () => (group && nodeColorMode === 'conjugacy' ? conjugacyClassCount(group) : 0),
    [group, nodeColorMode],
  )
  // 元素阶：徽标用；⟨g⟩ 高亮还要拿它算循环长度
  const orderMap = useMemo(
    () => (group && (showOrderBadge || highlightGenerated) ? elementOrderMap(group) : null),
    [group, showOrderBadge, highlightGenerated],
  )
  const centerIds = useMemo(
    () => (group && markCenter ? centerElementIds(group) : null),
    [group, markCenter],
  )
  const normalIds = useMemo(() => {
    if (!group || !markNormalSubgroup) return null
    const ids = smallestNormalSubgroupIds(group)
    return ids ? new Set(ids) : null
  }, [group, markNormalSubgroup])
  // ⟨g⟩ 闭包：选中元素生成的循环子群 —— 高亮其全部成员节点，并把两端都落在其中的边
  // 提升为全色加粗（诱导子图口径：子群内部的边本就属于「这一块」，不必逐边判是否沿幂次相邻）
  const generatedIds = useMemo(() => {
    if (!group || !highlightGenerated || selectedElements.size === 0) return null
    const ids = new Set<string>()
    for (const id of selectedElements) {
      const el = group.elements.find(e => e.id === id)
      if (!el) continue
      for (const member of cyclicSubgroupElements(group, el)) ids.add(member.id)
    }
    return ids.size > 0 ? ids : null
  }, [group, highlightGenerated, selectedElements])

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

  // ── Decorations（VCL DEC-2）：注释叠层 ──
  // 文本 → KaTeX HTML（按 text 去重，注释数量少，随 decorations 变化重算）
  const annotationHtmlCache = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of decorations?.annotations ?? []) {
      if (!m.has(a.text)) m.set(a.text, renderTex(texify(a.text)))
    }
    return m
  }, [decorations])

  // 边锚点对端查找：(起点 id|作用元素 id) → 对端 id
  const edgeNeighborIndex = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of edges) {
      if (!e.actionElementId) continue
      m.set(`${e.fromId}|${e.actionElementId}`, e.toId)
    }
    return m
  }, [edges])

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
      // ⟨g⟩ 闭包内的边（两端都在子群内）= 全色加粗，与选中重绘同一视觉档
      const inGenerated = !!generatedIds && generatedIds.has(edge.fromId) && generatedIds.has(edge.toId)
      return renderEdgePath(
        edge, nodePositionsCache, styleCtx, inGenerated, pi?.index ?? 0, pi?.count ?? 1, dimmed,
      )
    })
  }, [edges, nodePositionsCache, styleCtx, group, parallelInfo, pathEdgeKeys, generatedIds])

  // 选中相关边全色加粗重绘于基础边之上
  const highlightedEdges = useMemo(() => {
    if (!group || selectedElements.size === 0) return null
    return edges
      .filter(edge => selectedElements.has(edge.fromId) || selectedElements.has(edge.toId))
      .map(edge => {
        const pi = parallelInfo.get(edgeKey(edge))
        return renderEdgePath(
          edge, nodePositionsCache, styleCtx, true, pi?.index ?? 0, pi?.count ?? 1,
        )
      })
  }, [edges, selectedElements, nodePositionsCache, styleCtx, group, parallelInfo])

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

  // 注释叠层：锚点 → 坐标（纯函数），节点/边锚点跟随实时坐标（与路径高亮同一坐标来源）
  const decorationElements = useMemo(() => {
    const items = decorations?.annotations ?? []
    if (!group || items.length === 0) return null
    const lookup: AnchorLookup = {
      resolveId: ref => resolveElement(group, ref)?.id ?? null,
      positions: nodePositionsCache,
      neighborOf: (fromId, actionId) => edgeNeighborIndex.get(`${fromId}|${actionId}`) ?? null,
    }
    // 引导线端点 = 元素实际位置（去掉默认/自定义偏移）
    const rawLookup: AnchorLookup = { ...lookup, nodeOffset: { dx: 0, dy: 0 }, edgeOffset: { dx: 0, dy: 0 } }
    return (
      <g style={{ pointerEvents: 'none' }} data-testid="cayley-annotations">
        {items.map(a => {
          const p = resolveAnnotationAnchor(a.anchor, lookup)
          if (!p) return null
          const color = a.color ?? 'var(--text-primary)'
          const isFigure = a.anchor.type === 'figure'
          const from = a.leader && !isFigure
            ? resolveAnnotationAnchor({ ...a.anchor, offset: undefined }, rawLookup)
            : null
          return (
            <g key={a.id} data-testid={`annotation-${a.id}`}>
              {from && (
                <line
                  x1={from.x} y1={from.y} x2={p.x} y2={p.y}
                  stroke={color} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.75}
                />
              )}
              <foreignObject
                // 节点/边锚点：文本以锚点为中心（贴在元素旁）；整图锚点：锚点 = 文本左上角，
                // 否则居中会让靠左的整图注释被视图边缘裁掉
                x={isFigure ? p.x : p.x - 120} y={p.y - 15} width={240} height={30}
                style={{ overflow: 'visible', pointerEvents: 'none', userSelect: 'none' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: isFigure ? 'flex-start' : 'center',
                  width: '100%', height: '100%',
                }}>
                  <span
                    style={{
                      display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                      color, fontSize: 13, lineHeight: 1.25, whiteSpace: 'nowrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: annotationHtmlCache.get(a.text) ?? '' }}
                  />
                </div>
              </foreignObject>
            </g>
          )
        })}
      </g>
    )
  }, [group, decorations, nodePositionsCache, edgeNeighborIndex, annotationHtmlCache])

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
      let fillOpacity = 1
      let strokeColor = 'var(--node-stroke)'
      let strokeWidth = 2.5
      if (isSdFixed) {
        fillColor = 'var(--accent-teal)22'
        strokeColor = 'var(--accent-teal)'
        strokeWidth = 3
      }
      // VCL F1：共轭类着色（半透明填充 + 实色描边，标签仍可读）
      if (conjClassIdx) {
        const c = conjugacyClassColor(conjClassIdx.get(el.id) ?? 0, conjClassN)
        fillColor = c
        fillOpacity = 0.45
        strokeColor = c
        strokeWidth = 3
      }
      const isCentral = !!centerIds?.has(el.id)
      const isNormalMember = !!normalIds?.has(el.id)
      const isGenerated = !!generatedIds?.has(el.id)
      const order = orderMap?.get(el.id)
      const badgeR = Math.max(7, nodeRadius * 0.3)

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
          {/* VCL F4：正规子群 N 成员（虚线外圈）与中心 Z(G)（双实线环）。
              画在节点圆之下，避免盖住填充；两者可同时命中（半径不同，互不遮挡） */}
          {isNormalMember && (
            <circle
              r={nodeRadius + RING_NORMAL_OFFSET} fill="none" stroke={RING_NORMAL}
              strokeWidth={2} strokeDasharray="5 4" opacity={0.9}
            />
          )}
          {isCentral && (
            <>
              <circle r={nodeRadius + RING_CENTER_INNER} fill="none" stroke={RING_CENTER} strokeWidth={2} opacity={0.95} />
              <circle r={nodeRadius + RING_CENTER_OUTER} fill="none" stroke={RING_CENTER} strokeWidth={1.6} opacity={0.8} />
            </>
          )}
          {/* VCL F3：⟨g⟩ 闭包成员外圈（最外一环，与中心/正规标记区分） */}
          {isGenerated && (
            <circle r={nodeRadius + RING_GEN_OFFSET} fill="none" stroke={RING_GENERATED} strokeWidth={3.5} opacity={0.95} />
          )}
          <circle
            r={nodeRadius}
            fill={fillColor}
            fillOpacity={fillOpacity}
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
          {/* VCL F2：元素阶徽标（大群退化模式不画——那里连标签都省了，画满角标只会糊） */}
          {showOrderBadge && order !== undefined && !isLargeGraph && (
            <g transform={`translate(${nodeRadius * 0.72}, ${-nodeRadius * 0.72})`}>
              <circle r={badgeR} fill="var(--node-stroke)" />
              <text
                x={0} y={badgeR * 0.36}
                textAnchor="middle" fontSize={badgeR * 1.15} fontWeight={700}
                fill="var(--node-fill)" style={{ userSelect: 'none' }}
              >{order}</text>
            </g>
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
    // VCL F 组：语义装饰数据
    conjClassIdx, conjClassN, centerIds, normalIds, generatedIds, orderMap, showOrderBadge,
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

  // ── VCL E2：生成元图例（色块 + 记号 + 线型预览；点击行 = 切换该生成元边显隐） ──
  const legendOverlay = useMemo(() => {
    if (!showLegend || !group || effectiveActions.length === 0) return null
    const rowH = 17
    const swatch = 10
    const pad = 8
    const w = 156
    const rows = effectiveActions.slice(0, LEGEND_MAX_ROWS)
    const more = effectiveActions.length - rows.length
    const h = pad * 2 + 15 + rows.length * rowH + (more > 0 ? rowH : 0)
    return (
      <g
        transform="translate(12, 12)"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <rect width={w} height={h} rx={5} fill="var(--bg-secondary)" stroke="var(--border-primary)" opacity={0.93} />
        <text x={pad} y={pad + 10} fontSize={10} fontWeight={600} fill="var(--text-dim)" style={{ userSelect: 'none' }}>
          Generators
        </text>
        {rows.map((a, i) => {
          const y = pad + 15 + i * rowH
          const off = !a.enabled
          return (
            <g
              key={a.elementId}
              opacity={off ? 0.4 : 1}
              style={{ cursor: onToggleAction ? 'pointer' : 'default' }}
              onClick={() => onToggleAction?.(a.elementId)}
            >
              <rect
                x={pad} y={y + 1} width={swatch} height={swatch} rx={2}
                fill={styleCtx.colorOverride.get(a.elementId) ?? a.color}
                stroke="var(--border-primary)"
                strokeDasharray={styleCtx.dashSet.has(a.elementId) ? '3 2' : undefined}
              />
              <foreignObject x={pad + swatch + 6} y={y - 3} width={w - pad * 2 - swatch - 6} height={rowH}>
                <div
                  style={{
                    fontSize: 11, color: 'var(--text-secondary)', lineHeight: `${rowH}px`,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: off ? 'line-through' : 'none',
                  }}
                  dangerouslySetInnerHTML={{ __html: labelHtmlCache.get(a.elementId) ?? '' }}
                />
              </foreignObject>
            </g>
          )
        })}
        {more > 0 && (
          <text x={pad} y={pad + 15 + rows.length * rowH + 10} fontSize={10} fill="var(--text-dim)">
            +{more} more…
          </text>
        )}
      </g>
    )
  }, [showLegend, group, effectiveActions, styleCtx, labelHtmlCache, onToggleAction])

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
            <path d="M0,0 L0,6 L9,3 z" fill={styleCtx.colorOverride.get(action.elementId) ?? action.color} />
          </marker>
        ))}
      </defs>

      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edgeElements}
        {highlightedEdges}

        {nodeElements}
        {selectionOverlay}
        {pathOverlay}
        {decorationElements}
      </g>

      {showInset && insetGeom && group && (
        <QuotientSubgroupInset
          group={group}
          anchor={(() => {
            const p = nodePositionsCache.get(group.identity.id)
            const pos = p ?? { x: cx, y: cy }
            return {
              x: pos.x * canvasTransform.scale + canvasTransform.x,
              y: pos.y * canvasTransform.scale + canvasTransform.y,
            }
          })()}
          anchorRadius={nodeRadius * canvasTransform.scale}
          geometry={insetGeom}
          title={quotientInsetTitle}
        />
      )}

      {legendOverlay}
    </svg>
  )
}

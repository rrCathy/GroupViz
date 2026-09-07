import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import {
  computeSubgroupLattice,
  mergeLatticeByConjugacy,
  subgroupSetKey,
  subgroupStructureSymbol,
  getGroupCenter,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from '../../core/algebra/subgroups'
import {
  computeLatticeLayout,
  latticeLodTier,
  latticeSlotScreenSize,
  latticeFitScale,
} from '../../core/algebra/latticeLayout'
import { texify, renderTex } from '../../utils/texify'
import { factorizeOrder } from '../../core/algebra/sylow'
import { computeChainFactors, type SeriesType, type SeriesFactor } from '../../core/algebra/series'
import type {
  CanvasTransform,
  Group,
  GroupElement,
  LatticeLabelDetail,
  LatticeLodTier,
  Subset,
} from '../../core/types'

const SERIES_COLORS: Record<SeriesType, { light: string; dark: string }> = {
  derived: { light: '#b8860b', dark: '#ffd93d' },
  upperCentral: { light: '#0e7490', dark: '#22d3ee' },
  lowerCentral: { light: '#0e7490', dark: '#22d3ee' },
  composition: { light: '#7c3aed', dark: '#c084fc' },
}

/** compact 档胶囊 / dots 档圆点的期望屏幕尺寸（px，被槽位尺寸封顶故永不重叠） */
const COMPACT_PILL = { w: 104, h: 28, font: 13 }
const DOT_R = 8
const ORBIT_FONT = 11

/** 屏幕恒定 px → 世界单位（受 cap 封顶，cap 用世界单位表示） */
function toWorld(screenPx: number, eff: number, cap: number): number {
  return Math.min(screenPx / Math.max(eff, 1e-4), cap)
}

/** 轨道格节点上携带的附加字段（未合并时都不存在） */
interface OrbitFields {
  orbitSize?: number
  normalizerOrder?: number
}

export interface LatticeData {
  nodes: SubgroupLatticeNode[]
  edges: SubgroupLatticeEdge[]
}

/** 子群列（Series）状态：由宿主组装后传入，内核只负责高亮与面板呈现 */
export interface SublatticeSeriesState {
  type: SeriesType
  /** 系列项的元素集合；null 表示后端仍在计算 / 超过守卫 */
  terms: GroupElement[][] | null
  factors?: SeriesFactor[] | null
  solvable?: boolean
  nilpotent?: boolean
  chainCount?: number
  truncated?: boolean
  loading?: boolean
}

export interface SublatticeSceneProps {
  group: Group | null
  /** 外部提供则优先（大群后端通路）；缺省内核对 order ≤ 60 自行枚举 */
  lattice?: LatticeData | null
  canvasTransform?: CanvasTransform
  /** 宿主可用像素尺寸；缺省由 ResizeObserver 实测自身容器 */
  availableSize?: { width: number; height: number }
  /** 名片细节档，缺省 'auto'（按槽位屏幕宽度自动降级） */
  labelDetail?: LatticeLabelDetail
  /** 共轭子群合并为轨道节点，缺省 false */
  mergeConjugates?: boolean
  /** 名片与层距的世界单位乘子，缺省 1 */
  nodeScale?: number
  /** 底部子群列面板，缺省 true */
  showSeriesPanel?: boolean
  series?: SublatticeSeriesState | null
  /** 群中心元素 id 列表（宿主已算好时传入，省一次本地计算） */
  centerIds?: string[]
  subsets?: Subset[]
  activeNodeIdx?: number | null
  onActivateNode?: (idx: number | null, node: SubgroupLatticeNode | null) => void
  noGroupText?: string
}

function buildPalette(theme: string) {
  if (theme === 'light') {
    return {
      edge: '#a9adbc',
      edgeOpacity: 0.95,
      edgeWidth: 2.5,
      pathEdge: '#d4a017',
      pathEdgeWidth: 4,
      nodeFill: '#eef1f5',
      nodeStroke: '#2d8f85',
      nodeStrokeNormal: '#7c5cc0',
      nodeText: '#1c1c28',
      nodeSubText: '#5a5a6a',
      pathFill: '#fbf1d0',
      pathStroke: '#d4a017',
      pathText: '#7a5d00',
      pathSubText: '#8a6d00cc',
      activeFill: '#d8ecda',
      trivialFill: '#e8e8f1',
      trivialStroke: '#9a9ab0',
      fullFill: '#e7edf7',
      fullStroke: '#3a6fb0',
      centerFill: '#fdf3c7',
      centerStroke: '#b8860b',
      sylowText: '#c2410c',
      dotPlain: '#8d93a8',
      seriesBadgeText: '#fff',
    }
  }
  return {
    edge: '#4a4a7a',
    edgeOpacity: 0.85,
    edgeWidth: 2.5,
    pathEdge: '#ffd93d',
    pathEdgeWidth: 4,
    nodeFill: '#151f1a',
    nodeStroke: '#3ea89e',
    nodeStrokeNormal: '#8968c8',
    nodeText: '#ddd',
    nodeSubText: '#777',
    pathFill: '#1e3a1e',
    pathStroke: '#ffd93d',
    pathText: '#ffd93d',
    pathSubText: '#ffd93dcc',
    activeFill: '#2a4a2a',
    trivialFill: '#1a1a2e',
    trivialStroke: '#555',
    fullFill: '#1a1f30',
    fullStroke: '#5588cc',
    centerFill: '#3a3020',
    centerStroke: '#ffd93d',
    sylowText: '#fb923c',
    dotPlain: '#6b7280',
    seriesBadgeText: '#111',
  }
}

/** 邻接表（无向）——只建一次，路径搜索不再每 pop 扫全边表 */
function buildAdjacency(nodeCount: number, edges: SubgroupLatticeEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: nodeCount }, () => [])
  for (const e of edges) {
    if (e.from >= 0 && e.from < nodeCount && e.to >= 0 && e.to < nodeCount) {
      adj[e.from].push(e.to)
      adj[e.to].push(e.from)
    }
  }
  return adj
}

function findPath(adjacency: number[][], start: number, end: number): number[] | null {
  if (start === end) return [start]
  const visited = new Set<number>()
  const queue: number[][] = [[start]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const last = path[path.length - 1]
    if (last === end) return path
    if (visited.has(last)) continue
    visited.add(last)
    for (const nb of adjacency[last] ?? []) {
      if (!visited.has(nb)) queue.push([...path, nb])
    }
  }
  return null
}

// ────────────────────────── Series 面板（纯呈现） ──────────────────────────

interface SeriesPanelProps {
  group: Group
  series: SublatticeSeriesState
  color: string | null
}

/** 子群列链式展示：N₀ ⊵ N₁ ⊵ … + 各级阶 + 因子 + 可解/幂零徽标（由原视图内联 JSX 迁出） */
export function SeriesPanel({ group, series, color }: SeriesPanelProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { type, terms, factors, solvable, nilpotent, chainCount, truncated, loading } = series

  const chainTeX = terms
    ? terms.map((term, ti) => {
        const label = term.length === 1
          ? '\\langle e \\rangle'
          : term.length === group.order
            ? texify(group.symbol)
            : `N_{${ti}}`
        return (ti === 0 ? '' : ' \\trianglerighteq ') + label
      }).join('')
    : ''
  const ordersTeX = terms
    ? terms.map((term, ti) => `|N_{${ti}}| = ${term.length}`).join(',\\;')
    : ''
  const factorsTeX = factors
    ? factors.map((f, i) => `N_{${i}}/N_{${i + 1}} \\cong ${f.label}`).join(',\\;')
    : ''
  const multisetText = factors
    ? [...factors]
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
        .map(f => f.label)
        .join(', ')
    : ''

  const chipSolvable = theme === 'light' ? '#15803d' : '#4ade80'
  const chipNilpotent = theme === 'light' ? '#0369a1' : '#38bdf8'

  return (
    <div
      className="series-panel"
      style={{
        borderTop: '1px solid var(--border-primary)',
        background: 'var(--bg-panel)',
        padding: '8px 12px',
        fontSize: 12,
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {terms ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px' }}>
            <span style={{ fontWeight: 600, color: color ?? undefined }}>{t(`series.${type}`)}</span>
            <span dangerouslySetInnerHTML={{ __html: renderTex(chainTeX) }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginTop: 3 }}>
            <span style={{ color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: renderTex(ordersTeX) }} />
          </div>
          {factors && factors.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginTop: 3 }}>
              <span dangerouslySetInnerHTML={{ __html: renderTex(factorsTeX) }} />
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 5 }}>
            {solvable && (
              <span style={{ border: `1px solid ${chipSolvable}`, color: chipSolvable, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{t('series.solvable')}</span>
            )}
            {nilpotent && (
              <span style={{ border: `1px solid ${chipNilpotent}`, color: chipNilpotent, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{t('series.nilpotent')}</span>
            )}
            {type === 'composition' && factors && factors.length > 0 && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>{t('series.factors')}: {multisetText}</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('series.jordanHolder')}</span>
              </>
            )}
            {type === 'composition' && chainCount !== undefined && chainCount > 1 && (
              <span style={{ color: 'var(--text-muted)' }}>{t('series.alternativeChains', { n: String(chainCount) })}</span>
            )}
            {type === 'composition' && truncated && (
              <span style={{ color: 'var(--accent-yellow-text)' }}>{t('series.truncated')}</span>
            )}
          </div>
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>
          {loading ? t('series.loading') : t('series.tooLarge')}
        </span>
      )}
    </div>
  )
}

// ────────────────────────── 受控内核 ──────────────────────────

/**
 * 子群格受控内核（FGVE 阶段 2 批次三）。
 *
 * 小窗口里的可读性靠三件事：
 *  1. 布局世界坐标紧贴内容（`computeLatticeLayout`，无 1000×600 下限），适配缩放
 *     钳 ≤ 1，故主画布不会被撑大、小窗也不会被 letterbox 到不可读；
 *  2. 名片按"槽位屏幕宽度"自动降级 full → compact → dots；compact/dots 的几何按
 *     `1/eff` 反算为屏幕恒定大小，同时被槽位宽封顶，所以在任何密度下都不重叠；
 *  3. 省掉的文字不丢——底部 caption 行按 hover ?? 选中给出完整名片；密度真的高时
 *     用 `mergeConjugates` 把共轭子群合成一个轨道节点（×n，n = |G : N_G(H)|）。
 */
export function SublatticeScene({
  group,
  lattice,
  canvasTransform,
  availableSize,
  labelDetail = 'auto',
  mergeConjugates = false,
  nodeScale = 1,
  showSeriesPanel = true,
  series = null,
  centerIds,
  subsets,
  activeNodeIdx: activeNodeIdxProp,
  onActivateNode,
  noGroupText,
}: SublatticeSceneProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const palette = useMemo(() => buildPalette(theme), [theme])

  // 绘图区可用像素（不含 caption/series 面板）：优先外部 availableSize，否则实测 svg 自身。
  // svg 必须是宿主的直接 flex 子元素并用 getBoundingClientRect 测量——若外面再包一层
  // div，svg 会按 viewBox 宽高比反推自身高度而撑破窗口。测得 0 → fit 视为 1。
  const svgHostRef = useRef<SVGSVGElement | null>(null)
  const [measured, setMeasured] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = svgHostRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setMeasured({ width: r.width, height: r.height })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [group?.symbol])
  const availW = availableSize?.width ?? measured.width
  const availH = availableSize?.height ?? measured.height

  const ct: CanvasTransform = canvasTransform ?? { x: 0, y: 0, scale: 1 }

  const baseLattice = useMemo<LatticeData | null>(() => {
    if (lattice !== undefined) return lattice
    if (!group || group.order > 60) return null
    return computeSubgroupLattice(group)
  }, [group, lattice])

  // 共轭轨道合并：mergedOf[原下标] = 轨道格下标（未合并时 null）
  const { viewNodes, viewEdges, mergedOf, mergeUnavailable } = useMemo(() => {
    if (!baseLattice) {
      return {
        viewNodes: [] as SubgroupLatticeNode[],
        viewEdges: [] as SubgroupLatticeEdge[],
        mergedOf: null as number[] | null,
        mergeUnavailable: false,
      }
    }
    const identity = {
      viewNodes: baseLattice.nodes,
      viewEdges: baseLattice.edges,
      mergedOf: null as number[] | null,
      mergeUnavailable: false,
    }
    if (!mergeConjugates || !group) return identity
    const merged = mergeLatticeByConjugacy(group, baseLattice.nodes, baseLattice.edges)
    if (!merged) return { ...identity, mergeUnavailable: true }
    return {
      viewNodes: merged.nodes as SubgroupLatticeNode[],
      viewEdges: merged.edges,
      mergedOf: merged.orbitOf,
      mergeUnavailable: false,
    }
  }, [baseLattice, mergeConjugates, group])

  const layout = useMemo(
    () => computeLatticeLayout(viewNodes, viewEdges, { nodeScale }),
    [viewNodes, viewEdges, nodeScale]
  )

  // 疏密/降档推导：一次算好放进同一个 memo，避免逐帧重算的裸值进下游 memo 依赖
  const density = useMemo(() => {
    const fit = latticeFitScale(availW, availH, layout.viewW, layout.viewH)
    const eff = fit * ct.scale
    const { slotScreenWidth, rowScreenHeight } = latticeSlotScreenSize(
      layout.slotW, layout.rowH, fit, ct.scale
    )
    const tier: LatticeLodTier = labelDetail === 'auto'
      ? latticeLodTier(slotScreenWidth, rowScreenHeight)
      : labelDetail
    const edgeWidth = tier === 'full'
      ? palette.edgeWidth
      : toWorld(1.7, eff, layout.nodeRx * 0.1)
    return { fit, eff, slotScreenWidth, rowScreenHeight, tier, edgeWidth }
  }, [availW, availH, layout, ct.scale, labelDetail, palette])
  const { eff, slotScreenWidth, tier, edgeWidth } = density

  const { fullIdx, trivialIdx } = useMemo(() => {
    const order = group?.order ?? 0
    return {
      fullIdx: viewNodes.findIndex(nd => nd.order === order),
      trivialIdx: viewNodes.findIndex(nd => nd.order === 1),
    }
  }, [viewNodes, group])

  const centerSet = useMemo(() => {
    if (centerIds) return new Set(centerIds)
    if (!group || group.order > 60) return null
    return new Set(getGroupCenter(group).map(e => e.id))
  }, [group, centerIds])

  const centerIdx = useMemo(() => {
    if (!centerSet || centerSet.size === 0) return -1
    return viewNodes.findIndex(nd => {
      if (nd.elementIds.length !== centerSet.size) return false
      return nd.elementIds.every(id => centerSet.has(id))
    })
  }, [viewNodes, centerSet])

  const sylowOrderToP = useMemo(() => {
    const map = new Map<number, number>()
    if (!group) return map
    for (const { prime, exponent } of factorizeOrder(group.order)) {
      let pPower = 1
      for (let i = 0; i < exponent; i++) pPower *= prime
      map.set(pPower, prime)
    }
    return map
  }, [group])

  const [activeNodeIdxState, setActiveNodeIdxState] = useState<number | null>(null)
  const activeNodeIdx = activeNodeIdxProp ?? activeNodeIdxState
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const adjacency = useMemo(
    () => buildAdjacency(viewNodes.length, viewEdges),
    [viewNodes, viewEdges]
  )

  const pathIndices = useMemo(() => {
    if (activeNodeIdx === null || viewNodes.length === 0) return new Set<number>()
    const set = new Set<number>()
    const upPath = fullIdx >= 0 ? findPath(adjacency, activeNodeIdx, fullIdx) : null
    const downPath = trivialIdx >= 0 ? findPath(adjacency, activeNodeIdx, trivialIdx) : null
    if (upPath) upPath.forEach(i => set.add(i))
    if (downPath) downPath.forEach(i => set.add(i))
    return set
  }, [activeNodeIdx, adjacency, fullIdx, trivialIdx, viewNodes])

  const pathEdgeSet = useMemo(() => {
    const set = new Set<number>()
    if (pathIndices.size === 0) return set
    for (let ei = 0; ei < viewEdges.length; ei++) {
      const e = viewEdges[ei]
      if (pathIndices.has(e.from) && pathIndices.has(e.to)) set.add(ei)
    }
    return set
  }, [pathIndices, viewEdges])

  const seriesColor = useMemo(() => {
    if (!series) return null
    const c = SERIES_COLORS[series.type]
    return theme === 'light' ? c.light : c.dark
  }, [series, theme])

  // 元素集合键 → 视图节点下标：合并态把轨道每个成员的键都指回该轨道节点，
  // 于是共轭但非相等的系列项仍能命中（D6）
  const keyToNodeIdx = useMemo(() => {
    const map = new Map<string, number>()
    if (!baseLattice) return map
    baseLattice.nodes.forEach((nd, i) => {
      const k = subgroupSetKey(nd.elementIds)
      if (!map.has(k)) map.set(k, mergedOf ? mergedOf[i] : i)
    })
    return map
  }, [baseLattice, mergedOf])

  const seriesNodeMap = useMemo(() => {
    const map = new Map<number, number>()
    if (!series?.terms) return map
    series.terms.forEach((term, ti) => {
      const ni = keyToNodeIdx.get(subgroupSetKey(term.map(e => e.id)))
      if (ni !== undefined && !map.has(ni)) map.set(ni, ti)
    })
    return map
  }, [series, keyToNodeIdx])

  const seriesNodeSet = useMemo(() => new Set(seriesNodeMap.keys()), [seriesNodeMap])

  const edgeElements = useMemo(() => {
    // 节点实际渲染高度按 tier 选：full 用 layout 默认矩形高度，compact 胶囊和 dots 圆点
    // 都是屏幕恒定像素，所以线段 y 偏移要用对应的世界单位——否则 compact/dots 下偏移过大，
    // 线段终点落到节点外侧"线头"，看着像没对齐。
    const edgeNodeHalfH = tier === 'compact'
      ? toWorld(COMPACT_PILL.h / 2, eff, layout.nodeRy * 0.9)
      : tier === 'dots'
        ? toWorld(DOT_R, eff, layout.nodeRx * 0.42)
        : layout.nodeRy
    return viewEdges.map((edge, i) => {
      const fromPos = layout.positions[edge.from]
      const toPos = layout.positions[edge.to]
      if (!fromPos || !toPos) return null
      const onPath = pathEdgeSet.has(i)
      return (
        <line
          key={`edge-${i}`}
          x1={fromPos.x}
          y1={fromPos.y + edgeNodeHalfH}
          x2={toPos.x}
          y2={toPos.y - edgeNodeHalfH}
          stroke={onPath ? palette.pathEdge : palette.edge}
          strokeWidth={onPath ? Math.max(palette.pathEdgeWidth, edgeWidth) : edgeWidth}
          opacity={onPath ? 1 : tier === 'dots' ? 0.75 : palette.edgeOpacity}
        />
      )
    })
  }, [viewEdges, layout, pathEdgeSet, palette, tier, edgeWidth, eff])

  const subsetSets = useMemo(
    () => (subsets ?? []).map(s => ({ color: s.color, set: new Set(s.elementIds) })),
    [subsets]
  )

  const nodeElements = useMemo(() => {
    return viewNodes.map((node, i) => {
      const pos = layout.positions[i]
      if (!pos) return null

      const orbitSize = (node as SubgroupLatticeNode & OrbitFields).orbitSize ?? 1
      const onPath = pathIndices.has(i)
      const isActive = activeNodeIdx === i
      const isTrivial = node.order === 1
      const isFull = node.order === (group?.order ?? 0)
      const isCenter = i === centerIdx
      const sylowP = node.order > 1 ? sylowOrderToP.get(node.order) : undefined
      const termIdx = seriesNodeMap.get(i)
      const isDimmed = !!series?.terms && termIdx === undefined && !seriesNodeSet.has(i)

      let fillColor = palette.nodeFill
      let strokeColor = node.isNormal ? palette.nodeStrokeNormal : palette.nodeStroke
      let strokeWidth = 2.5
      let textColor = palette.nodeText

      if (onPath && !(termIdx !== undefined && seriesColor)) {
        fillColor = palette.pathFill
        strokeColor = palette.pathStroke
        strokeWidth = 4
        textColor = palette.pathText
      }
      if (isActive) {
        fillColor = palette.activeFill
        strokeWidth = 4
      }
      if (isCenter && !onPath) {
        fillColor = palette.centerFill
        strokeColor = palette.centerStroke
      }
      if (isTrivial && !onPath) {
        fillColor = palette.trivialFill
        strokeColor = palette.trivialStroke
        strokeWidth = 2
      }
      if (isFull && !onPath) {
        fillColor = palette.fullFill
        strokeColor = palette.fullStroke
      }
      if (termIdx !== undefined && seriesColor) {
        strokeColor = seriesColor
        strokeWidth = tier === 'full'
          ? 4
          : Math.max(toWorld(3, eff, layout.nodeRx * 0.1), edgeWidth)
      }

      const parentSubset = subsetSets.find(ss => node.elementIds.every(eid => ss.set.has(eid)))

      const handlers = {
        onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          if (activeNodeIdx === i) {
            setActiveNodeIdxState(null)
            onActivateNode?.(null, null)
          } else {
            setActiveNodeIdxState(i)
            onActivateNode?.(i, node)
          }
        },
        onMouseEnter: () => setHoverIdx(i),
        onMouseLeave: () => setHoverIdx(cur => (cur === i ? null : cur)),
      }
      const groupStyle = { cursor: 'pointer', opacity: isDimmed ? 0.22 : 1 }

      // ── dots：屏幕恒定圆点，类别靠颜色编码，×n 与系列命中保留 ──
      if (tier === 'dots') {
        const r = toWorld(DOT_R, eff, layout.nodeRx * 0.42)
        const dotFill = termIdx !== undefined && seriesColor
          ? seriesColor
          : isCenter
            ? palette.centerStroke
            : sylowP !== undefined
              ? palette.sylowText
              : isFull
                ? palette.fullStroke
                : isTrivial
                  ? palette.trivialStroke
                  : node.isNormal
                    ? palette.nodeStrokeNormal
                    : palette.dotPlain
        return (
          <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} style={groupStyle} data-lattice-node={i} {...handlers}>
            <circle cx={0} cy={0} r={toWorld(14, eff, layout.nodeRx)} fill="transparent" stroke="none" />
            <circle
              cx={0}
              cy={0}
              r={r}
              fill={onPath ? palette.pathFill : dotFill}
              stroke={onPath ? palette.pathStroke : dotFill}
              strokeWidth={onPath || isActive ? toWorld(2.5, eff, r) : 0}
            />
            {orbitSize > 1 && (
              <text
                x={r + toWorld(3, eff, layout.nodeRx * 0.2)}
                y={toWorld(-3, eff, layout.nodeRy * 0.5)}
                textAnchor="start"
                fill={palette.nodeSubText}
                fontSize={toWorld(ORBIT_FONT, eff, layout.nodeRx * 0.6)}
                fontFamily="monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                ×{orbitSize}
              </text>
            )}
          </g>
        )
      }

      // ── compact：屏幕恒定胶囊，只留一行（结构阶数字 / ×n / 顶层群符号） ──
      if (tier === 'compact') {
        const hw = toWorld(COMPACT_PILL.w / 2, eff, layout.nodeRx * 0.94)
        const hh = toWorld(COMPACT_PILL.h / 2, eff, layout.nodeRy * 0.9)
        const fs = toWorld(COMPACT_PILL.font, eff, layout.nodeRx * 0.5)
        return (
          <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} style={groupStyle} data-lattice-node={i} {...handlers}>
            <rect
              x={-hw}
              y={-hh}
              width={hw * 2}
              height={hh * 2}
              rx={hh}
              ry={hh}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {parentSubset && !onPath && (
              <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2} rx={hh} ry={hh} fill={`${parentSubset.color}22`} stroke="none" />
            )}
            <text
              y={fs * 0.36}
              textAnchor="middle"
              fill={textColor}
              fontSize={fs}
              fontWeight={isActive ? 'bold' : 'normal'}
              fontFamily="monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {isTrivial
                ? 'e'
                : isFull
                  ? ''
                  : `${node.order}`}
            </text>
            {orbitSize > 1 && !isFull && (
              <text
                x={hw - fs * 0.35}
                y={fs * 0.36}
                textAnchor="end"
                fill={palette.nodeSubText}
                fontSize={fs * 0.85}
                fontFamily="monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                ×{orbitSize}
              </text>
            )}
            {isFull && group && (
              <foreignObject
                x={-hw}
                y={-hh}
                width={hw * 2}
                height={hh * 2}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%', color: textColor, fontSize: fs,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }}
                />
              </foreignObject>
            )}
            {termIdx !== undefined && seriesColor && (
              <circle cx={-hw + hh * 0.55} cy={0} r={hh * 0.3} fill={seriesColor} stroke="none" style={{ pointerEvents: 'none' }} />
            )}
            {isCenter && (
              <circle cx={hw - hh * 0.55} cy={0} r={hh * 0.3} fill={palette.centerStroke} stroke="none" style={{ pointerEvents: 'none' }} />
            )}
          </g>
        )
      }

      // ── full：完整名片（与 props 化之前的主画布一致） ──
      const nodeRx = layout.nodeRx
      const nodeRy = layout.nodeRy
      return (
        <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} style={groupStyle} data-lattice-node={i} {...handlers}>
          <rect
            x={-nodeRx}
            y={-nodeRy}
            width={nodeRx * 2}
            height={nodeRy * 2}
            rx={12}
            ry={12}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          {parentSubset && !onPath && (
            <rect
              x={-nodeRx}
              y={-nodeRy}
              width={nodeRx * 2}
              height={nodeRy * 2}
              rx={12}
              ry={12}
              fill={`${parentSubset.color}22`}
              stroke="none"
            />
          )}
          <text
            y={-8}
            textAnchor="middle"
            fill={textColor}
            fontSize="15px"
            fontWeight={isActive ? 'bold' : 'normal'}
            fontFamily="monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {isTrivial ? '⟨e⟩' : isFull ? '' : orbitSize > 1 ? `|H|=${node.order} ×${orbitSize}` : `|H|=${node.order}`}
          </text>
          {isCenter && (
            <text
              x={nodeRx - 6}
              y={-nodeRy + 12}
              textAnchor="end"
              fill={palette.centerStroke}
              fontSize={10}
              fontWeight="bold"
              fontFamily="monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              Z(G)
            </text>
          )}
          {sylowP !== undefined && (
            <text
              x={-nodeRx + 6}
              y={-nodeRy + 12}
              textAnchor="start"
              fill={palette.sylowText}
              fontSize={10}
              fontWeight="bold"
              fontFamily="monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {t('lattice.sylow', { p: String(sylowP) })}
            </text>
          )}
          {termIdx !== undefined && seriesColor && (
            <g style={{ pointerEvents: 'none' }}>
              <circle cx={-nodeRx + 12} cy={nodeRy - 12} r={9} fill={seriesColor} stroke="none" />
              <text
                x={-nodeRx + 12}
                y={nodeRy - 8}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill={palette.seriesBadgeText}
                fontFamily="monospace"
              >
                {termIdx}
              </text>
            </g>
          )}
          {isFull && group && (
            <foreignObject
              x={-nodeRx + 6}
              y={-nodeRy + 2}
              width={nodeRx * 2 - 12}
              height={nodeRy * 2 - 4}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', color: textColor, fontSize: '15px',
                }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }}
              />
            </foreignObject>
          )}
          <text
            y={13}
            textAnchor="middle"
            fill={onPath ? palette.pathSubText : node.isNormal ? palette.nodeStrokeNormal : palette.nodeSubText}
            fontSize="11px"
            fontFamily="monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {isTrivial
              ? t('lattice.trivial')
              : isFull
                ? `|G|=${group?.order ?? ''}`
                : node.isNormal
                  ? `◁ ${t('badge.normal')}`
                  : t('lattice.subgroup')}
          </text>
        </g>
      )
    })
  }, [
    viewNodes, layout, pathIndices, activeNodeIdx, group, centerIdx, sylowOrderToP,
    seriesNodeMap, series, seriesNodeSet, seriesColor, palette, subsetSets, t,
    tier, eff, edgeWidth, onActivateNode,
  ])

  const seriesLines = useMemo(() => {
    if (!seriesColor) return null
    const byTerm = [...seriesNodeMap.entries()].sort((a, b) => a[1] - b[1])
    const lines: { from: { x: number; y: number }; to: { x: number; y: number } }[] = []
    for (let i = 0; i + 1 < byTerm.length; i++) {
      const fromPos = layout.positions[byTerm[i][0]]
      const toPos = layout.positions[byTerm[i + 1][0]]
      if (fromPos && toPos) lines.push({ from: fromPos, to: toPos })
    }
    return lines
  }, [seriesColor, seriesNodeMap, layout])

  // detail：hover 优先、否则选中。结构符号 O(|H|²)，memo 即缓存（只在悬停节点变化时重算）
  const detailIdx = hoverIdx ?? activeNodeIdx
  const detailNode = detailIdx === null ? null : viewNodes[detailIdx] ?? null
  const detailSymbol = useMemo(() => {
    if (!group || !detailNode || detailNode.order === group.order) return null
    return subgroupStructureSymbol(group, detailNode.elementIds)
  }, [group, detailNode])

  const detailOrbit = detailNode as (SubgroupLatticeNode & OrbitFields) | null
  const detailTermIdx = detailIdx === null ? undefined : seriesNodeMap.get(detailIdx)

  // 就地气泡：屏幕坐标系下贴近 hover/选中节点，与底部 caption 行解耦，不再与 zoom slider 争位
  // 关键：foreignObject 内 HTML 用 13/eff 等反缩放字号，保证 ct.scale 变化时字号视觉恒定
  const bubble = useMemo(() => {
    if (!group || !detailNode || detailIdx === null) return null
    const pos = layout.positions[detailIdx]
    if (!pos) return null
    const nRy = layout.nodeRy
    const BUBBLE_PAD_X = 12 / eff
    const BUBBLE_PAD_Y = 6 / eff
    const BUBBLE_W = 280 / eff
    const BUBBLE_LINE_H = 18 / eff
    const BUBBLE_GAP = 8 / eff
    const lines: ReactNode[] = []
    lines.push(
      <span key="order" dangerouslySetInnerHTML={{ __html: renderTex(`|H| = ${detailNode.order}`) }} />
    )
    if (detailSymbol) {
      lines.push(
        <span key="sym" dangerouslySetInnerHTML={{ __html: renderTex(`\\cong ${detailSymbol}`) }} />
      )
    }
    if (detailNode.isNormal && detailNode.order !== group.order) {
      lines.push(
        <span key="normal" style={{ color: palette.nodeStrokeNormal }}>{`◁ ${t('badge.normal')}`}</span>
      )
    }
    lines.push(
      <span key="idx" dangerouslySetInnerHTML={{ __html: renderTex(`[G:H] = ${Math.round(group.order / detailNode.order)}`) }} />
    )
    if ((detailOrbit?.orbitSize ?? 1) > 1) {
      lines.push(
        <span key="orbit" style={{ color: 'var(--text-muted)' }}>
          {t('lattice.orbitMembers', { n: String(detailOrbit!.orbitSize) })}
          {' · '}
          <span dangerouslySetInnerHTML={{ __html: renderTex(`|N_G(H)| = ${detailOrbit!.normalizerOrder}`) }} />
        </span>
      )
    }
    if (detailNode.label && detailNode.label !== `${detailNode.order}`) {
      lines.push(
        <span key="label" dangerouslySetInnerHTML={{ __html: renderTex(texify(detailNode.label)) }} />
      )
    }
    if (detailTermIdx !== undefined && series) {
      lines.push(
        <span key="term" style={{ color: seriesColor ?? undefined }}>{`N_${detailTermIdx} · ${t(`series.${series.type}`)}`}</span>
      )
    }
    const lineCount = lines.length
    const BUBBLE_H = BUBBLE_LINE_H * lineCount + BUBBLE_PAD_Y * 2
    // 位置策略：上方优先 → 不足则下方 → 上下都贴边则压紧到 viewBox 内
    const aboveY = pos.y - nRy - BUBBLE_GAP - BUBBLE_H
    const belowY = pos.y + nRy + BUBBLE_GAP
    let bubbleY = aboveY
    let pointer: 'down' | 'up' = 'down'
    if (aboveY < 0 || belowY + BUBBLE_H > layout.viewH) {
      // 至少一侧能放下时选空间大的那侧
      const aboveRoom = aboveY // 越负越差
      const belowRoom = layout.viewH - (belowY + BUBBLE_H) // 越负越差
      if (aboveRoom >= belowRoom) {
        bubbleY = Math.max(aboveY, 0)
        pointer = 'down'
      } else {
        bubbleY = Math.min(belowY, layout.viewH - BUBBLE_H)
        pointer = 'up'
      }
    }
    const idealX = pos.x - BUBBLE_W / 2
    const bubbleX = Math.min(Math.max(idealX, 0), Math.max(layout.viewW - BUBBLE_W, 0))
    const arrowAnchorX = Math.min(Math.max(pos.x, bubbleX + BUBBLE_PAD_X), bubbleX + BUBBLE_W - BUBBLE_PAD_X)
    const arrowTipY = pointer === 'down' ? bubbleY + BUBBLE_H : bubbleY
    const arrowBaseY = pointer === 'down' ? bubbleY : bubbleY + BUBBLE_H
    return (
      <g style={{ pointerEvents: 'none' }} data-testid="lattice-bubble">
        <polygon
          points={`${arrowAnchorX - 6/eff},${arrowBaseY} ${arrowAnchorX + 6/eff},${arrowBaseY} ${arrowAnchorX},${arrowTipY}`}
          fill="var(--bg-panel)"
          stroke="var(--border-primary)"
          strokeWidth={1 / eff}
        />
        <foreignObject
          x={bubbleX}
          y={bubbleY}
          width={BUBBLE_W}
          height={BUBBLE_H}
          style={{ overflow: 'visible' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: `${BUBBLE_PAD_Y}px ${BUBBLE_PAD_X}px`,
              border: '1px solid var(--border-primary)',
              borderRadius: `${6 / eff}px`,
              background: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              fontSize: `${13 / eff}px`,
              lineHeight: 1.4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: `${2 / eff}px`,
            }}
          >
            {lines.map((ln, idx) => (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: `${8 / eff}px` }}>
                {ln}
              </span>
            ))}
          </div>
        </foreignObject>
      </g>
    )
  }, [detailNode, detailIdx, detailOrbit, detailTermIdx, detailSymbol, layout, eff, group, series, seriesColor, t, palette.nodeStrokeNormal])

  if (!group || !baseLattice || viewNodes.length === 0) {
    return (
      <div className="view-empty">
        <p>{noGroupText ?? (group ? t('lattice.backendOnly') : t('canvas.noGroup'))}</p>
      </div>
    )
  }

  return (
    <div
      className="sublattice-view-wrap"
      data-lattice-tier={tier}
      data-lattice-slot-width={Math.round(slotScreenWidth)}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* 绘图区宿主：svg 绝对定位填满。若让 svg 参与常规流，它的 viewBox 宽高比会
          以 min-content 高度向上撑破固定高度的窗口（Chrome 行为），故这里必须 absolute。 */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          ref={svgHostRef}
          viewBox={`0 0 ${layout.viewW} ${layout.viewH}`}
          className="view-svg"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', userSelect: 'none', overflow: 'visible' }}
        >
          <g transform={`translate(${ct.x}, ${ct.y}) scale(${ct.scale})`}>
            {edgeElements}
            {seriesLines && seriesLines.map((line, li) => (
              <line
                key={`series-line-${li}`}
                x1={line.from.x}
                y1={line.from.y}
                x2={line.to.x}
                y2={line.to.y}
                stroke={seriesColor!}
                strokeWidth={tier === 'full' ? 4 : Math.max(toWorld(4, eff, layout.nodeRx * 0.1), edgeWidth)}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}
            {nodeElements}
            {bubble}
          </g>
        </svg>
      </div>
      {mergeUnavailable && (
        <div
          data-testid="lattice-merge-hint"
          style={{ padding: '2px 10px', fontSize: 11, color: 'var(--accent-yellow-text)', flexShrink: 0 }}
        >
          {t('lattice.mergeTooLarge')}
        </div>
      )}
      {showSeriesPanel && series && <SeriesPanel group={group} series={series} color={seriesColor} />}
    </div>
  )
}

// ────────────────────────── context 组装壳（导出签名不变） ──────────────────────────

/**
 * 主画布 / 旧浮动窗用的 context 组装壳：从 useGroup() 取大群后端格、子群列、
 * 子集与选中动作，组装成受控内核的 props。行为与 props 化之前一致。
 */
export function SubgroupLatticeView() {
  const {
    currentGroup,
    selectElement,
    clearSelection,
    canvasTransform,
    subsets,
    backendCache,
    isLargeGroup,
    seriesType,
    seriesData,
    compositionChains,
    compositionTruncated,
    activeChainIdx,
    seriesFlags,
    seriesLoading,
  } = useGroup()
  const { t } = useTranslation()

  const lattice = useMemo<LatticeData | null>(() => {
    if (!currentGroup) return null
    if (isLargeGroup && backendCache.lattice) {
      // Backend lattice nodes ship `elements` (and `is_normal` / no `elementIds`);
      // normalize into the local SubgroupLatticeNode shape consumed below.
      const raw = backendCache.lattice as {
        nodes: Array<{
          id: string
          elements?: Array<{ id: string }> | null
          elementIds?: string[]
          order: number
          is_normal?: boolean
          isNormal?: boolean
          level?: number
        }>
        edges: SubgroupLatticeEdge[]
      }
      return {
        nodes: raw.nodes.map(n => ({
          id: n.id,
          label: `${n.order}`,
          elementIds: Array.isArray(n.elementIds)
            ? n.elementIds
            : (n.elements ?? []).map(e => e.id),
          order: n.order,
          index: 0,
          isNormal: n.is_normal ?? n.isNormal ?? false,
          level: n.level ?? 0,
        })),
        edges: (raw.edges as unknown as Array<{ source: number; target: number }>).map(e => ({
          from: e.source,
          to: e.target,
        })),
      }
    }
    if (isLargeGroup) return null
    return computeSubgroupLattice(currentGroup)
  }, [currentGroup, isLargeGroup, backendCache.lattice])

  const seriesTerms = useMemo<GroupElement[][] | null>(() => {
    if (!currentGroup || !seriesType) return null
    if (seriesType === 'composition') {
      if (!compositionChains || compositionChains.length === 0) return null
      return compositionChains[Math.min(activeChainIdx, compositionChains.length - 1)] ?? null
    }
    return seriesData?.terms ?? null
  }, [currentGroup, seriesType, seriesData, compositionChains, activeChainIdx])

  const seriesFactors = useMemo<SeriesFactor[] | null>(() => {
    if (!currentGroup || !seriesTerms || !seriesType) return null
    // Backend (GAP) series ships its own factors — use them directly to
    // avoid an O(n²) recomputation on large groups.
    if (seriesData?.factors && seriesData.factors.length > 0) return seriesData.factors
    if (seriesType === 'composition') return computeChainFactors(currentGroup, seriesTerms, true)
    return seriesData?.factors ?? null
  }, [currentGroup, seriesType, seriesTerms, seriesData])

  const series: SublatticeSeriesState | null = seriesType
    ? {
        type: seriesType,
        terms: seriesTerms,
        factors: seriesFactors,
        solvable: seriesType === 'composition' ? seriesFlags?.solvable ?? false : seriesData?.solvable ?? false,
        nilpotent: seriesType === 'composition' ? seriesFlags?.nilpotent ?? false : seriesData?.nilpotent ?? false,
        chainCount: compositionChains?.length ?? 0,
        truncated: compositionTruncated,
        loading: seriesLoading,
      }
    : null

  const centerIds = useMemo(() => {
    if (!currentGroup) return undefined
    const center = backendCache.center ?? (currentGroup.order <= 60 ? getGroupCenter(currentGroup) : null)
    return center ? center.map(e => e.id) : undefined
  }, [currentGroup, backendCache.center])

  const handleActivate = useCallback(
    (idx: number | null, node: SubgroupLatticeNode | null) => {
      clearSelection()
      if (idx === null || !node) return
      node.elementIds.forEach(id => selectElement(id, true))
    },
    [clearSelection, selectElement]
  )

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <SublatticeScene
      group={currentGroup}
      lattice={lattice}
      canvasTransform={canvasTransform}
      series={series}
      centerIds={centerIds}
      subsets={subsets}
      onActivateNode={handleActivate}
    />
  )
}

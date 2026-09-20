import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { texify, renderTex } from '../../utils/texify'
import type { Group } from '../../core/types'
import type { QuotientInsetGeometry } from '../../core/viewBox'

/**
 * 商群画布的「正规子群 N 独立凯莱图」悬浮窗（可收起、可拖动、**可缩放**）。
 *
 * 背景（用户 2026-09-20 反馈）：商群元素的旧画法是**复合节点**——把每个陪集
 * 画成一个大圆，里面塞满该陪集的元素小节点与内部边。两处问题：
 *   1. 陪集不是子群，把「成员小节点」画在商群节点里在数学上误导；
 *   2. 大圆直径 72 + 内部小点，商群凯莱图节点几乎挤在一起。
 * 新画法：商群节点就是普通节点（标签 = gN 陪集记号），正规子群 N 单独画一份
 * 凯莱图放在**悬浮窗**里，并用箭头从「恒等陪集节点（= N 本身）」指过去。
 *
 * **尺寸按屏幕像素恒定**（用户第三轮：「悬浮窗太小了，怎么不能缩放」——旧版
 * 画在 SVG 坐标系里，主画布 viewBox 2000 被容器缩到 ~1/3，320 单位的窗子屏上
 * 只剩 ~100px）。窗体以 px 设计、经 scale(k) 落进 SVG（k = viewBox宽/容器宽），
 * 无论 viewBox 多大，屏上都是 360×300 起步；**右下角手柄可拖拽缩放**
 * （240×180 ~ 720×600，小容器按容器再收），标题栏可拖动，可收起成小药丸。
 *
 * 窗内小凯莱图的边 = **N 自己的最小生成元**（用户：「只需要展示它自己的生成元
 * 作为边就够了」）；数据来自恒等陪集元素的 cosetMemberLabels /
 * cosetInternalLayout / cosetInternalEdges（core 的 computeQuotientGroup 写入）。
 *
 * 悬浮窗置于 SVG 的 viewBox 坐标系但**不在 canvasTransform 组内**：画布平移
 * 缩放不影响窗体；指针线由调用方按当前画布变换算出锚点位置。
 */

/** 小凯莱图节点配色（与旧复合节点同一套，深浅主题下都可读） */
const INSET_NODE_COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa', '#f97316', '#06b6d4',
  '#84cc16', '#f43f5e', '#38bdf8', '#a855f7', '#14b8a6', '#eab308',
  '#6366f1', '#ec4899', '#0ea5e9', '#22c55e',
]

/** 收起状态的药丸尺寸（屏幕像素） */
const PILL_WIDTH = 78
const PILL_HEIGHT = 24
/** 展开态窗体尺寸（屏幕像素）：默认 / 缩放范围 */
const DEFAULT_WIN = { w: 360, h: 300 }
const MIN_WIN = { w: 240, h: 180 }
const MAX_WIN = { w: 720, h: 600 }

interface QuotientSubgroupInsetProps {
  /** 商群（元素携带 cosetMemberLabels / cosetInternalLayout / cosetInternalEdges） */
  group: Group
  /** 恒等陪集节点在 **viewBox 坐标**中的位置（调用方按 canvasTransform 换算） */
  anchor: { x: number; y: number }
  /** 锚点节点的屏幕半径（viewBox 单位），用于把指针线起点推到节点边缘 */
  anchorRadius?: number
  geometry: QuotientInsetGeometry
  /** 悬浮窗标题文案（宿主可传本地化文案；缺省只画数学记号 N） */
  title?: string
}

export function QuotientSubgroupInset({
  group,
  anchor,
  anchorRadius = 0,
  geometry,
  title,
}: QuotientSubgroupInsetProps) {
  const rawId = useId()
  const markerId = `qv-inset-arrow-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const rootRef = useRef<SVGGElement | null>(null)

  const [collapsed, setCollapsed] = useState(false)
  // 位置/尺寸都以**屏幕像素**（相对 SVG 容器左上角）记账，渲染时 ×k 落进 SVG ——
  // 这样窗体不随 viewBox 缩放变小。pos = null 表示「还没拖过」，跟随默认停靠点。
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState(() => ({ ...DEFAULT_WIN }))
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; moved: number } | null>(null)
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null)
  // SVG 容器度量（k = viewBox宽/容器宽，px → SVG 单位）。
  // ref 不能在渲染期读（react-hooks/refs）：挂到 state，挂载后量一次 + ResizeObserver 跟随容器变化。
  const [metrics, setMetrics] = useState({ k: 1, rectW: 0, rectH: 0 })
  useEffect(() => {
    const measure = () => {
      const svg = rootRef.current?.ownerSVGElement
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const vbW = svg.viewBox.baseVal.width || rect.width || 1
      const next = { k: rect.width > 0 ? vbW / rect.width : 1, rectW: rect.width, rectH: rect.height }
      setMetrics(prev => (prev.k === next.k && prev.rectW === next.rectW && prev.rectH === next.rectH ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    if (rootRef.current?.ownerSVGElement) ro.observe(rootRef.current.ownerSVGElement)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const identity = group.identity
  const members = identity.cosetMemberLabels
  const layout = identity.cosetInternalLayout
  const internalEdges = identity.cosetInternalEdges
  // 只有 1 个元素（N = {e}）时没有可画的凯莱图：商群 ≅ G，面板无信息量
  const count = members?.length ?? 0
  const hasGraph = !!members && count >= 2

  const k = metrics.k
  const sizeClamped = (() => {
    // 小容器按容器收（留 8px 边距），再夹到缩放范围
    const maxW = metrics.rectW > 0 ? Math.min(MAX_WIN.w, metrics.rectW - 8) : MAX_WIN.w
    const maxH = metrics.rectH > 0 ? Math.min(MAX_WIN.h, metrics.rectH - 8) : MAX_WIN.h
    return {
      w: Math.min(Math.max(MIN_WIN.w, size.w), Math.max(MIN_WIN.w, maxW)),
      h: Math.min(Math.max(MIN_WIN.h, size.h), Math.max(MIN_WIN.h, maxH)),
    }
  })()
  const winW = collapsed ? PILL_WIDTH : sizeClamped.w
  const winH = collapsed ? PILL_HEIGHT : sizeClamped.h

  // 默认停靠点 = 让位几何给的右带（SVG 单位）换算成屏幕像素；拖过后用用户位置
  const posPx = pos ?? { x: geometry.panel.x / k, y: geometry.panel.y / k }
  const clampPosPx = (p: { x: number; y: number }) => {
    if (metrics.rectW <= 0 || metrics.rectH <= 0) return p
    return {
      x: Math.min(Math.max(4, p.x), Math.max(4, metrics.rectW - winW - 4)),
      y: Math.min(Math.max(4, p.y), Math.max(4, metrics.rectH - winH - 4)),
    }
  }
  const posClamped = clampPosPx(posPx)

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-no-drag]')) return
    e.stopPropagation()
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: posClamped.x, oy: posClamped.y, ow: 0, oh: 0, moved: 0 }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      d.moved = Math.max(d.moved, Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy))
      setPos(clampPosPx({ x: d.ox + (ev.clientX - d.sx), y: d.oy + (ev.clientY - d.sy) }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      // 收起态下把药丸当按钮：位移极小视为点击 → 展开
      const d = dragRef.current
      if (d && d.moved < 4 && collapsed) setCollapsed(false)
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: sizeClamped.w, oh: sizeClamped.h }
    const move = (ev: PointerEvent) => {
      const d = resizeRef.current
      if (!d) return
      setSize({
        w: d.ow + (ev.clientX - d.sx),
        h: d.oh + (ev.clientY - d.sy),
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      resizeRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // —— 小凯莱图布局（**屏幕像素**坐标系，整窗经 scale(k) 落进 SVG） ——
  const pad = 12
  const headerH = 26
  const footerH = 18
  const hasLayout = !!layout && layout.length >= count
  const innerW = sizeClamped.w - pad * 2
  const innerH = sizeClamped.h - headerH - footerH
  const gcx = sizeClamped.w / 2
  const gcy = headerH + innerH / 2
  const span = Math.min(innerW, innerH) / 2 - 8
  const nodeR = Math.max(2.5, Math.min(12, span / (Math.sqrt(Math.max(count, 1)) * 1.7)))

  const posOf = (i: number) => {
    if (hasLayout) {
      const p = layout![i]
      return { x: gcx + p.x * span, y: gcy + p.y * span }
    }
    const a = (i / count) * 2 * Math.PI - Math.PI / 2
    return { x: gcx + Math.cos(a) * span * 0.72, y: gcy + Math.sin(a) * span * 0.72 }
  }

  const labelHtml = useMemo(() => {
    // 节点够大且数量可控时，给每个小圆点配元素标签（KaTeX）——纯小圆点看不清「这是 N 的哪个元素」
    if (count > 12 || nodeR < 8) return new Map<number, string>()
    const m = new Map<number, string>()
    for (let i = 0; i < count; i++) m.set(i, renderTex(texify(members![i] ?? '')))
    return m
  }, [count, nodeR, members])

  // 指针线：从恒等陪集节点边缘指向悬浮窗左侧（窗体位置 px → SVG 单位 ×k）
  const targetX = posClamped.x * k - 8
  const targetY = (posClamped.y + winH / 2) * k
  const dx = targetX - anchor.x
  const dy = targetY - anchor.y
  const dist = Math.hypot(dx, dy) || 1
  const startX = anchor.x + (dx / dist) * (anchorRadius + 4)
  const startY = anchor.y + (dy / dist) * (anchorRadius + 4)

  if (!hasGraph) return null

  const edgeNodes: React.ReactNode[] = []
  if (internalEdges) {
    for (let i = 0; i < internalEdges.length; i++) {
      const edge = internalEdges[i]
      if (edge.fromInnerIdx >= count || edge.toInnerIdx >= count) continue
      const from = posOf(edge.fromInnerIdx)
      const to = posOf(edge.toInnerIdx)
      const ex = to.x - from.x
      const ey = to.y - from.y
      const d = Math.hypot(ex, ey)
      if (d < 0.5) continue
      const ux = ex / d
      const uy = ey / d
      edgeNodes.push(
        <line
          key={`inset-edge-${i}`}
          data-testid="inset-edge"
          x1={from.x + ux * nodeR}
          y1={from.y + uy * nodeR}
          x2={to.x - ux * (nodeR + 1.5)}
          y2={to.y - uy * (nodeR + 1.5)}
          stroke={edge.color}
          strokeWidth={Math.max(1, nodeR * 0.45)}
          strokeOpacity={0.85}
          strokeLinecap="round"
          markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
        >
          <title>{edge.actionLabel || edge.actionElementId || ''}</title>
        </line>,
      )
    }
  }

  const nodes: React.ReactNode[] = []
  for (let i = 0; i < count; i++) {
    const p = posOf(i)
    const label = labelHtml.get(i)
    nodes.push(
      <g key={`inset-node-${i}`}>
        <circle
          data-testid="inset-node"
          cx={p.x}
          cy={p.y}
          r={nodeR}
          fill={INSET_NODE_COLORS[i % INSET_NODE_COLORS.length]}
          stroke="var(--node-stroke)"
          strokeWidth={0.8}
        >
          <title>{members![i]}</title>
        </circle>
        {label && (
          <foreignObject
            x={p.x - Math.max(nodeR, 18)}
            y={p.y + nodeR + 1}
            width={Math.max(nodeR, 18) * 2}
            height={16}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '14px',
              }}
              dangerouslySetInnerHTML={{ __html: label }}
            />
          </foreignObject>
        )}
      </g>,
    )
  }

  return (
    <g ref={rootRef} data-testid="quotient-subgroup-inset">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-purple)" />
        </marker>
      </defs>

      {/* 指针线：底下压一条画布底色描边，避免与图上的边糊在一起（线宽 ×k ⇒ 屏上恒定） */}
      <line
        x1={startX} y1={startY} x2={targetX} y2={targetY}
        stroke="var(--bg-canvas)" strokeWidth={5 * k} strokeOpacity={0.75} strokeLinecap="round"
      />
      <line
        x1={startX} y1={startY} x2={targetX} y2={targetY}
        stroke="var(--accent-purple)" strokeWidth={2 * k} strokeDasharray={`${7 * k} ${4 * k}`}
        strokeLinecap="round" markerEnd={`url(#${markerId})`}
      />
      <circle cx={startX} cy={startY} r={2.6 * k} fill="var(--accent-purple)" />

      {/* 窗体：px 设计 + scale(k) 落进 SVG ⇒ 屏上尺寸恒定 */}
      <g
        transform={`translate(${posClamped.x * k}, ${posClamped.y * k}) scale(${k})`}
        onPointerDown={startDrag}
        style={{ cursor: collapsed ? 'pointer' : 'grab' }}
      >
        {collapsed ? (
          // —— 收起态：药丸（点击展开） ——
          <g data-testid="quotient-inset-pill">
            <rect
              width={PILL_WIDTH} height={PILL_HEIGHT} rx={PILL_HEIGHT / 2}
              fill="var(--panel-bg)" fillOpacity={0.94}
              stroke="var(--accent-purple)" strokeWidth={1.5}
            />
            <text x={12} y={16} fontSize={12} fontWeight={700} fill="var(--text-primary)" fontFamily="serif">N</text>
            <text x={28} y={16} fontSize={10} fill="var(--text-muted)">|N| = {count}</text>
            <path
              d={`M ${PILL_WIDTH - 16},8 L ${PILL_WIDTH - 10},12 L ${PILL_WIDTH - 16},16`}
              fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        ) : (
          <>
            {/* 窗体 */}
            <rect
              data-testid="quotient-inset-window"
              width={sizeClamped.w} height={sizeClamped.h} rx={12}
              fill="var(--panel-bg)" fillOpacity={0.94}
              stroke="var(--panel-border)" strokeWidth={1.5}
            />
            {/* 标题栏（拖动手柄） */}
            <rect
              width={sizeClamped.w} height={headerH} rx={12}
              fill="var(--bg-interactive)" fillOpacity={0.9} stroke="none"
            />
            <rect
              y={headerH - 12} width={sizeClamped.w} height={12}
              fill="var(--bg-interactive)" fillOpacity={0.9} stroke="none"
            />
            <line x1={0} y1={headerH} x2={sizeClamped.w} y2={headerH} stroke="var(--panel-border)" strokeWidth={1} />
            <text x={pad} y={17} fontSize={14} fontWeight={700} fill="var(--text-primary)" fontFamily="serif">N</text>
            {title && (
              <text x={pad + 16} y={17} fontSize={12} fill="var(--text-muted)">{title}</text>
            )}
            {/* 收起按钮 */}
            <g
              data-testid="quotient-inset-toggle"
              data-no-drag="1"
              onClick={(e) => { e.stopPropagation(); setCollapsed(true) }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={sizeClamped.w - 30} y={5} width={22} height={17} rx={4}
                fill="transparent" stroke="var(--border-color)" strokeWidth={1}
              />
              <path
                d={`M ${sizeClamped.w - 24},9.5 L ${sizeClamped.w - 16},13.5 L ${sizeClamped.w - 24},17.5`}
                fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
              <title>收起</title>
            </g>
            {edgeNodes}
            {nodes}
            <text
              x={sizeClamped.w - pad} y={sizeClamped.h - 7}
              fontSize={12} fill="var(--text-muted)" textAnchor="end"
              fontFamily="serif"
            >|N| = {count}</text>
            {/* 右下角缩放手柄 */}
            <g
              data-testid="quotient-inset-resize"
              data-no-drag="1"
              onPointerDown={startResize}
              style={{ cursor: 'nwse-resize' }}
            >
              <rect
                x={sizeClamped.w - 22} y={sizeClamped.h - 22} width={18} height={18}
                fill="transparent"
              />
              <path
                d={`M ${sizeClamped.w - 6},${sizeClamped.h - 14} L ${sizeClamped.w - 14},${sizeClamped.h - 6} M ${sizeClamped.w - 6},${sizeClamped.h - 8} L ${sizeClamped.w - 8},${sizeClamped.h - 6}`}
                stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" fill="none"
              />
              <title>拖拽缩放</title>
            </g>
          </>
        )}
      </g>
    </g>
  )
}

import { useId, useRef, useState } from 'react'
import type { Group } from '../../core/types'
import type { QuotientInsetGeometry } from '../../core/viewBox'

/**
 * 商群画布的「正规子群 N 独立凯莱图」悬浮窗（可收起、可拖动）。
 *
 * 背景（用户 2026-09-20 反馈）：商群元素的旧画法是**复合节点**——把每个陪集
 * 画成一个大圆，里面塞满该陪集的元素小节点与内部边。两处问题：
 *   1. 陪集不是子群，把「成员小节点」画在商群节点里在数学上误导；
 *   2. 大圆直径 72 + 内部小点，商群凯莱图节点几乎挤在一起。
 * 新画法：商群节点就是普通节点（标签 = gN 陪集记号），正规子群 N 单独画一份
 * 凯莱图放在**悬浮窗**里，并用箭头从「恒等陪集节点（= N 本身）」指过去。
 * 悬浮窗可拖动（按住标题栏）、可收起成小药丸（点标题栏按钮收起 / 点药丸展开）。
 *
 * 面板用的数据来自恒等陪集元素上的 cosetMemberLabels / cosetInternalLayout /
 * cosetInternalEdges（由 core 的 computeQuotientGroup 写入；内部边 = **N 自己的
 * 最小生成元**的凯莱边，所有陪集共享同一份内部布局 —— 因为陪集都与 N 同构）。
 *
 * 组件置于 SVG 的 viewBox 坐标系（不在 canvasTransform 组内）：缩放/平移时
 * 悬浮窗保持固定尺寸，指针线由调用方按当前画布变换算出锚点位置。
 */

/** 小凯莱图节点配色（与旧复合节点同一套，深浅主题下都可读） */
const INSET_NODE_COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa', '#f97316', '#06b6d4',
  '#84cc16', '#f43f5e', '#38bdf8', '#a855f7', '#14b8a6', '#eab308',
  '#6366f1', '#ec4899', '#0ea5e9', '#22c55e',
]

/** 收起状态的药丸尺寸 */
const PILL_WIDTH = 78
const PILL_HEIGHT = 24

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
  const [pos, setPos] = useState(() => ({ x: geometry.panel.x, y: geometry.panel.y }))
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: number } | null>(null)

  const identity = group.identity
  const members = identity.cosetMemberLabels
  const layout = identity.cosetInternalLayout
  const internalEdges = identity.cosetInternalEdges
  // 只有 1 个元素（N = {e}）时没有可画的凯莱图：商群 ≅ G，面板无信息量
  const hasGraph = !!members && members.length >= 2

  const winW = collapsed ? PILL_WIDTH : geometry.panel.width
  const winH = collapsed ? PILL_HEIGHT : geometry.panel.height

  /** client 像素 → viewBox 单位的换算比例（悬浮窗不在 canvasTransform 组内，按 SVG viewBox 算） */
  const svgMetrics = () => {
    const svg = rootRef.current?.ownerSVGElement
    if (!svg) return { k: 1, vbW: 4096, vbH: 4096 }
    const rect = svg.getBoundingClientRect()
    const vbW = svg.viewBox.baseVal.width || rect.width || 4096
    const vbH = svg.viewBox.baseVal.height || rect.height || 4096
    return { k: rect.width > 0 ? vbW / rect.width : 1, vbW, vbH }
  }

  const clampPos = (p: { x: number; y: number }, vbW: number, vbH: number) => ({
    x: Math.min(Math.max(4, p.x), Math.max(4, vbW - winW - 4)),
    y: Math.min(Math.max(4, p.y), Math.max(4, vbH - winH - 4)),
  })

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-no-drag]')) return
    e.stopPropagation()
    const { k } = svgMetrics()
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: 0 }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.sx) * k
      const dy = (ev.clientY - d.sy) * k
      d.moved = Math.max(d.moved, Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy))
      const { vbW, vbH } = svgMetrics()
      setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }, vbW, vbH))
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

  // —— 小凯莱图布局（相对悬浮窗原点） ——
  const pad = 12
  const headerH = 24
  const footerH = 16
  const count = members?.length ?? 0
  const hasLayout = !!layout && layout.length >= count
  const innerW = geometry.panel.width - pad * 2
  const innerH = geometry.panel.height - headerH - footerH
  const gcx = geometry.panel.width / 2
  const gcy = headerH + innerH / 2
  const span = Math.min(innerW, innerH) / 2 - 8
  const nodeR = Math.max(2.2, Math.min(8, span / (Math.sqrt(Math.max(count, 1)) * 1.7)))

  const posOf = (i: number) => {
    if (hasLayout) {
      const p = layout![i]
      return { x: gcx + p.x * span, y: gcy + p.y * span }
    }
    const a = (i / count) * 2 * Math.PI - Math.PI / 2
    return { x: gcx + Math.cos(a) * span * 0.72, y: gcy + Math.sin(a) * span * 0.72 }
  }

  // 指针线：从恒等陪集节点边缘指向悬浮窗左侧
  const targetX = pos.x - 8
  const targetY = pos.y + winH / 2
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
    nodes.push(
      <circle
        key={`inset-node-${i}`}
        data-testid="inset-node"
        cx={p.x}
        cy={p.y}
        r={nodeR}
        fill={INSET_NODE_COLORS[i % INSET_NODE_COLORS.length]}
        stroke="var(--node-stroke)"
        strokeWidth={0.8}
      >
        <title>{members![i]}</title>
      </circle>,
    )
  }

  return (
    <g
      ref={rootRef}
      data-testid="quotient-subgroup-inset"
      // 悬浮窗是画布上的覆盖层：别让它的按下/点击穿透到画布（拖拽平移、点空白取消选中）
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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

      {/* 指针线：底下压一条画布底色描边，避免与图上的边糊在一起 */}
      <line
        x1={startX} y1={startY} x2={targetX} y2={targetY}
        stroke="var(--bg-canvas)" strokeWidth={5} strokeOpacity={0.75} strokeLinecap="round"
      />
      <line
        x1={startX} y1={startY} x2={targetX} y2={targetY}
        stroke="var(--accent-purple)" strokeWidth={2} strokeDasharray="7 4"
        strokeLinecap="round" markerEnd={`url(#${markerId})`}
      />
      <circle cx={startX} cy={startY} r={2.6} fill="var(--accent-purple)" />

      <g
        transform={`translate(${pos.x}, ${pos.y})`}
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
              width={geometry.panel.width} height={geometry.panel.height} rx={12}
              fill="var(--panel-bg)" fillOpacity={0.94}
              stroke="var(--panel-border)" strokeWidth={1.5}
            />
            {/* 标题栏（拖动手柄） */}
            <rect
              width={geometry.panel.width} height={headerH} rx={12}
              fill="var(--bg-interactive)" fillOpacity={0.9} stroke="none"
            />
            <rect
              y={headerH - 12} width={geometry.panel.width} height={12}
              fill="var(--bg-interactive)" fillOpacity={0.9} stroke="none"
            />
            <line x1={0} y1={headerH} x2={geometry.panel.width} y2={headerH} stroke="var(--panel-border)" strokeWidth={1} />
            <text x={pad} y={16} fontSize={13} fontWeight={700} fill="var(--text-primary)" fontFamily="serif">N</text>
            {title && (
              <text x={pad + 16} y={16} fontSize={11} fill="var(--text-muted)">{title}</text>
            )}
            {/* 收起按钮 */}
            <g
              data-testid="quotient-inset-toggle"
              data-no-drag="1"
              onClick={(e) => { e.stopPropagation(); setCollapsed(true) }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={geometry.panel.width - 26} y={5} width={20} height={15} rx={4}
                fill="transparent" stroke="var(--border-color)" strokeWidth={1}
              />
              <path
                d={`M ${geometry.panel.width - 20},9 L ${geometry.panel.width - 13},12.5 L ${geometry.panel.width - 20},16`}
                fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
              <title>收起</title>
            </g>
            {edgeNodes}
            {nodes}
            <text
              x={geometry.panel.width - pad} y={geometry.panel.height - 6}
              fontSize={11} fill="var(--text-muted)" textAnchor="end"
              fontFamily="serif"
            >|N| = {count}</text>
          </>
        )}
      </g>
    </g>
  )
}

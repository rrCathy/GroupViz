import { useId } from 'react'
import type { Group } from '../../core/types'
import type { QuotientInsetGeometry } from '../../core/viewBox'

/**
 * 商群画布的「正规子群 N 独立凯莱图」内嵌面板。
 *
 * 背景（用户 2026-09-20 反馈）：商群元素的旧画法是**复合节点**——把每个陪集
 * 画成一个大圆，里面塞满该陪集的元素小节点与内部边。作者指出两处问题：
 *   1. 陪集不是子群，把「成员小节点」画在商群节点里在数学上误导；
 *   2. 大圆直径 72 + 内部小点，商群凯莱图节点几乎挤在一起。
 * 新画法：商群节点就是普通节点（标签 = gN 陪集记号），正规子群 N 单独画一份
 * 凯莱图放在旁边的面板里，并用箭头从「恒等陪集节点（= N 本身）」指过去。
 *
 * 面板用的数据来自恒等陪集元素上的 cosetMemberLabels / cosetInternalLayout /
 * cosetInternalEdges（由 core 的 computeQuotientGroup 写入，所有陪集共享同一份
 * 内部布局 —— 因为陪集都与 N 同构）。
 *
 * 组件置于 SVG 的 viewBox 坐标系（不在 canvasTransform 组内）：缩放/平移时
 * 面板保持固定尺寸，指针线由调用方按当前画布变换算出锚点位置。
 */

/** 小凯莱图节点配色（与旧复合节点同一套，深浅主题下都可读） */
const INSET_NODE_COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa', '#f97316', '#06b6d4',
  '#84cc16', '#f43f5e', '#38bdf8', '#a855f7', '#14b8a6', '#eab308',
  '#6366f1', '#ec4899', '#0ea5e9', '#22c55e',
]

interface QuotientSubgroupInsetProps {
  /** 商群（元素携带 cosetMemberLabels / cosetInternalLayout / cosetInternalEdges） */
  group: Group
  /** 恒等陪集节点在 **viewBox 坐标**中的位置（调用方按 canvasTransform 换算） */
  anchor: { x: number; y: number }
  /** 锚点节点的屏幕半径（viewBox 单位），用于把指针线起点推到节点边缘 */
  anchorRadius?: number
  geometry: QuotientInsetGeometry
  /** 面板标题文案（宿主可传本地化文案；缺省只画数学记号 N） */
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

  const identity = group.identity
  const members = identity.cosetMemberLabels
  const layout = identity.cosetInternalLayout
  const internalEdges = identity.cosetInternalEdges
  // 只有 1 个元素（N = {e}）时没有可画的凯莱图：商群 ≅ G，面板无信息量
  if (!members || members.length < 2) return null

  const { panel } = geometry
  const count = members.length
  const hasLayout = !!layout && layout.length >= count

  const pad = 12
  const headerH = 24
  const footerH = 16
  const innerW = panel.width - pad * 2
  const innerH = panel.height - headerH - footerH
  const cx = panel.x + panel.width / 2
  const cy = panel.y + headerH + innerH / 2
  const span = Math.min(innerW, innerH) / 2 - 8
  const nodeR = Math.max(2.2, Math.min(8, span / (Math.sqrt(count) * 1.7)))

  const posOf = (i: number) => {
    if (hasLayout) {
      const p = layout![i]
      return { x: cx + p.x * span, y: cy + p.y * span }
    }
    const a = (i / count) * 2 * Math.PI - Math.PI / 2
    return { x: cx + Math.cos(a) * span * 0.72, y: cy + Math.sin(a) * span * 0.72 }
  }

  // 指针线：从恒等陪集节点边缘指向面板左侧
  const targetX = panel.x - 8
  const targetY = panel.y + panel.height / 2
  const dx = targetX - anchor.x
  const dy = targetY - anchor.y
  const dist = Math.hypot(dx, dy) || 1
  const startX = anchor.x + (dx / dist) * (anchorRadius + 4)
  const startY = anchor.y + (dy / dist) * (anchorRadius + 4)

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
        <title>{members[i]}</title>
      </circle>,
    )
  }

  return (
    <g data-testid="quotient-subgroup-inset">
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

      <rect
        x={panel.x} y={panel.y} width={panel.width} height={panel.height} rx={12}
        fill="var(--panel-bg)" fillOpacity={0.94}
        stroke="var(--panel-border)" strokeWidth={1.5}
      />
      <text
        x={panel.x + pad} y={panel.y + 17}
        fontSize={13} fontWeight={700} fill="var(--text-primary)"
        fontFamily="serif"
      >N</text>
      {title && (
        <text
          x={panel.x + pad + 16} y={panel.y + 17}
          fontSize={11} fill="var(--text-muted)"
        >{title}</text>
      )}
      <text
        x={panel.x + panel.width - pad} y={panel.y + panel.height - 6}
        fontSize={11} fill="var(--text-muted)" textAnchor="end"
        fontFamily="serif"
      >|N| = {count}</text>
      {edgeNodes}
      {nodes}
    </g>
  )
}

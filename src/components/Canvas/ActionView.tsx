import { useMemo, useRef, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import type { Group, GroupActionComputation } from '../../core/types'
import { computeFixedPoints, computeCycleCandidates } from '../../core/algebra/actions'

const NODE_R = 28
const CLUSTER_PAD = 26
const CLUSTER_GAP = 90
const CHIP_W = 100
const CHIP_H = 30
const CHIP_GAP = 10
const CHIP_ROW_H = CHIP_H + 10
const CHIP_PER_ROW = 8
const GRP_PAD = 8
const GRP_HDR = 18
const GRP_GAP = 14
const HOVER_COLOR = '#ffd93d'

function clusterRadius(size: number): number {
  // 相邻节点弦长 = 2r·sin(π/size) ≈ 220，两端各收缩 ~50（nodeR+headLen）后边仍 ~120 可见
  if (size <= 1) return 52
  return Math.max(52, Math.ceil(110 / Math.sin(Math.PI / size)))
}

function arrowHeadPoints(ex: number, ey: number, angle: number, size = 10): string {
  const a1 = angle - Math.PI / 6
  const a2 = angle + Math.PI / 6
  return `${ex},${ey} ${ex - Math.cos(a1) * size},${ey - Math.sin(a1) * size} ${ex - Math.cos(a2) * size},${ey - Math.sin(a2) * size}`
}

interface EdgeProps {
  sx: number
  sy: number
  ex: number
  ey: number
  color: string
  width?: number
  dashed?: boolean
  dir?: 1 | -1
  opacity?: number
  headSize?: number
  nodeR?: number
  offset?: number
  tFrom?: { x: number; y: number }
  onClick?: () => void
  onDrop?: (e: React.DragEvent) => void
  highlight?: boolean
}

function DirectedEdge({ sx, sy, ex, ey, color, width = 2.2, dashed, dir: _dir = 1, opacity = 0.85, headSize = 12, nodeR = 0, offset = 0, tFrom, onClick, onDrop, highlight }: EdgeProps) {
  const dx = ex - sx
  const dy = ey - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  const headLen = Math.min(headSize * 1.25, Math.max(12, dist * 0.25))
  const arrowSize = Math.min(headSize, headLen)
  const fx = tFrom ? tFrom.x : -uy
  const fy = tFrom ? tFrom.y : ux
  const ax = sx + ux * nodeR + fx * offset
  const ay = sy + uy * nodeR + fy * offset
  const bx = ex - ux * (nodeR + headLen) + fx * offset
  const by = ey - uy * (nodeR + headLen) + fy * offset
  const c1x = (ax + bx) / 2
  const c1y = (ay + by) / 2
  const angle = Math.atan2(by - c1y, bx - c1x)
  const d = `M${ax},${ay} Q${c1x},${c1y} ${bx},${by}`

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeOpacity={opacity}
        strokeLinecap="round"
      />
      <polygon
        points={arrowHeadPoints(bx, by, angle, arrowSize)}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        opacity={opacity}
      />
      {highlight && (
        <path
          d={d}
          fill="none"
          stroke={HOVER_COLOR}
          strokeWidth={6.5}
          strokeDasharray={dashed ? '8 5' : undefined}
          strokeOpacity={0.95}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {(onClick || onDrop) && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          style={{ cursor: onClick ? 'pointer' : 'default', pointerEvents: 'stroke' }}
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
          onDragOver={(e) => { if (onDrop) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
          onDrop={(e) => { if (onDrop) { e.preventDefault(); e.stopPropagation(); onDrop(e) } }}
        />
      )}
    </g>
  )
}

function ClusterNode({
  x, y, label, isSelected, isFixed, nodeR = NODE_R, onClick, showNumber,
}: {
  x: number
  y: number
  label: string
  isSelected: boolean
  isFixed: boolean
  nodeR?: number
  onClick?: () => void
  showNumber?: number
}) {
  const fill = isSelected ? 'var(--node-fill-selected)' : 'var(--node-fill)'
  const stroke = isSelected ? HOVER_COLOR : 'var(--node-stroke)'
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <circle r={nodeR} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} filter="url(#node-shadow)" />
      {isFixed && (
        <text x={nodeR - 2} y={-(nodeR + 2)} textAnchor="middle" fill={HOVER_COLOR} fontSize={13} fontWeight="bold">★</text>
      )}
      {label !== '' ? (
        <foreignObject
          x={-nodeR}
          y={-12}
          width={nodeR * 2}
          height={24}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
            dangerouslySetInnerHTML={{ __html: label }}
          />
        </foreignObject>
      ) : showNumber !== undefined ? (
        <text y={4} textAnchor="middle" fill="var(--node-text)" fontSize={14} style={{ pointerEvents: 'none' }}>
          {showNumber}
        </text>
      ) : null}
    </g>
  )
}

function ElementChip({ label, color, symbol, isSelected, onClick, onHover, onPointerDown }: {
  label: string
  color?: string
  symbol?: string
  isSelected: boolean
  onClick: () => void
  onHover?: (on: boolean) => void
  onPointerDown?: (e: React.PointerEvent, symbol: string) => void
}) {
  return (
      <g
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        onPointerDown={symbol && onPointerDown ? (e) => onPointerDown(e, symbol) : undefined}
        style={{ cursor: 'pointer', touchAction: 'none' }}
      >
      <rect
        width={CHIP_W}
        height={CHIP_H}
        rx={6}
        fill={isSelected ? 'var(--node-fill-selected)' : 'var(--node-fill)'}
        stroke={isSelected ? HOVER_COLOR : (color || 'var(--node-stroke)')}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      <foreignObject
        x={0}
        y={0}
        width={CHIP_W}
        height={CHIP_H}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '14px',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: label }}
        />
      </foreignObject>
    </g>
  )
}

const UNBOUND_COLOR = '#f59e0b'

function quadPoint(p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  }
}

function distToArrow(from: { x: number; y: number }, to: { x: number; y: number }, p: { x: number; y: number }): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = -dy / dist
  const uy = dx / dist
  const c = { x: (from.x + to.x) / 2 + ux * 8, y: (from.y + to.y) / 2 + uy * 8 }
  let best = Infinity
  for (let i = 0; i <= 20; i++) {
    const q = quadPoint(from, c, to, i / 20)
    best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y))
  }
  return best
}

function CustomActionEditor({ group, vw, vh }: { group: Group; vw: number; vh: number }) {
  const { actionSetSize, actionArrows, addArrow, bindArrow, removeArrow, replaceGenArrows, actionError } = useGroup()
  const { t } = useTranslation()
  const [editSel, setEditSel] = useState<number | null>(null)
  const [selectedGen, setSelectedGen] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ symbol: string; x: number; y: number } | null>(null)
  const [hoverArrow, setHoverArrow] = useState<number | null>(null)
  const dragRef = useRef<{ symbol: string; from: number } | null>(null)
  const downPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragMovedRef = useRef(false)
  const hoverArrowRef = useRef<number | null>(null)

  const n = actionSetSize ?? 1
  const ringR = Math.max(220, n * 22)
  const cx = vw / 2
  const cy = vh / 2 + 40
  const pos = (i: number) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR }
  }

  const genColor = (symbol: string) => {
    const gen = group.generators.find(g => g.symbol === symbol)
    return gen?.color || 'var(--node-stroke)'
  }

  const toViewBox = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect()
    const scale = Math.min(r.width / vw, r.height / vh)
    const x0 = r.left + (r.width - vw * scale) / 2
    const y0 = r.top + (r.height - vh * scale) / 2
    return { x: (clientX - x0) / scale, y: (clientY - y0) / scale }
  }

  const startDrag = (e: React.PointerEvent, symbol: string) => {
    if (e.button !== 0) return
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svg) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toViewBox(e.clientX, e.clientY, svg)
    dragMovedRef.current = false
    downPosRef.current = p
    dragRef.current = { symbol, from: -1 }
    setDrag({ symbol, x: p.x, y: p.y })
  }

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svg) return
    const p = toViewBox(e.clientX, e.clientY, svg)
    if (downPosRef.current && Math.hypot(p.x - downPosRef.current.x, p.y - downPosRef.current.y) > 14) {
      dragMovedRef.current = true
    }
    let bestIdx: number | null = null
    let bestDist = 48
    actionArrows.forEach((a, i) => {
      if (a.generatorId !== null) return
      const d = distToArrow(pos(a.from), pos(a.to), p)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    })
    hoverArrowRef.current = bestIdx
    setHoverArrow(bestIdx)
    setDrag(d => (d ? { ...d, x: p.x, y: p.y } : d))
  }

  const onDragEnd = () => {
    if (!dragRef.current) return
    const targetIdx = hoverArrowRef.current
    const moved = dragMovedRef.current
    const symbol = dragRef.current.symbol
    dragRef.current = null
    downPosRef.current = null
    hoverArrowRef.current = null
    setDrag(null)
    setHoverArrow(null)
    if (moved && targetIdx !== null) {
      const a = actionArrows[targetIdx]
      if (a && a.generatorId === null) bindArrow(a.from, symbol)
    }
    window.setTimeout(() => { dragMovedRef.current = false }, 0)
  }

  const k = group.generators.length
  const genColX = 60
  const genTop = cy - ((k - 1) / 2) * CHIP_ROW_H
  const genChips = group.generators.map((gen, i) => {
    return (
      <g
        key={`genchip-${i}`}
        transform={`translate(${genColX}, ${genTop + i * CHIP_ROW_H})`}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <ElementChip
          label={renderTex(texify(gen.symbol))}
          color={gen.color}
          symbol={gen.symbol}
          isSelected={selectedGen === gen.symbol}
          onClick={() => { if (!dragMovedRef.current) setSelectedGen(prev => (prev === gen.symbol ? null : gen.symbol)) }}
          onPointerDown={startDrag}
        />
      </g>
    )
  })

  const arrows = actionArrows.map((a, i) => {
    const from = pos(a.from)
    const to = pos(a.to)
    const isUnbound = a.generatorId === null
    const color = a.generatorId === null ? UNBOUND_COLOR : genColor(a.generatorId)
    return (
      <DirectedEdge
        key={`${a.from}-${i}`}
        sx={from.x}
        sy={from.y}
        ex={to.x}
        ey={to.y}
        color={color}
        width={isUnbound ? 4.5 : 3}
        headSize={isUnbound ? 13 : 12}
        nodeR={20}
        dashed={isUnbound}
        opacity={1}
        highlight={hoverArrow === i}
        onClick={() => {
          if (dragMovedRef.current) return
          if (isUnbound) {
            if (selectedGen) bindArrow(a.from, selectedGen)
            else removeArrow(a.from)
          } else {
            removeArrow(a.from)
          }
        }}
      />
    )
  })

  const hintY = genTop + k * CHIP_ROW_H + 16

  const chainArrows =
    selectedGen !== null
      ? actionArrows.some(a => a.generatorId === selectedGen)
        ? actionArrows.filter(a => a.generatorId === selectedGen)
        : actionArrows.filter(a => a.generatorId === null)
      : actionArrows.filter(a => a.generatorId === null)
  const candidates = computeCycleCandidates(chainArrows, n)

  return (
    <>
      {genChips}
      {candidates.length > 0 && (
        <foreignObject x={0} y={24} width={vw} height={46} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('action.cycleCandidates')}</span>
            {candidates.map(c => (
              <button
                key={c.length}
                onClick={() => {
                  if (dragMovedRef.current) return
                  replaceGenArrows(selectedGen, c.pairs)
                }}
                style={{
                  fontSize: 13,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  border: '1px solid var(--node-stroke)',
                  background: 'var(--node-fill)',
                  color: 'var(--text-primary)',
                }}
              >
                {c.length} {t('action.cycleUnit')} {c.label}
              </button>
            ))}
          </div>
        </foreignObject>
      )}
      <text x={genColX} y={hintY} fill="var(--text-secondary)" fontSize={14}>
        {t('action.editHint')}
      </text>
      <text x={genColX} y={hintY + 22} fill="var(--text-secondary)" fontSize={13}>
        {t('action.genSelectHint')}
      </text>
      {arrows}
      {Array.from({ length: n }, (_, i) => (
        <ClusterNode
          key={i}
          x={pos(i).x}
          y={pos(i).y}
          label=""
          showNumber={i + 1}
          isSelected={editSel === i}
          isFixed={false}
          nodeR={20}
          onClick={() => {
            if (dragMovedRef.current) return
            if (editSel === null) {
              setEditSel(i)
            } else if (editSel === i) {
              setEditSel(null)
            } else {
              addArrow(editSel, i)
              setEditSel(i)
            }
          }}
        />
      ))}
      {drag && (
        <g transform={`translate(${drag.x}, ${drag.y})`} opacity={0.92} style={{ pointerEvents: 'none' }}>
          <rect x={-CHIP_W / 2} y={-CHIP_H / 2} width={CHIP_W} height={CHIP_H} rx={6}
            fill={genColor(drag.symbol)} fillOpacity={0.35}
            stroke={genColor(drag.symbol)} strokeWidth={2.5} />
          <text x={0} y={5} textAnchor="middle" fill="var(--node-text)" fontSize={17} fontWeight="bold" style={{ pointerEvents: 'none' }}>
            {drag.symbol}
          </text>
          <text x={0} y={CHIP_H / 2 + 16} textAnchor="middle" fill={HOVER_COLOR} fontSize={13} style={{ pointerEvents: 'none' }}>
            {t('action.dropHint')}
          </text>
        </g>
      )}
      {editSel !== null && (
        <text x={cx} y={cy + ringR + 60} textAnchor="middle" fill={HOVER_COLOR} fontSize={16}>
          {t('action.editingSource', { x: String(editSel + 1) })}
        </text>
      )}
      {actionError && (
        <text x={cx} y={cy + ringR + 92} textAnchor="middle" fill="#f43f5e" fontSize={14}>
          {actionError.type === 'homomorphism'
            ? t('action.error.homomorphism', {
                g: actionError.g ?? '',
                gen: actionError.generatorId ?? '',
                x: String(actionError.from + 1),
              })
            : t(`action.error.${actionError.type}`, {
                gen: actionError.generatorId ?? '',
                from: String(actionError.from + 1),
                to: String(actionError.to + 1),
              })}
        </text>
      )}
    </>
  )
}

function computeFitVB(computation: GroupActionComputation): { width: number; height: number } {
  const widths = computation.orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const totalW = widths.reduce((a, b) => a + b, 0) + CLUSTER_GAP * Math.max(0, computation.orbits.length - 1)
  let yAcc = 0
  computation.orbits.forEach(o => {
    const size = o.elements.length
    yAcc += GRP_HDR + Math.ceil(size / CHIP_PER_ROW) * CHIP_ROW_H + 2 * GRP_PAD + GRP_GAP
  })
  const chipsH = yAcc - GRP_GAP
  const topRegion = 12 + chipsH + 30
  const maxH = Math.max(0, ...widths)
  const contentH = topRegion + 60 + maxH + 60
  const contentW = Math.max(totalW + 2 * CLUSTER_GAP, 320)
  return { width: Math.ceil(contentW), height: Math.ceil(contentH) }
}

function DisplayMode({ group, computation, legendHover, onLegendHover, viewBoxOverride }: {
  group: Group
  computation: GroupActionComputation
  legendHover: string | null
  onLegendHover: (s: string | null) => void
  viewBoxOverride?: { width: number; height: number }
}) {
  const { actionKind, actionSelectedElement, setActionSelectedElement, actionHoverElement, setActionHoverElement, viewBoxSize, selectElement } = useGroup()
  const { t } = useTranslation()
  const vw = viewBoxOverride?.width ?? viewBoxSize.width
  const vh = viewBoxOverride?.height ?? viewBoxSize.height

  const { n, perms, orbits, orbitOf } = computation
  const fixed = useMemo(() => new Set(computeFixedPoints(perms, n)), [perms, n])
  const isConjugation = actionKind === 'conjugation'
  const hoverActive = !!actionHoverElement

  const widths = orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const totalW = widths.reduce((a, b) => a + b, 0) + CLUSTER_GAP * (orbits.length - 1)
  const heights = orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const maxH = Math.max(0, ...heights)

  const legendStart = vw - 40 - group.generators.length * 110
  const legend = group.generators.map((gen, i) => (
    <g
      key={`legend-${i}`}
      transform={`translate(${legendStart + i * 110}, 0)`}
      onMouseEnter={() => onLegendHover(gen.symbol)}
      onMouseLeave={() => onLegendHover(null)}
      style={{ cursor: 'pointer' }}
    >
      <circle cx={10} cy={10} r={6} fill={gen.color || 'var(--node-stroke)'} />
      <text x={22} y={15} fill="var(--text-secondary)" fontSize={14}>{gen.symbol}</text>
    </g>
  ))

  const grpW: number[] = []
  const grpH: number[] = []
  orbits.forEach(o => {
    const size = o.elements.length
    const colsInRow = Math.min(CHIP_PER_ROW, size)
    grpW.push(colsInRow * CHIP_W + (colsInRow - 1) * CHIP_GAP + 2 * GRP_PAD)
    grpH.push(GRP_HDR + Math.ceil(size / CHIP_PER_ROW) * CHIP_ROW_H + 2 * GRP_PAD)
  })

  let yAcc = 0
  const lineTop = orbits.map((_, gi) => {
    const top = yAcc
    yAcc += grpH[gi] + GRP_GAP
    return top
  })
  const chipsH = yAcc - GRP_GAP

  const topRegion = 12 + chipsH + 30
  const contentH = topRegion + 60 + maxH
  const vOffset = Math.max(30, (vh - contentH) / 2)

  const centers: { x: number; y: number; r: number }[] = []
  let cursorX = Math.max(200, (vw - totalW) / 2)
  for (let i = 0; i < orbits.length; i++) {
    const r = clusterRadius(orbits[i].elements.length)
    centers.push({ x: cursorX + widths[i] / 2, y: vOffset + topRegion + 60 + maxH / 2, r })
    cursorX += widths[i] + CLUSTER_GAP
  }

  const nodePos = (x: number) => {
    const oi = orbitOf[x]
    const c = centers[oi]
    const idx = orbits[oi].elements.indexOf(x)
    const angle = (idx / orbits[oi].elements.length) * 2 * Math.PI - Math.PI / 2
    return { x: c.x + Math.cos(angle) * c.r, y: c.y + Math.sin(angle) * c.r }
  }

  const hoverPerm = useMemo(() => {
    if (!actionHoverElement) return null
    return perms.get(actionHoverElement) ?? null
  }, [actionHoverElement, perms])

  if (isConjugation && computation.n !== group.order) return null

  interface PairRec { x: number; y: number; gi: number }
  const pairMap = new Map<string, PairRec[]>()
  const edgeList: { key: string; rec: PairRec }[] = []
  for (let gi = 0; gi < group.generators.length; gi++) {
    const gen = group.generators[gi]
    const genEl = gen.apply(group.identity)
    const p = perms.get(genEl.id)
    if (!p) continue
    for (let x = 0; x < n; x++) {
      const y = p[x]
      if (y === x) continue
      const a = Math.min(x, y)
      const b = Math.max(x, y)
      const key = `${a}|${b}`
      const rec: PairRec = { x, y, gi }
      const arr = pairMap.get(key)
      if (arr) arr.push(rec)
      else pairMap.set(key, [rec])
      edgeList.push({ key, rec })
    }
  }

  const genEdges: React.ReactNode[] = []
  for (const { key, rec } of edgeList) {
    const { x, y, gi } = rec
    const gen = group.generators[gi]
    const arr = pairMap.get(key)!
    const slot = arr.indexOf(rec)
    const total = arr.length
    const from = nodePos(x)
    const to = nodePos(y)
    const edgeLen = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2) || 1
    const step = Math.max(10, Math.min(16, edgeLen * 0.06))
    const offset = (slot - (total - 1) / 2) * step
    const c = centers[orbitOf[x]]
    const ref = nodePos(arr[0].x)
    const angA = Math.atan2(ref.y - c.y, ref.x - c.x)
    const tFrom = { x: -Math.sin(angA), y: Math.cos(angA) }
    const isLegendTarget = legendHover !== null && legendHover === gen.symbol
    const dimmed = hoverActive || (legendHover !== null && !isLegendTarget)
    genEdges.push(
      <DirectedEdge
        key={`genedge-${gi}-${x}`}
        sx={from.x}
        sy={from.y}
        ex={to.x}
        ey={to.y}
        color={dimmed ? 'var(--node-stroke)' : (gen.color || 'var(--node-stroke)')}
        width={dimmed ? 1.2 : (isLegendTarget ? 3.4 : 3)}
        headSize={18}
        nodeR={NODE_R}
        offset={offset}
        tFrom={tFrom}
        dashed={dimmed}
        opacity={dimmed ? 0.18 : 0.95}
      />
    )
  }

  const hoverEdges: React.ReactNode[] = []
  if (hoverPerm) {
    for (let x = 0; x < n; x++) {
      const y = hoverPerm[x]
      if (y === x) {
        const p = nodePos(x)
        hoverEdges.push(
          <circle key={`loop-${x}`} cx={p.x} cy={p.y - NODE_R - 6} r={5} fill="none" stroke={HOVER_COLOR} strokeWidth={1.5} />
        )
        continue
      }
      const from = nodePos(x)
      const to = nodePos(y)
      hoverEdges.push(
        <DirectedEdge
          key={`h-${x}`}
          sx={from.x}
          sy={from.y}
          ex={to.x}
          ey={to.y}
          color={HOVER_COLOR}
          width={3}
          headSize={18}
          nodeR={NODE_R}
          opacity={0.95}
          dir={x < y ? 1 : -1}
        />
      )
    }
  }

  const selectedOrbit = actionSelectedElement !== null ? orbitOf[actionSelectedElement] : -1

  const chips: React.ReactNode[] = []
  orbits.forEach((o, g) => {
    const xStart = (vw - grpW[g]) / 2
    const gy = vOffset + 12 + lineTop[g]
    const groupChips = o.elements.map((x, ci) => {
      const row = Math.floor(ci / CHIP_PER_ROW)
      const col = ci % CHIP_PER_ROW
      const el = actionKind === 'conjugation' ? group.elements[x] : null
      const label = el ? renderTex(texify(el.label)) : String(x + 1)
      return (
        <g key={el ? el.id : `s-${x}`} transform={`translate(${GRP_PAD + col * (CHIP_W + CHIP_GAP)}, ${GRP_HDR + GRP_PAD + row * CHIP_ROW_H})`}>
          <ElementChip
            label={label}
            isSelected={el ? actionHoverElement === el.id : actionSelectedElement === x}
            onClick={el ? () => selectElement(el.id, false) : () => setActionSelectedElement(actionSelectedElement === x ? null : x)}
            onHover={el ? (on) => setActionHoverElement(on ? el.id : null) : undefined}
          />
        </g>
      )
    })
    chips.push(
      <g key={`grp-${g}`} transform={`translate(${xStart}, ${gy})`}>
        <rect
          width={grpW[g]}
          height={grpH[g]}
          rx={8}
          fill="var(--node-fill)"
          fillOpacity={0.15}
          stroke="var(--node-stroke)"
          strokeOpacity={0.25}
          strokeDasharray="3 3"
        />
        <text x={GRP_PAD + 2} y={GRP_HDR - 4} fill="var(--text-secondary)" fontSize={13}>
          {t('action.orbitGroup', { size: String(o.elements.length) })}
        </text>
        {groupChips}
      </g>
    )
  })

  return (
    <>
      {legend}
      {chips}
      {centers.map((c, oi) => (
        <circle
          key={`glow-${oi}`}
          cx={c.x}
          cy={c.y}
          r={c.r + NODE_R + 14}
          fill="none"
          stroke={selectedOrbit === oi ? HOVER_COLOR : 'var(--node-stroke)'}
          strokeWidth={selectedOrbit === oi ? 3 : 1}
          strokeOpacity={selectedOrbit === oi ? 0.9 : 0.25}
          strokeDasharray={selectedOrbit === oi ? undefined : '4 6'}
        />
      ))}
      {genEdges}
      {hoverEdges}
      {Array.from({ length: n }, (_, x) => {
        const p = nodePos(x)
        return (
          <ClusterNode
            key={x}
            x={p.x}
            y={p.y}
            label={isConjugation ? renderTex(texify(group.elements[x].label)) : ''}
            showNumber={isConjugation ? undefined : x + 1}
            isSelected={actionSelectedElement === x}
            isFixed={fixed.has(x)}
            onClick={() => setActionSelectedElement(actionSelectedElement === x ? null : x)}
          />
        )
      })}
    </>
  )
}

export function ActionView() {
  const { currentGroup, actionComputation, actionEditing, canvasTransform, viewBoxSize, actionKind, actionHoverElement, actionSelectedElement, actionSetSize } = useGroup()
  const { t } = useTranslation()
  const [legendHover, setLegendHover] = useState<string | null>(null)

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const isConjugation = actionKind === 'conjugation'
  const hoverEl = actionHoverElement ? currentGroup.elements.find(e => e.id === actionHoverElement) : null
  const showBanner = !!actionComputation && !actionEditing
  const titleLine = isConjugation
    ? t('action.viewTitle.conjugation')
    : t('action.viewTitle.custom')
  const edgeLine = hoverEl
    ? t('action.hoverElEdges', { el: hoverEl.label })
    : legendHover
      ? t('action.hoverGenEdges', { gen: legendHover })
      : actionSelectedElement !== null
        ? t('action.selHint')
        : t('action.edgeBlurb')
  const edgeColor = hoverEl || legendHover ? HOVER_COLOR : 'var(--text-secondary)'

  const fitVB = actionComputation && !actionEditing ? computeFitVB(actionComputation) : null
  const editRingR = Math.max(220, (actionSetSize ?? 1) * 22)
  const editVH = Math.max(900, 2 * editRingR + 520)
  const vb = actionEditing ? { width: 1200, height: editVH } : fitVB ?? viewBoxSize

  return (
    <>
      {showBanner && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            maxWidth: '92%',
            background: 'var(--panel-bg)',
            opacity: 0.94,
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-color, rgba(128,128,128,0.35))',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{titleLine}</div>
          <div style={{ fontSize: 12, color: edgeColor, marginTop: 2 }}>{edgeLine}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${vb.width} ${vb.height}`} className="view-svg" style={{ userSelect: 'none' }}>
        <defs>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
        <g transform={actionEditing ? undefined : `translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
          {actionEditing ? (
            <CustomActionEditor group={currentGroup} vw={1200} vh={editVH} />
          ) : actionComputation ? (
              <DisplayMode group={currentGroup} computation={actionComputation} legendHover={legendHover} onLegendHover={setLegendHover} viewBoxOverride={fitVB ?? undefined} />
          ) : (
            <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-secondary)" fontSize={22}>
              {t('action.noAction')}
            </text>
          )}
        </g>
      </svg>
    </>
  )
}

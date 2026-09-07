import { useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import type { Group, GroupActionArrow, GroupActionComputation, GroupActionKind, GroupElement, CanvasTransform } from '../../core/types'
import { computeFixedPoints, computeCycleCandidates, type CustomArrowError } from '../../core/algebra/actions'

// ─── Action props 化内核（批次六 FGVE） ─────────────────────────────────
// 受控 ViewWindow（conjugation/regular/custom 三来源）与主画布（经 context 壳
// ActionView）共用。group/computation 之外全部可选：主画布壳由全局 Provider 组装，
// 窗口引擎自包含时自算 computation 并以本地/受控态驱动选中与编辑。

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
const SNAP_R = 44

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
  x, y, label, isSelected, isFixed, nodeR = NODE_R, onClick, onPointerDown, showNumber, onHoverIn, onHoverOut, testId,
}: {
  x: number
  y: number
  label: string
  isSelected: boolean
  isFixed: boolean
  nodeR?: number
  onClick?: () => void
  onPointerDown?: (e: React.PointerEvent) => void
  showNumber?: number
  /** 悬停进入（窗口接就地气泡 + 金色箭头联动；主画布壳不传） */
  onHoverIn?: () => void
  onHoverOut?: () => void
  /** 测试钩子（action-node 显示态环节点 / action-edit-node 编辑态数字节点） */
  testId?: string
}) {
  const fill = isSelected ? 'var(--node-fill-selected)' : 'var(--node-fill)'
  const stroke = isSelected ? HOVER_COLOR : 'var(--node-stroke)'
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerDown={onPointerDown}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      data-testid={testId}
      style={{ cursor: onClick || onPointerDown ? 'pointer' : 'default' }}
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

interface CustomActionEditorProps {
  group: Group
  vw: number
  vh: number
  setSize: number
  arrows: GroupActionArrow[]
  error: CustomArrowError | null
  onAddArrow: (from: number, to: number, generatorId?: string | null) => void
  onBindArrow: (from: number, to: number, generatorId: string) => void
  onRemoveArrow: (from: number, generatorId?: string | null, to?: number) => void
  onReplaceGenArrows: (generatorId: string | null, pairs: [number, number][]) => void
}

function CustomActionEditor({ group, vw, vh, setSize: actionSetSize, arrows: actionArrows, error: actionError, onAddArrow: addArrow, onBindArrow: bindArrow, onRemoveArrow: removeArrow, onReplaceGenArrows: replaceGenArrows }: CustomActionEditorProps) {
  const { t } = useTranslation()
  const [selectedGen, setSelectedGen] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ symbol: string; x: number; y: number } | null>(null)
  const [hoverArrow, setHoverArrow] = useState<number | null>(null)
  const [draw, setDraw] = useState<{ from: number; x: number; y: number; snap: number | null } | null>(null)
  const drawInfoRef = useRef<{ from: number; origin: { x: number; y: number }; snap: number | null; justStarted: boolean; justPicked: boolean } | null>(null)
  const movedRef = useRef(false)
  const dragRef = useRef<{ symbol: string; from: number } | null>(null)
  const downPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragMovedRef = useRef(false)
  const hoverArrowRef = useRef<number | null>(null)

  const n = actionSetSize
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
      if (a && a.generatorId === null) bindArrow(a.from, a.to, symbol)
    }
    window.setTimeout(() => { dragMovedRef.current = false }, 0)
  }

  const startArrowDraw = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return
    if (drawInfoRef.current) return
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svg) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toViewBox(e.clientX, e.clientY, svg)
    movedRef.current = false
    drawInfoRef.current = { from: i, origin: p, snap: null, justStarted: true, justPicked: false }
    setDraw({ from: i, x: p.x, y: p.y, snap: null })
  }

  const onArrowMove = (e: React.PointerEvent) => {
    const info = drawInfoRef.current
    if (!info) return
    const svg = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svg) return
    const p = toViewBox(e.clientX, e.clientY, svg)
    if (Math.hypot(p.x - info.origin.x, p.y - info.origin.y) > 6) movedRef.current = true
    let snap: number | null = null
    for (let j = 0; j < n; j++) {
      const q = pos(j)
      if (Math.hypot(p.x - q.x, p.y - q.y) < SNAP_R) {
        snap = j
        break
      }
    }
    drawInfoRef.current = { ...info, snap }
    setDraw(d => (d ? { ...d, x: p.x, y: p.y, snap } : d))
  }

  const deployArrow = (from: number, to: number) => {
    addArrow(from, to, selectedGen)
    drawInfoRef.current = null
    setDraw(null)
  }

  const onArrowUp = () => {
    const info = drawInfoRef.current
    if (!info) return
    if (movedRef.current) {
      drawInfoRef.current = null
      setDraw(null)
      if (info.snap !== null && info.snap !== info.from) {
        addArrow(info.from, info.snap, selectedGen)
      }
      return
    }
    if (info.justStarted) {
      drawInfoRef.current = { ...info, justStarted: false, justPicked: true }
    }
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

  const dirCount = new Map<string, number>()
  const dirIndex = new Map<number, number>()
  actionArrows.forEach((a, i) => {
    if (a.from === a.to) return
    const key = `${Math.min(a.from, a.to)}|${Math.max(a.from, a.to)}`
    const dk = a.from < a.to ? `${key}f` : `${key}b`
    const c = dirCount.get(dk) ?? 0
    dirCount.set(dk, c + 1)
    dirIndex.set(i, c)
  })

  const loopGroups = new Map<number, number[]>()
  actionArrows.forEach((a, i) => {
    if (a.from !== a.to) return
    const arr = loopGroups.get(a.from)
    if (arr) arr.push(i)
    else loopGroups.set(a.from, [i])
  })
  const loopSlot = new Map<number, number>()
  loopGroups.forEach(arr => arr.forEach((idx, slot) => loopSlot.set(idx, slot)))

  const arrowsEls = actionArrows.map((a, i) => {
    const from = pos(a.from)
    const to = pos(a.to)
    const isUnbound = a.generatorId === null
    const color = a.generatorId === null ? UNBOUND_COLOR : genColor(a.generatorId)
    const handleClick = () => {
      if (dragMovedRef.current) return
      if (isUnbound) {
        if (selectedGen) bindArrow(a.from, a.to, selectedGen)
        else removeArrow(a.from, null, a.to)
      } else {
        removeArrow(a.from, a.generatorId)
      }
    }
    if (a.from === a.to) {
      const slot = loopSlot.get(i) ?? 0
      const cy = from.y - 32 + slot * 24
      return (
        <g key={`loop-${a.generatorId ?? 'u'}-${a.from}`} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleClick() }}>
          <circle cx={from.x} cy={cy} r={16} fill="none" stroke="transparent" strokeWidth={16} />
          <circle cx={from.x} cy={cy} r={12} fill="none" stroke={color} strokeWidth={isUnbound ? 4.5 : 3} strokeDasharray={isUnbound ? '5 4' : undefined} opacity={1} />
          <polygon points={`${from.x},${cy - 14} ${from.x - 6},${cy - 23} ${from.x + 6},${cy - 23}`} fill={color} opacity={1} />
        </g>
      )
    }
    const offset = 8 + (dirIndex.get(i) ?? 0) * 18
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
        offset={offset}
        dashed={isUnbound}
        opacity={1}
        highlight={hoverArrow === i}
        onClick={handleClick}
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
    <g onPointerMove={onArrowMove} onPointerUp={onArrowUp}>
      <rect
        x={0}
        y={0}
        width={vw}
        height={vh}
        fill="transparent"
        onClick={() => {
          drawInfoRef.current = null
          setDraw(null)
        }}
      />
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
      {arrowsEls}
      {draw && (
        <DirectedEdge
          sx={pos(draw.from).x}
          sy={pos(draw.from).y}
          ex={draw.snap !== null ? pos(draw.snap).x : draw.x}
          ey={draw.snap !== null ? pos(draw.snap).y : draw.y}
          color={HOVER_COLOR}
          width={3}
          headSize={13}
          nodeR={20}
          dashed
          opacity={0.9}
        />
      )}
      {Array.from({ length: n }, (_, i) => (
        <ClusterNode
          key={i}
          x={pos(i).x}
          y={pos(i).y}
          label=""
          showNumber={i + 1}
          isSelected={draw?.snap === i}
          isFixed={false}
          nodeR={20}
          testId={`action-edit-node-${i + 1}`}
          onPointerDown={(e) => startArrowDraw(e, i)}
          onClick={() => {
            const info = drawInfoRef.current
            if (!info) return
            if (info.justPicked) {
              drawInfoRef.current = { ...info, justPicked: false }
              return
            }
            deployArrow(info.from, i)
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
    </g>
  )
}

function computeFitVB(computation: GroupActionComputation, showLabels = true): { width: number; height: number } {
  const widths = computation.orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const totalW = widths.reduce((a, b) => a + b, 0) + CLUSTER_GAP * Math.max(0, computation.orbits.length - 1)
  let yAcc = 0
  if (showLabels) {
    computation.orbits.forEach(o => {
      const size = o.elements.length
      yAcc += GRP_HDR + Math.ceil(size / CHIP_PER_ROW) * CHIP_ROW_H + 2 * GRP_PAD + GRP_GAP
    })
  }
  const chipsH = showLabels ? yAcc - GRP_GAP : 0
  // showLabels=false（嵌入窗口缺省）：顶部 chips 区隐藏，只留生成元图例高度
  const topRegion = (showLabels ? 12 : 42) + chipsH + 30
  const maxH = Math.max(0, ...widths)
  const contentH = topRegion + 60 + maxH + 60
  const contentW = Math.max(totalW + 2 * CLUSTER_GAP, 320)
  return { width: Math.ceil(contentW), height: Math.ceil(contentH) }
}

interface DisplayModeProps {
  group: Group
  computation: GroupActionComputation
  kind: GroupActionKind
  selectedElement: number | null
  onSelectedElementChange?: (x: number | null) => void
  hoveredElement: string | null
  onHoverElementChange?: (id: string | null) => void
  /** chips 群元素点击 → 主画布全局选中；窗口不传（chips 缺省隐藏也无需此交互） */
  onSetElementSelect?: (id: string) => void
  /** 节点常驻标签 + 顶部轨道 chips 区；缺省 true（主画布观感）。窗口 false：节点空圈 + chips 区隐藏 */
  showLabels: boolean
  /** 悬停就地气泡（窗口接 handleHover）；主画布壳不传 */
  onHover?: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  legendHover: string | null
  onLegendHover: (s: string | null) => void
  viewBoxOverride?: { width: number; height: number }
  canvasTransform: CanvasTransform
  viewBoxSize: { width: number; height: number }
}

function DisplayMode({ group, computation, kind, selectedElement, onSelectedElementChange, hoveredElement, onHoverElementChange, onSetElementSelect, showLabels, onHover, legendHover, onLegendHover, viewBoxOverride, canvasTransform, viewBoxSize }: DisplayModeProps) {
  const { t } = useTranslation()
  const vw = viewBoxOverride?.width ?? viewBoxSize.width
  const vh = viewBoxOverride?.height ?? viewBoxSize.height

  const { n, perms, orbits, orbitOf } = computation
  const fixed = useMemo(() => new Set(computeFixedPoints(perms, n)), [perms, n])
  const isConjugation = kind === 'conjugation'
  const showsElements = isConjugation || kind === 'regular'
  const hoverActive = !!hoveredElement

  // 场景 svg viewBox = computeFitVB 内容包围盒（vw/vh），但 .view-svg 拉伸填满
  // 视口（viewBoxSize = 容器 CSS 像素）。宽高比不一致时浏览器按 preserveAspectRatio
  // 居中缩放（letterbox）→ 视口坐标 = viewBox 坐标经仿射 (s, ox, oy)。锚点必须套同一
  // 仿射，否则就地气泡偏离节点（其它视图 svg viewBox=容器尺寸 1:1，无需此步）。
  const svgFit = Math.min(viewBoxSize.width / Math.max(vw, 1), viewBoxSize.height / Math.max(vh, 1))
  const letterboxX = (viewBoxSize.width - vw * svgFit) / 2
  const letterboxY = (viewBoxSize.height - vh * svgFit) / 2
  const anchorOf = (p: { x: number; y: number }) => ({
    x: (p.x * canvasTransform.scale + canvasTransform.x) * svgFit + letterboxX,
    y: (p.y * canvasTransform.scale + canvasTransform.y) * svgFit + letterboxY,
  })

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
  const chipsH = showLabels ? yAcc - GRP_GAP : 0

  const topRegion = (showLabels ? 12 : 42) + chipsH + 30
  const contentH = topRegion + 60 + maxH
  const vOffset = Math.max(30, (vh - contentH) / 2)

  const centers: { x: number; y: number; r: number }[] = []
  let cursorX = Math.max(0, (vw - totalW) / 2)
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
    if (!hoveredElement) return null
    return perms.get(hoveredElement) ?? null
  }, [hoveredElement, perms])

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

  const selectedOrbit = selectedElement !== null ? orbitOf[selectedElement] : -1

  const chips: React.ReactNode[] = []
  orbits.forEach((o, g) => {
    const xStart = (vw - grpW[g]) / 2
    const gy = vOffset + 12 + lineTop[g]
    const groupChips = o.elements.map((x, ci) => {
      const row = Math.floor(ci / CHIP_PER_ROW)
      const col = ci % CHIP_PER_ROW
      const el = showsElements ? group.elements[x] : null
      const label = el
        ? renderTex(texify(el.label))
        : computation.setLabels?.[x]
          ? renderTex(texify(computation.setLabels[x]))
          : String(x + 1)
      return (
        <g key={el ? el.id : `s-${x}`} transform={`translate(${GRP_PAD + col * (CHIP_W + CHIP_GAP)}, ${GRP_HDR + GRP_PAD + row * CHIP_ROW_H})`}>
          <ElementChip
            label={label}
            isSelected={el ? hoveredElement === el.id : selectedElement === x}
            onClick={el ? () => onSetElementSelect?.(el.id) : () => {
              const next = selectedElement === x ? null : x
              onHoverElementChange?.(null)
              onSelectedElementChange?.(next)
            }}
            onHover={el ? (on) => onHoverElementChange?.(on ? el.id : null) : undefined}
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
      {showLabels && chips}
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
        const el = showsElements ? group.elements[x] : null
        // 窗口模式（onHover 传入）：节点悬停触发就地气泡 + 金色箭头联动；
        // 主画布壳不传 onHover → 不挂 hover，保持原行为零变化
        const canHover = !!el && !!onHover
        return (
          <ClusterNode
            key={x}
            x={p.x}
            y={p.y}
            label={showLabels && showsElements ? renderTex(texify(group.elements[x].label)) : showLabels && computation.setLabels?.[x] ? renderTex(texify(computation.setLabels[x])) : ''}
            showNumber={showsElements ? undefined : (computation.setLabels ? undefined : x + 1)}
            isSelected={selectedElement === x}
            isFixed={fixed.has(x)}
            testId={`action-node-${x}`}
            onClick={() => onSelectedElementChange?.(selectedElement === x ? null : x)}
            onHoverIn={canHover ? () => {
              onHoverElementChange?.(el!.id)
              onHover?.(el, anchorOf(p))
            } : undefined}
            onHoverOut={canHover ? () => {
              onHoverElementChange?.(null)
              onHover?.(null, null)
            } : undefined}
          />
        )
      })}
    </>
  )
}

// ─── ActionScene：banner + svg 场景 + Stab box 全场景 ──────────────────────

export interface ActionSceneProps {
  group: Group
  /** 作用来源；窗口范围 conjugation/regular/custom（sylow/coset 仅主画布壳会传） */
  kind: GroupActionKind
  computation: GroupActionComputation | null
  /** custom 编辑模式（渲染 CustomActionEditor，不吃 canvasTransform） */
  editing?: boolean
  /** 编辑模式 |X|（1..20） */
  setSize?: number | null
  /** 编辑模式箭头列表 */
  arrows?: GroupActionArrow[]
  /** 编辑模式错误（画布内红字提示） */
  error?: CustomArrowError | null
  onAddArrow?: (from: number, to: number, generatorId?: string | null) => void
  onBindArrow?: (from: number, to: number, generatorId: string) => void
  onRemoveArrow?: (from: number, generatorId?: string | null, to?: number) => void
  onReplaceGenArrows?: (generatorId: string | null, pairs: [number, number][]) => void
  /** 选中集合元素索引（OST 交互 + 底部 Stab box） */
  selectedElement?: number | null
  onSelectedElementChange?: (x: number | null) => void
  /** 悬停群元素 id（金色箭头联动；主画布壳接 context） */
  hoveredElement?: string | null
  onHoverElementChange?: (id: string | null) => void
  /** chips 群元素点击 → 主画布全局选中；窗口不传 */
  onSetElementSelect?: (id: string) => void
  /** 节点常驻标签 + 顶部轨道 chips 区；缺省 true（主画布观感）。窗口传 false：
   *  节点空圈 + chips 区隐藏 + conjugation/regular 节点悬停就地气泡 */
  showLabels?: boolean
  /** 悬停就地气泡回调（窗口接 handleHover） */
  onHover?: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  /** 内容平移缩放（主画布壳接 canvasTransform，窗口接窗口 ct）；编辑模式不吃 */
  canvasTransform?: CanvasTransform
  /** 视口尺寸；fitVB 自适应时作为兜底 */
  viewBoxSize?: { width: number; height: number }
  /** sylow 作用的素数（banner 标题用）；窗口不传 */
  prime?: number | null
}

const DEFAULT_TRANSFORM: CanvasTransform = { x: 0, y: 0, scale: 1 }
const DEFAULT_VB = { width: 2000, height: 2000 }

export function ActionScene({
  group,
  kind,
  computation,
  editing = false,
  setSize = null,
  arrows = [],
  error = null,
  onAddArrow,
  onBindArrow,
  onRemoveArrow,
  onReplaceGenArrows,
  selectedElement = null,
  onSelectedElementChange,
  hoveredElement = null,
  onHoverElementChange,
  onSetElementSelect,
  showLabels = true,
  onHover,
  canvasTransform = DEFAULT_TRANSFORM,
  viewBoxSize = DEFAULT_VB,
  prime = null,
}: ActionSceneProps) {
  const { t } = useTranslation()
  const [legendHover, setLegendHover] = useState<string | null>(null)

  const isConjugation = kind === 'conjugation'
  const showsElements = isConjugation || kind === 'regular'
  const hoverEl = hoveredElement ? group.elements.find(e => e.id === hoveredElement) ?? null : null
  const showBanner = !!computation && !editing
  // 窗口模式（onHover 传入）banner 收敛为一行核心公式，隐藏第二行动态说明：
  // kind 名已在窗口标题栏，轨道/弧线含义由视图自明（custom 无公式 → 整条 banner 隐藏）。
  // 主画布壳不传 onHover → 保留原两行完整说明，零行为变化。
  const isWindow = !!onHover
  const titleLine = isWindow
    ? isConjugation ? 'g·x = g·x·g⁻¹'
      : kind === 'regular' ? 'g·x = g·x'
        : ''
    : isConjugation
      ? t('action.viewTitle.conjugation')
      : kind === 'sylow'
        ? t('action.viewTitle.sylow', { p: prime ?? '' })
        : kind === 'regular'
          ? t('action.viewTitle.regular')
          : kind === 'coset'
            ? t('action.viewTitle.coset')
            : t('action.viewTitle.custom')
  const edgeLine = hoverEl
    ? t('action.hoverElEdges', { el: hoverEl.label })
    : legendHover
      ? t('action.hoverGenEdges', { gen: legendHover })
      : selectedElement !== null
        ? t('action.selHint')
        : t('action.edgeBlurb')
  const edgeColor = hoverEl || legendHover ? HOVER_COLOR : 'var(--text-secondary)'

  const fitVB = computation && !editing ? computeFitVB(computation, showLabels) : null
  const editRingR = Math.max(220, (setSize ?? 1) * 22)
  const editVH = Math.max(900, 2 * editRingR + 520)
  const vb = editing ? { width: 1200, height: editVH } : fitVB ?? viewBoxSize

  const stabElements = computation && selectedElement !== null
    ? (computation.stabilizers.get(selectedElement) ?? [])
        .map(id => group.elements.find(e => e.id === id))
        .filter((el): el is NonNullable<typeof el> => !!el)
    : []
  const selLabel = computation && selectedElement !== null
    ? (showsElements
        ? renderTex(texify(group.elements[selectedElement]?.label ?? ''))
        : computation.setLabels?.[selectedElement]
          ? renderTex(texify(computation.setLabels[selectedElement]))
          : String(selectedElement + 1))
    : ''
  const showStabBox = !!computation && !editing && selectedElement !== null && stabElements.length > 0

  return (
    <>
      {showBanner && titleLine !== '' && (
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
            padding: isWindow ? '4px 12px' : '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-color, rgba(128,128,128,0.35))',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: isWindow ? 12 : 13, fontWeight: 600, color: 'var(--text-primary)' }}>{titleLine}</div>
          {!isWindow && <div style={{ fontSize: 12, color: edgeColor, marginTop: 2 }}>{edgeLine}</div>}
        </div>
      )}
      <svg viewBox={`0 0 ${vb.width} ${vb.height}`} className="view-svg" style={{ userSelect: 'none' }}>
        <defs>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>
        <g transform={editing ? undefined : `translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
          {editing ? (
            <CustomActionEditor
              group={group}
              vw={1200}
              vh={editVH}
              setSize={setSize ?? 1}
              arrows={arrows}
              error={error}
              onAddArrow={onAddArrow ?? (() => {})}
              onBindArrow={onBindArrow ?? (() => {})}
              onRemoveArrow={onRemoveArrow ?? (() => {})}
              onReplaceGenArrows={onReplaceGenArrows ?? (() => {})}
            />
          ) : computation ? (
            <DisplayMode
              group={group}
              computation={computation}
              kind={kind}
              selectedElement={selectedElement}
              onSelectedElementChange={onSelectedElementChange}
              hoveredElement={hoveredElement}
              onHoverElementChange={onHoverElementChange}
              onSetElementSelect={onSetElementSelect}
              showLabels={showLabels}
              onHover={onHover}
              legendHover={legendHover}
              onLegendHover={setLegendHover}
              viewBoxOverride={fitVB ?? undefined}
              canvasTransform={canvasTransform}
              viewBoxSize={viewBoxSize}
            />
          ) : (
            <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-secondary)" fontSize={22}>
              {t('action.noAction')}
            </text>
          )}
        </g>
      </svg>
      {showStabBox && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            maxWidth: '92%',
            background: 'var(--panel-bg)',
            opacity: 0.96,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-color, rgba(128,128,128,0.35))',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              <span dangerouslySetInnerHTML={{ __html: t('action.stabilizerFor', { el: selLabel }) }} /> <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>|G_x| = {stabElements.length}</span>
            </span>
            <button
              onClick={() => onSelectedElementChange?.(null)}
              style={{
                marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1, padding: '2px 4px',
              }}
              title={t('action.closeStab')}
            >×</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
            {stabElements.map(el => (
              <span
                key={el.id}
                style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 12,
                  background: 'var(--bg-interactive)', border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)', whiteSpace: 'nowrap',
                }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import type { Group, GroupActionComputation } from '../../core/types'
import { computeFixedPoints } from '../../core/algebra/actions'

const NODE_R = 14
const CLUSTER_PAD = 26
const CLUSTER_GAP = 90
const CHIP_W = 92
const CHIP_H = 30
const CHIP_GAP = 8
const CHIP_ROW_H = CHIP_H + 10
const CHIP_TOP = 40
const HOVER_COLOR = '#ffd93d'

function clusterRadius(size: number): number {
  return Math.max(26, size * 5)
}

function arrowHeadPoints(ex: number, ey: number, angle: number): string {
  const size = 7
  const a1 = angle - Math.PI / 6
  const a2 = angle + Math.PI / 6
  return `${ex},${ey} ${ex + Math.cos(a1) * size},${ey + Math.sin(a1) * size} ${ex + Math.cos(a2) * size},${ey + Math.sin(a2) * size}`
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
  onClick?: () => void
}

function DirectedEdge({ sx, sy, ex, ey, color, width = 1.8, dashed, dir = 1, onClick }: EdgeProps) {
  const dx = ex - sx
  const dy = ey - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  const nx = -uy
  const ny = ux
  const bend = 8 * dir
  const midX = (sx + ex) / 2
  const midY = (sy + ey) / 2
  const c1x = midX + nx * bend
  const c1y = midY + ny * bend
  const angle = Math.atan2(ey - c1y, ex - c1x)
  const headLen = 7
  const hx = ex - Math.cos(angle) * headLen
  const hy = ey - Math.sin(angle) * headLen
  const d = `M${sx},${sy} Q${c1x},${c1y} ${hx},${hy}`

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeOpacity={0.85}
        strokeLinecap="round"
      />
      <polygon
        points={arrowHeadPoints(ex, ey, angle)}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
      {onClick && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onClick={(e) => { e.stopPropagation(); onClick() }}
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
        <text y={4} textAnchor="middle" fill="var(--node-text)" fontSize={13} style={{ pointerEvents: 'none' }}>
          {showNumber}
        </text>
      ) : null}
    </g>
  )
}

function ElementChip({ label, color, symbol, isSelected, onClick, onHover }: {
  label: string
  color?: string
  symbol?: string
  isSelected: boolean
  onClick: () => void
  onHover?: (on: boolean) => void
}) {
  return (
      <g
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        {...({ draggable: !!symbol } as React.SVGProps<SVGGElement>)}
      onDragStart={(e) => {
        if (!symbol) return
        e.dataTransfer.setData('text/plain', symbol)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      style={{ cursor: 'pointer' }}
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
            width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '13px',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: label }}
        />
      </foreignObject>
    </g>
  )
}

function CustomActionEditor({ group, vw, vh }: { group: Group; vw: number; vh: number }) {
  const { actionSetSize, actionArrows, addArrow, bindArrow, removeArrow, actionError } = useGroup()
  const { t } = useTranslation()
  const [editSel, setEditSel] = useState<number | null>(null)
  const [selectedGen, setSelectedGen] = useState<string | null>(null)

  const n = actionSetSize ?? 1
  const ringR = Math.max(220, n * 22)
  const cx = vw / 2
  const cy = vh / 2 + 120
  const pos = (i: number) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR }
  }

  const genColor = (symbol: string) => {
    const gen = group.generators.find(g => g.symbol === symbol)
    return gen?.color || 'var(--node-stroke)'
  }

  const genChips = group.generators.map((gen, i) => {
    const chipX = 60 + i * (CHIP_W + CHIP_GAP)
    return (
      <g key={`genchip-${i}`} transform={`translate(${chipX}, ${CHIP_TOP})`}>
        <ElementChip
          label={renderTex(texify(gen.symbol))}
          color={gen.color}
          symbol={gen.symbol}
          isSelected={selectedGen === gen.symbol}
          onClick={() => setSelectedGen(prev => (prev === gen.symbol ? null : gen.symbol))}
        />
      </g>
    )
  })

  const arrows = actionArrows.map((a, i) => {
    const from = pos(a.from)
    const to = pos(a.to)
    const color = a.generatorId === null ? 'var(--text-secondary)' : genColor(a.generatorId)
    return (
      <DirectedEdge
        key={`${a.from}-${i}`}
        sx={from.x}
        sy={from.y}
        ex={to.x}
        ey={to.y}
        color={color}
        dashed={a.generatorId === null}
        onClick={() => {
          if (a.generatorId === null) {
            if (selectedGen) bindArrow(a.from, selectedGen)
            else removeArrow(a.from)
          } else {
            removeArrow(a.from)
          }
        }}
      />
    )
  })

  return (
    <>
      {genChips}
      <text x={60} y={CHIP_TOP + CHIP_H + 22} fill="var(--text-secondary)" fontSize={14}>
        {t('action.editHint')}
      </text>
      <text x={60} y={CHIP_TOP + CHIP_H + 44} fill="var(--text-secondary)" fontSize={13}>
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
      {editSel !== null && (
        <text x={cx} y={cy + ringR + 60} textAnchor="middle" fill={HOVER_COLOR} fontSize={16}>
          {t('action.editingSource', { x: String(editSel + 1) })}
        </text>
      )}
      {actionError && (
        <text x={cx} y={cy + ringR + 92} textAnchor="middle" fill="#f43f5e" fontSize={14}>
          {t(`action.error.${actionError.type}`, {
            gen: actionError.generatorId ?? '',
            from: String(actionError.from + 1),
            to: String(actionError.to + 1),
          })}
        </text>
      )}
    </>
  )
}

function DisplayMode({ group, computation }: { group: Group; computation: GroupActionComputation }) {
  const { actionKind, actionSelectedElement, setActionSelectedElement, actionHoverElement, setActionHoverElement, viewBoxSize, selectElement } = useGroup()

  const { n, perms, orbits, orbitOf } = computation
  const fixed = useMemo(() => new Set(computeFixedPoints(perms, n)), [perms, n])
  const isConjugation = actionKind === 'conjugation'

  const widths = orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const totalW = widths.reduce((a, b) => a + b, 0) + CLUSTER_GAP * (orbits.length - 1)
  const heights = orbits.map(o => 2 * (clusterRadius(o.elements.length) + NODE_R + CLUSTER_PAD))
  const maxH = Math.max(0, ...heights)

  const perRow = Math.max(1, Math.floor((viewBoxSize.width - 60) / (CHIP_W + CHIP_GAP)))
  const rows = Math.ceil(group.order / perRow)
  const topRegion = CHIP_TOP + rows * CHIP_ROW_H + 30

  const centers: { x: number; y: number; r: number }[] = []
  let cursorX = Math.max(200, (viewBoxSize.width - totalW) / 2)
  for (let i = 0; i < orbits.length; i++) {
    const r = clusterRadius(orbits[i].elements.length)
    centers.push({ x: cursorX + widths[i] / 2, y: topRegion + 60 + maxH / 2, r })
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

  const genEdges: React.ReactNode[] = []
  for (let gi = 0; gi < group.generators.length; gi++) {
    const gen = group.generators[gi]
    const genEl = gen.apply(group.identity)
    const p = perms.get(genEl.id)
    if (!p) continue
    for (let x = 0; x < n; x++) {
      const y = p[x]
      if (y === x) continue
      const from = nodePos(x)
      const to = nodePos(y)
      genEdges.push(
        <DirectedEdge
          key={`genedge-${gi}-${x}`}
          sx={from.x}
          sy={from.y}
          ex={to.x}
          ey={to.y}
          color={gen.color || 'var(--node-stroke)'}
          dir={x < y ? 1 : -1}
        />
      )
    }
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
          width={2.2}
          dir={x < y ? 1 : -1}
        />
      )
    }
  }

  const selectedOrbit = actionSelectedElement !== null ? orbitOf[actionSelectedElement] : -1

  const chips: React.ReactNode[] = []
  group.elements.forEach((el, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    chips.push(
      <g key={el.id} transform={`translate(${60 + col * (CHIP_W + CHIP_GAP)}, ${CHIP_TOP + row * CHIP_ROW_H})`}>
        <ElementChip
          label={renderTex(texify(el.label))}
          isSelected={actionHoverElement === el.id}
          onClick={() => selectElement(el.id, false)}
          onHover={(on) => setActionHoverElement(on ? el.id : null)}
        />
      </g>
    )
  })

  return (
    <>
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
  const { currentGroup, actionComputation, actionEditing, canvasTransform, viewBoxSize } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ userSelect: 'none' }}>
      <defs>
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {actionEditing ? (
          <CustomActionEditor group={currentGroup} vw={viewBoxSize.width} vh={viewBoxSize.height} />
        ) : actionComputation ? (
          <DisplayMode group={currentGroup} computation={actionComputation} />
        ) : (
          <text x={viewBoxSize.width / 2} y={viewBoxSize.height / 2} textAnchor="middle" fill="var(--text-secondary)" fontSize={22}>
            {t('action.noAction')}
          </text>
        )}
      </g>
    </svg>
  )
}

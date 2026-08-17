import { Fragment, useMemo, useState, useRef, useCallback } from 'react'
import { useGroup } from '../../context/useGroup'
import { texify, renderTex } from '../../utils/texify'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { computeCayleyActionEdges, cayleyCircleLayout } from '../../core/algebra/forceLayout'
import type { CayleyEdgeData, CayleyAction, Group, GroupElement } from '../../core/types'
import type { Automorphism } from '../../core/algebra/automorphisms'

const POPUP_SIZE = 360
const NODE_R = 16
const FONT_SIZE = 12

interface NodePos { x: number; y: number }

function buildFixedPositions(parentGroup: Group): Map<string, NodePos> {
  const cx = POPUP_SIZE / 2
  const cy = POPUP_SIZE / 2
  const graphRadius = POPUP_SIZE * 0.32
  return cayleyCircleLayout(parentGroup, cx, cy, graphRadius)
}

interface StableFrame {
  group: Group
  positions: Map<string, NodePos>
  elById: Map<string, GroupElement>
  showLabels: boolean
}

export function AutomorphismPreviewPopup() {
  const { currentGroup, selectedElements, clearSelection } = useGroup()
  const [position, setPosition] = useState({ x: -1, y: -1 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const [dismissed, setDismissed] = useState(false)
  const prevSelectedId = useRef<string | null>(null)

  const parentSymbol = useMemo(() => {
    if (!currentGroup) return null
    const g = currentGroup as Group & { automorphismParentSymbol?: string }
    return g.automorphismParentSymbol ?? null
  }, [currentGroup])

  const autoById = useMemo(() => {
    if (!currentGroup) return null
    const g = currentGroup as Group & { _automorphismById?: Map<string, Automorphism> }
    return g._automorphismById ?? null
  }, [currentGroup])

  const parentGroup = useMemo(() => {
    if (!parentSymbol) return null
    try { return createGroupFromSymbol(parentSymbol) } catch { return null }
  }, [parentSymbol])

  const selectedId = selectedElements.size === 1 ? [...selectedElements][0] : null

  if (selectedId !== prevSelectedId.current) {
    prevSelectedId.current = selectedId
    if (dismissed && selectedId) setDismissed(false)
  }

  const automorphism = useMemo(
    () => (selectedId && autoById ? autoById.get(selectedId) ?? null : null),
    [selectedId, autoById]
  )

  const stableFrame = useMemo((): StableFrame | null => {
    if (!parentGroup) return null
    const positions = buildFixedPositions(parentGroup)
    const elById = new Map(parentGroup.elements.map(e => [e.id, e]))
    const showLabels = parentGroup.order <= 36
    return { group: parentGroup, positions, elById, showLabels }
  }, [parentGroup])

  const elLabelHtml = useMemo(() => {
    if (!stableFrame) return new Map<string, string>()
    const m = new Map<string, string>()
    for (const el of stableFrame.group.elements) m.set(el.id, renderTex(texify(el.label)))
    return m
  }, [stableFrame])

  const autoTitleHtml = useMemo(
    () => (automorphism ? renderTex(texify(automorphism.label)) : ''),
    [automorphism]
  )

  const genLabelHtml = useMemo(() => {
    if (!stableFrame || !automorphism) return new Map<string, string>()
    const m = new Map<string, string>()
    const { group, elById } = stableFrame
    for (const g of group.generators) {
      const genEl = g.apply(group.identity)
      const mappedId = automorphism.map.get(genEl.id)
      const imgEl = mappedId ? elById.get(mappedId) : undefined
      m.set(genEl.id, renderTex(texify(imgEl?.label || genEl.label)))
    }
    return m
  }, [stableFrame, automorphism])

  const rewiredActions = useMemo((): CayleyAction[] => {
    if (!stableFrame || !automorphism) return []
    const { group, elById } = stableFrame
    const automap = automorphism.map
    const actions: CayleyAction[] = []
    for (const gen of group.generators) {
      const genEl = gen.apply(group.identity)
      const mappedId = automap.get(genEl.id)
      const imgId = mappedId ?? genEl.id
      const imgEl = elById.get(imgId)
      if (imgEl) {
        actions.push({ elementId: imgEl.id, enabled: true, color: gen.color })
      }
    }
    return actions
  }, [stableFrame, automorphism])

  const rewiredEdges = useMemo(() => {
    if (!stableFrame || rewiredActions.length === 0) return []
    return computeCayleyActionEdges(stableFrame.group, rewiredActions, 'right')
  }, [stableFrame, rewiredActions])

  const INIT_X = Math.max(0, window.innerWidth - POPUP_SIZE - 340)
  const INIT_Y = Math.max(0, window.innerHeight - POPUP_SIZE - 80)

  const actualX = position.x >= 0 ? position.x : INIT_X
  const actualY = position.y >= 0 ? position.y : INIT_Y

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,circle,foreignObject')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: actualX, py: actualY }
  }, [actualX, actualY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: Math.max(0, dragStart.current.px + (e.clientX - dragStart.current.x)),
      y: Math.max(0, dragStart.current.py + (e.clientY - dragStart.current.y)),
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => { setIsDragging(false) }, [])

  const handleClose = useCallback(() => {
    setDismissed(true)
    clearSelection()
  }, [clearSelection])

  if (!stableFrame || !automorphism || !parentSymbol) return null
  if (dismissed) return null

  const { group, positions, elById, showLabels } = stableFrame
  const automap = automorphism.map
  const n = group.order

  const isFixedPoint = (elId: string) => automap.get(elId) === elId
  const fixedColor = 'var(--accent-teal)'
  const fixedCount = [...automap.entries()].filter(([k, v]) => k === v).length

  return (
    <div className="autopreview-popup" style={{
      position: 'fixed', left: actualX, top: actualY, width: POPUP_SIZE, zIndex: 2000,
      display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden',
      border: '1px solid var(--border-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      background: 'var(--bg-primary)', cursor: isDragging ? 'grabbing' : 'default',
    }}
    onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="autopreview-titlebar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px', background: 'var(--bg-interactive)',
        borderBottom: '1px solid var(--border-primary)',
        cursor: 'grab', fontSize: '12px', color: 'var(--text-secondary)',
        userSelect: 'none', flexShrink: 0,
      }} onMouseDown={handleDragStart}>
        <span style={{ fontWeight: 500 }}
          dangerouslySetInnerHTML={{ __html: autoTitleHtml }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Aut({parentSymbol})</span>
        <button onClick={handleClose} className="autopreview-close-btn"
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>
          ×
        </button>
      </div>

      <div style={{
        display: 'flex', gap: '6px', padding: '3px 8px', fontSize: '10px',
        color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
      }}>
        <span>gen: </span>
        {group.generators.map((g, i) => {
          const genEl = g.apply(group.identity)
          return (
            <span key={i} style={{ color: g.color, fontWeight: 600 }}
              dangerouslySetInnerHTML={{ __html: genLabelHtml.get(genEl.id) ?? '' }} />
          )
        })}
      </div>

      <svg viewBox={`0 0 ${POPUP_SIZE} ${POPUP_SIZE}`}
        style={{ width: POPUP_SIZE, height: POPUP_SIZE, userSelect: 'none', background: 'var(--bg-primary)', flexShrink: 0 }}>
        <defs>
          {rewiredActions.map((action, idx) => (
            <marker key={idx} id={`ap-arrow-${idx}`} markerWidth={8} markerHeight={8} refX={7} refY={3} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
            </marker>
          ))}
        </defs>

        {rewiredEdges.map((edge: CayleyEdgeData) => {
          const fromPos = positions.get(edge.fromId)
          const toPos = positions.get(edge.toId)
          if (!fromPos || !toPos) return null
          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 0.5) return null

          if (edge.isSelfLoop) {
            const scx = fromPos.x
            const scy = fromPos.y - NODE_R - 12
            return (
              <g key={`${edge.fromId}-${edge.actionElementId}`}>
                <ellipse cx={scx} cy={scy} rx={10} ry={8} fill="none" stroke={`${edge.color}88`} strokeWidth={1.5} />
                <polygon points={`${scx - 4},${scy - 1} ${scx + 4},${scy - 1} ${scx},${scy - 10}`} fill={edge.color} />
              </g>
            )
          }
          const startX = fromPos.x + (dx / dist) * NODE_R
          const startY = fromPos.y + (dy / dist) * NODE_R
          const endX = toPos.x - (dx / dist) * NODE_R
          const endY = toPos.y - (dy / dist) * NODE_R
          const actionIdx = rewiredActions.findIndex(a => a.elementId === edge.actionElementId)
          const markerId = actionIdx >= 0 ? `ap-arrow-${actionIdx}` : undefined
          return (
            <line key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
              x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={`${edge.color}66`} strokeWidth={1.5}
              markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
              opacity={0.8} />
          )
        })}

        {group.elements.map((el) => {
          const pos = positions.get(el.id)
          if (!pos) return null
          const fixed = isFixedPoint(el.id)
          const fill = fixed ? `${fixedColor}22` : 'var(--node-fill)'
          const stroke = fixed ? fixedColor : 'var(--node-stroke)'
          return (
            <g key={el.id} transform={`translate(${pos.x}, ${pos.y})`}
              onClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }}>
              <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={fixed ? 2 : 1.5} />
              {showLabels && (
                <foreignObject x={-NODE_R} y={-14} width={NODE_R * 2} height={28}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%',
                    color: fixed ? 'var(--accent-teal)' : 'var(--node-text)',
                    fontSize: `${FONT_SIZE}px`, fontWeight: fixed ? 600 : 400,
                  }} dangerouslySetInnerHTML={{ __html: elLabelHtml.get(el.id) ?? '' }} />
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>

      {showLabels && automap.size > 0 && (
        <div className="autopreview-mapping" style={{
          padding: '6px 8px', borderTop: '1px solid var(--border-subtle)',
          fontSize: '10px', maxHeight: '120px', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: '2px 6px', alignItems: 'center' }}>
            {[...automap.entries()]
              .filter(([k, v]) => n <= 20 || k !== v)
              .slice(0, 40)
              .map(([srcId, tgtId]) => {
                const srcEl = elById.get(srcId)
                const tgtEl = elById.get(tgtId)
                return (
                  <Fragment key={srcId}>
                    <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: srcEl ? (elLabelHtml.get(srcEl.id) ?? '') : srcId }} />
                    <span style={{ color: 'var(--text-muted)' }}>↦</span>
                    <span style={{ textAlign: 'left', color: srcId === tgtId ? 'var(--accent-teal)' : 'var(--text-special)' }}
                      dangerouslySetInnerHTML={{ __html: tgtEl ? (elLabelHtml.get(tgtEl.id) ?? '') : tgtId }} />
                  </Fragment>
                )
              })}
          </div>
        </div>
      )}

      <div style={{
        padding: '2px 8px 4px', fontSize: '9px', color: 'var(--text-muted)',
        textAlign: 'center', borderTop: '1px solid var(--border-subtle)',
      }}>
        <span style={{ color: fixedColor }}>●</span>{' '}
        {fixedCount} fixed{' · '}
        {group.order - fixedCount} moved
      </div>
    </div>
  )
}

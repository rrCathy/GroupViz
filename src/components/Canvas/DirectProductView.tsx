import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { createDirectProduct } from '../../core/groups/DirectProduct'
import { computeCayleyActionEdges, ringOrder } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import { captureSvgFrame, encodeGif, triggerDownload } from '../../utils/export'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../../core/groups/SpecialGroup'
import type { Group } from '../../core/types'
import { COLOR_PALETTE } from '../../core/types'
import { useAutoFade } from '../../hooks/useAutoFade'

const NODE_R = 22
const VIEW_W = 1000
const VIEW_H = 660
const DRAG_HANDLE_R = 18

// ══-Cayley helpers ══-
function cayLayout(g: Group, cx: number, cy: number, r: number) {
  const m = new Map<string, { x: number; y: number }>()
  const keys = g.elements.map(e => e.id)
  const order = ringOrder(keys)
  const idxMap = new Map(order.map((k, i) => [k, i]))

  g.elements.forEach((el) => {
    const idx = idxMap.get(el.id)  ??  0
    const a = (idx * 2 * Math.PI / g.order) - Math.PI / 2
    m.set(el.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  })
  return m
}

function cayEdges(g: Group, pos: Map<string, { x: number; y: number }>, nr: number) {
  const acts = g.generators.map((gen, i) => ({
    elementId: gen.apply(g.identity).id, enabled: true,
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }))
  const es = computeCayleyActionEdges(g, acts, 'right')
  return es.filter(e => !e.isSelfLoop).map(e => {
    const fp = pos.get(e.fromId); const tp = pos.get(e.toId)
    if (!fp || !tp) return null
    const dx = tp.x - fp.x; const dy = tp.y - fp.y; const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 1) return null
    return {
      id: `${e.fromId}-${e.toId}-${e.actionElementId}`,
      path: `M ${fp.x + (dx / d) * nr} ${fp.y + (dy / d) * nr} Q ${(fp.x + tp.x) / 2} ${(fp.y + tp.y) / 2 - Math.min(18, d * 0.25)} ${tp.x - (dx / d) * nr} ${tp.y - (dy / d) * nr}`,
      color: e.color,
    }
  }).filter(Boolean) as Array<{ id: string; path: string; color: string }>
}

// Build nested Cayley positions: each G node contains a mini H Cayley graph
// Returns a map from product element ID to {x, y}
function buildNestedPositions(g: Group, h: Group, gCx: number, gCy: number, gR: number, nestedScale: number, gFirst: boolean) {
  const gPos = cayLayout(g, gCx, gCy, gR)
  const hR = Math.min(NODE_R * 0.8, gR * 0.5) * nestedScale
  const result = new Map<string, { x: number; y: number }>()
  for (const gEl of g.elements) {
    const gp = gPos.get(gEl.id)!
    const hPos = cayLayout(h, 0, 0, hR)
    for (const hEl of h.elements) {
      const hp = hPos.get(hEl.id)!
      const pid = gFirst ? `${gEl.id}|${hEl.id}` : `${hEl.id}|${gEl.id}`
      result.set(pid, { x: gp.x + hp.x, y: gp.y + hp.y })
    }
  }
  return result
}

// Build ALL product Cayley edges (H-gen within cluster + G-gen between clusters)
function buildAllProductEdges(
  _product: Group, g: Group, h: Group, posMap: Map<string, { x: number; y: number }>, gFirst: boolean,
): Array<{ id: string; path: string; color: string; kind: 'h-edge' | 'g-edge' }> {
  const nr = Math.max(2, NODE_R * 0.3)
  const allEdges: Array<{ id: string; path: string; color: string; kind: 'h-edge' | 'g-edge' }> = []

  const makeId = (ga: string, hb: string) => gFirst ? `${ga}|${hb}` : `${hb}|${ga}`

  // H-edges (within each G node): connect (g, h1) -(g, h2) via H generators
  const hActs = h.generators.map((gen) => ({
    elementId: gen.apply(h.identity).id, enabled: true,
    color: gen.color,
  }))
  const hCayley = computeCayleyActionEdges(h, hActs, 'right').filter(e => !e.isSelfLoop)
  for (const gEl of g.elements) {
    for (const he of hCayley) {
      const fromId = makeId(gEl.id, he.fromId); const toId = makeId(gEl.id, he.toId)
      const fp = posMap.get(fromId); const tp = posMap.get(toId)
      if (!fp || !tp) continue
      const dx = tp.x - fp.x; const dy = tp.y - fp.y; const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 1) continue
      allEdges.push({
        id: `h-${fromId}-${toId}`,
        path: `M ${fp.x + (dx / d) * nr} ${fp.y + (dy / d) * nr} Q ${(fp.x + tp.x) / 2} ${(fp.y + tp.y) / 2 - Math.min(8, d * 0.15)} ${tp.x - (dx / d) * nr} ${tp.y - (dy / d) * nr}`,
        color: he.color,
        kind: 'h-edge',
      })
    }
  }

  // G-edges (between G nodes): connect (g1, h) -(g2, h) via G generators
  const gActs = g.generators.map((gen) => ({
    elementId: gen.apply(g.identity).id, enabled: true,
    color: gen.color,
  }))
  const gCayley = computeCayleyActionEdges(g, gActs, 'right').filter(e => !e.isSelfLoop)
  for (const ge of gCayley) {
    for (const hEl of h.elements) {
      const fromId = makeId(ge.fromId, hEl.id); const toId = makeId(ge.toId, hEl.id)
      const fp = posMap.get(fromId); const tp = posMap.get(toId)
      if (!fp || !tp) continue
      const dx = tp.x - fp.x; const dy = tp.y - fp.y; const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 1) continue
      allEdges.push({
        id: `g-${fromId}-${toId}`,
        path: `M ${fp.x + (dx / d) * nr} ${fp.y + (dy / d) * nr} Q ${(fp.x + tp.x) / 2} ${(fp.y + tp.y) / 2 - Math.min(16, d * 0.2)} ${tp.x - (dx / d) * nr} ${tp.y - (dy / d) * nr}`,
        color: ge.color,
        kind: 'g-edge',
      })
    }
  }

  return allEdges
}

// ══-Interactive Cayley Graph ══-
interface GraphDragState {
  active: boolean; side: 'left' | 'right'
  offsetX: number; offsetY: number
  currentX: number; currentY: number
}

function InteractiveCayleyGraph({
  group, label, side, dragState, onDragStart, onDropOnNode, dropTargetNode, frozen,
}: {
  group: Group; label: string; side: 'left' | 'right'
  dragState: GraphDragState | null; dropTargetNode: string | null
  onDragStart: (side: 'left' | 'right', e: React.MouseEvent) => void
  onDropOnNode: (draggedSide: 'left' | 'right', nodeId: string) => void
  frozen?: boolean
}) {
  const baseCx = VIEW_W / 4 + (side === 'right' ? VIEW_W / 2 : 0)
  const baseCy = VIEW_H / 2
  const r = Math.min(155, 55 + group.order * 11)

  const isDragged = dragState?.active && dragState.side === side
  const cx = isDragged ? dragState.currentX : baseCx
  const cy = isDragged ? dragState.currentY : baseCy
  const ptrEv = isDragged ? 'none' : 'auto'

  const positions = useMemo(() => cayLayout(group, cx, cy, r), [group, cx, cy, r])
  const edges = useMemo(() => cayEdges(group, positions, NODE_R), [group, positions])

  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const isTarget = !isDragged && dragState?.active

  return (
    // Increase visibility of the frozen (non-dragged) group during overlap
    // Previously 0.12 made the target group too dim to read; 0.35 is clearer
    <g opacity={frozen ? 0.35 : 1} style={{ transition: 'opacity 0.4s', pointerEvents: ptrEv as React.CSSProperties['pointerEvents'] }}>
      <text x={cx} y={cy - r - NODE_R - 18} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="bold" pointerEvents="none">{label}</text>
      <text x={cx} y={cy - r - NODE_R} textAnchor="middle" fill="var(--text-muted)" fontSize="11" pointerEvents="none">|G| = {group.order}</text>

      <rect x={cx - r - NODE_R - 8} y={cy - r - NODE_R - 8} width={2 * (r + NODE_R + 8)} height={2 * (r + NODE_R + 8)}
        fill="none" stroke="var(--border-color)" strokeWidth={1} rx={8} strokeDasharray="6 3" opacity={0.3} pointerEvents="none" />

      {edges.map(e => (
        <path key={e.id} d={e.path} stroke={e.color + '88'} strokeWidth={1.4} fill="none" opacity={0.5} pointerEvents="none" />
      ))}

      {group.elements.map(el => {
        const pos = positions.get(el.id)!
        const isDt = dropTargetNode === el.id && isTarget
        const fc = isDt ? '#ffd93d' : (isTarget && hoverNode === el.id ? 'var(--accent-teal)' : 'var(--node-fill)')
        const sc = isDt ? '#ffd93d' : 'var(--node-stroke)'
        return (
          <g key={el.id} transform={`translate(${pos.x},${pos.y})`}
            onMouseEnter={() => setHoverNode(el.id)} onMouseLeave={() => setHoverNode(null)}
            onMouseUp={() => { if (isTarget && hoverNode === el.id) onDropOnNode(dragState!.side, el.id) }}
            style={{ cursor: isTarget ? 'pointer' : 'default' }}>
            {isDt && <circle r={NODE_R + 10} fill="none" stroke="#ffd93d" strokeWidth={3} opacity={0.7} pointerEvents="none">
              <animate attributeName="r" from={NODE_R + 4} to={NODE_R + 14} dur="0.6s" repeatCount="indefinite" />
            </circle>}
            <circle r={NODE_R} fill={fc} stroke={sc} strokeWidth={2} />
            <foreignObject x={-NODE_R} y={-11} width={NODE_R * 2} height={22} style={{ pointerEvents: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '11px' }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
            </foreignObject>
          </g>
        )
      })}

      {!frozen && (
        <g onMouseDown={(e) => { e.stopPropagation(); onDragStart(side, e) }} style={{ cursor: 'grab' }}>
          <circle cx={cx} cy={cy} r={DRAG_HANDLE_R} fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth={1} opacity={0.7} />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text-muted)" fontSize="11" pointerEvents="none">+</text>
          <circle cx={cx} cy={cy} r={DRAG_HANDLE_R + 12} fill="transparent" />
        </g>
      )}

      {isTarget && (
        <rect x={cx - r - NODE_R - 8} y={cy - r - NODE_R - 8} width={2 * (r + NODE_R + 8)} height={2 * (r + NODE_R + 8)}
          fill="none" stroke="var(--accent-teal)" strokeWidth={2} rx={8} opacity={0.6} pointerEvents="none" />
      )}
    </g>
  )
}

// ══-Direct Create Panel ══-
function DirectCreatePanel() {
  const { t } = useTranslation()
  const { setDirectProductSource, setDirectProductTarget, setCurrentGroup, setCurrentView,
    setHintMessage, storeDirectProductGroup, directProductGroups } = useGroup()
  const [gtA, stA] = useState('cyclic'); const [gtB, stB] = useState('cyclic')
  const [pA, spA] = useState(3); const [pB, spB] = useState(2)
  const types = [
    { key: 'cyclic', label: 'C_n', c: (n: number) => createCyclicGroup(n), min: 1, max: 12, np: true },
    { key: 'symmetric', label: 'S_n', c: (n: number) => createSymmetricGroup(n), min: 2, max: 4, np: true },
    { key: 'dihedral', label: 'D_n', c: (n: number) => createDihedralGroup(n), min: 3, max: 6, np: true },
    { key: 'alternating', label: 'A_n', c: (n: number) => createAlternatingGroup(n), min: 3, max: 4, np: true },
    { key: 'V4', label: 'V_4', c: () => createKleinFour(), min: 4, max: 4, np: false },
    { key: 'Q8', label: 'Q_8', c: () => createQuaternion(), min: 8, max: 8, np: false },
  ]
  const sto = directProductGroups.map(g => ({ key: `stored:${g.symbol}`, label: g.symbol, g }))
  function mk(k: string, p: number): Group | null {
    if (k.startsWith('stored:')) return sto.find(o => o.key === k)?.g  ??  null
    const c = types.find(t => t.key === k); if (!c) return null
    return c.np ? (c.c as (n: number) => Group)(p) : (c.c as () => Group)()
  }
  function np(k: string) { if (k.startsWith('stored:')) return false; return types.find(t => t.key === k)?.np  ??  false }
  const doit = (go: boolean) => {
    const a = mk(gtA, pA); const b = mk(gtB, pB); if (!a || !b) return
    if (a.order * b.order > 144) { setHintMessage(t('dp.orderTooLarge', { n: a.order * b.order })); return }
    if (go) { const pr = createDirectProduct(a, b); storeDirectProductGroup(pr); setCurrentGroup(pr); setCurrentView('cayley')
      setHintMessage(t('dp.created', { symbol: pr.symbol, order: pr.order }).replace(pr.symbol, `<span class="hint-highlight">${pr.symbol}</span>`)) }
    else { setDirectProductSource(a); setDirectProductTarget(b) }
  }
  const sel = (v: string, sv: (s: string) => void, p: number, sp: (n: number) => void) => {
    const c = types.find(t => t.key === v)
    return (<>
      <select value={v} onChange={e => { sv(e.target.value); const ct = types.find(t => t.key === e.target.value); if (ct?.np) sp(ct.min) }} className="dp-direct-select">
        {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        {sto.length > 0 && <optgroup label="—— 已储存直积群 ——">{sto.map(o => <option key={o.key} value={o.key}>{o.label} (|G|={o.g.order})</option>)}</optgroup>}
      </select>
      {np(v) && c && <div className="dp-param-row"><span>{t('dp.paramN')}: {p}</span><input type="range" min={c.min} max={c.max} value={p} onChange={e => sp(parseInt(e.target.value))} /></div>}
    </>)
  }
  const cA = types.find(t => t.key === gtA); const cB = types.find(t => t.key === gtB)
  return (
    <div className="dp-direct-panel">
      <div className="dp-direct-hint">{t('dp.directHint')}</div>
      <div className="dp-direct-row">
        <div className="dp-direct-col"><label className="dp-direct-label">{t('dp.sourceGroup')}</label>{sel(gtA, stA, pA, spA)}</div>
        <div className="dp-direct-col"><label className="dp-direct-label">{t('dp.targetGroup')}</label>{sel(gtB, stB, pB, spB)}</div>
      </div>
      <div className="dp-direct-buttons">
        <button className="panel-btn" onClick={() => doit(false)} style={{ flex: 1 }}>{t('dp.importGroup')}</button>
        <button className="panel-btn dp-create-btn" onClick={() => doit(true)} style={{ flex: 1 }}>{t('dp.create', { a: cA?.label  ??  '?', b: cB?.label  ??  '?' })}</button>
      </div>
    </div>
  )
}

// ══-Main view ══-
export function DirectProductView() {
  const { t } = useTranslation()
  const {
    directProductSource, directProductTarget, directProductCreationMode,
    setDirectProductCreationMode, executeDirectProduct, setCurrentGroup,
    setCurrentView, storeDirectProductGroup, setHintMessage, toggleDirectProductMode,
    hintMessage,
  } = useGroup()

  const hintFade = useAutoFade(hintMessage)

  // ---- Cayley drag ----
  const [drag, setDrag] = useState<GraphDragState | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const handleDragStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const sx = VIEW_W / rect.width; const sy = VIEW_H / rect.height
    setDrag({ active: true, side, offsetX: (e.clientX - rect.left) * sx, offsetY: (e.clientY - rect.top) * sy, currentX: (e.clientX - rect.left) * sx, currentY: (e.clientY - rect.top) * sy })
  }, [])

  useEffect(() => {
    if (!drag?.active) return
    const mv = (e: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const sx = VIEW_W / rect.width; const sy = VIEW_H / rect.height
      setDrag(p => p ? { ...p, currentX: (e.clientX - rect.left) * sx, currentY: (e.clientY - rect.top) * sy } : p)
    }
    const up = () => setDrag(null)
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [drag?.active])

  const [pPhase, setPPhase] = useState<'idle' | 'anim' | 'done'>('idle')
  const [pProgress, setPProgress] = useState(0)
  const [productG, setProductG] = useState<Group | null>(null)
  const [dragSide, setDragSide] = useState<'left' | 'right'>('left') // which side was dragged for nested animation
  const [isExportingGif, setIsExportingGif] = useState(false)
  const exportingRef = useRef(false)
  const raf = useRef(0); const t0 = useRef(0)

  // Pre-compute nested positions and edges + target circle layout for morphing
  const nestedData = useMemo(() => {
    if (!productG || !directProductSource || !directProductTarget) return null
    // The dragged group is the inner (nested) factor; the other is the outer ring
    const inner = dragSide === 'left' ? directProductSource : directProductTarget
    const outer = dragSide === 'left' ? directProductTarget : directProductSource
    const outerR = Math.min(200, 60 + outer.order * 10)
    const nestedScale = 1.0
    const gFirst = dragSide !== 'left' // g is the outer ring; product IDs are source|target
    const nPos = buildNestedPositions(outer, inner, VIEW_W / 2, VIEW_H / 2, outerR, nestedScale, gFirst)
    const allEdges = buildAllProductEdges(productG, outer, inner, nPos, gFirst)
    const innerCayleyPos = cayLayout(inner, 0, 0, Math.min(NODE_R * 0.8, outerR * 0.5) * nestedScale)
    const innerCayleyEdges = cayEdges(inner, innerCayleyPos, 4)

    // Target: circular layout for product group (morph destination in phase 3)
    const targetR = Math.min(280, 100 + productG.order * 8)
    const targetPos = new Map<string, { x: number; y: number }>()
    // Use per-factor ringOrder for pipe-delimited products (S3 factor gets Hamiltonian)
    const isPipeProd = productG.elements.length > 0 && productG.elements[0]?.id.includes('|')
    let prodOrdered: Array<{ id: string }>
    if (isPipeProd) {
      const numFactors = productG.elements[0].id.split('|').length
      const factorOrders: Map<string, number>[] = []
      for (let col = 0; col < numFactors; col++) {
        const keys = Array.from(new Set(productG.elements.map(el => {
          const parts = el.id.split('|')
          return parts[col]  ??  ''
        })))
        const ordered = ringOrder(keys)
        factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
      }
      prodOrdered = [...productG.elements].sort((a, b) => {
        const pa = a.id.split('|')
        const pb = b.id.split('|')
        for (let col = 0; col < numFactors; col++) {
          const ai = factorOrders[col].get(pa[col]  ??  '')  ??  0
          const bi = factorOrders[col].get(pb[col]  ??  '')  ??  0
          if (ai !== bi) return ai - bi
        }
        return 0
      })
    } else {
      prodOrdered = productG.elements
    }
    prodOrdered.forEach((el, i) => {
      const angle = (i * 2 * Math.PI / productG.order) - Math.PI / 2
      targetPos.set(el.id, { x: VIEW_W / 2 + targetR * Math.cos(angle), y: VIEW_H / 2 + targetR * Math.sin(angle) })
    })

    return { G: outer, H: inner, gR: outerR, gCx: VIEW_W / 2, gCy: VIEW_H / 2, nPos, allEdges, hCayleyPos: innerCayleyPos, hCayleyEdges: innerCayleyEdges, targetPos, gFirst }
  }, [productG, directProductSource, directProductTarget, dragSide])

  const handleDropOnNode = useCallback(() => {
    if (!drag || pPhase !== 'idle') return
    if (!directProductSource || !directProductTarget) return
    setDragSide(drag.side)
    const prod = executeDirectProduct()
    if (!prod) return
    setProductG(prod); setDrag(null)
    setPPhase('anim'); setPProgress(0)
    const D = 7000; t0.current = performance.now()
    const fn = (now: number) => {
      const p = Math.min(1, (now - t0.current) / D)
      setPProgress(p)
      if (p < 1) raf.current = requestAnimationFrame(fn)
      else {
        setPPhase('done')
        storeDirectProductGroup(prod)
        setTimeout(() => {
          toggleDirectProductMode()
          setCurrentGroup(prod); setCurrentView('cayley')
          setHintMessage(t('dp.created', { symbol: prod.symbol, order: prod.order }).replace(prod.symbol, `<span class="hint-highlight">${prod.symbol}</span>`))
        }, 900)
      }
    }
    raf.current = requestAnimationFrame(fn)
  }, [drag, pPhase, directProductSource, directProductTarget, executeDirectProduct, setCurrentGroup, setCurrentView, storeDirectProductGroup, setHintMessage, t, toggleDirectProductMode])

  // ─── GIF export ───

  const handleExportCayleyGif = useCallback(async () => {
    if (!directProductSource || !directProductTarget || exportingRef.current) return
    const prod = executeDirectProduct()
    if (!prod) return
    if (prod.order * prod.order > 2800) {
      setHintMessage(t('dp.orderTooLarge', { n: prod.order * prod.order }))
      return
    }
    const srcSymbol = directProductSource.symbol
    const tgtSymbol = directProductTarget.symbol
    setHintMessage(t('dp.exportCayleyHint', { src: `<span class="hint-highlight">${srcSymbol}</span>`, tgt: `<span class="hint-highlight">${tgtSymbol}</span>` }))

    exportingRef.current = true
    setIsExportingGif(true)
    setDragSide('left')
    setProductG(prod)

    const svg = svgRef.current
    if (!svg) { setIsExportingGif(false); exportingRef.current = false; return }

    const fps = 15
    const totalAnimFrames = 105
    const idleFrames = 15
    const dragFrames = 22
    const endHoldFrames = 15
    const frames: Uint8Array[] = []
    const captureFrame = async () => {
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => setTimeout(r, 16))
      try { frames.push(await captureSvgFrame(svg, VIEW_W, VIEW_H)) } catch { /* skip */ }
    }

    // Phase 1 -idle: two factor group graphs static
    for (let i = 0; i < idleFrames; i++) await captureFrame()

    // Phase 2 -drag: left graph moves toward center (animation center)
    const leftBaseX = VIEW_W / 4 // 250
    const dragTargetX = VIEW_W / 2 // match animation center
    const leftCy = VIEW_H / 2
    for (let i = 0; i < dragFrames; i++) {
      const t = (i + 1) / dragFrames
      const cx = leftBaseX + (dragTargetX - leftBaseX) * Math.pow(t, 0.6)
      flushSync(() => setDrag({ active: true, side: 'left', offsetX: 0, offsetY: 0, currentX: cx, currentY: leftCy }))
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => setTimeout(r, 16))
      try { frames.push(await captureSvgFrame(svg, VIEW_W, VIEW_H)) } catch { /* skip */ }
    }

    // Phase 3 — animation: transition directly from drag end, no snap-back
    flushSync(() => {
      setPPhase('anim')
      setPProgress(0)
      setDrag(null)
    })
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => setTimeout(r, 16))

    for (let i = 0; i <= totalAnimFrames; i++) {
      flushSync(() => setPProgress(i / totalAnimFrames))
      await captureFrame()
    }

    // Phase 4 -hold final product graph
    for (let i = 0; i < endHoldFrames; i++) await captureFrame()

    if (frames.length > 0) {
      const blob = encodeGif(frames, VIEW_W, VIEW_H, fps)
      triggerDownload(blob, `groupviz_dp_cayley_${Date.now()}.gif`)
    }

    setPPhase('idle')
    setPProgress(0)
    setProductG(null)
    setIsExportingGif(false)
    exportingRef.current = false
  }, [directProductSource, directProductTarget, executeDirectProduct, setHintMessage, t])

  // ---- Functions for Cayley animation rendering ----

  function renderAnimCayley() {
    if (!nestedData) return null
    const { G, H, gR, gCx, gCy, hCayleyPos, hCayleyEdges, targetPos, gFirst } = nestedData
    const p = pProgress

    // ════════════════════════════════════════════════════════════════════
    //  ALL TUNABLE PARAMETERS -edit these numbers directly to adjust animation
    // ════════════════════════════════════════════════════════════════════

    // ── Phase timing (all in progress 0..1) ──
    const T_EXPAND_END   = 0.25     // G expands till here
    const T_SWELL_START  = 0.22     // G starts swelling
    const T_SWELL_DUR    = 0.24     // swell duration
    const T_NEST_START   = 0.18     // H mini-graphs fade in
    const T_NEST_DUR     = 0.30     // H fade duration
    const T_GFADE_END    = 0.60     // G fully gone
    const T_GFADE_DUR    = 0.22     // G fade duration (= fade starts at T_GFADE_END - T_GFADE_DUR)
    const T_GEDGE_START  = 0.50     // G-edges start appearing
    const T_GEDGE_DUR    = 0.20     // G-edges fade-in duration (ends at 0.70)
    const T_HEDGE_START  = 0.55     // H-edges start appearing
    const T_HEDGE_DUR    = 0.20     // H-edges fade-in duration (ends at 0.75)
    const T_MORPH_START  = 0.68     // morph starts (pause 0.70-.68 let edges be visible)
    const T_MORPH_DUR    = 0.32     // morph duration
    const T_LABEL_SHOW   = 0.40     // labels appear when morphT > this

    // ── Edge ease-in power (1=linear, 2=quadratic, 3=cubic) ──
    const EDGE_EASE_POW  = 2        // higher = slower start

    // ── G-ring radius (as fraction of gR) ──
    const G_RING_BASE    = 0.25     // before expand
    const G_RING_EXPAND  = 1.20     // added during expand
    const G_RING_SWELL   = -0.50    // added during swell (negative = contract)

    // ── G-node radius (as fraction of NODE_R) ──
    const G_NODE_BASE    = 0.40     // before expand
    const G_NODE_EXPAND  = 1.50     // added during expand
    const G_NODE_SWELL   = 1.10     // added during swell

    // ── G-edge offset (as fraction of NODE_R, larger = edges drawn shorter) ──
    const G_EDGE_BASE    = 0.30
    const G_EDGE_EXPAND  = 1.80
    const G_EDGE_SWELL   = 2.20

    // ── H nested scale ──
    const H_SCALE_BASE   = 0.60     // minimum scale
    const H_SCALE_GROW   = 0.50     // growth from expand+swell

    // ── H mini-node base radius ──
    const H_NODE_R       = 5.0      // base H node radius in nested view (scaled by nestedScale)
    const H_NODE_MIN     = 2.0      // minimum H node radius

    // ── Product node in final Cayley graph ──
    const CG_NODE_R      = 0.42     // as fraction of NODE_R
    const CG_NODE_MIN    = 2.0      // minimum pixel radius
    const CG_NODE_BASE   = 0.15     // base fraction before morph
    const CG_LABEL_FS    = 5.0      // base font size, grows with morphT

    // ── Product edge rendering ──
    const PE_GEDGE_W_BASE  = 1.40   // g-edge base strokeWidth
    const PE_GEDGE_W_MORPH = 0.40   // g-edge strokeWidth added per morphT
    const PE_HEDGE_W_BASE  = 0.80   // h-edge base strokeWidth
    const PE_HEDGE_W_MORPH = 0.40   // h-edge strokeWidth added per morphT
    const PE_GEDGE_OPACITY = 0.50   // g-edge path opacity
    const PE_HEDGE_OPACITY = 0.35   // h-edge path opacity
    const PE_HEDGE_MORPH_FACTOR = 0.80  // h-edge visibility multiplier by morphT

    // ════════════════════════════════════════════════════════════════════
    //  Computed values (do not edit below)
    // ════════════════════════════════════════════════════════════════════

    const expandP  = Math.min(1, p / T_EXPAND_END)
    const swellP   = Math.min(1, Math.max(0, (p - T_SWELL_START) / T_SWELL_DUR))
    const nestP    = Math.min(1, Math.max(0, (p - T_NEST_START) / T_NEST_DUR))
    const gFade    = Math.min(1, Math.max(0, (T_GFADE_END - p) / T_GFADE_DUR))
    const gEdgeRaw = Math.min(1, Math.max(0, (p - T_GEDGE_START) / T_GEDGE_DUR))
    const gEdgeFade = Math.pow(gEdgeRaw, EDGE_EASE_POW)
    const hEdgeRaw = Math.min(1, Math.max(0, (p - T_HEDGE_START) / T_HEDGE_DUR))
    const hEdgeFade = Math.pow(hEdgeRaw, EDGE_EASE_POW)
    const morphT   = Math.min(1, Math.max(0, (p - T_MORPH_START) / T_MORPH_DUR))

    const gCurR = gR * (G_RING_BASE + G_RING_EXPAND * expandP + G_RING_SWELL * swellP) * (1 + morphT * 0.25)
    const gPos = cayLayout(G, gCx, gCy, gCurR)
    const edgeOffset = NODE_R * (G_EDGE_BASE + G_EDGE_EXPAND * expandP + G_EDGE_SWELL * swellP)
    const gEdges = cayEdges(G, gPos, edgeOffset)
    const nestedScale = nestP * (H_SCALE_BASE + H_SCALE_GROW * (expandP + swellP))
    const gNodeR = NODE_R * (G_NODE_BASE + G_NODE_EXPAND * expandP + G_NODE_SWELL * swellP)

    // Current positions: lerp from nested cluster -target circular layout
    const curPos = new Map<string, { x: number; y: number }>()
    for (const gEl of G.elements) {
      const gp = gPos.get(gEl.id)!
      for (const hEl of H.elements) {
        const hpBase = hCayleyPos.get(hEl.id)!
        const pid = gFirst ? `${gEl.id}|${hEl.id}` : `${hEl.id}|${gEl.id}`
        const nested = {
          x: gp.x + hpBase.x * nestedScale,
          y: gp.y + hpBase.y * nestedScale,
        }
        const target = targetPos.get(pid)!
        curPos.set(pid, {
          x: nested.x + (target.x - nested.x) * morphT,
          y: nested.y + (target.y - nested.y) * morphT,
        })
      }
    }

    // Recompute all edges using current (possibly morphed) positions
    const currentEdges = buildAllProductEdges(productG!, G, H, curPos, gFirst)
    const cgNodeR = NODE_R * CG_NODE_R

    return (
      <>
        {/* ── G graph (grows in 2 stages, then fades) ── */}
        <g opacity={gFade}>
          {gEdges.map(e => <path key={`g-e-${e.id}`} d={e.path} stroke={e.color + '88'} strokeWidth={1.6} fill="none" opacity={0.4} pointerEvents="none" />)}
          {G.elements.map(gEl => {
            const gp = gPos.get(gEl.id)!
            return (
              <g key={`g-n-${gEl.id}`} transform={`translate(${gp.x},${gp.y})`} pointerEvents="none">
                <circle r={gNodeR} fill="var(--node-fill)" stroke="var(--node-stroke)" strokeWidth={1.5} />
                <foreignObject x={-gNodeR} y={-10} width={gNodeR * 2} height={20}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '10px' }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(gEl.label)) }} />
                </foreignObject>
              </g>
            )
          })}
        </g>

        {/* ── H mini-graphs inside G nodes (vanish instantly when morph starts) ── */}
        {nestP > 0 && morphT <= 0.01 && (
          <g opacity={nestP}>
            {G.elements.map(gEl => {
              const gp = gPos.get(gEl.id)!
              return (
                <g key={`nest-${gEl.id}`} transform={`translate(${gp.x},${gp.y})`} pointerEvents="none">
                  {hCayleyEdges.map(e => {
                    const parts = e.path.split(' ')
                    const scaled = parts.map(seg => {
                      const nums = seg.split(',').map(v => parseFloat(v) * nestedScale)
                      return nums.map(v => isNaN(v) ? seg : v.toFixed(2)).join(',')
                    }).join(' ')
                    return <path key={`ne-${gEl.id}-${e.id}`} d={scaled} stroke={e.color + '88'} strokeWidth={1} fill="none" opacity={0.4} pointerEvents="none" />
                  })}
                  {H.elements.map(hEl => {
                    const hp = hCayleyPos.get(hEl.id)!
                    const r = H_NODE_R * nestedScale
                    return (
                      <g key={`nh-${gEl.id}-${hEl.id}`} transform={`translate(${hp.x * nestedScale},${hp.y * nestedScale})`} pointerEvents="none">
                        <circle r={Math.max(H_NODE_MIN, r)} fill="var(--node-fill)" stroke="var(--node-stroke)" strokeWidth={0.8} />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </g>
        )}

        {/* ── Product edges: G-edges first (cross-cluster), H-edges after spreading ── */}
        {(gEdgeFade > 0 || hEdgeFade > 0) && (
          <g>
            {currentEdges.map((e, i) => {
              const isG = e.kind === 'g-edge'
              const o = isG ? gEdgeFade : hEdgeFade * morphT * PE_HEDGE_MORPH_FACTOR
              if (o <= 0) return null
              return (
                <path key={`pe-${i}`} d={e.path} stroke={e.color}
                  strokeWidth={isG ? PE_GEDGE_W_BASE + morphT * PE_GEDGE_W_MORPH : PE_HEDGE_W_BASE + morphT * PE_HEDGE_W_MORPH}
                  fill="none" opacity={isG ? PE_GEDGE_OPACITY : PE_HEDGE_OPACITY} pointerEvents="none" />
              )
            })}
          </g>
        )}

        {/* ── Product nodes with labels (morph to clean circle, grow size with morph) ── */}
        <g>
          {productG!.elements.map(el => {
            const pos = curPos.get(el.id)
            if (!pos) return null
            const r = Math.max(CG_NODE_MIN, NODE_R * CG_NODE_BASE + cgNodeR * morphT)
            const o = morphT <= 0 ? 0 : 1  // snap: invisible in pause, full at morph start
            return (
              <g key={`pn-${el.id}`} transform={`translate(${pos.x},${pos.y})`} opacity={o} pointerEvents="none">
                <circle r={r} fill="var(--node-fill)" stroke="var(--node-stroke)" strokeWidth={0.7 + morphT * 1.3} />
                {morphT > T_LABEL_SHOW && (
                  <foreignObject x={-r} y={-6.5} width={r * 2} height={13}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-primary)', fontSize: `${Math.max(5, CG_LABEL_FS + morphT * CG_LABEL_FS)}px` }}
                      dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                  </foreignObject>
                )}
              </g>
            )
          })}
        </g>
      </>
    )
  }

  // ══-Table mode ══-
  const [tPhase, setTPhase] = useState<'idle' | 'anim' | 'done'>('idle')
  const [tProgress, setTProgress] = useState(0)
  const [tProd, setTProd] = useState<Group | null>(null)
  const tRaf = useRef(0); const t0r = useRef(0)
  const [tDrag, setTDrag] = useState<{ side: 'left' | 'right'; x: number; y: number } | null>(null)
  const [tDropCell, setTDropCell] = useState<{ row: number; col: number; targetSide: 'left' | 'right'; dragSide: 'left' | 'right' } | null>(null)
  const hiddenDropEl = useRef<HTMLElement[] | null>(null)

  const tblStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    setTDrag({ side, x: e.clientX, y: e.clientY })
  }, [])
  useEffect(() => {
    if (!tDrag) return
    const mv = (e: MouseEvent) => setTDrag(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)
    const up = () => setTDrag(null)
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [tDrag])

  const runTableAnim = useCallback((prod: Group, dropCellParam: { row: number; col: number; targetSide: 'left' | 'right'; dragSide: 'left' | 'right' } | null = null) => {
    // ensure TableAnimView sees the drop cell synchronously
    setTDropCell(dropCellParam)
    // hide all original tables to avoid duplicate visuals while overlay animates
    {
      const els = document.querySelectorAll('.dp-table-group') as NodeListOf<HTMLElement>
      els.forEach(el => { el.style.display = 'none' })
      hiddenDropEl.current = Array.from(els)
    }
    setTProd(prod); setTDrag(null)
    setTPhase('anim'); setTProgress(0)
    const D = 3600; t0r.current = performance.now()
    const fn = (now: number) => {
      const p = Math.min(1, (now - t0r.current) / D)
      setTProgress(p)
      if (p < 1) tRaf.current = requestAnimationFrame(fn)
      else {
        // ensure final visuals finish (allow TableAnimView to complete exit animation)
        setTPhase('done')
        storeDirectProductGroup(prod)
        // cancel any remaining RAFs to avoid concurrent updates
        if (tRaf.current) cancelAnimationFrame(tRaf.current)
        // wait slightly longer to ensure product table fade/zoom completes
        setTimeout(() => {
          // restore visibility of both original tables
          if (hiddenDropEl.current) { hiddenDropEl.current.forEach(el => el.style.display = ''); hiddenDropEl.current = null }
          toggleDirectProductMode()
          setCurrentGroup(prod); setCurrentView('table')
          setHintMessage(t('dp.created', { symbol: prod.symbol, order: prod.order }).replace(prod.symbol, `<span class="hint-highlight">${prod.symbol}</span>`))
        }, 900)
      }
    }; tRaf.current = requestAnimationFrame(fn)
  }, [storeDirectProductGroup, setCurrentGroup, setCurrentView, setHintMessage, t, toggleDirectProductMode])

  // Drop one table onto another table (from top-left drag fallback or cell drop with no specific cell)
  const tblDropFull = useCallback((dragSide: 'left' | 'right', targetSide: 'left' | 'right') => {
    if (!tDrag || tPhase !== 'idle') return
    if (!directProductSource || !directProductTarget) return
    const prod = executeDirectProduct(); if (!prod) return
    runTableAnim(prod, { row: -1, col: -1, targetSide, dragSide })
  }, [tDrag, tPhase, directProductSource, directProductTarget, executeDirectProduct, runTableAnim])

  // Drop onto a specific cell
  const tblDropCell = useCallback((dragSide: 'left' | 'right', targetSide: 'left' | 'right', row: number, col: number) => {
    if (!tDrag || tPhase !== 'idle') return
    if (!directProductSource || !directProductTarget) return
    const prod = executeDirectProduct(); if (!prod) return
    runTableAnim(prod, { row, col, targetSide, dragSide })
  }, [tDrag, tPhase, directProductSource, directProductTarget, executeDirectProduct, runTableAnim])

  const btnCreate = useCallback(() => {
    if (!directProductSource || !directProductTarget || tPhase !== 'idle') return
    const prod = executeDirectProduct(); if (!prod) return
    runTableAnim(prod)
  }, [directProductSource, directProductTarget, tPhase, executeDirectProduct, runTableAnim])

  const handleExportTableGif = useCallback(async () => {
    if (!directProductSource || !directProductTarget || exportingRef.current) return
    const prod = executeDirectProduct()
    if (!prod) return
    if (prod.order * prod.order > 2800) {
      setHintMessage(t('dp.orderTooLarge', { n: prod.order * prod.order }))
      return
    }
    const srcSymbol = directProductSource.symbol
    const tgtSymbol = directProductTarget.symbol
    setHintMessage(t('dp.exportCayleyHint', { src: `<span class="hint-highlight">${srcSymbol}</span>`, tgt: `<span class="hint-highlight">${tgtSymbol}</span>` }))

    exportingRef.current = true
    setIsExportingGif(true)

    const VW = 600; const VH = 600
    const fps = 15
    const idleFrames = 22
    const totalAnimFrames = 72
    const endHoldFrames = 12
    const frames: Uint8Array[] = []
    const waitPaint = () => new Promise<void>(r => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 16)))
    })

    // Phase 1 -idle: composite both factor tables with correct aspect ratios
    {
      const workspace = document.querySelector('.dp-table-workspace')
      const groups = workspace?.querySelectorAll('.dp-table-group:not([style*="position: fixed"]) svg') as NodeListOf<SVGSVGElement> | undefined
      if (groups && groups.length >= 2) {
        try {
          // Each table SVG is square (viewBox 0 0 ((n+1)*34) ((n+1)*34)), render at 1:1
          const tableSz = 280 // target render size for each table
          const [leftPx, rightPx] = await Promise.all([
            captureSvgFrame(groups[0], tableSz, tableSz),
            captureSvgFrame(groups[1], tableSz, tableSz),
          ])
          const canvas = document.createElement('canvas')
          canvas.width = VW; canvas.height = VH
          const ctx = canvas.getContext('2d')!
          const bg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#1a1a2e'
          ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH)
          const offY = (VH - tableSz) / 2
          ctx.putImageData(new ImageData(new Uint8ClampedArray((leftPx.buffer as ArrayBuffer), leftPx.byteOffset, leftPx.byteLength), tableSz, tableSz), (VW / 2 - tableSz) / 2, offY)
          ctx.putImageData(new ImageData(new Uint8ClampedArray((rightPx.buffer as ArrayBuffer), rightPx.byteOffset, rightPx.byteLength), tableSz, tableSz), VW / 2 + (VW / 2 - tableSz) / 2, offY)
          const imgData = ctx.getImageData(0, 0, VW, VH)
          const idleData = new Uint8Array(imgData.data.buffer, imgData.data.byteOffset, imgData.data.byteLength)
          for (let i = 0; i < idleFrames; i++) frames.push(idleData)
        } catch { /* fallback: proceed without idle frames */ }
      }
    }

    // Phase 2 -animation: flushSync to ensure animation overlay renders before DOM queries
    flushSync(() => {
      setTProd(prod)
      setTDropCell(null)
      setTPhase('anim')
      setTProgress(0)
    })

    // Hide only the source/target table groups (not the animation overlay at :last-child)
    const workspace = document.querySelector('.dp-table-workspace')
    const allGroups = workspace?.querySelectorAll('.dp-table-group')
    const idleGroups: HTMLElement[] = []
    allGroups?.forEach(el => {
      if (el === allGroups[allGroups.length - 1]) return // skip the last one (will be animation overlay)
      const htmlEl = el as HTMLElement
      htmlEl.style.display = 'none'
      idleGroups.push(htmlEl)
    })
    hiddenDropEl.current = idleGroups
    await waitPaint()
    await waitPaint()

    // Target the animation overlay SVG specifically (the last .dp-table-group > svg)
    const getAnimSvg = (): SVGSVGElement | null => {
      const ws = document.querySelector('.dp-table-workspace')
      const grps = ws?.querySelectorAll('.dp-table-group')
      const last = grps?.[(grps?.length  ??  1) - 1]
      return (last?.querySelector('svg')  ??  null) as SVGSVGElement | null
    }

    for (let i = 0; i <= totalAnimFrames; i++) {
      flushSync(() => setTProgress(i / totalAnimFrames))
      await waitPaint()
      const svg = getAnimSvg()
      if (!svg) continue
      try { frames.push(await captureSvgFrame(svg, VW, VH)) } catch { /* skip */ }
    }

    // Phase 3 -hold final product table
    for (let i = 0; i < endHoldFrames; i++) {
      await waitPaint()
      const svg = getAnimSvg()
      if (!svg) continue
      try { frames.push(await captureSvgFrame(svg, VW, VH)) } catch { /* skip */ }
    }

    if (frames.length > 0) {
      triggerDownload(encodeGif(frames, VW, VH, fps), `groupviz_dp_table_${Date.now()}.gif`)
    }

    if (hiddenDropEl.current) { hiddenDropEl.current.forEach(el => el.style.display = ''); hiddenDropEl.current = null }
    setTPhase('idle')
    setTProgress(0)
    setTProd(null)
    setIsExportingGif(false)
    exportingRef.current = false
  }, [directProductSource, directProductTarget, executeDirectProduct, setHintMessage, t])

  useEffect(() => () => { cancelAnimationFrame(raf.current); cancelAnimationFrame(tRaf.current) }, [])

  const modes = [
    { key: 'cayley' as const, label: t('dp.mode.cayley') },
    { key: 'table' as const, label: t('dp.mode.table') },
    { key: 'direct' as const, label: t('dp.mode.direct') },
  ]
  const busy = pPhase === 'anim' || tPhase === 'anim'

  return (
    <div className="dp-view-container">
      <div className="dp-mode-bar">
        <span className="dp-mode-label">{t('dp.mode')}:</span>
        <div className="dp-mode-tabs">
          {modes.map(m => (
            <button key={m.key} className={`dp-mode-tab ${directProductCreationMode === m.key ? 'active' : ''}`}
              onClick={() => { setDirectProductCreationMode(m.key); setPPhase('idle'); setProductG(null); setTPhase('idle'); setTProd(null) }}
              disabled={busy}>{m.label}</button>
          ))}
        </div>
        {busy && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent-teal)' }}>
          {(pPhase === 'anim' ? (pProgress < 0.3 ? '\u26A1' : pProgress < 0.6 ? '\u2728' : '\uD83D\uDD17') + ' ' : '') + t('dp.animation')}
        </span>}
      </div>

      {directProductCreationMode === 'direct' ? <DirectCreatePanel />
      : directProductCreationMode === 'cayley' ? (
        <div className="dp-cayley-workspace">
          {!directProductSource && !directProductTarget && (
            <div className="dp-empty-state"><p>{t('dp.workspace')}</p><p className="dp-sub">{t('dp.selectBoth')}</p></div>
          )}
          {directProductSource && directProductTarget && pPhase === 'idle' && (
            <div className="dp-drag-hint" style={{ color: drag ? 'var(--accent-teal)' : undefined }}>{t('dp.dragHint')}</div>
          )}

          {directProductSource && directProductTarget && pPhase === 'idle' && (
            <div className="dp-table-actions" style={{ marginBottom: 6 }}>
              <button
                className="panel-btn"
                onClick={handleExportCayleyGif}
                disabled={isExportingGif}
                style={{ padding: '6px 18px', fontSize: '12px', backgroundColor: isExportingGif ? 'var(--bg-muted)' : 'var(--accent-purple)', color: isExportingGif ? 'var(--text-muted)' : '#fff', borderColor: 'var(--accent-purple)' }}
              >
                {isExportingGif ? t('dp.exporting') : t('dp.exportGif')}
              </button>
            </div>
          )}

          <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: '100%', height: '100%', background: 'var(--canvas-bg)', display: 'block' }}>
            {/* Idle: two graphs */}
            {pPhase === 'idle' && directProductSource && (
              <InteractiveCayleyGraph group={directProductSource} label={directProductSource.symbol} side="left"
                dragState={drag} onDragStart={handleDragStart} onDropOnNode={handleDropOnNode} dropTargetNode={null}
                frozen={drag?.active && drag.side === 'right'} />
            )}
            {pPhase === 'idle' && directProductTarget && (
              <InteractiveCayleyGraph group={directProductTarget} label={directProductTarget.symbol} side="right"
                dragState={drag} onDragStart={handleDragStart} onDropOnNode={handleDropOnNode} dropTargetNode={null}
                frozen={drag?.active && drag.side === 'left'} />
            )}
            {pPhase === 'idle' && directProductSource && directProductTarget && (
              <line x1={VIEW_W / 2} y1={50} x2={VIEW_W / 2} y2={VIEW_H - 20} stroke="var(--border-color)" strokeWidth={1} strokeDasharray="4 4" opacity={0.25} />
            )}

            {/* Animation */}
            {pPhase === 'anim' && nestedData && renderAnimCayley()}

            {/* Done: brief product info then navigate */}
            {pPhase === 'done' && productG && (
              <g>
                <text x={VIEW_W / 2} y={VIEW_H / 2 - 20} textAnchor="middle" fill="var(--accent-teal)" fontSize="18" fontWeight="bold" pointerEvents="none">
                  {productG.symbol}
                </text>
                <text x={VIEW_W / 2} y={VIEW_H / 2 + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="13" pointerEvents="none">
                  |G| = {productG.order}
                </text>
              </g>
            )}
          </svg>
        </div>
      ) : (
        /* ══-Table mode ══-*/
        <div className="dp-table-workspace" style={(!directProductSource || !directProductTarget) && tPhase === 'idle' ? { alignItems: 'center' } : undefined}>
          {!directProductSource && !directProductTarget && !tProd && (
            <div className="dp-empty-state"><p>{t('dp.workspace')}</p><p className="dp-sub">{t('dp.selectBoth')}</p></div>
          )}
          {/* Idle: two tables */}
          {tPhase !== 'done' && directProductSource && (
            <DraggableTable group={directProductSource} label={t('dp.sourceGroup') + ': ' + directProductSource.symbol}
              side="left" drag={tDrag} onDragStart={tblStart} onFullDrop={(ds) => tblDropFull(ds, 'left')} onCellDrop={(ds, r, c) => tblDropCell(ds, 'left', r, c)} ghost={false}
              single={!directProductTarget} />
          )}
          {tPhase !== 'done' && directProductTarget && (
            <DraggableTable group={directProductTarget} label={t('dp.targetGroup') + ': ' + directProductTarget.symbol}
              side="right" drag={tDrag} onDragStart={tblStart} onFullDrop={(ds) => tblDropFull(ds, 'right')} onCellDrop={(ds, r, c) => tblDropCell(ds, 'right', r, c)} ghost={false}
              single={!directProductSource} />
          )}
          {/* Ghost preview follows cursor while dragging */}
          {tPhase === 'idle' && tDrag && (
            <DraggableTable group={tDrag.side === 'left' ? directProductSource! : directProductTarget!}
              label={(tDrag.side === 'left' ? t('dp.sourceGroup') : t('dp.targetGroup')) + ': ghost'}
              side={tDrag.side} drag={tDrag} onDragStart={tblStart} onFullDrop={(ds) => tblDropFull(ds, ds === 'left' ? 'left' : 'right')} onCellDrop={(ds, r, c) => tblDropCell(ds, ds === 'left' ? 'left' : 'right', r, c)} ghost={true} />
          )}
          {/* Animation */}
          {(tPhase === 'anim' || tPhase === 'done') && tProd && directProductSource && directProductTarget && (
            <div className="dp-table-group" style={{ flexBasis: '100%', maxWidth: 'none', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', maxHeight: '680px' }}>
              <div className="dp-table-label" style={{ color: 'var(--accent-teal)', animation: tPhase === 'anim' ? 'pulse 0.6s infinite' : undefined }}>
                {tProd.symbol} (|G|={tProd.order})
              </div>
              <TableAnimView prod={tProd} tgt={directProductSource} src={directProductTarget}
                progress={tProgress} dropCell={tDropCell} />
            </div>
          )}
          {/* Create button */}
          {tPhase === 'idle' && directProductSource && directProductTarget && !tDrag && (
            <div className="dp-table-actions">
              <button className="panel-btn dp-create-btn" onClick={btnCreate} style={{ padding: '10px 28px', fontSize: '14px' }}>{t('dp.createDirectProduct')}</button>
              <button
                className="panel-btn"
                onClick={handleExportTableGif}
                disabled={isExportingGif}
                style={{ padding: '10px 18px', fontSize: '13px', backgroundColor: isExportingGif ? 'var(--bg-muted)' : 'var(--accent-purple)', color: isExportingGif ? 'var(--text-muted)' : '#fff', borderColor: 'var(--accent-purple)' }}
              >
                {isExportingGif ? t('dp.exporting') : t('dp.exportGif')}
              </button>
            </div>
          )}
          {tDrag && <div className="dp-drag-hint" style={{ position: 'absolute', color: 'var(--accent-teal)' }}>{t('dp.tableDragHint')}</div>}
        </div>
      )}

      {hintMessage && (
        <div
          className="hint-box"
          style={{ zIndex: 20, opacity: hintFade.visible ? 1 : 0 }}
          onMouseEnter={hintFade.onMouseEnter}
          onMouseLeave={hintFade.onMouseLeave}
        >
          <div className="hint-box-header">
            <span>{`💡 ${t('canvas.hintBox')}`}</span>
          </div>
          <div className="hint-box-body" dangerouslySetInnerHTML={{ __html: hintMessage }} />
        </div>
      )}
    </div>
  )
}

// ══-Draggable Table (with cell-level drop) ══-
const TBL_CELL = 34

function DraggableTable({ group, label, side, drag, onDragStart, onFullDrop, onCellDrop, ghost, single }: {
  group: Group; label: string; side: 'left' | 'right'
  drag: { side: 'left' | 'right'; x: number; y: number } | null
  onDragStart: (side: 'left' | 'right', e: React.MouseEvent) => void
  onFullDrop: (side: 'left' | 'right') => void
  onCellDrop: (side: 'left' | 'right', row: number, col: number) => void
  ghost?: boolean
  single?: boolean
}) {
  const n = group.order
  const cs = TBL_CELL
  const isDragged = drag?.side === side
  const isTarget = !isDragged && drag !== null && !ghost

  // outer container style: supports ghost dragging (fixed at cursor) and target-scale when hovered
  const outerStyle: React.CSSProperties = {
    opacity: ghost ? 0.25 : 1,
    transition: 'opacity 0.25s, transform 0.22s',
    transformOrigin: 'center center',
  }

  if (isTarget && !ghost) {
    // slightly enlarge target table for better visibility
    outerStyle.transform = 'scale(1.08)'
    outerStyle.zIndex = 2
    outerStyle.position = 'relative'
    outerStyle.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))'
  }

  if (ghost && isDragged && drag) {
    // ghost follows the mouse (positioned in viewport coordinates)
    outerStyle.position = 'fixed'
    outerStyle.left = `${drag.x}px`
    outerStyle.top = `${drag.y}px`
    // center the ghost on the cursor
    outerStyle.transform = 'translate(-50%, -50%)'
    outerStyle.pointerEvents = 'none'
    outerStyle.zIndex = 9999
    outerStyle.opacity = 0.9
  }

  return (
    <div className={`dp-table-group${single ? ' single' : ''}`} data-side={side} style={outerStyle}>
      <div className="dp-table-label">{label} (|G|={group.order})</div>
      <div style={{ overflow: 'auto', maxHeight: '420px', maxWidth: '100%', border: isTarget ? '2px solid var(--accent-teal)' : '1px solid var(--border-color)', borderRadius: 4 }}>
        <svg viewBox={`0 0 ${(n + 1) * cs} ${(n + 1) * cs}`} style={{ background: 'var(--canvas-bg)', borderRadius: 4, display: 'block' }} width={(n + 1) * cs} height={(n + 1) * cs}>
          {group.elements.map((el, i) => (
            <foreignObject key={`h-${i}`} x={(i + 1) * cs + 3} y={3} width={cs - 6} height={cs - 6}>
              <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
            </foreignObject>
          ))}
          {group.elements.map((a, i) => (
            <g key={`row-${i}`}>
              <foreignObject x={3} y={(i + 1) * cs + 3} width={cs - 6} height={cs - 6}>
                <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(a.label)) }} />
              </foreignObject>
              {group.elements.map((b, j) => {
                const prod = group.multiply(a, b)
                const isHover = isTarget
                return (
                  <g key={`${i}-${j}`}>
                    <rect x={(j + 1) * cs + 0.5} y={(i + 1) * cs + 0.5} width={cs - 1} height={cs - 1}
                      fill={isHover ? 'rgba(78,205,196,0.08)' : 'var(--canvas-bg)'}
                      stroke={isHover ? 'var(--accent-teal)' : 'var(--border-color)'}
                      strokeWidth={isHover ? 1.5 : 0.5}
                      onMouseUp={() => { if (isTarget) onCellDrop(drag!.side, i, j) }}
                      style={{ cursor: isTarget ? 'pointer' : 'default' }} />
                    <foreignObject x={(j + 1) * cs + 3} y={(i + 1) * cs + 3} width={cs - 6} height={cs - 6} style={{ pointerEvents: 'none' }}>
                      <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-primary)' }}
                        dangerouslySetInnerHTML={{ __html: renderTex(texify(prod.label)) }} />
                    </foreignObject>
                  </g>
                )
              })}
            </g>
          ))}
          {/* Drag handle (top-left corner) -dragging the corner drags the WHOLE table */}
          {!ghost && (
            <rect x={0.5} y={0.5} width={cs - 1} height={cs - 1} fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth={1}
              onMouseDown={(e) => { e.stopPropagation(); onDragStart(side, e) }}
              style={{ cursor: 'grab' }} />
          )}
          {/* Entire table is also droppable (as a fallback when not dropped on a specific cell) */}
          {isTarget && (
            <rect x={0} y={0} width={(n + 1) * cs} height={(n + 1) * cs} fill="transparent"
              onMouseUp={() => onFullDrop(drag!.side)}
              style={{ cursor: 'pointer' }} />
          )}
        </svg>
      </div>
    </div>
  )
}

// ══-Animated Table: nested H table inside each G cell -product table ══-
function TableAnimView({ prod, tgt, src, progress, dropCell }: {
  prod: Group; tgt: Group; src: Group; progress: number
  dropCell: { row: number; col: number; targetSide: 'left' | 'right'; dragSide: 'left' | 'right' } | null
}) {
  const p = progress

  // Determine which is G (outer) and H (inner) based on drop target
  const G = (!dropCell || dropCell.targetSide !== 'right') ? tgt : src
  const H = (!dropCell || dropCell.targetSide !== 'right') ? src : tgt

  // ── Fixed viewBox: 600×600, content always centered inside ──
  const VW = 600; const VH = 600

  // ── G table cell size: fill most of the viewBox so nested H tables are readable ──
  const G_CELL = Math.min(84, Math.max(36, Math.floor((VW - 32) / (G.order + 1))))
  const G_TABLE = (G.order + 1) * G_CELL
  const gOffX = (VW - G_TABLE) / 2; const gOffY = (VH - G_TABLE) / 2

  // ── H mini-table cell size proportional to G cell ──
  const H_CELL = Math.max(3, (G_CELL - 4) / (H.order + 1))

  // ── Product table cell size: auto-scale to fit viewBox ──
  const P_CELL = Math.max(10, Math.min(48, Math.floor((VW - 32) / (prod.order + 1))))
  const P_TABLE = (prod.order + 1) * P_CELL
  const pOffX = (VW - P_TABLE) / 2; const pOffY = (VH - P_TABLE) / 2

  // ── Animation phases (opacity-based, no scaling) ──
  //  0.00-0.14: G table fades in from 0 → 1
  //  0.14-0.40: G fully visible, H mini-tables appear inside G cells
  //  0.40-0.56: G and H fade out together → both gone by 0.56
  //  0.58-0.78: Product table fades in (border + headers)
  //  0.60-0.80: Product cells fill in (barely after headers)
  //  0.80-1.00: completion hint

  const gFadeIn = Math.min(1, p / 0.14)
  const gFadeOut = Math.min(1, Math.max(0, (0.56 - p) / 0.16))
  const gOpacity = gFadeIn * gFadeOut
  const nestAppear = Math.min(1, Math.max(0, (p - 0.14) / 0.26))
  const nestFade = Math.min(1, Math.max(0, (0.56 - p) / 0.16))
  const nestOpacity = nestAppear * nestFade
  const prodFade = Math.min(1, Math.max(0, (p - 0.58) / 0.20))
  const cellsFade = Math.min(1, Math.max(0, (p - 0.60) / 0.20))

  // ── Subtle scale-in effects (no "flying out") ──
  const gScaleIn = 0.75 + 0.25 * Math.min(1, Math.max(0, p / 0.28))
  const pScaleIn = 0.92 + 0.08 * prodFade

  // ── Pre-compute product cells ──
  const pcells = useMemo(() => {
    const c: Array<{ row: number; col: number; label: string }> = []
    prod.elements.forEach((a, i) => prod.elements.forEach((b, j) => {
      c.push({ row: i, col: j, label: prod.multiply(a, b).label })
    }))
    return c
  }, [prod])

  const isCellDrop = dropCell && dropCell.row !== -1

  return (
    <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%', height: '100%', minHeight: '420px', maxHeight: '620px' }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ background: 'var(--canvas-bg)', borderRadius: 6, display: 'block', width: '100%', maxWidth: '620px', maxHeight: '620px' }}>

        {/* ══ Layer: G table + H nested mini-tables ══ */}
        <g transform={`translate(${VW / 2},${VH / 2}) scale(${gScaleIn.toFixed(3)}) translate(${-VW / 2},${-VH / 2})`}>

        {/* G table border */}
        <rect x={gOffX + G_CELL - 2} y={gOffY + G_CELL - 2}
          width={G_TABLE - G_CELL + 4} height={G_TABLE - G_CELL + 4}
          fill="none" stroke="var(--border-color)" strokeWidth={1} rx={4} opacity={gOpacity} pointerEvents="none" />

        {/* G column headers */}
        {G.elements.map((el, i) => (
          <foreignObject key={`gh-${i}`} x={gOffX + (i + 1) * G_CELL + 2} y={gOffY + 2}
            width={G_CELL - 4} height={G_CELL - 4} opacity={gOpacity}>
            <div style={{ fontSize: `${Math.max(10, G_CELL * 0.3)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontWeight: 500 }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
          </foreignObject>
        ))}

        {/* G row headers */}
        {G.elements.map((el, i) => (
          <foreignObject key={`gr-${i}`} x={gOffX + 2} y={gOffY + (i + 1) * G_CELL + 2}
            width={G_CELL - 4} height={G_CELL - 4} opacity={gOpacity}>
            <div style={{ fontSize: `${Math.max(10, G_CELL * 0.3)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontWeight: 500 }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
          </foreignObject>
        ))}

        {/* G cells */}
        {G.elements.map((a, i) => G.elements.map((b, j) => {
          const prod_ = G.multiply(a, b)
          const cx = gOffX + (j + 1) * G_CELL
          const cy = gOffY + (i + 1) * G_CELL
          return (
            <g key={`gc-${i}-${j}`} opacity={gOpacity}>
              <rect x={cx + 0.5} y={cy + 0.5} width={G_CELL - 1} height={G_CELL - 1}
                fill="var(--canvas-bg)" stroke="var(--border-color)" strokeWidth={0.5} />
              <foreignObject x={cx + 2} y={cy + 2} width={G_CELL - 4} height={G_CELL - 4}>
                <div style={{ fontSize: `${Math.max(10, G_CELL * 0.3)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(prod_.label)) }} />
              </foreignObject>
            </g>
          )
        }))}

        {/* H mini-tables nested in G cells */}
        {nestOpacity > 0.001 && (
          <g opacity={nestOpacity}>
            {G.elements.map((_, gi) => G.elements.map((_, gj) => {
              const bx = gOffX + (gj + 1) * G_CELL
              const by = gOffY + (gi + 1) * G_CELL
              return (
                <g key={`nest-${gi}-${gj}`}>
                  {H.elements.map((sa, si) => H.elements.map((sb, sj) => {
                    const sp = H.multiply(sa, sb)
                    const hx = bx + (sj + 1) * H_CELL
                    const hy = by + (si + 1) * H_CELL
                    return (
                      <g key={`ns-${gi}-${gj}-${si}-${sj}`}>
                        <rect x={hx + 0.3} y={hy + 0.3} width={H_CELL - 0.6} height={H_CELL - 0.6}
                          fill="var(--bg-secondary)" stroke="var(--border-color)" strokeWidth={0.2} rx={1} opacity={0.8} />
                        {H_CELL >= 7 && (
                          <foreignObject x={hx + 1} y={hy + 1} width={H_CELL - 2} height={H_CELL - 2}>
                            <div style={{ fontSize: `${Math.max(5, H_CELL * 0.42)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-primary)' }}
                              dangerouslySetInnerHTML={{ __html: renderTex(texify(sp.label)) }} />
                          </foreignObject>
                        )}
                      </g>
                    )
                  }))}
                </g>
              )
            }))}
          </g>
        )}

        </g>

        {/* ══ Layer: Product table (fades in over nested view) ══ */}
        <g transform={`translate(${VW / 2},${VH / 2}) scale(${pScaleIn.toFixed(3)}) translate(${-VW / 2},${-VH / 2})`}>

        {/* Product table border */}
        <rect x={pOffX + P_CELL - 2} y={pOffY + P_CELL - 2}
          width={P_TABLE - P_CELL + 4} height={P_TABLE - P_CELL + 4}
          fill="none" stroke="var(--accent-teal)" strokeWidth={1.5} rx={4}
          opacity={prodFade * 0.6} pointerEvents="none" />

        {/* Product column headers */}
        {prod.elements.map((el, i) => (
          <foreignObject key={`ph-${i}`} x={pOffX + (i + 1) * P_CELL + 2} y={pOffY + 2}
            width={P_CELL - 4} height={P_CELL - 4} opacity={prodFade}>
            <div style={{ fontSize: `${Math.max(8, P_CELL * 0.33)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
          </foreignObject>
        ))}

        {/* Product row headers */}
        {prod.elements.map((el, i) => (
          <foreignObject key={`pr-${i}`} x={pOffX + 2} y={pOffY + (i + 1) * P_CELL + 2}
            width={P_CELL - 4} height={P_CELL - 4} opacity={prodFade}>
            <div style={{ fontSize: `${Math.max(8, P_CELL * 0.33)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
          </foreignObject>
        ))}

        {/* Product cells */}
        <g opacity={cellsFade}>
          {pcells.map(({ row, col, label }) => {
            const cx = pOffX + (col + 1) * P_CELL
            const cy = pOffY + (row + 1) * P_CELL
            const isDropTarget = isCellDrop && dropCell!.row === row && dropCell!.col === col
            return (
              <g key={`p${row}-${col}`}>
                <rect x={cx + 0.5} y={cy + 0.5} width={P_CELL - 1} height={P_CELL - 1}
                  fill={isDropTarget ? 'rgba(78,205,196,0.18)' : 'var(--canvas-bg)'}
                  stroke={isDropTarget ? 'var(--accent-teal)' : 'var(--border-color)'}
                  strokeWidth={isDropTarget ? 1.5 : 0.5} />
                <foreignObject x={cx + 1} y={cy + 1} width={P_CELL - 2} height={P_CELL - 2}>
                  <div style={{ fontSize: `${Math.max(7, P_CELL * 0.32)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: isDropTarget ? 'var(--accent-teal)' : 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(label)) }} />
                </foreignObject>
              </g>
            )
          })}
        </g>

        </g>

        {/* Completion hint label */}
        {p > 0.80 && (
          <text x={VW / 2} y={VH - 16} textAnchor="middle" fill="var(--accent-teal)" fontSize="14" fontWeight="bold"
            opacity={Math.min(1, Math.max(0, (p - 0.80) / 0.10))}>
            {prod.symbol}  |G| = {prod.order}
          </text>
        )}

      </svg>
    </div>
  )
}

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { renderTex } from '../../utils/texify'
import { verifyHomomorphism } from '../../core/algebra/homomorphisms'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { COLOR_PALETTE } from '../../core/types'
import type { GroupElement } from '../../core/types'

const KERNEL_RED = '#ff6b6b'
const IMAGE_CYAN = '#4ecdc4'
const ISO_TEAL = '#38bdf8'

const FIBER_COLORS = [
  '#4ecdc4', '#a78bfa', '#ffd93d', '#f97316', '#38bdf8',
  '#84cc16', '#f43f5e', '#eab308', '#6366f1', '#ec4899',
  '#14b8a6', '#0ea5e9', '#22c55e', '#a855f7', '#06b6d4',
]

type Phase = 0 | 1 | 2 | 3

function ringPos(idx: number, total: number, cx: number, cy: number, radius: number) {
  if (total <= 0) return { x: cx, y: cy }
  const angle = -Math.PI / 2 + (2 * Math.PI * idx) / total
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function computeCircularPositions(
  ids: string[], cx: number, cy: number, radius: number,
): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>()
  ids.forEach((id, i) => m.set(id, ringPos(i, ids.length, cx, cy, radius)))
  return m
}

function findGeneratorElements(group: { elements: GroupElement[]; generators: { name: string; symbol: string; apply: (el: GroupElement) => GroupElement }[]; identity: GroupElement }): GroupElement[] {
  const result: GroupElement[] = []
  for (const gen of group.generators) {
    let el = group.elements.find(e => e.label === gen.symbol || e.label === gen.name)
    if (!el) {
      const image = gen.apply(group.identity)
      el = group.elements.find(e => e.id === image.id)
    }
    if (el) result.push(el)
  }
  return result
}

function computeCosetPositions(
  fibers: { sourceIds: string[] }[],
  cx: number, cy: number, areaR: number, nodeR: number,
): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>()
  const n = fibers.length
  if (n === 0) return m
  const clusterR = areaR * 0.58
  for (let i = 0; i < n; i++) {
    const f = fibers[i]
    const fc = ringPos(i, n, cx, cy, clusterR)
    const k = f.sourceIds.length
    const subR = Math.min(nodeR * 3.0, nodeR + 4.0 * Math.sqrt(k))
    f.sourceIds.forEach((id, j) => {
      m.set(id, ringPos(j, k, fc.x, fc.y, subR))
    })
  }
  return m
}

function computeEdgeEndpoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromR: number,
  toR: number,
): { startX: number; startY: number; endX: number; endY: number } | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 0.5) return null
  const ux = dx / dist
  const uy = dy / dist
  return {
    startX: from.x + fromR * ux,
    startY: from.y + fromR * uy,
    endX: to.x - toR * ux,
    endY: to.y - toR * uy,
  }
}

export function FirstIsomorphismAnimation() {
  const { t } = useTranslation()
  const {
    editingSource: source,
    editingTarget: target,
    editingMapping: mapping,
    activeHomomorphismId,
    homomorphisms,
    setTheoremPhase,
  } = useGroup()

  const [phase, setPhase] = useState<Phase>(0)
  const activeHomo = homomorphisms.find(h => h.id === activeHomomorphismId)

  useEffect(() => { setTheoremPhase(phase) }, [phase, setTheoremPhase])

  const result = useMemo(() => {
    if (!source || !target || mapping.size === 0) return null
    return activeHomo?.result || verifyHomomorphism(source, target, mapping)
  }, [source, target, mapping, activeHomo])

  const fibers = useMemo(() => {
    if (!source || !target || !result?.isHomomorphism) return []
    const fibMap = new Map<string, { targetId: string; sourceIds: string[] }>()
    mapping.forEach((tgtId, srcId) => {
      if (!fibMap.has(tgtId)) fibMap.set(tgtId, { targetId: tgtId, sourceIds: [] })
      fibMap.get(tgtId)!.sourceIds.push(srcId)
    })
    return Array.from(fibMap.values()).sort((a, b) => {
      const aIsKer = a.targetId === target.identity.id
      const bIsKer = b.targetId === target.identity.id
      if (aIsKer && !bIsKer) return -1
      if (!aIsKer && bIsKer) return 1
      return b.sourceIds.length - a.sourceIds.length
    })
  }, [source, target, mapping, result])

  const kernelIds = useMemo(() => new Set(result?.kernel || []), [result])
  const imageIds = useMemo(() => new Set(result?.image || []), [result])

  const targetColorIndex = useMemo(() => {
    if (!target) return new Map<string, number>()
    const m = new Map<string, number>()
    target.elements.forEach((e, i) => m.set(e.id, i))
    return m
  }, [target])

  const fiberColors = useMemo(() => {
    return fibers.map(f => FIBER_COLORS[(targetColorIndex.get(f.targetId) ?? 0) % FIBER_COLORS.length])
  }, [fibers, targetColorIndex])

  // ── Layout constants ──
  const G_CX = 180; const G_CY = 150
  const H_CX = 720; const H_CY = 150
  const gR = Math.max(100, Math.min(220, Math.sqrt(source?.order ?? 0) * 30))
  const hR = Math.max(70, Math.min(140, Math.sqrt(target?.order ?? 0) * 22))
  const gNodeR = (source?.order ?? 0) <= 6 ? 14 : (source?.order ?? 0) <= 12 ? 12 : (source?.order ?? 0) <= 24 ? 10 : (source?.order ?? 0) <= 48 ? 8 : 6
  const hNodeR = (target?.order ?? 0) <= 12 ? 12 : (target?.order ?? 0) <= 24 ? 10 : (target?.order ?? 0) <= 48 ? 8 : 6
  const Q_CX = 450
  const Q_CY = 390
  const nQuot = fibers.length
  const qR = Math.max(70, Math.min(130, hR * 1.05))
  const qNodeR = Math.min(38, Math.max(22, hNodeR * 2.5))

  const showKer = phase >= 1
  const showQuotient = phase >= 2
  const showIso = phase >= 3

  const stepForward = useCallback(() => setPhase(p => Math.min(3, p + 1) as Phase), [])
  const stepBack = useCallback(() => setPhase(p => Math.max(0, p - 1) as Phase), [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') { stepForward(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { stepBack(); e.preventDefault(); }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepForward, stepBack])

  // ── Element positions ──
  const gCircPositions = useMemo(() => {
    if (!source) return new Map<string, { x: number; y: number }>()
    return computeCircularPositions(source.elements.map(e => e.id), G_CX, G_CY, gR)
  }, [source, G_CX, G_CY, gR])

  const gCosetPositions = useMemo(() => {
    if (!source || fibers.length === 0) return new Map<string, { x: number; y: number }>()
    return computeCosetPositions(fibers, G_CX, G_CY, gR, gNodeR)
  }, [source, fibers, G_CX, G_CY, gR, gNodeR])

  const gPositions = showKer ? gCosetPositions : gCircPositions

  const hPositions = useMemo(() => {
    if (!target) return new Map<string, { x: number; y: number }>()
    return computeCircularPositions(target.elements.map(e => e.id), H_CX, H_CY, hR)
  }, [target, H_CX, H_CY, hR])

  const quotientPositions = useMemo(() => {
    const qR_eff = nQuot === 1 ? 0 : qR
    return fibers.map((f) => {
      const hPos = hPositions.get(f.targetId)
      if (!hPos || nQuot === 1) return { x: Q_CX, y: Q_CY }
      const angle = Math.atan2(hPos.y - H_CY, hPos.x - H_CX)
      return { x: Q_CX + qR_eff * Math.cos(angle), y: Q_CY + qR_eff * Math.sin(angle) }
    })
  }, [fibers, hPositions, qR, nQuot, H_CX, H_CY])

  // ── Quotient labels ──
  const quotientLabels = useMemo(() => {
    if (!source) return [] as string[]
    return fibers.map((f, i) => {
      if (i === 0 && kernelIds.size > 0) return '\\textbf{Ker}\\,f'
      const rep = source.elements.find(e => e.id === f.sourceIds[0])
      return rep ? `\\bar{${rep.label}}` : `\\bar{g}_{${i}}`
    })
  }, [source, fibers, kernelIds])

  // ── Cayley edges (generator-based) ──
  const gCayleyEdges = useMemo(() => {
    if (!source) return []
    const genEls = findGeneratorElements(source)
    if (genEls.length === 0) return []
    const actions = genEls.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }))
    return computeCayleyActionEdges(source, actions, 'right')
  }, [source])

  const hCayleyEdges = useMemo(() => {
    if (!target) return []
    const genEls = findGeneratorElements(target)
    if (genEls.length === 0) return []
    const actions = genEls.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }))
    return computeCayleyActionEdges(target, actions, 'right')
  }, [target])

  // ── Quotient Cayley edges ──
  const quotientEdges = useMemo(() => {
    if (!source || fibers.length === 0) return [] as { from: number; to: number; color: string }[]
    const edges: { from: number; to: number; color: string }[] = []
    const idToFibIdx = new Map<string, number>()
    fibers.forEach((f, fi) => f.sourceIds.forEach(id => idToFibIdx.set(id, fi)))
    const seen = new Set<string>()

    const genEls = findGeneratorElements(source)
    genEls.forEach((genEl, gi) => {
      fibers.forEach((f, fi) => {
        const repEl = source.elements.find(e => e.id === f.sourceIds[0])
        if (!repEl) return
        const prod = source.multiply(repEl, genEl)
        const toFi = idToFibIdx.get(prod.id)
        if (toFi !== undefined) {
          const key = `${Math.min(fi, toFi)}|${Math.max(fi, toFi)}`
          if (!seen.has(key)) {
            seen.add(key)
            edges.push({ from: fi, to: toFi, color: COLOR_PALETTE[gi % COLOR_PALETTE.length] })
          }
        }
      })
    })
    return edges
  }, [source, fibers])

  // ── Per-fiber Cayley edges (edges within each coset) ──
  const fiberEdgeMap = useMemo(() => {
    const map = new Map<number, { fromId: string; toId: string; color: string }[]>()
    if (!source || fibers.length === 0) return map
    const idToFibIdx = new Map<string, number>()
    fibers.forEach((f, fi) => f.sourceIds.forEach(id => idToFibIdx.set(id, fi)))
    for (const edge of gCayleyEdges) {
      const fromFi = idToFibIdx.get(edge.fromId)
      const toFi = idToFibIdx.get(edge.toId)
      if (fromFi !== undefined && fromFi === toFi) {
        if (!map.has(fromFi)) map.set(fromFi, [])
        map.get(fromFi)!.push({ fromId: edge.fromId, toId: edge.toId, color: edge.color })
      }
    }
    return map
  }, [gCayleyEdges, fibers, source])

  // ── Empty / error states ──
  if (!source || !target) {
    return (
      <svg viewBox="0 0 960 620" style={{ width: '100%', height: '100%' }}>
        <text x="480" y="310" textAnchor="middle" fill="var(--text-muted)" fontSize="16">
          {t('homo.selectSourceFirst')}
        </text>
      </svg>
    )
  }
  if (!result?.isHomomorphism || fibers.length === 0) {
    return (
      <svg viewBox="0 0 960 620" style={{ width: '100%', height: '100%' }}>
        <text x="480" y="300" textAnchor="middle" fill="var(--text-muted)" fontSize="16">
          {t('homo.firstIso.needValid')}
        </text>
        <text x="480" y="328" textAnchor="middle" fill="var(--text-muted)" fontSize="12">
          {t('homo.firstIso.needValidHint')}
        </text>
      </svg>
    )
  }

  const vw = 960; const vh = 620
  const kernelSize = kernelIds.size

  // ── Render a single Cayley edge curve ──
  function renderEdge(
    posMap: Map<string, { x: number; y: number }>,
    fromId: string, toId: string, color: string, key: string,
    width = 1, opacity = 0.45, selfLoop = false,
  ) {
    const from = posMap.get(fromId)
    const to = posMap.get(toId)
    if (!from || !to) return null
    if (selfLoop) return null
    const dx = to.x - from.x; const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.5) return null
    const mx = (from.x + to.x) / 2; const my = (from.y + to.y) / 2 - dist * 0.12
    return (
      <path key={key} d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
        stroke={color} strokeWidth={width} fill="none" opacity={opacity} />
    )
  }

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} style={{ width: '100%', height: '100%', userSelect: 'none' }}>
      <defs>
        <marker id="isoArrowMk" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={ISO_TEAL} opacity={0.85} />
        </marker>
        <filter id="kerGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feFlood floodColor={KERNEL_RED} floodOpacity={0.55} />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ═══ Background circles ═══ */}
      <circle cx={G_CX} cy={G_CY} r={gR + 6} fill="none" stroke="var(--border-color)" strokeWidth={0.5}
        strokeDasharray="4,8" opacity={0.25} />
      <circle cx={H_CX} cy={H_CY} r={hR + 6} fill="none" stroke="var(--border-color)" strokeWidth={0.5}
        strokeDasharray="4,8" opacity={0.25} />

      {/* ═══ G Cayley edges ═══ */}
      {gCayleyEdges.map((e, i) =>
        renderEdge(gPositions, e.fromId, e.toId, e.color, `ge-${i}`, 1.8, 0.75, e.isSelfLoop)
      )}

      {/* ═══ H Cayley edges ═══ */}
      {hCayleyEdges.map((e, i) =>
        renderEdge(hPositions, e.fromId, e.toId, e.color, `he-${i}`, 1.4, 0.65, e.isSelfLoop)
      )}

      {/* ═══ Quotient Cayley edges (phase 2+) ═══ */}
      {showQuotient && quotientEdges.map((e, i) => {
        const fromPos = quotientPositions[e.from]
        const toPos = quotientPositions[e.to]
        const edgePts = computeEdgeEndpoints(fromPos, toPos, qNodeR, qNodeR)
        if (!edgePts) return null
        const mx = (edgePts.startX + edgePts.endX) / 2
        const my = (edgePts.startY + edgePts.endY) / 2 - 22
        return (
          <path key={`qe-${i}`} d={`M ${edgePts.startX} ${edgePts.startY} Q ${mx} ${my} ${edgePts.endX} ${edgePts.endY}`}
            stroke={e.color} strokeWidth={2.0} fill="none" opacity={0.7} />
        )
      })}

      {/* ═══ G→H mapping lines ═══ */}
      {source.elements.map(el => {
        const tgtId = mapping.get(el.id)
        if (!tgtId) return null
        const from = gPositions.get(el.id) || { x: G_CX, y: G_CY }
        const to = hPositions.get(tgtId) || { x: H_CX, y: H_CY }
        const inKernel = kernelIds.has(el.id)
        const fibIdx = fibers.findIndex(f => f.sourceIds.includes(el.id))
        const color = inKernel ? KERNEL_RED : fiberColors[fibIdx]
        const dx = (to.x - from.x) * 0.18
        const off = gNodeR + 1
        const d = `M ${from.x + off} ${from.y} C ${from.x + off + dx} ${from.y}, ${to.x - off - dx} ${to.y}, ${to.x - off} ${to.y}`
        return (
          <path key={`m-${el.id}`} d={d}
            stroke={color}
            strokeWidth={inKernel ? 1.6 : 0.9} fill="none"
            strokeOpacity={showQuotient ? 0.07 : inKernel ? 0.45 : 0.32} />
        )
      })}

      {/* ═══ G element nodes ═══ */}
      {source.elements.map(el => {
        const pos = gPositions.get(el.id) || { x: G_CX, y: G_CY }
        const inKernel = kernelIds.has(el.id)
        const fibIdx = fibers.findIndex(f => f.sourceIds.includes(el.id))
        const fill = inKernel ? KERNEL_RED : fiberColors[fibIdx] || 'var(--node-fill)'
        const pulsed = showKer && inKernel

        return (
          <g key={`g-${el.id}`} style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: 'transform 0.7s ease-in-out',
          }}>
            {pulsed && (
              <circle cx={0} cy={0} r={gNodeR + 6} fill="none" stroke={KERNEL_RED} strokeWidth={2.5} opacity={0.5}>
                <animate attributeName="r" from={gNodeR + 4} to={gNodeR + 10} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.5} to={0.15} dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={0} cy={0} r={gNodeR}
              fill={fill} stroke={inKernel ? KERNEL_RED : 'var(--border-color)'}
              strokeWidth={inKernel ? 2 : 0.7} opacity={0.92} />
            {gNodeR >= 8 && (
              <foreignObject x={-22} y={gNodeR + 2} width={44} height={16} style={{ overflow: 'visible' }}>
                <div style={{
                  fontSize: '7px', textAlign: 'center', color: inKernel ? KERNEL_RED : 'var(--text-primary)',
                  fontWeight: inKernel ? 700 : 400, pointerEvents: 'none',
                }} dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
              </foreignObject>
            )}
          </g>
        )
      })}

      {/* ═══ H element nodes ═══ */}
      {target.elements.map(el => {
        const pos = hPositions.get(el.id)
        if (!pos) return null
        const inIm = imageIds.has(el.id)
        const dimNonIm = showKer || showQuotient
        const dimmed = (dimNonIm && !inIm) || (!inIm && showIso)
        return (
          <g key={`h-${el.id}`}>
            {inIm && showIso && (
              <circle cx={pos.x} cy={pos.y} r={hNodeR + 5} fill="none" stroke={ISO_TEAL} strokeWidth={2} opacity={0.5}>
                <animate attributeName="opacity" from={0.5} to={0.2} dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={pos.x} cy={pos.y} r={hNodeR}
              fill={inIm ? IMAGE_CYAN : 'var(--node-fill)'}
              stroke={inIm ? IMAGE_CYAN : 'var(--border-color)'}
              strokeWidth={inIm ? 1.8 : 0.7}
              opacity={dimmed ? 0.2 : 0.95}
              style={{ transition: 'opacity 0.5s' }} />
            {hNodeR >= 7 && (
              <foreignObject x={pos.x - 20} y={pos.y + hNodeR + 2} width={40} height={14} style={{ overflow: 'visible' }}>
                <div style={{
                  fontSize: '7px', textAlign: 'center',
                  color: inIm ? IMAGE_CYAN : dimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontWeight: inIm ? 700 : 400, pointerEvents: 'none', transition: 'color 0.5s',
                }} dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
              </foreignObject>
            )}
          </g>
        )
      })}

      {/* ═══ π projection lines: G → quotient nodes (phase 2+) ═══ */}
      {showQuotient && fibers.map((f, fi) => {
        const qX = quotientPositions[fi].x
        const qY = quotientPositions[fi].y
        const repId = f.sourceIds[0]
        const repPos = gPositions.get(repId) || { x: G_CX, y: G_CY + gR }
        const anchorY = qY - qNodeR - 1
        const midY = (repPos.y + gNodeR + anchorY) / 2
        const d = `M ${repPos.x} ${repPos.y + gNodeR} C ${repPos.x} ${midY}, ${qX} ${anchorY + 8}, ${qX} ${anchorY}`
        return (
          <path key={`pi-${fi}`} d={d}
            stroke={fi === 0 ? KERNEL_RED : fiberColors[fi]}
            strokeWidth={1.6} strokeOpacity={0.42} fill="none" />
        )
      })}

      {/* ═══ Quotient nodes (phase 2+) — circular layout mirroring H ═══ */}
      {showQuotient && quotientPositions.map((qPos, i) => {
        const isKer = i === 0 && kernelIds.size > 0
        const fill = isKer ? KERNEL_RED : fiberColors[i]
        const nEl = fibers[i].sourceIds.length
        const innerR = Math.min(qNodeR * 0.65, 4 + nEl * 2.2)
        const fibEdges = fiberEdgeMap.get(i) || []

        // Mini-ring positions within the node
        const innerPositions = new Map<string, { x: number; y: number }>()
        fibers[i].sourceIds.forEach((id, j) => {
          innerPositions.set(id, ringPos(j, nEl, qPos.x, qPos.y, innerR))
        })

        return (
          <g key={`qn-${i}`}>
            {/* Glow ring for kernel */}
            {isKer && (
              <circle cx={qPos.x} cy={qPos.y} r={qNodeR + 4} fill="none" stroke={KERNEL_RED} strokeWidth={2} opacity={0.4}>
                <animate attributeName="r" from={qNodeR + 2} to={qNodeR + 8} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.4} to={0.1} dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Node circle */}
            <circle cx={qPos.x} cy={qPos.y} r={qNodeR}
              fill={fill} opacity={0.18}
              stroke={fill} strokeWidth={isKer ? 2.5 : 1.8}
              strokeOpacity={isKer ? 0.8 : 0.55} />

            {/* Cayley edges within this coset */}
            {fibEdges.map((fe, ei) => {
              const fp = innerPositions.get(fe.fromId)
              const tp = innerPositions.get(fe.toId)
              if (!fp || !tp) return null
              const mx = (fp.x + tp.x) / 2; const my = (fp.y + tp.y) / 2 - 4
              return (
                <path key={`qne-${i}-${ei}`}
                  d={`M ${fp.x} ${fp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`}
                  stroke={fe.color} strokeWidth={0.9} fill="none" opacity={0.55} />
              )
            })}

            {/* Element dots within coset */}
            {fibers[i].sourceIds.map((sid, ei) => {
              const ip = innerPositions.get(sid)
              if (!ip) return null
              const dotR = nEl <= 6 ? 3.2 : nEl <= 12 ? 2.6 : 2.0
              return (
                <circle key={`qdot-${i}-${ei}`} cx={ip.x} cy={ip.y} r={dotR}
                  fill={isKer ? '#fff' : fill} opacity={0.85}
                  stroke={isKer ? KERNEL_RED : 'none'} strokeWidth={0.5} />
              )
            })}

            {/* Label below node */}
            <foreignObject x={qPos.x - 28} y={qPos.y + qNodeR + 2} width={56} height={18} style={{ overflow: 'visible' }}>
              <div style={{ fontSize: '10px', textAlign: 'center', color: isKer ? KERNEL_RED : 'var(--text-primary)', fontWeight: isKer ? 700 : 600, pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: renderTex(quotientLabels[i]) }} />
            </foreignObject>

            {/* Coset size badge */}
            {!isKer && (
              <text x={qPos.x + qNodeR - 4} y={qPos.y - qNodeR + 12} textAnchor="end" fill={fill} fontSize="7" opacity={0.7}>
                {nEl}
              </text>
            )}
          </g>
        )
      })}

      {/* ═══ f̃ isomorphism arrows: quotient → H image (phase 3+) ═══ */}
      {showIso && fibers.map((f, fi) => {
        const qX = quotientPositions[fi].x
        const qY = quotientPositions[fi].y
        const imPos = hPositions.get(f.targetId)
        if (!imPos) return null
        const startY = qY - qNodeR - 3
        const endY = imPos.y + hNodeR + 3
        const midX = (qX + imPos.x) / 2
        const midY = (startY + endY) / 2 - 15
        const d = `M ${qX} ${startY} Q ${midX} ${midY}, ${imPos.x} ${endY}`
        return (
          <path key={`fi-${fi}`} d={d}
            stroke={ISO_TEAL} strokeWidth={2} strokeOpacity={0.7} fill="none"
            markerEnd="url(#isoArrowMk)" />
        )
      })}

      {/* ═══ Formula bar (phase 3+) ═══ */}
      {showIso && (
        <g transform={`translate(${vw / 2}, ${Q_CY + qR + qNodeR + 44})`}>
          <rect x={-155} y={-15} width={310} height={30} rx={7}
            fill="var(--panel-bg)" stroke={ISO_TEAL} strokeWidth={1} opacity={0.95} />
          <text x={0} y={5} textAnchor="middle" fill={ISO_TEAL} fontSize="13" fontWeight="bold">
            |G| / |Ker f| = {source.order} / {kernelSize} = {Math.round(source.order / kernelSize)} = |Im f|
          </text>
        </g>
      )}

      {/* ═══ Corner labels ═══ */}
      <foreignObject x={G_CX - 50} y={G_CY - gR - 40} width={100} height={22}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '22px' }}
          dangerouslySetInnerHTML={{ __html: renderTex(source.symbol) }} />
      </foreignObject>
      <text x={G_CX} y={G_CY - gR - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
        |G| = {source.order}
      </text>

      <foreignObject x={H_CX - 50} y={H_CY - hR - 40} width={100} height={22}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '22px' }}
          dangerouslySetInnerHTML={{ __html: renderTex(target.symbol) }} />
      </foreignObject>
      <text x={H_CX} y={H_CY - hR - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
        |H| = {target.order}
      </text>

      {showQuotient && (
        <g transform={`translate(${Q_CX - qR - qNodeR - 8}, ${Q_CY})`}>
          <foreignObject x={-90} y={-36} width={90} height={22}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'right', color: 'var(--text-primary)', lineHeight: '22px' }}
              dangerouslySetInnerHTML={{ __html: renderTex(`${source.symbol} / \\operatorname{Ker} f`) }} />
          </foreignObject>
          <text x={0} y={-4} textAnchor="end" fill="var(--text-muted)" fontSize="8">
            |{source.order}/{kernelSize}| = {Math.round(source.order / kernelSize)}
          </text>
        </g>
      )}

      {/* ═══ Navigation ═══ */}
      {phase > 0 && (
        <g transform={`translate(12, ${vh - 32})`} style={{ cursor: 'pointer' }} onClick={stepBack}>
          <rect x={0} y={-14} width={28} height={28} rx={4} fill="var(--accent-teal)" opacity={0.8} />
          <text x={14} y={4} textAnchor="middle" fill="#0f0f1a" fontSize="14" fontWeight="bold">◀</text>
        </g>
      )}
      {phase < 3 && (
        <g transform={`translate(44, ${vh - 32})`} style={{ cursor: 'pointer' }} onClick={stepForward}>
          <rect x={0} y={-14} width={28} height={28} rx={4} fill="var(--accent-teal)" opacity={0.8} />
          <text x={14} y={4} textAnchor="middle" fill="#0f0f1a" fontSize="14" fontWeight="bold">▶</text>
        </g>
      )}

      {/* Phase dots */}
      <g transform={`translate(${vw / 2 - 54}, ${vh - 50})`} style={{ cursor: 'pointer' }}>
        {[0, 1, 2, 3].map(p => (
          <circle key={p} cx={p * 36} cy={0} r={phase === p ? 5 : 3.5}
            fill={phase === p ? 'var(--accent-teal)' : 'var(--border-color)'}
            opacity={phase === p ? 1 : 0.5}
            onClick={() => setPhase(p as Phase)}
          />
        ))}
      </g>
    </svg>
  )
}

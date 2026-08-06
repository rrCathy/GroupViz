import { useMemo, useState, useCallback } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { renderTex, texify } from '../../utils/texify'
import { verifyHomomorphism, getHomomorphismProperties } from '../../core/algebra/homomorphisms'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { COLOR_PALETTE } from '../../core/types'
import type { GroupElement } from '../../core/types'
import { FirstIsomorphismAnimation } from './FirstIsomorphismAnimation'

const HOMO_COLORS = [
  '#4ecdc4', '#a78bfa', '#ffd93d', '#f97316',
  '#38bdf8', '#84cc16', '#f43f5e', '#eab308',
  '#6366f1', '#ec4899', '#14b8a6', '#0ea5e9',
  '#22c55e', '#a855f7', '#06b6d4',
]

const KERNEL_RED = '#ff6b6b'
const IMAGE_CYAN = '#4ecdc4'

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.3
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
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

export function HomomorphismView() {
  const { t } = useTranslation()
  const {
    editingSource,
    editingTarget,
    editingMapping,
    activeHomomorphismId,
    homomorphisms,
    theoremMode,
    setTheoremMode,
  } = useGroup()

  const [hoverSource, setHoverSource] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  const [pinnedSource, setPinnedSource] = useState<string | null>(null)

  const activeHomo = homomorphisms.find(h => h.id === activeHomomorphismId)

  const source = editingSource || activeHomo?.source || null
  const target = editingTarget || activeHomo?.target || null
  const mapping = activeHomo?.mapping || editingMapping

  const result = useMemo(() => {
    if (!source || !target || mapping.size === 0) return null
    return activeHomo?.result || verifyHomomorphism(source, target, mapping)
  }, [source, target, mapping, activeHomo])

  const kernelIds = result?.kernel || []
  const imageIds = result?.image || []

  const properties = result?.isHomomorphism
    ? getHomomorphismProperties(source!, target!, result)
    : null

  const kernelSet = new Set(kernelIds)
  const imageSet = new Set(imageIds)

  const highlightedSource = pinnedSource || hoverSource
  const highlightedTargetId = highlightedSource ? mapping.get(highlightedSource) : hoverTarget

  const highlightPreimageIds = useMemo(() => {
    if (!highlightedTargetId || highlightedSource) return new Set<string>()
    const preimages = new Set<string>()
    mapping.forEach((tgt, src) => {
      if (tgt === highlightedTargetId) preimages.add(src)
    })
    return preimages
  }, [highlightedTargetId, highlightedSource, mapping])

  const handleSourceClick = useCallback((elId: string) => {
    setPinnedSource(prev => prev === elId ? null : elId)
  }, [])

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

  if (!source || !target) {
    return (
      <svg viewBox="0 0 800 500" style={{ width: '100%', height: '100%' }}>
        <text x="400" y="250" textAnchor="middle" fill="var(--text-muted)" fontSize="16">
          {t('homo.selectSourceFirst')}
        </text>
      </svg>
    )
  }

  if (theoremMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 8px' }}>
          <button className="panel-btn"
            onClick={() => setTheoremMode(false)}
            style={{ fontSize: '10px', padding: '3px 8px' }}>
            ← {t('homo.title')}
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <FirstIsomorphismAnimation key={`${source?.symbol}-${target?.symbol}`} />
        </div>
      </div>
    )
  }

  const vw = 800
  const vh = 500
  const leftCx = 170
  const rightCx = 630
  const midY = vh * 0.48

  const srcR = Math.min(140, Math.max(65, source.order * 4.5))
  const tgtR = Math.min(140, Math.max(65, target.order * 4.5))
  const sourcePositions = cayleyCircleLayout(source, leftCx, midY, srcR)
  const targetPositions = cayleyCircleLayout(target, rightCx, midY, tgtR)

  function renderEdge(
    posMap: Map<string, { x: number; y: number }>,
    fromId: string, toId: string, color: string, key: string,
    width = 1.5, opacity = 0.5, selfLoop = false, _isBidirectional = false,
    pairOffset = 0,
  ) {
    const from = posMap.get(fromId)
    const to = posMap.get(toId)
    if (!from || !to) return null
    if (selfLoop) return null
    const dx = to.x - from.x; const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.5) return null
    if (pairOffset === 0) {
      return (
        <line key={key} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
          stroke={color} strokeWidth={width} opacity={opacity} />
      )
    }
    const len = dist || 1
    const nx = -dy / len; const ny = dx / len
    const mx = (from.x + to.x) / 2 + nx * pairOffset
    const my = (from.y + to.y) / 2 + ny * pairOffset
    return (
      <path key={key} d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
        stroke={color} strokeWidth={width} fill="none" opacity={opacity} />
    )
  }

  function buildPairOffsets(edges: { fromId: string; toId: string }[]) {
    const pairMap = new Map<string, number[]>()
    edges.forEach((e, i) => {
      const pair = [e.fromId, e.toId].sort()
      const key = `${pair[0]}|${pair[1]}`
      const arr = pairMap.get(key)
      if (arr) arr.push(i)
      else pairMap.set(key, [i])
    })
    const offsets = new Array<number>(edges.length).fill(0)
    pairMap.forEach((indices) => {
      if (indices.length < 2) return
      const total = indices.length
      indices.forEach((idx, slot) => {
        offsets[idx] = (slot - (total - 1) / 2) * 14
      })
    })
    return offsets
  }

  const mappingLines: {
    srcId: string
    tgtId: string
    color: string
    pathD: string
    isKernel: boolean
    isHighlighted: boolean
  }[] = []

  mapping.forEach((targetId, sourceId) => {
    const from = sourcePositions.get(sourceId)
    const to = targetPositions.get(targetId)
    if (!from || !to) return

    const isKernel = kernelSet.has(sourceId)
    const tgtIdx = target.elements.findIndex(e => e.id === targetId)
    const baseColor = isKernel ? KERNEL_RED : HOMO_COLORS[tgtIdx >= 0 ? tgtIdx % HOMO_COLORS.length : 0]

    const isHL = highlightedSource === sourceId || highlightedTargetId === targetId

    mappingLines.push({
      srcId: sourceId,
      tgtId: targetId,
      color: baseColor,
      pathD: bezierPath(from.x, from.y, to.x, to.y),
      isKernel,
      isHighlighted: !!isHL,
    })
  })

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} style={{ width: '100%', height: '100%' }}>
      {/* Background separator line */}
      <line x1={vw / 2} y1={40} x2={vw / 2} y2={vh - 10}
        stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="4,6" opacity={0.5} />

      {/* Title */}
      <foreignObject x={vw / 2 - 140} y={4} width={280} height={28}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '28px' }}
          dangerouslySetInnerHTML={{ __html: renderTex(texify(activeHomo?.name || `${source.symbol} → ${target.symbol}`)) }} />
      </foreignObject>

      {/* Domain Label */}
      <foreignObject x={leftCx - 70} y={34} width={140} height={22}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '22px' }}
          dangerouslySetInnerHTML={{ __html: `${renderTex(texify(source.symbol))} <span style="color:var(--text-muted);font-weight:400">(|G|=${source.order})</span>` }} />
      </foreignObject>
      {/* Codomain Label */}
      <foreignObject x={rightCx - 70} y={34} width={140} height={22}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '22px' }}
          dangerouslySetInnerHTML={{ __html: `${renderTex(texify(target.symbol))} <span style="color:var(--text-muted);font-weight:400">(|H|=${target.order})</span>` }} />
      </foreignObject>

      {/* ═══ G Cayley edges ═══ */}
      {(() => {
        const gOffsets = buildPairOffsets(gCayleyEdges)
        return gCayleyEdges.map((e, i) =>
          renderEdge(
            sourcePositions, e.fromId, e.toId, e.color, `gce-${i}`,
            1.8, 0.7, e.isSelfLoop, e.isBidirectional, gOffsets[i],
          )
        )
      })()}

      {/* ═══ H Cayley edges ═══ */}
      {(() => {
        const hOffsets = buildPairOffsets(hCayleyEdges)
        return hCayleyEdges.map((e, i) =>
          renderEdge(
            targetPositions, e.fromId, e.toId, e.color, `hce-${i}`,
            1.4, 0.65, e.isSelfLoop, e.isBidirectional, hOffsets[i],
          )
        )
      })()}

      {/* Mapping Lines — layered: non-highlighted first, highlighted on top */}
      {mappingLines.filter(l => !l.isHighlighted).map((line, i) => (
        <path
          key={`nl-${i}`}
          d={line.pathD}
          stroke={line.color}
          strokeWidth={line.isKernel ? 2.0 : 1.0}
          strokeOpacity={line.isKernel ? 0.45 : 0.28}
          fill="none"
        />
      ))}
      {mappingLines.filter(l => l.isHighlighted).map((line, i) => (
        <path
          key={`hl-${i}`}
          d={line.pathD}
          stroke={line.color}
          strokeWidth={2.5}
          strokeOpacity={0.85}
          fill="none"
          style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
        />
      ))}

      {/* Source Nodes */}
      {source.elements.map((el) => {
        const pos = sourcePositions.get(el.id)
        if (!pos) return null
        const inKernel = kernelSet.has(el.id)
        const isMapped = mapping.has(el.id)
        const isHL = highlightedSource === el.id || highlightPreimageIds.has(el.id)
        const isPinned = pinnedSource === el.id
        const dimmed = highlightedSource && !isHL

        let fill = 'var(--node-fill)'
        if (inKernel) fill = KERNEL_RED
        else if (isMapped) {
          const mTgt = mapping.get(el.id)!
          const tgtIdx = target.elements.findIndex(e => e.id === mTgt)
          if (tgtIdx >= 0) fill = HOMO_COLORS[tgtIdx % HOMO_COLORS.length]
        }

        return (
          <g key={`s-${el.id}`}
            onMouseEnter={() => setHoverSource(el.id)}
            onMouseLeave={() => setHoverSource(null)}
            onClick={() => handleSourceClick(el.id)}
            style={{ cursor: 'pointer' }}
          >
            {isHL && (
              <circle cx={pos.x} cy={pos.y} r={18}
                fill="none" stroke={inKernel ? KERNEL_RED : 'var(--accent-teal)'}
                strokeWidth={2} opacity={0.6}
                style={{ filter: 'drop-shadow(0 0 6px currentColor)' }} />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={isMapped ? 13 : 8}
              fill={fill}
              stroke={inKernel ? KERNEL_RED : isMapped ? 'var(--border-color)' : 'var(--border-color)'}
              strokeWidth={inKernel ? 2 : 1}
              opacity={dimmed ? 0.3 : 1}
            />
            {isPinned && (
              <circle cx={pos.x} cy={pos.y} r={15}
                fill="none" stroke="var(--accent-teal)" strokeWidth={2}
                opacity={0.8} />
            )}
            <foreignObject
              x={pos.x - 24} y={pos.y + 6}
              width={48} height={18}
              style={{ overflow: 'visible' }}
            >
              <div style={{
                fontSize: '8px',
                textAlign: 'center',
                color: inKernel ? KERNEL_RED : dimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: inKernel || isHL ? 700 : 400,
                pointerEvents: 'none',
              }} dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
            </foreignObject>
          </g>
        )
      })}

      {/* Target Nodes */}
      {target.elements.map((el) => {
        const pos = targetPositions.get(el.id)
        if (!pos) return null
        const inImage = imageSet.has(el.id)
        const isHL = highlightedTargetId === el.id
        const dimmed = highlightedTargetId && !isHL

        return (
          <g key={`t-${el.id}`}
            onMouseEnter={() => setHoverTarget(el.id)}
            onMouseLeave={() => setHoverTarget(null)}
            style={{ cursor: 'pointer' }}
          >
            {isHL && (
              <circle cx={pos.x} cy={pos.y} r={18}
                fill="none" stroke={IMAGE_CYAN}
                strokeWidth={2} opacity={0.6}
                style={{ filter: 'drop-shadow(0 0 8px currentColor)' }} />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={inImage ? 13 : 8}
              fill={inImage ? IMAGE_CYAN : 'var(--node-fill)'}
              stroke={inImage ? IMAGE_CYAN : 'var(--border-color)'}
              strokeWidth={inImage ? 2 : 1}
              opacity={dimmed ? 0.3 : 1}
            />
            {highlightPreimageIds.size > 0 && isHL && (
              <text x={pos.x} y={pos.y - 18} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                ← {highlightPreimageIds.size}
              </text>
            )}
            <foreignObject
              x={pos.x - 24} y={pos.y + 6}
              width={48} height={18}
              style={{ overflow: 'visible' }}
            >
              <div style={{
                fontSize: '8px',
                textAlign: 'center',
                color: inImage ? IMAGE_CYAN : dimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: inImage || isHL ? 700 : 400,
                pointerEvents: 'none',
              }} dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
            </foreignObject>
          </g>
        )
      })}

      {/* Legend / status line at bottom */}
      <g transform={`translate(0, ${vh - 16})`}>
        {result?.isHomomorphism && properties && (
          <>
            <rect x={leftCx - 50} y={-12} width={100} height={16} rx={3}
              fill={properties.isInjective ? 'rgba(78,205,196,0.15)' : 'rgba(255,107,107,0.1)'} />
            <text x={leftCx} y={0} textAnchor="middle" fontSize="9"
              fill={properties.isInjective ? 'var(--accent-teal)' : KERNEL_RED}>
              {properties.isInjective ? t('homo.injective') : t('homo.notInjective')}
            </text>

            <rect x={vw / 2 - 60} y={-12} width={120} height={16} rx={3}
              fill="rgba(78,205,196,0.08)" />
            <text x={vw / 2} y={0} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              Ker={kernelSet.size}{' '}|{' '}Im={imageSet.size}{' '}|{' '}G/Ker={source.order}/{kernelSet.size}={source.order / (kernelSet.size || 1)}
            </text>

            <rect x={rightCx - 50} y={-12} width={100} height={16} rx={3}
              fill={properties.isSurjective ? 'rgba(78,205,196,0.15)' : 'rgba(255,107,107,0.1)'} />
            <text x={rightCx} y={0} textAnchor="middle" fontSize="9"
              fill={properties.isSurjective ? 'var(--accent-teal)' : KERNEL_RED}>
              {properties.isSurjective ? t('homo.surjective') : t('homo.notSurjective')}
            </text>

            {properties.isIsomorphism && (
              <>
                <rect x={vw / 2 - 40} y={-26} width={80} height={14} rx={3}
                  fill="rgba(78,205,196,0.2)" stroke="var(--accent-teal)" strokeWidth={0.5} />
                <text x={vw / 2} y={-15} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--accent-teal)">
                  {t('homo.isomorphism')}
                </text>
              </>
            )}
          </>
        )}
        {result && !result.isHomomorphism && (
          <text x={vw / 2} y={0} textAnchor="middle" fontSize="10" fill={KERNEL_RED} fontWeight="bold">
            ✗ {t('homo.invalid')}
          </text>
        )}
        {/* Interactive hint */}
        <text x={vw - 10} y={0} textAnchor="end" fontSize="8" fill="var(--text-muted)" opacity={0.6}>
          {t('homo.interactiveHint')}
        </text>
      </g>
    </svg>
  )
}

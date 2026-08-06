import { useMemo, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { useTheme } from '../../theme/useTheme'
import { factorizeOrder, findAllPSubgroups, conjugateSubgroup } from '../../core/algebra/sylow'
import { computeElementOrderInGroup } from '../../core/algebra/subgroups'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { cayleyCircleLayout, cosetStripLayout } from '../../core/algebra/forceLayout'
import { COLOR_PALETTE } from '../../core/types'
import type { CayleyAction, CayleyEdgeData, GroupElement } from '../../core/types'

const sgKeyOf = (sg: { elements: { id: string }[] }) =>
  sg.elements.map(e => e.id).slice().sort().join(',')

export function SylowView() {
  const { currentGroup, selectedElements, selectElement, setHoverElement, canvasTransform, viewBoxSize } = useGroup()
  const { t } = useTranslation()
  const { theme } = useTheme()

  const teal = useMemo(() => theme === 'light'
    ? { pStroke: '#17a398', selFill: '#b6e8e2', selStroke: '#0ea5a0', chipActive: '#0ea5a0' }
    : { pStroke: '#2f8f86', selFill: '#1e3f3f', selStroke: '#4ecdc4', chipActive: '#4ecdc4' }, [theme])

  const purple = useMemo(() => theme === 'light'
    ? { fill: '#ece4fa', stroke: '#a78bfa' }
    : { fill: '#2a2440', stroke: '#a78bfa' }, [theme])

  const gold = useMemo(() => theme === 'light'
    ? { fill: '#fbf3d6', stroke: '#d4a017' }
    : { fill: '#3a3010', stroke: '#ffd93d' }, [theme])

  const elementOrders = useMemo(() => {
    const m = new Map<string, number>()
    if (currentGroup) {
      for (const el of currentGroup.elements) m.set(el.id, computeElementOrderInGroup(el, currentGroup))
    }
    return m
  }, [currentGroup])

  const factors = useMemo(() => (currentGroup ? factorizeOrder(currentGroup.order) : []), [currentGroup])

  const [selection, setSelection] = useState<{ prime: number; ids: string[] } | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)

  const effectivePrime = useMemo(() => {
    if (selection && factors.some(f => f.prime === selection.prime)) return selection.prime
    return factors.length > 0 ? factors[0].prime : null
  }, [selection, factors])

  const pSubgroups = useMemo(() => {
    if (!currentGroup || effectivePrime === null) return []
    return findAllPSubgroups(currentGroup, effectivePrime)
  }, [currentGroup, effectivePrime])

  const isPPowerOrder = (order: number, p: number) => {
    if (order <= 1) return false
    let o = order
    while (o > 1 && o % p === 0) o /= p
    return o === 1
  }

  const { firstIdx, secondIdx } = useMemo(() => {
    let f = -1
    let s = -1
    const ids = selection ? selection.ids : []
    pSubgroups.forEach((sg, i) => {
      const key = sgKeyOf(sg)
      if (key === ids[0]) f = i
      if (key === ids[1]) s = i
    })
    return { firstIdx: f, secondIdx: s }
  }, [pSubgroups, selection])

  const selectedSubgroup = firstIdx >= 0 ? pSubgroups[firstIdx] : null
  const secondSubgroup = secondIdx >= 0 ? pSubgroups[secondIdx] : null
  const twoMode = selectedSubgroup !== null && secondSubgroup !== null && firstIdx !== secondIdx

  const selectedIds = useMemo(() => {
    const s = new Set<string>()
    if (selectedSubgroup) selectedSubgroup.elements.forEach(e => s.add(e.id))
    return s
  }, [selectedSubgroup])

  const pElementCount = useMemo(() => {
    if (effectivePrime === null) return 0
    let c = 0
    elementOrders.forEach(o => { if (isPPowerOrder(o, effectivePrime)) c++ })
    return c
  }, [elementOrders, effectivePrime])

  // ---- layouts ----
  const n = currentGroup?.order ?? 0
  const nodeRadius = 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = Math.min(viewBoxSize.width * 0.3, 180 + n * 10)

  const circLayout = useMemo(() => {
    if (!currentGroup || n === 0) return new Map<string, { x: number; y: number }>()
    return cayleyCircleLayout(currentGroup, cx, cy, graphRadius)
  }, [currentGroup, cx, cy, graphRadius, n])

  // single-subgroup mode: coset strip layout (left cosets of H)
  const cosetStripData = useMemo(() => {
    if (!currentGroup || !selectedSubgroup || twoMode) return null
    return cosetStripLayout(
      currentGroup,
      viewBoxSize.width,
      viewBoxSize.height,
      selectedSubgroup.elements.map(e => e.id),
    )
  }, [currentGroup, selectedSubgroup, twoMode, viewBoxSize])

  // ---- conjugation (Sylow II): find g with g·P·g⁻¹ = Q.
  // Prefer a g that also normalizes P∩Q so the common elements stay put
  // and the conjugation arrows run between the non-common parts only.
  const conjugator = useMemo(() => {
    if (!twoMode || !currentGroup || !selectedSubgroup || !secondSubgroup) return null
    const qKey = sgKeyOf(secondSubgroup)
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))
    const inter = selectedSubgroup.elements.filter(e => qSet.has(e.id))
    const iKey = inter.map(e => e.id).slice().sort().join(',')
    const conjKey = (els: GroupElement[], g: GroupElement) =>
      conjugateSubgroup(currentGroup, els, g).map(e => e.id).slice().sort().join(',')
    for (const g of currentGroup.elements) {
      if (conjKey(selectedSubgroup.elements, g) === qKey && conjKey(inter, g) === iKey) return g
    }
    for (const g of currentGroup.elements) {
      if (conjKey(selectedSubgroup.elements, g) === qKey) return g
    }
    return null
  }, [twoMode, currentGroup, selectedSubgroup, secondSubgroup])

  // two-subgroup mode: P on top, Q on bottom, P∩Q in the middle.
  // Columns are interleaved (common at even columns, P\I pairs at odd
  // columns) so the vertical conjugation arrows never pass through the
  // common elements while staying symmetric.
  const twoRowGap = Math.min(viewBoxSize.height * 0.22, 150)
  const twoLayout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>()
    if (!twoMode || !currentGroup || !selectedSubgroup || !secondSubgroup) return positions
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))
    const inter = selectedSubgroup.elements.filter(e => qSet.has(e.id)).map(e => e.id)
    const iSet = new Set(inter)
    const top = selectedSubgroup.elements.filter(e => !iSet.has(e.id)).map(e => e.id)
    let bottom: { from: string; to: string | null }[] = []
    if (conjugator) {
      bottom = top.map(x => {
        const y = conjugateSubgroup(currentGroup, [currentGroup.elements.find(el => el.id === x)!], conjugator)[0]
        return { from: x, to: y && !iSet.has(y.id) ? y.id : null }
      })
    } else {
      bottom = secondSubgroup.elements.filter(e => !iSet.has(e.id)).map(e => ({ from: '', to: e.id }))
    }
    const other = currentGroup.elements.filter(e => !iSet.has(e.id) && !top.includes(e.id) && !bottom.some(b => b.to === e.id)).map(e => e.id)
    const margin = 90
    const usableW = viewBoxSize.width - margin * 2
    const cyMid = viewBoxSize.height / 2
    const nTop = top.length
    const nI = inter.length
    const step = usableW / Math.max(1, nTop + nI)
    // interleaved column assignment
    const commonCols: number[] = []
    const topCols: number[] = []
    const pairs = Math.min(nTop, nI)
    for (let i = 0; i < pairs; i++) {
      commonCols.push(i * 2)
      topCols.push(i * 2 + 1)
    }
    let nextCol = pairs * 2
    for (let i = pairs; i < nI; i++) commonCols.push(nextCol++)
    for (let i = pairs; i < nTop; i++) topCols.push(nextCol++)
    const xOf = (col: number) => margin + step * col + step / 2
    inter.forEach((id, i) => positions.set(id, { x: xOf(commonCols[i]), y: cyMid }))
    top.forEach((id, i) => positions.set(id, { x: xOf(topCols[i]), y: cyMid - twoRowGap * 2 }))
    if (conjugator) {
      bottom.forEach((b, i) => {
        if (b.to) positions.set(b.to, { x: xOf(topCols[i]), y: cyMid + twoRowGap * 2 })
      })
    } else {
      const s = usableW / Math.max(1, secondSubgroup.elements.filter(e => !iSet.has(e.id)).length)
      secondSubgroup.elements.filter(e => !iSet.has(e.id)).forEach((e, i) =>
        positions.set(e.id, { x: margin + s * i + s / 2, y: cyMid + twoRowGap * 2 }))
    }
    const s2 = usableW / Math.max(1, other.length)
    other.forEach((id, i) => positions.set(id, { x: margin + s2 * i + s2 / 2, y: cyMid + twoRowGap * 4 }))
    return positions
  }, [twoMode, currentGroup, selectedSubgroup, secondSubgroup, conjugator, viewBoxSize, twoRowGap])

  const layoutMode = twoMode ? 'two' : selectedSubgroup ? 'coset' : 'circle'

  const posOf = (id: string) => {
    if (layoutMode === 'two') return twoLayout.get(id)
    if (layoutMode === 'coset') return cosetStripData?.positions.get(id)
    return circLayout.get(id)
  }

  // ---- conjugation (Sylow II): find g with g·P·g⁻¹ = Q ----
  const conjArrows = useMemo(() => {
    if (!twoMode || !currentGroup || !selectedSubgroup || !secondSubgroup || !conjugator) return []
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))
    const iSet = new Set(selectedSubgroup.elements.filter(e => qSet.has(e.id)).map(e => e.id))
    return selectedSubgroup.elements
      .filter(x => !iSet.has(x.id))
      .map(x => {
        const y = conjugateSubgroup(currentGroup, [x], conjugator)[0]
        return { from: x.id, to: y && !iSet.has(y.id) ? y.id : null }
      }).filter(a => a.to !== null) as { from: string; to: string }[]
  }, [twoMode, currentGroup, selectedSubgroup, secondSubgroup, conjugator])

  // ---- edge action set ----
  const edgeActions = useMemo<CayleyAction[]>(() => {
    if (!currentGroup) return []
    if (twoMode) return []
    if (selectedSubgroup) {
      return selectedSubgroup.generators.map((g, i) => ({
        elementId: g.id,
        enabled: true,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      }))
    }
    return currentGroup.generators.map((gen, i) => {
      const el = gen.apply(currentGroup.identity)
      return {
        elementId: el?.id || currentGroup.elements[0].id,
        enabled: true,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      }
    })
  }, [currentGroup, selectedSubgroup, twoMode])

  const enabledActions = edgeActions.filter(a => a.enabled)

  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    edgeActions.forEach((a, idx) => { if (a.enabled) m.set(a.elementId, idx) })
    return m
  }, [edgeActions])

  const edges = useMemo(
    () => currentGroup ? computeCayleyActionEdges(currentGroup, edgeActions, 'right') : [],
    [currentGroup, edgeActions]
  )

  // two-subgroup mode: draw P's generator edges (teal) and Q's (purple)
  const subgroupEdges = useMemo<{ edges: CayleyEdgeData[]; color: string; markerId: string }[]>(() => {
    if (!twoMode || !currentGroup || !selectedSubgroup || !secondSubgroup) return []
    const mkActions = (gens: { id: string }[], color: string): CayleyAction[] =>
      gens.map(g => ({ elementId: g.id, enabled: true, color }))
    const pSet = new Set(selectedSubgroup.elements.map(e => e.id))
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))
    const pColor = teal.pStroke
    const qColor = purple.stroke
    const pEdges = computeCayleyActionEdges(currentGroup, mkActions(selectedSubgroup.generators, pColor), 'right')
      .filter(e => pSet.has(e.fromId) && pSet.has(e.toId))
    const qEdges = computeCayleyActionEdges(currentGroup, mkActions(secondSubgroup.generators, qColor), 'right')
      .filter(e => qSet.has(e.fromId) && qSet.has(e.toId))
    return [
      { edges: pEdges, color: pColor, markerId: 'sylow-p-edge' },
      { edges: qEdges, color: qColor, markerId: 'sylow-q-edge' },
    ]
  }, [twoMode, currentGroup, selectedSubgroup, secondSubgroup, teal, purple])

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const isLarge = currentGroup.order > 60

  const factor = effectivePrime !== null ? factors.find(f => f.prime === effectivePrime) : null
  const pPower = factor ? Math.pow(factor.prime, factor.exponent) : 0
  const m = factor ? currentGroup.order / pPower : 0
  const sylowCount = pSubgroups.filter(s => s.isSylow).length
  const otherSubgroups = pSubgroups.filter(sg => !sg.isSylow)
  const otherCount = pSubgroups.length - sylowCount

  const isNodeOnScreen = (px: number, py: number) => {
    if (!isLarge) return true
    const sx = px * canvasTransform.scale + canvasTransform.x
    const sy = py * canvasTransform.scale + canvasTransform.y
    const mm = nodeRadius * canvasTransform.scale * 1.5
    return sx + mm > 0 && sx - mm < viewBoxSize.width &&
           sy + mm > 0 && sy - mm < viewBoxSize.height
  }

  const handleChipClick = (sg: { elements: { id: string }[] }, e: React.MouseEvent) => {
    const key = sgKeyOf(sg)
    const ctrl = e.ctrlKey || e.metaKey
    const prime = effectivePrime
    if (prime === null) return
    setSelection(prev => {
      const ids = prev && prev.prime === prime ? prev.ids : []
      if (ctrl) {
        if (ids.includes(key)) return { prime, ids: ids.filter(k => k !== key) }
        if (ids.length >= 2) return { prime, ids: [ids[0], key] }
        return { prime, ids: [...ids, key] }
      }
      if (ids.length === 1 && ids[0] === key) return { prime, ids: [] }
      return { prime, ids: [key] }
    })
  }

  const edgeElements = edges.map((edge: CayleyEdgeData) => {
    const fromPos = posOf(edge.fromId)
    const toPos = posOf(edge.toId)
    if (!fromPos || !toPos) return null

    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const isHighlighted = selectedElements.has(edge.fromId) || selectedElements.has(edge.toId)
    const baseColor = edge.color
    const color = isHighlighted ? baseColor : `${baseColor}99`

    if (edge.isSelfLoop) {
      const scx = fromPos.x
      const scy = fromPos.y - nodeRadius - 20
      return (
        <g key={`${edge.fromId}-${edge.actionElementId}`}>
          <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={isHighlighted ? 3.5 : 2.5} />
          <polygon points={`${scx - 5},${scy - 2} ${scx + 5},${scy - 2} ${scx},${scy - 14}`} fill={baseColor} />
        </g>
      )
    }

    const midX = (fromPos.x + toPos.x) / 2
    const midY = (fromPos.y + toPos.y) / 2
    const nx = -dy / dist
    const ny = dx / dist

    const curvature = Math.min(dist * 0.08, 18)
    const ctrlX = midX + nx * curvature
    const ctrlY = midY + ny * curvature

    const startX = fromPos.x + (dx / dist) * nodeRadius
    const startY = fromPos.y + (dy / dist) * nodeRadius
    const endX = toPos.x - (dx / dist) * nodeRadius
    const endY = toPos.y - (dy / dist) * nodeRadius

    const actionIdx = enabledActionIndexMap.get(edge.actionElementId)
    const markerId = actionIdx !== undefined ? `sylow-arrow-${actionIdx}` : undefined

    return (
      <path
        key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
        d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
        stroke={color}
        strokeWidth={isHighlighted ? 3.5 : 2.5}
        fill="none"
        markerEnd={edge.isBidirectional || !markerId ? undefined : `url(#${markerId})`}
        opacity={0.9}
      />
    )
  })

  const subgroupEdgeElements = subgroupEdges.flatMap(({ edges: subEdges, markerId }, gi) =>
    subEdges.map((edge, i) => {
      const fromPos = posOf(edge.fromId)
      const toPos = posOf(edge.toId)
      if (!fromPos || !toPos) return null
      const dx = toPos.x - fromPos.x
      const dy = toPos.y - fromPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const color = `${edge.color}bb`
      if (edge.isSelfLoop) {
        const scx = fromPos.x
        const scy = fromPos.y - nodeRadius - 20
        return (
          <g key={`sg-${gi}-${i}`}>
            <ellipse cx={scx} cy={scy} rx={14} ry={12} fill="none" stroke={color} strokeWidth={2} />
          </g>
        )
      }
      if (dist < 1) return null
      const midX = (fromPos.x + toPos.x) / 2
      const midY = (fromPos.y + toPos.y) / 2
      const nx = -dy / dist
      const ny = dx / dist
      const curvature = Math.min(dist * 0.08, 18)
      const ctrlX = midX + nx * curvature
      const ctrlY = midY + ny * curvature
      const startX = fromPos.x + (dx / dist) * nodeRadius
      const startY = fromPos.y + (dy / dist) * nodeRadius
      const endX = toPos.x - (dx / dist) * nodeRadius
      const endY = toPos.y - (dy / dist) * nodeRadius
      return (
        <path
          key={`sg-${gi}-${i}`}
          d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
          stroke={color}
          strokeWidth={2}
          fill="none"
          markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
          opacity={0.9}
        />
      )
    })
  )

  const conjArrowElements = conjArrows.map((a, i) => {
    const fromPos = posOf(a.from)
    const toPos = posOf(a.to)
    if (!fromPos || !toPos) return null
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return null
    const startX = fromPos.x + (dx / dist) * nodeRadius
    const startY = fromPos.y + (dy / dist) * nodeRadius
    const endX = toPos.x - (dx / dist) * nodeRadius
    const endY = toPos.y - (dy / dist) * nodeRadius
    return (
      <path
        key={`conj-${i}`}
        d={`M ${startX} ${startY} L ${endX} ${endY}`}
        stroke={gold.stroke}
        strokeWidth={2.5}
        fill="none"
        markerEnd="url(#sylow-conj-arrow)"
        markerStart="url(#sylow-conj-arrow-start)"
        opacity={0.85}
      />
    )
  })

  const conjLabel = conjugator && selectedSubgroup ? (
    <g>
      <text
        x={viewBoxSize.width / 2}
        y={viewBoxSize.height / 2 - twoRowGap}
        textAnchor="middle"
        fill={gold.stroke}
        fontSize={15}
        fontWeight={600}
        opacity={0.9}
        style={{ fontFamily: 'KaTeX_Main, monospace', fontStyle: 'italic' }}
      >{`${t('sylowView.conjLabel')}: g = ${conjugator.label}`}</text>
    </g>
  ) : null

  const stripElements = cosetStripData && cosetStripData.strips.map((strip, si) => (
    <g key={`sylow-strip-${si}`}>
      <rect
        x={strip.x}
        y={strip.y}
        width={strip.w}
        height={strip.h}
        rx={8}
        fill={strip.color + (strip.isSubgroup ? '18' : '10')}
        stroke={strip.isSubgroup ? strip.color + '55' : strip.color + '28'}
        strokeWidth={strip.isSubgroup ? 2 : 1}
        strokeDasharray={strip.isSubgroup ? undefined : '4 6'}
      />
      <text
        x={strip.x + strip.w / 2}
        y={strip.y - 10}
        textAnchor="middle"
        fill={strip.color}
        fontSize={13}
        fontWeight={strip.isSubgroup ? 700 : 400}
        opacity={0.85}
        style={{ fontFamily: 'KaTeX_Main, monospace', fontStyle: 'italic' }}
      >{strip.label}</text>
    </g>
  ))

  const stripTheorem = cosetStripData && cosetStripData.strips.length > 0 ? (
    <text
      x={viewBoxSize.width / 2}
      y={viewBoxSize.height - 14}
      textAnchor="middle"
      fill="#999"
      fontSize={12}
      opacity={0.7}
      style={{ fontFamily: 'KaTeX_Main, monospace' }}
    >{`|G|=${currentGroup.order} = ${cosetStripData.strips[0].elementIds.length}\u00b7${cosetStripData.strips.length}   |H|\u00b7[G:H]`}</text>
  ) : null

  return (
    <div className="sylow-view-wrap" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="sylow-view-toolbar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--border-primary)' }}>
        <span className="settings-label">{t('sylowView.selectP')}</span>
        {factors.map(f => (
          <button
            key={f.prime}
            className={`toggle-btn ${effectivePrime === f.prime ? 'active' : ''}`}
            onClick={() => setSelection({ prime: f.prime, ids: [] })}
          >
            p = {f.prime}
          </button>
        ))}
        <span className="sylow-view-edgeaction" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {twoMode ? (
            <>
              {t('sylowView.conjLabel')}:{' '}
              {conjugator ? (
                <span dangerouslySetInnerHTML={{
                  __html: renderTex(texify(`${conjugator.label} \\, P \\, ${conjugator.label}^{-1} = Q`))
                }} />
              ) : (
                t('sylowView.noConjugator')
              )}
            </>
          ) : (
            <>
              {t('sylowView.edgeAction')}:{' '}
              {selectedSubgroup ? (
                <span dangerouslySetInnerHTML={{
                  __html: renderTex(texify(`\\langle ${selectedSubgroup.generators.map(g => g.label).join(', ')} \\rangle`))
                }} />
              ) : (
                t('sylowView.edgeActionDefault')
              )}
            </>
          )}
        </span>
        {factor && (
          <span
            className="sylow-view-stats"
            style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}
            dangerouslySetInnerHTML={{
              __html:
                `${t('sylowView.pElements')}: ${pElementCount} · ` +
                `${t('sylowView.pSubgroups')}: ${pSubgroups.length} · n<sub>p</sub> = ${sylowCount} · ` +
                renderTex(texify(`|G| = ${factor.prime}^{${factor.exponent}} \\cdot ${m}`))
            }}
          />
        )}
      </div>
      <div className="sylow-view-main" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} className="view-svg" style={{ flex: 1, userSelect: 'none' }}>
          <defs>
            {!isLarge && (
              <filter id="sylow-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
              </filter>
            )}
            {enabledActions.map((action, idx) => (
              <marker key={idx} id={`sylow-arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
              </marker>
            ))}
            <marker id="sylow-conj-arrow" markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={gold.stroke} />
            </marker>
            <marker id="sylow-conj-arrow-start" markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto-start-reverse" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={gold.stroke} />
            </marker>
            <marker id="sylow-p-edge" markerWidth={9} markerHeight={9} refX={8} refY={2.5} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L8,2.5 z" fill={teal.pStroke} />
            </marker>
            <marker id="sylow-q-edge" markerWidth={9} markerHeight={9} refX={8} refY={2.5} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L8,2.5 z" fill={purple.stroke} />
            </marker>
          </defs>
          <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
            {stripElements}
            {conjLabel}
            {subgroupEdgeElements}
            {conjArrowElements}
            {edgeElements}
            {stripTheorem}

            {currentGroup.elements.map((el) => {
              const pos = posOf(el.id) || { x: cx, y: cy }
              if (!isNodeOnScreen(pos.x, pos.y)) return null
              const isSelected = selectedElements.has(el.id)
              const inSubgroup = selectedIds.has(el.id)
              const isPElement = effectivePrime !== null && isPPowerOrder(elementOrders.get(el.id) ?? 1, effectivePrime)

              let fillColor = 'var(--node-fill)'
              let strokeColor = 'var(--node-stroke)'
              let strokeWidth = 2.5
              let groupOpacity = 1

              if (isSelected) {
                fillColor = 'var(--node-fill-selected)'
                strokeColor = '#ffd93d'
                strokeWidth = 3
              } else if (twoMode && selectedSubgroup && secondSubgroup) {
                const pSet = new Set(selectedSubgroup.elements.map(e => e.id))
                const qSet = new Set(secondSubgroup.elements.map(e => e.id))
                if (pSet.has(el.id) && qSet.has(el.id)) {
                  fillColor = gold.fill
                  strokeColor = gold.stroke
                  strokeWidth = 3
                } else if (pSet.has(el.id)) {
                  fillColor = teal.selFill
                  strokeColor = teal.selStroke
                  strokeWidth = 3
                } else if (qSet.has(el.id)) {
                  fillColor = purple.fill
                  strokeColor = purple.stroke
                  strokeWidth = 3
                } else if (isPElement) {
                  strokeColor = teal.pStroke
                  strokeWidth = 2.5
                } else {
                  groupOpacity = 0.3
                }
              } else if (inSubgroup) {
                fillColor = teal.selFill
                strokeColor = teal.selStroke
                strokeWidth = 3
              } else if (isPElement) {
                strokeColor = teal.pStroke
                strokeWidth = 2.5
              } else {
                groupOpacity = 0.45
              }

              return (
                <g
                  key={el.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={groupOpacity}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectElement(el.id, e.ctrlKey || e.metaKey)
                  }}
                  onMouseEnter={() => setHoverElement(el)}
                  onMouseLeave={() => setHoverElement(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={nodeRadius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    filter={isLarge ? undefined : "url(#sylow-node-shadow)"}
                  />
                  {(!isLarge || isSelected || selectedElements.size === 0) && (
                    <foreignObject
                      x={-nodeRadius}
                      y={-16}
                      width={nodeRadius * 2}
                      height={32}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLarge ? '10px' : '15px'
                        }}
                        dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
                      />
                    </foreignObject>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {!listCollapsed && (
        <div className="sylow-view-list" style={{ width: 250, flexShrink: 0, borderLeft: '1px solid var(--border-primary)', overflowY: 'auto', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
            <button
              title={t('sylowView.collapseList')}
              onClick={() => setListCollapsed(true)}
              style={{ background: 'none', border: '1px solid var(--border-primary)', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', padding: '1px 6px' }}
            >
              ▶
            </button>
          </div>
          <div className="sylow-view-section-title" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            {t('sylowView.sylowSubgroups')} ({sylowCount})
          </div>
          <div className="sylow-view-hint" style={{ fontSize: 11, color: teal.pStroke, fontWeight: 600, marginBottom: 8, background: teal.selFill, borderRadius: 4, padding: '3px 6px' }}>
            {t('sylowView.twoSelectHint')}
          </div>
          <div className="sylow-view-hint" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {t('sylowView.edgeHint')}
          </div>
          {sylowCount === 0 && pSubgroups.length === 0 && (
            <div className="sylow-view-empty" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
              {t('sylowView.none')}
            </div>
          )}
          {pSubgroups.filter(sg => sg.isSylow).map((sg, idx) => {
            const sgKey = sgKeyOf(sg)
            const active = (selection?.ids ?? []).includes(sgKey)
            return (
              <button
                key={idx}
                className={`panel-btn ${active ? 'active-coset' : ''}`}
                onClick={(e) => handleChipClick(sg, e)}
                title={sg.generators.map(g => g.label).join(', ')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginBottom: 4,
                  fontSize: 12, padding: '4px 8px', textAlign: 'left',
                  border: active ? `1.5px solid ${teal.chipActive}` : undefined,
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: renderTex(texify(`|H| = ${factor ? `${factor.prime}^{${Math.round(Math.log(sg.order) / Math.log(factor.prime))}}` : sg.order}`)) }} />
                <span dangerouslySetInnerHTML={{ __html: renderTex(texify(`\\langle ${sg.generators.map(g => g.label).join(', ')} \\rangle`)) }} />
                {sg.isSylow && <span className="sylow-star" style={{ color: teal.chipActive }}>★</span>}
                {sg.isNormal && <span className="sylow-normal" style={{ color: 'var(--text-muted)' }}>◁</span>}
                <span
                  role="button"
                  title={t('sylowView.addSecond')}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChipClick(sg, { ctrlKey: true, metaKey: false } as React.MouseEvent)
                  }}
                  style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: active ? 'var(--text-secondary)' : teal.pStroke, cursor: 'pointer', padding: '0 2px' }}
                >⊕</span>
              </button>
            )
          })}

          <button
            className="sylow-view-section-title"
            onClick={() => setOtherOpen(o => !o)}
            style={{ fontWeight: 600, fontSize: 13, margin: '12px 0 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'block', width: '100%', textAlign: 'left', padding: 0 }}
          >
            {otherOpen ? '▾' : '▸'} {t('sylowView.otherPSubgroups')} ({otherCount})
          </button>
          {otherOpen && otherSubgroups.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {otherSubgroups.map((sg, idx) => {
                const sgKey = sgKeyOf(sg)
                const active = (selection?.ids ?? []).includes(sgKey)
                return (
                  <button
                    key={`o-${idx}`}
                    className={`panel-btn ${active ? 'active-coset' : ''}`}
                    onClick={(e) => handleChipClick(sg, e)}
                    title={sg.generators.map(g => g.label).join(', ')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginBottom: 4,
                      fontSize: 12, padding: '4px 8px', textAlign: 'left',
                      border: active ? `1.5px solid ${teal.chipActive}` : undefined,
                    }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: renderTex(texify(`|H| = ${factor ? `${factor.prime}^{${Math.round(Math.log(sg.order) / Math.log(factor.prime))}}` : sg.order}`)) }} />
                    <span dangerouslySetInnerHTML={{ __html: renderTex(texify(`\\langle ${sg.generators.map(g => g.label).join(', ')} \\rangle`)) }} />
                    {sg.isNormal && <span className="sylow-normal" style={{ color: 'var(--text-muted)' }}>◁</span>}
                    <span
                      role="button"
                      title={t('sylowView.addSecond')}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChipClick(sg, { ctrlKey: true, metaKey: false } as React.MouseEvent)
                      }}
                      style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: active ? 'var(--text-secondary)' : teal.pStroke, cursor: 'pointer', padding: '0 2px' }}
                    >⊕</span>
                  </button>
                )
              })}
            </div>
          )}
          {otherOpen && otherSubgroups.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{t('sylowView.none')}</div>
          )}
          <div className="sylow-view-legend" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {twoMode ? (
              <>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: teal.selFill, border: `2px solid ${teal.selStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendP2')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: purple.fill, border: `2px solid ${purple.stroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendQ2')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: gold.fill, border: `2px solid ${gold.stroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendI2')}</div>
                <div><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px solid ${gold.stroke}`, marginRight: 6, verticalAlign: 4 }} />{t('sylowView.legendConj')}</div>
              </>
            ) : (
              <>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: teal.selFill, border: `2px solid ${teal.selStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendSelected')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: 'var(--node-fill)', border: `2px solid ${teal.pStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendP')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: 'var(--node-fill)', border: '2px solid var(--node-stroke)', opacity: 0.4, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendOther')}</div>
                <div><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid #ff6b6b', marginRight: 6, verticalAlign: 4 }} />{t('sylowView.legendEdges')}</div>
              </>
            )}
          </div>
        </div>
        )}
        {listCollapsed && (
          <div style={{ width: 30, flexShrink: 0, borderLeft: '1px solid var(--border-primary)', padding: '6px 4px' }}>
            <button
              title={t('sylowView.expandList')}
              onClick={() => setListCollapsed(false)}
              style={{ width: '100%', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 0' }}
            >
              ◀
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { renderTex, texify } from '../../utils/texify'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { COLOR_PALETTE } from '../../core/types'
import { ringOrder } from '../../core/algebra/forceLayout'
import type { Group, GroupElement, CayleyEdgeData } from '../../core/types'

const VIEW_W = 1000
const VIEW_H = 660
const NODE_R = 20
const OUTER_R = 26
const STEP_DUR = 1000

const HOMO_COLORS = [
  '#4ecdc4', '#a78bfa', '#ffd93d', '#f97316',
  '#38bdf8', '#84cc16', '#f43f5e', '#eab308',
  '#6366f1', '#ec4899', '#14b8a6', '#0ea5e9',
  '#22c55e', '#a855f7', '#06b6d4',
]

type ActionDef = { elementId: string; enabled: boolean; color: string }

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function circularLayout(g: Group, cx: number, cy: number, r: number) {
  const m = new Map<string, { x: number; y: number }>()
  const keys = g.elements.map(e => e.id)
  const order = ringOrder(keys)
  const idxMap = new Map(order.map((k, i) => [k, i]))
  g.elements.forEach((el) => {
    const idx = idxMap.get(el.id) ?? 0
    const a = (idx * 2 * Math.PI / g.order) - Math.PI / 2
    m.set(el.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  })
  return m
}

function cayEdges(g: Group, pos: Map<string, { x: number; y: number }>, nr: number) {
  const genEls = findGeneratorElements(g)
  if (genEls.length === 0) return []
  const acts = genEls.map((el, i) => ({
    elementId: el.id, enabled: true,
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }))
  const es = computeCayleyActionEdges(g, acts, 'right')
  return es.filter(e => !e.isSelfLoop).map(e => {
    const fp = pos.get(e.fromId); const tp = pos.get(e.toId)
    if (!fp || !tp) return null
    const dx = tp.x - fp.x; const dy = tp.y - fp.y; const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 1) return null
    return {
      id: e.fromId + '-' + e.toId + '-' + e.actionElementId,
      path: 'M ' + (fp.x + (dx / d) * nr) + ' ' + (fp.y + (dy / d) * nr) + ' Q ' + ((fp.x + tp.x) / 2) + ' ' + ((fp.y + tp.y) / 2 - Math.min(14, d * 0.2)) + ' ' + (tp.x - (dx / d) * nr) + ' ' + (tp.y - (dy / d) * nr),
      color: e.color,
    }
  }).filter(Boolean) as Array<{ id: string; path: string; color: string }>
}

function findGeneratorElements(g: Group): GroupElement[] {
  const result: GroupElement[] = []
  for (const gen of g.generators) {
    let el = g.elements.find(e => e.label === gen.symbol || e.label === gen.name)
    if (!el) {
      const image = gen.apply(g.identity)
      el = g.elements.find(e => e.id === image.id)
    }
    if (el) result.push(el)
  }
  return result
}

export function SemidirectProductView() {
  const { t } = useTranslation()
  const {
    sdNormalSubgroup: N, sdActingGroup: G, sdAutNGroup: autH,
    sdPhiFullMap, executeSemidirectProduct,
    setCurrentGroup, setCurrentView,
    storeSemidirectProductGroup, toggleSemidirectProductMode,
    setHintMessage,
  } = useGroup()

  const [step, setStep] = useState(0)
  const [p, setP] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [productG, setProductG] = useState<Group | null>(null)
  const [created, setCreated] = useState(false)
  const lastSourceKey = useRef<string>('')

  useEffect(() => {
    const key = `${G?.symbol ?? ''}|${N?.symbol ?? ''}`
    if (lastSourceKey.current !== '' && lastSourceKey.current !== key) {
      setCreated(false)
      setProductG(null)
      setStep(0)
      setP(0)
      setAutoplay(true)
    }
    lastSourceKey.current = key
  }, [G, N])

  const phiMap = sdPhiFullMap

  const phiImageSet = useMemo(() => {
    const s = new Set<string>()
    if (phiMap) for (const [, auto] of phiMap) s.add(auto.id)
    return s
  }, [phiMap])

  const phiAutoMap = useMemo(() => {
    const m = new Map<string, string>()
    if (phiMap && autH) {
      for (const [gId, auto] of phiMap) {
        const autEl = autH.elements.find(e => e.id === auto.id)
        if (autEl) m.set(gId, autEl.id)
      }
    }
    return m
  }, [phiMap, autH])

  const gCx = VIEW_W * 0.26
  const autCx = VIEW_W * 0.74
  const midY = VIEW_H * 0.45
  const gR = G ? Math.min(160, Math.max(70, G.order * 12)) : 80
  const autR = autH ? Math.min(170, Math.max(75, autH.order * 12)) : 80

  const gPos = useMemo(() => G ? circularLayout(G, gCx, midY, gR) : new Map(), [G, gCx, midY, gR])
  const autPos = useMemo(() => autH ? circularLayout(autH, autCx, midY, autR) : new Map(), [autH, autCx, midY, autR])
  const gCayleyEdges = useMemo(() => G ? cayEdges(G, gPos, NODE_R) : [], [G, gPos])
  const autCayleyEdges = useMemo(() => autH ? cayEdges(autH, autPos, NODE_R) : [], [autH, autPos])

  // ---- 教学动画布局（定义 8.9：H 凯莱图 → 结点膨胀 → 对应结点连接）----
  const cx = VIEW_W / 2
  const cy = VIEW_H / 2 - 10
  const rN = N ? Math.min(64, Math.max(44, N.order * 6)) : 44
  const nR = N ? Math.max(4, Math.min(11, 170 / N.order)) : 5
  const expandR = OUTER_R + rN + nR + 12
  const rH = G
    ? Math.min(250, Math.max(160, G.order * 26, Math.ceil((expandR + 14) / Math.sin(Math.PI / G.order))))
    : 160

  const hPos = useMemo(() => G ? circularLayout(G, cx, cy, rH) : new Map(), [G, cx, cy, rH])

  const hColorMap = useMemo(() => {
    const m = new Map<string, string>()
    if (G) G.elements.forEach((el, i) => m.set(el.id, HOMO_COLORS[i % HOMO_COLORS.length]))
    return m
  }, [G])

  const prodPos = useMemo(() => {
    if (!productG || !N) return new Map()
    const m = new Map<string, { x: number; y: number }>()
    const nIdx = new Map(ringOrder(N.elements.map(e => e.id)).map((k, i) => [k, i]))
    productG.elements.forEach(el => {
      const sep = el.id.indexOf('|')
      if (sep < 0) return
      const nId = el.id.slice(0, sep)
      const hc = hPos.get(el.id.slice(sep + 1))
      if (!hc) return
      const i = nIdx.get(nId) ?? 0
      const a = (i * 2 * Math.PI / N.order) - Math.PI / 2
      m.set(el.id, { x: hc.x + rN * Math.cos(a), y: hc.y + rN * Math.sin(a) })
    })
    return m
  }, [productG, N, hPos, rN])

  const splitGenActions = useMemo(() => {
    const empty: ActionDef[] = []
    if (!productG || !N) return { n: empty, h: empty }
    const all: ActionDef[] = productG.generators.map((gen, i) => ({
      elementId: gen.apply(productG.identity).id, enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }))
    const nCount = N.generators.length
    return { n: all.slice(0, nCount), h: all.slice(nCount) }
  }, [productG, N])

  const hSkeletonRaw = useMemo(() => {
    if (!G) return []
    const genEls = findGeneratorElements(G)
    if (genEls.length === 0) return []
    const acts = genEls.map((el, i) => ({
      elementId: el.id, enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }))
    return computeCayleyActionEdges(G, acts, 'right').filter(e => !e.isSelfLoop)
  }, [G])

  const nRawEdges = useMemo(() => {
    if (!productG || splitGenActions.n.length === 0) return []
    return computeCayleyActionEdges(productG, splitGenActions.n, 'right').filter(e => !e.isSelfLoop)
  }, [productG, splitGenActions])

  const hRawEdges = useMemo(() => {
    if (!productG || splitGenActions.h.length === 0) return []
    return computeCayleyActionEdges(productG, splitGenActions.h, 'right').filter(e => !e.isSelfLoop)
  }, [productG, splitGenActions])

  const k = ease(p)

  useEffect(() => {
    if (!created) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / STEP_DUR)
      setP(t)
      if (t >= 1) {
        if (autoplay && step < 3) {
          setP(0)
          setStep(s => Math.min(3, s + 1))
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [created, step, autoplay])

  function handleStart() {
    const prod = executeSemidirectProduct()
    if (!prod) return
    flushSync(() => {
      setProductG(prod)
      setCreated(true)
      setStep(0)
      setP(0)
      setAutoplay(true)
    })
  }

  function handleFinish() {
    if (productG) {
      storeSemidirectProductGroup(productG)
      toggleSemidirectProductMode()
      setCurrentGroup(productG)
      setCurrentView('cayley')
      setHintMessage(
        t('sd.created', { symbol: productG.symbol, order: productG.order })
          .replace(productG.symbol, '<span class="hint-highlight">' + productG.symbol + '</span>')
      )
    }
  }

  function gotoStep(s: number) {
    setAutoplay(false)
    setStep(s)
    setP(0)
  }

  function animPos(id: string): { x: number; y: number } | null {
    const pp = prodPos.get(id)
    if (!pp) return null
    const sep = id.indexOf('|')
    const hc = hPos.get(id.slice(sep + 1))
    if (!hc) return null
    const kk = step === 1 ? k : 1
    return { x: hc.x + (pp.x - hc.x) * kk, y: hc.y + (pp.y - hc.y) * kk }
  }

  function renderEdgeLayer(raw: CayleyEdgeData[], kind: 'skeleton' | 'n' | 'h', opacity: number, keyPrefix: string) {
    return raw.map((e, i) => {
      const fp = kind === 'skeleton' ? hPos.get(e.fromId) : animPos(e.fromId)
      const tp = kind === 'skeleton' ? hPos.get(e.toId) : animPos(e.toId)
      if (!fp || !tp) return null
      const dx = tp.x - fp.x; const dy = tp.y - fp.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 1) return null
      const inset = kind === 'skeleton' ? OUTER_R + 2 : nR + 1
      const ux = dx / d; const uy = dy / d
      const x1 = fp.x + ux * inset; const y1 = fp.y + uy * inset
      const x2 = tp.x - ux * inset; const y2 = tp.y - uy * inset
      let mx = (x1 + x2) / 2; let my = (y1 + y2) / 2
      if (kind === 'n') {
        const hc = hPos.get(e.fromId.slice(e.fromId.indexOf('|') + 1))
        let ox = 1; let oy = 0
        if (hc) {
          const l = Math.sqrt((mx - hc.x) ** 2 + (my - hc.y) ** 2)
          if (l > 0.001) { ox = (mx - hc.x) / l; oy = (my - hc.y) / l }
        }
        const c = Math.min(8, d * 0.25)
        mx += ox * c; my += oy * c
      } else {
        const c = Math.min(14, d * 0.12)
        mx += -uy * c; my += ux * c
      }
      const path = 'M ' + x1 + ' ' + y1 + ' Q ' + mx + ' ' + my + ' ' + x2 + ' ' + y2
      let arrow = null
      if (!e.isBidirectional) {
        const as = 6
        const bx = x2 - ux * as * 1.6; const by = y2 - uy * as * 1.6
        const px = -uy * as * 0.65; const py = ux * as * 0.65
        arrow = (
          <polygon key={'arr-' + keyPrefix + '-' + i}
            points={x2 + ',' + y2 + ' ' + (bx + px) + ',' + (by + py) + ' ' + (bx - px) + ',' + (by - py)}
            fill={e.color} />
        )
      }
      return (
        <g key={'e-' + keyPrefix + '-' + i}>
          <path d={path} stroke={e.color} strokeWidth={1.4} fill="none" opacity={opacity} />
          {arrow}
        </g>
      )
    })
  }

  function renderMiniNodes(showLabel: boolean) {
    if (!productG || !N) return null
    return productG.elements.map(el => {
      const pp = animPos(el.id)
      if (!pp) return null
      const sep = el.id.indexOf('|')
      const nId = el.id.slice(0, sep)
      const color = hColorMap.get(el.id.slice(sep + 1)) ?? HOMO_COLORS[0]
      const isId = nId === N.identity.id
      return (
        <g key={'mn-' + el.id} transform={'translate(' + pp.x + ',' + pp.y + ')'}>
          <circle r={nR} fill={isId ? color : color + '22'} stroke={isId ? '#ffd93d' : color} strokeWidth={1.2} />
          {showLabel && (
            <foreignObject x={-nR - 6} y={-nR - 3} width={nR * 2 + 12} height={nR * 2 + 6} style={{ pointerEvents: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: isId ? '#ffd93d' : color, fontSize: Math.max(4, nR * 0.8) }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label.slice(0, el.label.indexOf(',')))) }} />
            </foreignObject>
          )}
        </g>
      )
    })
  }

  function renderAnimation() {
    if (!productG || !G || !N) return null

    let content: ReactNode
    if (step === 0) {
      content = (
        <>
          {renderEdgeLayer(hSkeletonRaw, 'skeleton', 0.8, 'sk')}
          {G.elements.map(el => {
            const pos = hPos.get(el.id)
            if (!pos) return null
            return (
              <g key={'bn-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
                <circle r={OUTER_R} fill="var(--node-fill)" stroke="var(--node-stroke)" strokeWidth={2} />
                <foreignObject x={-OUTER_R} y={-11} width={OUTER_R * 2} height={22} style={{ pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '11px' }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                </foreignObject>
              </g>
            )
          })}
        </>
      )
    } else if (step === 1) {
      const ringR = OUTER_R + (expandR - OUTER_R) * k
      content = (
        <>
          {renderEdgeLayer(hSkeletonRaw, 'skeleton', 0.6 * (1 - k * 0.5), 'sk')}
          {renderEdgeLayer(nRawEdges, 'n', 0.85 * k, 'n')}
          {G.elements.map(el => {
            const pos = hPos.get(el.id)
            if (!pos) return null
            const color = hColorMap.get(el.id) ?? HOMO_COLORS[0]
            return (
              <g key={'bn-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
                <circle r={ringR} fill="transparent" stroke={color} strokeWidth={2.5} />
                <foreignObject x={-ringR} y={-11} width={ringR * 2} height={22} style={{ pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '10px', opacity: 1 - k * 0.4 }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                </foreignObject>
              </g>
            )
          })}
          {renderMiniNodes(false)}
        </>
      )
    } else if (step === 2) {
      content = (
        <>
          {renderEdgeLayer(nRawEdges, 'n', 0.85, 'n')}
          {renderEdgeLayer(hRawEdges, 'h', 0.9 * k, 'h')}
          {G.elements.map(el => {
            const pos = hPos.get(el.id)
            if (!pos) return null
            const color = hColorMap.get(el.id) ?? HOMO_COLORS[0]
            return (
              <g key={'bn-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
                <circle r={expandR} fill="transparent" stroke={color} strokeWidth={2.5} opacity={1 - k} />
                <foreignObject x={-expandR} y={-9} width={expandR * 2} height={18} style={{ pointerEvents: 'none' }}>
                  <div style={{ textAlign: 'center', color: color, fontSize: '9px', opacity: 0.3 + 0.7 * k }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                </foreignObject>
              </g>
            )
          })}
          {renderMiniNodes(true)}
        </>
      )
    } else {
      content = (
        <>
          {renderEdgeLayer(nRawEdges, 'n', 0.85, 'n')}
          {renderEdgeLayer(hRawEdges, 'h', 0.9, 'h')}
          {G.elements.map(el => {
            const pos = hPos.get(el.id)
            if (!pos) return null
            const color = hColorMap.get(el.id) ?? HOMO_COLORS[0]
            return (
              <g key={'bn-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
                <foreignObject x={-expandR} y={-9} width={expandR * 2} height={18} style={{ pointerEvents: 'none' }}>
                  <div style={{ textAlign: 'center', color: color, fontSize: '9px' }}
                    dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                </foreignObject>
              </g>
            )
          })}
          {renderMiniNodes(true)}
        </>
      )
    }

    const titleColor = ['var(--accent-teal)', 'var(--accent-orange)', 'var(--accent-orange)', 'var(--accent-green)'][step]

    return (
      <svg viewBox={'0 0 ' + VIEW_W + ' ' + VIEW_H} style={{ width: '100%', height: '100%' }}>
        <foreignObject x={VIEW_W / 2 - 180} y={4} width={360} height={28}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', color: titleColor, lineHeight: '28px' }}>
            {step === 3
              ? t('sd.phase4') + ' — '
              : t('sd.phase' + (step + 1)) + ' — '}
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'normal' }}>
              {step === 3
                ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(productG.symbol)) + ' <span style="opacity:0.7">(|G|=' + productG.order + ')</span>' }} />
                : <span dangerouslySetInnerHTML={{ __html: renderTex(texify(N.symbol + ' \\rtimes ' + G.symbol)) }} />}
            </span>
          </div>
        </foreignObject>

        {content}
      </svg>
    )
  }

  function renderSetup() {
    if (!N && !G) {
      return (
        <svg viewBox={'0 0 ' + VIEW_W + ' ' + VIEW_H} style={{ width: '100%', height: '100%' }}>
          <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="15">
            {t('sd.selectBothInPanel')}
          </text>
        </svg>
      )
    }

    const mappingArrows: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = []
    if (G && autH && phiAutoMap.size > 0) {
      phiAutoMap.forEach((autElId, gElId) => {
        const gp = gPos.get(gElId); const ap = autPos.get(autElId)
        if (!gp || !ap) return
        const tgtIdx = autH.elements.findIndex(e => e.id === autElId)
        const color = tgtIdx >= 0 ? HOMO_COLORS[tgtIdx % HOMO_COLORS.length] : HOMO_COLORS[0]
        mappingArrows.push({ x1: gp.x, y1: gp.y, x2: ap.x, y2: ap.y, color })
      })
    }

    return (
      <svg viewBox={'0 0 ' + VIEW_W + ' ' + VIEW_H} style={{ width: '100%', height: '100%' }}>
        <line x1={VIEW_W / 2} y1={40} x2={VIEW_W / 2} y2={VIEW_H - 10}
          stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="4,6" opacity={0.5} />

        <foreignObject x={VIEW_W / 2 - 140} y={4} width={280} height={28}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '28px' }}
            dangerouslySetInnerHTML={{
              __html: renderTex(texify((G ? G.symbol : '?') + ' \\to \\operatorname{Aut}(' + (N ? N.symbol : '?') + ')'))
            }} />
        </foreignObject>

        {G && (
          <foreignObject x={gCx - 60} y={34} width={120} height={20}>
            <div style={{ fontSize: '12px', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '20px' }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(G.symbol)) + ' <span style="color:var(--text-muted);font-size:10px">(|G|=' + G.order + ')</span>' }} />
          </foreignObject>
        )}
        {autH && (
          <foreignObject x={autCx - 70} y={34} width={140} height={20}>
            <div style={{ fontSize: '12px', textAlign: 'center', color: 'var(--text-primary)', lineHeight: '20px' }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify('\\operatorname{Aut}(' + N!.symbol + ')')) + ' <span style="color:var(--text-muted);font-size:10px">(|Aut|=' + autH.order + ')</span>' }} />
          </foreignObject>
        )}

        {mappingArrows.map((arrow, i) => {
          const dx = Math.abs(arrow.x2 - arrow.x1) * 0.3
          return (
            <path key={'map-' + i}
              d={'M ' + arrow.x1 + ' ' + arrow.y1 + ' C ' + (arrow.x1 + dx) + ' ' + arrow.y1 + ', ' + (arrow.x2 - dx) + ' ' + arrow.y2 + ', ' + arrow.x2 + ' ' + arrow.y2}
              stroke={arrow.color} strokeWidth={1.5} strokeOpacity={0.35} fill="none" />
          )
        })}

        {gCayleyEdges.map((e, i) => (
          <path key={'ge-' + i} d={e.path} stroke={e.color + '88'} strokeWidth={1.5} fill="none" opacity={0.55} />
        ))}
        {autCayleyEdges.map((e, i) => (
          <path key={'ae-' + i} d={e.path} stroke={e.color + '88'} strokeWidth={1.3} fill="none" opacity={0.5} />
        ))}

        {G && G.elements.map(el => {
          const pos = gPos.get(el.id)
          if (!pos) return null
          const isMapped = phiAutoMap.has(el.id)
          return (
            <g key={'gn-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
              <circle r={NODE_R} fill="var(--node-fill)"
                stroke={isMapped ? 'var(--accent-orange)' : 'var(--node-stroke)'} strokeWidth={isMapped ? 2 : 1.5} />
              <foreignObject x={-NODE_R} y={-11} width={NODE_R * 2} height={22} style={{ pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--node-text)', fontSize: '11px' }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
              </foreignObject>
            </g>
          )
        })}

        {autH && autH.elements.map(el => {
          const pos = autPos.get(el.id)
          if (!pos) return null
          const inImage = phiImageSet.has(el.id)
          return (
            <g key={'an-' + el.id} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
              <circle r={NODE_R} fill={inImage ? 'var(--node-fill)' : 'var(--bg-secondary)'}
                stroke={inImage ? 'var(--accent-teal)' : 'var(--border-color)'} strokeWidth={inImage ? 2 : 1} />
              <foreignObject x={-NODE_R} y={-11} width={NODE_R * 2} height={22} style={{ pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: inImage ? 'var(--accent-teal)' : 'var(--text-muted)', fontSize: '11px', fontWeight: inImage ? 700 : 400 }}
                  dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
              </foreignObject>
            </g>
          )
        })}

        <g transform={'translate(' + (VIEW_W / 2 - 80) + ', ' + (VIEW_H - 30) + ')'}>
          <rect x={0} y={-14} width={160} height={28} rx={6}
            fill={N && G && phiMap ? 'var(--accent-orange)' : 'var(--border-color)'}
            opacity={N && G && phiMap ? 0.85 : 0.3} />
          <text x={80} y={4} textAnchor="middle" fontSize="12" fontWeight="bold"
            fill={N && G && phiMap ? '#0f0f1a' : 'var(--text-muted)'}
            style={{ cursor: N && G && phiMap ? 'pointer' : 'default' }}
            onClick={N && G && phiMap ? handleStart : undefined}>
            {t('sd.create')}
          </text>
        </g>

        {N && !autH && (
          <text x={VIEW_W / 2} y={VIEW_H - 12} textAnchor="middle" fontSize="12" fill="var(--text-muted)">
            {t('sd.computeAut')}
          </text>
        )}
      </svg>
    )
  }

  const canStart = !!(N && G && phiMap && !created)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, left: 16, color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 'bold', color: 'var(--accent-orange)' }}>{t('sd.title')}</span>
        {!created && N && G && !phiMap && <span>{t('sd.expandPhi')}</span>}
        {created && <span style={{ color: 'var(--accent-teal)' }}>{t('sd.phase' + (step + 1))}</span>}
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 11, color: 'var(--text-muted)' }}>
        {N ? <span dangerouslySetInnerHTML={{ __html: 'N: ' + renderTex(texify(N.symbol)) }} /> : null}
        {G ? <span dangerouslySetInnerHTML={{ __html: (N ? '  |  ' : '') + 'G: ' + renderTex(texify(G.symbol)) }} /> : null}
      </div>

      {created ? renderAnimation() : renderSetup()}

      {created && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoplay} onChange={e => setAutoplay(e.target.checked)} />
            {t('sd.autoPlay')}
          </label>
          {step > 0 && (
            <button className="panel-btn" onClick={() => gotoStep(step - 1)}
              style={{ fontSize: '14px', padding: '4px 10px', backgroundColor: 'var(--accent-teal)', color: '#0f0f1a', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              ◀
            </button>
          )}
          {[0, 1, 2, 3].map(pIdx => (
            <div key={pIdx} onClick={() => gotoStep(pIdx)}
              style={{ width: step === pIdx ? 10 : 7, height: step === pIdx ? 10 : 7, borderRadius: '50%', background: step === pIdx ? 'var(--accent-teal)' : 'var(--border-color)', opacity: step === pIdx ? 1 : 0.5, cursor: 'pointer' }} />
          ))}
          {step < 3 ? (
            <button className="panel-btn" onClick={() => gotoStep(step + 1)}
              style={{ fontSize: '14px', padding: '4px 10px', backgroundColor: 'var(--accent-teal)', color: '#0f0f1a', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              ▶
            </button>
          ) : (
            <button className="panel-btn" onClick={handleFinish}
              style={{ fontSize: '13px', padding: '4px 14px', backgroundColor: 'var(--accent-green)', color: '#0f0f1a', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
              {t('sd.finish')}
            </button>
          )}
        </div>
      )}

      {canStart && (
        <div style={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--accent-teal)' }}>
          {t('sd.clickCreate')}
        </div>
      )}
    </div>
  )
}

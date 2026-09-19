import { useMemo, useState } from 'react'
import { SceneThemeRoot, type SceneTheme } from './SceneThemeRoot'
import { SylowTorusScene } from './SylowTorusScene'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { factorizeOrder, findAllPSubgroups, conjugateSubgroup } from '../../core/algebra/sylow'
import { ENUMERATION_LIMIT } from '../../core/guards'
import { computeElementOrderInGroup } from '../../core/algebra/subgroups'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { cayleyCircleLayout, circleLayoutRadius, cosetStripLayout } from '../../core/algebra/forceLayout'
import { COLOR_PALETTE } from '../../core/types'
import type { CanvasTransform, CayleyAction, CayleyEdgeData, Group, GroupElement } from '../../core/types'

// ─── Sylow props 化内核（阶段 2 批次八 FGVE） ─────────────────────────────
// 受控窗口/包消费端与主画布（经 context 壳 SylowView）共用。group 之外全部可选：
// 主画布壳由全局 Provider 组装，外部宿主自持选中与视口。
// 三种布局模式都在本文件内：circle（全体元素环）→ coset（单子群陪集条带）
// → two（两子群上下 + Sylow II 共轭箭头）。配色走 --sylow-* CSS 变量，
// 因此 theme prop / 外层主题作用域都能整体换色（与 SetView/CayleyView 同构）。

const sgKeyOf = (sg: { elements: { id: string }[] }) =>
  sg.elements.map(e => e.id).slice().sort().join(',')

// 配色（P = 选中 Sylow p-子群 teal / Q = 第二个 purple / I = 交集 gold）
const TEAL = {
  pStroke: 'var(--sylow-p-stroke)',
  selFill: 'var(--sylow-sel-fill)',
  selStroke: 'var(--sylow-sel-stroke)',
  chipActive: 'var(--sylow-chip-active)',
}
const PURPLE = { fill: 'var(--sylow-q-fill)', stroke: 'var(--sylow-q-stroke)' }
const GOLD = { fill: 'var(--sylow-i-fill)', stroke: 'var(--sylow-i-stroke)' }

const DEFAULT_TRANSFORM: CanvasTransform = { x: 0, y: 0, scale: 1 }
const DEFAULT_VB = { width: 800, height: 600 }
const EMPTY_SEL: Set<string> = new Set()
const NOOP = () => { }

export interface SylowSceneProps {
  /** 群；null → 渲染空态（与其它 Scene 一致，宿主可先渲染壳） */
  group: Group | null
  /** 选中元素集合（受控）；缺省空集 */
  selectedElements?: Set<string>
  /** 节点点击 → 宿主；multi = ctrl/⌘（主画布壳接全局 selectElement） */
  onSelect?: (id: string, multi: boolean) => void
  /** 节点悬停 → 宿主（主画布壳接 setHoverElement）；缺省不挂 hover */
  onHover?: (el: GroupElement | null) => void
  /** 内容平移缩放；缺省恒等 */
  canvasTransform?: CanvasTransform
  /** 视口尺寸；缺省 800×600 */
  viewBoxSize?: { width: number; height: number }
  /** 视图主题作用域（`'dark' | 'light'`）。缺省不注入、跟随外层主题；显式传值时在本子树内
   *  应用 `theme.css` 对应变量块（需宿主已 `import '@groupviz/react/theme.css'`） */
  theme?: SceneTheme
}

export function SylowScene(props: SylowSceneProps) {
  return (
    <SceneThemeRoot theme={props.theme}>
      <SylowSceneBody {...props} />
    </SceneThemeRoot>
  )
}

function SylowSceneBody(props: SylowSceneProps) {
  const { t } = useTranslation()
  // 空态层：group 为 null 时不进实算（hooks 数量恒定），与其它 Scene 的宽容语义一致
  if (!props.group) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }
  return <SylowSceneInner {...props} group={props.group} />
}

function SylowSceneInner({
  group,
  selectedElements = EMPTY_SEL,
  onSelect,
  onHover,
  canvasTransform = DEFAULT_TRANSFORM,
  viewBoxSize = DEFAULT_VB,
  theme,
}: SylowSceneProps & { group: Group }) {
  const { t } = useTranslation()

  const elementOrders = useMemo(() => {
    const m = new Map<string, number>()
    for (const el of group.elements) m.set(el.id, computeElementOrderInGroup(el, group))
    return m
  }, [group])

  const factors = useMemo(() => factorizeOrder(group.order), [group])

  const [selection, setSelection] = useState<{ prime: number; ids: string[] } | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)
  // flat = 原有 2D SVG；fiber = 把该素数下**全部** Sylow p-子群铺成共轭纤维化（3D 柱面/圆环面）
  const [viewMode, setViewMode] = useState<'flat' | 'fiber'>('flat')

  const effectivePrime = useMemo(() => {
    if (selection && factors.some(f => f.prime === selection.prime)) return selection.prime
    return factors.length > 0 ? factors[0].prime : null
  }, [selection, factors])

  const pSubgroups = useMemo(() => {
    if (effectivePrime === null) return []
    return findAllPSubgroups(group, effectivePrime)
  }, [group, effectivePrime])

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
  const n = group.order
  const nodeRadius = 28
  const cx = viewBoxSize.width / 2
  const cy = viewBoxSize.height / 2
  const graphRadius = circleLayoutRadius(viewBoxSize.width, viewBoxSize.height, n, nodeRadius)

  const circLayout = useMemo(() => {
    if (n === 0) return new Map<string, { x: number; y: number }>()
    return cayleyCircleLayout(group, cx, cy, graphRadius)
  }, [group, cx, cy, graphRadius, n])

  // single-subgroup mode: coset strip layout (left cosets of H)
  // 子群凯莱图（coset 模式）：条带上方留出圆形 ⟨H⟩ 凯莱图的位置。
  // 半径按容器比例给足（绝对值 |H|×9 在主画布 3000×3000 下小得看不清边）。
  const subgroupCayleyR = selectedSubgroup
    ? Math.max(36, Math.min(400, Math.min(viewBoxSize.width, viewBoxSize.height) * 0.16))
    : 0
  const subgroupTopPad = selectedSubgroup ? 2 * subgroupCayleyR + 64 : undefined

  const cosetStripData = useMemo(() => {
    if (!selectedSubgroup || twoMode) return null
    return cosetStripLayout(
      group,
      viewBoxSize.width,
      viewBoxSize.height,
      selectedSubgroup.elements.map(e => e.id),
      undefined,
      undefined,
      undefined,
      subgroupTopPad,
    )
  }, [group, selectedSubgroup, twoMode, viewBoxSize, subgroupTopPad])

  // ---- conjugation (Sylow II): find g with g·P·g⁻¹ = Q.
  // Prefer a g that also normalizes P∩Q so the common elements stay put
  // and the conjugation arrows run between the non-common parts only.
  const conjugator = useMemo(() => {
    if (!twoMode || !selectedSubgroup || !secondSubgroup) return null
    const qKey = sgKeyOf(secondSubgroup)
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))
    const inter = selectedSubgroup.elements.filter(e => qSet.has(e.id))
    const iKey = inter.map(e => e.id).slice().sort().join(',')
    const conjKey = (els: GroupElement[], g: GroupElement) =>
      conjugateSubgroup(group, els, g).map(e => e.id).slice().sort().join(',')
    for (const g of group.elements) {
      if (conjKey(selectedSubgroup.elements, g) === qKey && conjKey(inter, g) === iKey) return g
    }
    for (const g of group.elements) {
      if (conjKey(selectedSubgroup.elements, g) === qKey) return g
    }
    return null
  }, [twoMode, group, selectedSubgroup, secondSubgroup])

  // ── two-subgroup mode：两份子群凯莱图 + 逐点共轭映射线 ─────────────────
  // 共轭 x ↦ gxg⁻¹ 限制在 P 上是**同构 P → Q**，所以照同态视图的语言画：
  // P / Q 各自画成子群自己的圆环凯莱图，再把对应元素逐点连起来。
  //
  // 为什么不让 P∩Q 在两侧共享一个位置（2026-09-17 实测）：选 g 时只保证
  // 「g 把 P∩Q 映到自身」（集合稳定），**不保证逐点固定** —— S₄ 的 4 阶交集上
  // g 做 3-/4-循环、GL(2,3) 的 8 阶交集上做 4-循环，共享画法会让读者以为
  // 交集的点不动。两侧各画一份、交集元素也连线才是诚实的。
  const twoCayley = useMemo(() => {
    if (!twoMode || !selectedSubgroup || !secondSubgroup) return null
    const P = selectedSubgroup
    const Q = secondSubgroup
    const w = viewBoxSize.width
    const h = viewBoxSize.height
    // 圆半径按画布比例给足（先前按「理想弦长」封顶，导致 3000×3000 的主画布上
    // 只有 r≈78 的小圆、两圆连线被拉成 8 倍长的细线）；节点半径反过来随环上弦长收缩。
    const r = Math.max(60, Math.min(w * 0.18, h * 0.32))
    const cxL = w * 0.27
    const cxR = w * 0.73
    const cyM = h * 0.52
    const pPos = cayleyCircleLayout({ ...group, order: P.order, elements: P.elements }, cxL, cyM, r)
    // Q 的几何**整体跟随 P**：g·x·g⁻¹ 放在「x 在 P 侧的位置 + 两环中心平移」处。
    // 这样每条映射线等长且同向（零交叉），而且比"两侧各自布局"更如实体现「共轭是同构」。
    // （先前按单环角度对齐，遇到 D₄ 这类走双环布局的子群仍会错位交叉 —— 真机实测 4 处交叉。）
    const dq = { x: cxR - cxL, y: 0 }
    const qPos = new Map<string, { x: number; y: number }>()
    for (const x of P.elements) {
      const p = pPos.get(x.id)
      if (!p) continue
      const img = conjugator ? conjugateSubgroup(group, [x], conjugator)[0] : null
      qPos.set((img ?? x).id, { x: p.x + dq.x, y: p.y + dq.y })
    }
    // 兜底：映射没覆盖到的 Q 元素（共轭是同构，理论上不会发生）
    Q.elements.forEach((el, i) => {
      if (qPos.has(el.id)) return
      const a = (i * 2 * Math.PI) / Math.max(1, Q.order) - Math.PI / 2
      qPos.set(el.id, { x: cxR + r * Math.cos(a), y: cyM + r * Math.sin(a) })
    })
    const chord = 2 * r * Math.sin(Math.PI / Math.max(3, P.order, Q.order))
    const nodeR = Math.max(9, Math.min(28, chord / 2 - 2))
    const side = (sub: typeof P, pos: Map<string, { x: number; y: number }>, color: string) => {
      const set = new Set(sub.elements.map(e => e.id))
      const acts = sub.generators.map(g => ({ elementId: g.id, enabled: true, color }))
      return {
        pos,
        set,
        edges: computeCayleyActionEdges(group, acts, 'right')
          .filter(e => !e.isSelfLoop && set.has(e.fromId) && set.has(e.toId)),
      }
    }
    const pSide = side(P, pPos, TEAL.pStroke)
    const qSide = side(Q, qPos, PURPLE.stroke)
    const qAll = new Set(Q.elements.map(e => e.id))
    const pairs = conjugator
      ? P.elements
          .map(x => {
            const to = conjugateSubgroup(group, [x], conjugator)[0]
            return { from: x.id, to: to ? to.id : null, common: qAll.has(x.id) }
          })
          .filter((p): p is { from: string; to: string; common: boolean } => p.to !== null)
      : []
    // 导轨虚线圆取实际节点包围半径（D₄ 等子群走双环布局，节点不在 r 上）
    let pRadius = 0
    for (const el of P.elements) {
      const p = pPos.get(el.id)
      if (!p) continue
      pRadius = Math.max(pRadius, Math.hypot(p.x - cxL, p.y - cyM))
    }
    return { pSide, qSide, pairs, cxL, cxR, cyM, r, nodeR, pRadius: pRadius || r }
  }, [twoMode, group, selectedSubgroup, secondSubgroup, conjugator, viewBoxSize])

  const layoutMode = twoMode ? 'two' : selectedSubgroup ? 'coset' : 'circle'

  const posOf = (id: string) => {
    if (layoutMode === 'coset') return cosetStripData?.positions.get(id)
    return circLayout.get(id)
  }

  // ---- edge action set ----
  const edgeActions = useMemo<CayleyAction[]>(() => {
    if (twoMode) return []
    if (selectedSubgroup) {
      return selectedSubgroup.generators.map((g, i) => ({
        elementId: g.id,
        enabled: true,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      }))
    }
    return group.generators.map((gen, i) => {
      const el = gen.apply(group.identity)
      return {
        elementId: el?.id || group.elements[0].id,
        enabled: true,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      }
    })
  }, [group, selectedSubgroup, twoMode])

  const enabledActions = edgeActions.filter(a => a.enabled)

  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    edgeActions.forEach((a, idx) => { if (a.enabled) m.set(a.elementId, idx) })
    return m
  }, [edgeActions])

  const edges = useMemo(
    () => computeCayleyActionEdges(group, edgeActions, 'right'),
    [group, edgeActions]
  )

  const isLarge = group.order > ENUMERATION_LIMIT

  const factor = effectivePrime !== null ? factors.find(f => f.prime === effectivePrime) : null
  const pPower = factor ? Math.pow(factor.prime, factor.exponent) : 0
  const m = factor ? group.order / pPower : 0
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
    if (dist < 1) return null

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

  // ── two 模式 SVG：两份子群凯莱图 + 逐点映射线（P∩Q 元素两侧各画一份） ──
  const twoModeElements = (() => {
    if (!twoCayley || !selectedSubgroup || !secondSubgroup) return null
    type Side = {
      pos: Map<string, { x: number; y: number }>
      set: Set<string>
      edges: CayleyEdgeData[]
    }
    const { pSide, qSide, pairs, cxL, cxR, cyM, nodeR, pRadius } = twoCayley
    const qSet = new Set(secondSubgroup.elements.map(e => e.id))

    const ringOf = (sub: typeof selectedSubgroup, cx: number, color: string, tag: string) => (
      <g key={`ring-${tag}`}>
        <circle cx={cx} cy={cyM} r={pRadius} fill="none" stroke={color} strokeWidth={1} opacity={0.3} strokeDasharray="4 6" />
        <text
          x={cx} y={cyM - pRadius - 30} textAnchor="middle" fill={color}
          fontSize={16} fontWeight={700} style={{ fontFamily: 'KaTeX_Main, monospace' }}
        >{tag}</text>
        <text
          x={cx} y={cyM - pRadius - 12} textAnchor="middle" fill="var(--text-muted)" fontSize={12}
          dangerouslySetInnerHTML={{ __html: renderTex(texify(`\\langle ${sub.generators.map(g => g.label).join(', ')} \\rangle`)) }}
        />
      </g>
    )

    const edgeEls = (side: Side, color: string, markerId: string, tag: string) =>
      side.edges.map((e, i) => {
        const a = side.pos.get(e.fromId)
        const b = side.pos.get(e.toId)
        if (!a || !b) return null
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        return (
          <line
            key={`${tag}-e-${i}`}
            x1={a.x + (dx / d) * nodeR} y1={a.y + (dy / d) * nodeR}
            x2={b.x - (dx / d) * nodeR} y2={b.y - (dy / d) * nodeR}
            stroke={color} strokeWidth={2} opacity={0.75}
            markerEnd={`url(#${markerId})`}
          />
        )
      })

    const mapEls = pairs.map(p => {
      const a = pSide.pos.get(p.from)
      const b = qSide.pos.get(p.to)
      if (!a || !b) return null
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const sx = a.x + (dx / d) * nodeR
      const sy = a.y + (dy / d) * nodeR
      const ex = b.x - (dx / d) * nodeR
      const ey = b.y - (dy / d) * nodeR
      // 环序已按映射对齐 ⇒ 直线即成平行束（零交叉），无需再加弧
      return (
        <path
          key={`map-${p.from}`}
          d={`M ${sx} ${sy} L ${ex} ${ey}`}
          stroke={GOLD.stroke}
          strokeWidth={p.common ? 2.6 : 1.4}
          fill="none"
          opacity={p.common ? 0.95 : 0.55}
          markerEnd="url(#sylow-conj-arrow)"
          markerStart="url(#sylow-conj-arrow-start)"
        />
      )
    })

    const nodeEls = (side: Side, isP: boolean) =>
      Array.from(side.set).map(id => {
        const p = side.pos.get(id)
        if (!p) return null
        const el = group.elements.find(e => e.id === id)
        if (!el) return null
        const common = qSet.has(id)
        const isSel = selectedElements.has(id)
        const fill = isSel ? 'var(--node-fill-selected)' : common ? GOLD.fill : isP ? TEAL.selFill : PURPLE.fill
        const stroke = isSel ? '#ffd93d' : common ? GOLD.stroke : isP ? TEAL.selStroke : PURPLE.stroke
        return (
          <g
            key={`${isP ? 'p' : 'q'}-${id}`}
            transform={`translate(${p.x}, ${p.y})`}
            onClick={(e) => { e.stopPropagation(); (onSelect ?? NOOP)(id, e.ctrlKey || e.metaKey) }}
            onMouseEnter={() => onHover?.(el)}
            onMouseLeave={() => onHover?.(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle r={nodeR} fill={fill} stroke={stroke} strokeWidth={common || isSel ? 3 : 2} />
            <foreignObject
              x={-nodeR} y={-nodeR} width={nodeR * 2} height={nodeR * 2}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', color: 'var(--node-text)',
                  fontSize: `${Math.max(8, Math.round(nodeR * 0.85))}px`,
                }}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
              />
            </foreignObject>
          </g>
        )
      })

    return (
      <g>
        {ringOf(selectedSubgroup, cxL, TEAL.pStroke, 'P')}
        {ringOf(secondSubgroup, cxR, PURPLE.stroke, 'Q')}
        {edgeEls(pSide, TEAL.pStroke, 'sylow-p-edge', 'p')}
        {edgeEls(qSide, PURPLE.stroke, 'sylow-q-edge', 'q')}
        {mapEls}
        {nodeEls(pSide, true)}
        {nodeEls(qSide, false)}
      </g>
    )
  })()

  const conjLabel = conjugator && selectedSubgroup ? (
    <g>
      <text
        x={viewBoxSize.width / 2}
        y={twoCayley ? twoCayley.cyM - twoCayley.r - 56 : 24}
        textAnchor="middle"
        fill={GOLD.stroke}
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
    >{`|G|=${group.order} = ${cosetStripData.strips[0].elementIds.length}\u00b7${cosetStripData.strips.length}   |H|\u00b7[G:H]`}</text>
  ) : null

  // ── coset 模式：条带上方画 ⟨H⟩ 的圆形凯莱图（与陪集条带视图同款语汇） ──
  const subgroupCayleyElements = (() => {
    if (!selectedSubgroup || twoMode) return null
    if (!cosetStripData || cosetStripData.strips.length === 0) return null
    const H = selectedSubgroup
    const hSet = new Set(H.elements.map(e => e.id))
    const strip0 = cosetStripData.strips[0]
    const r = subgroupCayleyR
    const cx = strip0.x + strip0.w / 2
    const cy = strip0.y - r - 24
    const pos = cayleyCircleLayout({ ...group, order: H.order, elements: H.elements }, cx, cy, r)
    const edges = computeCayleyActionEdges(
      group,
      H.generators.map((g, i) => ({ elementId: g.id, enabled: true, color: COLOR_PALETTE[i % COLOR_PALETTE.length] })),
      'right',
    ).filter(e => !e.isSelfLoop && hSet.has(e.fromId) && hSet.has(e.toId))
    const nodeR = Math.max(5, Math.min(22, 2 * r * Math.sin(Math.PI / Math.max(3, H.order)) * 0.3))
    return (
      <g key="subgroup-cayley" data-subgroup-cayley={H.order}>
        <text
          x={cx} y={cy - r - 12} textAnchor="middle" fill="var(--text-muted)"
          fontSize={13} style={{ fontFamily: 'KaTeX_Main, monospace' }}
        >{t('canvas.cosetStripCayley')}</text>
        {edges.map((e, i) => {
          const a = pos.get(e.fromId)
          const b = pos.get(e.toId)
          if (!a || !b) return null
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          return (
            <line
              key={`hc-e-${i}`}
              x1={a.x + (dx / d) * nodeR} y1={a.y + (dy / d) * nodeR}
              x2={b.x - (dx / d) * nodeR} y2={b.y - (dy / d) * nodeR}
              stroke={e.color} strokeWidth={2} opacity={0.85}
            />
          )
        })}
        {H.elements.map(el => {
          const p = pos.get(el.id)
          if (!p) return null
          const isId = el.id === group.identity.id
          return (
            <g key={`hc-${el.id}`} transform={`translate(${p.x}, ${p.y})`}>
              <circle
                r={nodeR}
                fill={isId ? 'var(--node-fill-selected)' : 'var(--node-fill)'}
                stroke={isId ? '#ffd93d' : 'var(--node-stroke)'}
                strokeWidth={1.8}
              />
              <foreignObject
                x={-nodeR} y={-nodeR} width={nodeR * 2} height={nodeR * 2}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%', color: 'var(--node-text)',
                    fontSize: `${Math.max(8, Math.round(nodeR * 0.8))}px`,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
                />
              </foreignObject>
            </g>
          )
        })}
      </g>
    )
  })()

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
        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 4 }}>
          <button
            className={`toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
            onClick={() => setViewMode('flat')}
          >{t('sylowView.modeFlat')}</button>
          <button
            className={`toggle-btn ${viewMode === 'fiber' ? 'active' : ''}`}
            onClick={() => setViewMode('fiber')}
          >{t('sylowView.modeFiber')}</button>
        </span>
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
      {viewMode === 'fiber' ? (
        <div className="sylow-view-main" style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          <SylowTorusScene
            group={group}
            prime={effectivePrime ?? 2}
            selectedElements={selectedIds}
            onSelectElement={onSelect}
            theme={theme}
            mode="auto"
          />
          <div
            className="sylow-view-fiber-legend"
            style={{
              position: 'absolute',
              left: 12,
              bottom: 10,
              pointerEvents: 'none',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              textShadow: '0 1px 2px var(--surface-primary, rgba(0,0,0,0.35))',
            }}
          >
            <div>{t('sylowView.torusLegendInner')}</div>
            <div>{t('sylowView.torusLegendConj')}</div>
            <div style={{ opacity: 0.75 }}>{t('sylowView.torusLegendShape')}</div>
          </div>
        </div>
      ) : (
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
              <path d="M0,0 L0,6 L9,3 z" fill={GOLD.stroke} />
            </marker>
            <marker id="sylow-conj-arrow-start" markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto-start-reverse" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={GOLD.stroke} />
            </marker>
            <marker id="sylow-p-edge" markerWidth={9} markerHeight={9} refX={8} refY={2.5} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L8,2.5 z" fill={TEAL.pStroke} />
            </marker>
            <marker id="sylow-q-edge" markerWidth={9} markerHeight={9} refX={8} refY={2.5} orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L8,2.5 z" fill={PURPLE.stroke} />
            </marker>
          </defs>
          <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
            {/* two 模式：整块换成两份子群凯莱图 + 映射线（全局元素圈不参与） */}
            {twoMode && twoModeElements ? (
              <>
                {conjLabel}
                {twoModeElements}
              </>
            ) : (
              <>
                {stripElements}
                {subgroupCayleyElements}
                {conjLabel}
                {edgeElements}
                {stripTheorem}

                {group.elements.map((el) => {
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
                  fillColor = GOLD.fill
                  strokeColor = GOLD.stroke
                  strokeWidth = 3
                } else if (pSet.has(el.id)) {
                  fillColor = TEAL.selFill
                  strokeColor = TEAL.selStroke
                  strokeWidth = 3
                } else if (qSet.has(el.id)) {
                  fillColor = PURPLE.fill
                  strokeColor = PURPLE.stroke
                  strokeWidth = 3
                } else if (isPElement) {
                  strokeColor = TEAL.pStroke
                  strokeWidth = 2.5
                } else {
                  groupOpacity = 0.3
                }
              } else if (inSubgroup) {
                fillColor = TEAL.selFill
                strokeColor = TEAL.selStroke
                strokeWidth = 3
              } else if (isPElement) {
                strokeColor = TEAL.pStroke
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
                    ;(onSelect ?? NOOP)(el.id, e.ctrlKey || e.metaKey)
                  }}
                  onMouseEnter={() => onHover?.(el)}
                  onMouseLeave={() => onHover?.(null)}
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
              </>
            )}
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
          <div className="sylow-view-hint" style={{ fontSize: 11, color: TEAL.pStroke, fontWeight: 600, marginBottom: 8, background: TEAL.selFill, borderRadius: 4, padding: '3px 6px' }}>
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
                  fontSize: 12, padding: '4px 8px', textAlign: 'left', userSelect: 'none',
                  border: active ? `1.5px solid ${TEAL.chipActive}` : undefined,
                }}
              >
                <span style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(`|H| = ${factor ? `${factor.prime}^{${Math.round(Math.log(sg.order) / Math.log(factor.prime))}}` : sg.order}`)) }} />
                <span style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(`\\langle ${sg.generators.map(g => g.label).join(', ')} \\rangle`)) }} />
                {sg.isSylow && <span className="sylow-star" style={{ color: TEAL.chipActive }}>★</span>}
                {sg.isNormal && <span className="sylow-normal" style={{ color: 'var(--text-muted)' }}>◁</span>}
                <span
                  role="button"
                  title={t('sylowView.addSecond')}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChipClick(sg, { ctrlKey: true, metaKey: false } as React.MouseEvent)
                  }}
                  style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: active ? 'var(--text-secondary)' : TEAL.pStroke, cursor: 'pointer', padding: '0 2px' }}
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
                      fontSize: 12, padding: '4px 8px', textAlign: 'left', userSelect: 'none',
                      border: active ? `1.5px solid ${TEAL.chipActive}` : undefined,
                    }}
                  >
                    <span style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(`|H| = ${factor ? `${factor.prime}^{${Math.round(Math.log(sg.order) / Math.log(factor.prime))}}` : sg.order}`)) }} />
                    <span style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(`\\langle ${sg.generators.map(g => g.label).join(', ')} \\rangle`)) }} />
                    {sg.isNormal && <span className="sylow-normal" style={{ color: 'var(--text-muted)' }}>◁</span>}
                    <span
                      role="button"
                      title={t('sylowView.addSecond')}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChipClick(sg, { ctrlKey: true, metaKey: false } as React.MouseEvent)
                      }}
                      style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: active ? 'var(--text-secondary)' : TEAL.pStroke, cursor: 'pointer', padding: '0 2px' }}
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
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: TEAL.selFill, border: `2px solid ${TEAL.selStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendP2')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: PURPLE.fill, border: `2px solid ${PURPLE.stroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendQ2')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: GOLD.fill, border: `2px solid ${GOLD.stroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendI2')}</div>
                <div><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px solid ${GOLD.stroke}`, marginRight: 6, verticalAlign: 4 }} />{t('sylowView.legendConj')}</div>
              </>
            ) : (
              <>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: TEAL.selFill, border: `2px solid ${TEAL.selStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendSelected')}</div>
                <div><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: 'var(--node-fill)', border: `2px solid ${TEAL.pStroke}`, marginRight: 6, verticalAlign: -2 }} />{t('sylowView.legendP')}</div>
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
      )}
    </div>
  )
}

/**
 * AutomorphismScene — 自同构作用预览内核（FGVE「自同构功能 props 化」）。
 *
 * 输入 = 一个自同构群 Aut(G)（`group`）+ 受控选中集合（`selectedElements`；恰一个
 * 元素时展示该自同构 α 的作用）。**不含窗口 chrome**：宿主用 `SceneWindow` 在自己的
 * 视图窗口里嵌套一层预览窗（主应用即如此），或裸渲进任意容器。
 *
 * 画面 = 父群 G 的圆环 Cayley 图，边按 α 改接到生成元的像 α(g) 上（「自同构如何扭转
 * 乘法结构」的可视化）、α 的不动点高亮，下方附元素映射表与不动/移动计数。
 *
 * 纯受控、零 `window` 访问（SSR 安全）：绘图区尺寸缺省由 ResizeObserver 自测容器，
 * 也可由 `viewBoxSize` 显式给定（= 绘图区像素，不含头部/映射表）。
 */
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SceneThemeRoot, type SceneTheme } from './SceneThemeRoot'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { createGroupFromSymbol } from '../../core/groups/groupFactory'
import { computeCayleyActionEdges } from '../../core/algebra/cayleyEdges'
import { cayleyCircleLayout } from '../../core/algebra/forceLayout'
import { getAutomorphismMap } from '../../core/algebra/automorphisms'
import type { CayleyAction, CayleyEdgeData, Group, GroupElement } from '../../core/types'

/** 绘图区首帧（SSR / 尚未测量）的兜底尺寸 */
const FALLBACK_PLOT = { width: 360, height: 320 }
/** 图半径 / 节点半径按绘图区短边自适应（短边 360 时与旧悬浮窗逐像素一致） */
const RADIUS_RATIO = 0.32
const NODE_R_RATIO = 0.044
const BASE_FONT_SIZE = 12
/** 节点标签的群阶上限 */
const LABEL_MAX_ORDER = 36
/** 绘图区短边低于此值不画标签（防糊成一团） */
const LABEL_MIN_SIDE = 180
/** 映射表最多罗列的行数（超出截断） */
const MAPPING_MAX_ROWS = 40

const FIXED_COLOR = 'var(--accent-teal)'
const EMPTY_SEL: Set<string> = new Set()

/** SSR 下用 useEffect（useLayoutEffect 在服务端渲染会告警），客户端用 layout 版防首帧闪 */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface NodePos { x: number; y: number }

export interface AutomorphismSceneProps {
  /** 自同构群 Aut(G)；null / 非自同构群 → 空态 */
  group: Group | null
  /** 选中元素 id 集合（受控）；恰一个且命中自同构时渲染该 α 的作用 */
  selectedElements?: Set<string>
  /** 绘图区可用像素；缺省由 ResizeObserver 自测容器 */
  viewBoxSize?: { width: number; height: number }
  /** 元素映射表开关，缺省 true */
  showMapping?: boolean
  /** 节点悬停 → 宿主（挂就地气泡用）；缺省不挂 */
  onHover?: (el: GroupElement | null) => void
  /** 主题作用域；缺省跟随外层 */
  theme?: SceneTheme
}

export function AutomorphismScene(props: AutomorphismSceneProps) {
  return (
    <SceneThemeRoot theme={props.theme}>
      <AutomorphismSceneBody {...props} />
    </SceneThemeRoot>
  )
}

function AutomorphismSceneBody({
  group,
  selectedElements = EMPTY_SEL,
  viewBoxSize,
  showMapping = true,
  onHover,
}: AutomorphismSceneProps) {
  const { t } = useTranslation()
  const uid = useId()

  // ── 绘图区尺寸：外部给定优先，否则自测容器（空态时容器也在，ref 生命周期稳定） ──
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [measured, setMeasured] = useState({ width: 0, height: 0 })
  useIsoLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setMeasured({ width: r.width, height: r.height })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [group])

  const plotW = viewBoxSize?.width ?? measured.width
  const plotH = viewBoxSize?.height ?? measured.height
  const W = plotW > 0 ? plotW : FALLBACK_PLOT.width
  const H = plotH > 0 ? plotH : FALLBACK_PLOT.height
  const side = Math.min(W, H)
  const nodeR = Math.max(8, Math.round(side * NODE_R_RATIO))
  /** 标签字号随节点半径收敛（大窗 12px，小窗最低 9px，避免标签撑破节点） */
  const fontSize = Math.max(9, Math.min(BASE_FONT_SIZE, Math.round(nodeR * 0.8)))
  const showLabels = side >= LABEL_MIN_SIDE

  // ── 数据解析（全部经 core 门面：自同构群 → 父群 → 选中的自同构） ──
  const parentSymbol = group?.automorphismParentSymbol ?? null
  const parentGroup = useMemo(() => {
    if (!parentSymbol) return null
    try { return createGroupFromSymbol(parentSymbol) } catch { return null }
  }, [parentSymbol])

  const autoById = useMemo(() => getAutomorphismMap(group), [group])
  const selectedId = selectedElements.size === 1 ? [...selectedElements][0] : null
  const automorphism = selectedId ? autoById?.get(selectedId) ?? null : null

  const labelHtml = useMemo(() => {
    const m = new Map<string, string>()
    if (!parentGroup) return m
    for (const el of parentGroup.elements) m.set(el.id, renderTex(texify(el.label)))
    return m
  }, [parentGroup])

  const positions = useMemo(() => {
    if (!parentGroup) return new Map<string, NodePos>()
    return cayleyCircleLayout(parentGroup, W / 2, H / 2, side * RADIUS_RATIO)
  }, [parentGroup, W, H, side])

  const elById = useMemo(
    () => new Map(parentGroup?.elements.map(e => [e.id, e]) ?? []),
    [parentGroup]
  )

  const genImageHtml = useMemo(() => {
    const m = new Map<string, string>()
    if (!parentGroup || !automorphism) return m
    for (const g of parentGroup.generators) {
      const genEl = g.apply(parentGroup.identity)
      const imgId = automorphism.map.get(genEl.id)
      const imgEl = imgId ? elById.get(imgId) : undefined
      m.set(genEl.id, renderTex(texify(imgEl?.label || genEl.label)))
    }
    return m
  }, [parentGroup, automorphism, elById])

  const rewiredActions = useMemo((): CayleyAction[] => {
    if (!parentGroup || !automorphism) return []
    const actions: CayleyAction[] = []
    for (const gen of parentGroup.generators) {
      const genEl = gen.apply(parentGroup.identity)
      const imgId = automorphism.map.get(genEl.id) ?? genEl.id
      const imgEl = elById.get(imgId)
      if (imgEl) actions.push({ elementId: imgEl.id, enabled: true, color: gen.color })
    }
    return actions
  }, [parentGroup, automorphism, elById])

  const rewiredEdges = useMemo(() => {
    if (!parentGroup || rewiredActions.length === 0) return []
    return computeCayleyActionEdges(parentGroup, rewiredActions, 'right')
  }, [parentGroup, rewiredActions])

  const autoTitleHtml = useMemo(
    () => (automorphism ? renderTex(texify(automorphism.label)) : ''),
    [automorphism]
  )

  const view = parentGroup && automorphism ? { parentGroup, automorphism, order: parentGroup.order } : null
  const fixedCount = view
    ? [...view.automorphism.map.entries()].filter(([k, v]) => k === v).length
    : 0
  const mappingRows = useMemo(() => {
    if (!parentGroup || !automorphism) return [] as Array<[string, string]>
    return [...automorphism.map.entries()]
      .filter(([k, v]) => parentGroup.order <= 20 || k !== v)
      .slice(0, MAPPING_MAX_ROWS)
  }, [parentGroup, automorphism])

  const emptyText = !group
    ? t('canvas.noGroup')
    : !parentSymbol
      ? t('automorphismView.notAutomorphism')
      : !parentGroup
        ? t('automorphismView.parentUnavailable', { symbol: parentSymbol })
        : !automorphism
          ? t('automorphismView.noSelection', { symbol: parentSymbol })
          : null

  return (
    <div
      data-testid="automorphism-scene"
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-primary)', color: 'var(--text-primary)',
        overflow: 'hidden', minHeight: 0,
      }}
    >
      {/* 头部：α 标签（TeX）+ 自同构群符号 */}
      {view && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px 2px', flexShrink: 0 }}>
          <span style={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: autoTitleHtml }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aut({parentSymbol})</span>
        </div>
      )}

      {/* 生成元行：每个生成元的像 α(g)（颜色 = 原生成元色） */}
      {view && (
        <div style={{
          display: 'flex', gap: 6, padding: '0 10px 4px', fontSize: 10,
          color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        }}>
          <span>{t('automorphismView.gen')}</span>
          {view.parentGroup.generators.map((g, i) => {
            const genEl = g.apply(view.parentGroup.identity)
            return (
              <span key={i} style={{ color: g.color, fontWeight: 600 }}
                dangerouslySetInnerHTML={{ __html: genImageHtml.get(genEl.id) ?? '' }} />
            )
          })}
        </div>
      )}

      {/* 绘图区（同时是尺寸探针；空态时也保留容器，使 ref 生命周期稳定） */}
      <div
        ref={plotRef}
        style={{
          flex: '1 1 auto', minHeight: 0, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {view ? (
          <svg
            data-testid="automorphism-plot"
            viewBox={`0 0 ${W} ${H}`}
            width="100%" height="100%"
            style={{ display: 'block', userSelect: 'none', background: 'var(--bg-primary)' }}
          >
            <defs>
              {rewiredActions.map((action, idx) => (
                <marker key={idx} id={`${uid}-arrow-${idx}`} markerWidth={8} markerHeight={8}
                  refX={7} refY={3} orient="auto" markerUnits="strokeWidth">
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
                const scy = fromPos.y - nodeR - 12
                return (
                  <g key={`${edge.fromId}-${edge.actionElementId}`} data-loop-of={edge.fromId} data-self-loop="1">
                    <ellipse cx={scx} cy={scy} rx={10} ry={8} fill="none" stroke={`${edge.color}88`} strokeWidth={1.5} />
                    <polygon points={`${scx - 4},${scy - 1} ${scx + 4},${scy - 1} ${scx},${scy - 10}`} fill={edge.color} />
                  </g>
                )
              }
              const startX = fromPos.x + (dx / dist) * nodeR
              const startY = fromPos.y + (dy / dist) * nodeR
              const endX = toPos.x - (dx / dist) * nodeR
              const endY = toPos.y - (dy / dist) * nodeR
              const actionIdx = rewiredActions.findIndex(a => a.elementId === edge.actionElementId)
              const markerId = actionIdx >= 0 ? `${uid}-arrow-${actionIdx}` : undefined
              return (
                <line key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
                  x1={startX} y1={startY} x2={endX} y2={endY}
                  stroke={`${edge.color}66`} strokeWidth={1.5}
                  markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
                  opacity={0.8} />
              )
            })}

            {view.parentGroup.elements.map(el => {
              const pos = positions.get(el.id)
              if (!pos) return null
              const fixed = view.automorphism.map.get(el.id) === el.id
              return (
                <g
                  key={el.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={onHover ? () => onHover(el) : undefined}
                  onMouseLeave={onHover ? () => onHover(null) : undefined}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    data-el-id={el.id}
                    data-fixed={fixed ? '1' : undefined}
                    r={nodeR}
                    fill={fixed ? `${FIXED_COLOR}22` : 'var(--node-fill)'}
                    stroke={fixed ? FIXED_COLOR : 'var(--node-stroke)'}
                    strokeWidth={fixed ? 2 : 1.5}
                  />
                  {showLabels && view.order <= LABEL_MAX_ORDER && (
                    <foreignObject x={-nodeR} y={-14} width={nodeR * 2} height={28}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '100%', height: '100%',
                        color: fixed ? FIXED_COLOR : 'var(--node-text)',
                        fontSize: `${fontSize}px`, fontWeight: fixed ? 600 : 400,
                      }} dangerouslySetInnerHTML={{ __html: labelHtml.get(el.id) ?? '' }} />
                    </foreignObject>
                  )}
                </g>
              )
            })}
          </svg>
        ) : (
          <div style={{
            padding: 12, fontSize: 12, color: 'var(--text-muted)',
            textAlign: 'center', lineHeight: 1.6, maxWidth: 320,
          }}>
            {emptyText}
          </div>
        )}
      </div>

      {/* 元素映射表 α: x ↦ α(x)（小窗或大群时隐藏，避免挤占图形） */}
      {view && showMapping && showLabels && view.order <= LABEL_MAX_ORDER && view.automorphism.map.size > 0 && (
        <div
          data-testid="automorphism-mapping"
          style={{
            padding: '6px 8px', borderTop: '1px solid var(--border-subtle)',
            fontSize: 10, maxHeight: 120, overflowY: 'auto', flexShrink: 0,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: '2px 6px', alignItems: 'center' }}>
            {mappingRows.map(([srcId, tgtId]) => {
              const srcEl = elById.get(srcId)
              const tgtEl = elById.get(tgtId)
              return (
                <Fragment key={srcId}>
                  <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: srcEl ? (labelHtml.get(srcEl.id) ?? '') : srcId }} />
                  <span style={{ color: 'var(--text-muted)' }}>↦</span>
                  <span style={{ textAlign: 'left', color: srcId === tgtId ? FIXED_COLOR : 'var(--text-special)' }}
                    dangerouslySetInnerHTML={{ __html: tgtEl ? (labelHtml.get(tgtEl.id) ?? '') : tgtId }} />
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* 不动 / 移动计数 */}
      {view && (
        <div
          data-testid="automorphism-counts"
          style={{
            padding: '2px 8px 4px', fontSize: 9, color: 'var(--text-muted)',
            textAlign: 'center', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          }}
        >
          <span style={{ color: FIXED_COLOR }}>●</span>{' '}
          {t('automorphismView.fixedMoved', { fixed: fixedCount, moved: view.order - fixedCount })}
        </div>
      )}
    </div>
  )
}

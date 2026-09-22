/* eslint-disable react-refresh/only-export-components */
// renderViewContent（非组件分发函数）必须与它私有的 4 个包装组件同文件——拆开反而
// 迫使包装组件全部导出。跟随 context 层既有先例，文件级 disable。
// ── 懒加载视图分发与窗口内包装组件（自 FloatingViewWindow.tsx 拆出，纯搬家）──
// renderViewContent 是老式 FloatingViewWindow（context 壳）的内容分发；
// 新式 ViewWindow（受控 props）有自己的 renderContent，不经过这里。
import { useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useGroup } from '../../../context/useGroup'
import { useHover } from '../../../context/core/HoverContext'
import { useTranslation } from '../../../i18n/useTranslation'
import type { ViewMode, CayleyEdgeData } from '../../../core/types'
import { computeCayleyActionEdges, cayleyCircleLayout, circleLayoutRadius } from '../../../core/algebra/forceLayout'
import { texify, renderTex } from '../../../utils/texify'
import { listCosetStripSubgroups, type CosetStripSubgroupOption } from '../../../core/algebra/cosetStrip'
import { ENUMERATION_LIMIT } from '../../../core/guards'
import { SetViewFromContext } from '../SetViewFromContext'
import { CycleViewFromContext } from '../CycleViewFromContext'
import { TableViewFromContext } from '../TableViewFromContext'
import { SubgroupLatticeView } from '../SubgroupLatticeView'
import { HomomorphismView } from '../HomomorphismView'
import { ActionView } from '../ActionView'
import { SylowView } from '../SylowView'
import { PresentationTableView } from '../PresentationTableView'
import { SymmetryView } from '../SymmetryView'
import { CosetStripScene } from '../CosetStripScene'

const Cayley3DViewLazy = lazy(() => import('../Cayley3DView').then(m => ({ default: m.Cayley3DView })))
const FreeGroupTreeViewLazy = lazy(() => import('../FreeGroupTreeView').then(m => ({ default: m.FreeGroupTreeView })))

function CayleyGraphViewLocal() {
  const { currentGroup, selectedElements, selectElement, getNodePosition, setNodePosition, canvasTransform, viewBoxSize, cayleyActions, cayleyMultiplyType, subsets } = useGroup()
  const { setHoverElement } = useHover()
  const { t } = useTranslation()

  const nodeRadius = 28
  const cx = currentGroup ? viewBoxSize.width / 2 : 0
  const cy = currentGroup ? viewBoxSize.height / 2 : 0
  // 窗口 viewBox 是内容区尺寸（宽 > 高常见），半径须同时受高度约束，否则上下节点出画布
  const graphRadius = currentGroup
    ? circleLayoutRadius(viewBoxSize.width, viewBoxSize.height, currentGroup.order, nodeRadius)
    : 0
  const n = currentGroup ? currentGroup.order : 0

  const circLayout = useMemo(() => {
    if (!currentGroup) return new Map<string, { x: number; y: number }>()
    return cayleyCircleLayout(currentGroup, cx, cy, graphRadius)
  }, [cx, cy, graphRadius, currentGroup])

  const edges = useMemo(() => currentGroup ? computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType) : [], [currentGroup, cayleyActions, cayleyMultiplyType])

  const isLargeGraph = n > 60

  const subsetDetailMap = useMemo(() => {
    const m = new Map<string, typeof subsets[0]>()
    subsets.forEach(s => s.elementIds.forEach(id => { if (!m.has(id)) m.set(id, s) }))
    return m
  }, [subsets])

  const enabledActions = cayleyActions.filter(a => a.enabled)
  const enabledActionIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    enabledActions.forEach((a, idx) => m.set(a.elementId, idx))
    return m
  }, [enabledActions])

  const getNodePos = useCallback((elId: string) => {
    const defPos = circLayout.get(elId)
    if (!defPos) return { x: cx, y: cy }
    const saved = getNodePosition(elId)
    if (saved && (Math.abs(saved.x - defPos.x) > 1 || Math.abs(saved.y - defPos.y) > 1)) {
      return saved
    }
    return defPos
  }, [circLayout, cx, cy, getNodePosition])

  const nodePositionsCache = useMemo(() => {
    const cache = new Map<string, { x: number; y: number }>()
    currentGroup?.elements.forEach((el) => {
      cache.set(el.id, getNodePos(el.id))
    })
    return cache
  }, [currentGroup, getNodePos])

  if (!currentGroup) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-dim)' }}>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`} style={{ width: '100%', height: '100%', userSelect: 'none', background: 'var(--bg-primary)' }}>
      <defs>
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
        </filter>
        {enabledActions.map((action, idx) => (
          <marker key={idx} id={`fv-arrow-${idx}`} markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={action.color} />
          </marker>
        ))}
      </defs>
      
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edges.map((edge: CayleyEdgeData) => {
          const fromPos = nodePositionsCache.get(edge.fromId)
          const toPos = nodePositionsCache.get(edge.toId)
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
                <polygon points={`${scx-5},${scy-2} ${scx+5},${scy-2} ${scx},${scy-14}`} fill={baseColor} />
              </g>
            )
          }
          
          const midX = (fromPos.x + toPos.x) / 2
          const midY = (fromPos.y + toPos.y) / 2
          const nx = -dy / dist
          const ny = dx / dist
          
          const curvature = 35
          const ctrlX = midX + nx * curvature
          const ctrlY = midY + ny * curvature
          
          const startX = fromPos.x + (dx / dist) * nodeRadius
          const startY = fromPos.y + (dy / dist) * nodeRadius
          const endX = toPos.x - (dx / dist) * nodeRadius
          const endY = toPos.y - (dy / dist) * nodeRadius
          
          const actionIdx = enabledActionIndexMap.get(edge.actionElementId) ?? 0
          const markerId = `fv-arrow-${actionIdx}`

          return (
            <path
              key={`${edge.fromId}-${edge.toId}-${edge.actionElementId}`}
              d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
              stroke={color}
              strokeWidth={isHighlighted ? 3.5 : 2.5}
              fill="none"
              markerEnd={edge.isBidirectional ? undefined : `url(#${markerId})`}
              opacity={0.9}
            />
          )
        })}
        
        {currentGroup.elements.map((el) => {
          const pos = getNodePos(el.id)
          const isSelected = selectedElements.has(el.id)
          const parentSubset = subsetDetailMap.get(el.id)
          
          let fillColor = 'var(--node-fill)'
          let strokeColor = 'var(--node-stroke)'
          let strokeWidth = 2.5
          
          if (isSelected) {
            fillColor = 'var(--node-fill-selected)'
            strokeColor = '#ffd93d'
            strokeWidth = 3
          } else if (parentSubset) {
            fillColor = parentSubset.color + '33'
            strokeColor = parentSubset.color
            strokeWidth = 2.5
          }
          
          return (
            <g
              key={el.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={(e) => {
                e.stopPropagation()
                selectElement(el.id, e.ctrlKey || e.metaKey)
              }}
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.stopPropagation()
                  const svg = e.currentTarget.closest('svg')
                  if (!svg) return
                  const svgRect = svg.getBoundingClientRect()
                  const vw = viewBoxSize.width
                  const vh = viewBoxSize.height
                  const scaleX = vw / svgRect.width
                  const scaleY = vh / svgRect.height
                  
                  const startX2 = (e.clientX - svgRect.left) * scaleX
                  const startY2 = (e.clientY - svgRect.top) * scaleY
                  const startPos = getNodePos(el.id)
                  const initialOffsetX = startPos.x
                  const initialOffsetY = startPos.y
                  
                  const handleMove = (moveEvent: MouseEvent) => {
                    const currentX = (moveEvent.clientX - svgRect.left) * scaleX
                    const currentY = (moveEvent.clientY - svgRect.top) * scaleY
                    const newX = initialOffsetX + (currentX - startX2) / canvasTransform.scale
                    const newY = initialOffsetY + (currentY - startY2) / canvasTransform.scale
                    setNodePosition(el.id, newX, newY)
                  }
                  
                  const handleUp = () => {
                    window.removeEventListener('mousemove', handleMove)
                    window.removeEventListener('mouseup', handleUp)
                  }
                  
                  window.addEventListener('mousemove', handleMove)
                  window.addEventListener('mouseup', handleUp)
                }
              }}
              onMouseEnter={() => setHoverElement(el)}
              onMouseLeave={() => setHoverElement(null)}
              style={{ cursor: 'grab' }}
            >
              <circle
                r={nodeRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                filter="url(#node-shadow)"
              />
              {parentSubset && (
                <circle
                  r={nodeRadius}
                  fill={`${parentSubset.color}22`}
                  stroke="none"
                />
              )}
              {(!isLargeGraph || isSelected || selectedElements.size === 0) && (
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
                       width: '100%', height: '100%', color: 'var(--node-text)', fontSize: isLargeGraph ? '10px' : '15px'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderTex(texify(el.label))
                    }}
                  />
                </foreignObject>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function TableZoomable({ children }: { children: React.ReactNode }) {
  const [tableZoom, setTableZoom] = useState(1)
  const [tablePan, setTablePan] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTableZoom(prev => Math.max(0.25, Math.min(10, prev * factor)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('text') || (e.target as HTMLElement).closest('rect')) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: tablePan.x, py: tablePan.y }
  }, [tablePan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    setTablePan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    })
  }, [])

  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])

  // 双击空白处复位缩放与平移（表头/单元格上双击不触发，保留交互）
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('text') || (e.target as HTMLElement).closest('rect')) return
    setTableZoom(1)
    setTablePan({ x: 0, y: 0 })
  }, [])

  return (
    <div
      style={{
        width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translate(${tablePan.x}px, ${tablePan.y}px) scale(${tableZoom})`,
        transformOrigin: 'center center',
      }}>
        {children}
      </div>
    </div>
  )
}

function SvgPanZoom({ children }: { children: React.ReactNode }) {
  const { canvasTransform, setCanvasTransform, viewBoxSize, resetCanvasTransform } = useGroup()
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const svgEl = containerRef.current.querySelector('svg')
    const vb = svgEl?.viewBox?.baseVal
    const vw = vb && vb.width > 0 ? vb.width : viewBoxSize.width
    const vh = vb && vb.height > 0 ? vb.height : viewBoxSize.height
    const scale = Math.min(rect.width / vw, rect.height / vh)
    const offX = (rect.width - vw * scale) / 2
    const offY = (rect.height - vh * scale) / 2
    const mouseX = (e.clientX - rect.left - offX) / scale
    const mouseY = (e.clientY - rect.top - offY) / scale
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.25, Math.min(8, canvasTransform.scale * scaleFactor))
    const scaleChange = newScale / canvasTransform.scale
    const newX = mouseX - (mouseX - canvasTransform.x) * scaleChange
    const newY = mouseY - (mouseY - canvasTransform.y) * scaleChange
    setCanvasTransform({ x: newX, y: newY, scale: newScale })
  }, [canvasTransform, setCanvasTransform, viewBoxSize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, tx: canvasTransform.x, ty: canvasTransform.y }
  }, [canvasTransform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setCanvasTransform({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy })
  }, [setCanvasTransform])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // 双击空白处复位 pan/zoom（节点上双击不触发，保留选中语义）
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    resetCanvasTransform()
  }, [resetCanvasTransform])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {children}
    </div>
  )
}

/** 窗口内陪集条带（老式窗口路径）。
 *
 * 窗口里**没有**右侧子群面板，因此不能只依赖主画布的陪集状态 —— 旧实现直接渲染
 * `CosetStripView`（context 壳），用户没在主画布选过子群时窗口只会显示「在右侧面板
 * 点击一个子群」，指向一个窗口内不存在的交互（2026-09-17 修）。
 * 现在：全局已有陪集数据时原样沿用；没有则自动取首个候选子群（自包含兜底）。 */
function CosetStripWindowView() {
  const { t } = useTranslation()
  const {
    currentGroup, selectedElements, selectElement, canvasTransform, viewBoxSize,
    cosetElementMap, cosetColors, cosetHighlightSet, subsets,
  } = useGroup()
  const { setHoverElement } = useHover()
  const fallbackIds = useMemo(
    () => (currentGroup ? listCosetStripSubgroups(currentGroup)[0]?.elementIds : undefined),
    [currentGroup],
  )
  const hasGlobal = !!cosetElementMap && cosetElementMap.size > 0
  const noCandidate = !hasGlobal && !fallbackIds
  // 空态分两种成因，说清楚用户才知道下一步能做什么（旧实现一律吐英文
  // `Local subgroup enumeration is limited to groups of order ≤ 144`，中文界面
  // 下既是外文、对 C₂ 这类素数阶群又是误导——它们并非「太大枚举不了」，
  // 而是根本没有非平凡真子群）：
  //   · 群阶 > ENUMERATION_LIMIT → 本地枚举超限；
  //   · 否则 → 该群没有非平凡真子群（单群 / 素数阶群）。
  const noCosetsText = !noCandidate
    ? undefined
    : currentGroup && currentGroup.order > ENUMERATION_LIMIT
      ? t('canvas.cosetStripOverEnumerationLimit', { max: String(ENUMERATION_LIMIT) })
      : t('canvas.cosetStripNoProperSubgroup')
  return (
    <CosetStripScene
      group={currentGroup}
      selectedElements={selectedElements}
      canvasTransform={canvasTransform}
      viewBoxSize={viewBoxSize}
      cosetElementMap={hasGlobal ? cosetElementMap : undefined}
      cosetColors={hasGlobal ? cosetColors : undefined}
      cosetHighlightSet={hasGlobal ? cosetHighlightSet : undefined}
      subgroup={hasGlobal ? undefined : fallbackIds}
      subsets={subsets}
      showLabels={true}
      showSubgroupCayley={true}
      noCosetsText={noCosetsText}
      onSelect={selectElement}
      onHover={setHoverElement}
    />
  )
}

export function renderViewContent(view: ViewMode) {
  switch (view) {
    case 'set':
      return <SvgPanZoom><SetViewFromContext /></SvgPanZoom>
    case 'cayley':
      return <SvgPanZoom><CayleyGraphViewLocal /></SvgPanZoom>
    case 'cycle':
      return <SvgPanZoom><CycleViewFromContext /></SvgPanZoom>
    case 'table':
      return <TableZoomable><TableViewFromContext /></TableZoomable>
    case '3d':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><Cayley3DViewLazy /></Suspense>
    case 'symmetry':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><SymmetryView /></Suspense>
    case 'sublattice':
      return <SvgPanZoom><SubgroupLatticeView /></SvgPanZoom>
    case 'homomorphism':
      return <SvgPanZoom><HomomorphismView /></SvgPanZoom>
    case 'cosetstrip':
      return <SvgPanZoom><CosetStripWindowView /></SvgPanZoom>
    case 'action':
      return <SvgPanZoom><ActionView /></SvgPanZoom>
    case 'sylow':
      return <SvgPanZoom><SylowView /></SvgPanZoom>
    case 'tree':
      return <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><FreeGroupTreeViewLazy /></Suspense>
    case 'prestable':
      return <SvgPanZoom><PresentationTableView /></SvgPanZoom>
    default:
      return <SvgPanZoom><SetViewFromContext /></SvgPanZoom>
  }
}

/**
 * 候选子群为空时的说明。阈值取自 guards（曾硬编码 60，与 ENUMERATION_LIMIT=144 脱节）。
 *
 * ⚠ 仅用于**窗口参数面板**（该面板整体是英文文案）。主画布语境（`CosetStripWindowView`，
 * 画布中央的提示）走 i18n：`canvas.cosetStripOverEnumerationLimit` /
 * `canvas.cosetStripNoProperSubgroup` —— 中文界面下不能出现这句英文，且「无非平凡
 * 真子群」与「枚举超限」是两种成因，不能共用一句（2026-09-21 修）。
 */
export const COSETSTRIP_NO_LOCAL_SUBGROUPS = `Local subgroup enumeration is limited to groups of order ≤ ${ENUMERATION_LIMIT}`

/** TeX 结构符号 → unicode（供 <select> 选项纯文本展示）：C_{2}\\times C_{2} → C₂×C₂、D_{4} → D₄ */
function csUnicodeStruct(sym: string): string {
  return sym
    .replace(/\\times /g, '×')
    .replace(/([A-Z])_\{(\d+)\}/g, (_m, ch: string, digs: string) => ch + digs.split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join(''))
}

/** 子群候选 → <select> 选项文本：结构（或兜底 ⟨H⟩）· |H| · [G:H] 条带数 · ×轨道长 */
export function csOptionLabel(o: CosetStripSubgroupOption): string {
  const struct = o.structure ? csUnicodeStruct(o.structure) : `⟨H⟩·${o.order}`
  const orbit = o.orbitSize > 1 ? ` · ×${o.orbitSize}` : ''
  return `${struct} |H|${o.order} · [G:H]${o.index}${orbit}`
}

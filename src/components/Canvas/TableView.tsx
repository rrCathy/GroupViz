import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { isTooLarge } from '../../core/viewBox'
import { findAllSubgroups } from '../../core/algebra/subgroups'
import { triggerDownload } from '../../utils/export'
import type { CanvasTransform, Group, GroupElement, Subset } from '../../core/types'
import type { CosetInfo } from '../../core/algebra/subgroups'
import type { TableStrategy } from '../../core/types/viewConfig'

const elementColors = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6',
  '#3498db', '#e67e22', '#1abc9c', '#e74c3c', '#2ecc71',
  '#f39c12', '#8e44ad', '#3071a9', '#d35400', '#c0392b'
]

// 完整表格（网格 + 行表头 + 列表头 + 页脚）的 viewBox 内容尺寸余量
export const TABLE_PAD_W = 44   // 行表头 ~38px + 右侧小余量
export const TABLE_PAD_H = 74   // 列表头 ~16px + 页脚 ~50px + 余量

// 热力图大群聚合：超过该阶数的热力图 full 策略降采样为众数色块缩略图，
// 既用颜色密度呈现乘法表宏观结构，又将渲染成本恒定在 HEATMAP_AGG_RES² 量级。
const HEATMAP_AGG_THRESHOLD = 60
const HEATMAP_AGG_RES = 80

export interface TableViewProps {
  group: Group | null
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  viewBoxSize: { width: number; height: number }
  /** 子集（含子群标记），用于子群/非子群着色；缺省空 */
  subsets?: Subset[]
  cosetElementMap?: Map<string, number>
  cosetColors?: string[]
  cosetData?: CosetInfo | null
  cosetType?: 'left' | 'right'
  showAllCosets?: boolean
  /** 大群告警已解除（对应主画布 forceShowLargeGroupViews.has('table')）；缺省 false */
  forceShowLargeGroup?: boolean
  /** 解除大群告警回调；缺省使用本地状态 */
  onForceShowLargeGroup?: (allow: boolean) => void
  /** 大群（>16 阶）展示策略；缺省 'subgroup' */
  strategy?: TableStrategy
  /** 单元格尺寸；缺省 50 */
  cellSize?: number
  /** 热力图模式：只显示颜色，不显示元素和行/列表头；缺省 false */
  showHeatmap?: boolean
  /** 策略被内部 UI 切换时回传（供外部 viewParams 同步） */
  onStrategyChange?: (s: TableStrategy) => void
  /** 实际渲染的表格内容尺寸回传（行数×cellSize + 表头/页脚），用于 ViewWindow 设定最小窗口尺寸；
   *  大群告警/全屏占位时回传 null（无表格可显示） */
  onLayoutSize?: (size: { width: number; height: number } | null) => void
  onSelect?: (elId: string, additive: boolean) => void
  onHover?: (el: GroupElement | null) => void
  noGroupText?: string
}

interface SubgroupPick {
  indices: number[]
  label: string
  order: number
}

const EMPTY_IDX_MAP = new Map<string, number>()
const EMPTY_SUBSETS: Subset[] = []

function pickRandomSample(group: Group, idToIdx: Map<string, number>): number[] {
  const n = group.order
  const set = new Set<number>([idToIdx.get(group.identity.id) ?? 0])
  const target = Math.max(set.size, Math.min(n, 6 + Math.floor(Math.random() * 7)))
  const pool: number[] = []
  for (let i = 0; i < n; i++) {
    if (!set.has(i)) pool.push(i)
  }
  while (set.size < target && pool.length > 0) {
    const r = Math.floor(Math.random() * pool.length)
    set.add(pool[r])
    pool.splice(r, 1)
  }
  return [...set].sort((a, b) => a - b)
}

function pickSubgroup(group: Group, idToIdx: Map<string, number>, subsets: Subset[]): SubgroupPick | null {
  const byKey = new Map<string, SubgroupPick>()
  const add = (indices: number[], label: string) => {
    const key = [...indices].sort((a, b) => a - b).join(',')
    if (!byKey.has(key)) {
      byKey.set(key, { indices: [...indices], label, order: indices.length })
    }
  }

  for (const s of subsets) {
    if (!s.isSubgroup || s.elementIds.length < 2 || s.elementIds.length > 16) continue
    const idxs: number[] = []
    let ok = true
    for (const elId of s.elementIds) {
      const idx = idToIdx.get(elId)
      if (idx === undefined) {
        ok = false
        break
      }
      idxs.push(idx)
    }
    if (ok) add(idxs, s.label)
  }

  const { elements, identity, multiply } = group
  for (const el of elements) {
    if (el.id === identity.id) continue
    let g = el
    let order = 1
    while (order < 17 && g.id !== identity.id) {
      g = multiply(g, el)
      order++
    }
    if (g.id === identity.id && order >= 2 && order <= 16) {
      const idxs: number[] = []
      g = el
      for (let k = 0; k < order; k++) {
        const idx = idToIdx.get(g.id)
        if (idx !== undefined) idxs.push(idx)
        g = multiply(g, el)
      }
      add(idxs, `⟨${el.label}⟩`)
    }
  }

  if (group.order <= 60) {
    for (const sg of findAllSubgroups(group)) {
      if (sg.order < 2 || sg.order > 16) continue
      const idxs: number[] = []
      let ok = true
      for (const el of sg.elements) {
        const idx = idToIdx.get(el.id)
        if (idx === undefined) {
          ok = false
          break
        }
        idxs.push(idx)
      }
      if (!ok) continue
      const genLabels = sg.generators.map(gr => gr.label).join(', ')
      add(idxs, sg.order === 1 ? '{e}' : `⟨${genLabels}⟩`)
    }
  }

  const cands = [...byKey.values()]
  const preferred = cands.filter(c => c.order >= 6 && c.order <= 12)
  const pool = preferred.length > 0 ? preferred : cands
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function TableView({
  group,
  selectedElements,
  viewBoxSize,
  canvasTransform,
  subsets: subsetsProp,
  cosetElementMap,
  cosetColors,
  cosetData: cosetDataProp,
  cosetType: cosetTypeProp,
  showAllCosets: showAllCosetsProp,
  forceShowLargeGroup,
  onForceShowLargeGroup,
  strategy: strategyProp,
  cellSize: cellSizeProp,
  showHeatmap = false,
  onStrategyChange,
  onLayoutSize,
  onSelect,
  onHover,
  noGroupText,
}: TableViewProps) {
  const { t } = useTranslation()
  const subsets = subsetsProp ?? EMPTY_SUBSETS
  const cem = cosetElementMap ?? EMPTY_IDX_MAP
  const cosetData = cosetDataProp ?? null
  const cosetType = cosetTypeProp ?? 'left'
  const showAllCosets = showAllCosetsProp ?? false

  const isLargeTable = group ? group.order > 16 : false

  const [strategy, setStrategy] = useState<TableStrategy>(() => strategyProp ?? 'subgroup')
  const [reroll, setReroll] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [fsScale, setFsScale] = useState(1)
  const [fsDragging, setFsDragging] = useState(false)
  const [fsScroll, setFsScroll] = useState({ l: 0, t: 0 })
  const [fsViewport, setFsViewport] = useState({ w: 0, h: 0 })
  const fsBodyRef = useRef<HTMLDivElement>(null)
  const fsScrollRaf = useRef(0)
  const fsSvgRef = useRef<SVGSVGElement>(null)
  const fsDragRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)

  // 大群告警：外部受控（主画布）优先，否则本地状态兜底（ViewWindow）
  const [localForceShow, setLocalForceShow] = useState(false)
  const forceShow = forceShowLargeGroup ?? localForceShow
  const requestForceShow = useCallback(() => {
    if (onForceShowLargeGroup) onForceShowLargeGroup(true)
    else setLocalForceShow(true)
  }, [onForceShowLargeGroup])

  // 外部 strategy 受控同步：渲染期比对 props 变化（参数面板驱动），避免 effect 内 setState
  const [prevStrategyProp, setPrevStrategyProp] = useState<TableStrategy | undefined>(strategyProp)
  if (strategyProp !== prevStrategyProp) {
    setPrevStrategyProp(strategyProp)
    if (strategyProp !== undefined) setStrategy(strategyProp)
  }

  const applyStrategy = useCallback((s: TableStrategy) => {
    setStrategy(s)
    onStrategyChange?.(s)
  }, [onStrategyChange])

  const idToIdx = useMemo(() => {
    if (!group) return new Map<string, number>()
    const m = new Map<string, number>()
    group.elements.forEach((el, i) => m.set(el.id, i))
    return m
  }, [group])

  const labelToIdx = useMemo(() => {
    if (!group) return new Map<string, number>()
    const m = new Map<string, number>()
    group.elements.forEach((el, i) => m.set(el.label, i))
    return m
  }, [group])

  const table = useMemo(() => {
    if (!group) return null
    const { elements, multiply } = group
    const n = elements.length
    const tableData: { label: string; id: string }[][] = []
    for (let i = 0; i < n; i++) {
      const row: { label: string; id: string }[] = []
      for (let j = 0; j < n; j++) {
        const result = multiply(elements[j], elements[i])
        row.push({ label: result.label, id: result.id })
      }
      tableData.push(row)
    }
    return tableData
  }, [group])

  const getElementColor = (label: string): string => {
    const idx = labelToIdx.get(label)
    if (idx === undefined) return '#ccc'
    return elementColors[idx % elementColors.length]
  }

  const selectedIndices = useMemo(() => {
    const set = new Set<number>()
    selectedElements.forEach(id => {
      const idx = idToIdx.get(id)
      if (idx !== undefined) set.add(idx)
    })
    return set
  }, [selectedElements, idToIdx])

  const subgroupIndexSets = useMemo(() => {
    if (!group) return [] as { color: string; indices: Set<number> }[]
    return subsets
      .filter(s => s.isSubgroup)
      .map(s => {
        const indices = new Set<number>()
        s.elementIds.forEach(elId => {
          const idx = idToIdx.get(elId)
          if (idx !== undefined) indices.add(idx)
        })
        return { color: s.color, indices }
      })
  }, [subsets, idToIdx, group])

  const nonSubgroupSubsetIndices = useMemo(() => {
    const set = new Set<number>()
    for (const subset of subsets) {
      if (subset.isSubgroup) continue
      for (const elId of subset.elementIds) {
        const idx = idToIdx.get(elId)
        if (idx !== undefined) set.add(idx)
      }
    }
    return set
  }, [subsets, idToIdx])

  const subsetElemMap = useMemo(() => {
    const map = new Map<number, { color: string; isSubgroup: boolean }>()
    for (const subset of subsets) {
      for (const elId of subset.elementIds) {
        const idx = idToIdx.get(elId)
        if (idx !== undefined) {
          if (!map.has(idx)) {
            map.set(idx, { color: subset.color, isSubgroup: subset.isSubgroup })
          }
        }
      }
    }
    return map
  }, [subsets, idToIdx])

  const subgroupCellColors = useMemo(() => {
    if (!group) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const sg of subgroupIndexSets) {
      for (const ri of sg.indices) {
        for (const ci of sg.indices) {
          map.set(`${ri},${ci}`, sg.color)
        }
      }
    }
    return map
  }, [subgroupIndexSets, group])

  const cosetSubgroupIndices = useMemo(() => {
    const set = new Set<number>()
    if (!group || !cosetData) return set
    for (const el of cosetData.subgroup.elements) {
      const idx = idToIdx.get(el.id)
      if (idx !== undefined) set.add(idx)
    }
    return set
  }, [group, cosetData, idToIdx])

  const cosetActiveRowIds = useMemo(() => {
    if (!group || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'left' ? cosetData.leftCosets : cosetData.rightCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [group, cosetData, showAllCosets, cosetType, selectedElements])

  const cosetActiveColIds = useMemo(() => {
    if (!group || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'right' ? cosetData.rightCosets : cosetData.leftCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [group, cosetData, showAllCosets, cosetType, selectedElements])

  const elementsInAnySubgroup = useMemo(() => {
    const set = new Set<number>()
    for (const sg of subgroupIndexSets) {
      for (const i of sg.indices) set.add(i)
    }
    return set
  }, [subgroupIndexSets])

  const subgroupInfo = useMemo(() => {
    if (!group || !isLargeTable || strategy !== 'subgroup') return null
    return pickSubgroup(group, idToIdx, subsets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, isLargeTable, strategy, subsets, idToIdx, reroll])

  const randomSample = useMemo(() => {
    if (!group || !isLargeTable) return [] as number[]
    return pickRandomSample(group, idToIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, isLargeTable, idToIdx, reroll])

  const strategyIndices = useMemo(() => {
    if (!group) return [] as number[]
    if (!isLargeTable) return group.elements.map((_, i) => i)
    if (strategy === 'full') return group.elements.map((_, i) => i)
    if (strategy === 'random') return randomSample
    return subgroupInfo ? subgroupInfo.indices : randomSample
  }, [group, isLargeTable, strategy, subgroupInfo, randomSample])

  // 热力图 full 大群聚合：把 n×n 乘法表降采样到固定分辨率的众数色块网格。
  // 每个聚合色块覆盖原表一个矩形区域，颜色取该区域结果元素的众数。
  const heatmapAgg = useMemo(() => {
    if (!group || !table || !(showHeatmap && strategy === 'full' && group.order > HEATMAP_AGG_THRESHOLD)) return null
    const n = group.order
    const res = Math.min(HEATMAP_AGG_RES, n)
    const grid: number[][] = []
    for (let ai = 0; ai < res; ai++) {
      const r0 = Math.floor((ai * n) / res)
      const r1 = Math.floor(((ai + 1) * n) / res)
      const rowArr = new Array<number>(res)
      for (let aj = 0; aj < res; aj++) {
        const c0 = Math.floor((aj * n) / res)
        const c1 = Math.floor(((aj + 1) * n) / res)
        const counter = new Map<number, number>()
        for (let i = r0; i < r1; i++) {
          const row = table[i]
          for (let j = c0; j < c1; j++) {
            const v = idToIdx.get(row[j].id) ?? 0
            counter.set(v, (counter.get(v) ?? 0) + 1)
          }
        }
        let mode = idToIdx.get(table[r0][c0].id) ?? 0
        let best = -1
        for (const [v, c] of counter) {
          if (c > best) { best = c; mode = v }
        }
        rowArr[aj] = mode
      }
      grid.push(rowArr)
    }
    return grid
  }, [group, table, idToIdx, showHeatmap, strategy])

  // 向宿主上报实际渲染表格的内容尺寸（供 ViewWindow 设定最小窗口尺寸）：
  // 大群告警 / 全屏占位时不渲染网格，回传 null（不强制窗口大小）
  const cellSize = cellSizeProp ?? 50
  // 热力图自适应 cell：显示「全表」（小群全表 或 大群 full 策略）时，cell 无需容纳文字，
  // 自适应缩小使整表在 viewBox 内可见，但不超过 cellSize 上限（不放大）。
  // 这样热力图窗口无论缩到多小都能看清整体色块模式（核心价值）。
  const isFullTable = group !== null && (!isLargeTable || strategy === 'full')
  const heatmapAutoFit = showHeatmap && isFullTable
  const heatmapRenderDim = heatmapAgg ? heatmapAgg.length : strategyIndices.length
  const fitCell = Math.max(4, Math.floor((Math.min(viewBoxSize.width, viewBoxSize.height) - 60) / Math.max(1, heatmapRenderDim)))
  const renderCell = heatmapAutoFit ? Math.min(cellSize, fitCell) : cellSize
  // 热力图（纯色块 + 聚合缩略图）可展示更大群，阈值放宽到 240；普通乘法表（文字）保持 100
  const tableBlocked = group ? isTooLarge(group.order, showHeatmap ? 'heatmap' : 'table') && !forceShow : false
  // 热力图模式下的 full 策略不占位：纯色 cell 直接渲染整表，无需进入全屏
  const tablePlaceholder = !showHeatmap && isLargeTable && strategy === 'full' && !!group && group.order > 30 && !fullscreenOpen
  useEffect(() => {
    if (!group || !table) { onLayoutSize?.(null); return }
    if (tableBlocked || tablePlaceholder) { onLayoutSize?.(null); return }
    const k = heatmapAgg ? heatmapAgg.length : strategyIndices.length
    const padW = showHeatmap ? 0 : TABLE_PAD_W
    const padH = showHeatmap ? 40 : TABLE_PAD_H
    onLayoutSize?.({ width: k * renderCell + padW, height: k * renderCell + padH })
  }, [group, table, tableBlocked, tablePlaceholder, strategyIndices.length, heatmapAgg, renderCell, onLayoutSize, showHeatmap])

  const exitFullscreen = useCallback(() => {
    setFullscreenOpen(false)
    applyStrategy('subgroup')
  }, [applyStrategy])

  useEffect(() => {
    if (!fullscreenOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreenOpen, exitFullscreen])

  useEffect(() => {
    if (fullscreenOpen) {
      const body = fsBodyRef.current
      if (body) {
        body.scrollLeft = 0
        body.scrollTop = 0
      }
    }
  }, [fullscreenOpen])

  const openFullscreen = () => {
    setFsScale(1)
    setFullscreenOpen(true)
  }

  const handleStrategy = (s: TableStrategy) => {
    if (s === strategy) {
      setReroll(r => r + 1)
      return
    }
    if (s === 'full') {
      // 热力图模式的 full 策略：纯色 cell 直接渲染，不弹确认框、不进全屏
      if (!showHeatmap && group && group.order > 30) {
        setConfirmOpen(true)
        return
      }
      applyStrategy('full')
      return
    }
    applyStrategy(s)
  }

  const confirmFull = () => {
    setConfirmOpen(false)
    openFullscreen()
  }

  const adjustZoom = useCallback((factor: number, cx?: number, cy?: number) => {
    const body = fsBodyRef.current
    if (!body) return
    const rect = body.getBoundingClientRect()
    const mx = cx ?? rect.width / 2
    const my = cy ?? rect.height / 2
    const px = (body.scrollLeft + mx) / fsScale
    const py = (body.scrollTop + my) / fsScale
    const next = Math.min(6, Math.max(0.25, fsScale * factor))
    setFsScale(next)
    requestAnimationFrame(() => {
      body.scrollLeft = px * next - mx
      body.scrollTop = py * next - my
    })
  }, [fsScale])

  const onFsSlider = (v: number) => {
    adjustZoom(v / 100 / fsScale)
  }

  const onFwPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const body = fsBodyRef.current
    if (!body) return
    fsDragRef.current = { x: e.clientX, y: e.clientY, sl: body.scrollLeft, st: body.scrollTop }
    setFsDragging(true)
    body.setPointerCapture(e.pointerId)
  }

  const onFwPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const body = fsBodyRef.current
    const d = fsDragRef.current
    if (!body || !d) return
    body.scrollLeft = d.sl - (e.clientX - d.x)
    body.scrollTop = d.st - (e.clientY - d.y)
  }

  const onFwPointerUp = () => {
    fsDragRef.current = null
    setFsDragging(false)
  }

  const onFsScroll = useCallback(() => {
    const body = fsBodyRef.current
    if (!body || fsScrollRaf.current) return
    fsScrollRaf.current = requestAnimationFrame(() => {
      fsScrollRaf.current = 0
      setFsScroll({ l: body.scrollLeft, t: body.scrollTop })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (fsScrollRaf.current) cancelAnimationFrame(fsScrollRaf.current)
    }
  }, [])

  useEffect(() => {
    if (!fullscreenOpen) return
    const body = fsBodyRef.current
    if (!body) return
    const update = () => setFsViewport({ w: body.clientWidth, h: body.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(body)
    return () => ro.disconnect()
  }, [fullscreenOpen])

  const exportFullscreen = () => {
    const svg = fsSvgRef.current
    if (!svg || !group) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    const vb = (svg.getAttribute('viewBox') || '0 0 800 600').trim().split(/\s+/).map(Number)
    clone.setAttribute('width', String(vb[2] || 800))
    clone.setAttribute('height', String(vb[3] || 600))
    clone.removeAttribute('style')
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    })
    const sym = group.symbol.replace(/[^A-Za-z0-9]+/g, '_')
    triggerDownload(blob, `table_${sym}_${group.order}x${group.order}.svg`)
  }

  if (!group || !table) {
    return (
      <div className="view-empty">
        <p>{noGroupText ?? t('canvas.noGroup')}</p>
      </div>
    )
  }

  if (isTooLarge(group.order, 'table') && !forceShow) {
    return (
      <div className="large-group-warning">
        <p>{t('canvas.orderTooLarge', { n: group.order })}</p>
        <button className="panel-btn" onClick={requestForceShow}>
          {t('canvas.show')}
        </button>
      </div>
    )
  }

  const { elements } = group

  const tableWidth = heatmapRenderDim * renderCell
  const tableHeight = heatmapRenderDim * renderCell
  const vw = viewBoxSize.width
  const vh = viewBoxSize.height
  const offsetX = vw / 2 - tableWidth / 2
  const offsetY = vh / 2 - tableHeight / 2

  const caption = isLargeTable
    ? strategy === 'subgroup' && subgroupInfo
      ? t('table.subgroupCaption', { label: subgroupInfo.label, order: subgroupInfo.order })
      : strategy === 'random'
        ? t('table.randomCaption', { n: strategyIndices.length })
        : strategy === 'full' && heatmapAgg
          ? t('table.heatmapAggCaption', { n: group.order, res: heatmapAgg.length })
          : ''
    : ''

  const showFullPlaceholder = !showHeatmap && isLargeTable && strategy === 'full' && group.order > 30 && !fullscreenOpen

  if (showFullPlaceholder) {
    return (
      <>
        <div className="table-strategy-bar">
          {(['subgroup', 'random', 'full'] as TableStrategy[]).map(s => (
            <button
              key={s}
              className={`table-strategy-btn${strategy === s ? ' active' : ''}`}
              onClick={() => handleStrategy(s)}
            >
              {s === 'subgroup'
                ? t('table.strategy.subgroup')
                : s === 'random'
                  ? t('table.strategy.random')
                  : t('table.strategy.full')}
            </button>
          ))}
        </div>
        <div className="large-group-warning">
          <p>{t('table.fullPlaceholderMsg', { n: group.order })}</p>
          <button className="panel-btn" onClick={openFullscreen}>
            {t('table.fullEnter')}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {isLargeTable && (
        <div className="table-strategy-bar">
          {(['subgroup', 'random', 'full'] as TableStrategy[]).map(s => (
            <button
              key={s}
              className={`table-strategy-btn${strategy === s ? ' active' : ''}`}
              onClick={() => handleStrategy(s)}
            >
              {s === 'subgroup'
                ? t('table.strategy.subgroup')
                : s === 'random'
                  ? t('table.strategy.random')
                  : t('table.strategy.full')}
            </button>
          ))}
          {caption && <span className="table-strategy-caption">{caption}</span>}
        </div>
      )}

      <svg viewBox={`0 0 ${vw} ${vh}`} className="view-svg" style={{ userSelect: 'none' }}>
        <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale}) translate(${offsetX}, ${offsetY})`}>

          {/* Row headers — hidden in heatmap mode */}
          {!showHeatmap && strategyIndices.map((rowIdx, ri) => {
            const rowEl = elements[rowIdx]
            const isSelected = selectedIndices.has(rowIdx)
            const sInfo = subsetElemMap.get(rowIdx)
            const inSubgroup = elementsInAnySubgroup.has(rowIdx)
            const cosetMode = cosetData !== null
            const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
            const rowCosetIdx = cem.get(rowEl.id)
            const rowCosetHl = rowIsCosetAnchor && rowCosetIdx !== undefined

            let headerFill = elementColors[rowIdx % elementColors.length]
            let bg: string | null = null
            if (!cosetMode && isSelected) bg = '#ffd93d33'
            else if (rowCosetHl) bg = (cosetColors ?? [])[rowCosetIdx] + '33'
            else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
            if (!cosetMode && isSelected) headerFill = '#ffd93d'

            return (
              <g
                key={rowEl.id}
                transform={`translate(0, ${ri * cellSize})`}
                onClick={() => onSelect?.(rowEl.id, true)}
                style={{ cursor: 'pointer' }}
              >
                {bg && (
                  <rect x={-38} y={2} width={33} height={cellSize - 4} fill={bg} rx={4} />
                )}
                <text
                  x={-35}
                  y={cellSize / 2 + 5}
                  textAnchor="end"
                  fill={headerFill}
                  fontSize={14}
                  fontFamily="serif"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  style={{ userSelect: 'none' }}
                >
                  {rowEl.label}
                </text>
              </g>
            )
          })}

          {/* Column headers — hidden in heatmap mode */}
          {!showHeatmap && strategyIndices.map((colIdx, ci) => {
            const colEl = elements[colIdx]
            const isSelected = selectedIndices.has(colIdx)
            const sInfo = subsetElemMap.get(colIdx)
            const inSubgroup = elementsInAnySubgroup.has(colIdx)
            const cosetMode = cosetData !== null
            const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)
            const colCosetIdx = cem.get(colEl.id)
            const colCosetHl = colIsCosetAnchor && colCosetIdx !== undefined

            let headerFill = elementColors[colIdx % elementColors.length]
            let bg: string | null = null
            if (!cosetMode && isSelected) bg = '#ffd93d33'
            else if (colCosetHl) bg = (cosetColors ?? [])[colCosetIdx] + '33'
            else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
            if (!cosetMode && isSelected) headerFill = '#ffd93d'

            return (
              <g
                key={`head-${colEl.id}`}
                onClick={() => onSelect?.(colEl.id, true)}
                style={{ cursor: 'pointer' }}
              >
                {bg && (
                  <rect x={ci * cellSize + 2} y={-16} width={cellSize - 4} height={18} fill={bg} rx={4} />
                )}
                <text
                  x={ci * cellSize + cellSize / 2}
                  y={-12}
                  textAnchor="middle"
                  fill={headerFill}
                  fontSize={14}
                  fontFamily="serif"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  style={{ userSelect: 'none' }}
                >
                  {colEl.label}
                </text>
              </g>
            )
          })}

          {/* Heatmap aggregate thumbnail: downsampled mode-color blocks for large groups */}
          {heatmapAgg && heatmapAgg.map((aggRow, ai) =>
            aggRow.map((resultIdx, aj) => {
              const resultColor = elementColors[resultIdx % elementColors.length]
              const heatGap = renderCell <= 8 ? 0.5 : renderCell <= 20 ? 1 : 2
              const heatR = renderCell <= 8 ? 1 : renderCell <= 20 ? 2 : 3
              return (
                <g
                  key={`agg-${ai}-${aj}`}
                  transform={`translate(${aj * renderCell}, ${ai * renderCell})`}
                >
                  <rect
                    width={renderCell - heatGap}
                    height={renderCell - heatGap}
                    fill={resultColor}
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth={renderCell <= 8 ? 0.2 : 0.5}
                    rx={heatR}
                  />
                </g>
              )
            })
          )}

          {/* Table cells */}
          {!heatmapAgg && strategyIndices.map((rowIdx, ri) =>
            strategyIndices.map((colIdx, ci) => {
              const rowEl = elements[rowIdx]
              const colEl = elements[colIdx]
              const result = table[rowIdx][colIdx]
              const resultColor = getElementColor(result.label)

              const isRowSel = selectedIndices.has(rowIdx)
              const isColSel = selectedIndices.has(colIdx)

              const sgKey = `${rowIdx},${colIdx}`
              const sgColor = subgroupCellColors.get(sgKey)

              const identityIdx = idToIdx.get(group.identity.id) ?? -1
              const nonSubRow = identityIdx >= 0 && rowIdx === identityIdx && nonSubgroupSubsetIndices.has(colIdx)
              const nonSubCol = identityIdx >= 0 && colIdx === identityIdx && nonSubgroupSubsetIndices.has(rowIdx)

              const colInSubgroup = cosetSubgroupIndices.has(colIdx)
              const rowInSubgroup = cosetSubgroupIndices.has(rowIdx)
              const cosetMode = cosetData !== null
              const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
              const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)

              const isLeftCosetCell = cosetType === 'left' && rowIsCosetAnchor && colInSubgroup
              const isRightCosetCell = cosetType === 'right' && colIsCosetAnchor && rowInSubgroup
              const isCosetCell = isLeftCosetCell || isRightCosetCell

              // Heatmap mode: solid fill, thin border
              if (showHeatmap) {
                // 大群热力图：cell 很小时用更小的间隙与圆角，保证色块紧凑、宏观结构清晰
                const heatGap = renderCell <= 8 ? 0.5 : renderCell <= 20 ? 1 : 2
                const heatR = renderCell <= 8 ? 1 : renderCell <= 20 ? 2 : 3
                let cellFill = resultColor
                let cellStroke = 'rgba(0,0,0,0.18)'
                let cellStrokeW = renderCell <= 8 ? 0.2 : 0.5

                if (isCosetCell) {
                  const elId = cosetType === 'left' ? rowEl.id : colEl.id
                  const cIdx = cem.get(elId)
                  const cColor = cIdx !== undefined ? (cosetColors ?? [])[cIdx] : '#888'
                  cellStroke = cColor
                  cellStrokeW = 3
                } else if (sgColor) {
                  cellStroke = sgColor
                  cellStrokeW = 2.5
                } else if (!cosetMode && isRowSel && isColSel) {
                  cellStroke = '#ffd93d'
                  cellStrokeW = 2.5
                } else if (!cosetMode && (isRowSel || isColSel)) {
                  cellStroke = '#ffd93d88'
                  cellStrokeW = 1.5
                } else if (nonSubRow || nonSubCol) {
                  cellFill = 'var(--table-cell-bg)'
                  cellStroke = 'var(--table-cell-border)'
                  cellStrokeW = 1.5
                }

                return (
                  <g
                    key={`${rowEl.id}-${colEl.id}`}
                    transform={`translate(${ci * renderCell}, ${ri * renderCell})`}
                    onClick={() => {
                      const targetEl = elements.find(e => e.id === result.id)
                      if (targetEl) onSelect?.(targetEl.id, true)
                    }}
                    onMouseEnter={() => {
                      const targetEl = elements.find(e => e.id === result.id)
                      if (targetEl) onHover?.(targetEl)
                    }}
                    onMouseLeave={() => onHover?.(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width={renderCell - heatGap}
                      height={renderCell - heatGap}
                      fill={cellFill}
                      stroke={cellStroke}
                      strokeWidth={cellStrokeW}
                      rx={heatR}
                    />
                  </g>
                )
              }

              // Normal table mode: semi-transparent fill + text
              let cellFill = resultColor + '22'
              let cellStroke = resultColor
              let cellStrokeW = 0.5

              if (isCosetCell) {
                const elId = cosetType === 'left' ? rowEl.id : colEl.id
                const cIdx = cem.get(elId)
                const cColor = cIdx !== undefined ? (cosetColors ?? [])[cIdx] : '#888'
                cellFill = cColor + '40'
                cellStroke = cColor
                cellStrokeW = 2.5
              } else if (sgColor) {
                cellFill = sgColor + '28'
                cellStroke = sgColor
                cellStrokeW = 2
              } else if (!cosetMode && isRowSel && isColSel) {
                cellFill = '#ffd93d22'
                cellStroke = '#ffd93d'
                cellStrokeW = 2
              } else if (!cosetMode && (isRowSel || isColSel)) {
                cellFill = '#ffd93d15'
                cellStroke = '#ffd93d88'
                cellStrokeW = 1
              } else if (nonSubRow || nonSubCol) {
                cellFill = 'var(--table-cell-bg)'
                cellStroke = 'var(--table-cell-border)'
                cellStrokeW = 1.5
              }

              return (
                <g
                  key={`${rowEl.id}-${colEl.id}`}
                  transform={`translate(${ci * renderCell}, ${ri * renderCell})`}
                  onClick={() => {
                    const targetEl = elements.find(e => e.id === result.id)
                    if (targetEl) onSelect?.(targetEl.id, true)
                  }}
                  onMouseEnter={() => {
                    const targetEl = elements.find(e => e.id === result.id)
                    if (targetEl) onHover?.(targetEl)
                  }}
                  onMouseLeave={() => onHover?.(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width={renderCell - 2}
                    height={renderCell - 2}
                    fill={cellFill}
                    stroke={cellStroke}
                    strokeWidth={cellStrokeW}
                    rx={4}
                  />
                  <text
                    x={renderCell / 2}
                    y={renderCell / 2 + 5}
                    textAnchor="middle"
                    fill={resultColor}
                    fontSize={13}
                    fontFamily="serif"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {result.label}
                  </text>
                </g>
              )
            })
          )}
        </g>

        <text x={vw / 2} y={tableHeight + offsetY + 35} textAnchor="middle" fill="#666" fontSize={11} style={{ userSelect: 'none' }}>
          {t('table.footer1')}
        </text>

        <text x={vw / 2} y={tableHeight + offsetY + 50} textAnchor="middle" fill="#666" fontSize={10} style={{ userSelect: 'none' }}>
          {t('table.footer2')}
        </text>
      </svg>

      {confirmOpen && (
        <div className="table-confirm-overlay">
          <div className="table-confirm-modal">
            <div className="table-confirm-title">{t('table.fullConfirmTitle')}</div>
            <div className="table-confirm-msg">
              {t('table.fullConfirmMsg', { n: group.order })}
            </div>
            <div className="table-confirm-actions">
              <button className="panel-btn" onClick={() => setConfirmOpen(false)}>
                {t('table.confirmCancel')}
              </button>
              <button className="panel-btn" onClick={confirmFull}>
                {t('table.confirmOk')}
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreenOpen && (
        <div className="table-fullscreen">
          <div className="table-fullscreen-header">
            <div className="table-fullscreen-title">
              {t('table.fullTitle', { symbol: group.symbol, n: group.order })}
            </div>
            <div className="table-fullscreen-toolbar">
              <button
                className="table-fs-btn"
                title={t('table.fullZoomOut')}
                onClick={() => adjustZoom(1 / 1.25)}
              >
                −
              </button>
              <button
                className="table-fs-btn"
                title={t('table.fullZoomIn')}
                onClick={() => adjustZoom(1.25)}
              >
                +
              </button>
              <button
                className="table-fs-btn"
                title={t('table.fullZoomReset')}
                onClick={() => adjustZoom(1 / fsScale)}
              >
                ⟳
              </button>
              <input
                type="range"
                className="table-fs-slider"
                min={25}
                max={600}
                step={1}
                value={Math.round(fsScale * 100)}
                aria-label={t('table.zoomSlider')}
                onChange={(e) => onFsSlider(Number(e.target.value))}
              />
              <button className="panel-btn" onClick={exportFullscreen}>
                {t('table.fullExport')}
              </button>
              <button className="panel-btn" onClick={exitFullscreen}>
                {t('table.fullExit')}
              </button>
            </div>
          </div>
          <div
            className={`table-fullscreen-body${fsDragging ? ' dragging' : ''}`}
            ref={fsBodyRef}
            onScroll={onFsScroll}
            onPointerDown={onFwPointerDown}
            onPointerMove={onFwPointerMove}
            onPointerUp={onFwPointerUp}
            onPointerLeave={onFwPointerUp}
          >
            {(() => {
              const n = group.order
              const fsCell = 32
              const padL = 44
              const padT = 26
              const padB = 34
              const tw = n * fsCell + padL + 16
              const th = n * fsCell + padT + padB
              const fsIdentityIdx = idToIdx.get(group.identity.id) ?? -1
              const fvw = fsViewport.w || 960
              const fvh = fsViewport.h || 600
              const viewL = fsScroll.l / fsScale
              const viewT = fsScroll.t / fsScale
              const viewW = fvw / fsScale
              const viewH = fvh / fsScale
              const buf = 3
              const cStart = Math.max(0, Math.floor((viewL - padL) / fsCell) - buf)
              const cEnd = Math.min(n - 1, Math.ceil((viewL + viewW - padL) / fsCell) + buf)
              const rStart = Math.max(0, Math.floor((viewT - padT) / fsCell) - buf)
              const rEnd = Math.min(n - 1, Math.ceil((viewT + viewH - padT) / fsCell) + buf)
              const rowIdxList = Array.from({ length: rEnd - rStart + 1 }, (_, k) => rStart + k)
              const colIdxList = Array.from({ length: cEnd - cStart + 1 }, (_, k) => cStart + k)
              return (
                <svg
                  ref={fsSvgRef}
                  className="table-fullscreen-svg"
                  viewBox={`0 0 ${tw} ${th}`}
                  style={{ width: tw * fsScale, height: th * fsScale }}
                >
                  <g transform={`translate(${showHeatmap ? 8 : padL}, ${showHeatmap ? 8 : padT})`}>
                    {!showHeatmap && rowIdxList.map((rowIdx) => {
                      const rowEl = elements[rowIdx]
                      return (
                        <text
                          key={`fr-${rowEl.id}`}
                          x={-6}
                          y={rowIdx * fsCell + fsCell / 2 + 4}
                          textAnchor="end"
                          fill={elementColors[rowIdx % elementColors.length]}
                          fontSize={11}
                          fontFamily="serif"
                        >
                          {rowEl.label}
                        </text>
                      )
                    })}
                    {!showHeatmap && colIdxList.map((colIdx) => {
                      const colEl = elements[colIdx]
                      return (
                        <text
                          key={`fc-${colEl.id}`}
                          x={colIdx * fsCell + fsCell / 2}
                          y={-6}
                          textAnchor="middle"
                          fill={elementColors[colIdx % elementColors.length]}
                          fontSize={11}
                          fontFamily="serif"
                        >
                          {colEl.label}
                        </text>
                      )
                    })}
                    {rowIdxList.map(rowIdx =>
                      colIdxList.map(colIdx => {
                        const rowEl = elements[rowIdx]
                        const colEl = elements[colIdx]
                        const result = table[rowIdx][colIdx]
                        const resultColor = getElementColor(result.label)
                        const sgKey = `${rowIdx},${colIdx}`
                        const sgColor = subgroupCellColors.get(sgKey)
                        const isRowSel = selectedIndices.has(rowIdx)
                        const isColSel = selectedIndices.has(colIdx)
                        const nonSubRow = fsIdentityIdx >= 0 && rowIdx === fsIdentityIdx && nonSubgroupSubsetIndices.has(colIdx)
                        const nonSubCol = fsIdentityIdx >= 0 && colIdx === fsIdentityIdx && nonSubgroupSubsetIndices.has(rowIdx)
                        const cosetMode = cosetData !== null
                        const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
                        const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)
                        const colInSubgroup = cosetSubgroupIndices.has(colIdx)
                        const rowInSubgroup = cosetSubgroupIndices.has(rowIdx)
                        const isLeftCosetCell = cosetType === 'left' && rowIsCosetAnchor && colInSubgroup
                        const isRightCosetCell = cosetType === 'right' && colIsCosetAnchor && rowInSubgroup
                        const isCosetCell = isLeftCosetCell || isRightCosetCell

                        if (showHeatmap) {
                          let cellFill = resultColor
                          let cellStroke = 'rgba(0,0,0,0.18)'
                          let cellStrokeW = 0.5

                          if (isCosetCell) {
                            const elId = cosetType === 'left' ? rowEl.id : colEl.id
                            const cIdx = cem.get(elId)
                            const cColor = cIdx !== undefined ? (cosetColors ?? [])[cIdx] : '#888'
                            cellStroke = cColor
                            cellStrokeW = 3
                          } else if (sgColor) {
                            cellStroke = sgColor
                            cellStrokeW = 2.5
                          } else if (!cosetMode && isRowSel && isColSel) {
                            cellStroke = '#ffd93d'
                            cellStrokeW = 2.5
                          } else if (!cosetMode && (isRowSel || isColSel)) {
                            cellStroke = '#ffd93d88'
                            cellStrokeW = 1.5
                          } else if (nonSubRow || nonSubCol) {
                            cellFill = 'var(--table-cell-bg)'
                            cellStroke = 'var(--table-cell-border)'
                            cellStrokeW = 1.5
                          }

                          return (
                            <g key={`${rowEl.id}-${colEl.id}`} transform={`translate(${colIdx * fsCell}, ${rowIdx * fsCell})`}>
                              <rect
                                width={fsCell - 2}
                                height={fsCell - 2}
                                fill={cellFill}
                                stroke={cellStroke}
                                strokeWidth={cellStrokeW}
                                rx={2}
                              />
                            </g>
                          )
                        }

                        let cellFill = resultColor + '30'
                        let cellStroke = resultColor
                        let cellStrokeW = 0.5

                        if (isCosetCell) {
                          const elId = cosetType === 'left' ? rowEl.id : colEl.id
                          const cIdx = cem.get(elId)
                          const cColor = cIdx !== undefined ? (cosetColors ?? [])[cIdx] : '#888'
                          cellFill = cColor + '40'
                          cellStroke = cColor
                          cellStrokeW = 2.5
                        } else if (sgColor) {
                          cellFill = sgColor + '28'
                          cellStroke = sgColor
                          cellStrokeW = 2
                        } else if (!cosetMode && isRowSel && isColSel) {
                          cellFill = '#ffd93d22'
                          cellStroke = '#ffd93d'
                          cellStrokeW = 2
                        } else if (!cosetMode && (isRowSel || isColSel)) {
                          cellFill = '#ffd93d15'
                          cellStroke = '#ffd93d88'
                          cellStrokeW = 1
                        } else if (nonSubRow || nonSubCol) {
                          cellFill = '#ffffff0d'
                          cellStroke = '#8899aa'
                          cellStrokeW = 1.5
                        }

                        return (
                          <g key={`${rowEl.id}-${colEl.id}`} transform={`translate(${colIdx * fsCell}, ${rowIdx * fsCell})`}>
                            <rect
                              width={fsCell - 2}
                              height={fsCell - 2}
                              fill={cellFill}
                              stroke={cellStroke}
                              strokeWidth={cellStrokeW}
                              rx={2}
                            />
                            <text
                              x={fsCell / 2}
                              y={fsCell / 2 + 4}
                              textAnchor="middle"
                              fill={resultColor}
                              fontSize={11}
                              fontFamily="serif"
                              style={{ pointerEvents: 'none' }}
                            >
                              {result.label}
                            </text>
                          </g>
                        )
                      })
                    )}
                  </g>
                  <text
                    x={tw / 2}
                    y={th - 10}
                    textAnchor="middle"
                    fill="#888"
                    fontSize={12}
                  >
                    {t('table.footer1')}
                  </text>
                </svg>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
}

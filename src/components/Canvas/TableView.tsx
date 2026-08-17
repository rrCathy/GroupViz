import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import { isTooLarge } from '../../core/viewBox'
import { findAllSubgroups } from '../../core/algebra/subgroups'
import { triggerDownload } from '../../utils/export'
import type { Group, Subset } from '../../core/types'

const elementColors = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcb77', '#9b59b6',
  '#3498db', '#e67e22', '#1abc9c', '#e74c3c', '#2ecc71',
  '#f39c12', '#8e44ad', '#3071a9', '#d35400', '#c0392b'
]

type TableStrategy = 'subgroup' | 'random' | 'full'

interface SubgroupPick {
  indices: number[]
  label: string
  order: number
}

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

export function TableView() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    viewBoxSize,
    canvasTransform,
    forceShowLargeGroupViews,
    setForceShowLargeGroupForView,
    subsets,
    cosetElementMap,
    cosetColors,
    cosetData,
    cosetType,
    showAllCosets,
  } = useGroup()
  const { setHoverElement } = useHover()
  const { t } = useTranslation()
  const isLargeTable = currentGroup ? currentGroup.order > 16 : false

  const [strategy, setStrategy] = useState<TableStrategy>('subgroup')
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

  const idToIdx = useMemo(() => {
    if (!currentGroup) return new Map<string, number>()
    const m = new Map<string, number>()
    currentGroup.elements.forEach((el, i) => m.set(el.id, i))
    return m
  }, [currentGroup])

  const labelToIdx = useMemo(() => {
    if (!currentGroup) return new Map<string, number>()
    const m = new Map<string, number>()
    currentGroup.elements.forEach((el, i) => m.set(el.label, i))
    return m
  }, [currentGroup])

  const table = useMemo(() => {
    if (!currentGroup) return null
    const { elements, multiply } = currentGroup
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
  }, [currentGroup])

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
    if (!currentGroup) return [] as { color: string; indices: Set<number> }[]
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
  }, [subsets, idToIdx, currentGroup])

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
    if (!currentGroup) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const sg of subgroupIndexSets) {
      for (const ri of sg.indices) {
        for (const ci of sg.indices) {
          map.set(`${ri},${ci}`, sg.color)
        }
      }
    }
    return map
  }, [subgroupIndexSets, currentGroup])

  const cosetSubgroupIndices = useMemo(() => {
    const set = new Set<number>()
    if (!currentGroup || !cosetData) return set
    for (const el of cosetData.subgroup.elements) {
      const idx = idToIdx.get(el.id)
      if (idx !== undefined) set.add(idx)
    }
    return set
  }, [currentGroup, cosetData, idToIdx])

  const cosetActiveRowIds = useMemo(() => {
    if (!currentGroup || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'left' ? cosetData.leftCosets : cosetData.rightCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [currentGroup, cosetData, showAllCosets, cosetType, selectedElements])

  const cosetActiveColIds = useMemo(() => {
    if (!currentGroup || !cosetData) return new Set<string>()
    if (showAllCosets) {
      const reps = new Set<string>()
      const cosets = cosetType === 'right' ? cosetData.rightCosets : cosetData.leftCosets
      for (const coset of cosets) {
        if (coset.length > 0) reps.add(coset[0].id)
      }
      return reps
    }
    return new Set(selectedElements)
  }, [currentGroup, cosetData, showAllCosets, cosetType, selectedElements])

  const elementsInAnySubgroup = useMemo(() => {
    const set = new Set<number>()
    for (const sg of subgroupIndexSets) {
      for (const i of sg.indices) set.add(i)
    }
    return set
  }, [subgroupIndexSets])

  const subgroupInfo = useMemo(() => {
    if (!currentGroup || !isLargeTable || strategy !== 'subgroup') return null
    return pickSubgroup(currentGroup, idToIdx, subsets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup, isLargeTable, strategy, subsets, idToIdx, reroll])

  const randomSample = useMemo(() => {
    if (!currentGroup || !isLargeTable) return [] as number[]
    return pickRandomSample(currentGroup, idToIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup, isLargeTable, idToIdx, reroll])

  const strategyIndices = useMemo(() => {
    if (!currentGroup) return [] as number[]
    if (!isLargeTable) return currentGroup.elements.map((_, i) => i)
    if (strategy === 'full') return currentGroup.elements.map((_, i) => i)
    if (strategy === 'random') return randomSample
    return subgroupInfo ? subgroupInfo.indices : randomSample
  }, [currentGroup, isLargeTable, strategy, subgroupInfo, randomSample])

  const exitFullscreen = useCallback(() => {
    setFullscreenOpen(false)
    setStrategy('subgroup')
  }, [])

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
      if (currentGroup && currentGroup.order > 30) {
        setConfirmOpen(true)
        return
      }
      setStrategy('full')
      return
    }
    setStrategy(s)
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
    if (!svg || !currentGroup) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    const vb = (svg.getAttribute('viewBox') || '0 0 800 600').trim().split(/\s+/).map(Number)
    clone.setAttribute('width', String(vb[2] || 800))
    clone.setAttribute('height', String(vb[3] || 600))
    clone.removeAttribute('style')
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    })
    const sym = currentGroup.symbol.replace(/[^A-Za-z0-9]+/g, '_')
    triggerDownload(blob, `table_${sym}_${currentGroup.order}x${currentGroup.order}.svg`)
  }

  if (!currentGroup || !table) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  if (isTooLarge(currentGroup.order, 'table') && !forceShowLargeGroupViews.has('table')) {
    return (
      <div className="large-group-warning">
        <p>{t('canvas.orderTooLarge', { n: currentGroup.order })}</p>
        <button className="panel-btn" onClick={() => setForceShowLargeGroupForView('table', true)}>
          {t('canvas.show')}
        </button>
      </div>
    )
  }

  const { elements } = currentGroup

  const cellSize = 50
  const tableWidth = strategyIndices.length * cellSize
  const tableHeight = strategyIndices.length * cellSize
  const vw = viewBoxSize.width
  const vh = viewBoxSize.height
  const offsetX = vw / 2 - tableWidth / 2
  const offsetY = vh / 2 - tableHeight / 2

  const caption = isLargeTable
    ? strategy === 'subgroup' && subgroupInfo
      ? t('table.subgroupCaption', { label: subgroupInfo.label, order: subgroupInfo.order })
      : strategy === 'random'
        ? t('table.randomCaption', { n: strategyIndices.length })
        : ''
    : ''

  const showFullPlaceholder = isLargeTable && strategy === 'full' && currentGroup.order > 30 && !fullscreenOpen

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
          <p>{t('table.fullPlaceholderMsg', { n: currentGroup.order })}</p>
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

          {/* Row headers */}
          {strategyIndices.map((rowIdx, ri) => {
            const rowEl = elements[rowIdx]
            const isSelected = selectedIndices.has(rowIdx)
            const sInfo = subsetElemMap.get(rowIdx)
            const inSubgroup = elementsInAnySubgroup.has(rowIdx)
            const cosetMode = cosetData !== null
            const rowIsCosetAnchor = cosetActiveRowIds.has(rowEl.id)
            const rowCosetIdx = cosetElementMap.get(rowEl.id)
            const rowCosetHl = rowIsCosetAnchor && rowCosetIdx !== undefined

            let headerFill = elementColors[rowIdx % elementColors.length]
            let bg: string | null = null
            if (!cosetMode && isSelected) bg = '#ffd93d33'
            else if (rowCosetHl) bg = cosetColors[rowCosetIdx] + '33'
            else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
            if (!cosetMode && isSelected) headerFill = '#ffd93d'

            return (
              <g
                key={rowEl.id}
                transform={`translate(0, ${ri * cellSize})`}
                onClick={() => selectElement(rowEl.id, true)}
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

          {/* Column headers */}
          {strategyIndices.map((colIdx, ci) => {
            const colEl = elements[colIdx]
            const isSelected = selectedIndices.has(colIdx)
            const sInfo = subsetElemMap.get(colIdx)
            const inSubgroup = elementsInAnySubgroup.has(colIdx)
            const cosetMode = cosetData !== null
            const colIsCosetAnchor = cosetActiveColIds.has(colEl.id)
            const colCosetIdx = cosetElementMap.get(colEl.id)
            const colCosetHl = colIsCosetAnchor && colCosetIdx !== undefined

            let headerFill = elementColors[colIdx % elementColors.length]
            let bg: string | null = null
            if (!cosetMode && isSelected) bg = '#ffd93d33'
            else if (colCosetHl) bg = cosetColors[colCosetIdx] + '33'
            else if (!cosetMode && inSubgroup && sInfo) bg = sInfo.color + '33'
            if (!cosetMode && isSelected) headerFill = '#ffd93d'

            return (
              <g
                key={`head-${colEl.id}`}
                onClick={() => selectElement(colEl.id, true)}
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

          {/* Table cells */}
          {strategyIndices.map((rowIdx, ri) =>
            strategyIndices.map((colIdx, ci) => {
              const rowEl = elements[rowIdx]
              const colEl = elements[colIdx]
              const result = table[rowIdx][colIdx]
              const resultColor = getElementColor(result.label)

              const isRowSel = selectedIndices.has(rowIdx)
              const isColSel = selectedIndices.has(colIdx)

              const sgKey = `${rowIdx},${colIdx}`
              const sgColor = subgroupCellColors.get(sgKey)

              const identityIdx = idToIdx.get(currentGroup.identity.id) ?? -1
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

              let cellFill = resultColor + '22'
              let cellStroke = resultColor
              let cellStrokeW = 0.5

              if (isCosetCell) {
                const elId = cosetType === 'left' ? rowEl.id : colEl.id
                const cIdx = cosetElementMap.get(elId)
                const cColor = cIdx !== undefined ? cosetColors[cIdx] : '#888'
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
                  transform={`translate(${ci * cellSize}, ${ri * cellSize})`}
                  onClick={() => {
                    const targetEl = elements.find(e => e.id === result.id)
                    if (targetEl) selectElement(targetEl.id, true)
                  }}
                  onMouseEnter={() => {
                    const targetEl = elements.find(e => e.id === result.id)
                    if (targetEl) setHoverElement(targetEl)
                  }}
                  onMouseLeave={() => setHoverElement(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill={cellFill}
                    stroke={cellStroke}
                    strokeWidth={cellStrokeW}
                    rx={4}
                  />
                  <text
                    x={cellSize / 2}
                    y={cellSize / 2 + 5}
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
              {t('table.fullConfirmMsg', { n: currentGroup.order })}
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
              {t('table.fullTitle', { symbol: currentGroup.symbol, n: currentGroup.order })}
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
              const n = currentGroup.order
              const fsCell = 32
              const padL = 44
              const padT = 26
              const padB = 34
              const tw = n * fsCell + padL + 16
              const th = n * fsCell + padT + padB
              const fsIdentityIdx = idToIdx.get(currentGroup.identity.id) ?? -1
              const vw = fsViewport.w || 960
              const vh = fsViewport.h || 600
              const viewL = fsScroll.l / fsScale
              const viewT = fsScroll.t / fsScale
              const viewW = vw / fsScale
              const viewH = vh / fsScale
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
                  <g transform={`translate(${padL}, ${padT})`}>
                    {rowIdxList.map((rowIdx) => {
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
                    {colIdxList.map((colIdx) => {
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

                        let cellFill = resultColor + '30'
                        let cellStroke = resultColor
                        let cellStrokeW = 0.5

                        if (isCosetCell) {
                          const elId = cosetType === 'left' ? rowEl.id : colEl.id
                          const cIdx = cosetElementMap.get(elId)
                          const cColor = cIdx !== undefined ? cosetColors[cIdx] : '#888'
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
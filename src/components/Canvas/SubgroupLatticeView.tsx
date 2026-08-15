import { useMemo, useCallback, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import {
  computeSubgroupLattice,
  getGroupCenter,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from '../../core/algebra/subgroups'
import { texify, renderTex } from '../../utils/texify'
import { factorizeOrder } from '../../core/algebra/sylow'
import {
  computeChainFactors,
  type SeriesType,
  type SeriesFactor,
} from '../../core/algebra/series'
import type { GroupElement } from '../../core/types'

const SERIES_COLORS: Record<SeriesType, { light: string; dark: string }> = {
  derived: { light: '#b8860b', dark: '#ffd93d' },
  upperCentral: { light: '#0e7490', dark: '#22d3ee' },
  lowerCentral: { light: '#0e7490', dark: '#22d3ee' },
  composition: { light: '#7c3aed', dark: '#c084fc' },
}

function findPath(
  edges: SubgroupLatticeEdge[],
  start: number,
  end: number
): number[] | null {
  if (start === end) return [start]
  const visited = new Set<number>()
  const queue: number[][] = [[start]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const last = path[path.length - 1]
    if (last === end) return path
    if (visited.has(last)) continue
    visited.add(last)
    for (const e of edges) {
      if (e.from === last && !visited.has(e.to)) {
        queue.push([...path, e.to])
      }
      if (e.to === last && !visited.has(e.from)) {
        queue.push([...path, e.from])
      }
    }
  }
  return null
}

export function SubgroupLatticeView() {
  const {
    currentGroup,
    selectElement,
    clearSelection,
    canvasTransform,
    subsets,
    backendCache,
    isLargeGroup,
    seriesType,
    seriesData,
    compositionChains,
    compositionTruncated,
    activeChainIdx,
    seriesFlags,
  } = useGroup()
  const { t } = useTranslation()
  const { theme } = useTheme()

  const palette = useMemo(() => {
    if (theme === 'light') {
      return {
        edge: '#a9adbc',
        edgeOpacity: 0.95,
        edgeWidth: 2.5,
        pathEdge: '#d4a017',
        pathEdgeWidth: 4,
        nodeFill: '#eef1f5',
        nodeStroke: '#2d8f85',
        nodeStrokeNormal: '#7c5cc0',
        nodeText: '#1c1c28',
        nodeSubText: '#5a5a6a',
        pathFill: '#fbf1d0',
        pathStroke: '#d4a017',
        pathText: '#7a5d00',
        pathSubText: '#8a6d00cc',
        activeFill: '#d8ecda',
        trivialFill: '#e8e8f1',
        trivialStroke: '#9a9ab0',
        fullFill: '#e7edf7',
        fullStroke: '#3a6fb0',
        centerFill: '#fdf3c7',
        centerStroke: '#b8860b',
        sylowText: '#c2410c',
      }
    }
    return {
      edge: '#4a4a7a',
      edgeOpacity: 0.85,
      edgeWidth: 2.5,
      pathEdge: '#ffd93d',
      pathEdgeWidth: 4,
      nodeFill: '#151f1a',
      nodeStroke: '#3ea89e',
      nodeStrokeNormal: '#8968c8',
      nodeText: '#ddd',
      nodeSubText: '#777',
      pathFill: '#1e3a1e',
      pathStroke: '#ffd93d',
      pathText: '#ffd93d',
      pathSubText: '#ffd93dcc',
      activeFill: '#2a4a2a',
      trivialFill: '#1a1a2e',
      trivialStroke: '#555',
      fullFill: '#1a1f30',
      fullStroke: '#5588cc',
      centerFill: '#3a3020',
      centerStroke: '#ffd93d',
      sylowText: '#fb923c',
    }
  }, [theme])

  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null)

  const latticeData = useMemo(() => {
    if (!currentGroup) return null
    if (isLargeGroup && backendCache.lattice) {
      return backendCache.lattice as { nodes: SubgroupLatticeNode[]; edges: SubgroupLatticeEdge[] }
    }
    if (isLargeGroup) return null
    return computeSubgroupLattice(currentGroup)
  }, [currentGroup, isLargeGroup, backendCache.lattice])

  const { nodePositions, viewW, viewH, nodeRx, nodeRy } = useMemo(() => {
    if (!latticeData) {
      return { nodePositions: [] as { x: number; y: number }[], viewW: 1200, viewH: 800, nodeRx: 80, nodeRy: 36 }
    }

    const nodes = latticeData.nodes
    let maxLevel = 0
    let maxPerLevelCount = 0

    nodes.forEach((nd) => {
      if (nd.level > maxLevel) maxLevel = nd.level
    })

    const levelCounts = new Map<number, number>()
    const levelIdx = new Array<number>(nodes.length).fill(0)

    nodes.forEach((nd, i) => {
      const cur = levelCounts.get(nd.level) || 0
      levelIdx[i] = cur
      levelCounts.set(nd.level, cur + 1)
      if (cur + 1 > maxPerLevelCount) maxPerLevelCount = cur + 1
    })

    const nrx = 80
    const nry = 36
    const gapX = 40
    const gapY = 60
    const vw = Math.max(1000, maxPerLevelCount * (nrx * 2 + gapX) + 160)
    const vh = Math.max(600, (maxLevel + 1) * (nry * 2 + gapY) + 120)

    const topPad = vh * 0.08
    const usableH = vh - topPad * 2

    const positions = nodes.map((nd, i) => {
      const count = levelCounts.get(nd.level) || 1
      const idx = levelIdx[i]
      const y = topPad + nd.level * (usableH / Math.max(maxLevel, 1))
      const x = count === 1
        ? vw / 2
        : vw * 0.1 + vw * 0.8 * (idx / Math.max(count - 1, 1))
      return { x, y }
    })

    return { nodePositions: positions, viewW: vw, viewH: vh, nodeRx: nrx, nodeRy: nry }
  }, [latticeData])

  const { fullIdx, trivialIdx } = useMemo(() => {
    if (!latticeData) return { fullIdx: -1, trivialIdx: -1 }
    const nodes = latticeData.nodes
    const order = currentGroup?.order ?? 0
    return {
      fullIdx: nodes.findIndex(nd => nd.order === order),
      trivialIdx: nodes.findIndex(nd => nd.order === 1),
    }
  }, [latticeData, currentGroup])

  const centerIdx = useMemo(() => {
    if (!latticeData || !currentGroup) return -1
    const center = backendCache.center ?? getGroupCenter(currentGroup, isLargeGroup)
    const centerSet = new Set(center.map(e => e.id))
    return latticeData.nodes.findIndex(nd => {
      if (nd.elementIds.length !== centerSet.size) return false
      return nd.elementIds.every(id => centerSet.has(id))
    })
  }, [latticeData, currentGroup, backendCache.center, isLargeGroup])

  const sylowOrderToP = useMemo(() => {
    if (!currentGroup) return new Map<number, number>()
    const map = new Map<number, number>()
    for (const { prime, exponent } of factorizeOrder(currentGroup.order)) {
      let pPower = 1
      for (let i = 0; i < exponent; i++) pPower *= prime
      map.set(pPower, prime)
    }
    return map
  }, [currentGroup])

  const pathIndices = useMemo(() => {
    if (activeNodeIdx === null || !latticeData) return new Set<number>()
    const edges = latticeData.edges

    const upPath = fullIdx >= 0 ? findPath(edges, activeNodeIdx, fullIdx) : null
    const downPath = trivialIdx >= 0 ? findPath(edges, activeNodeIdx, trivialIdx) : null

    const set = new Set<number>()
    if (upPath) upPath.forEach(i => set.add(i))
    if (downPath) downPath.forEach(i => set.add(i))
    return set
  }, [activeNodeIdx, latticeData, fullIdx, trivialIdx])

  const pathEdgeSet = useMemo(() => {
    if (!latticeData) return new Set<number>()
    const edgeSet = new Set<number>()
    for (let ei = 0; ei < latticeData.edges.length; ei++) {
      const e = latticeData.edges[ei]
      if (pathIndices.has(e.from) && pathIndices.has(e.to)) {
        edgeSet.add(ei)
      }
    }
    return edgeSet
  }, [pathIndices, latticeData])

  const seriesColor = useMemo(() => {
    if (!seriesType) return null
    const c = SERIES_COLORS[seriesType]
    return theme === 'light' ? c.light : c.dark
  }, [seriesType, theme])

  const seriesTerms = useMemo<GroupElement[][] | null>(() => {
    if (!currentGroup || !seriesType) return null
    if (seriesType === 'composition') {
      if (!compositionChains || compositionChains.length === 0) return null
      return compositionChains[Math.min(activeChainIdx, compositionChains.length - 1)] ?? null
    }
    return seriesData?.terms ?? null
  }, [currentGroup, seriesType, seriesData, compositionChains, activeChainIdx])

  const seriesFactors = useMemo<SeriesFactor[] | null>(() => {
    if (!currentGroup || !seriesTerms || !seriesType) return null
    if (seriesType === 'composition') return computeChainFactors(currentGroup, seriesTerms, true)
    return seriesData?.factors ?? null
  }, [currentGroup, seriesType, seriesTerms, seriesData])

  // lattice node index -> term index of the active series chain
  const seriesNodeMap = useMemo(() => {
    const map = new Map<number, number>()
    if (!latticeData || !seriesTerms) return map
    const keyToIdx = new Map<string, number>()
    latticeData.nodes.forEach((nd, i) => {
      const k = [...nd.elementIds].sort().join(',')
      if (!keyToIdx.has(k)) keyToIdx.set(k, i)
    })
    seriesTerms.forEach((term, ti) => {
      const k = term.map(e => e.id).sort().join(',')
      const ni = keyToIdx.get(k)
      if (ni !== undefined) map.set(ni, ti)
    })
    return map
  }, [latticeData, seriesTerms])

  // nodes on the connecting paths between consecutive terms + edges along them
  const seriesNodeSet = useMemo(() => new Set(seriesNodeMap.keys()), [seriesNodeMap])

  const seriesLines = useMemo(() => {
    if (!seriesColor || !latticeData) return null
    const byTerm = [...seriesNodeMap.entries()].sort((a, b) => a[1] - b[1])
    const lines: { from: { x: number; y: number }; to: { x: number; y: number } }[] = []
    for (let i = 0; i + 1 < byTerm.length; i++) {
      const fromPos = nodePositions[byTerm[i][0]]
      const toPos = nodePositions[byTerm[i + 1][0]]
      if (fromPos && toPos) lines.push({ from: fromPos, to: toPos })
    }
    return lines
  }, [seriesColor, seriesNodeMap, nodePositions, latticeData])

  const seriesSolvable = useMemo(() => {
    if (!seriesType) return false
    if (seriesType === 'composition') return seriesFlags?.solvable ?? false
    return seriesData?.solvable ?? false
  }, [seriesType, seriesData, seriesFlags])

  const seriesNilpotent = useMemo(() => {
    if (!seriesType) return false
    if (seriesType === 'composition') return seriesFlags?.nilpotent ?? false
    return seriesData?.nilpotent ?? false
  }, [seriesType, seriesData, seriesFlags])

  const handleNodeClick = useCallback(
    (nodeIdx: number, node: SubgroupLatticeNode, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!currentGroup) return

      if (activeNodeIdx === nodeIdx) {
        clearSelection()
        setActiveNodeIdx(null)
      } else {
        clearSelection()
        node.elementIds.forEach(id => selectElement(id, true))
        setActiveNodeIdx(nodeIdx)
      }
    },
    [currentGroup, activeNodeIdx, selectElement, clearSelection]
  )

  if (!currentGroup || !latticeData) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const edgeElements = latticeData.edges.map((edge, i) => {
    const fromPos = nodePositions[edge.from]
    const toPos = nodePositions[edge.to]
    if (!fromPos || !toPos) return null
    const onPath = pathEdgeSet.has(i)
    return (
      <line
        key={`edge-${i}`}
        x1={fromPos.x}
        y1={fromPos.y + nodeRy}
        x2={toPos.x}
        y2={toPos.y - nodeRy}
        stroke={onPath ? palette.pathEdge : palette.edge}
        strokeWidth={onPath ? palette.pathEdgeWidth : palette.edgeWidth}
        opacity={onPath ? 1 : palette.edgeOpacity}
      />
    )
  })

  const nodeElements = latticeData.nodes.map((node, i) => {
    const pos = nodePositions[i]
    if (!pos) return null

    const onPath = pathIndices.has(i)
    const isActive = activeNodeIdx === i
    const isTrivial = node.order === 1
    const isFull = node.order === (currentGroup.order)
    const isCenter = i === centerIdx
    const sylowP = node.order > 1 ? sylowOrderToP.get(node.order) : undefined
    const termIdx = seriesNodeMap.get(i)
    const isDimmed = seriesTerms !== null && termIdx === undefined && !seriesNodeSet.has(i)

    let fillColor = palette.nodeFill
    let strokeColor = node.isNormal ? palette.nodeStrokeNormal : palette.nodeStroke
    let strokeWidth = 2.5
    let textColor = palette.nodeText

    if (onPath && !(termIdx !== undefined && seriesColor)) {
      fillColor = palette.pathFill
      strokeColor = palette.pathStroke
      strokeWidth = 4
      textColor = palette.pathText
    }
    if (isActive) {
      fillColor = palette.activeFill
      strokeWidth = 4
    }
    if (isCenter && !onPath) {
      fillColor = palette.centerFill
      strokeColor = palette.centerStroke
    }
    if (isTrivial && !onPath) {
      fillColor = palette.trivialFill
      strokeColor = palette.trivialStroke
      strokeWidth = 2
    }
    if (isFull && !onPath) {
      fillColor = palette.fullFill
      strokeColor = palette.fullStroke
    }
    if (termIdx !== undefined && seriesColor) {
      strokeColor = seriesColor
      strokeWidth = 4
    }

    const parentSubset = subsets.find(s =>
      node.elementIds.every(eid => s.elementIds.includes(eid))
    )

    return (
      <g
        key={node.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => handleNodeClick(i, node, e)}
        style={{ cursor: 'pointer', opacity: isDimmed ? 0.22 : 1 }}
      >
        <rect
          x={-nodeRx}
          y={-nodeRy}
          width={nodeRx * 2}
          height={nodeRy * 2}
          rx={12}
          ry={12}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        {parentSubset && !onPath && (
          <rect
            x={-nodeRx}
            y={-nodeRy}
            width={nodeRx * 2}
            height={nodeRy * 2}
            rx={12}
            ry={12}
            fill={`${parentSubset.color}22`}
            stroke="none"
          />
        )}
        <text
          y={-8}
          textAnchor="middle"
          fill={textColor}
          fontSize="15px"
          fontWeight={isActive ? 'bold' : 'normal'}
          fontFamily="monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {isTrivial ? '⟨e⟩' : isFull ? '' : `|H|=${node.order}`}
        </text>
        {isCenter && (
          <text
            x={nodeRx - 6}
            y={-nodeRy + 12}
            textAnchor="end"
            fill={palette.centerStroke}
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            Z(G)
          </text>
        )}
        {sylowP !== undefined && (
          <text
            x={-nodeRx + 6}
            y={-nodeRy + 12}
            textAnchor="start"
            fill={palette.sylowText}
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {t('lattice.sylow', { p: String(sylowP) })}
          </text>
        )}
        {termIdx !== undefined && seriesColor && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={-nodeRx + 12} cy={nodeRy - 12} r={9} fill={seriesColor} stroke="none" />
            <text
              x={-nodeRx + 12}
              y={nodeRy - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill={theme === 'light' ? '#fff' : '#111'}
              fontFamily="monospace"
            >
              {termIdx}
            </text>
          </g>
        )}
        {isFull && (
          <foreignObject
            x={-nodeRx + 6}
            y={-nodeRy + 2}
            width={nodeRx * 2 - 12}
            height={nodeRy * 2 - 4}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', color: textColor, fontSize: '15px',
              }}
              dangerouslySetInnerHTML={{
                __html: renderTex(texify(currentGroup.symbol))
              }}
            />
          </foreignObject>
        )}
        <text
          y={13}
          textAnchor="middle"
          fill={onPath ? palette.pathSubText : node.isNormal ? palette.nodeStrokeNormal : palette.nodeSubText}
          fontSize="11px"
          fontFamily="monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {isTrivial ? t('lattice.trivial') : isFull ? `|G|=${currentGroup.order}` : node.isNormal ? `◁ ${t('badge.normal')}` : t('lattice.subgroup')}
        </text>
      </g>
    )
  })

  const chipSolvable = theme === 'light' ? '#15803d' : '#4ade80'
  const chipNilpotent = theme === 'light' ? '#0369a1' : '#38bdf8'

  const chainTeX = seriesTerms
    ? seriesTerms.map((term, ti) => {
        const label = term.length === 1
          ? '\\langle e \\rangle'
          : term.length === currentGroup.order
            ? texify(currentGroup.symbol)
            : `N_{${ti}}`
        return (ti === 0 ? '' : ' \\trianglerighteq ') + label
      }).join('')
    : ''
  const ordersTeX = seriesTerms
    ? seriesTerms.map((term, ti) => `|N_{${ti}}| = ${term.length}`).join(',\\;')
    : ''
  const factorsTeX = seriesFactors
    ? seriesFactors.map((f, i) => `N_{${i}}/N_{${i + 1}} \\cong ${f.label}`).join(',\\;')
    : ''
  const multisetText = seriesFactors
    ? [...seriesFactors]
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
        .map(f => f.label)
        .join(', ')
    : ''

  return (
    <div className="sublattice-view-wrap" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="view-svg"
        style={{ flex: 1, minHeight: 0, userSelect: 'none' }}
      >
        <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
          {edgeElements}
          {seriesLines && seriesLines.map((line, li) => (
            <line
              key={`series-line-${li}`}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke={seriesColor!}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.85}
            />
          ))}
          {nodeElements}
        </g>
      </svg>
      {seriesType !== null && (
        <div
          className="series-panel"
          style={{
            borderTop: '1px solid var(--border-primary)',
            background: 'var(--bg-panel)',
            padding: '8px 12px',
            fontSize: 12,
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {seriesTerms ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px' }}>
                <span style={{ fontWeight: 600, color: seriesColor ?? undefined }}>{t(`series.${seriesType}`)}</span>
                <span dangerouslySetInnerHTML={{ __html: renderTex(chainTeX) }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginTop: 3 }}>
                <span style={{ color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: renderTex(ordersTeX) }} />
              </div>
              {seriesFactors && seriesFactors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginTop: 3 }}>
                  <span dangerouslySetInnerHTML={{ __html: renderTex(factorsTeX) }} />
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 5 }}>
                {seriesSolvable && (
                  <span style={{ border: `1px solid ${chipSolvable}`, color: chipSolvable, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{t('series.solvable')}</span>
                )}
                {seriesNilpotent && (
                  <span style={{ border: `1px solid ${chipNilpotent}`, color: chipNilpotent, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{t('series.nilpotent')}</span>
                )}
                {seriesType === 'composition' && seriesFactors && seriesFactors.length > 0 && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>{t('series.factors')}: {multisetText}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t('series.jordanHolder')}</span>
                  </>
                )}
                {seriesType === 'composition' && compositionChains && compositionChains.length > 1 && (
                  <span style={{ color: 'var(--text-muted)' }}>{t('series.alternativeChains', { n: String(compositionChains.length) })}</span>
                )}
                {seriesType === 'composition' && compositionTruncated && (
                  <span style={{ color: 'var(--accent-yellow-text)' }}>{t('series.truncated')}</span>
                )}
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{t('series.tooLarge')}</span>
          )}
        </div>
      )}
    </div>
  )
}

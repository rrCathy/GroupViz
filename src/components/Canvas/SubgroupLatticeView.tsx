import { useMemo, useCallback, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import {
  computeSubgroupLattice,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from '../../core/algebra/subgroups'
import { texify, renderTex } from '../../utils/texify'

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
  } = useGroup()
  const { t } = useTranslation()

  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null)

  const latticeData = useMemo(() => {
    if (!currentGroup) return null
    return computeSubgroupLattice(currentGroup)
  }, [currentGroup])

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
        stroke={onPath ? '#ffd93d' : '#3a3a5a'}
        strokeWidth={onPath ? 4 : 2}
        opacity={onPath ? 1 : 0.45}
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

    let fillColor = '#151f1a'
    let strokeColor = node.isNormal ? '#8968c8' : '#3ea89e'
    let strokeWidth = 2.5
    let textColor = '#ddd'

    if (onPath) {
      fillColor = '#1e3a1e'
      strokeColor = '#ffd93d'
      strokeWidth = 4
      textColor = '#ffd93d'
    }
    if (isActive) {
      fillColor = '#2a4a2a'
      strokeWidth = 4
    }
    if (isTrivial && !onPath) {
      fillColor = '#1a1a2e'
      strokeColor = '#555'
      strokeWidth = 2
    }
    if (isFull && !onPath) {
      fillColor = '#1a1f30'
      strokeColor = '#5588cc'
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
        style={{ cursor: 'pointer' }}
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
          fill={onPath ? '#ffd93dcc' : node.isNormal ? '#8968c8' : '#777'}
          fontSize="11px"
          fontFamily="monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {isTrivial ? t('lattice.trivial') : isFull ? `|G|=${currentGroup.order}` : node.isNormal ? `◁ ${t('badge.normal')}` : t('lattice.subgroup')}
        </text>
      </g>
    )
  })

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="view-svg"
      style={{ userSelect: 'none' }}
    >
      <g transform={`translate(${canvasTransform.x}, ${canvasTransform.y}) scale(${canvasTransform.scale})`}>
        {edgeElements}
        {nodeElements}
      </g>
    </svg>
  )
}

import { useCallback, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import {
  computeSubgroupLattice,
  getGroupCenter,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from '../../core/algebra/subgroups'
import { computeChainFactors, type SeriesFactor } from '../../core/algebra/series'
import type { GroupElement } from '../../core/types'
import {
  SublatticeScene,
  type LatticeData,
  type SublatticeSeriesState,
} from './SublatticeScene'

/**
 * 主画布 / 旧浮动窗用的 context 组装壳：从 useGroup() 取大群后端格、子群列、
 * 子集与选中动作，组装成受控内核的 props。行为与 props 化之前一致。
 */
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
    seriesLoading,
  } = useGroup()
  const { t } = useTranslation()

  const lattice = useMemo<LatticeData | null>(() => {
    if (!currentGroup) return null
    if (isLargeGroup && backendCache.lattice) {
      // Backend lattice nodes ship `elements` (and `is_normal` / no `elementIds`);
      // normalize into the local SubgroupLatticeNode shape consumed below.
      const raw = backendCache.lattice as {
        nodes: Array<{
          id: string
          elements?: Array<{ id: string }> | null
          elementIds?: string[]
          order: number
          is_normal?: boolean
          isNormal?: boolean
          level?: number
        }>
        edges: SubgroupLatticeEdge[]
      }
      return {
        nodes: raw.nodes.map(n => ({
          id: n.id,
          label: `${n.order}`,
          elementIds: Array.isArray(n.elementIds)
            ? n.elementIds
            : (n.elements ?? []).map(e => e.id),
          order: n.order,
          index: 0,
          isNormal: n.is_normal ?? n.isNormal ?? false,
          level: n.level ?? 0,
        })),
        edges: (raw.edges as unknown as Array<{ source: number; target: number }>).map(e => ({
          from: e.source,
          to: e.target,
        })),
      }
    }
    if (isLargeGroup) return null
    return computeSubgroupLattice(currentGroup)
  }, [currentGroup, isLargeGroup, backendCache.lattice])

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
    // Backend (GAP) series ships its own factors — use them directly to
    // avoid an O(n²) recomputation on large groups.
    if (seriesData?.factors && seriesData.factors.length > 0) return seriesData.factors
    if (seriesType === 'composition') return computeChainFactors(currentGroup, seriesTerms, true)
    return seriesData?.factors ?? null
  }, [currentGroup, seriesType, seriesTerms, seriesData])

  const series: SublatticeSeriesState | null = seriesType
    ? {
        type: seriesType,
        terms: seriesTerms,
        factors: seriesFactors,
        solvable: seriesType === 'composition' ? seriesFlags?.solvable ?? false : seriesData?.solvable ?? false,
        nilpotent: seriesType === 'composition' ? seriesFlags?.nilpotent ?? false : seriesData?.nilpotent ?? false,
        chainCount: compositionChains?.length ?? 0,
        truncated: compositionTruncated,
        loading: seriesLoading,
      }
    : null

  const centerIds = useMemo(() => {
    if (!currentGroup) return undefined
    const center = backendCache.center ?? (currentGroup.order <= 60 ? getGroupCenter(currentGroup) : null)
    return center ? center.map(e => e.id) : undefined
  }, [currentGroup, backendCache.center])

  const handleActivate = useCallback(
    (idx: number | null, node: SubgroupLatticeNode | null) => {
      clearSelection()
      if (idx === null || !node) return
      node.elementIds.forEach(id => selectElement(id, true))
    },
    [clearSelection, selectElement]
  )

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <SublatticeScene
      group={currentGroup}
      lattice={lattice}
      canvasTransform={canvasTransform}
      series={series}
      centerIds={centerIds}
      subsets={subsets}
      onActivateNode={handleActivate}
    />
  )
}

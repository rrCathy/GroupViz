/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  computeSubgroupSeries,
  enumerateCompositionSeries,
  SERIES_MAX_ORDER,
  type SeriesType,
  type SubgroupSeries,
} from '../../core/algebra/series'
import { computeGroupProperties } from '../../core/algebra/properties'
import { fetchBackendSeries } from '../../utils/hybridCompute'
import type { GroupElement } from '../../core/types'

interface GroupSeriesState {
  seriesType: SeriesType | null
  activeChainIdx: number
  /** Canonical series for derived / central types (null while off or for composition). */
  seriesData: SubgroupSeries | null
  /** All enumerated composition-series chains (composition type only). */
  compositionChains: GroupElement[][][] | null
  compositionTruncated: boolean
  /** Group-level solvable/nilpotent flags (for composition display). */
  seriesFlags: { solvable: boolean; nilpotent: boolean } | null
  /** True while a large-group series is being fetched from the GAP backend. */
  seriesLoading: boolean
}

interface GroupSeriesActions {
  setSeriesType: (type: SeriesType | null) => void
  setActiveChainIdx: (idx: number) => void
}

export type GroupSeriesContextType = GroupSeriesState & GroupSeriesActions

const GroupSeriesContext = createContext<GroupSeriesContextType | null>(null)

export function GroupSeriesProvider({ children }: { children: ReactNode }) {
  const { currentGroup } = useGroupCore()

  const [seriesType, setSeriesTypeState] = useState<SeriesType | null>(null)
  const [activeChainIdx, setActiveChainIdxState] = useState(0)
  const [gapSeries, setGapSeries] = useState<SubgroupSeries | null>(null)
  const [gapLoading, setGapLoading] = useState(false)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setSeriesTypeState(null)
      setActiveChainIdxState(0)
      setGapSeries(null)
      setGapLoading(false)
    })
  }, [currentGroup])

  // Large groups (order > SERIES_MAX_ORDER): fetch the series from the GAP
  // backend; the local engine returns null above that cutoff.
  useEffect(() => {
    if (!currentGroup || seriesType === null) return
    if (currentGroup.order <= SERIES_MAX_ORDER) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setGapLoading(true)
      fetchBackendSeries(currentGroup, seriesType)
        .then(series => {
          if (!cancelled) setGapSeries(series)
        })
        .finally(() => {
          if (!cancelled) setGapLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [currentGroup, seriesType])

  const localSeries = useMemo(() => {
    if (!currentGroup || seriesType === null || seriesType === 'composition') return null
    return computeSubgroupSeries(currentGroup, seriesType)
  }, [currentGroup, seriesType])

  const seriesData = useMemo<SubgroupSeries | null>(() => {
    if (localSeries) return localSeries
    if (gapSeries && gapSeries.type === seriesType) return gapSeries
    return null
  }, [localSeries, gapSeries, seriesType])

  const compositionEnum = useMemo(() => {
    if (!currentGroup || seriesType !== 'composition') return null
    if (currentGroup.order > SERIES_MAX_ORDER) {
      // GAP returns a single (greedy) chain; no full enumeration available.
      if (gapSeries) return { chains: [gapSeries.terms], truncated: false }
      return { chains: [], truncated: false }
    }
    return enumerateCompositionSeries(currentGroup, 20)
  }, [currentGroup, seriesType, gapSeries])

  const seriesFlags = useMemo(() => {
    if (!currentGroup || seriesType === null) return null
    if (currentGroup.order > SERIES_MAX_ORDER) {
      if (!gapSeries) return null
      return { solvable: gapSeries.solvable, nilpotent: gapSeries.nilpotent }
    }
    const props = computeGroupProperties(currentGroup, true)
    if (!props) return null
    return { solvable: props.solvable, nilpotent: props.nilpotent }
  }, [currentGroup, seriesType, gapSeries])

  const setSeriesType = useCallback((type: SeriesType | null) => {
    setSeriesTypeState(type)
    setActiveChainIdxState(0)
  }, [])

  const setActiveChainIdx = useCallback((idx: number) => {
    setActiveChainIdxState(idx)
  }, [])

  const value: GroupSeriesContextType = {
    seriesType,
    activeChainIdx,
    seriesData,
    compositionChains: compositionEnum ? compositionEnum.chains : null,
    compositionTruncated: compositionEnum ? compositionEnum.truncated : false,
    seriesFlags,
    seriesLoading: gapLoading,
    setSeriesType,
    setActiveChainIdx,
  }

  return (
    <GroupSeriesContext.Provider value={value}>
      {children}
    </GroupSeriesContext.Provider>
  )
}

export function useGroupSeries() {
  const context = useContext(GroupSeriesContext)
  if (!context) {
    throw new Error('useGroupSeries must be used within GroupSeriesProvider')
  }
  return context
}

export { GroupSeriesContext }

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  computeSubgroupSeries,
  enumerateCompositionSeries,
  type SeriesType,
  type SubgroupSeries,
} from '../../core/algebra/series'
import { computeGroupProperties } from '../../core/algebra/properties'
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
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setSeriesTypeState(null)
      setActiveChainIdxState(0)
    })
  }, [currentGroup])

  const seriesData = useMemo(() => {
    if (!currentGroup || seriesType === null || seriesType === 'composition') return null
    return computeSubgroupSeries(currentGroup, seriesType)
  }, [currentGroup, seriesType])

  const compositionEnum = useMemo(() => {
    if (!currentGroup || seriesType !== 'composition') return null
    return enumerateCompositionSeries(currentGroup, 20)
  }, [currentGroup, seriesType])

  const seriesFlags = useMemo(() => {
    if (!currentGroup || seriesType === null) return null
    const props = computeGroupProperties(currentGroup, true)
    if (!props) return null
    return { solvable: props.solvable, nilpotent: props.nilpotent }
  }, [currentGroup, seriesType])

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

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { isSimpleGroup as checkSimpleGroup } from '../../core/algebra/subgroups'
import { type BackendCache, createEmptyBackendCache, fetchBackendResults, computeIsSimple as hybridIsSimple } from '../../utils/hybridCompute'
import { useGroupCore } from '../core/GroupCoreContext'

interface GroupBackendState {
  backendCache: BackendCache
  isSimpleGroup: boolean
}

export type GroupBackendContextType = GroupBackendState

const GroupBackendContext = createContext<GroupBackendContextType | null>(null)

export function GroupBackendProvider({ children }: { children: ReactNode }) {
  const { currentGroup, isLargeGroup } = useGroupCore()

  const [backendCache, setBackendCache] = useState<BackendCache>(createEmptyBackendCache)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return

    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      if (currentGroup.order > 60) {
        setBackendCache(prev => ({ ...prev, loading: true, error: null, groupSymbol: currentGroup.symbol }))
        const reqSymbol = currentGroup.symbol
        fetchBackendResults(currentGroup).then(results => {
          setBackendCache(prev => {
            if (prev.groupSymbol !== reqSymbol) return prev
            return results
          })
        }).catch(() => {
          setBackendCache(prev => {
            if (prev.groupSymbol !== reqSymbol) return prev
            return { ...prev, loading: false, error: 'backend.unreachable' }
          })
        })
      } else {
        setBackendCache(createEmptyBackendCache())
      }
    })
  }, [currentGroup])

  const isSimpleGroup = useMemo(() => {
    if (!currentGroup) return false
    if (isLargeGroup) return hybridIsSimple(currentGroup, backendCache.subgroups ?? undefined)
    return checkSimpleGroup(currentGroup)
  }, [currentGroup, isLargeGroup, backendCache.subgroups])

  const value: GroupBackendContextType = {
    backendCache,
    isSimpleGroup,
  }

  return (
    <GroupBackendContext.Provider value={value}>
      {children}
    </GroupBackendContext.Provider>
  )
}

export function useGroupBackend() {
  const context = useContext(GroupBackendContext)
  if (!context) {
    throw new Error('useGroupBackend must be used within GroupBackendProvider')
  }
  return context
}

export { GroupBackendContext }

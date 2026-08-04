/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Group } from '../../core/types'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  loadDirectProductGroupsFromStorage,
  saveDirectProductGroupsToStorage,
  executeDirectProductHelper
} from '../directProductActions'

interface GroupDirectProductState {
  isDirectProductMode: boolean
  directProductSource: Group | null
  directProductTarget: Group | null
  directProductCreationMode: 'cayley' | 'table' | 'direct'
  directProductGroups: Group[]
}

interface GroupDirectProductActions {
  toggleDirectProductMode: () => void
  setDirectProductSource: (group: Group | null) => void
  setDirectProductTarget: (group: Group | null) => void
  setDirectProductCreationMode: (mode: 'cayley' | 'table' | 'direct') => void
  executeDirectProduct: () => Group | null
  storeDirectProductGroup: (group: Group) => void
  removeDirectProductGroup: (symbol: string) => void
  loadDirectProductGroup: (symbol: string) => void
}

export type GroupDirectProductContextType = GroupDirectProductState & GroupDirectProductActions

const GroupDirectProductContext = createContext<GroupDirectProductContextType | null>(null)

export function GroupDirectProductProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { setCurrentGroup, setHintMessage, addOperationHistory } = useGroupCore()

  const [isDirectProductMode, setIsDirectProductMode] = useState(false)
  const [directProductSource, setDirectProductSourceState] = useState<Group | null>(null)
  const [directProductTarget, setDirectProductTargetState] = useState<Group | null>(null)
  const [directProductCreationMode, setDirectProductCreationModeState] = useState<'cayley' | 'table' | 'direct'>('cayley')
  const [directProductGroups, setDirectProductGroups] = useState<Group[]>(loadDirectProductGroupsFromStorage)

  const toggleDirectProductMode = useCallback(() => {
    setIsDirectProductMode(prev => {
      if (prev) {
        setDirectProductSourceState(null)
        setDirectProductTargetState(null)
        return false
      }
      return true
    })
  }, [])

  const setDirectProductSource = useCallback((group: Group | null) => {
    setDirectProductSourceState(group)
  }, [])

  const setDirectProductTarget = useCallback((group: Group | null) => {
    setDirectProductTargetState(group)
  }, [])

  const setDirectProductCreationMode = useCallback((mode: 'cayley' | 'table' | 'direct') => {
    setDirectProductCreationModeState(mode)
  }, [])

  const executeDirectProduct = useCallback((): Group | null => {
    const { group, error } = executeDirectProductHelper(directProductSource, directProductTarget)
    if (error) {
      const n = (directProductSource && directProductTarget)
        ? directProductSource.order * directProductTarget.order
        : 0
      setHintMessage(t(error, { n }))
    }
    return group
  }, [directProductSource, directProductTarget, setHintMessage, t])

  const storeDirectProductGroup = useCallback((group: Group) => {
    setDirectProductGroups(prev => {
      const exists = prev.find(g => g.symbol === group.symbol)
      const next = exists ? prev.map(g => g.symbol === group.symbol ? group : g) : [...prev, group]
      saveDirectProductGroupsToStorage(next)
      return next
    })
    setHintMessage(t('dp.storeHint', { symbol: group.symbol }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
  }, [setHintMessage, t])

  const removeDirectProductGroup = useCallback((symbol: string) => {
    setDirectProductGroups(prev => {
      const next = prev.filter(g => g.symbol !== symbol)
      saveDirectProductGroupsToStorage(next)
      return next
    })
    setHintMessage(t('dp.removeHint', { symbol }).replace(symbol, `<span class="hint-highlight">${symbol}</span>`))
  }, [setHintMessage, t])

  const loadDirectProductGroup = useCallback((symbol: string) => {
    const group = directProductGroups.find(g => g.symbol === symbol)
    if (group) {
      setCurrentGroup(group)
      setIsDirectProductMode(false)
      setHintMessage(t('dp.created', { symbol: group.symbol, order: group.order }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
      addOperationHistory(t('dp.created', { symbol: group.symbol, order: group.order }))
    }
  }, [directProductGroups, setCurrentGroup, setHintMessage, addOperationHistory, t])

  const value: GroupDirectProductContextType = {
    isDirectProductMode, directProductSource, directProductTarget, directProductCreationMode, directProductGroups,
    toggleDirectProductMode, setDirectProductSource, setDirectProductTarget, setDirectProductCreationMode,
    executeDirectProduct, storeDirectProductGroup, removeDirectProductGroup, loadDirectProductGroup,
  }

  return (
    <GroupDirectProductContext.Provider value={value}>
      {children}
    </GroupDirectProductContext.Provider>
  )
}

export function useGroupDirectProduct() {
  const context = useContext(GroupDirectProductContext)
  if (!context) {
    throw new Error('useGroupDirectProduct must be used within GroupDirectProductProvider')
  }
  return context
}

export { GroupDirectProductContext }

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react'
import type { Subset, Group } from '../../core/types'
import { isAutomorphismGroup } from '../../core/types'
import type { CosetInfo, Subgroup } from '../../core/algebra/subgroups'
import { computeQuotientGroup, detectIsomorphicGroup } from '../../core/algebra/subgroups'

import { saveQuotientsToStorage, loadAndReconstructQuotients } from './quotientStorage'
import { saveAutomorphismsToStorage, loadAndReconstructAutomorphisms } from './automorphismStorage'
import { createAutomorphismGroup } from '../../core/algebra/automorphisms'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  computeCosetData, computeCosetElementMap, computeCosetColors,
  computeCosetHighlightSet, createSubset
} from '../cosetActions'

export interface QuotientGroupEntry {
  id: string
  group: Group
  parentSymbol: string
  normalSubgroupElementIds: string[]
  normalSubgroupLabel: string
  order: number
  isoSymbol: string | null
}

export interface AutomorphismGroupEntry {
  id: string
  group: Group
  parentSymbol: string
  order: number
  isoSymbol: string | null
}

interface GroupSubsetState {
  subsets: Subset[]
  cosetSubsetId: string | null
  cosetSubgroupElementIds: string[] | null
  cosetType: 'left' | 'right'
  showAllCosets: boolean
  cosetData: CosetInfo | null
  cosetElementMap: Map<string, number>
  cosetHighlightSet: Set<number>
  cosetColors: string[]
  quotientGroups: QuotientGroupEntry[]
  automorphismGroups: AutomorphismGroupEntry[]
}

interface GroupSubsetActions {
  saveSubset: () => void
  removeSubset: (id: string) => void
  clearAllSubsets: () => void
  showCosetsForSubset: (subsetId: string) => void
  showCosetsFromElements: (elementIds: string[], label: string, isNormal: boolean) => void
  hideCosets: () => void
  setCosetType: (type: 'left' | 'right') => void
  toggleShowAllCosets: () => void
  createQuotientGroup: (subsetId: string) => QuotientGroupEntry | null
  removeQuotientGroup: (id: string) => void
  loadQuotientGroup: (id: string) => Group | null
  showCosetFromElements: (elementIds: string[], label: string, isNormal: boolean) => string | null
  computeAutomorphismGroup: () => AutomorphismGroupEntry | null
  removeAutomorphismGroup: (id: string) => void
  loadAutomorphismGroup: (id: string) => Group | null
}

export type GroupSubsetContextType = GroupSubsetState & GroupSubsetActions

const GroupSubsetContext = createContext<GroupSubsetContextType | null>(null)

export function GroupSubsetProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const {
    currentGroup, selectedElements, addOperationHistory, setHintMessage,
    clearSelection, checkSubsetProperty,
  } = useGroupCore()

  const [subsets, setSubsets] = useState<Subset[]>([])
  const [cosetSubsetId, setCosetSubsetId] = useState<string | null>(null)
  const [cosetSubgroupElementIds, setCosetSubgroupElementIds] = useState<string[] | null>(null)
  const [cosetType, setCosetTypeState] = useState<'left' | 'right'>('left')
  const [showAllCosets, setShowAllCosets] = useState(false)
  const [quotientGroups, setQuotientGroups] = useState<QuotientGroupEntry[]>(() => loadAndReconstructQuotients())
  const [automorphismGroups, setAutomorphismGroups] = useState<AutomorphismGroupEntry[]>(() => loadAndReconstructAutomorphisms())
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setSubsets([])
      setCosetSubsetId(null)
      setCosetSubgroupElementIds(null)
      setShowAllCosets(false)
      // Note: do NOT filter quotientGroups by parent symbol here. Quotient
      // groups from multiple parent groups must remain available in memory so
      // that switching between parents does not discard previously created
      // quotients. The second effect restores any missing entries from
      // localStorage for the current parent group.
    })
  }, [currentGroup])

  // Restore quotient groups from localStorage when switching to a parent group
  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (sym.includes('/N')) return

    try {
      const raw = localStorage.getItem('groupviz-quotients')
      if (!raw) return
      const stored: Array<{ id: string; parentSymbol: string; normalSubgroupElementIds: string[]; normalSubgroupLabel: string; isoSymbol: string | null }> = JSON.parse(raw)
      const relevantStored = stored.filter(s => s.parentSymbol === sym)
      if (relevantStored.length === 0) return

      // Defer state update to avoid synchronous setState inside an effect body.
      queueMicrotask(() => {
        setQuotientGroups(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const missing = relevantStored.filter(s => !existingIds.has(s.id))
          if (missing.length === 0) return prev

          const parentGroup = currentGroup
          const restored: Array<{ id: string; group: Group; parentSymbol: string; normalSubgroupElementIds: string[]; normalSubgroupLabel: string; order: number; isoSymbol: string | null }> = []
          for (const s of missing) {
            try {
              if (!s.normalSubgroupElementIds) continue
              const subgroupElements = s.normalSubgroupElementIds
                .map(id => parentGroup.elements.find(e => e.id === id))
                .filter((e): e is import('../../core/types').GroupElement => e !== undefined)
              if (subgroupElements.length === 0) continue
              const normalSubgroup: import('../../core/algebra/subgroups').Subgroup = {
                elements: subgroupElements, order: subgroupElements.length,
                index: parentGroup.order / subgroupElements.length, generators: [], isNormal: true,
              }
              const qg = computeQuotientGroup(parentGroup, normalSubgroup)
              if (!qg) continue
              qg.isoSymbol = s.isoSymbol ?? undefined
              restored.push({ id: s.id, group: qg, parentSymbol: s.parentSymbol, normalSubgroupElementIds: qg.normalSubgroupElementIds ?? [], normalSubgroupLabel: s.normalSubgroupLabel, order: qg.order, isoSymbol: s.isoSymbol })
            } catch { /* skip individual entry that fails to reconstruct */ }
          }
          if (restored.length === 0) return prev
          return [...prev.filter(p => p.parentSymbol !== sym), ...prev.filter(p => p.parentSymbol === sym), ...restored]
        })
      })
    } catch { /* ignore */ }
  }, [currentGroup])

  // Restore automorphism groups from localStorage when switching to a parent group
  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (isAutomorphismGroup(currentGroup)) return

    try {
      const raw = localStorage.getItem('groupviz-automorphisms')
      if (!raw) return
      const stored: Array<{ id: string; parentSymbol: string; isoSymbol: string | null }> = JSON.parse(raw)
      const relevantStored = stored.filter(s => s.parentSymbol === sym)
      if (relevantStored.length === 0) return

      queueMicrotask(() => {
        setAutomorphismGroups(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const missing = relevantStored.filter(s => !existingIds.has(s.id))
          if (missing.length === 0) return prev

          const parentGroup = currentGroup
          const restored: AutomorphismGroupEntry[] = []
          for (const s of missing) {
            try {
              const autoGroup = createAutomorphismGroup(parentGroup)
              if (!autoGroup) continue
              autoGroup.isoSymbol = s.isoSymbol ?? undefined
              restored.push({
                id: s.id,
                group: autoGroup,
                parentSymbol: s.parentSymbol,
                order: autoGroup.order,
                isoSymbol: s.isoSymbol,
              })
            } catch { /* skip */ }
          }
          if (restored.length === 0) return prev
          return [...prev.filter(p => p.parentSymbol !== sym), ...prev.filter(p => p.parentSymbol === sym), ...restored]
        })
      })
    } catch { /* ignore */ }
  }, [currentGroup])

  const cosetData = useMemo(() => computeCosetData(currentGroup, cosetSubsetId, subsets, cosetSubgroupElementIds), [currentGroup, subsets, cosetSubsetId, cosetSubgroupElementIds])
  const cosetElementMap = useMemo(() => computeCosetElementMap(cosetData, cosetType), [cosetData, cosetType])
  const cosetColors = useMemo(() => computeCosetColors(cosetData, cosetType), [cosetData, cosetType])
  const cosetHighlightSet = useMemo(() => computeCosetHighlightSet(cosetData, cosetType, showAllCosets, selectedElements, cosetElementMap), [cosetData, cosetType, showAllCosets, selectedElements, cosetElementMap])

  const saveSubset = useCallback(() => {
    if (!currentGroup || selectedElements.size === 0) return
    const elementIds = Array.from(selectedElements)
    const result = checkSubsetProperty(elementIds)
    const newSubset = createSubset(elementIds, result, subsets.length)
    setSubsets(prev => [...prev, newSubset])
    clearSelection()
    addOperationHistory(t('op.saveSubset', { label: result.label, n: elementIds.length }))
    setHintMessage(t('hint.subsetSaved', { label: result.label, n: elementIds.length }).replace(result.label, `<span class="hint-highlight">${result.label}</span>`))
  }, [currentGroup, selectedElements, subsets, checkSubsetProperty, clearSelection, addOperationHistory, setHintMessage, t])

  const removeSubset = useCallback((id: string) => {
    setSubsets(prev => prev.filter(s => s.id !== id))
    if (cosetSubsetId === id) {
      setCosetSubsetId(null)
      setCosetSubgroupElementIds(null)
      setShowAllCosets(false)
    }
    addOperationHistory(t('op.removeSubset'))
  }, [addOperationHistory, cosetSubsetId, t])

  const clearAllSubsets = useCallback(() => {
    setSubsets([])
    setCosetSubsetId(null)
    setCosetSubgroupElementIds(null)
    setShowAllCosets(false)
    addOperationHistory(t('op.clearSubsets'))
  }, [addOperationHistory, t])

  const showCosetsForSubset = useCallback((subsetId: string) => {
    if (cosetSubsetId === subsetId) {
      setCosetSubsetId(null)
      setCosetSubgroupElementIds(null)
      setShowAllCosets(false)
      setHintMessage(t('hint.cosetHide'))
      addOperationHistory(t('op.cosetHide'))
      return
    }
    setCosetSubsetId(subsetId)
    setShowAllCosets(false)
    const subset = subsets.find(s => s.id === subsetId)
    if (subset) {
      setCosetSubgroupElementIds([...subset.elementIds])
      setHintMessage(t('hint.cosetShow', { label: subset.label, order: subset.elementIds.length }).replace(subset.label, `<span class="hint-highlight">${subset.label}</span>`))
      addOperationHistory(t('op.cosetShow', { label: subset.label }))
    }
  }, [cosetSubsetId, subsets, addOperationHistory, setHintMessage, t])

  const hideCosets = useCallback(() => {
    setCosetSubsetId(null)
    setCosetSubgroupElementIds(null)
    setShowAllCosets(false)
    setHintMessage(t('hint.cosetHide'))
    addOperationHistory(t('op.cosetHide'))
  }, [addOperationHistory, setHintMessage, t])

  const setCosetType = useCallback((type: 'left' | 'right') => {
    setCosetTypeState(type)
    const label = type === 'left' ? t('coset.left') : t('coset.right')
    setHintMessage(t('hint.cosetType', { label }).replace(label, `<span class="hint-highlight">${label}</span>`))
    addOperationHistory(t('op.cosetType', { label }))
  }, [addOperationHistory, setHintMessage, t])

  const toggleShowAllCosets = useCallback(() => {
    setShowAllCosets(prev => !prev)
    setHintMessage(t(showAllCosets ? 'hint.cosetSelect' : 'hint.cosetAll'))
    addOperationHistory(t(showAllCosets ? 'op.cosetSelect' : 'op.cosetAll'))
  }, [showAllCosets, addOperationHistory, setHintMessage, t])

  const showCosetFromElements = useCallback((elementIds: string[], label: string, isNormal: boolean): string | null => {
    if (!currentGroup) return null

    const sortedIds = [...elementIds].sort().join(',')
    const existing = subsets.find(s => [...s.elementIds].sort().join(',') === sortedIds)
    if (existing) {
      setCosetSubsetId(existing.id)
      setShowAllCosets(false)
      setHintMessage(t('hint.cosetShow', { label: existing.label, order: existing.elementIds.length }).replace(existing.label, `<span class="hint-highlight">${existing.label}</span>`))
      addOperationHistory(t('op.cosetShow', { label: existing.label }))
      return existing.id
    }

    const newSubset = createSubset(
      elementIds,
      {
        type: isNormal ? 'normal-subgroup' : 'subgroup',
        label,
        color: '',
      },
      subsets.length,
    )
    setSubsets(prev => [...prev, newSubset])
    setCosetSubsetId(newSubset.id)
    setShowAllCosets(false)
    setHintMessage(t('hint.cosetShow', { label: newSubset.label, order: elementIds.length }).replace(newSubset.label, `<span class="hint-highlight">${newSubset.label}</span>`))
    addOperationHistory(t('op.cosetShow', { label: newSubset.label }))
    return newSubset.id
  }, [currentGroup, subsets, addOperationHistory, setHintMessage, t])

  const showCosetsFromElements = useCallback((elementIds: string[], label: string, _isNormal: boolean) => {
    if (!currentGroup) return
    setCosetSubsetId(null)
    setCosetSubgroupElementIds([...elementIds])
    setShowAllCosets(false)
    setHintMessage(t('hint.cosetShow', { label, order: elementIds.length }).replace(label, `<span class="hint-highlight">${label}</span>`))
    addOperationHistory(t('op.cosetShow', { label }))
  }, [currentGroup, addOperationHistory, setHintMessage, t])

  const createQuotientGroup = useCallback((subsetId: string): QuotientGroupEntry | null => {
    if (!currentGroup) return null
    const subset = subsets.find(s => s.id === subsetId)
    if (!subset || !subset.isNormalSubgroup) return null

    const subgroupElements = subset.elementIds
      .map(id => currentGroup.elements.find(e => e.id === id))
      .filter((e): e is import('../../core/types').GroupElement => e !== undefined)

    const normalSubgroup: Subgroup = {
      elements: subgroupElements,
      order: subgroupElements.length,
      index: currentGroup.order / subgroupElements.length,
      generators: [],
      isNormal: true,
    }

    const quotientGroup = computeQuotientGroup(currentGroup, normalSubgroup)
    if (!quotientGroup) return null

    const isoSymbol = detectIsomorphicGroup(quotientGroup)
    quotientGroup.isoSymbol = isoSymbol ?? undefined

    const entry: QuotientGroupEntry = {
      id: `quotient-${Date.now()}`,
      group: quotientGroup,
      parentSymbol: currentGroup.symbol,
      normalSubgroupElementIds: subset.elementIds,
      normalSubgroupLabel: subset.label,
      order: quotientGroup.order,
      isoSymbol,
    }

    setQuotientGroups(prev => {
      const next = [...prev, entry]
      saveQuotientsToStorage(next)
      return next
    })
    addOperationHistory(t('op.createQuotient', { parent: currentGroup.symbol, order: quotientGroup.order }))
    setHintMessage(t('hint.quotientCreated', { symbol: quotientGroup.symbol, order: quotientGroup.order }).replace(quotientGroup.symbol, `<span class="hint-highlight">${quotientGroup.symbol}</span>`))
    return entry
  }, [currentGroup, subsets, addOperationHistory, setHintMessage, t])

  const removeQuotientGroup = useCallback((id: string) => {
    setQuotientGroups(prev => {
      const next = prev.filter(q => q.id !== id)
      saveQuotientsToStorage(next)
      return next
    })
    addOperationHistory(t('op.removeQuotient'))
  }, [addOperationHistory, t])

  const loadQuotientGroup = useCallback((id: string): Group | null => {
    const entry = quotientGroups.find(q => q.id === id)
    return entry?.group || null
  }, [quotientGroups])

  const computeAutomorphismGroup = useCallback((): AutomorphismGroupEntry | null => {
    if (!currentGroup) return null

    // Check if already computed for this parent
    const existing = automorphismGroups.find(a => a.parentSymbol === currentGroup.symbol)
    if (existing) {
      addOperationHistory(t('op.computedAutomorphism', { symbol: currentGroup.symbol, order: existing.order }))
      setHintMessage(t('hint.automorphismComputed', { symbol: currentGroup.symbol, order: existing.order }).replace(currentGroup.symbol, `<span class="hint-highlight">${currentGroup.symbol}</span>`))
      return existing
    }

    const autoGroup = createAutomorphismGroup(currentGroup)
    if (!autoGroup) return null

    const isoSymbol = autoGroup.isoSymbol ?? null
    const entry: AutomorphismGroupEntry = {
      id: `automorphism-${Date.now()}`,
      group: autoGroup,
      parentSymbol: currentGroup.symbol,
      order: autoGroup.order,
      isoSymbol,
    }

    setAutomorphismGroups(prev => {
      const next = [...prev, entry]
      saveAutomorphismsToStorage(next)
      return next
    })

    addOperationHistory(t('op.computedAutomorphism', { symbol: currentGroup.symbol, order: autoGroup.order }))
    if (isoSymbol) {
      setHintMessage(t('hint.automorphismComputedIso', { symbol: currentGroup.symbol, order: autoGroup.order, isoSymbol }).replace(currentGroup.symbol, `<span class="hint-highlight">${currentGroup.symbol}</span>`).replace(isoSymbol, `<span class="hint-highlight">${isoSymbol}</span>`))
    } else {
      setHintMessage(t('hint.automorphismComputed', { symbol: currentGroup.symbol, order: autoGroup.order }).replace(currentGroup.symbol, `<span class="hint-highlight">${currentGroup.symbol}</span>`))
    }

    return entry
  }, [currentGroup, automorphismGroups, addOperationHistory, setHintMessage, t])

  const removeAutomorphismGroup = useCallback((id: string) => {
    setAutomorphismGroups(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAutomorphismsToStorage(next)
      return next
    })
    addOperationHistory(t('op.removeAutomorphism'))
  }, [addOperationHistory, t])

  const loadAutomorphismGroup = useCallback((id: string): Group | null => {
    const entry = automorphismGroups.find(a => a.id === id)
    return entry?.group || null
  }, [automorphismGroups])

  const value: GroupSubsetContextType = {
    subsets, cosetSubsetId, cosetSubgroupElementIds, cosetType, showAllCosets,
    cosetData, cosetElementMap, cosetHighlightSet, cosetColors,
    quotientGroups, automorphismGroups,
    saveSubset, removeSubset, clearAllSubsets,
    showCosetsForSubset, showCosetsFromElements, hideCosets, setCosetType, toggleShowAllCosets,
    createQuotientGroup, removeQuotientGroup, loadQuotientGroup,
    showCosetFromElements,
    computeAutomorphismGroup, removeAutomorphismGroup, loadAutomorphismGroup,
  }

  return (
    <GroupSubsetContext.Provider value={value}>
      {children}
    </GroupSubsetContext.Provider>
  )
}

export function useGroupSubset() {
  const context = useContext(GroupSubsetContext)
  if (!context) {
    throw new Error('useGroupSubset must be used within GroupSubsetProvider')
  }
  return context
}

export { GroupSubsetContext }

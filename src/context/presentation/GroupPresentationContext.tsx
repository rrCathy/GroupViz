/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Group } from '../../core/types'
import type { GroupPresentation } from '../../core/types'
import { parsePresentation, buildGroupFromPresentation } from '../../core/algebra/presentations'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  loadPresentationSpecsFromStorage,
  savePresentationSpecsToStorage,
  reconstructPresentationGroup,
  loadPresentationDraft,
  savePresentationDraft,
  removePresentationDraft,
  type StoredPresentation,
} from './presentationStorage'

interface GroupPresentationState {
  presentationGroups: Group[]
  presentationDraft: string
  presentationError: string | null
  templateGenCount: number
  visualDraft: { gens: string[]; relators: string[]; group: Group | null } | null
  activePresentationGroup: Group | null
}

interface GroupPresentationActions {
  setPresentationDraft: (text: string) => void
  createPresentationGroupFromText: (text: string) => Group | null
  storePresentationGroup: (group: Group) => void
  removePresentationGroup: (symbol: string) => void
  loadPresentationGroup: (symbol: string) => void
  setTemplateGenCount: (n: number) => void
  setVisualDraft: (draft: { gens: string[]; relators: string[]; group: Group | null } | null) => void
  clearActivePresentationGroup: () => void
}

export type GroupPresentationContextType = GroupPresentationState & GroupPresentationActions

const GroupPresentationContext = createContext<GroupPresentationContextType | null>(null)

export function GroupPresentationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { setCurrentView, setHintMessage, addOperationHistory } = useGroupCore()

  const [presentationGroups, setPresentationGroups] = useState<Group[]>(() => {
    const specs = loadPresentationSpecsFromStorage()
    const seen = new Set<string>()
    const groups: Group[] = []
    for (const spec of specs) {
      const g = reconstructPresentationGroup(spec)
      if (g && !seen.has(g.symbol)) {
        seen.add(g.symbol)
        groups.push(g)
      }
    }
    return groups
  })

  const [presentationDraft, setPresentationDraftState] = useState<string>(() => loadPresentationDraft())

  const [presentationError, setPresentationError] = useState<string | null>(null)

  const [templateGenCount, setTemplateGenCount] = useState(2)

  const [visualDraft, setVisualDraft] = useState<{ gens: string[]; relators: string[]; group: Group | null } | null>(null)

  const [activePresentationGroup, setActivePresentationGroup] = useState<Group | null>(null)

  const setPresentationDraft = useCallback((text: string) => {
    setPresentationDraftState(text)
    setPresentationError(null)
    savePresentationDraft(text)
  }, [])

  const storePresentationGroup = useCallback((group: Group) => {
    setPresentationGroups(prev => {
      const exists = prev.find(g => g.symbol === group.symbol)
      const next = exists ? prev.map(g => g.symbol === group.symbol ? group : g) : [...prev, group]
      const specs: StoredPresentation[] = next.map(g => ({
        id: `pres-${g.symbol}`,
        generators: g.presentation?.generators ?? [],
        relators: g.presentation?.relators ?? [],
        symbol: g.symbol,
      }))
      savePresentationSpecsToStorage(specs)
      return next
    })
    setHintMessage(t('pres.storeHint', { symbol: group.symbol }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
  }, [setHintMessage, t])

  const removePresentationGroup = useCallback((symbol: string) => {
    setPresentationGroups(prev => {
      const next = prev.filter(g => g.symbol !== symbol)
      const specs: StoredPresentation[] = next.map(g => ({
        id: `pres-${g.symbol}`,
        generators: g.presentation?.generators ?? [],
        relators: g.presentation?.relators ?? [],
        symbol: g.symbol,
      }))
      savePresentationSpecsToStorage(specs)
      return next
    })
    setHintMessage(t('pres.removeHint', { symbol }).replace(symbol, `<span class="hint-highlight">${symbol}</span>`))
  }, [setHintMessage, t])

  const loadPresentationGroup = useCallback((symbol: string) => {
    const group = presentationGroups.find(g => g.symbol === symbol)
    if (!group) return
    setActivePresentationGroup(group)
    setHintMessage(t('pres.loadHint', { symbol: group.symbol, order: group.order }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
    addOperationHistory(t('pres.loadHint', { symbol: group.symbol, order: group.order }))
  }, [presentationGroups, setHintMessage, addOperationHistory, t])

  const createPresentationGroupFromText = useCallback((text: string): Group | null => {
    let pres: GroupPresentation
    try {
      pres = parsePresentation(text)
    } catch (e) {
      const msg = t('pres.error.parse', { msg: e instanceof Error ? e.message : String(e) })
      setPresentationError(msg)
      setHintMessage(msg)
      return null
    }
    if (pres.generators.length === 0) {
      setPresentationError(t('pres.error.empty'))
      setHintMessage(t('pres.error.empty'))
      return null
    }
    const res = buildGroupFromPresentation(pres)
    if (!res.ok || !res.group) {
      const msg = res.reason === 'parse'
        ? t('pres.error.parseText')
        : res.reason === 'infinite'
          ? t('pres.error.infinite')
          : res.reason === 'unconnected'
            ? t('pres.error.unconnected')
            : t('pres.error.overflow')
      setPresentationError(msg)
      setHintMessage(msg)
      return null
    }
    const group = res.group
    storePresentationGroup(group)
    setActivePresentationGroup(group)
    setCurrentView('tree')
    removePresentationDraft()
    setPresentationDraftState('')
    setPresentationError(null)
    const msg = group.isoSymbol
      ? t('pres.createdIso', { symbol: group.symbol, order: group.order, iso: group.isoSymbol })
      : t('pres.created', { symbol: group.symbol, order: group.order })
    setHintMessage(msg.replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
    addOperationHistory(msg)
    return group
  }, [storePresentationGroup, setCurrentView, setHintMessage, addOperationHistory, t])

  const clearActivePresentationGroup = useCallback(() => {
    setActivePresentationGroup(null)
  }, [])

  const value: GroupPresentationContextType = {
    presentationGroups,
    presentationDraft,
    presentationError,
    templateGenCount,
    visualDraft,
    activePresentationGroup,
    setTemplateGenCount,
    setVisualDraft,
    setPresentationDraft,
    createPresentationGroupFromText,
    storePresentationGroup,
    removePresentationGroup,
    loadPresentationGroup,
    clearActivePresentationGroup,
  }

  return (
    <GroupPresentationContext.Provider value={value}>
      {children}
    </GroupPresentationContext.Provider>
  )
}

export function useGroupPresentation() {
  const context = useContext(GroupPresentationContext)
  if (!context) {
    throw new Error('useGroupPresentation must be used within GroupPresentationProvider')
  }
  return context
}

export { GroupPresentationContext }

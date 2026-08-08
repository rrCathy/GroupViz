/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import type { Group, GroupActionArrow, GroupActionComputation, GroupActionKind } from '../../core/types'
import { buildActionComputation, type CustomArrowError } from '../../core/algebra/actions'
import { loadCustomActionDraft, removeCustomActionDraft, saveCustomActionDraft } from './actionDraftStorage'
import { loadGroupActionsFromStorage, saveGroupActionsToStorage, type StoredGroupAction } from './actionStorage'
import { createGroupFromSymbol } from '../../utils/groupFactory'

interface GroupActionState {
  actionKind: GroupActionKind | null
  actionPrime: number | null
  actionGroupSymbol: string | null
  actionSetSize: number | null
  actionArrows: GroupActionArrow[]
  actionEditing: boolean
  actionComputation: GroupActionComputation | null
  actionError: CustomArrowError | null
  actionSelectedElement: number | null
  actionHoverElement: string | null
  savedActions: StoredGroupAction[]
}

interface GroupActionActions {
  createConjugationAction: (group: Group) => void
  createSylowAction: (group: Group, prime: number) => void
  startCustomAction: (group: Group, n: number) => void
  addArrow: (from: number, to: number, generatorId?: string | null) => void
  bindArrow: (from: number, to: number, generatorId: string) => void
  removeArrow: (from: number, generatorId?: string | null) => void
  removeArrowAll: (from: number) => void
  replaceGenArrows: (generatorId: string | null, pairs: [number, number][]) => void
  clearArrows: () => void
  completeCustomAction: (group: Group) => void
  setActionSelectedElement: (x: number | null) => void
  setActionHoverElement: (id: string | null) => void
  clearAction: () => void
  activateSavedAction: (id: string) => void
  deleteSavedAction: (id: string) => void
}

export type GroupActionContextType = GroupActionState & GroupActionActions

const GroupActionContext = createContext<GroupActionContextType | null>(null)

export function GroupActionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage, setCurrentGroup } = useGroupCore()

  const [actionKind, setActionKind] = useState<GroupActionKind | null>(null)
  const [actionPrime, setActionPrime] = useState<number | null>(null)
  const [actionGroupSymbol, setActionGroupSymbol] = useState<string | null>(null)
  const [actionSetSize, setActionSetSize] = useState<number | null>(null)
  const [actionArrows, setActionArrows] = useState<GroupActionArrow[]>([])
  const [actionEditing, setActionEditing] = useState(false)
  const [actionComputation, setActionComputation] = useState<GroupActionComputation | null>(null)
  const [actionError, setActionError] = useState<CustomArrowError | null>(null)
  const [actionSelectedElement, setActionSelectedElement] = useState<number | null>(null)
  const [actionHoverElement, setActionHoverElement] = useState<string | null>(null)
  const [savedActions, setSavedActions] = useState<StoredGroupAction[]>(() => loadGroupActionsFromStorage())
  const prevGroupRef = useRef<string | null>(null)
  const pendingActivateRef = useRef<string | null>(null)
  const savedActionsRef = useRef(savedActions)

  useEffect(() => {
    savedActionsRef.current = savedActions
  }, [savedActions])

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setActionKind(null)
      setActionPrime(null)
      setActionGroupSymbol(null)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionComputation(null)
      setActionError(null)
      setActionSelectedElement(null)
      setActionHoverElement(null)

      const pendingId = pendingActivateRef.current
      pendingActivateRef.current = null
      if (pendingId) {
        const rec = savedActionsRef.current.find(s => s.id === pendingId)
        if (rec) {
          try {
            const result = buildActionComputation(currentGroup, { kind: 'custom', setSize: rec.setSize }, rec.arrows)
            if (result.computation && result.computation.isHomomorphism) {
              setActionKind('custom')
              setActionSetSize(rec.setSize)
              setActionArrows(rec.arrows)
              setActionGroupSymbol(sym)
              setActionComputation(result.computation)
              setActionEditing(false)
              setHintMessage(t('action.activated'))
              return
            }
          } catch { /* corrupted record, fall back to draft */ }
        }
      }

      const draft = loadCustomActionDraft()
      if (!draft || draft.symbol !== sym) return
      const setSize = Math.max(1, Math.min(20, draft.setSize))
      const validArrows = draft.arrows.filter(a =>
        Number.isInteger(a.from) && Number.isInteger(a.to) &&
        a.from >= 0 && a.from < setSize && a.to >= 0 && a.to < setSize)
      let result: ReturnType<typeof buildActionComputation> | null = null
      try {
        result = buildActionComputation(currentGroup, { kind: 'custom', setSize }, validArrows)
      } catch { /* corrupted draft, ignore */ }
      if (result?.computation && result.computation.isHomomorphism) {
        setActionKind('custom')
        setActionSetSize(setSize)
        setActionArrows(validArrows)
        setActionGroupSymbol(sym)
        setActionComputation(result.computation)
        setActionEditing(false)
        setHintMessage(t('action.draftRestored'))
      } else if (validArrows.length > 0) {
        setActionKind('custom')
        setActionSetSize(setSize)
        setActionArrows(validArrows)
        setActionGroupSymbol(sym)
        setActionEditing(true)
        setHintMessage(t('action.draftRestored'))
      }
    })
  }, [currentGroup, setHintMessage, t])

  useEffect(() => {
    if (actionKind !== 'custom' || actionGroupSymbol === null || actionSetSize === null) return
    saveCustomActionDraft({
      symbol: actionGroupSymbol,
      setSize: actionSetSize,
      arrows: actionArrows,
      savedAt: Date.now(),
    })
  }, [actionKind, actionGroupSymbol, actionSetSize, actionArrows])

  useEffect(() => {
    saveGroupActionsToStorage(savedActions)
  }, [savedActions])

  const createConjugationAction = useCallback((group: Group) => {
    const result = buildActionComputation(group, { kind: 'conjugation' })
    if (result.computation) {
      setActionKind('conjugation')
      setActionComputation(result.computation)
      setActionGroupSymbol(null)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionError(null)
      setActionSelectedElement(null)
      setHintMessage(t('action.created', { kind: t('action.kind.conjugation') }))
    }
  }, [setHintMessage, t])

  const createSylowAction = useCallback((group: Group, prime: number) => {
    const result = buildActionComputation(group, { kind: 'sylow', prime })
    if (result.computation) {
      setActionKind('sylow')
      setActionPrime(prime)
      setActionComputation(result.computation)
      setActionGroupSymbol(null)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionError(null)
      setActionSelectedElement(null)
      setHintMessage(t('action.created', { kind: t('action.kind.sylow', { p: prime }) }))
    }
  }, [setHintMessage, t])

  const startCustomAction = useCallback((group: Group, n: number) => {
    setActionKind('custom')
    setActionGroupSymbol(group.symbol)
    setActionSetSize(n)
    setActionComputation(null)
    setActionArrows([])
    setActionEditing(true)
    setActionError(null)
    setActionSelectedElement(null)
    setHintMessage(t('action.editHint'))
  }, [setHintMessage, t])

  const addArrow = useCallback((from: number, to: number, generatorId: string | null = null) => {
    setActionArrows(prev => {
      const key = generatorId === null ? `u|${from}|${to}` : `${generatorId}|${from}`
      const existingIdx = prev.findIndex(a =>
        (a.generatorId === null ? `u|${a.from}|${a.to}` : `${a.generatorId}|${a.from}`) === key)
      if (existingIdx !== -1) {
        const next = prev.slice()
        next[existingIdx] = { ...next[existingIdx], to, generatorId }
        return next
      }
      return [...prev, { generatorId, from, to }]
    })
    setActionError(null)
  }, [])

  const bindArrow = useCallback((from: number, to: number, generatorId: string) => {
    setActionArrows(prev => {
      const unbound = prev.find(a => a.generatorId === null && a.from === from && a.to === to)
      if (!unbound) return prev
      const next = prev.filter(a =>
        !(a.generatorId === null && a.from === from && a.to === to) &&
        !(a.generatorId === generatorId && a.from === from))
      next.push({ generatorId, from, to })
      return next
    })
    setActionError(null)
  }, [])

  const removeArrow = useCallback((from: number, generatorId: string | null = null, to?: number) => {
    setActionArrows(prev => prev.filter(a => {
      if (generatorId === null) {
        return !(a.from === from && a.generatorId === null && (to === undefined || a.to === to))
      }
      return !(a.from === from && a.generatorId === generatorId)
    }))
  }, [])

  const removeArrowAll = useCallback((from: number) => {
    setActionArrows(prev => prev.filter(a => a.from !== from))
  }, [])

  const replaceGenArrows = useCallback((generatorId: string | null, pairs: [number, number][]) => {
    const pairFroms = new Set(pairs.map(([from]) => from))
    setActionArrows(prev => [
      ...prev.filter(a => a.generatorId !== generatorId && !(pairFroms.has(a.from) && a.generatorId === null)),
      ...pairs.map(([from, to]) => ({ generatorId, from, to })),
    ])
    setActionError(null)
  }, [])

  const clearArrows = useCallback(() => {
    setActionArrows([])
    setActionError(null)
  }, [])

  const completeCustomAction = useCallback((group: Group) => {
    if (!actionSetSize) return
    const result = buildActionComputation(group, { kind: 'custom', setSize: actionSetSize }, actionArrows)
    if (result.error) {
      setActionError(result.error)
      setActionComputation(null)
      return
    }
    if (result.computation) {
      if (!result.computation.isHomomorphism && result.computation.violation) {
        const v = result.computation.violation
        setActionError({ generatorId: v.a, from: v.x, to: -1, g: v.g, type: 'homomorphism' })
        setActionComputation(null)
        setHintMessage(t('action.invalid'))
        return
      }
      setActionComputation(result.computation)
      setActionEditing(false)
      setActionError(null)
      const arrowsJson = JSON.stringify(actionArrows)
      const exists = savedActionsRef.current.some(s =>
        s.symbol === group.symbol && s.setSize === actionSetSize && JSON.stringify(s.arrows) === arrowsJson)
      if (!exists) {
        const rec: StoredGroupAction = {
          id: `action-${Date.now()}`,
          symbol: group.symbol,
          setSize: actionSetSize,
          arrows: actionArrows,
          savedAt: Date.now(),
        }
        setSavedActions(prev => [...prev, rec])
        setHintMessage(t('action.saved'))
      } else {
        setHintMessage(t('action.valid'))
      }
    }
  }, [actionSetSize, actionArrows, setHintMessage, t])

  const setActionSelectedElementCb = useCallback((x: number | null) => {
    setActionSelectedElement(x)
  }, [])

  const setActionHoverElementCb = useCallback((id: string | null) => {
    setActionHoverElement(id)
  }, [])

  const clearAction = useCallback(() => {
    setActionKind(null)
    setActionPrime(null)
    setActionGroupSymbol(null)
    setActionSetSize(null)
    setActionArrows([])
    setActionEditing(false)
    setActionComputation(null)
    setActionError(null)
    setActionSelectedElement(null)
    setActionHoverElement(null)
    removeCustomActionDraft()
  }, [])

  const activateSavedAction = useCallback((id: string) => {
    const rec = savedActionsRef.current.find(s => s.id === id)
    if (!rec) return
    const group = currentGroup && currentGroup.symbol === rec.symbol
      ? currentGroup
      : createGroupFromSymbol(rec.symbol)
    if (!group) return
    if (group.symbol !== currentGroup?.symbol) {
      pendingActivateRef.current = id
      setCurrentGroup(group)
      return
    }
    try {
      const result = buildActionComputation(group, { kind: 'custom', setSize: rec.setSize }, rec.arrows)
      if (result.computation && result.computation.isHomomorphism) {
        setActionKind('custom')
        setActionSetSize(rec.setSize)
        setActionArrows(rec.arrows)
        setActionGroupSymbol(group.symbol)
        setActionComputation(result.computation)
        setActionEditing(false)
        setActionError(null)
        setHintMessage(t('action.activated'))
      }
    } catch { /* corrupted record, ignore */ }
  }, [currentGroup, setCurrentGroup, setHintMessage, t])

  const deleteSavedAction = useCallback((id: string) => {
    setSavedActions(prev => prev.filter(s => s.id !== id))
  }, [])

  const value: GroupActionContextType = {
    actionKind, actionPrime, actionGroupSymbol, actionSetSize, actionArrows, actionEditing,
    actionComputation, actionError, actionSelectedElement, actionHoverElement,
    createConjugationAction, createSylowAction, startCustomAction,
    addArrow, bindArrow, removeArrow, removeArrowAll, replaceGenArrows, clearArrows, completeCustomAction,
    setActionSelectedElement: setActionSelectedElementCb,
    setActionHoverElement: setActionHoverElementCb,
    clearAction,
    savedActions,
    activateSavedAction,
    deleteSavedAction,
  }

  return (
    <GroupActionContext.Provider value={value}>
      {children}
    </GroupActionContext.Provider>
  )
}

export function useGroupAction() {
  const context = useContext(GroupActionContext)
  if (!context) {
    throw new Error('useGroupAction must be used within GroupActionProvider')
  }
  return context
}

export { GroupActionContext }

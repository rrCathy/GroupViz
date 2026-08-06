/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import type { Group, GroupActionArrow, GroupActionComputation, GroupActionKind } from '../../core/types'
import { buildActionComputation, type CustomArrowError } from '../../core/algebra/actions'

interface GroupActionState {
  actionKind: GroupActionKind | null
  actionPrime: number | null
  actionSetSize: number | null
  actionArrows: GroupActionArrow[]
  actionEditing: boolean
  actionComputation: GroupActionComputation | null
  actionError: CustomArrowError | null
  actionSelectedElement: number | null
  actionHoverElement: string | null
}

interface GroupActionActions {
  createConjugationAction: (group: Group) => void
  createSylowAction: (group: Group, prime: number) => void
  startCustomAction: (group: Group, n: number) => void
  addArrow: (from: number, to: number) => void
  bindArrow: (from: number, generatorId: string) => void
  removeArrow: (from: number) => void
  replaceGenArrows: (generatorId: string | null, pairs: [number, number][]) => void
  clearArrows: () => void
  completeCustomAction: (group: Group) => void
  setActionSelectedElement: (x: number | null) => void
  setActionHoverElement: (id: string | null) => void
  clearAction: () => void
}

export type GroupActionContextType = GroupActionState & GroupActionActions

const GroupActionContext = createContext<GroupActionContextType | null>(null)

export function GroupActionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage } = useGroupCore()

  const [actionKind, setActionKind] = useState<GroupActionKind | null>(null)
  const [actionPrime, setActionPrime] = useState<number | null>(null)
  const [actionSetSize, setActionSetSize] = useState<number | null>(null)
  const [actionArrows, setActionArrows] = useState<GroupActionArrow[]>([])
  const [actionEditing, setActionEditing] = useState(false)
  const [actionComputation, setActionComputation] = useState<GroupActionComputation | null>(null)
  const [actionError, setActionError] = useState<CustomArrowError | null>(null)
  const [actionSelectedElement, setActionSelectedElement] = useState<number | null>(null)
  const [actionHoverElement, setActionHoverElement] = useState<string | null>(null)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setActionKind(null)
      setActionPrime(null)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionComputation(null)
      setActionError(null)
      setActionSelectedElement(null)
      setActionHoverElement(null)
    })
  }, [currentGroup])

  const createConjugationAction = useCallback((group: Group) => {
    const result = buildActionComputation(group, { kind: 'conjugation' })
    if (result.computation) {
      setActionKind('conjugation')
      setActionComputation(result.computation)
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
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionError(null)
      setActionSelectedElement(null)
      setHintMessage(t('action.created', { kind: t('action.kind.sylow', { p: prime }) }))
    }
  }, [setHintMessage, t])

  const startCustomAction = useCallback((_group: Group, n: number) => {
    setActionKind('custom')
    setActionSetSize(n)
    setActionComputation(null)
    setActionArrows([])
    setActionEditing(true)
    setActionError(null)
    setActionSelectedElement(null)
    setHintMessage(t('action.editHint'))
  }, [setHintMessage, t])

  const addArrow = useCallback((from: number, to: number) => {
    setActionArrows(prev => {
      const existing = prev.findIndex(a => a.from === from)
      if (existing !== -1) {
        const next = prev.slice()
        next[existing] = { ...next[existing], to }
        return next
      }
      return [...prev, { generatorId: null, from, to }]
    })
    setActionError(null)
  }, [])

  const bindArrow = useCallback((from: number, generatorId: string) => {
    setActionArrows(prev => {
      const existing = prev.findIndex(a => a.from === from)
      if (existing === -1) return prev
      const next = prev.slice()
      next[existing] = { ...next[existing], generatorId }
      return next
    })
    setActionError(null)
  }, [])

  const removeArrow = useCallback((from: number) => {
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
      setHintMessage(t('action.valid'))
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
    setActionSetSize(null)
    setActionArrows([])
    setActionEditing(false)
    setActionComputation(null)
    setActionError(null)
    setActionSelectedElement(null)
    setActionHoverElement(null)
  }, [])

  const value: GroupActionContextType = {
    actionKind, actionPrime, actionSetSize, actionArrows, actionEditing,
    actionComputation, actionError, actionSelectedElement, actionHoverElement,
    createConjugationAction, createSylowAction, startCustomAction,
    addArrow, bindArrow, removeArrow, replaceGenArrows, clearArrows, completeCustomAction,
    setActionSelectedElement: setActionSelectedElementCb,
    setActionHoverElement: setActionHoverElementCb,
    clearAction,
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

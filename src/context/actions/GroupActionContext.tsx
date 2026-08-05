/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import type { Group, GroupActionArrow, GroupActionComputation, GroupActionKind } from '../../core/types'
import type { PolyhedronType } from '../../core/polyhedra'
import { buildActionComputation, type CustomArrowError } from '../../core/algebra/actions'

interface GroupActionState {
  actionKind: GroupActionKind | null
  actionGeometry: PolyhedronType | null
  actionSetSize: number | null
  actionArrows: GroupActionArrow[]
  actionEditing: boolean
  actionComputation: GroupActionComputation | null
  actionError: CustomArrowError | null
  actionSelectedElement: number | null
  actionHoverElement: string | null
  actionShowEdges: boolean
}

interface GroupActionActions {
  createConjugationAction: (group: Group) => void
  createGeometryAction: (group: Group, geometry: PolyhedronType) => void
  startCustomAction: (group: Group, n: number) => void
  addArrow: (from: number, to: number) => void
  bindArrow: (from: number, generatorId: string) => void
  removeArrow: (from: number) => void
  clearArrows: () => void
  completeCustomAction: (group: Group) => void
  setActionSelectedElement: (x: number | null) => void
  setActionHoverElement: (id: string | null) => void
  setActionShowEdges: (show: boolean) => void
  clearAction: () => void
}

export type GroupActionContextType = GroupActionState & GroupActionActions

const GroupActionContext = createContext<GroupActionContextType | null>(null)

export function GroupActionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage } = useGroupCore()

  const [actionKind, setActionKind] = useState<GroupActionKind | null>(null)
  const [actionGeometry, setActionGeometry] = useState<PolyhedronType | null>(null)
  const [actionSetSize, setActionSetSize] = useState<number | null>(null)
  const [actionArrows, setActionArrows] = useState<GroupActionArrow[]>([])
  const [actionEditing, setActionEditing] = useState(false)
  const [actionComputation, setActionComputation] = useState<GroupActionComputation | null>(null)
  const [actionError, setActionError] = useState<CustomArrowError | null>(null)
  const [actionSelectedElement, setActionSelectedElement] = useState<number | null>(null)
  const [actionHoverElement, setActionHoverElement] = useState<string | null>(null)
  const [actionShowEdges, setActionShowEdges] = useState(true)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setActionKind(null)
      setActionGeometry(null)
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
      setActionGeometry(null)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionError(null)
      setActionSelectedElement(null)
      setHintMessage(t('action.created', { kind: t('action.kind.conjugation') }))
    }
  }, [setHintMessage, t])

  const createGeometryAction = useCallback((group: Group, geometry: PolyhedronType) => {
    const result = buildActionComputation(group, { kind: 'geometry', geometry })
    if (result.computation) {
      setActionKind('geometry')
      setActionGeometry(geometry)
      setActionComputation(result.computation)
      setActionSetSize(null)
      setActionArrows([])
      setActionEditing(false)
      setActionError(null)
      setActionSelectedElement(null)
      setHintMessage(t('action.created', { kind: t('action.kind.geometry') }))
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
      setActionComputation(result.computation)
      setActionEditing(false)
      setActionError(null)
      if (result.computation.isHomomorphism) {
        setHintMessage(t('action.valid'))
      } else {
        setHintMessage(t('action.invalid'))
      }
    }
  }, [actionSetSize, actionArrows, setHintMessage, t])

  const setActionSelectedElementCb = useCallback((x: number | null) => {
    setActionSelectedElement(x)
  }, [])

  const setActionHoverElementCb = useCallback((id: string | null) => {
    setActionHoverElement(id)
  }, [])

  const setActionShowEdgesCb = useCallback((show: boolean) => {
    setActionShowEdges(show)
  }, [])

  const clearAction = useCallback(() => {
    setActionKind(null)
    setActionGeometry(null)
    setActionSetSize(null)
    setActionArrows([])
    setActionEditing(false)
    setActionComputation(null)
    setActionError(null)
    setActionSelectedElement(null)
    setActionHoverElement(null)
  }, [])

  const value: GroupActionContextType = {
    actionKind, actionGeometry, actionSetSize, actionArrows, actionEditing,
    actionComputation, actionError, actionSelectedElement, actionHoverElement, actionShowEdges,
    createConjugationAction, createGeometryAction, startCustomAction,
    addArrow, bindArrow, removeArrow, clearArrows, completeCustomAction,
    setActionSelectedElement: setActionSelectedElementCb,
    setActionHoverElement: setActionHoverElementCb,
    setActionShowEdges: setActionShowEdgesCb,
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

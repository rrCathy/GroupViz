/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { ViewMode, FloatingView } from '../../core/types'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'

interface GroupMultiViewState {
  multiViewMode: boolean
  floatingViews: FloatingView[]
}

interface GroupMultiViewActions {
  toggleMultiViewMode: () => void
  openFloatingView: (view: ViewMode) => void
  closeFloatingView: (id: string) => void
}

export type GroupMultiViewContextType = GroupMultiViewState & GroupMultiViewActions

const GroupMultiViewContext = createContext<GroupMultiViewContextType | null>(null)

export function GroupMultiViewProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, addOperationHistory, setHintMessage, getViewLabel } = useGroupCore()

  const [multiViewMode, setMultiViewMode] = useState(false)
  const [floatingViews, setFloatingViews] = useState<FloatingView[]>([])
  const didMountRef = useRef(false)

  const toggleMultiViewMode = useCallback(() => {
    setMultiViewMode(prev => !prev)
  }, [])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (multiViewMode) {
      setHintMessage(t('hint.multiViewOn'))
      addOperationHistory(t('op.multiViewOn'))
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFloatingViews([])
      setHintMessage(t('hint.multiViewOff'))
      addOperationHistory(t('op.multiViewOff'))
    }
  }, [multiViewMode, addOperationHistory, setHintMessage, t])

  const openFloatingView = useCallback((view: ViewMode) => {
    if (!multiViewMode || !currentGroup) return
    const id = `fv-${Date.now()}`
    const newFv: FloatingView = { id, view, title: getViewLabel(view) || view }
    setFloatingViews(prev => [...prev, newFv])
    addOperationHistory(t('op.openFloatView', { viewLabel: getViewLabel(view) }))
  }, [multiViewMode, currentGroup, addOperationHistory, t, getViewLabel])

  const closeFloatingView = useCallback((id: string) => {
    setFloatingViews(prev => prev.filter(fv => fv.id !== id))
  }, [])

  const value: GroupMultiViewContextType = {
    multiViewMode, floatingViews,
    toggleMultiViewMode, openFloatingView, closeFloatingView,
  }

  return (
    <GroupMultiViewContext.Provider value={value}>
      {children}
    </GroupMultiViewContext.Provider>
  )
}

export function useGroupMultiView() {
  const context = useContext(GroupMultiViewContext)
  if (!context) {
    throw new Error('useGroupMultiView must be used within GroupMultiViewProvider')
  }
  return context
}

export { GroupMultiViewContext }

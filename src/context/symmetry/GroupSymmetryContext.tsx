/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'

interface GroupSymmetryState {
  symmetryShowAction: boolean
  symmetryRotateSpeed: number
  symmetryActionElementId: string | null
  selfInverseElementId: string | null
}

interface GroupSymmetryActions {
  setSymmetryShowAction: (show: boolean) => void
  setSymmetryRotateSpeed: (speed: number) => void
  setSymmetryActionElementId: (id: string | null) => void
  setSelfInverseElementId: (id: string | null) => void
}

export type GroupSymmetryContextType = GroupSymmetryState & GroupSymmetryActions

const GroupSymmetryContext = createContext<GroupSymmetryContextType | null>(null)

export function GroupSymmetryProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage } = useGroupCore()

  const [symmetryShowAction, setSymmetryShowActionState] = useState(false)
  const [symmetryRotateSpeed, setSymmetryRotateSpeedState] = useState(1)
  const [symmetryActionElementId, setSymmetryActionElementIdState] = useState<string | null>(null)
  const [selfInverseElementId, setSelfInverseElementIdState] = useState<string | null>(null)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setSelfInverseElementIdState(null)
      setSymmetryActionElementIdState(null)
      setSymmetryShowActionState(false)
    })
  }, [currentGroup])

  const setSymmetryShowAction = useCallback((show: boolean) => {
    setSymmetryShowActionState(show)
    if (!show) {
      setSymmetryActionElementIdState(null)
      setHintMessage(t('symmetry.demoOff'))
    } else {
      setHintMessage(t('symmetry.selectHint'))
    }
  }, [setHintMessage, t])

  const setSymmetryRotateSpeed = useCallback((speed: number) => {
    setSymmetryRotateSpeedState(speed)
  }, [])

  const setSymmetryActionElementId = useCallback((id: string | null) => {
    setSymmetryActionElementIdState(id)
  }, [])

  const setSelfInverseElementId = useCallback((id: string | null) => {
    setSelfInverseElementIdState(id)
  }, [])

  const value: GroupSymmetryContextType = {
    symmetryShowAction, symmetryRotateSpeed, symmetryActionElementId, selfInverseElementId,
    setSymmetryShowAction, setSymmetryRotateSpeed, setSymmetryActionElementId, setSelfInverseElementId,
  }

  return (
    <GroupSymmetryContext.Provider value={value}>
      {children}
    </GroupSymmetryContext.Provider>
  )
}

export function useGroupSymmetry() {
  const context = useContext(GroupSymmetryContext)
  if (!context) {
    throw new Error('useGroupSymmetry must be used within GroupSymmetryProvider')
  }
  return context
}

export { GroupSymmetryContext }

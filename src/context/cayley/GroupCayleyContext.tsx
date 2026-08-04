/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { GroupAction, MultiplyType, Layout3D } from '../../core/types'
import { type CayleyShape2D } from '../../core/types'
import { getViewBoxSize } from '../../core/viewBox'
import { computeShape2DPositions } from '../../core/algebra/shapeLayouts'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  getInitialCayleyActions, getCayleyShapeConfig, getSpecialCayleyActions,
  toggleCayleyActionReducer, addAllCayleyActionsHelper
} from '../cayleyActions'

interface GroupCayleyState {
  cayleyMultiplyType: MultiplyType
  cayleyActions: GroupAction[]
  cayleyShape3D: Layout3D
  cayleyAvailableShapes3D: Layout3D[]
  cayleyShape2D: CayleyShape2D
  cayleyAvailableShapes2D: CayleyShape2D[]
}

interface GroupCayleyActions {
  setCayleyMultiplyType: (type: MultiplyType) => void
  setCayleyActions: (actions: GroupAction[]) => void
  setCayleyShape3D: (shape: Layout3D) => void
  setCayleyShape2D: (shape: CayleyShape2D) => void
  toggleCayleyAction: (elementId: string) => void
  addAllCayleyActions: () => void
  clearCayleyActions: () => void
}

export type GroupCayleyContextType = GroupCayleyState & GroupCayleyActions

const GroupCayleyContext = createContext<GroupCayleyContextType | null>(null)

export function GroupCayleyProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const {
    currentGroup, currentView, batchSetNodePositions, resetNodePositions,
    addOperationHistory, setHintMessage, forceShowLargeGroupViews,
  } = useGroupCore()

  const [cayleyMultiplyType, setCayleyMultiplyTypeState] = useState<MultiplyType>('right')
  const [cayleyActions, setCayleyActionsState] = useState<GroupAction[]>([])
  const [cayleyShape3D, setCayleyShape3DState] = useState<Layout3D>('spherical')
  const [cayleyAvailableShapes3D, setCayleyAvailableShapes3D] = useState<Layout3D[]>(['spherical', 'circular'])
  const [cayleyShape2D, setCayleyShape2DState] = useState<CayleyShape2D>('circular')
  const [cayleyAvailableShapes2D, setCayleyAvailableShapes2D] = useState<CayleyShape2D[]>(['circular', 'grid'])
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return

    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      const actions = getInitialCayleyActions(currentGroup)
      setCayleyActionsState(actions)
      setCayleyMultiplyTypeState('right')

      const shapeConfig = getCayleyShapeConfig(currentGroup)
      setCayleyShape3DState(shapeConfig.defaultShape3D)
      setCayleyAvailableShapes3D(shapeConfig.availableShapes3D)
      setCayleyAvailableShapes2D(shapeConfig.availableShapes2D)
      setCayleyShape2DState(shapeConfig.defaultShape2D)

      // Sync node positions to the new default 2D shape so saved positions
      // do not override the intended layout on the next render.
      if (currentView === 'cayley') {
        const vbs = getViewBoxSize(currentGroup.order, 'cayley', forceShowLargeGroupViews.has('cayley'))
        const pos = computeShape2DPositions(currentGroup, shapeConfig.defaultShape2D, vbs.width, vbs.height)
        if (pos) {
          const positions = 'positions' in pos ? (pos as { positions: Map<string, { x: number; y: number }> }).positions : pos as Map<string, { x: number; y: number }>
          if (positions.size > 0) {
            batchSetNodePositions(positions)
          }
        }
      }

      const specialActions = getSpecialCayleyActions(currentGroup, shapeConfig.defaultShape3D)
      if (specialActions) {
        setCayleyActionsState(specialActions)
      }
    })
  }, [currentGroup, currentView, forceShowLargeGroupViews, batchSetNodePositions])

  const setCayleyMultiplyType = useCallback((type: MultiplyType) => {
    setCayleyMultiplyTypeState(type)
    const label = type === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')
    setHintMessage(t('hint.cayleyMultiply', { label }).replace(label, `<span class="hint-highlight">${label}</span>`))
    addOperationHistory(t('op.setCayleyMultiply', { label }))
  }, [addOperationHistory, setHintMessage, t])

  const toggleCayleyAction = useCallback((elementId: string) => {
    setCayleyActionsState(prev => toggleCayleyActionReducer(prev, elementId))
  }, [])

  const addAllCayleyActions = useCallback(() => {
    if (!currentGroup) return
    const actions = addAllCayleyActionsHelper(currentGroup, currentView, cayleyShape3D, cayleyActions)
    setCayleyActionsState(actions)
  }, [currentGroup, cayleyActions, currentView, cayleyShape3D])

  const clearCayleyActions = useCallback(() => {
    setCayleyActionsState([])
    setHintMessage(t('hint.cayleyCleared'))
    addOperationHistory(t('op.clearCayley'))
  }, [addOperationHistory, setHintMessage, t])

  const setCayleyActions = useCallback((actions: GroupAction[]) => {
    setCayleyActionsState(actions)
  }, [])

  const setCayleyShape3D = useCallback((shape: Layout3D) => {
    setCayleyShape3DState(shape)
    setHintMessage(t('hint.cayleyShape', { shape }).replace(shape, `<span class="hint-highlight">${shape}</span>`))
    addOperationHistory(t('op.setShape', { shape }))

    if (currentGroup) {
      const specialActions = getSpecialCayleyActions(currentGroup, shape)
      if (specialActions) {
        setCayleyActionsState(specialActions)
      }
    }
  }, [addOperationHistory, currentGroup, setHintMessage, t])

  const setCayleyShape2D = useCallback((shape: CayleyShape2D) => {
    setCayleyShape2DState(shape)
    if (currentGroup && currentView === 'cayley') {
      const vbs = getViewBoxSize(currentGroup.order, 'cayley', forceShowLargeGroupViews.has('cayley'))
      const pos = computeShape2DPositions(currentGroup, shape, vbs.width, vbs.height)
      if (pos) {
        const positions = 'positions' in pos ? (pos as { positions: Map<string, { x: number; y: number }> }).positions : pos as Map<string, { x: number; y: number }>
        if (positions.size > 0) {
          batchSetNodePositions(positions)
        } else if (shape === 'circular') {
          resetNodePositions(shape)
        }
      } else if (shape === 'circular') {
        resetNodePositions(shape)
      }
    }
  }, [currentGroup, currentView, forceShowLargeGroupViews, batchSetNodePositions, resetNodePositions])

  const value: GroupCayleyContextType = {
    cayleyMultiplyType, cayleyActions, cayleyShape3D, cayleyAvailableShapes3D,
    cayleyShape2D, cayleyAvailableShapes2D,
    setCayleyMultiplyType, setCayleyActions, setCayleyShape3D, setCayleyShape2D,
    toggleCayleyAction, addAllCayleyActions, clearCayleyActions,
  }

  return (
    <GroupCayleyContext.Provider value={value}>
      {children}
    </GroupCayleyContext.Provider>
  )
}

export function useGroupCayley() {
  const context = useContext(GroupCayleyContext)
  if (!context) {
    throw new Error('useGroupCayley must be used within GroupCayleyProvider')
  }
  return context
}

export { GroupCayleyContext }

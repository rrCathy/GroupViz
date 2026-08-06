/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useTransition, type ReactNode } from 'react'
import type { Group, GroupElement, ViewMode, CanvasTransform, SubgroupCheckResult } from '../../core/types'
import { type CayleyShape2D, getDefaultShape2D } from '../../core/types'
import { getViewBoxSize, type ViewBoxSize } from '../../core/viewBox'
import { useTranslation } from '../../i18n/useTranslation'
import { initializeNodePositions, type NodePositionsMap } from '../positionUtils'

interface GroupCoreState {
  currentGroup: Group | null
  currentView: ViewMode
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  operationHistory: string[]
  nodePositions: NodePositionsMap
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  showMaximalCycles: boolean
  hintMessage: string
  forceShowLargeGroupViews: Set<ViewMode>
  viewBoxSize: ViewBoxSize
  isPending: boolean
  isLargeGroup: boolean
}

interface GroupCoreActions {
  setCurrentGroup: (group: Group) => void
  setCurrentView: (view: ViewMode) => void
  selectElement: (id: string, additive?: boolean) => void
  clearSelection: () => void
  setCanvasTransform: (transform: Partial<CanvasTransform>) => void
  resetCanvasTransform: () => void
  addOperationHistory: (op: string) => void
  setNodePosition: (id: string, x: number, y: number) => void
  batchSetNodePositions: (positions: Map<string, { x: number; y: number }>) => void
  getNodePosition: (id: string) => { x: number; y: number } | undefined
  addViewTab: (view: ViewMode) => void
  closeViewTab: (id: string) => void
  setActiveTab: (id: string) => void
  setHoverElement: (el: GroupElement | null) => void
  checkSubsetProperty: (elements: string[]) => SubgroupCheckResult
  generateSubgroups: () => void
  selectNextElement: () => void
  selectPrevElement: () => void
  setShowMaximalCycles: (show: boolean) => void
  setHintMessage: (msg: string) => void
  setForceShowLargeGroupForView: (view: ViewMode, allow: boolean) => void
  resetNodePositions: (shape2D?: CayleyShape2D) => void
  clearAllNodePositions: () => void
  getViewLabel: (view: ViewMode) => string
}

export type GroupCoreContextType = GroupCoreState & GroupCoreActions

const GroupCoreContext = createContext<GroupCoreContextType | null>(null)

export function GroupCoreProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()

  const getViewLabel = useCallback((view: ViewMode) => {
    const keyMap: Record<ViewMode, string> = {
      set: 'view.set', cayley: 'view.cayley', cycle: 'view.cycle',
      table: 'view.table', '3d': 'view.3d', symmetry: 'view.symmetry',
      sublattice: 'view.sublattice', homomorphism: 'view.homomorphism',
      cosetstrip: 'view.cosetstrip', action: 'view.action',
    }
    return t(keyMap[view])
  }, [t])

  const [currentGroup, setCurrentGroupState] = useState<Group | null>(null)
  const [currentView, setCurrentViewState] = useState<ViewMode>('set')
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set())
  const [canvasTransform, setCanvasTransformState] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const [operationHistory, setOperationHistory] = useState<string[]>([])
  const [nodePositions, setNodePositions] = useState<NodePositionsMap>(new Map())
  const [viewTabsBase, setViewTabsBase] = useState<{ id: string; view: ViewMode }[]>(() => [{ id: 'tab-1', view: 'set' }])
  const viewTabs = useMemo(() =>
    viewTabsBase.map(tab => ({ ...tab, label: getViewLabel(tab.view) })),
    [viewTabsBase, getViewLabel]
  )
  const [activeTabId, setActiveTabId] = useState('tab-1')
  const [hoverElement, setHoverElementState] = useState<GroupElement | null>(null)
  const [showMaximalCycles, setShowMaximalCycles] = useState(false)
  const [hintMessage, setHintMessage] = useState('')
  const [forceShowLargeGroupViews, setForceShowLargeGroupViewsState] = useState<Set<ViewMode>>(new Set())

  const viewBoxSize = useMemo(() => {
    if (!currentGroup) return { width: 800, height: 560 }
    const force = forceShowLargeGroupViews.has(currentView)
    return getViewBoxSize(currentGroup.order, currentView, force)
  }, [currentGroup, currentView, forceShowLargeGroupViews])

  const isLargeGroup = (currentGroup?.order ?? 0) > 60

  const addOperationHistory = useCallback((op: string) => {
    setOperationHistory(prev => [...prev.slice(-19), op])
  }, [])

  const setCurrentGroup = useCallback((group: Group) => {
    startTransition(() => {
      setCurrentGroupState(group)
      setSelectedElements(new Set())
      setOperationHistory([])
      setCanvasTransformState({ x: 0, y: 0, scale: 1 })
      setForceShowLargeGroupViewsState(new Set())
      setHintMessage(t('hint.groupSelected', { name: group.name, order: group.order }).replace(group.name, `<span class="hint-highlight">${group.name}</span>`))

      const defaultShape2D = getDefaultShape2D(group)
      const positions: NodePositionsMap = new Map()
      ;(['set', 'cayley', 'cycle', 'table'] as ViewMode[]).forEach(view => {
        positions.set(view, initializeNodePositions(group, view, view === 'cayley' ? defaultShape2D : undefined))
      })
      setNodePositions(positions)

      addOperationHistory(t('op.loadGroup', { name: group.name, order: group.order }))
    })
  }, [addOperationHistory, startTransition, t])

  const setCurrentView = useCallback((view: ViewMode) => {
    setCurrentViewState(view)
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
    addOperationHistory(t('op.switchView', { view: getViewLabel(view) }))
  }, [addOperationHistory, t, getViewLabel])

  const selectElement = useCallback((id: string, additive = false) => {
    setSelectedElements(prev => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      } else {
        if (prev.has(id)) return new Set()
        return new Set([id])
      }
    })

    if (!additive && currentGroup) {
      const el = currentGroup.elements.find(e => e.id === id)
      if (el) setHintMessage(t('hint.elementSelected', { label: el.label }).replace(el.label, `<span class="hint-highlight">${el.label}</span>`))
    }
  }, [currentGroup, t])

  const clearSelection = useCallback(() => {
    setSelectedElements(new Set())
    setHintMessage('')
  }, [])

  const setCanvasTransform = useCallback((transform: Partial<CanvasTransform>) => {
    setCanvasTransformState(prev => ({ ...prev, ...transform }))
  }, [])

  const resetCanvasTransform = useCallback(() => {
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
  }, [])

  const setNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodePositions(prev => {
      const next = new Map(prev)
      const viewPositions = next.get(currentView) || new Map()
      const updated = new Map(viewPositions)
      updated.set(id, { x, y })
      next.set(currentView, updated)
      return next
    })
  }, [currentView])

  const batchSetNodePositions = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(currentView, positions)
      return next
    })
  }, [currentView])

  const getNodePosition = useCallback((id: string) => {
    return nodePositions.get(currentView)?.get(id)
  }, [nodePositions, currentView])

  const addViewTab = useCallback((view: ViewMode) => {
    const id = `tab-${Date.now()}`
    setViewTabsBase(prev => [...prev, { id, view }])
    setActiveTabId(id)
    setCurrentViewState(view)
  }, [])

  const closeViewTab = useCallback((id: string) => {
    if (viewTabsBase.length <= 1) return
    setViewTabsBase(prev => prev.filter(t => t.id !== id))
    if (activeTabId === id) {
      const remaining = viewTabsBase.filter(t => t.id !== id)
      setActiveTabId(remaining[0].id)
      setCurrentViewState(remaining[0].view)
    }
  }, [viewTabsBase, activeTabId])

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id)
    const tab = viewTabs.find(t => t.id === id)
    if (tab) setCurrentViewState(tab.view)
  }, [viewTabs])

  const setHoverElement = useCallback((el: GroupElement | null) => {
    setHoverElementState(el)
  }, [])

  const checkSubsetProperty = useCallback((elements: string[]): SubgroupCheckResult => {
    const result: SubgroupCheckResult = {
      type: 'subset',
      label: t('subset.plain'),
      color: '#888888'
    }

    if (!currentGroup || elements.length === 0) return result

    const selectedSet = new Set(elements)

    let isClosed = true
    for (const a of elements) {
      const elA = currentGroup.elements.find(e => e.id === a)
      if (!elA) continue

      for (const b of elements) {
        const elB = currentGroup.elements.find(e => e.id === b)
        if (!elB) continue

        const product = currentGroup.multiply(elA, elB)
        if (!selectedSet.has(product.id)) {
          isClosed = false
          break
        }
      }
      if (!isClosed) break
    }

    if (isClosed) {
      result.type = 'subgroup'
      result.label = t('subset.subgroup')
      result.color = '#4ecdc4'

      let isNormal = true
      for (const a of elements) {
        const elA = currentGroup.elements.find(e => e.id === a)
        if (!elA) continue

        for (const elG of currentGroup.elements) {
          const conj = currentGroup.multiply(currentGroup.multiply(elG, elA), currentGroup.inverse(elG))
          if (!selectedSet.has(conj.id)) {
            isNormal = false
            break
          }
        }
        if (!isNormal) break
      }

      if (isNormal) {
        result.type = 'normal-subgroup'
        result.label = t('subset.normalSubgroup')
        result.color = '#9b59b6'
      }
    }

    addOperationHistory(t('op.checkSubset', { label: result.label }))
    return result
  }, [currentGroup, addOperationHistory, t])

  const generateSubgroups = useCallback(() => {
    addOperationHistory(t('op.generateSubgroup'))
  }, [addOperationHistory, t])

  const selectNextElement = useCallback(() => {
    if (!currentGroup || currentGroup.elements.length === 0) return
    let currentIdx = -1
    if (selectedElements.size > 0) {
      const currentId = Array.from(selectedElements)[0]
      currentIdx = currentGroup.elements.findIndex(el => el.id === currentId)
    }
    const nextIdx = (currentIdx + 1) % currentGroup.elements.length
    setSelectedElements(new Set([currentGroup.elements[nextIdx].id]))
  }, [currentGroup, selectedElements])

  const selectPrevElement = useCallback(() => {
    if (!currentGroup || currentGroup.elements.length === 0) return
    let currentIdx = -1
    if (selectedElements.size > 0) {
      const currentId = Array.from(selectedElements)[0]
      currentIdx = currentGroup.elements.findIndex(el => el.id === currentId)
    }
    const prevIdx = currentIdx < 0 ? currentGroup.elements.length - 1 : (currentIdx - 1 + currentGroup.elements.length) % currentGroup.elements.length
    setSelectedElements(new Set([currentGroup.elements[prevIdx].id]))
  }, [currentGroup, selectedElements])

  const resetNodePositions = useCallback((shape2D?: CayleyShape2D) => {
    if (!currentGroup) return
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(currentView, initializeNodePositions(currentGroup, currentView, shape2D, forceShowLargeGroupViews.has(currentView)))
      return next
    })
  }, [currentGroup, currentView, forceShowLargeGroupViews])

  const clearAllNodePositions = useCallback(() => {
    setNodePositions(new Map())
  }, [])

  const setForceShowLargeGroupForView = useCallback((view: ViewMode, allow: boolean) => {
    setForceShowLargeGroupViewsState(prev => {
      const next = new Set(prev)
      if (allow) next.add(view)
      else next.delete(view)
      return next
    })
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
    if (currentGroup) {
      setNodePositions(prev => {
        const next = new Map(prev)
        next.set(view, initializeNodePositions(currentGroup, view, undefined, allow))
        return next
      })
    }
  }, [currentGroup])

  const value: GroupCoreContextType = {
    currentGroup, currentView, selectedElements, canvasTransform, operationHistory,
    nodePositions, viewTabs, activeTabId, hoverElement, showMaximalCycles,
    hintMessage, forceShowLargeGroupViews, viewBoxSize, isPending, isLargeGroup,
    setCurrentGroup, setCurrentView, selectElement, clearSelection, setCanvasTransform,
    resetCanvasTransform, addOperationHistory, setNodePosition, batchSetNodePositions,
    getNodePosition, addViewTab, closeViewTab, setActiveTab, setHoverElement,
    checkSubsetProperty, generateSubgroups, selectNextElement, selectPrevElement,
    setShowMaximalCycles, setHintMessage, setForceShowLargeGroupForView, resetNodePositions, clearAllNodePositions, getViewLabel,
  }

  return (
    <GroupCoreContext.Provider value={value}>
      {children}
    </GroupCoreContext.Provider>
  )
}

export function useGroupCore() {
  const context = useContext(GroupCoreContext)
  if (!context) {
    throw new Error('useGroupCore must be used within GroupCoreProvider')
  }
  return context
}

export { GroupCoreContext }

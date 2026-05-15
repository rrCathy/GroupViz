import { createContext, useState, useCallback, useMemo, useTransition, useRef, type ReactNode } from 'react'
import type { Group, GroupElement, ViewMode, CanvasTransform, SubgroupCheckResult, Subset, FloatingView, MultiplyType, GroupAction, Layout3D } from '../core/types'
import { isGroupDirectProduct, getDefaultShape2D, type CayleyShape2D } from '../core/types'
import { getViewBoxSize, type ViewBoxSize } from '../core/viewBox'
import { isSimpleGroup as checkSimpleGroup, type CosetInfo } from '../core/algebra/subgroups'
import { forceLayout, forceLayoutAsync, planarCycleLayout, computeCycleSubgroups, computeMaximalCycles, directProductGridLayout2D, fibonacci2DLayout } from '../core/algebra/forceLayout'
import { useTranslation } from '../i18n/useTranslation'

import { initializeNodePositions, type NodePositionsMap } from './positionUtils'
import {
  getInitialCayleyActions, getCayleyShapeConfig, getSpecialCayleyActions,
  toggleCayleyActionReducer, addAllCayleyActionsHelper
} from './cayleyActions'
import {
  computeCosetData, computeCosetElementMap, computeCosetColors,
  computeCosetHighlightSet, createSubset
} from './cosetActions'
import {
  loadDirectProductGroupsFromStorage,
  saveDirectProductGroupsToStorage,
  executeDirectProductHelper
} from './directProductActions'

interface GroupContextState {
  currentGroup: Group | null
  currentView: ViewMode
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  operationHistory: string[]
  nodePositions: NodePositionsMap
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  isSimpleGroup: boolean
  showMaximalCycles: boolean
  hintMessage: string
  forceShowLargeGroupViews: Set<ViewMode>
  viewBoxSize: ViewBoxSize
  isPending: boolean
  cayleyMultiplyType: MultiplyType
  cayleyActions: GroupAction[]
  cayleyShape3D: Layout3D
  cayleyAvailableShapes3D: Layout3D[]
  cayleyShape2D: CayleyShape2D
  cayleyAvailableShapes2D: CayleyShape2D[]
  subsets: Subset[]
  multiViewMode: boolean
  floatingViews: FloatingView[]
  symmetryShowAction: boolean
  symmetryRotateSpeed: number
  symmetryActionElementId: string | null
  selfInverseElementId: string | null
  cosetSubsetId: string | null
  cosetType: 'left' | 'right'
  showAllCosets: boolean
  cosetData: CosetInfo | null
  cosetElementMap: Map<string, number>
  cosetHighlightSet: Set<number>
  cosetColors: string[]
  isDirectProductMode: boolean
  directProductSource: Group | null
  directProductTarget: Group | null
  directProductCreationMode: 'cayley' | 'table' | 'direct'
  directProductGroups: Group[]
}

interface GroupContextActions {
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
  computeInverse: () => void
  clearCanvas: () => void
  resetNodePositions: () => void
  runForceLayout: () => void
  generateSubgroups: () => void
  selectNextElement: () => void
  selectPrevElement: () => void
  setShowMaximalCycles: (show: boolean) => void
  setHintMessage: (msg: string) => void
  setForceShowLargeGroupForView: (view: ViewMode, allow: boolean) => void
  setCayleyMultiplyType: (type: MultiplyType) => void
  setCayleyActions: (actions: GroupAction[]) => void
  setCayleyShape3D: (shape: Layout3D) => void
  setCayleyShape2D: (shape: CayleyShape2D) => void
  toggleCayleyAction: (elementId: string) => void
  addAllCayleyActions: () => void
  clearCayleyActions: () => void
  saveSubset: () => void
  removeSubset: (id: string) => void
  clearAllSubsets: () => void
  toggleMultiViewMode: () => void
  openFloatingView: (view: ViewMode) => void
  closeFloatingView: (id: string) => void
  setSymmetryShowAction: (show: boolean) => void
  setSymmetryRotateSpeed: (speed: number) => void
  setSymmetryActionElementId: (id: string | null) => void
  setSelfInverseElementId: (id: string | null) => void
  showCosetsForSubset: (subsetId: string) => void
  hideCosets: () => void
  setCosetType: (type: 'left' | 'right') => void
  toggleShowAllCosets: () => void
  toggleDirectProductMode: () => void
  setDirectProductSource: (group: Group | null) => void
  setDirectProductTarget: (group: Group | null) => void
  setDirectProductCreationMode: (mode: 'cayley' | 'table' | 'direct') => void
  executeDirectProduct: () => Group | null
  storeDirectProductGroup: (group: Group) => void
  removeDirectProductGroup: (symbol: string) => void
  loadDirectProductGroup: (symbol: string) => void
}

export type GroupContextType = GroupContextState & GroupContextActions

const GroupContext = createContext<GroupContextType | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()

  const getViewLabel = useCallback((view: ViewMode) => {
    const keyMap: Record<ViewMode, string> = {
      set: 'view.set', cayley: 'view.cayley', cycle: 'view.cycle',
      table: 'view.table', '3d': 'view.3d', symmetry: 'view.symmetry',
      sublattice: 'view.sublattice'
    }
    return t(keyMap[view])
  }, [t])

  // Core state
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

  // Cayley state
  const [cayleyMultiplyType, setCayleyMultiplyTypeState] = useState<MultiplyType>('right')
  const [cayleyActions, setCayleyActionsState] = useState<GroupAction[]>([])
  const [cayleyShape3D, setCayleyShape3DState] = useState<Layout3D>('spherical')
  const [cayleyAvailableShapes3D, setCayleyAvailableShapes3D] = useState<Layout3D[]>(['spherical', 'circular'])
  const [cayleyShape2D, setCayleyShape2DState] = useState<CayleyShape2D>('circular')
  const [cayleyAvailableShapes2D, setCayleyAvailableShapes2D] = useState<CayleyShape2D[]>(['circular', 'grid'])

  // Subset/Coset state
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [multiViewMode, setMultiViewMode] = useState(false)
  const [floatingViews, setFloatingViews] = useState<FloatingView[]>([])
  const [symmetryShowAction, setSymmetryShowAction] = useState(false)
  const [symmetryRotateSpeed, setSymmetryRotateSpeed] = useState(1)
  const [symmetryActionElementId, setSymmetryActionElementId] = useState<string | null>(null)
  const [selfInverseElementId, setSelfInverseElementId] = useState<string | null>(null)
  const selfInverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cosetSubsetId, setCosetSubsetId] = useState<string | null>(null)
  const [cosetType, setCosetTypeState] = useState<'left' | 'right'>('left')
  const [showAllCosets, setShowAllCosets] = useState(false)

  // Direct product state
  const [isDirectProductMode, setIsDirectProductMode] = useState(false)
  const [directProductSource, setDirectProductSource] = useState<Group | null>(null)
  const [directProductTarget, setDirectProductTarget] = useState<Group | null>(null)
  const [directProductCreationMode, setDirectProductCreationMode] = useState<'cayley' | 'table' | 'direct'>('cayley')
  const [directProductGroups, setDirectProductGroups] = useState<Group[]>(loadDirectProductGroupsFromStorage)

  // Derived state
  const viewBoxSize = useMemo(() => {
    if (!currentGroup) return { width: 800, height: 560 }
    const force = forceShowLargeGroupViews.has(currentView)
    return getViewBoxSize(currentGroup.order, currentView, force)
  }, [currentGroup, currentView, forceShowLargeGroupViews])

  const isSimpleGroup = useMemo(() => {
    if (!currentGroup) return false
    return checkSimpleGroup(currentGroup)
  }, [currentGroup])

  const cosetData = useMemo(() => computeCosetData(currentGroup, cosetSubsetId, subsets), [currentGroup, subsets, cosetSubsetId])
  const cosetElementMap = useMemo(() => computeCosetElementMap(cosetData, cosetType), [cosetData, cosetType])
  const cosetColors = useMemo(() => computeCosetColors(cosetData, cosetType), [cosetData, cosetType])
  const cosetHighlightSet = useMemo(() => computeCosetHighlightSet(cosetData, cosetType, showAllCosets, selectedElements, cosetElementMap), [cosetData, cosetType, showAllCosets, selectedElements, cosetElementMap])

  // Actions
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
      setSelfInverseElementId(null)
      setCosetSubsetId(null)
      setShowAllCosets(false)

      // Initialize Cayley settings
      const actions = getInitialCayleyActions(group)
      setCayleyActionsState(actions)
      setCayleyMultiplyTypeState('right')

      const shapeConfig = getCayleyShapeConfig(group)
      setCayleyShape3DState(shapeConfig.defaultShape3D)
      setCayleyAvailableShapes3D(shapeConfig.availableShapes3D)
      setCayleyAvailableShapes2D(shapeConfig.availableShapes2D)
      setCayleyShape2DState(shapeConfig.defaultShape2D)

      // Apply special Cayley actions for S4/A5
      const specialActions = getSpecialCayleyActions(group, shapeConfig.defaultShape3D)
      if (specialActions) {
        setCayleyActionsState(specialActions)
      }

      // Initialize node positions
      const positions: NodePositionsMap = new Map()
      ;(['set', 'cayley', 'cycle', 'table'] as ViewMode[]).forEach(view => {
        const shape2D = view === 'cayley' ? getDefaultShape2D(group) : undefined
        positions.set(view, initializeNodePositions(group, view, shape2D))
      })
      setNodePositions(positions)

      setSubsets([])
      addOperationHistory(t('op.loadGroup', { name: group.name, order: group.order }))
    })
  }, [addOperationHistory, startTransition, t])

  const setCurrentView = useCallback((view: ViewMode) => {
    setCurrentViewState(view)
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })

    if (view === 'cayley' && currentGroup) {
      const count = cayleyActions.filter(a => a.enabled).length
      setHintMessage(t('hint.cayley', { count, type: cayleyMultiplyType === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft') }))
    } else if (view === '3d' && currentGroup) {
      const count = cayleyActions.filter(a => a.enabled).length
      setHintMessage(t('hint.cayley3d', { count, shape: cayleyShape3D }))
    } else if (view === 'symmetry') {
      setHintMessage(t('hint.symmetry'))
    } else if (view === 'sublattice') {
      setHintMessage(t('hint.sublattice'))
    } else if (view === 'cycle') {
      setHintMessage(t('hint.cycle'))
    } else {
      setHintMessage(t('hint.switchedTo', { viewLabel: getViewLabel(view) }).replace(getViewLabel(view), `<span class="hint-highlight">${getViewLabel(view)}</span>`))
    }

    addOperationHistory(t('op.switchView', { view: getViewLabel(view) }))
  }, [addOperationHistory, currentGroup, cayleyActions, cayleyMultiplyType, cayleyShape3D, t, getViewLabel])

  const selectElement = useCallback((id: string, additive = false) => {
    if (symmetryShowAction) {
      setSymmetryActionElementId(prev => prev === id ? null : id)
      setSelectedElements(prev => {
        if (prev.has(id) && !additive) return new Set()
        return new Set([id])
      })
      if (currentGroup) {
        const el = currentGroup.elements.find(e => e.id === id)
        if (el) setHintMessage(t('hint.symmetryAction', { label: el.label }).replace(el.label, `<span class="hint-highlight">${el.label}</span>`))
      }
      return
    }
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
    if (id !== selfInverseElementId) {
      setSelfInverseElementId(null)
    }
  }, [currentGroup, symmetryShowAction, setSymmetryActionElementId, setHintMessage, selfInverseElementId, t])

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

  const resetNodePositions = useCallback((shape2D?: CayleyShape2D) => {
    if (!currentGroup) return
    const effectiveShape = shape2D ?? (currentView === 'cayley' ? cayleyShape2D : undefined)
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(currentView, initializeNodePositions(currentGroup, currentView, effectiveShape))
      return next
    })
  }, [currentGroup, currentView, cayleyShape2D])

  const runForceLayout = useCallback(() => {
    if (!currentGroup) return

    const vbs = getViewBoxSize(currentGroup.order, currentView, forceShowLargeGroupViews.has(currentView))
    let existingPositions = nodePositions.get(currentView)

    if (isGroupDirectProduct(currentGroup) && currentView === 'cayley') {
      const gridPos = directProductGridLayout2D(currentGroup, vbs.width, vbs.height)
      if (gridPos && (!existingPositions || existingPositions.size === 0)) {
        existingPositions = gridPos
      }
    }

    if (currentView === 'cycle') {
      const cycleSubgroups = computeCycleSubgroups(currentGroup)
      let cycles = cycleSubgroups
        .map(indices => ({
          elements: indices.map(i => ({ id: currentGroup.elements[i].id })),
          order: indices.length
        }))
        .filter(c => c.order > 1)

      if (showMaximalCycles) {
        cycles = computeMaximalCycles(cycles)
      }

      const positions = planarCycleLayout(
        currentGroup.elements,
        cycles,
        vbs.width,
        vbs.height,
        { initialPositions: existingPositions }
      )
      batchSetNodePositions(positions)
      addOperationHistory(t('op.layout', { view: getViewLabel(currentView) }))
      setHintMessage(t('hint.layoutDone'))
    } else {
      const isLarge = currentGroup.order > 30
      if (isLarge) setHintMessage(t('hint.layoutComputing'))

      const enabledActions = cayleyActions.filter(a => a.enabled)
      const edges = currentGroup.elements.reduce<{ source: string; target: string }[]>((acc, el) => {
        for (const action of enabledActions) {
          const actionEl = currentGroup.elements.find(e => e.id === action.elementId)
          if (!actionEl) continue
          let toEl: GroupElement | undefined
          if (cayleyMultiplyType === 'right') {
            toEl = currentGroup.multiply(el, actionEl)
          } else {
            toEl = currentGroup.multiply(actionEl, el)
          }
          if (!toEl) continue
          acc.push({ source: el.id, target: toEl.id })
        }
        return acc
      }, [])

      if (isLarge) {
        forceLayoutAsync(
          currentGroup.elements,
          edges,
          vbs.width,
          vbs.height,
          { initialPositions: existingPositions }
        ).then(positions => {
          batchSetNodePositions(positions)
          addOperationHistory(t('op.layout', { view: getViewLabel(currentView) }))
          setHintMessage(t('hint.layoutDone'))
        })
      } else {
        const positions = forceLayout(
          currentGroup.elements,
          edges,
          vbs.width,
          vbs.height,
          { initialPositions: existingPositions }
        )
        batchSetNodePositions(positions)
        addOperationHistory(t('op.layout', { view: getViewLabel(currentView) }))
        setHintMessage(t('hint.layoutDone'))
      }
    }
  }, [currentGroup, currentView, showMaximalCycles, nodePositions, batchSetNodePositions, addOperationHistory, setHintMessage, cayleyActions, cayleyMultiplyType, forceShowLargeGroupViews, t, getViewLabel])

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

  const computeInverse = useCallback(() => {
    if (selfInverseTimerRef.current) {
      clearTimeout(selfInverseTimerRef.current)
      selfInverseTimerRef.current = null
    }
    setSelfInverseElementId(null)

    if (selectedElements.size !== 1) {
      addOperationHistory(t('op.inverseRequest'))
      return
    }

    const id = Array.from(selectedElements)[0]
    const element = currentGroup?.elements.find(e => e.id === id)
    if (!element || !currentGroup) return

    const inv = currentGroup.inverse(element)
    addOperationHistory(t('op.inverseDone', { label: element.label, result: inv.label }))
    selectElement(inv.id, true)

    if (inv.id === element.id) {
      setSelfInverseElementId(element.id)
      selfInverseTimerRef.current = setTimeout(() => {
        setSelfInverseElementId(null)
        selfInverseTimerRef.current = null
      }, 2500)
    }
  }, [currentGroup, selectedElements, addOperationHistory, selectElement, t])

  const clearCanvas = useCallback(() => {
    clearSelection()
    resetCanvasTransform()
    setNodePositions(new Map())
    addOperationHistory(t('op.clearCanvas'))
    setSelfInverseElementId(null)
  }, [clearSelection, resetCanvasTransform, addOperationHistory, t])

  const generateSubgroups = useCallback(() => {
    addOperationHistory(t('op.generateSubgroup'))
  }, [addOperationHistory, t])

  const selectNextElement = useCallback(() => {
    if (!currentGroup || selectedElements.size === 0) return
    const currentId = Array.from(selectedElements)[0]
    const currentIdx = currentGroup.elements.findIndex(el => el.id === currentId)
    const nextIdx = (currentIdx + 1) % currentGroup.elements.length
    setSelectedElements(new Set([currentGroup.elements[nextIdx].id]))
  }, [currentGroup, selectedElements])

  const selectPrevElement = useCallback(() => {
    if (!currentGroup || selectedElements.size === 0) return
    const currentId = Array.from(selectedElements)[0]
    const currentIdx = currentGroup.elements.findIndex(el => el.id === currentId)
    const prevIdx = (currentIdx - 1 + currentGroup.elements.length) % currentGroup.elements.length
    setSelectedElements(new Set([currentGroup.elements[prevIdx].id]))
  }, [currentGroup, selectedElements])

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
        next.set(currentView, initializeNodePositions(currentGroup, currentView,
          currentView === 'cayley' ? cayleyShape2D : undefined))
        return next
      })
    }
  }, [currentGroup, currentView, cayleyShape2D])

  const setCayleyMultiplyType = useCallback((type: MultiplyType) => {
    setCayleyMultiplyTypeState(type)
    const label = type === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')
    setHintMessage(t('hint.cayleyMultiply', { label }).replace(label, `<span class="hint-highlight">${label}</span>`))
    addOperationHistory(t('op.setCayleyMultiply', { label }))
  }, [addOperationHistory, t])

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
  }, [addOperationHistory, t])

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
  }, [addOperationHistory, currentGroup, t])

  const setCayleyShape2D = useCallback((shape: CayleyShape2D) => {
    setCayleyShape2DState(shape)
    if (currentGroup && currentView === 'cayley') {
      const vbs = getViewBoxSize(currentGroup.order, 'cayley', forceShowLargeGroupViews.has('cayley'))
      if (shape === 'grid') {
        const pos = directProductGridLayout2D(currentGroup, vbs.width, vbs.height)
        if (pos && pos.size > 0) batchSetNodePositions(pos)
      } else if (shape === 'spherical') {
        const pos = fibonacci2DLayout(currentGroup, vbs.width, vbs.height)
        if (pos && pos.size > 0) batchSetNodePositions(pos)
      } else {
        resetNodePositions(shape)
      }
    }
  }, [currentGroup, currentView, forceShowLargeGroupViews, batchSetNodePositions, resetNodePositions])

  const saveSubset = useCallback(() => {
    if (!currentGroup || selectedElements.size === 0 || symmetryShowAction) return
    const elementIds = Array.from(selectedElements)
    const result = checkSubsetProperty(elementIds)
    const newSubset = createSubset(elementIds, result, subsets.length)
    setSubsets(prev => [...prev, newSubset])
    clearSelection()
    addOperationHistory(t('op.saveSubset', { label: result.label, n: elementIds.length }))
    setHintMessage(t('hint.subsetSaved', { label: result.label, n: elementIds.length }).replace(result.label, `<span class="hint-highlight">${result.label}</span>`))
  }, [currentGroup, selectedElements, subsets, checkSubsetProperty, clearSelection, addOperationHistory, setHintMessage, symmetryShowAction, t])

  const removeSubset = useCallback((id: string) => {
    setSubsets(prev => prev.filter(s => s.id !== id))
    if (cosetSubsetId === id) {
      setCosetSubsetId(null)
      setShowAllCosets(false)
    }
    addOperationHistory(t('op.removeSubset'))
  }, [addOperationHistory, cosetSubsetId, t])

  const clearAllSubsets = useCallback(() => {
    setSubsets([])
    setCosetSubsetId(null)
    setShowAllCosets(false)
    addOperationHistory(t('op.clearSubsets'))
  }, [addOperationHistory, t])

  const showCosetsForSubset = useCallback((subsetId: string) => {
    if (cosetSubsetId === subsetId) {
      setCosetSubsetId(null)
      setShowAllCosets(false)
      setHintMessage(t('hint.cosetHide'))
      addOperationHistory(t('op.cosetHide'))
      return
    }
    setCosetSubsetId(subsetId)
    setShowAllCosets(false)
    const subset = subsets.find(s => s.id === subsetId)
    if (subset) {
      setHintMessage(t('hint.cosetShow', { label: subset.label, order: subset.elementIds.length }).replace(subset.label, `<span class="hint-highlight">${subset.label}</span>`))
      addOperationHistory(t('op.cosetShow', { label: subset.label }))
    }
  }, [cosetSubsetId, subsets, addOperationHistory, setHintMessage, t])

  const hideCosets = useCallback(() => {
    setCosetSubsetId(null)
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
    setShowAllCosets(prev => {
      if (!prev) {
        setHintMessage(t('hint.cosetAll'))
        addOperationHistory(t('op.cosetAll'))
      } else {
        setHintMessage(t('hint.cosetSelect'))
        addOperationHistory(t('op.cosetSelect'))
      }
      return !prev
    })
  }, [addOperationHistory, setHintMessage, t])

  const toggleDirectProductMode = useCallback(() => {
    setIsDirectProductMode(prev => {
      if (prev) {
        setDirectProductSource(null)
        setDirectProductTarget(null)
        return false
      }
      return true
    })
  }, [])

  const setDirectProductSourceWrapped = useCallback((group: Group | null) => {
    setDirectProductSource(group)
  }, [])

  const setDirectProductTargetWrapped = useCallback((group: Group | null) => {
    setDirectProductTarget(group)
  }, [])

  const setDirectProductCreationModeWrapped = useCallback((mode: 'cayley' | 'table' | 'direct') => {
    setDirectProductCreationMode(mode)
  }, [])

  const executeDirectProduct = useCallback((): Group | null => {
    const { group, error } = executeDirectProductHelper(directProductSource, directProductTarget)
    if (error) {
      setHintMessage(t(error, { n: directProductSource!.order * directProductTarget!.order }))
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

  const toggleMultiViewMode = useCallback(() => {
    setMultiViewMode(prev => {
      if (prev) {
        setFloatingViews([])
        setHintMessage(t('hint.multiViewOff'))
        addOperationHistory(t('op.multiViewOff'))
        return false
      }
      setHintMessage(t('hint.multiViewOn'))
      addOperationHistory(t('op.multiViewOn'))
      return true
    })
  }, [addOperationHistory, setHintMessage, t])

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

  const setSymmetryShowActionWrapped = useCallback((show: boolean) => {
    setSymmetryShowAction(show)
    if (!show) {
      setSymmetryActionElementId(null)
      setHintMessage(t('symmetry.demoOff'))
    } else {
      setHintMessage(t('symmetry.selectHint'))
    }
  }, [setHintMessage, t])

  const setSymmetryRotateSpeedWrapped = useCallback((speed: number) => {
    setSymmetryRotateSpeed(speed)
  }, [])

  const setSymmetryActionElementIdWrapped = useCallback((id: string | null) => {
    setSymmetryActionElementId(id)
  }, [])

  const value: GroupContextType = {
    currentGroup, currentView, selectedElements, canvasTransform, operationHistory,
    nodePositions, viewTabs, activeTabId, hoverElement, isSimpleGroup, showMaximalCycles,
    hintMessage, forceShowLargeGroupViews, viewBoxSize, isPending,
    cayleyMultiplyType, cayleyActions, cayleyShape3D, cayleyAvailableShapes3D,
    cayleyShape2D, cayleyAvailableShapes2D,
    subsets, multiViewMode, floatingViews,
    symmetryShowAction, symmetryRotateSpeed, symmetryActionElementId, selfInverseElementId,
    cosetSubsetId, cosetType, showAllCosets, cosetData, cosetElementMap, cosetHighlightSet, cosetColors,
    isDirectProductMode, directProductSource, directProductTarget, directProductCreationMode, directProductGroups,
    setCurrentGroup, setCurrentView, selectElement, clearSelection, setCanvasTransform, resetCanvasTransform,
    addOperationHistory, setNodePosition, batchSetNodePositions, getNodePosition,
    addViewTab, closeViewTab, setActiveTab, setHoverElement, checkSubsetProperty, computeInverse,
    clearCanvas, generateSubgroups, selectNextElement, selectPrevElement, resetNodePositions, runForceLayout,
    setShowMaximalCycles, setHintMessage, setForceShowLargeGroupForView,
    setCayleyMultiplyType, setCayleyActions, setCayleyShape3D, setCayleyShape2D,
    toggleCayleyAction, addAllCayleyActions, clearCayleyActions,
    toggleMultiViewMode, openFloatingView, closeFloatingView,
    setSymmetryShowAction: setSymmetryShowActionWrapped, setSymmetryRotateSpeed: setSymmetryRotateSpeedWrapped,
    setSymmetryActionElementId: setSymmetryActionElementIdWrapped, setSelfInverseElementId,
    saveSubset, removeSubset, clearAllSubsets,
    showCosetsForSubset, hideCosets, setCosetType, toggleShowAllCosets,
    toggleDirectProductMode, setDirectProductSource: setDirectProductSourceWrapped,
    setDirectProductTarget: setDirectProductTargetWrapped, setDirectProductCreationMode: setDirectProductCreationModeWrapped,
    executeDirectProduct, storeDirectProductGroup, removeDirectProductGroup, loadDirectProductGroup,
  }

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export { GroupContext }

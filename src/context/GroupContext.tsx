import { createContext, useState, useCallback, useMemo, useTransition, useRef, useEffect, type ReactNode } from 'react'
import type { Group, GroupElement, ViewMode, CanvasTransform, NodePosition, SubgroupCheckResult, Subset, FloatingView, MultiplyType, GroupAction, Layout3D } from '../core/types'
import { COLOR_PALETTE, SUBSET_COLORS, getAvailableShapes3D, getDefaultLayout3D } from '../core/types'
import { getViewBoxSize, type ViewBoxSize } from '../core/viewBox'
import { isSimpleGroup as checkSimpleGroup } from '../core/algebra/subgroups'
import { forceLayout, planarCycleLayout, computeCycleSubgroups, computeMaximalCycles } from '../core/algebra/forceLayout'
import { useTranslation } from '../i18n/useTranslation'

let subsetIdCounter = 0

type NodePositionsMap = Map<string, Map<string, { x: number; y: number }>>

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
  forceShowLargeGroup: boolean
  viewBoxSize: ViewBoxSize
  isPending: boolean
  cayleyMultiplyType: MultiplyType
  cayleyActions: GroupAction[]
  cayleyShape3D: Layout3D
  cayleyAvailableShapes3D: Layout3D[]
  subsets: Subset[]
  multiViewMode: boolean
  floatingViews: FloatingView[]
  symmetryShowAction: boolean
  symmetryRotateSpeed: number
  symmetryActionElementId: string | null
  selfInverseElementId: string | null
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
  setForceShowLargeGroup: (show: boolean) => void
  setCayleyMultiplyType: (type: MultiplyType) => void
  setCayleyActions: (actions: GroupAction[]) => void
  setCayleyShape3D: (shape: Layout3D) => void
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
}

export type GroupContextType = GroupContextState & GroupContextActions

const GroupContext = createContext<GroupContextType | null>(null)

function initializeNodePositions(group: Group, view: ViewMode): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = group.elements.length
  
  const vbs = getViewBoxSize(n, view, true)
  const centerX = vbs.width / 2
  const centerY = vbs.height / 2
  
  let radius: number
  if (view === 'cycle') {
    radius = Math.min(vbs.width * 0.28, 50 + n * 20)
  } else {
    radius = Math.min(vbs.width * 0.3, 150 + n * 18)
  }
  
  let ordered: GroupElement[]
  if (view === 'cayley' && n === 6 && (group.symbol === 'S3' || group.symbol === 'S\u2083')) {
    // 六边形循环顺序：e → (12) → (132) → (13) → (123) → (23) → e
    const idOrder = ['1,2,3', '2,1,3', '3,1,2', '3,2,1', '2,3,1', '1,3,2']
    const map = new Map(group.elements.map(e => [e.id, e]))
    ordered = idOrder.map(id => map.get(id)!).filter(Boolean)
  } else {
    ordered = group.elements
  }
  
  ordered.forEach((element, i) => {
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2
    positions.set(element.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    })
  })
  
  return positions
}

function getInitialCayleyActions(group: Group): GroupAction[] {
  return group.generators.map((gen, i) => {
    const targetEl = gen.apply(group.identity)
    return {
      elementId: targetEl?.id || group.elements[0].id,
      enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length]
    }
  })
}

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
  const [currentGroup, setCurrentGroupState] = useState<Group | null>(null)
  const [currentView, setCurrentViewState] = useState<ViewMode>('set')
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set())
  const [canvasTransform, setCanvasTransformState] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const [operationHistory, setOperationHistory] = useState<string[]>([])
  const [nodePositions, setNodePositions] = useState<NodePositionsMap>(new Map())
  const [viewTabs, setViewTabs] = useState<{ id: string; view: ViewMode; label: string }[]>(() => [])
  const [activeTabId, setActiveTabId] = useState('tab-1')
  const [hoverElement, setHoverElementState] = useState<GroupElement | null>(null)
  const [showMaximalCycles, setShowMaximalCycles] = useState(false)
  const [hintMessage, setHintMessage] = useState('')
  const [forceShowLargeGroup, setForceShowLargeGroupState] = useState(false)
  const [cayleyMultiplyType, setCayleyMultiplyTypeState] = useState<MultiplyType>('right')
  const [cayleyActions, setCayleyActionsState] = useState<GroupAction[]>([])
  const [cayleyShape3D, setCayleyShape3DState] = useState<Layout3D>('spherical')
  const [cayleyAvailableShapes3D, setCayleyAvailableShapes3D] = useState<Layout3D[]>(['spherical', 'circular'])
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [multiViewMode, setMultiViewMode] = useState(false)
  const [floatingViews, setFloatingViews] = useState<FloatingView[]>([])
  const [symmetryShowAction, setSymmetryShowAction] = useState(false)
  const [symmetryRotateSpeed, setSymmetryRotateSpeed] = useState(1)
  const [symmetryActionElementId, setSymmetryActionElementId] = useState<string | null>(null)
  const [selfInverseElementId, setSelfInverseElementId] = useState<string | null>(null)
  const selfInverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setViewTabs(prev => {
      if (prev.length === 0) {
        return [{ id: 'tab-1', view: 'set' as ViewMode, label: getViewLabel('set') }]
      }
      return prev.map(tab => ({ ...tab, label: getViewLabel(tab.view) }))
    })
  }, [getViewLabel])

  const viewBoxSize = useMemo(() => {
    if (!currentGroup) return { width: 800, height: 560 }
    return getViewBoxSize(currentGroup.order, currentView, forceShowLargeGroup)
  }, [currentGroup, currentView, forceShowLargeGroup])

  const isSimpleGroup = useMemo(() => {
    if (!currentGroup) return false
    return checkSimpleGroup(currentGroup)
  }, [currentGroup])

  const addOperationHistory = useCallback((op: string) => {
    setOperationHistory(prev => [...prev.slice(-19), op])
  }, [setOperationHistory])

  const setCurrentGroup = useCallback((group: Group) => {
    startTransition(() => {
      setCurrentGroupState(group)
      setSelectedElements(new Set())
      setOperationHistory([])
      setCanvasTransformState({ x: 0, y: 0, scale: 1 })
      setForceShowLargeGroupState(false)
      setHintMessage(t('hint.groupSelected', { name: group.name, order: group.order }).replace(group.name, `<span class="hint-highlight">${group.name}</span>`))
      setSelfInverseElementId(null)
      
      const actions = getInitialCayleyActions(group)
      setCayleyActionsState(actions)
      setCayleyMultiplyTypeState('right')
      const defaultShape = getDefaultLayout3D(group)
      setCayleyShape3DState(defaultShape)
      setCayleyAvailableShapes3D(getAvailableShapes3D(group))

      if (group.symbol === 'S4') {
        if (defaultShape === 'rhombicuboctahedron') {
          setCayleyActionsState([
            { elementId: '4,1,2,3', enabled: true, color: COLOR_PALETTE[0] },
            { elementId: '3,1,2,4', enabled: true, color: COLOR_PALETTE[1] },
          ])
        } else if (defaultShape === 'truncatedOctahedron2') {
          setCayleyActionsState([
            { elementId: '2,3,4,1', enabled: true, color: COLOR_PALETTE[0] },
            { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[1] },
          ])
        } else if (defaultShape === 'truncatedOctahedron3') {
          setCayleyActionsState([
            { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[0] },
            { elementId: '1,3,2,4', enabled: true, color: COLOR_PALETTE[1] },
            { elementId: '1,2,4,3', enabled: true, color: COLOR_PALETTE[2] },
          ])
        }
      }
      if (group.symbol === 'A5') {
        if (defaultShape === 'truncatedIcosahedron') {
          setCayleyActionsState([
            { elementId: '2,3,4,5,1', enabled: true, color: COLOR_PALETTE[0] },
            { elementId: '2,1,4,3,5', enabled: true, color: COLOR_PALETTE[1] },
          ])
        } else if (defaultShape === 'truncatedDodecahedron') {
          setCayleyActionsState([
            { elementId: '2,3,1,4,5', enabled: true, color: COLOR_PALETTE[0] },
            { elementId: '1,5,4,3,2', enabled: true, color: COLOR_PALETTE[1] },
          ])
        }
      }
      
      const positions: NodePositionsMap = new Map()
      ;(['set', 'cayley', 'cycle', 'table'] as ViewMode[]).forEach(view => {
        positions.set(view, initializeNodePositions(group, view))
      })
      setNodePositions(positions)
      
      setSubsets([])
      addOperationHistory(t('op.loadGroup', { name: group.name, order: group.order }))
    })
  }, [addOperationHistory, startTransition])

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
  }, [addOperationHistory, currentGroup, cayleyActions, cayleyMultiplyType, cayleyShape3D])

  const selectElement = useCallback((id: string, additive = false) => {
    if (symmetryShowAction) {
      setSymmetryActionElementId(prev => prev === id ? null : id)
      setSelectedElements(prev => {
        if (prev.has(id) && !additive) return new Set()
        return new Set([id])
      })
      if (currentGroup) {
        const el = currentGroup.elements.find(e => e.id === id)
        if (el)         setHintMessage(t('hint.symmetryAction', { label: el.label }).replace(el.label, `<span class="hint-highlight">${el.label}</span>`))
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
        if (prev.has(id)) {
          return new Set()
        }
        return new Set([id])
      }
    })
    
    if (!additive && currentGroup) {
      const el = currentGroup.elements.find(e => e.id === id)
      if (el)       setHintMessage(t('hint.elementSelected', { label: el.label }).replace(el.label, `<span class="hint-highlight">${el.label}</span>`))
    }
    if (id !== selfInverseElementId) {
      setSelfInverseElementId(null)
    }
  }, [currentGroup, symmetryShowAction, setSymmetryActionElementId, setHintMessage, selfInverseElementId])

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

  const resetNodePositions = useCallback(() => {
    if (!currentGroup) return
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(currentView, initializeNodePositions(currentGroup, currentView))
      return next
    })
  }, [currentGroup, currentView])

  const runForceLayout = useCallback(() => {
    if (!currentGroup) return

    const vbs = getViewBoxSize(currentGroup.order, currentView, true)
    const existingPositions = nodePositions.get(currentView)

    let positions: Map<string, NodePosition>
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

      positions = planarCycleLayout(
        currentGroup.elements,
        cycles,
        vbs.width,
        vbs.height,
        { initialPositions: existingPositions }
      )
    } else {
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
      positions = forceLayout(
        currentGroup.elements,
        edges,
        vbs.width,
        vbs.height,
        { initialPositions: existingPositions }
      )
    }

    batchSetNodePositions(positions)
    addOperationHistory(t('op.layout', { view: getViewLabel(currentView) }))
    setHintMessage(t('hint.layoutDone'))
  }, [currentGroup, currentView, showMaximalCycles, nodePositions, batchSetNodePositions, addOperationHistory, setHintMessage, cayleyActions, cayleyMultiplyType])

  const addViewTab = useCallback((view: ViewMode) => {
    const id = `tab-${Date.now()}`
    setViewTabs(prev => [...prev, { id, view, label: getViewLabel(view) }])
    setActiveTabId(id)
    setCurrentViewState(view)
  }, [])

  const closeViewTab = useCallback((id: string) => {
    if (viewTabs.length <= 1) return
    setViewTabs(prev => prev.filter(t => t.id !== id))
    if (activeTabId === id) {
      const remaining = viewTabs.filter(t => t.id !== id)
      setActiveTabId(remaining[0].id)
      setCurrentViewState(remaining[0].view)
    }
  }, [viewTabs, activeTabId])

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id)
    const tab = viewTabs.find(t => t.id === id)
    if (tab) {
      setCurrentViewState(tab.view)
    }
  }, [viewTabs])

  const setHoverElement = useCallback((el: GroupElement | null) => {
    setHoverElementState(el)
  }, [])

  const checkSubsetProperty = useCallback((elements: string[]): SubgroupCheckResult => {
    const result: SubgroupCheckResult = {
      type: 'subset',
      label: t('subset.normal'),
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
  }, [currentGroup, addOperationHistory])

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
  }, [currentGroup, selectedElements, addOperationHistory, selectElement])

  const clearCanvas = useCallback(() => {
    clearSelection()
    resetCanvasTransform()
    setNodePositions(new Map())
    addOperationHistory(t('op.clearCanvas'))
    setSelfInverseElementId(null)
  }, [clearSelection, resetCanvasTransform, addOperationHistory])

  const generateSubgroups = useCallback(() => {
    addOperationHistory(t('op.generateSubgroup'))
  }, [addOperationHistory])

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

  const setForceShowLargeGroup = useCallback((show: boolean) => {
    setForceShowLargeGroupState(show)
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
  }, [])

  const setCayleyMultiplyType = useCallback((type: MultiplyType) => {
    setCayleyMultiplyTypeState(type)
    const label = type === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')
    setHintMessage(t('hint.cayleyMultiply', { label }).replace(label, `<span class="hint-highlight">${label}</span>`))
    addOperationHistory(t('op.setCayleyMultiply', { label }))
  }, [addOperationHistory])

  const toggleCayleyAction = useCallback((elementId: string) => {
    setCayleyActionsState(prev => {
      const idx = prev.findIndex(a => a.elementId === elementId)
      if (idx === -1) {
        const colorIdx = prev.length
        return [...prev, { elementId, enabled: true, color: COLOR_PALETTE[colorIdx % COLOR_PALETTE.length] }]
      }
      return prev.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a)
    })
  }, [])

  const addAllCayleyActions = useCallback(() => {
    if (!currentGroup) return
    const actions: GroupAction[] = currentGroup.elements.map((el, i) => {
      const existing = cayleyActions.find(a => a.elementId === el.id)
      return {
        elementId: el.id,
        enabled: existing?.enabled ?? (currentGroup.generators.some(g => g.apply(currentGroup.identity).id === el.id)),
        color: existing?.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length]
      }
    })
    setCayleyActionsState(actions)
  }, [currentGroup, cayleyActions])

  const clearCayleyActions = useCallback(() => {
    setCayleyActionsState([])
    setHintMessage(t('hint.cayleyCleared'))
    addOperationHistory(t('op.clearCayley'))
  }, [addOperationHistory])

  const setCayleyActions = useCallback((actions: GroupAction[]) => {
    setCayleyActionsState(actions)
  }, [])

  const setCayleyShape3D = useCallback((shape: Layout3D) => {
    setCayleyShape3DState(shape)
    setHintMessage(t('hint.cayleyShape', { shape }).replace(shape, `<span class="hint-highlight">${shape}</span>`))
    addOperationHistory(t('op.setShape', { shape }))

    if (currentGroup?.symbol === 'S4') {
      if (shape === 'rhombicuboctahedron') {
        setCayleyActionsState([
          { elementId: '4,1,2,3', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '3,1,2,4', enabled: true, color: COLOR_PALETTE[1] },
        ])
      } else if (shape === 'truncatedOctahedron2') {
        setCayleyActionsState([
          { elementId: '2,3,4,1', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[1] },
        ])
      } else if (shape === 'truncatedOctahedron3') {
        setCayleyActionsState([
          { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '1,3,2,4', enabled: true, color: COLOR_PALETTE[1] },
          { elementId: '1,2,4,3', enabled: true, color: COLOR_PALETTE[2] },
        ])
      } else if (shape === 'truncatedCube') {
        setCayleyActionsState([
          { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '1,3,4,2', enabled: true, color: COLOR_PALETTE[1] },
        ])
      }
    }
    if (currentGroup?.symbol === 'A5') {
      if (shape === 'truncatedIcosahedron') {
        setCayleyActionsState([
          { elementId: '2,3,4,5,1', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '2,1,4,3,5', enabled: true, color: COLOR_PALETTE[1] },
        ])
      } else if (shape === 'truncatedDodecahedron') {
        setCayleyActionsState([
          { elementId: '2,3,1,4,5', enabled: true, color: COLOR_PALETTE[0] },
          { elementId: '1,5,4,3,2', enabled: true, color: COLOR_PALETTE[1] },
        ])
      }
    }
  }, [addOperationHistory, currentGroup])

  const saveSubset = useCallback(() => {
    if (!currentGroup || selectedElements.size === 0 || symmetryShowAction) return
    const elementIds = Array.from(selectedElements)
    const result = checkSubsetProperty(elementIds)
    const idx = subsets.length
    subsetIdCounter++
    const newSubset: Subset = {
      id: `subset-${subsetIdCounter}`,
      elementIds,
      label: result.label,
      color: SUBSET_COLORS[idx % SUBSET_COLORS.length],
      isSubgroup: result.type === 'subgroup' || result.type === 'normal-subgroup',
      isNormalSubgroup: result.type === 'normal-subgroup',
      type: result.type,
    }
    setSubsets(prev => [...prev, newSubset])
    clearSelection()
    addOperationHistory(t('op.saveSubset', { label: result.label, n: elementIds.length }))
    setHintMessage(t('hint.subsetSaved', { label: result.label, n: elementIds.length }).replace(result.label, `<span class="hint-highlight">${result.label}</span>`))
  }, [currentGroup, selectedElements, subsets, checkSubsetProperty, clearSelection, addOperationHistory, setHintMessage, symmetryShowAction])

  const removeSubset = useCallback((id: string) => {
    setSubsets(prev => prev.filter(s => s.id !== id))
    addOperationHistory(t('op.removeSubset'))
  }, [addOperationHistory])

  const clearAllSubsets = useCallback(() => {
    setSubsets([])
    addOperationHistory(t('op.clearSubsets'))
  }, [addOperationHistory])

  const toggleMultiViewMode = useCallback(() => {
    setMultiViewMode(prev => {
      if (prev) {
        setFloatingViews([])
        setHintMessage(t('hint.multiViewOff'))
        addOperationHistory(t('op.multiViewOff'))
        return false
      } else {
        setHintMessage(t('hint.multiViewOn'))
        addOperationHistory(t('op.multiViewOn'))
        return true
      }
    })
  }, [addOperationHistory, setHintMessage])

  const openFloatingView = useCallback((view: ViewMode) => {
    if (!multiViewMode || !currentGroup) return
    const id = `fv-${Date.now()}`
    const newFv: FloatingView = {
      id,
      view,
      title: getViewLabel(view) || view,
    }
    setFloatingViews(prev => [...prev, newFv])
    addOperationHistory(t('op.openFloatView', { viewLabel: getViewLabel(view) }))
  }, [multiViewMode, currentGroup, addOperationHistory])

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
  }, [setHintMessage])

  const setSymmetryRotateSpeedWrapped = useCallback((speed: number) => {
    setSymmetryRotateSpeed(speed)
  }, [])

  const setSymmetryActionElementIdWrapped = useCallback((id: string | null) => {
    setSymmetryActionElementId(id)
  }, [])

  const value: GroupContextType = {
    currentGroup,
    currentView,
    selectedElements,
    canvasTransform,
    operationHistory,
    nodePositions,
    viewTabs,
    activeTabId,
    hoverElement,
    isSimpleGroup,
    showMaximalCycles,
    hintMessage,
    forceShowLargeGroup,
    viewBoxSize,
    isPending,
    subsets,
    setCurrentGroup,
    setCurrentView,
    selectElement,
    clearSelection,
    setCanvasTransform,
    resetCanvasTransform,
    addOperationHistory,
    setNodePosition,
    batchSetNodePositions,
    getNodePosition,
    addViewTab,
    closeViewTab,
    setActiveTab,
    setHoverElement,
    checkSubsetProperty,
    computeInverse,
    clearCanvas,
    generateSubgroups,
    selectNextElement,
    selectPrevElement,
    resetNodePositions,
    runForceLayout,
    setShowMaximalCycles,
    setHintMessage,
    setForceShowLargeGroup,
    cayleyMultiplyType,
    cayleyActions,
    cayleyShape3D,
    cayleyAvailableShapes3D,
    setCayleyMultiplyType,
    setCayleyActions,
    setCayleyShape3D,
    toggleCayleyAction,
    addAllCayleyActions,
    clearCayleyActions,
    multiViewMode,
    floatingViews,
    toggleMultiViewMode,
    openFloatingView,
    closeFloatingView,
    symmetryShowAction,
    symmetryRotateSpeed,
    symmetryActionElementId,
    selfInverseElementId,
    setSymmetryShowAction: setSymmetryShowActionWrapped,
    setSymmetryRotateSpeed: setSymmetryRotateSpeedWrapped,
    setSymmetryActionElementId: setSymmetryActionElementIdWrapped,
    setSelfInverseElementId,
    saveSubset,
    removeSubset,
    clearAllSubsets,
  }

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export { GroupContext }

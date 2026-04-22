import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { Group, GroupElement, ViewMode, CanvasTransform, SubgroupCheckResult } from '../core/types'

type NodePositionsMap = Map<string, Map<string, { x: number; y: number }>>

interface GroupContextState {
  currentGroup: Group | null
  currentView: ViewMode
  selectedElements: Set<string>
  lassoMode: boolean
  lassoShape: 'circle' | 'rect'
  canvasTransform: CanvasTransform
  operationHistory: string[]
  nodePositions: NodePositionsMap
  viewTabs: { id: string; view: ViewMode; label: string }[]
  activeTabId: string
  hoverElement: GroupElement | null
  isSimpleGroup: boolean
  showMaximalCycles: boolean
  hintMessage: string
}

interface GroupContextActions {
  setCurrentGroup: (group: Group) => void
  setCurrentView: (view: ViewMode) => void
  selectElement: (id: string, additive?: boolean) => void
  clearSelection: () => void
  setLassoMode: (enabled: boolean) => void
  setLassoShape: (shape: 'circle' | 'rect') => void
  setCanvasTransform: (transform: Partial<CanvasTransform>) => void
  resetCanvasTransform: () => void
  addOperationHistory: (op: string) => void
  setNodePosition: (id: string, x: number, y: number) => void
  getNodePosition: (id: string) => { x: number; y: number } | undefined
  addViewTab: (view: ViewMode) => void
  closeViewTab: (id: string) => void
  setActiveTab: (id: string) => void
  setHoverElement: (el: GroupElement | null) => void
  checkSubsetProperty: (elements: string[]) => SubgroupCheckResult
  computeInverse: () => void
  clearCanvas: () => void
  resetNodePositions: () => void
  generateSubgroups: () => void
  selectNextElement: () => void
  selectPrevElement: () => void
  setShowMaximalCycles: (show: boolean) => void
  setHintMessage: (msg: string) => void
}

type GroupContextType = GroupContextState & GroupContextActions

const GroupContext = createContext<GroupContextType | null>(null)

function initializeNodePositions(group: Group, view: ViewMode): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = group.elements.length
  
  let radius: number, centerX: number, centerY: number
  
  if (view === 'cycle') {
    centerX = 400
    centerY = 280
    radius = Math.min(180, 50 + n * 15)
  } else {
    centerX = 400
    centerY = 280
    radius = 150 + Math.min(50, n * 10)
  }
  
  group.elements.forEach((element, i) => {
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2
    positions.set(element.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    })
  })
  
  return positions
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const [currentGroup, setCurrentGroupState] = useState<Group | null>(null)
  const [currentView, setCurrentViewState] = useState<ViewMode>('set')
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set())
  const [lassoMode, setLassoModeState] = useState(false)
  const [lassoShape, setLassoShapeState] = useState<'circle' | 'rect'>('rect')
  const [canvasTransform, setCanvasTransformState] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const [operationHistory, setOperationHistory] = useState<string[]>([])
  const [nodePositions, setNodePositions] = useState<NodePositionsMap>(new Map())
  const [viewTabs, setViewTabs] = useState<{ id: string; view: ViewMode; label: string }[]>([
    { id: 'tab-1', view: 'set', label: '集合视图' }
  ])
  const [activeTabId, setActiveTabId] = useState('tab-1')
  const [hoverElement, setHoverElementState] = useState<GroupElement | null>(null)
  const [showMaximalCycles, setShowMaximalCycles] = useState(false)
  const [hintMessage, setHintMessage] = useState('')

  const isSimpleGroup = useMemo(() => {
    if (!currentGroup) return false
    const order = currentGroup.order
    if (order <= 1) return false
    if (order === 2 || order === 3) return true
    if (!currentGroup.isAbelian && order === 6) return false
    return false
  }, [currentGroup])

  const setCurrentGroup = useCallback((group: Group) => {
    setCurrentGroupState(group)
    setSelectedElements(new Set())
    setOperationHistory([])
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
    
    const positions: NodePositionsMap = new Map()
    ;(['set', 'cayley', 'cycle', 'table'] as ViewMode[]).forEach(view => {
      positions.set(view, initializeNodePositions(group, view))
    })
    setNodePositions(positions)
    
    addOperationHistory(`加载群 ${group.name} (阶=${group.order})`)
  }, [])

  const setCurrentView = useCallback((view: ViewMode) => {
    setCurrentViewState(view)
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
    addOperationHistory(`切换视图: ${view}`)
  }, [])

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
        if (prev.has(id)) {
          return new Set()
        }
        return new Set([id])
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedElements(new Set())
  }, [])

  const setLassoMode = useCallback((enabled: boolean) => {
    setLassoModeState(enabled)
  }, [])

  const setLassoShape = useCallback((shape: 'circle' | 'rect') => {
    setLassoShapeState(shape)
  }, [])

  const setCanvasTransform = useCallback((transform: Partial<CanvasTransform>) => {
    setCanvasTransformState(prev => ({ ...prev, ...transform }))
  }, [])

  const resetCanvasTransform = useCallback(() => {
    setCanvasTransformState({ x: 0, y: 0, scale: 1 })
  }, [])

  const addOperationHistory = useCallback((op: string) => {
    setOperationHistory(prev => [...prev.slice(-19), op])
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

  const addViewTab = useCallback((view: ViewMode) => {
    const id = `tab-${Date.now()}`
    const labels: Record<ViewMode, string> = {
      set: '集合视图',
      cayley: '凯莱图',
      cycle: '圆圈图',
      table: '乘法表',
      '3d': '3D对称'
    }
    setViewTabs(prev => [...prev, { id, view, label: labels[view] }])
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
      label: '普通子集',
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
      result.label = '子群'
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
        result.label = '正规子群'
        result.color = '#9b59b6'
      }
    }
    
    addOperationHistory(`检验子集: ${result.label}`)
    return result
  }, [currentGroup, addOperationHistory])

  const computeInverse = useCallback(() => {
    if (selectedElements.size !== 1) {
      addOperationHistory('请选择一个元素求逆元')
      return
    }
    
    const id = Array.from(selectedElements)[0]
    const element = currentGroup?.elements.find(e => e.id === id)
    if (!element || !currentGroup) return
    
    const inv = currentGroup.inverse(element)
    addOperationHistory(`求逆元: (${element.label})⁻¹ = ${inv.label}`)
    selectElement(inv.id, true)
  }, [currentGroup, selectedElements, addOperationHistory, selectElement])

  const clearCanvas = useCallback(() => {
    clearSelection()
    resetCanvasTransform()
    setNodePositions(new Map())
    addOperationHistory('清空画布')
  }, [clearSelection, resetCanvasTransform, addOperationHistory])

  const generateSubgroups = useCallback(() => {
    addOperationHistory('生成子群 (待实现)')
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

  const value: GroupContextType = {
    currentGroup,
    currentView,
    selectedElements,
    lassoMode,
    lassoShape,
    canvasTransform,
    operationHistory,
    nodePositions,
    viewTabs,
    activeTabId,
    hoverElement,
    isSimpleGroup,
    showMaximalCycles,
    hintMessage,
    setCurrentGroup,
    setCurrentView,
    selectElement,
    clearSelection,
    setLassoMode,
    setLassoShape,
    setCanvasTransform,
    resetCanvasTransform,
    addOperationHistory,
    setNodePosition,
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
    setShowMaximalCycles,
    setHintMessage
  }

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within GroupProvider')
  }
  return context
}

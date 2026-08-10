import { createContext, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Group, GroupElement, ViewMode, CanvasTransform, SubgroupCheckResult, Subset, FloatingView, MultiplyType, CayleyAction, Layout3D, Homomorphism, HomomorphismResult, GroupActionArrow, GroupActionComputation, GroupActionKind } from '../core/types'
import { isGroupDirectProduct, type CayleyShape2D } from '../core/types'
import { getViewBoxSize, type ViewBoxSize } from '../core/viewBox'
import { type CosetInfo } from '../core/algebra/subgroups'
import { forceLayout, forceLayoutAsync, planarCycleLayout, computeCycleSubgroups, computeMaximalCycles } from '../core/algebra/forceLayout'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'
import { useTranslation } from '../i18n/useTranslation'
import type { BackendCache } from '../utils/hybridCompute'
import { registerExportBridge } from '../utils/exportApi'
import type { NodePositionsMap } from './positionUtils'

import { GroupCoreProvider, useGroupCore } from './core/GroupCoreContext'
import { GroupBackendProvider, useGroupBackend } from './backend/GroupBackendContext'
import { GroupCayleyProvider, useGroupCayley } from './cayley/GroupCayleyContext'
import { GroupSubsetProvider, useGroupSubset, type QuotientGroupEntry, type AutomorphismGroupEntry } from './subsets/GroupSubsetContext'
import { GroupSymmetryProvider, useGroupSymmetry } from './symmetry/GroupSymmetryContext'
import { GroupDirectProductProvider, useGroupDirectProduct } from './directProduct/GroupDirectProductContext'
import { GroupMultiViewProvider, useGroupMultiView } from './multiview/GroupMultiViewContext'
import { GroupHomomorphismProvider, useGroupHomomorphism } from './homomorphism/GroupHomomorphismContext'
import { GroupSemidirectProductProvider, useGroupSemidirectProduct } from './semidirectProduct/GroupSemidirectProductContext'
import type { SemidirectDecompositionCandidate } from '../core/algebra/semidirectDecompositions'
import { GroupActionProvider, useGroupAction } from './actions/GroupActionContext'
import { GroupSeriesProvider, useGroupSeries } from './series/GroupSeriesContext'
import { GroupPresentationProvider, useGroupPresentation } from './presentation/GroupPresentationContext'
import type { SeriesType, SubgroupSeries } from '../core/algebra/series'
import type { Automorphism } from '../core/algebra/automorphisms'

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
  cayleyActions: CayleyAction[]
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
  cosetSubgroupElementIds: string[] | null
  cosetType: 'left' | 'right'
  showAllCosets: boolean
  cosetData: CosetInfo | null
  cosetElementMap: Map<string, number>
  cosetHighlightSet: Set<number>
  cosetColors: string[]
  quotientGroups: QuotientGroupEntry[]
  automorphismGroups: AutomorphismGroupEntry[]
  isDirectProductMode: boolean
  directProductSource: Group | null
  directProductTarget: Group | null
  directProductCreationMode: 'cayley' | 'table' | 'direct'
  directProductGroups: Group[]
  isSemidirectProductMode: boolean
  sdPanelOpen: boolean
  sdNormalSubgroup: Group | null
  sdActingGroup: Group | null
  sdAutNGroup: Group | null
  sdAutNList: Automorphism[]
  sdPhiGenMapping: Map<string, string>
  sdPhiFullMap: Map<string, Automorphism> | null
  sdPhiValid: boolean | null
  sdSemidirectProductGroups: Group[]
  sdDecompositions: SemidirectDecompositionCandidate[]
  sdActiveDecomposition: number
  backendCache: BackendCache
  isLargeGroup: boolean
  homomorphisms: Homomorphism[]
  activeHomomorphismId: string | null
  editingSource: Group | null
  editingTarget: Group | null
  editingMapping: Map<string, string>
  editingGeneratorMapping: Map<string, string>
  isFullExtended: boolean
  theoremMode: boolean
  theoremPhase: number
  isValidHomo: boolean | null
  kernelLabel: string
  actionKind: GroupActionKind | null
  actionPrime: number | null
  actionSetSize: number | null
  actionArrows: GroupActionArrow[]
  actionEditing: boolean
  actionComputation: GroupActionComputation | null
  actionError: { generatorId: string | null; from: number; to: number; g?: string; type: string } | null
  actionSelectedElement: number | null
  actionHoverElement: string | null
  seriesType: SeriesType | null
  activeChainIdx: number
  seriesData: SubgroupSeries | null
  compositionChains: GroupElement[][][] | null
  compositionTruncated: boolean
  seriesFlags: { solvable: boolean; nilpotent: boolean } | null
  presentationGroups: Group[]
  presentationDraft: string
  templateGenCount: number
  visualDraft: { gens: string[]; relators: string[]; group: Group | null } | null
  presentationError: string | null
  activePresentationGroup: Group | null
}

interface GroupContextActions {
  setCurrentGroup: (group: Group) => void
  clearCurrentGroup: () => void
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
  setCayleyActions: (actions: CayleyAction[]) => void
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
  showCosetsFromElements: (elementIds: string[], label: string, isNormal: boolean) => void
  hideCosets: () => void
  setCosetType: (type: 'left' | 'right') => void
  toggleShowAllCosets: () => void
  showCosetFromElements: (elementIds: string[], label: string, isNormal: boolean) => string | null
  createQuotientGroup: (subsetId: string) => QuotientGroupEntry | null
  removeQuotientGroup: (id: string) => void
  loadQuotientGroup: (id: string) => Group | null
  createQuotientGroupWithHomomorphism: (subsetId: string) => QuotientGroupEntry | null
  computeAutomorphismGroup: () => AutomorphismGroupEntry | null
  removeAutomorphismGroup: (id: string) => void
  loadAutomorphismGroup: (id: string) => Group | null
  toggleDirectProductMode: () => void
  setDirectProductSource: (group: Group | null) => void
  setDirectProductTarget: (group: Group | null) => void
  setDirectProductCreationMode: (mode: 'cayley' | 'table' | 'direct') => void
  executeDirectProduct: () => Group | null
  storeDirectProductGroup: (group: Group) => void
  removeDirectProductGroup: (symbol: string) => void
  loadDirectProductGroup: (symbol: string) => void
  toggleSemidirectProductMode: () => void
  setSDPanelOpen: (open: boolean) => void
  decomposeSemidirectProduct: (group: Group) => boolean
  selectSemidirectDecomposition: (index: number) => void
  setSDNormalSubgroup: (group: Group | null) => void
  setSDActingGroup: (group: Group | null) => void
  computeAutN: () => void
  setPhiGenMapping: (genId: string, autoId: string) => void
  expandPhiFull: () => void
  executeSemidirectProduct: () => Group | null
  storeSemidirectProductGroup: (group: Group, spec?: import('./semidirectProduct/semidirectProductStorage').StoredSemidirectProduct) => void
  removeSemidirectProductGroup: (symbol: string) => void
  loadSemidirectProductGroup: (symbol: string) => void
  createHomomorphism: (source: Group, target: Group, name?: string) => void
  setMappingElement: (sourceId: string, targetId: string) => void
  removeMappingElement: (sourceId: string) => void
  setGeneratorMapping: (genElId: string, targetId: string) => void
  removeGeneratorMapping: (genElId: string) => void
  clearMapping: () => void
  verifyCurrentMapping: () => HomomorphismResult | null
  deleteHomomorphism: (id: string) => void
  activateHomomorphism: (id: string) => void
  applyTrivialMapping: () => void
  applyProjectionMapping: () => void
  applySubgroupInclusionMapping: (sourceElementIds: string[]) => void
  applyDPProjectionMapping: (factorIndex: 0 | 1) => void
  setEditingTarget: (group: Group) => void
  setEditingSource: (group: Group) => void
  setTheoremMode: (value: boolean) => void
  setTheoremPhase: (phase: number) => void
  createConjugationAction: (group: Group) => void
  createSylowAction: (group: Group, prime: number) => void
  createRegularAction: (group: Group) => void
  createCosetAction: (group: Group, subgroupElements: GroupElement[]) => void
  startCustomAction: (group: Group, n: number) => void
  addArrow: (from: number, to: number, generatorId?: string | null) => void
  bindArrow: (from: number, to: number, generatorId: string) => void
  removeArrow: (from: number, generatorId?: string | null, to?: number) => void
  removeArrowAll: (from: number) => void
  replaceGenArrows: (generatorId: string | null, pairs: [number, number][]) => void
  clearArrows: () => void
  completeCustomAction: (group: Group) => void
  setActionSelectedElement: (x: number | null) => void
  setActionHoverElement: (id: string | null) => void
  clearAction: () => void
  savedActions: import('./actions/actionStorage').StoredGroupAction[]
  activateSavedAction: (id: string) => void
  deleteSavedAction: (id: string) => void
  setSeriesType: (type: SeriesType | null) => void
  setActiveChainIdx: (idx: number) => void
  setPresentationDraft: (text: string) => void
  setVisualDraft: (draft: { gens: string[]; relators: string[]; group: Group | null } | null) => void
  setTemplateGenCount: (n: number) => void
  createPresentationGroupFromText: (text: string) => Group | null
  storePresentationGroup: (group: Group) => void
  removePresentationGroup: (symbol: string) => void
  loadPresentationGroup: (symbol: string) => void
  clearActivePresentationGroup: () => void
}

export type GroupContextType = GroupContextState & GroupContextActions

const GroupContext = createContext<GroupContextType | null>(null)

function GroupContextCombiner({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const core = useGroupCore()
  const backend = useGroupBackend()
  const cayley = useGroupCayley()
  const subset = useGroupSubset()
  const symmetry = useGroupSymmetry()
  const directProduct = useGroupDirectProduct()
  const multiView = useGroupMultiView()
  const homo = useGroupHomomorphism()
  const sd = useGroupSemidirectProduct()
  const action = useGroupAction()
  const series = useGroupSeries()
  const presentation = useGroupPresentation()

  const exportSetGroupRef = useRef(core.setCurrentGroup)
  const exportSetViewRef = useRef(core.setCurrentView)
  const exportSetCayley2DShapeRef = useRef(cayley.setCayleyShape2D)
  const exportSetCayley3DShapeRef = useRef(cayley.setCayleyShape3D)
  const exportSetSymElementRef = useRef(symmetry.setSymmetryActionElementId)
  const exportSetSymShowRef = useRef(symmetry.setSymmetryShowAction)
  const exportGetGroupRef = useRef(core.currentGroup)
  const exportGetViewRef = useRef(core.currentView)

  const registerExportBridgeRef = useRef(false)

  useEffect(() => {
    exportSetGroupRef.current = core.setCurrentGroup
    exportSetViewRef.current = core.setCurrentView
    exportSetCayley2DShapeRef.current = cayley.setCayleyShape2D
    exportSetCayley3DShapeRef.current = cayley.setCayleyShape3D
    exportSetSymElementRef.current = symmetry.setSymmetryActionElementId
    exportSetSymShowRef.current = symmetry.setSymmetryShowAction
    exportGetGroupRef.current = core.currentGroup
    exportGetViewRef.current = core.currentView
    if (!registerExportBridgeRef.current) {
      registerExportBridgeRef.current = true
      registerExportBridge({
      setGroup: (g) => exportSetGroupRef.current(g),
      setView: (v) => exportSetViewRef.current(v),
      setCayleyShape2D: (s) => exportSetCayley2DShapeRef.current(s as CayleyShape2D),
      setCayleyShape3D: (s) => exportSetCayley3DShapeRef.current(s as Layout3D),
      setSymmetryElement: (id) => exportSetSymElementRef.current(id),
      setSymmetryShowAction: (show) => exportSetSymShowRef.current(show),
      getGroup: () => exportGetGroupRef.current,
      getView: () => exportGetViewRef.current,
      })
    }
  })

  const selfInverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectElement = useCallback((id: string, additive = false) => {
    if (symmetry.symmetryShowAction) {
      symmetry.setSymmetryActionElementId(symmetry.symmetryActionElementId === id ? null : id)
      core.selectElement(id, additive)
      if (core.currentGroup) {
        const el = core.currentGroup.elements.find(e => e.id === id)
        if (el) core.setHintMessage(t('hint.symmetryAction', { label: el.label }).replace(el.label, `<span class="hint-highlight">${el.label}</span>`))
      }
      return
    }
    core.selectElement(id, additive)
    if (id !== symmetry.selfInverseElementId) {
      symmetry.setSelfInverseElementId(null)
    }
  }, [symmetry, core, t])

  const setCurrentView = useCallback((view: ViewMode) => {
    core.setCurrentView(view)

    if (view === 'cayley' && core.currentGroup) {
      const count = cayley.cayleyActions.filter(a => a.enabled).length
      core.setHintMessage(t('hint.cayley', { count, type: cayley.cayleyMultiplyType === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft') }))
    } else if (view === '3d' && core.currentGroup) {
      const count = cayley.cayleyActions.filter(a => a.enabled).length
      core.setHintMessage(t('hint.cayley3d', { count, shape: cayley.cayleyShape3D }))
    } else if (view === 'symmetry') {
      core.setHintMessage(t('hint.symmetry'))
    } else if (view === 'sublattice') {
      core.setHintMessage(t('hint.sublattice'))
    } else if (view === 'cycle') {
      core.setHintMessage(t('hint.cycle'))
    } else if (view === 'tree') {
      core.setHintMessage(t('hint.tree'))
    } else if (view === 'prestable') {
      core.setHintMessage(t('hint.prestable'))
    } else {
      const label = core.getViewLabel(view)
      core.setHintMessage(t('hint.switchedTo', { viewLabel: label }).replace(label, `<span class="hint-highlight">${label}</span>`))
    }
  }, [core, cayley, t])

  // Direct-product and semidirect-product build modes share the main canvas,
  // so entering one must exit the other.
  const toggleDirectProductMode = useCallback(() => {
    if (!directProduct.isDirectProductMode && sd.isSemidirectProductMode) {
      sd.toggleSemidirectProductMode()
    }
    directProduct.toggleDirectProductMode()
  }, [directProduct, sd])

  const toggleSemidirectProductMode = useCallback(() => {
    if (!sd.isSemidirectProductMode && directProduct.isDirectProductMode) {
      directProduct.toggleDirectProductMode()
    }
    sd.toggleSemidirectProductMode()
  }, [directProduct, sd])

  const computeInverse = useCallback(() => {
    if (selfInverseTimerRef.current) {
      clearTimeout(selfInverseTimerRef.current)
      selfInverseTimerRef.current = null
    }
    symmetry.setSelfInverseElementId(null)

    if (core.selectedElements.size !== 1) {
      core.addOperationHistory(t('op.inverseRequest'))
      return
    }

    const id = Array.from(core.selectedElements)[0]
    const element = core.currentGroup?.elements.find(e => e.id === id)
    if (!element || !core.currentGroup) return

    const inv = core.currentGroup.inverse(element)
    core.addOperationHistory(t('op.inverseDone', { label: element.label, result: inv.label }))
    selectElement(inv.id, true)

    if (inv.id === element.id) {
      symmetry.setSelfInverseElementId(element.id)
      selfInverseTimerRef.current = setTimeout(() => {
        symmetry.setSelfInverseElementId(null)
        selfInverseTimerRef.current = null
      }, 2500)
    }
  }, [core, symmetry, selectElement, t])

  const clearCanvas = useCallback(() => {
    core.clearSelection()
    core.resetCanvasTransform()
    core.clearAllNodePositions()
    core.addOperationHistory(t('op.clearCanvas'))
    symmetry.setSelfInverseElementId(null)
  }, [core, symmetry, t])

  const runForceLayout = useCallback(() => {
    if (!core.currentGroup) return

    const vbs = getViewBoxSize(core.currentGroup.order, core.currentView, core.forceShowLargeGroupViews.has(core.currentView))
    let existingPositions = core.nodePositions.get(core.currentView)

    if (isGroupDirectProduct(core.currentGroup) && core.currentView === 'cayley') {
      const gridPosRaw = computeShape2DPositions(core.currentGroup, 'grid', vbs.width, vbs.height)
      if (gridPosRaw) {
        const gridPos = 'positions' in gridPosRaw ? (gridPosRaw as { positions: Map<string, { x: number; y: number }> }).positions : gridPosRaw as Map<string, { x: number; y: number }>
        if (!existingPositions || existingPositions.size === 0) {
          existingPositions = gridPos
        }
      }
    }

    if (core.currentView === 'cycle') {
      const cycleSubgroups = computeCycleSubgroups(core.currentGroup)
      let cycles = cycleSubgroups
        .map(indices => ({
          elements: indices.map(i => ({ id: core.currentGroup!.elements[i].id })),
          order: indices.length
        }))
        .filter(c => c.order > 1)

      if (core.showMaximalCycles) {
        cycles = computeMaximalCycles(cycles)
      }

      const positions = planarCycleLayout(
        core.currentGroup.elements,
        cycles,
        vbs.width,
        vbs.height,
        { initialPositions: existingPositions }
      )
      core.batchSetNodePositions(positions)
      core.addOperationHistory(t('op.layout', { view: core.getViewLabel(core.currentView) }))
      core.setHintMessage(t('hint.layoutDone'))
    } else {
      const isLarge = core.currentGroup.order > 30
      if (isLarge) core.setHintMessage(t('hint.layoutComputing'))

      const enabledActions = cayley.cayleyActions.filter(a => a.enabled)
      const edges = core.currentGroup.elements.reduce<{ source: string; target: string }[]>((acc, el) => {
        for (const action of enabledActions) {
          const actionEl = core.currentGroup!.elements.find(e => e.id === action.elementId)
          if (!actionEl) continue
          let toEl: GroupElement | undefined
          if (cayley.cayleyMultiplyType === 'right') {
            toEl = core.currentGroup!.multiply(el, actionEl)
          } else {
            toEl = core.currentGroup!.multiply(actionEl, el)
          }
          if (!toEl) continue
          acc.push({ source: el.id, target: toEl.id })
        }
        return acc
      }, [])

      if (isLarge) {
        const groupAtStart = core.currentGroup
        forceLayoutAsync(
          core.currentGroup.elements,
          edges,
          vbs.width,
          vbs.height,
          { initialPositions: existingPositions }
        ).then(positions => {
          if (core.currentGroup !== groupAtStart) return
          core.batchSetNodePositions(positions)
          core.addOperationHistory(t('op.layout', { view: core.getViewLabel(core.currentView) }))
          core.setHintMessage(t('hint.layoutDone'))
        }).catch(() => {
          core.setHintMessage(t('hint.layoutFailed'))
        })
      } else {
        const positions = forceLayout(
          core.currentGroup.elements,
          edges,
          vbs.width,
          vbs.height,
          { initialPositions: existingPositions }
        )
        core.batchSetNodePositions(positions)
        core.addOperationHistory(t('op.layout', { view: core.getViewLabel(core.currentView) }))
        core.setHintMessage(t('hint.layoutDone'))
      }
    }
  }, [core, cayley, t])

  const resetNodePositions = useCallback(() => {
    if (!core.currentGroup) return
    const effectiveShape = core.currentView === 'cayley' ? cayley.cayleyShape2D : undefined
    core.resetNodePositions(effectiveShape)
  }, [core, cayley])

  const setForceShowLargeGroupForView = useCallback((view: ViewMode, allow: boolean) => {
    core.setForceShowLargeGroupForView(view, allow)
    if (core.currentGroup && core.currentView === 'cayley') {
      core.resetNodePositions(cayley.cayleyShape2D)
    }
  }, [core, cayley])

  const saveSubset = useCallback(() => {
    if (symmetry.symmetryShowAction) return
    subset.saveSubset()
  }, [symmetry.symmetryShowAction, subset])

  const createQuotientGroupWithHomomorphism = useCallback((subsetId: string): QuotientGroupEntry | null => {
    const entry = subset.createQuotientGroup(subsetId)
    if (!entry || !core.currentGroup) return null

    if (entry.isoSymbol) {
      core.setHintMessage(t('hint.quotientCreatedIso', {
        symbol: entry.group.symbol,
        order: entry.group.order,
        isoSymbol: entry.isoSymbol,
      }).replace(entry.group.symbol, `<span class="hint-highlight">${entry.group.symbol}</span>`)
        .replace(entry.isoSymbol, `<span class="hint-highlight">${entry.isoSymbol}</span>`))
    }

    return entry
  }, [subset, core, t])

  const value: GroupContextType = useMemo(() => ({
    currentGroup: core.currentGroup,
    currentView: core.currentView,
    selectedElements: core.selectedElements,
    canvasTransform: core.canvasTransform,
    operationHistory: core.operationHistory,
    nodePositions: core.nodePositions,
    viewTabs: core.viewTabs,
    activeTabId: core.activeTabId,
    hoverElement: core.hoverElement,
    isSimpleGroup: backend.isSimpleGroup,
    showMaximalCycles: core.showMaximalCycles,
    hintMessage: core.hintMessage,
    forceShowLargeGroupViews: core.forceShowLargeGroupViews,
    viewBoxSize: core.viewBoxSize,
    isPending: core.isPending,
    isLargeGroup: core.isLargeGroup,

    cayleyMultiplyType: cayley.cayleyMultiplyType,
    cayleyActions: cayley.cayleyActions,
    cayleyShape3D: cayley.cayleyShape3D,
    cayleyAvailableShapes3D: cayley.cayleyAvailableShapes3D,
    cayleyShape2D: cayley.cayleyShape2D,
    cayleyAvailableShapes2D: cayley.cayleyAvailableShapes2D,

    subsets: subset.subsets,
    cosetSubsetId: subset.cosetSubsetId,
    cosetSubgroupElementIds: subset.cosetSubgroupElementIds,
    cosetType: subset.cosetType,
    showAllCosets: subset.showAllCosets,
    cosetData: subset.cosetData,
    cosetElementMap: subset.cosetElementMap,
    cosetHighlightSet: subset.cosetHighlightSet,
    cosetColors: subset.cosetColors,
    quotientGroups: subset.quotientGroups,
    automorphismGroups: subset.automorphismGroups,

    symmetryShowAction: symmetry.symmetryShowAction,
    symmetryRotateSpeed: symmetry.symmetryRotateSpeed,
    symmetryActionElementId: symmetry.symmetryActionElementId,
    selfInverseElementId: symmetry.selfInverseElementId,

    isDirectProductMode: directProduct.isDirectProductMode,
    directProductSource: directProduct.directProductSource,
    directProductTarget: directProduct.directProductTarget,
    directProductCreationMode: directProduct.directProductCreationMode,
    directProductGroups: directProduct.directProductGroups,

    isSemidirectProductMode: sd.isSemidirectProductMode,
    sdPanelOpen: sd.sdPanelOpen,
    sdNormalSubgroup: sd.sdNormalSubgroup,
    sdActingGroup: sd.sdActingGroup,
    sdAutNGroup: sd.sdAutNGroup,
    sdAutNList: sd.sdAutNList,
    sdPhiGenMapping: sd.sdPhiGenMapping,
    sdPhiFullMap: sd.sdPhiFullMap,
    sdPhiValid: sd.sdPhiValid,
    sdSemidirectProductGroups: sd.sdSemidirectProductGroups,
    sdDecompositions: sd.sdDecompositions,
    sdActiveDecomposition: sd.sdActiveDecomposition,

    multiViewMode: multiView.multiViewMode,
    floatingViews: multiView.floatingViews,

    backendCache: backend.backendCache,

    homomorphisms: homo.homomorphisms,
    activeHomomorphismId: homo.activeHomomorphismId,
    editingSource: homo.editingSource,
    editingTarget: homo.editingTarget,
    editingMapping: homo.editingMapping,
    editingGeneratorMapping: homo.editingGeneratorMapping,
    isFullExtended: homo.isFullExtended,
    theoremMode: homo.theoremMode,
    theoremPhase: homo.theoremPhase,
    isValidHomo: homo.isValid,
    kernelLabel: homo.kernelLabel,

    actionKind: action.actionKind,
    actionPrime: action.actionPrime,
    actionSetSize: action.actionSetSize,
    actionArrows: action.actionArrows,
    actionEditing: action.actionEditing,
    actionComputation: action.actionComputation,
    actionError: action.actionError,
    actionSelectedElement: action.actionSelectedElement,
    actionHoverElement: action.actionHoverElement,

    seriesType: series.seriesType,
    activeChainIdx: series.activeChainIdx,
    seriesData: series.seriesData,
    compositionChains: series.compositionChains,
    compositionTruncated: series.compositionTruncated,
    seriesFlags: series.seriesFlags,

    presentationGroups: presentation.presentationGroups,
    presentationDraft: presentation.presentationDraft,
    templateGenCount: presentation.templateGenCount,
    visualDraft: presentation.visualDraft,
    presentationError: presentation.presentationError,
    activePresentationGroup: presentation.activePresentationGroup,

    setCurrentGroup: core.setCurrentGroup,
    clearCurrentGroup: core.clearCurrentGroup,
    setCurrentView,
    selectElement,
    clearSelection: core.clearSelection,
    setCanvasTransform: core.setCanvasTransform,
    resetCanvasTransform: core.resetCanvasTransform,
    addOperationHistory: core.addOperationHistory,
    setNodePosition: core.setNodePosition,
    batchSetNodePositions: core.batchSetNodePositions,
    getNodePosition: core.getNodePosition,
    addViewTab: core.addViewTab,
    closeViewTab: core.closeViewTab,
    setActiveTab: core.setActiveTab,
    setHoverElement: core.setHoverElement,
    checkSubsetProperty: core.checkSubsetProperty,
    computeInverse,
    clearCanvas,
    resetNodePositions,
    runForceLayout,
    generateSubgroups: core.generateSubgroups,
    selectNextElement: core.selectNextElement,
    selectPrevElement: core.selectPrevElement,
    setShowMaximalCycles: core.setShowMaximalCycles,
    setHintMessage: core.setHintMessage,
    setForceShowLargeGroupForView,

    setCayleyMultiplyType: cayley.setCayleyMultiplyType,
    setCayleyActions: cayley.setCayleyActions,
    setCayleyShape3D: cayley.setCayleyShape3D,
    setCayleyShape2D: cayley.setCayleyShape2D,
    toggleCayleyAction: cayley.toggleCayleyAction,
    addAllCayleyActions: cayley.addAllCayleyActions,
    clearCayleyActions: cayley.clearCayleyActions,

    saveSubset,
    removeSubset: subset.removeSubset,
    clearAllSubsets: subset.clearAllSubsets,
    showCosetsForSubset: subset.showCosetsForSubset,
    showCosetsFromElements: subset.showCosetsFromElements,
    hideCosets: subset.hideCosets,
    setCosetType: subset.setCosetType,
    toggleShowAllCosets: subset.toggleShowAllCosets,
    showCosetFromElements: subset.showCosetFromElements,
    createQuotientGroup: subset.createQuotientGroup,
    removeQuotientGroup: subset.removeQuotientGroup,
    loadQuotientGroup: subset.loadQuotientGroup,
    createQuotientGroupWithHomomorphism,

    computeAutomorphismGroup: subset.computeAutomorphismGroup,
    removeAutomorphismGroup: subset.removeAutomorphismGroup,
    loadAutomorphismGroup: subset.loadAutomorphismGroup,

    setSymmetryShowAction: symmetry.setSymmetryShowAction,
    setSymmetryRotateSpeed: symmetry.setSymmetryRotateSpeed,
    setSymmetryActionElementId: symmetry.setSymmetryActionElementId,
    setSelfInverseElementId: symmetry.setSelfInverseElementId,

    toggleDirectProductMode,
    setDirectProductSource: directProduct.setDirectProductSource,
    setDirectProductTarget: directProduct.setDirectProductTarget,
    setDirectProductCreationMode: directProduct.setDirectProductCreationMode,
    executeDirectProduct: directProduct.executeDirectProduct,
    storeDirectProductGroup: directProduct.storeDirectProductGroup,
    removeDirectProductGroup: directProduct.removeDirectProductGroup,
    loadDirectProductGroup: directProduct.loadDirectProductGroup,

    toggleSemidirectProductMode,
    setSDPanelOpen: sd.setSDPanelOpen,
    decomposeSemidirectProduct: sd.decomposeSemidirectProduct,
    selectSemidirectDecomposition: sd.selectSemidirectDecomposition,
    setSDNormalSubgroup: sd.setSDNormalSubgroup,
    setSDActingGroup: sd.setSDActingGroup,
    computeAutN: sd.computeAutN,
    setPhiGenMapping: sd.setPhiGenMapping,
    expandPhiFull: sd.expandPhiFull,
    executeSemidirectProduct: sd.executeSemidirectProduct,
    storeSemidirectProductGroup: sd.storeSemidirectProductGroup,
    removeSemidirectProductGroup: sd.removeSemidirectProductGroup,
    loadSemidirectProductGroup: sd.loadSemidirectProductGroup,

    createHomomorphism: homo.createHomomorphism,
    setMappingElement: homo.setMappingElement,
    removeMappingElement: homo.removeMappingElement,
    setGeneratorMapping: homo.setGeneratorMapping,
    removeGeneratorMapping: homo.removeGeneratorMapping,
    clearMapping: homo.clearMapping,
    verifyCurrentMapping: homo.verifyCurrentMapping,
    deleteHomomorphism: homo.deleteHomomorphism,
    activateHomomorphism: homo.activateHomomorphism,
    applyTrivialMapping: homo.applyTrivialMapping,
    applyProjectionMapping: homo.applyProjectionMapping,
    applySubgroupInclusionMapping: homo.applySubgroupInclusionMapping,
    applyDPProjectionMapping: homo.applyDPProjectionMapping,
    setEditingTarget: homo.setEditingTarget,
    setEditingSource: homo.setEditingSource,
    setTheoremMode: homo.setTheoremMode,
    setTheoremPhase: homo.setTheoremPhase,

    createConjugationAction: action.createConjugationAction,
    createSylowAction: action.createSylowAction,
    createRegularAction: action.createRegularAction,
    createCosetAction: action.createCosetAction,
    startCustomAction: action.startCustomAction,
    addArrow: action.addArrow,
    bindArrow: action.bindArrow,
    removeArrow: action.removeArrow,
    removeArrowAll: action.removeArrowAll,
    replaceGenArrows: action.replaceGenArrows,
    clearArrows: action.clearArrows,
    completeCustomAction: action.completeCustomAction,
    setActionSelectedElement: action.setActionSelectedElement,
    setActionHoverElement: action.setActionHoverElement,
    clearAction: action.clearAction,
    savedActions: action.savedActions,
    activateSavedAction: action.activateSavedAction,
    deleteSavedAction: action.deleteSavedAction,

    setSeriesType: series.setSeriesType,
    setActiveChainIdx: series.setActiveChainIdx,

    setPresentationDraft: presentation.setPresentationDraft,
    setTemplateGenCount: presentation.setTemplateGenCount,
    setVisualDraft: presentation.setVisualDraft,
    createPresentationGroupFromText: presentation.createPresentationGroupFromText,
    storePresentationGroup: presentation.storePresentationGroup,
    removePresentationGroup: presentation.removePresentationGroup,
    loadPresentationGroup: presentation.loadPresentationGroup,
    clearActivePresentationGroup: presentation.clearActivePresentationGroup,

    toggleMultiViewMode: multiView.toggleMultiViewMode,
    openFloatingView: multiView.openFloatingView,
    closeFloatingView: multiView.closeFloatingView,
  }), [
    core, backend, cayley, subset, symmetry, directProduct, multiView, homo, sd, action, series, presentation,
    setCurrentView, selectElement, computeInverse, clearCanvas,
    resetNodePositions, runForceLayout, setForceShowLargeGroupForView, saveSubset,
    createQuotientGroupWithHomomorphism,
    toggleDirectProductMode, toggleSemidirectProductMode,
  ])

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export function GroupProvider({ children }: { children: ReactNode }) {
  return (
    <GroupCoreProvider>
      <GroupBackendProvider>
        <GroupCayleyProvider>
          <GroupSubsetProvider>
            <GroupSymmetryProvider>
                <GroupDirectProductProvider>
                  <GroupSemidirectProductProvider>
                  <GroupMultiViewProvider>
                    <GroupHomomorphismProvider>
                      <GroupActionProvider>
                        <GroupSeriesProvider>
                          <GroupPresentationProvider>
                            <GroupContextCombiner>
                              {children}
                            </GroupContextCombiner>
                          </GroupPresentationProvider>
                        </GroupSeriesProvider>
                      </GroupActionProvider>
                    </GroupHomomorphismProvider>
                  </GroupMultiViewProvider>
                  </GroupSemidirectProductProvider>
                </GroupDirectProductProvider>
            </GroupSymmetryProvider>
          </GroupSubsetProvider>
        </GroupCayleyProvider>
      </GroupBackendProvider>
    </GroupCoreProvider>
  )
}

export { GroupContext }

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Group } from '../../core/types'
import type { Automorphism } from '../../core/algebra/automorphisms'
import { findAllAutomorphisms, createAutomorphismGroup } from '../../core/algebra/automorphisms'
import { findAutoByMap, findSemidirectDecompositions, type SemidirectDecompositionCandidate } from '../../core/algebra/semidirectDecompositions'
import { getGeneratorElements, extendFromGenerators, extractGeneratorMapping } from '../../core/algebra/homomorphisms'
import { createSemidirectProduct } from '../../core/groups/SemidirectProduct'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import {
  loadSemidirectProductSpecsFromStorage,
  saveSemidirectProductSpecsToStorage,
  reconstructSemidirectProduct,
  type StoredSemidirectProduct,
} from './semidirectProductStorage'

interface GroupSemidirectProductState {
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
  sdStoredSpecs: StoredSemidirectProduct[]
  sdDecompositions: SemidirectDecompositionCandidate[]
  sdActiveDecomposition: number
}

interface GroupSemidirectProductActions {
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
  storeSemidirectProductGroup: (group: Group, spec?: StoredSemidirectProduct) => void
  removeSemidirectProductGroup: (symbol: string) => void
  loadSemidirectProductGroup: (symbol: string) => void
}

export type GroupSemidirectProductContextType = GroupSemidirectProductState & GroupSemidirectProductActions

const GroupSemidirectProductContext = createContext<GroupSemidirectProductContextType | null>(null)

export function GroupSemidirectProductProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { setCurrentGroup, setHintMessage, addOperationHistory } = useGroupCore()

  const [isSemidirectProductMode, setIsSemidirectProductMode] = useState(false)
  const [sdPanelOpen, setSDPanelOpenState] = useState(false)
  const [sdNormalSubgroup, setSDNormalSubgroupState] = useState<Group | null>(null)
  const [sdActingGroup, setSDActingGroupState] = useState<Group | null>(null)
  const [sdAutNGroup, setSDAutNGroup] = useState<Group | null>(null)
  const [sdAutNList, setSDAutNList] = useState<Automorphism[]>([])
  const [sdPhiGenMapping, setSDPhiGenMapping] = useState<Map<string, string>>(new Map())
  const [sdPhiFullMap, setSDPhiFullMap] = useState<Map<string, Automorphism> | null>(null)
  const [sdPhiValid, setSDPhiValid] = useState<boolean | null>(null)
  const [sdStoredSpecs, setSDStoredSpecs] = useState<StoredSemidirectProduct[]>(loadSemidirectProductSpecsFromStorage)
  const [sdDecompositions, setSDDecompositions] = useState<SemidirectDecompositionCandidate[]>([])
  const [sdActiveDecomposition, setSDActiveDecomposition] = useState(-1)

  // Synchronous mirrors of φ state so store/execute in the same event handler stay consistent
  const sdPhiGenMappingRef = useRef<Map<string, string>>(new Map())
  const sdPhiFullMapRef = useRef<Map<string, Automorphism> | null>(null)

  const [sdSemidirectProductGroups, setSDSemidirectProductGroups] = useState<Group[]>(() => {
    const specs = loadSemidirectProductSpecsFromStorage()
    const seen = new Set<string>()
    const groups: Group[] = []
    for (const spec of specs) {
      const g = reconstructSemidirectProduct(spec)
      if (g && !seen.has(g.symbol)) {
        seen.add(g.symbol)
        groups.push(g)
      }
    }
    return groups
  })

  const toggleSemidirectProductMode = useCallback(() => {
    setIsSemidirectProductMode(prev => {
      if (prev) {
        setSDNormalSubgroupState(null)
        setSDActingGroupState(null)
        setSDAutNGroup(null)
        setSDAutNList([])
        setSDPhiGenMapping(new Map())
        setSDPhiFullMap(null)
        setSDPhiValid(null)
        setSDDecompositions([])
        setSDActiveDecomposition(-1)
        sdPhiGenMappingRef.current = new Map()
        sdPhiFullMapRef.current = null
        return false
      }
      return true
    })
  }, [])

  const setSDPanelOpen = useCallback((open: boolean) => {
    setSDPanelOpenState(open)
  }, [])

  const setSDNormalSubgroup = useCallback((group: Group | null) => {
    setSDNormalSubgroupState(group)
    setSDAutNGroup(null)
    setSDAutNList([])
    setSDPhiGenMapping(new Map())
    setSDPhiFullMap(null)
    setSDPhiValid(null)
    setSDDecompositions([])
    setSDActiveDecomposition(-1)
    sdPhiGenMappingRef.current = new Map()
    sdPhiFullMapRef.current = null
  }, [])

  const setSDActingGroup = useCallback((group: Group | null) => {
    setSDActingGroupState(group)
    setSDPhiGenMapping(new Map())
    setSDPhiFullMap(null)
    setSDPhiValid(null)
    setSDDecompositions([])
    setSDActiveDecomposition(-1)
    sdPhiGenMappingRef.current = new Map()
    sdPhiFullMapRef.current = null
  }, [])

  const computeAutN = useCallback(() => {
    if (!sdNormalSubgroup) {
      setHintMessage(t('sd.selectNFirst'))
      return
    }
    const autos = findAllAutomorphisms(sdNormalSubgroup)
    if (autos.length === 0) {
      setSDAutNList([])
      setSDAutNGroup(null)
      setSDPhiGenMapping(new Map())
      setSDPhiFullMap(null)
      setSDPhiValid(null)
      sdPhiGenMappingRef.current = new Map()
      sdPhiFullMapRef.current = null
      setHintMessage(t('sd.autTooLarge'))
      return
    }
    setSDAutNList(autos)
    const autGroup = createAutomorphismGroup(sdNormalSubgroup, autos)
    setSDAutNGroup(autGroup)
    // Reset φ mapping
    setSDPhiGenMapping(new Map())
    setSDPhiFullMap(null)
    setSDPhiValid(null)
    setHintMessage(t('sd.autComputed', { n: autos.length }).replace(String(autos.length), `<span class="hint-highlight">${autos.length}</span>`))
  }, [sdNormalSubgroup, setHintMessage, t])

  const setPhiGenMapping = useCallback((genId: string, autoId: string) => {
    setSDPhiGenMapping(prev => {
      const next = new Map(prev)
      next.set(genId, autoId)
      sdPhiGenMappingRef.current = next
      return next
    })
    setSDPhiFullMap(null)
    setSDPhiValid(null)
  }, [])

  const expandPhiFull = useCallback(() => {
    if (!sdNormalSubgroup || !sdActingGroup || !sdAutNGroup) return

    const hGenPairs = getGeneratorElements(sdActingGroup)

    // Check if all generators have mappings
    const hasAll = hGenPairs.every(({ el }) => sdPhiGenMapping.has(el.id))
    if (!hasAll) {
      setHintMessage(t('sd.mapAllGens'))
      return
    }

    // Extend generator mapping to full H
    const fullHMap = extendFromGenerators(sdActingGroup, sdAutNGroup, sdPhiGenMapping)
    if (!fullHMap) {
      setSDPhiValid(false)
      setHintMessage(t('sd.extendFailed'))
      return
    }

    const autoById = new Map(sdAutNList.map(a => [a.id, a]))
    const phiFull = new Map<string, Automorphism>()
    for (const [hId, autoId] of fullHMap) {
      const auto = autoById.get(autoId)
      if (auto) phiFull.set(hId, auto)
    }

    setSDPhiFullMap(phiFull)
    sdPhiFullMapRef.current = phiFull

    // Validate
    try {
      createSemidirectProduct(sdNormalSubgroup, sdActingGroup, phiFull)
      setSDPhiValid(true)
      setHintMessage(t('sd.phiValid'))
    } catch {
      setSDPhiValid(false)
      setHintMessage(t('sd.phiInvalid'))
    }
  }, [sdNormalSubgroup, sdActingGroup, sdAutNGroup, sdAutNList, sdPhiGenMapping, setHintMessage, t])

  const executeSemidirectProduct = useCallback((): Group | null => {
    if (!sdNormalSubgroup || !sdActingGroup) {
      setHintMessage(t('sd.selectBoth'))
      return null
    }

    const order = sdNormalSubgroup.order * sdActingGroup.order
    if (order > 144) {
      setHintMessage(t('sd.orderTooLarge', { n: order }))
      return null
    }

    let phiFull = sdPhiFullMap
    let autos = sdAutNList
    let autGroup = sdAutNGroup

    if (!phiFull || phiFull.size === 0) {
      // Auto-expand φ from the current generator mapping (empty mapping → all identity)
      if (!autGroup) {
        autos = findAllAutomorphisms(sdNormalSubgroup)
        setSDAutNList(autos)
        autGroup = createAutomorphismGroup(sdNormalSubgroup, autos)
        setSDAutNGroup(autGroup)
      }
      if (!autGroup || autos.length === 0) {
        setHintMessage(autos.length === 0 ? t('sd.autTooLarge') : t('sd.createFailed'))
        return null
      }

      const idAutoId = autGroup.identity.id
      const genMap = new Map<string, string>()
      for (const { el } of getGeneratorElements(sdActingGroup)) {
        genMap.set(el.id, sdPhiGenMapping.get(el.id) || idAutoId)
      }

      const fullHMap = extendFromGenerators(sdActingGroup, autGroup, genMap)
      if (!fullHMap) {
        setHintMessage(t('sd.extendFailed'))
        return null
      }

      const autoById = new Map(autos.map(a => [a.id, a]))
      phiFull = new Map<string, Automorphism>()
      for (const [hId, autoId] of fullHMap) {
        const auto = autoById.get(autoId)
        if (auto) phiFull.set(hId, auto)
      }

      // Sync expanded φ back into state + refs so the view and later stores use the same mapping
      const genMapping = extractGeneratorMapping(sdActingGroup, fullHMap)
      sdPhiGenMappingRef.current = genMapping
      sdPhiFullMapRef.current = phiFull
      setSDPhiGenMapping(genMapping)
      setSDPhiFullMap(phiFull)
    }

    try {
      const group = createSemidirectProduct(sdNormalSubgroup, sdActingGroup, phiFull)
      return group
    } catch {
      setHintMessage(t('sd.createFailed'))
      return null
    }
  }, [sdNormalSubgroup, sdActingGroup, sdPhiFullMap, sdAutNGroup, sdAutNList, sdPhiGenMapping, setHintMessage, t])

  const storeSemidirectProductGroup = useCallback((group: Group, spec?: StoredSemidirectProduct) => {
    setSDSemidirectProductGroups(prev => {
      const exists = prev.find(g => g.symbol === group.symbol)
      const next = exists ? prev.map(g => g.symbol === group.symbol ? group : g) : [...prev, group]
      return next
    })

    // Save spec to storage
    let newSpec: StoredSemidirectProduct | undefined = spec
    if (!newSpec && sdNormalSubgroup && sdActingGroup && sdPhiGenMappingRef.current.size > 0) {
      const genMapping: Record<string, string> = {}
      sdPhiGenMappingRef.current.forEach((v, k) => { genMapping[k] = v })
      newSpec = {
        id: `sd-${Date.now()}`,
        symbol: group.symbol,
        normalSymbol: sdNormalSubgroup.symbol,
        actingSymbol: sdActingGroup.symbol,
        phiGenMapping: genMapping,
      }
    }
    if (newSpec) {
      newSpec.symbol = group.symbol
      const existingIdx = sdStoredSpecs.findIndex(s => s.symbol === group.symbol)
      const newSpecs = existingIdx >= 0
        ? sdStoredSpecs.map((s, i) => (i === existingIdx ? newSpec! : s))
        : [...sdStoredSpecs, newSpec]
      setSDStoredSpecs(newSpecs)
      saveSemidirectProductSpecsToStorage(newSpecs)
    }

    setHintMessage(t('sd.storeHint', { symbol: group.symbol }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
  }, [sdNormalSubgroup, sdActingGroup, sdStoredSpecs, setHintMessage, t])

  const removeSemidirectProductGroup = useCallback((symbol: string) => {
    setSDSemidirectProductGroups(prev => prev.filter(g => g.symbol !== symbol))
    const newSpecs = sdStoredSpecs.filter(s => s.symbol !== symbol)
    setSDStoredSpecs(newSpecs)
    saveSemidirectProductSpecsToStorage(newSpecs)
    setHintMessage(t('sd.removeHint', { symbol }).replace(symbol, `<span class="hint-highlight">${symbol}</span>`))
  }, [sdStoredSpecs, setHintMessage, t])

  const loadSemidirectProductGroup = useCallback((symbol: string) => {
    const group = sdSemidirectProductGroups.find(g => g.symbol === symbol)
    if (group) {
      setCurrentGroup(group)
      setIsSemidirectProductMode(false)
      setHintMessage(t('sd.created', { symbol: group.symbol, order: group.order }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`))
      addOperationHistory(t('sd.created', { symbol: group.symbol, order: group.order }))
    }
  }, [sdSemidirectProductGroups, setCurrentGroup, setHintMessage, addOperationHistory, t])

  /**
   * Fill the panel's N / H / Aut(N) / φ state from a search candidate.
   * Uses raw setters so the decomposition list is not cleared.
   */
  const populateFromCandidate = useCallback((cand: SemidirectDecompositionCandidate): void => {
    const N = cand.normal
    const H = cand.acting
    setSDNormalSubgroupState(N)
    setSDActingGroupState(H)

    const autos = findAllAutomorphisms(N)
    const autGroup = autos.length > 0 ? createAutomorphismGroup(N, autos) : null
    if (!autGroup || autos.length === 0) {
      setSDAutNList([])
      setSDAutNGroup(null)
      setSDPhiGenMapping(new Map())
      sdPhiGenMappingRef.current = new Map()
      setSDPhiFullMap(cand.phiMap)
      sdPhiFullMapRef.current = cand.phiMap
      setSDPhiValid(null)
      return
    }

    let identityAuto: Automorphism | null = null
    for (const auto of autos) {
      let isIdentity = true
      for (const [k, v] of auto.map) {
        if (k !== v) { isIdentity = false; break }
      }
      if (isIdentity) { identityAuto = auto; break }
    }

    // Map each H generator to the matching automorphism (conjugation by h)
    const genMapping = new Map<string, string>()
    for (const { el } of getGeneratorElements(H)) {
      const rec = cand.phiMap.get(el.id)
      const matched = rec ? findAutoByMap(autos, rec.map) : null
      genMapping.set(el.id, matched ? matched.id : autGroup.identity.id)
    }

    const phiFull = new Map<string, Automorphism>()
    for (const h of H.elements) {
      const rec = cand.phiMap.get(h.id)
      const matched = rec ? findAutoByMap(autos, rec.map) : null
      phiFull.set(h.id, matched ?? identityAuto ?? autos[0])
    }

    setSDAutNList(autos)
    setSDAutNGroup(autGroup)
    setSDPhiGenMapping(genMapping)
    sdPhiGenMappingRef.current = genMapping
    setSDPhiFullMap(phiFull)
    sdPhiFullMapRef.current = phiFull
    setSDPhiValid(true)
  }, [])

  /**
   * Import the canonical decomposition N ⋊_φ H recorded on a semidirect product
   * group and open the semidirect product panel with all φ state populated.
   * For groups without construction data, runs findSemidirectDecompositions and
   * auto-selects the first (verified-first) candidate.
   * Returns false when no decomposition is found.
   */
  const decomposeSemidirectProduct = useCallback((group: Group): boolean => {
    const spec = group._semidirectProduct
    if (!spec) {
      // Search direction: any group may admit a semidirect decomposition
      const candidates = findSemidirectDecompositions(group)
      setSDDecompositions(candidates)
      setSDActiveDecomposition(-1)
      if (candidates.length === 0) {
        setHintMessage(t('sd.noDecomposition', { symbol: group.symbol }))
        return false
      }
      populateFromCandidate(candidates[0])
      setSDActiveDecomposition(0)
      setIsSemidirectProductMode(true)
      setSDPanelOpenState(true)
      setHintMessage(
        t('sd.decomposeCount', { n: candidates.length })
          .replace(String(candidates.length), `<span class="hint-highlight">${candidates.length}</span>`)
      )
      return true
    }
    const { normal, acting, phiMap } = spec

    const autos = findAllAutomorphisms(normal)
    if (autos.length === 0) {
      setHintMessage(t('sd.autTooLarge'))
      return false
    }
    const autGroup = createAutomorphismGroup(normal, autos)
    if (!autGroup) {
      setHintMessage(t('sd.autTooLarge'))
      return false
    }

    // Map each H generator to the automorphism matching the recorded φ image
    const genMapping = new Map<string, string>()
    for (const { el } of getGeneratorElements(acting)) {
      const recorded = phiMap.get(el.id)
      const matched = recorded ? findAutoByMap(autos, recorded.map) : null
      genMapping.set(el.id, matched ? matched.id : autGroup.identity.id)
    }

    // Complete the full φ table with the recorded mappings, defaulting to identity
    const phiFull = new Map<string, Automorphism>()
    let identityAuto: Automorphism | null = null
    for (const auto of autos) {
      let isIdentity = true
      for (const [k, v] of auto.map) {
        if (k !== v) { isIdentity = false; break }
      }
      if (isIdentity) { identityAuto = auto; break }
    }
    for (const h of acting.elements) {
      const recorded = phiMap.get(h.id)
      phiFull.set(h.id, recorded ?? identityAuto ?? autos[0])
    }

    setSDNormalSubgroupState(normal)
    setSDActingGroupState(acting)
    setSDAutNList(autos)
    setSDAutNGroup(autGroup)
    setSDPhiGenMapping(genMapping)
    sdPhiGenMappingRef.current = genMapping
    setSDPhiFullMap(phiFull)
    sdPhiFullMapRef.current = phiFull
    setSDPhiValid(true)
    setSDDecompositions([])
    setSDActiveDecomposition(-1)
    setIsSemidirectProductMode(true)
    setSDPanelOpenState(true)
    setHintMessage(
      t('sd.decomposeHint', { symbol: group.symbol }).replace(group.symbol, `<span class="hint-highlight">${group.symbol}</span>`)
    )
    return true
  }, [populateFromCandidate, setHintMessage, t])

  const selectSemidirectDecomposition = useCallback((index: number): void => {
    if (index < 0 || index >= sdDecompositions.length || index === sdActiveDecomposition) return
    const cand = sdDecompositions[index]
    if (!cand) return
    populateFromCandidate(cand)
    setSDActiveDecomposition(index)
  }, [sdDecompositions, sdActiveDecomposition, populateFromCandidate])

  const value: GroupSemidirectProductContextType = {
    isSemidirectProductMode, sdPanelOpen, sdNormalSubgroup, sdActingGroup,
    sdAutNGroup, sdAutNList,
    sdPhiGenMapping, sdPhiFullMap, sdPhiValid,
    sdSemidirectProductGroups, sdStoredSpecs,
    sdDecompositions, sdActiveDecomposition,
    toggleSemidirectProductMode, setSDPanelOpen, decomposeSemidirectProduct,
    selectSemidirectDecomposition,
    setSDNormalSubgroup, setSDActingGroup,
    computeAutN, setPhiGenMapping, expandPhiFull,
    executeSemidirectProduct, storeSemidirectProductGroup,
    removeSemidirectProductGroup, loadSemidirectProductGroup,
  }

  return (
    <GroupSemidirectProductContext.Provider value={value}>
      {children}
    </GroupSemidirectProductContext.Provider>
  )
}

export function useGroupSemidirectProduct() {
  const context = useContext(GroupSemidirectProductContext)
  if (!context) {
    throw new Error('useGroupSemidirectProduct must be used within GroupSemidirectProductProvider')
  }
  return context
}

export { GroupSemidirectProductContext }

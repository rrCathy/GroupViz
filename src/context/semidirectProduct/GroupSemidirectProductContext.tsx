/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Group } from '../../core/types'
import type { Automorphism } from '../../core/algebra/automorphisms'
import { findAllAutomorphisms, createAutomorphismGroup } from '../../core/algebra/automorphisms'
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
  sdNormalSubgroup: Group | null
  sdActingGroup: Group | null
  sdAutNGroup: Group | null
  sdAutNList: Automorphism[]
  sdPhiGenMapping: Map<string, string>
  sdPhiFullMap: Map<string, Automorphism> | null
  sdPhiValid: boolean | null
  sdSemidirectProductGroups: Group[]
  sdStoredSpecs: StoredSemidirectProduct[]
}

interface GroupSemidirectProductActions {
  toggleSemidirectProductMode: () => void
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
  const [sdNormalSubgroup, setSDNormalSubgroupState] = useState<Group | null>(null)
  const [sdActingGroup, setSDActingGroupState] = useState<Group | null>(null)
  const [sdAutNGroup, setSDAutNGroup] = useState<Group | null>(null)
  const [sdAutNList, setSDAutNList] = useState<Automorphism[]>([])
  const [sdPhiGenMapping, setSDPhiGenMapping] = useState<Map<string, string>>(new Map())
  const [sdPhiFullMap, setSDPhiFullMap] = useState<Map<string, Automorphism> | null>(null)
  const [sdPhiValid, setSDPhiValid] = useState<boolean | null>(null)
  const [sdStoredSpecs, setSDStoredSpecs] = useState<StoredSemidirectProduct[]>(loadSemidirectProductSpecsFromStorage)

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
        sdPhiGenMappingRef.current = new Map()
        sdPhiFullMapRef.current = null
        return false
      }
      return true
    })
  }, [])

  const setSDNormalSubgroup = useCallback((group: Group | null) => {
    setSDNormalSubgroupState(group)
    setSDAutNGroup(null)
    setSDAutNList([])
    setSDPhiGenMapping(new Map())
    setSDPhiFullMap(null)
    setSDPhiValid(null)
    sdPhiGenMappingRef.current = new Map()
    sdPhiFullMapRef.current = null
  }, [])

  const setSDActingGroup = useCallback((group: Group | null) => {
    setSDActingGroupState(group)
    setSDPhiGenMapping(new Map())
    setSDPhiFullMap(null)
    setSDPhiValid(null)
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

  const value: GroupSemidirectProductContextType = {
    isSemidirectProductMode, sdNormalSubgroup, sdActingGroup,
    sdAutNGroup, sdAutNList,
    sdPhiGenMapping, sdPhiFullMap, sdPhiValid,
    sdSemidirectProductGroups, sdStoredSpecs,
    toggleSemidirectProductMode, setSDNormalSubgroup, setSDActingGroup,
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

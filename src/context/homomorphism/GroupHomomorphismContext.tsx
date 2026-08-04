/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Group, Homomorphism, HomomorphismResult } from '../../core/types'
import { verifyHomomorphism, trivialMapping, naturalProjectionMapping, subgroupInclusionMapping, directProductProjectionMapping, formatKernelLabel, extendFromGenerators, extractGeneratorMapping } from '../../core/algebra/homomorphisms'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'
import { loadHomomorphismsFromStorage, saveHomomorphismsToStorage } from './homomorphismStorage'

export type GeneratorMapping = Map<string, string>

interface GroupHomomorphismState {
  homomorphisms: Homomorphism[]
  activeHomomorphismId: string | null
  editingSource: Group | null
  editingTarget: Group | null
  editingMapping: Map<string, string>
  editingGeneratorMapping: GeneratorMapping
  isFullExtended: boolean
  theoremMode: boolean
  theoremPhase: number
  isValid: boolean | null
  kernelLabel: string
}

interface GroupHomomorphismActions {
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
}

export type GroupHomomorphismContextType = GroupHomomorphismState & GroupHomomorphismActions

const GroupHomomorphismContext = createContext<GroupHomomorphismContextType | null>(null)

function applyFullMapping(
  source: Group,
  fullMapping: Map<string, string>
): { fullMapping: Map<string, string>; genMapping: GeneratorMapping } {
  return {
    fullMapping: new Map(fullMapping),
    genMapping: extractGeneratorMapping(source, fullMapping),
  }
}

export function GroupHomomorphismProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage, addOperationHistory } = useGroupCore()

  const [homomorphisms, setHomomorphisms] = useState<Homomorphism[]>(() => loadHomomorphismsFromStorage())
  const [activeHomomorphismId, setActiveHomomorphismId] = useState<string | null>(null)
  const [editingSource, setEditingSourceState] = useState<Group | null>(null)
  const [editingTarget, setEditingTargetState] = useState<Group | null>(null)
  const [editingMapping, setEditingMapping] = useState<Map<string, string>>(new Map())
  const [editingGeneratorMapping, setEditingGeneratorMapping] = useState<GeneratorMapping>(new Map())
  const [isFullExtended, setIsFullExtended] = useState<boolean>(false)
  const [theoremMode, setTheoremModeState] = useState<boolean>(false)
  const [theoremPhase, setTheoremPhaseState] = useState<number>(0)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [kernelLabel, setKernelLabel] = useState<string>('')

  useEffect(() => {
    saveHomomorphismsToStorage(homomorphisms)
  }, [homomorphisms])

  const resetEditing = useCallback(() => {
    setEditingMapping(new Map())
    setEditingGeneratorMapping(new Map())
    setIsFullExtended(false)
    setIsValid(null)
    setKernelLabel('')
  }, [])

  const setEditingSource = useCallback((group: Group) => {
    setEditingSourceState(group)
    resetEditing()
  }, [resetEditing])

  const setEditingTarget = useCallback((group: Group) => {
    setEditingTargetState(group)
    resetEditing()
  }, [resetEditing])

  const setGeneratorMapping = useCallback((genElId: string, targetId: string) => {
    if (!editingSource || !editingTarget) return
    setEditingGeneratorMapping(prev => {
      const next = new Map(prev)
      next.set(genElId, targetId)
      const extended = extendFromGenerators(editingSource, editingTarget, next)
      if (extended) {
        setEditingMapping(new Map(extended))
        setIsFullExtended(true)
      } else {
        setEditingMapping(new Map())
        setIsFullExtended(false)
      }
      setIsValid(null)
      return next
    })
  }, [editingSource, editingTarget])

  const removeGeneratorMapping = useCallback((genElId: string) => {
    if (!editingSource || !editingTarget) return
    setEditingGeneratorMapping(prev => {
      const next = new Map(prev)
      next.delete(genElId)
      if (next.size === 0) {
        setEditingMapping(new Map())
        setIsFullExtended(false)
      } else {
        const extended = extendFromGenerators(editingSource, editingTarget, next)
        if (extended) {
          setEditingMapping(new Map(extended))
          setIsFullExtended(true)
        } else {
          setEditingMapping(new Map())
          setIsFullExtended(false)
        }
      }
      setIsValid(null)
      return next
    })
  }, [editingSource, editingTarget])

  const setMappingElement = useCallback((sourceId: string, targetId: string) => {
    setEditingMapping(prev => {
      const next = new Map(prev)
      next.set(sourceId, targetId)
      return next
    })
    setIsValid(null)
    setIsFullExtended(false)
  }, [])

  const removeMappingElement = useCallback((sourceId: string) => {
    setEditingMapping(prev => {
      const next = new Map(prev)
      next.delete(sourceId)
      return next
    })
    setIsValid(null)
    setIsFullExtended(false)
  }, [])

  const clearMapping = useCallback(() => {
    resetEditing()
  }, [resetEditing])

  const verifyCurrentMapping = useCallback((): HomomorphismResult | null => {
    if (!editingSource || !editingTarget) return null

    const result = verifyHomomorphism(editingSource, editingTarget, editingMapping)
    setIsValid(result.isHomomorphism)

    if (result.isHomomorphism && editingSource) {
      setKernelLabel(formatKernelLabel(editingSource, result.kernel))
      addOperationHistory(t('homo.verified', { source: editingSource.symbol, target: editingTarget.symbol }))
      setHintMessage(t('homo.valid').replace('<span class="hint-highlight">', '').replace('</span>', ''))
    } else if (!result.isHomomorphism && result.violation) {
      setHintMessage(t('homo.invalid'))
    }

    return result
  }, [editingSource, editingTarget, editingMapping, t, addOperationHistory, setHintMessage])

  const createHomomorphism = useCallback((source: Group, target: Group, name?: string) => {
    const homoName = name || `${source.symbol} → ${target.symbol}`
    const result = verifyHomomorphism(source, target, editingMapping)
    const id = `homo-${Date.now()}`
    const newHomo: Homomorphism = {
      id,
      source,
      target,
      mapping: new Map(editingMapping),
      result: result.isHomomorphism ? result : undefined,
      name: homoName,
    }

    setHomomorphisms(prev => [...prev, newHomo])
    setActiveHomomorphismId(id)
    setIsValid(result.isHomomorphism)
    if (result.isHomomorphism) {
      setKernelLabel(formatKernelLabel(source, result.kernel))
    }
    addOperationHistory(t('homo.created', { source: source.symbol, target: target.symbol }))
    setHintMessage(t('homo.saved').replace('<span class="hint-highlight">', '').replace('</span>', ''))
  }, [editingMapping, t, addOperationHistory, setHintMessage])

  const deleteHomomorphism = useCallback((id: string) => {
    setHomomorphisms(prev => {
      const next = prev.filter(h => h.id !== id)
      if (activeHomomorphismId === id) {
        setActiveHomomorphismId(next.length > 0 ? next[next.length - 1].id : null)
      }
      return next
    })
  }, [activeHomomorphismId])

  const activateHomomorphism = useCallback((id: string) => {
    const homo = homomorphisms.find(h => h.id === id)
    if (homo) {
      setActiveHomomorphismId(id)
      setEditingSourceState(homo.source)
      setEditingTargetState(homo.target)
      setEditingMapping(new Map(homo.mapping))
      setEditingGeneratorMapping(extractGeneratorMapping(homo.source, homo.mapping))
      setIsFullExtended(true)
      setIsValid(homo.result?.isHomomorphism ?? null)
      if (homo.result?.isHomomorphism) {
        setKernelLabel(formatKernelLabel(homo.source, homo.result.kernel))
      }
    }
  }, [homomorphisms])

  const applyTrivialMapping = useCallback(() => {
    if (!editingSource || !editingTarget) return
    const map = trivialMapping(editingSource, editingTarget)
    const { fullMapping, genMapping } = applyFullMapping(editingSource, map)
    setEditingMapping(fullMapping)
    setEditingGeneratorMapping(genMapping)
    setIsFullExtended(true)
    setIsValid(null)
    setKernelLabel('')
    setHintMessage(t('homo.trivialApplied'))
  }, [editingSource, editingTarget, t, setHintMessage])

  const applyProjectionMapping = useCallback(() => {
    if (!editingSource || !editingTarget) return
    const map = naturalProjectionMapping(editingSource, editingTarget)
    if (map) {
      const { fullMapping, genMapping } = applyFullMapping(editingSource, map)
      setEditingMapping(fullMapping)
      setEditingGeneratorMapping(genMapping)
      setIsFullExtended(true)
      setIsValid(null)
      setKernelLabel('')
      setHintMessage(t('homo.projectionApplied'))
    } else {
      setHintMessage(t('homo.projectionFailed'))
    }
  }, [editingSource, editingTarget, t, setHintMessage])

  const applySubgroupInclusionMapping = useCallback((sourceElementIds: string[]) => {
    if (!editingSource || !editingTarget) return
    const map = subgroupInclusionMapping(editingSource, editingTarget, sourceElementIds)
    if (map) {
      const { fullMapping, genMapping } = applyFullMapping(editingSource, map)
      setEditingMapping(fullMapping)
      setEditingGeneratorMapping(genMapping)
      setIsFullExtended(true)
      setIsValid(null)
      setKernelLabel('')
      setHintMessage(t('homo.inclusionApplied'))
    } else {
      setHintMessage(t('homo.inclusionFailed'))
    }
  }, [editingSource, editingTarget, t, setHintMessage])

  const applyDPProjectionMapping = useCallback((factorIndex: 0 | 1) => {
    if (!editingSource || !editingTarget) return
    const map = directProductProjectionMapping(editingSource, editingTarget, factorIndex)
    if (map) {
      const { fullMapping, genMapping } = applyFullMapping(editingSource, map)
      setEditingMapping(fullMapping)
      setEditingGeneratorMapping(genMapping)
      setIsFullExtended(true)
      setIsValid(null)
      setKernelLabel('')
      setHintMessage(t('homo.dpProjectionApplied', { factor: factorIndex === 0 ? 'G' : 'H' }))
    } else {
      setHintMessage(t('homo.dpProjectionFailed'))
    }
  }, [editingSource, editingTarget, t, setHintMessage])

  const setTheoremMode = useCallback((value: boolean) => {
    setTheoremModeState(value)
    if (!value) setTheoremPhaseState(0)
  }, [])

  const setTheoremPhase = useCallback((phase: number) => {
    setTheoremPhaseState(phase)
  }, [])

  // Reset homomorphism editing state when a new group is loaded
  useEffect(() => {
    if (!currentGroup) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingSourceState(null)
    setEditingTargetState(null)
    setActiveHomomorphismId(null)
    setEditingMapping(new Map())
    setEditingGeneratorMapping(new Map())
    setIsFullExtended(false)
    setIsValid(null)
    setKernelLabel('')
  }, [currentGroup])

  const value: GroupHomomorphismContextType = {
    homomorphisms,
    activeHomomorphismId,
    editingSource,
    editingTarget,
    editingMapping,
    editingGeneratorMapping,
    isFullExtended,
    theoremMode,
    theoremPhase,
    isValid,
    kernelLabel,
    createHomomorphism,
    setMappingElement,
    removeMappingElement,
    setGeneratorMapping,
    removeGeneratorMapping,
    clearMapping,
    verifyCurrentMapping,
    deleteHomomorphism,
    activateHomomorphism,
    applyTrivialMapping,
    applyProjectionMapping,
    applySubgroupInclusionMapping,
    applyDPProjectionMapping,
    setEditingTarget,
    setEditingSource,
    setTheoremMode,
    setTheoremPhase,
  }

  return (
    <GroupHomomorphismContext.Provider value={value}>
      {children}
    </GroupHomomorphismContext.Provider>
  )
}

export function useGroupHomomorphism() {
  const context = useContext(GroupHomomorphismContext)
  if (!context) {
    throw new Error('useGroupHomomorphism must be used within GroupHomomorphismProvider')
  }
  return context
}

export { GroupHomomorphismContext }

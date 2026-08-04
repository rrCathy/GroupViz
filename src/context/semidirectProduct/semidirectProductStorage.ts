import type { Group } from '../../core/types'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { createSemidirectProduct } from '../../core/groups/SemidirectProduct'
import { findAllAutomorphisms, createAutomorphismGroup } from '../../core/algebra/automorphisms'
import type { Automorphism } from '../../core/algebra/automorphisms'
import { getGeneratorElements, extendFromGenerators } from '../../core/algebra/homomorphisms'

export interface StoredSemidirectProduct {
  id: string
  symbol?: string
  normalSymbol: string
  actingSymbol: string
  phiGenMapping: Record<string, string>
  name?: string
}

const SD_STORAGE_KEY = 'groupviz-sd-groups'

export function loadSemidirectProductSpecsFromStorage(): StoredSemidirectProduct[] {
  try {
    const raw = localStorage.getItem(SD_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as StoredSemidirectProduct[]
    }
  } catch { /* ignore */ }
  return []
}

export function saveSemidirectProductSpecsToStorage(specs: StoredSemidirectProduct[]): void {
  try {
    localStorage.setItem(SD_STORAGE_KEY, JSON.stringify(specs))
  } catch { /* ignore */ }
}

export function reconstructSemidirectProduct(spec: StoredSemidirectProduct): Group | null {
  const N = createGroupFromSymbol(spec.normalSymbol)
  const H = createGroupFromSymbol(spec.actingSymbol)
  if (!N || !H) return null

  const autos = findAllAutomorphisms(N)
  if (autos.length === 0) return null
  const autGroup = createAutomorphismGroup(N, autos)
  if (!autGroup) return null
  const idAutoId = autGroup.identity.id

  const autoById = new Map(autos.map(a => [a.id, a]))

  // Build phiMap for all H elements using generator mapping
  const hGenPairs = getGeneratorElements(H)

  // Map stored gen IDs → Automorphism
  const genPhiMap = new Map<string, Automorphism>()
  for (const { el: genEl } of hGenPairs) {
    const autoId = spec.phiGenMapping[genEl.id]
    const targetId = autoId !== undefined && autoById.has(autoId) ? autoId : idAutoId
    genPhiMap.set(genEl.id, autoById.get(targetId)!)
  }

  // Extend to full H map
  const hGenMap = new Map<string, string>()
  for (const [genId, auto] of genPhiMap) {
    hGenMap.set(genId, auto.id)
  }

  // Build Aut(N) as a group for extendFromGenerators
  const fullHMap = extendFromGenerators(H, autGroup, hGenMap)

  if (!fullHMap) return null

  // Convert Aut(N) element IDs back to Automorphism objects
  const phiMap = new Map<string, Automorphism>()
  for (const [hId, autoId] of fullHMap) {
    const auto = autoById.get(autoId)
    if (auto) phiMap.set(hId, auto)
  }

  try {
    return createSemidirectProduct(N, H, phiMap)
  } catch {
    return null
  }
}

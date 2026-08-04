/**
 * Hybrid computation layer: uses local TypeScript functions for small groups
 * (order ≤ 60) and delegates to the FastAPI backend for large groups.
 */

import type { Group, GroupElement } from '../core/types'
import type { CayleyEdgeData } from '../core/types'
import {
  findAllSubgroups as localFindAllSubgroups,
  getConjugacyClasses as localGetConjugacyClasses,
  getGroupCenter as localGetGroupCenter,
  isSimpleGroup as localIsSimpleGroup,
  computeSubgroupLattice as localSubgroupLattice,
  type Subgroup,
} from '../core/algebra/subgroups'
import {
  computeCayleyActionEdges as localComputeCayleyEdges,
} from '../core/algebra/forceLayout'
import {
  fetchSubgroups,
  fetchConjugacyClasses,
  fetchCenter,
  fetchLattice,
  fetchCayleyEdges,
  fetchElementOrder,
  type ApiSubgroup,
  type ApiElement,
  type ApiCayleyEdge,
} from './api'

const LARGE_ORDER_CUTOFF = 60

export interface BackendCache {
  subgroups: Subgroup[] | null
  normalSubgroups: Subgroup[] | null
  conjugacyClasses: GroupElement[][] | null
  center: GroupElement[] | null
  isSimple: boolean | null
  lattice: { nodes: unknown[]; edges: unknown[] } | null
  loading: boolean
  error: string | null
  groupSymbol: string | null
}

export function createEmptyBackendCache(): BackendCache {
  return {
    subgroups: null,
    normalSubgroups: null,
    conjugacyClasses: null,
    center: null,
    isSimple: null,
    lattice: null,
    loading: false,
    error: null,
    groupSymbol: null,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function apiElementToGroupElement(group: Group, apiEl: ApiElement): GroupElement {
  // Try to find existing element in group, otherwise create a minimal one
  const existing = group.elements.find(e => e.id === apiEl.id)
  if (existing) return existing
  return { id: apiEl.id, label: apiEl.label, value: apiEl.value }
}

function apiSubgroupToLocal(group: Group, apiSub: ApiSubgroup): Subgroup {
  return {
    elements: apiSub.elements.map(e => apiElementToGroupElement(group, e)),
    isNormal: apiSub.is_normal,
    order: apiSub.order,
    index: group.order / apiSub.order,
    generators: [],
  }
}

// ── Hybrid Functions ────────────────────────────────────────────────────────

export function computeSubgroups(group: Group, cached?: Subgroup[]): Subgroup[] {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localFindAllSubgroups(group)
  }
  return cached ?? []
}

export function computeConjugacyClasses(group: Group, cached?: GroupElement[][]): GroupElement[][] {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localGetConjugacyClasses(group)
  }
  return cached ?? []
}

export function computeCenter(group: Group, cached?: GroupElement[]): GroupElement[] {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localGetGroupCenter(group)
  }
  return cached ?? [group.identity]
}

export function computeIsSimple(group: Group, cachedSubgroups?: Subgroup[]): boolean {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localIsSimpleGroup(group)
  }
  if (cachedSubgroups) {
    const normal = cachedSubgroups.filter(s => s.isNormal && s.order > 1 && s.order < group.order)
    return normal.length === 0
  }
  return false
}

export function computeLattice(
  group: Group,
  cached?: { nodes: unknown[]; edges: unknown[] }
): { nodes: unknown[]; edges: unknown[] } {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localSubgroupLattice(group)
  }
  return cached ?? { nodes: [], edges: [] }
}

// ── Async Backend Fetchers ─────────────────────────────────────────────────

export async function fetchBackendResults(group: Group): Promise<BackendCache> {
  const symbol = group.symbol
  const results: BackendCache = {
    subgroups: null,
    normalSubgroups: null,
    conjugacyClasses: null,
    center: null,
    isSimple: null,
    lattice: null,
    loading: false,
    error: null,
    groupSymbol: symbol,
  }

  if (group.order <= LARGE_ORDER_CUTOFF) return results

  try {
    // Fetch subgroups first (caches on server), then lattice reuses cache
    const subgroupsRes = await fetchSubgroups(symbol)
    results.subgroups = subgroupsRes.subgroups.map(s => apiSubgroupToLocal(group, s))

    const normal = subgroupsRes.subgroups.filter(s => s.is_normal)
    results.normalSubgroups = normal.map(s => apiSubgroupToLocal(group, s))

    results.isSimple = subgroupsRes.subgroups.filter(
      s => s.is_normal && s.order > 1 && s.order < group.order
    ).length === 0

    // Now fetch lattice (reuses cached subgroups on server)
    const [classesRes, centerRes, latticeRes] = await Promise.all([
      fetchConjugacyClasses(symbol),
      fetchCenter(symbol),
      fetchLattice(symbol),
    ])

    results.conjugacyClasses = classesRes.classes.map(cls =>
      cls.map(e => apiElementToGroupElement(group, e))
    )

    results.center = centerRes.center.map(e => apiElementToGroupElement(group, e))

    results.lattice = latticeRes as unknown as { nodes: unknown[]; edges: unknown[] }
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err)
  }

  return results
}

export async function fetchBackendCayleyEdges(
  group: Group,
  actionElementIds: string[],
  multiplyType: 'right' | 'left'
): Promise<CayleyEdgeData[]> {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    return localComputeCayleyEdges(
      group,
      group.elements.filter(e => actionElementIds.includes(e.id)).map(e => ({
        elementId: e.id,
        enabled: true,
        color: '#ff6b6b',
      })),
      multiplyType
    )
  }

  try {
    const res = await fetchCayleyEdges(group.symbol, actionElementIds, multiplyType)
    return res.edges.map((edge: ApiCayleyEdge) => ({
      fromIdx: edge.from_idx,
      toIdx: edge.to_idx,
      fromId: edge.from_id,
      toId: edge.to_id,
      actionElementId: edge.action_element_id,
      color: edge.color,
      isBidirectional: edge.is_bidirectional,
      isSelfLoop: edge.is_self_loop,
    }))
  } catch {
    return []
  }
}

export async function fetchBackendElementOrder(
  group: Group,
  elementId: string
): Promise<{ element: GroupElement; order: number; cycle: GroupElement[] } | null> {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    const el = group.elements.find(e => e.id === elementId)
    if (!el) return null
    const cycle: GroupElement[] = []
    const visited = new Set<string>()
    let current = el
    while (!visited.has(current.id)) {
      visited.add(current.id)
      cycle.push(current)
      current = group.multiply(current, el)
    }
    return { element: el, order: cycle.length, cycle }
  }

  try {
    const res = await fetchElementOrder(group.symbol, elementId)
    const el = group.elements.find(e => e.id === elementId)
    return {
      element: el ?? { id: elementId, label: res.element_label, value: [] },
      order: res.order,
      cycle: res.cycle.map(e => apiElementToGroupElement(group, e)),
    }
  } catch {
    return null
  }
}

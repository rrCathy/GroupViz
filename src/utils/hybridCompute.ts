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
  fetchGroupProperties,
  fetchSeries,
  type ApiSubgroup,
  type ApiElement,
  type ApiCayleyEdge,
  type ApiSeriesFactor,
} from './api'
import { computeGroupProperties as localGroupProperties } from '../core/algebra/properties'
import {
  computeSubgroupSeries,
  SERIES_MAX_ORDER,
  type SeriesType,
  type SubgroupSeries,
  type SeriesFactor,
} from '../core/algebra/series'

export interface ResolvedGroupProperties {
  solvable: boolean
  nilpotent: boolean
  perfect: boolean
  derivedSeriesOrders: number[]
}

const LARGE_ORDER_CUTOFF = 60

// Orders above this are not feasible for the local fallback (pair-join
// subgroup enumeration explodes); they stay unavailable without a backend.
const FALLBACK_CUTOFF = 240

export interface BackendCache {
  subgroups: Subgroup[] | null
  normalSubgroups: Subgroup[] | null
  conjugacyClasses: GroupElement[][] | null
  center: GroupElement[] | null
  isSimple: boolean | null
  isSolvable: boolean | null
  isNilpotent: boolean | null
  isPerfect: boolean | null
  derivedSeriesOrders: number[]
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
    isSolvable: null,
    isNilpotent: null,
    isPerfect: null,
    derivedSeriesOrders: [],
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

export function computeGroupProperties(
  group: Group,
  cached?: BackendCache
): ResolvedGroupProperties | null {
  if (group.order <= LARGE_ORDER_CUTOFF) {
    const local = localGroupProperties(group)
    if (!local) return null
    return {
      solvable: local.solvable,
      nilpotent: local.nilpotent,
      perfect: local.perfect,
      derivedSeriesOrders: local.derivedSeries.map(d => d.length),
    }
  }
  if (!cached || cached.isSolvable === null || cached.isNilpotent === null || cached.isPerfect === null) {
    return null
  }
  return {
    solvable: cached.isSolvable,
    nilpotent: cached.isNilpotent,
    perfect: cached.isPerfect,
    derivedSeriesOrders: cached.derivedSeriesOrders,
  }
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

// ── Local Fallback ──────────────────────────────────────────────────────────

/**
 * Computes every backend result locally. Used when the backend is
 * unreachable/fails. Slow for large orders (findAllSubgroups pair-join),
 * but guaranteed to produce correct results up to FALLBACK_CUTOFF.
 */
export function computeLocalFallbackResults(group: Group): BackendCache {
  const empty = createEmptyBackendCache()
  const results: BackendCache = { ...empty, groupSymbol: group.symbol }
  if (group.order > FALLBACK_CUTOFF) return results

  const subgroups = localFindAllSubgroups(group, true)
  results.subgroups = subgroups
  results.normalSubgroups = subgroups.filter(s => s.isNormal)
  results.isSimple = subgroups.filter(s => s.isNormal && s.order > 1 && s.order < group.order).length === 0
  results.conjugacyClasses = localGetConjugacyClasses(group, true)
  results.center = localGetGroupCenter(group, true)
  results.lattice = localSubgroupLattice(group, true)
  const props = localGroupProperties(group, true)
  if (props) {
    results.isSolvable = props.solvable
    results.isNilpotent = props.nilpotent
    results.isPerfect = props.perfect
    results.derivedSeriesOrders = props.derivedSeries.map(d => d.length)
  }
  return results
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
    isSolvable: null,
    isNilpotent: null,
    isPerfect: null,
    derivedSeriesOrders: [],
    lattice: null,
    loading: false,
    error: null,
    groupSymbol: symbol,
  }

  if (group.order <= LARGE_ORDER_CUTOFF) return results

  try {
    // Fetch subgroups first (caches on server), then lattice reuses cache
    const subgroupsRes = await fetchSubgroups(symbol)
    if (subgroupsRes.truncated || subgroupsRes.subgroups.length === 0) {
      // Backend intentionally skips heavy computation above its cutoff
      // (>120) and returns an empty result with HTTP 200. Treat it as a
      // failure so the local fallback kicks in (up to FALLBACK_CUTOFF).
      throw new Error('backend truncated results (order > 120); using local fallback')
    }
    results.subgroups = subgroupsRes.subgroups.map(s => apiSubgroupToLocal(group, s))

    const normal = subgroupsRes.subgroups.filter(s => s.is_normal)
    results.normalSubgroups = normal.map(s => apiSubgroupToLocal(group, s))

    results.isSimple = subgroupsRes.subgroups.filter(
      s => s.is_normal && s.order > 1 && s.order < group.order
    ).length === 0

    // Now fetch lattice (reuses cached subgroups on server)
    const [classesRes, centerRes, latticeRes, propsRes] = await Promise.all([
      fetchConjugacyClasses(symbol),
      fetchCenter(symbol),
      fetchLattice(symbol),
      fetchGroupProperties(symbol),
    ])

    results.conjugacyClasses = classesRes.classes.map(cls =>
      cls.map(e => apiElementToGroupElement(group, e))
    )

    results.center = centerRes.center.map(e => apiElementToGroupElement(group, e))

    results.lattice = latticeRes as unknown as { nodes: unknown[]; edges: unknown[] }

    results.isSolvable = propsRes.solvable
    results.isNilpotent = propsRes.nilpotent
    results.isPerfect = propsRes.perfect
    results.derivedSeriesOrders = propsRes.derived_series_orders
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err)
    // Backend unreachable/failed — fall back to local computation so the
    // app stays fully functional (slow for large groups, see FALLBACK_CUTOFF).
    const fallback = computeLocalFallbackResults(group)
    results.subgroups = fallback.subgroups
    results.normalSubgroups = fallback.normalSubgroups
    results.conjugacyClasses = fallback.conjugacyClasses
    results.center = fallback.center
    results.isSimple = fallback.isSimple
    results.isSolvable = fallback.isSolvable
    results.isNilpotent = fallback.isNilpotent
    results.isPerfect = fallback.isPerfect
    results.derivedSeriesOrders = fallback.derivedSeriesOrders
    results.lattice = fallback.lattice
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

// ── Backend Series (GAP for large groups) ───────────────────────────────────

/** GAP factor → TeX label (simplified; local computeFactor has more detail). */
export function gapFactorLabel(f: ApiSeriesFactor): string {
  if (f.is_abelian) return `C_{${f.order}}`
  if (f.is_simple && f.order === 60) return 'A_5'
  return `G_{${f.order}}`
}

/**
 * Subgroup series with backend support:
 * - order ≤ SERIES_MAX_ORDER: local computation (as before)
 * - larger groups: GAP via /compute/series + /compute/properties
 *
 * Returns null when the backend is unavailable or fails (UI falls back to
 * the "too large" hint).
 */
export async function fetchBackendSeries(
  group: Group,
  seriesType: SeriesType
): Promise<SubgroupSeries | null> {
  if (group.order <= SERIES_MAX_ORDER) {
    return computeSubgroupSeries(group, seriesType)
  }
  try {
    const [seriesRes, propsRes] = await Promise.all([
      fetchSeries(group.symbol, seriesType),
      fetchGroupProperties(group.symbol),
    ])
    const terms = seriesRes.terms.map(term =>
      term.elements.map(e => apiElementToGroupElement(group, e))
    )
    const identity = group.identity
    // Local derived series always ends at {e}; mirror that for display
    // (only skip when the backend chain already terminates at the identity).
    const last = terms[terms.length - 1]
    if (terms.length > 0 && last.length > 1) {
      terms.push([identity])
    }
    const factors: SeriesFactor[] = seriesRes.factors.map(f => ({
      order: f.order,
      isAbelian: f.is_abelian,
      isSimple: f.is_simple,
      label: gapFactorLabel(f),
    }))
    return {
      type: seriesType,
      terms,
      factors,
      reachesTrivial: terms.length > 0 && terms[terms.length - 1].length === 1,
      reachesFull: terms.length > 0 && terms[0].length === group.order,
      solvable: propsRes.solvable === true,
      nilpotent: propsRes.nilpotent === true,
      alternativeCount: seriesType === 'composition' ? 1 : 0,
      truncated: false,
    }
  } catch {
    return null
  }
}

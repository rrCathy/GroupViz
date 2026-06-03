/**
 * API client for GroupViz backend (FastAPI).
 * 
 * In development, Vite proxies /api requests to localhost:8000.
 * Set VITE_API_BASE to override (e.g. for production).
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail.detail || `API error ${res.status}`)
  }
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApiElement {
  id: string
  label: string
  value: number[]
}

export interface ApiGenerator {
  name: string
  symbol: string
  color: string
}

export interface ApiGroupInfo {
  symbol: string
  name: string
  order: number
  is_abelian: boolean
  exponent: number | null
  elements: ApiElement[]
  generators: ApiGenerator[]
}

export interface ApiSubgroup {
  elements: ApiElement[]
  is_normal: boolean
  order: number
}

export interface ApiSubgroupList {
  subgroups: ApiSubgroup[]
  total_count: number
  truncated?: boolean
  elapsed_ms?: number
}

export interface ApiConjugacyClasses {
  classes: ApiElement[][]
  truncated?: boolean
  elapsed_ms?: number
}

export interface ApiCenter {
  center: ApiElement[]
  elapsed_ms?: number
}

export interface ApiCosets {
  left_cosets: ApiElement[][]
  right_cosets: ApiElement[][]
  is_normal: boolean
  num_cosets: number
  elapsed_ms?: number
}

export interface ApiLatticeNode {
  id: number
  elements: ApiElement[]
  order: number
  is_normal: boolean
  level: number
}

export interface ApiLatticeEdge {
  source: number
  target: number
}

export interface ApiLattice {
  nodes: ApiLatticeNode[]
  edges: ApiLatticeEdge[]
  truncated?: boolean
  elapsed_ms?: number
}

export interface ApiCayleyEdge {
  from_idx: number
  to_idx: number
  from_id: string
  to_id: string
  action_element_id: string
  color: string
  is_bidirectional: boolean
  is_self_loop: boolean
}

export interface ApiCayleyEdges {
  edges: ApiCayleyEdge[]
  elapsed_ms?: number
}

export interface ApiElementOrder {
  element_id: string
  element_label: string
  order: number
  cycle: ApiElement[]
  elapsed_ms?: number
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function fetchGroupInfo(symbol: string): Promise<ApiGroupInfo> {
  return apiPost<ApiGroupInfo>('/group-info', { symbol })
}

export async function fetchSubgroups(symbol: string): Promise<ApiSubgroupList> {
  return apiPost<ApiSubgroupList>('/compute/subgroups', { symbol })
}

export async function fetchNormalSubgroups(symbol: string): Promise<ApiSubgroupList> {
  return apiPost<ApiSubgroupList>('/compute/normal-subgroups', { symbol })
}

export async function fetchConjugacyClasses(symbol: string): Promise<ApiConjugacyClasses> {
  return apiPost<ApiConjugacyClasses>('/compute/conjugacy-classes', { symbol })
}

export async function fetchCenter(symbol: string): Promise<ApiCenter> {
  return apiPost<ApiCenter>('/compute/center', { symbol })
}

export async function fetchCosets(
  symbol: string,
  subgroupElementIds: string[]
): Promise<ApiCosets> {
  return apiPost<ApiCosets>('/compute/cosets', {
    symbol,
    subgroup_element_ids: subgroupElementIds,
  })
}

export async function fetchLattice(symbol: string): Promise<ApiLattice> {
  return apiPost<ApiLattice>('/compute/lattice', { symbol })
}

export async function fetchCayleyEdges(
  symbol: string,
  actionElementIds: string[],
  multiplyType: 'right' | 'left' = 'right'
): Promise<ApiCayleyEdges> {
  return apiPost<ApiCayleyEdges>('/compute/cayley-edges', {
    symbol,
    action_element_ids: actionElementIds,
    multiply_type: multiplyType,
  })
}

export async function fetchElementOrder(
  symbol: string,
  elementId: string
): Promise<ApiElementOrder> {
  return apiPost<ApiElementOrder>('/compute/element-order', {
    symbol,
    element_id: elementId,
  })
}

export async function fetchDirectProduct(
  symbolA: string,
  symbolB: string
): Promise<ApiGroupInfo> {
  return apiPost<ApiGroupInfo>('/compute/direct-product', {
    symbol_a: symbolA,
    symbol_b: symbolB,
  })
}

/** Health check — returns the number of cached groups on the server. */
export async function fetchHealth(): Promise<{ status: string; cached_groups: number }> {
  const res = await fetch(`${API_BASE}/health`)
  return res.json()
}

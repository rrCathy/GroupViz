import type { InternalEdgeData } from './view'

export interface GroupElement {
  id: string
  label: string
  value: number[]
  cosetMemberLabels?: string[]
  cosetInternalEdges?: InternalEdgeData[]
  // Pre-computed normalized layout for the internal Cayley graph of the normal
  // subgroup rendered inside compound quotient nodes. Positions are in [-1, 1]
  // and scaled at render time based on the outer node radius.
  cosetInternalLayout?: { x: number; y: number }[]
}

export interface Generator {
  name: string
  symbol: string
  color: string
  apply(element: GroupElement): GroupElement
  inverse: Generator
}

export interface PresentationTerm {
  g: number
  e: number
}

export interface GroupPresentation {
  generators: string[]
  relators: string[]
  generatorElements?: GroupElement[]
}

export interface Group {
  name: string
  symbol: string
  order: number
  elements: GroupElement[]
  generators: Generator[]
  multiply(a: GroupElement, b: GroupElement): GroupElement
  inverse(element: GroupElement): GroupElement
  identity: GroupElement
  isAbelian: boolean
  exponent?: number
  isoSymbol?: string
  normalSubgroupElementIds?: string[]  // Only for quotient groups: reconstructs the kernel
  automorphismParentSymbol?: string     // Only for automorphism groups: parent group symbol
  _automorphismById?: Map<string, import('../algebra/automorphisms').Automorphism> // Only for automorphism groups
  _semidirectProduct?: { normal: Group; acting: Group; phiMap: Map<string, import('../algebra/automorphisms').Automorphism> } // Only for semidirect products
  presentation?: GroupPresentation // Only for groups built from / carrying a group presentation
}

export interface SemidirectProductSpec {
  normalSymbol: string
  actingSymbol: string
  phiGenMapping: Record<string, string>
}

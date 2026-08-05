export type ViewMode = 'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action'

export type MultiplyType = 'right' | 'left'

export type Layout3D = 'circular' | 'dihedral' | 'spherical' | 'cylinder' | 'torus' | 'tetrahedron' | 'cube' | 'hexagon' | 'cuboctahedron' | 'lattice' | 'truncatedTetrahedron' | 'truncatedCube' | 'rhombicuboctahedron' | 'truncatedOctahedron2' | 'truncatedOctahedron3' | 'truncatedIcosahedron' | 'truncatedDodecahedron'

export type CayleyShape2D = 'grid' | 'circular' | 'spherical' | 'concentric' | 'dualRing' | 'archimedean' | 'spiral' | 'coil' | 'projection3D' | 'rewiring'

export interface InternalEdgeData {
  fromInnerIdx: number
  toInnerIdx: number
  color: string
  isBidirectional: boolean
  actionElementId?: string
  actionLabel?: string
}

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
  _automorphismById?: Map<string, import('./algebra/automorphisms').Automorphism> // Only for automorphism groups
  _semidirectProduct?: { normal: Group; acting: Group; phiMap: Map<string, import('./algebra/automorphisms').Automorphism> } // Only for semidirect products
}

export interface CayleyAction {
  elementId: string
  enabled: boolean
  color: string
}

export interface CayleyEdgeData {
  fromIdx: number
  toIdx: number
  fromId: string
  toId: string
  actionElementId: string
  color: string
  isBidirectional: boolean
  isSelfLoop: boolean
}

export type HomomorphismMap = Map<string, string>

export interface HomomorphismResult {
  isHomomorphism: boolean
  kernel: string[]
  image: string[]
  violation?: {
    a: string
    b: string
    lhs: string
    rhs: string
  }
}

export interface Homomorphism {
  id: string
  source: Group
  target: Group
  mapping: HomomorphismMap
  result?: HomomorphismResult
  name?: string
}

export interface HomomorphismProperties {
  isInjective: boolean
  isSurjective: boolean
  isIsomorphism: boolean
  kernelOrder: number
  imageOrder: number
}

export type GroupActionKind = 'conjugation' | 'custom'

export interface GroupActionArrow {
  generatorId: string | null
  from: number
  to: number
}

export interface OrbitInfo {
  representative: number
  elements: number[]
}

export interface GroupActionComputation {
  n: number
  perms: Map<string, number[]>
  orbits: OrbitInfo[]
  orbitOf: number[]
  stabilizers: Map<number, string[]>
  isHomomorphism: boolean
  violation?: { g: string; a: string; x: number }
}

export interface GroupActionDef {
  kind: GroupActionKind
  setSize?: number
}

export const COLOR_PALETTE: string[] = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa',
  '#f97316', '#06b6d4', '#84cc16', '#f43f5e',
  '#38bdf8', '#a855f7', '#14b8a6', '#eab308',
  '#6366f1', '#ec4899', '#0ea5e9', '#22c55e',
]

export function isQuotientGroup(group: Group): boolean {
  return group.symbol.includes('/N')
}

export function isAutomorphismGroup(group: Group): boolean {
  return 'automorphismParentSymbol' in group && typeof (group as Group).automorphismParentSymbol === 'string' && (group as Group).automorphismParentSymbol !== ''
}

export function isGroupCyclic(group: Group): boolean {
  const sym = group.symbol
  return sym.startsWith('C')
}

export function isGroupDihedral(group: Group): boolean {
  return group.symbol.startsWith('D')
}

export interface DPFactorInfo {
  symbolParts: string[]
  totalFactors: number
  cyclicCount: number
  allCyclic: boolean
  isPipeProduct: boolean
}

export function analyzeDPFactors(group: Group): DPFactorInfo | null {
  if (!isGroupDirectProduct(group)) return null

  const isPipe = group.elements.length > 0 && group.elements[0].id.includes('|')
  const sym = group.symbol

  let parts: string[] = []
  if (sym.includes('\\times')) {
    parts = sym.split('\\times').map(s => s.trim())
  } else if (sym.includes('^{')) {
    const supMatch = sym.match(/^(.+)\^\{(\d+)\}$/)
    if (supMatch) {
      const count = parseInt(supMatch[2], 10)
      parts = Array(count).fill(supMatch[1])
    }
  }

  if (parts.length === 0 && isPipe) {
    const tokenCount = group.elements[0].id.split('|').length
    parts = Array(tokenCount).fill('unknown')
  }

  if (parts.length === 0) return null

  const cyclicCount = parts.filter(p => p.startsWith('C') || p.startsWith('Z_')).length

  return {
    symbolParts: parts,
    totalFactors: parts.length,
    cyclicCount,
    allCyclic: cyclicCount === parts.length,
    isPipeProduct: isPipe,
  }
}

export function isGroupDirectProduct(group: Group): boolean {
  const sym = group.symbol
  if (sym.includes('\\rtimes')) return false
  if (sym.includes('\\times') || sym.includes('^{')) return true
  if (group.elements.length > 0 && group.elements[0].id.includes('|')) return true
  return false
}

export function isGroupSemidirectProduct(group: Group): boolean {
  return group.symbol.includes('\\rtimes')
}

export interface SemidirectProductSpec {
  normalSymbol: string
  actingSymbol: string
  phiGenMapping: Record<string, string>
}

export function isCyclicFactorKeys(keys: string[]): boolean {
  if (keys.length === 0) return false
  const vecs = keys.map(k => k.split(',').map(Number))
  const allBits = vecs.every(v => v.length > 0 && v.every(x => x === 0 || x === 1))
  if (allBits) return true
  const nums = keys.map(Number)
  if (nums.every((n, i) => !isNaN(n) && n === i)) return true
  return false
}

export function getAvailableShapes3D(group: Group): Layout3D[] {
  if (isQuotientGroup(group)) return []
  const sym = group.symbol
  const shapes: Layout3D[] = ['spherical']

  if (isGroupSemidirectProduct(group)) {
    shapes.push('lattice', 'torus', 'circular')
    return shapes
  }

  if (isGroupDirectProduct(group)) {
    const info = analyzeDPFactors(group)
    if (info) {
      if (info.allCyclic) {
        shapes.push('lattice', 'circular')
      } else if (info.totalFactors === 2) {
        if (info.cyclicCount === 1) {
          shapes.push('cylinder', 'lattice', 'circular')
        } else {
          shapes.push('torus', 'lattice', 'circular')
        }
      } else {
        shapes.push('lattice', 'torus', 'circular')
      }
    } else {
      shapes.push('lattice', 'torus', 'circular')
    }
    return shapes
  }

  if (isGroupCyclic(group)) {
    shapes.push('circular')
    return shapes
  }

  if (isGroupDihedral(group)) {
    shapes.push('dihedral', 'circular')
    return shapes
  }

  if (group.isAbelian) {
    shapes.push('circular')
    if (group.order === 4) shapes.push('tetrahedron')
    return shapes
  }

  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') {
    shapes.push('circular', 'hexagon')
  } else if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') {
    shapes.push('circular', 'truncatedCube', 'rhombicuboctahedron', 'truncatedOctahedron2', 'truncatedOctahedron3')
  } else if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') {
    shapes.push('cube')
  } else if (sym === 'A_{4}' || sym === 'A4') {
    shapes.push('circular', 'truncatedTetrahedron')
  } else if (sym === 'A_{5}' || sym === 'A5') {
    shapes.push('circular', 'truncatedIcosahedron', 'truncatedDodecahedron')
  } else if (sym.startsWith('A')) {
    shapes.push('circular')
  } else if (sym.startsWith('S')) {
    shapes.push('circular')
  }

  return shapes
}

export function getDefaultLayout3D(group: Group): Layout3D {
  if (isQuotientGroup(group)) return 'spherical'
  if (isGroupSemidirectProduct(group)) return 'lattice'
  if (isGroupDirectProduct(group)) {
    const info = analyzeDPFactors(group)
    if (info) {
      if (info.allCyclic) return 'lattice'
      if (info.totalFactors === 2) {
        if (info.cyclicCount === 1) return 'cylinder'
        return 'torus'
      }
      return 'lattice'
    }
    return 'lattice'
  }
  if (isGroupDihedral(group)) return 'dihedral'
  if (isGroupCyclic(group)) return 'circular'
  if (group.isAbelian) return 'circular'
  const sym = group.symbol
  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') return 'hexagon'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'cube'
  if (sym === 'A_{4}' || sym === 'A4') return 'truncatedTetrahedron'
  if (sym === 'A_{5}' || sym === 'A5') return 'truncatedIcosahedron'
  if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') return 'truncatedCube'
  if (sym.startsWith('S') || sym.startsWith('A')) return 'circular'
  return 'spherical'
}

export function getDefaultShape2D(group: Group): CayleyShape2D {
  if (isQuotientGroup(group)) return 'circular'
  // Semidirect product: coset layout of N across H — the "rewiring" shape
  if (isGroupSemidirectProduct(group)) return 'rewiring'
  if (isGroupDirectProduct(group)) return 'grid'
  const sym = group.symbol
  const n = group.order
  if (sym === 'S_{3}' || sym === 'S_{4}' || sym === 'S_{5}' || sym === 'S3' || sym === 'S4' || sym === 'S5' || sym === 'S₃' || sym === 'S₄' || sym === 'S₅') return 'projection3D'
  if (sym === 'A_{5}' || sym === 'A5') return 'projection3D'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'projection3D'
  if (sym.startsWith('S') || (sym.startsWith('A') && n >= 12)) return 'projection3D'
  if (isGroupCyclic(group)) return 'spiral'
  if (isGroupDihedral(group)) return 'dualRing'
  if (n > 30 && !isGroupCyclic(group)) return 'archimedean'
  return 'circular'
}

export function getAvailableShapesForView(group: Group | null, view: ViewMode): CayleyShape2D[] {
  if (!group) return ['circular']
  if (view === 'cayley') {
    if (isQuotientGroup(group)) {
      return ['circular']
    }
    if (isGroupSemidirectProduct(group)) {
      return ['rewiring', 'circular', 'spherical', 'concentric']
    }
    if (isGroupCyclic(group) && !isGroupDirectProduct(group)) {
      return ['circular', 'spherical', 'spiral', 'coil']
    }
    if (isGroupDihedral(group)) {
      return ['circular', 'spherical', 'dualRing']
    }
    const shapes: CayleyShape2D[] = ['circular']
    const sym = group.symbol
    const isSA = sym.startsWith('S') || sym.startsWith('A')
    const isSpecial = sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈'
    if (isSA || isSpecial) {
      shapes.push('projection3D')
    }
    if (isGroupDirectProduct(group)) shapes.push('grid')
    shapes.push('spherical')
    if (!isSA && !isSpecial) shapes.push('archimedean')
    if (!isGroupDirectProduct(group) && !isSA && !isSpecial) shapes.push('concentric')
    return shapes
  }
  // set, cycle, and other views have a single default layout
  return ['circular']
}

export interface CanvasTransform {
  x: number
  y: number
  scale: number
}

export interface NodePosition {
  x: number
  y: number
}

export interface SubgroupCheckResult {
  type: 'subgroup' | 'normal-subgroup' | 'subset'
  label: string
  color: string
}

export type SubgroupCheckType = SubgroupCheckResult['type']

export interface Subset {
  id: string
  elementIds: string[]
  label: string
  color: string
  isSubgroup: boolean
  isNormalSubgroup: boolean
  type: 'subset' | 'subgroup' | 'normal-subgroup'
}

export const SUBSET_COLORS: string[] = [
  '#ff6b6b', '#4ecdc4', '#84cc16', '#a78bfa',
  '#f97316', '#38bdf8', '#f43f5e', '#eab308',
]

export const COSET_COLORS: string[] = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#84cc16',
  '#a78bfa', '#f97316', '#38bdf8', '#f43f5e',
  '#eab308', '#6366f1', '#ec4899', '#14b8a6',
  '#0ea5e9', '#22c55e', '#a855f7', '#06b6d4',
]

export interface FloatingView {
  id: string
  view: ViewMode
  title: string
}




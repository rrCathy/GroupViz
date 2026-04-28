export type ViewMode = 'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice'

export type MultiplyType = 'right' | 'left'

export type Layout3D = 'circular' | 'dihedral' | 'spherical' | 'tetrahedron' | 'cube' | 'hexagon' | 'cuboctahedron' | 'lattice' | 'truncatedTetrahedron' | 'truncatedCube' | 'rhombicuboctahedron' | 'truncatedOctahedron2' | 'truncatedOctahedron3' | 'truncatedIcosahedron' | 'truncatedDodecahedron'

export interface GroupElement {
  id: string
  label: string
  value: number[]
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
}

export interface GroupAction {
  elementId: string
  enabled: boolean
  color: string
}

export interface CayleyGraphConfig {
  multiplyType: MultiplyType
  actions: GroupAction[]
  forceLayout: boolean
  shape3D: Layout3D
  availableShapes3D: Layout3D[]
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

export const COLOR_PALETTE: string[] = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa',
  '#f97316', '#06b6d4', '#84cc16', '#f43f5e',
  '#38bdf8', '#a855f7', '#14b8a6', '#eab308',
  '#6366f1', '#ec4899', '#0ea5e9', '#22c55e',
]

export function isGroupCyclic(group: Group): boolean {
  const sym = group.symbol
  return sym.startsWith('C')
}

export function isGroupDihedral(group: Group): boolean {
  return group.symbol.startsWith('D')
}

export function isGroupDirectProduct(group: Group): boolean {
  const sym = group.symbol
  return sym.includes('×') || sym.includes('²') || sym.includes('³') || sym.includes('⁴')
}

export function getAvailableShapes3D(group: Group): Layout3D[] {
  const sym = group.symbol
  const shapes: Layout3D[] = ['spherical']

  if (isGroupCyclic(group)) {
    shapes.push('circular')
    return shapes
  }

  if (isGroupDihedral(group)) {
    shapes.push('dihedral', 'circular')
    return shapes
  }

  if (isGroupDirectProduct(group)) {
    shapes.push('lattice', 'circular')
    return shapes
  }

  if (group.isAbelian) {
    shapes.push('circular')
    if (group.order === 4) shapes.push('tetrahedron')
    return shapes
  }

  if (sym === 'S₃' || sym === 'S3') {
    shapes.push('circular', 'hexagon')
  } else if (sym === 'S₄' || sym === 'S4') {
    shapes.push('circular', 'truncatedCube', 'rhombicuboctahedron', 'truncatedOctahedron2', 'truncatedOctahedron3')
  } else if (sym === 'Q₈' || sym === 'Q8') {
    shapes.push('cube')
  } else if (sym === 'A4') {
    shapes.push('circular', 'truncatedTetrahedron')
  } else if (sym === 'A5') {
    shapes.push('circular', 'truncatedIcosahedron', 'truncatedDodecahedron')
  } else if (sym.startsWith('A')) {
    shapes.push('circular')
  } else if (sym.startsWith('S')) {
    shapes.push('circular')
  }

  return shapes
}

export function getDefaultLayout3D(group: Group): Layout3D {
  if (isGroupDihedral(group)) return 'dihedral'
  if (isGroupCyclic(group)) return 'circular'
  if (isGroupDirectProduct(group)) return 'lattice'
  if (group.isAbelian) return 'circular'
  const sym = group.symbol
  if (sym === 'S₃' || sym === 'S3') return 'hexagon'
  if (sym === 'Q₈' || sym === 'Q8') return 'cube'
  if (sym === 'A4') return 'truncatedTetrahedron'
  if (sym === 'A5') return 'truncatedIcosahedron'
  if (sym === 'S4') return 'truncatedCube'
  if (sym.startsWith('S') || sym.startsWith('A')) return 'circular'
  return 'spherical'
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

export interface FloatingView {
  id: string
  view: ViewMode
  title: string
}

export interface CayleyEdge {
  from: number
  to: number
  generator: Generator
}
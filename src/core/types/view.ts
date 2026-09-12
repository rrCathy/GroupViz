export type ViewMode = 'set' | 'cayley' | 'cycle' | 'table' | 'heatmap' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action' | 'sylow' | 'tree' | 'prestable'

export type MultiplyType = 'right' | 'left'

export const LAYOUTS_3D = [
  'cone', 'circular', 'dihedral', 'cylinder', 'torus', 'tetrahedron', 'cube', 'hexagon',
  'cuboctahedron', 'lattice', 'semidirectCylinder', 'truncatedTetrahedron', 'truncatedCube',
  'rhombicuboctahedron', 'truncatedOctahedron2', 'truncatedOctahedron3', 'truncatedIcosahedron',
  'truncatedDodecahedron', 'hypercube', 'wordLengthSphere',
] as const

export type Layout3D = typeof LAYOUTS_3D[number]

export const CAYLEY_SHAPES_2D = [
  'cone', 'grid', 'circular', 'concentric', 'dualRing', 'archimedean', 'spiral', 'coil',
  'projection3D', 'rewiring', 'cylinder', 'torus', 'ringGrid', 'pythagoreanSquare',
] as const

export type CayleyShape2D = typeof CAYLEY_SHAPES_2D[number]

/**
 * 子群格名片的细节档（LOD = level of detail）。三档由"名片的屏幕宽度"自动判定
 * （latticeLodTier），参数里可显式指定；'auto' 表示跟随窗口尺寸与缩放。
 *  - full：完整名片（|H|=n + 正规/平凡副行 + Z(G)/Sylow/系列角标）
 *  - compact：胶囊，只留结构符号或阶
 *  - dots：圆点，仅颜色编码类别
 */
export const LATTICE_LOD_TIERS = ['full', 'compact', 'dots'] as const

export type LatticeLodTier = typeof LATTICE_LOD_TIERS[number]

export const LATTICE_LABEL_DETAILS = ['auto', ...LATTICE_LOD_TIERS] as const

export type LatticeLabelDetail = typeof LATTICE_LABEL_DETAILS[number]

export interface InternalEdgeData {
  fromInnerIdx: number
  toInnerIdx: number
  color: string
  isBidirectional: boolean
  actionElementId?: string
  actionLabel?: string
}

export interface CayleyAction {
  elementId: string
  enabled: boolean
  color: string
  /** 该作用元素对应边的长度倍率（1 = 原始布局；见 VCL 逐生成元边长）。
   *  固定几何布局经 relaxEdgeLengths 后处理，力导向布局作为弹簧静止长度倍率 */
  lengthScale?: number
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

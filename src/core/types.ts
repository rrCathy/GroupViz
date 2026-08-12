export type ViewMode = 'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action' | 'sylow' | 'tree' | 'prestable'

export type MultiplyType = 'right' | 'left'

export type Layout3D = 'circular' | 'dihedral' | 'spherical' | 'cylinder' | 'torus' | 'tetrahedron' | 'cube' | 'hexagon' | 'cuboctahedron' | 'lattice' | 'semidirectCylinder' | 'truncatedTetrahedron' | 'truncatedCube' | 'rhombicuboctahedron' | 'truncatedOctahedron2' | 'truncatedOctahedron3' | 'truncatedIcosahedron' | 'truncatedDodecahedron'

export type CayleyShape2D = 'grid' | 'circular' | 'spherical' | 'concentric' | 'dualRing' | 'archimedean' | 'spiral' | 'coil' | 'projection3D' | 'rewiring' | 'cylinder' | 'torus' | 'pythagoreanSquare'

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
  _automorphismById?: Map<string, import('./algebra/automorphisms').Automorphism> // Only for automorphism groups
  _semidirectProduct?: { normal: Group; acting: Group; phiMap: Map<string, import('./algebra/automorphisms').Automorphism> } // Only for semidirect products
  presentation?: GroupPresentation // Only for groups built from / carrying a group presentation
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

export type GroupActionKind = 'conjugation' | 'custom' | 'sylow' | 'regular' | 'coset'

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
  // Point labels for the acted-upon set (e.g. Sylow subgroups "P₁", ...)
  setLabels?: string[]
}

export interface GroupActionDef {
  kind: GroupActionKind
  setSize?: number
  prime?: number
  // For the coset action G ↷ G/H: left cosets are taken with respect to this subgroup.
  subgroupElements?: GroupElement[]
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
  // 纯循环符号直接判定（兼容无元素数据的测试群）
  if (/^C_\{\d+\}$/.test(sym) || /^C\d+$/.test(sym)) return true
  // 复合符号（直积/半直积等）：存在 n 阶元素 ⇔ 群循环
  if (sym.startsWith('C') || sym.startsWith('Z_')) {
    const n = group.order
    if (n <= 1) return true
    if (group.elements.length === 0) return false
    const id = group.identity
    for (const el of group.elements) {
      if (el.id === id.id) continue
      let cur = id
      for (let k = 0; k <= n; k++) {
        cur = group.multiply(cur, el)
        if (cur.id === id.id) {
          if (k + 1 === n) return true
          break
        }
      }
    }
  }
  return false
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

export interface DPFactorGrouped2DInfo {
  /** 归组后的因子 part 文本（不展开幂），如 'C_{2}^{2}'、'S_{3}' */
  parts: string[]
  /** 每归组因子是否循环（base 为循环前缀且合并段数 === 1） */
  cyclic: boolean[]
  count: number
  cyclicCount: number
  allCyclic: boolean
}

/**
 * 2D 直积分类用的归组因子分析（规则 1：C2×C2 视为一个非循环因子）。
 * 相邻同底循环 part 合并为紧凑幂（C_{2}×C_{2}→C_{2}^{2}，合并段数 > 1 → 非循环，
 * 即 C2²≅V₄ 视为非循环因子）；非循环 part 永不合并（S₃×S₃ 保持 2 因子）。
 * 不展开 '^{n}' 幂。与 ringOrder.parseCompactFactors 语义一致但不依赖其实现。
 */
export function analyzeDPFactorsGrouped2D(group: Group): DPFactorGrouped2DInfo | null {
  if (!isGroupDirectProduct(group)) return null

  const isPipe = group.elements.length > 0 && group.elements[0].id.includes('|')
  const sym = group.symbol

  let parts: string[] = []
  if (sym.includes('\\times')) {
    parts = sym.split('\\times').map(s => s.trim()).filter(Boolean)
  } else if (sym.includes('^{')) {
    parts = [sym]
  }

  if (parts.length === 0 && isPipe) {
    const tokenCount = group.elements[0].id.split('|').length
    parts = Array(tokenCount).fill('unknown')
  }

  if (parts.length === 0) return null

  interface GroupedPart {
    base: string
    segs: number
  }
  const grouped: GroupedPart[] = []
  for (const p of parts) {
    const m = p.match(/^(.+)\^\{(\d+)\}$/)
    const base = m ? m[1] : p
    const segs = m ? Number(m[2]) : 1
    const cycBase = base.startsWith('C') || base.startsWith('Z_')
    const last = grouped[grouped.length - 1]
    if (cycBase && segs === 1 && last && last.base === base) {
      last.segs += segs
    } else {
      grouped.push({ base, segs })
    }
  }

  const partsOut = grouped.map(g => (g.segs === 1 ? g.base : `${g.base}^{${g.segs}}`))
  const cyclic = grouped.map(g => (g.base.startsWith('C') || g.base.startsWith('Z_')) && g.segs === 1)
  const cyclicCount = cyclic.filter(Boolean).length

  return {
    parts: partsOut,
    cyclic,
    count: grouped.length,
    cyclicCount,
    allCyclic: cyclicCount === grouped.length,
  }
}

/**
 * 判断 symbol 中是否有顶层（不在括号内）的 \times。
 * '(Z_{4} \times Z_{2}) : Z_{2}' → false（半直积记号内的直积）；
 * 'C_{2} \times (C_{3}:C_{2})' → true（顶层直积）。
 */
export function hasTopLevelTimes(symbol: string): boolean {
  let depth = 0
  for (let i = 0; i < symbol.length; i++) {
    const ch = symbol[i]
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === '\\' && symbol.startsWith('times', i + 1) && depth === 0) return true
  }
  return false
}

export function isGroupDirectProduct(group: Group): boolean {
  const sym = group.symbol
  if (sym.startsWith('\\langle')) return false
  if (sym.includes('\\rtimes')) return false
  if (hasTopLevelTimes(sym) || sym.includes('^{')) return true
  if (group.elements.length > 0 && group.elements[0].id.includes('|')) return true
  return false
}

export function isGroupPresentation(group: Group): boolean {
  return group.symbol.startsWith('\\langle')
}

/**
 * 判断 symbol 中是否有顶层（不在括号内）的 ':'（GAP 半直积记号 N : H）。
 * '(C_{4} \times C_{2}) : C_{2}' → true；
 * 'C_{2} \times (C_{3} : C_{2})' → false（顶层是直积，':' 在括号内）。
 */
export function hasTopLevelColon(symbol: string): boolean {
  let depth = 0
  for (let i = 0; i < symbol.length; i++) {
    const ch = symbol[i]
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ':' && depth === 0) return true
  }
  return false
}

export function isGroupSemidirectProduct(group: Group): boolean {
  const sym = group.symbol
  return sym.includes('\\rtimes') || hasTopLevelColon(sym)
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
    shapes.push('semidirectCylinder', 'lattice', 'torus', 'circular')
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
  if (isGroupSemidirectProduct(group)) {
    if (group.symbol === 'C_{3}:C_{4}') return 'semidirectCylinder'
    return 'lattice'
  }
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

export function classifyDirectProduct2D(group: Group): CayleyShape2D {
  if (!isGroupDirectProduct(group)) return 'grid'
  // 归组规则：相邻同底循环因子合并（C2×C2→C2² 视为非循环因子 V₄）
  const info = analyzeDPFactorsGrouped2D(group)
  if (!info) return 'grid'
  if (info.count <= 1) return 'grid'
  if (info.allCyclic) return 'grid'
  // 全非循环因子 → torus（不限因子数，3+ 因子嵌套甜甜圈）
  if (info.cyclicCount === 0) return 'torus'
  // 含循环 + 含非循环因子 → cylinder（多循环因子沿径向层叠）
  return 'cylinder'
}

/** C₂³ (elementary abelian 8-group): order 8, non-cyclic, every element of order 2. */
export function isC2Cube(group: Group): boolean {
  if (!group || group.order !== 8 || isGroupCyclic(group)) return false
  if (!group.elements || group.elements.length !== group.order) return false
  const id = group.identity
  for (const el of group.elements) {
    if (el.id === id.id) continue
    if (group.multiply(el, el).id !== id.id) return false
  }
  return true
}

export function getDefaultShape2D(group: Group): CayleyShape2D {
  if (isQuotientGroup(group)) return 'circular'
  // 7 阶（含）以内所有群只需圆形
  if (group.order <= 7) return 'circular'
  // Semidirect product: coset layout of N across H — the "rewiring" shape
  if (isGroupSemidirectProduct(group)) return 'rewiring'
  // C₂³ 摆成 D₄ 风格双环（优先于直积分类）
  if (isC2Cube(group)) return 'dualRing'
  if (isGroupDirectProduct(group)) return classifyDirectProduct2D(group)
  const sym = group.symbol
  const n = group.order
  if (sym === 'S_{3}' || sym === 'S_{4}' || sym === 'S_{5}' || sym === 'S3' || sym === 'S4' || sym === 'S5' || sym === 'S₃' || sym === 'S₄' || sym === 'S₅') return 'projection3D'
  if (sym === 'A_{5}' || sym === 'A5') return 'projection3D'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'pythagoreanSquare'
  if (sym.startsWith('S') || (sym.startsWith('A') && n >= 12)) return 'projection3D'
    if (isGroupCyclic(group)) {
      // 循环群凯莱图 = 单生成元多边形，圆形布局弧长均匀无交叉；
      // 螺旋（spiral/coil）仅作手动可选形状，不做默认（C16 等大循环会显得杂乱）
      return 'circular'
    }
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
    // 7 阶（含）以内所有群只需圆形
    if (group.order <= 7) {
      return ['circular']
    }
    if (isGroupSemidirectProduct(group)) {
      return ['rewiring', 'circular', 'spherical', 'concentric']
    }
    if (isC2Cube(group)) {
      return ['circular', 'dualRing', 'grid']
    }
    if (isGroupCyclic(group) && !isGroupDirectProduct(group)) {
      // C9/C10 只需圆形
      if (group.order === 9 || group.order === 10) {
        return ['circular']
      }
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
      shapes.push(isSpecial ? 'pythagoreanSquare' : 'projection3D')
    }
    if (isGroupDirectProduct(group)) {
      const cls = classifyDirectProduct2D(group)
      if (cls !== 'grid') shapes.push(cls)
      shapes.push('grid')
    }
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




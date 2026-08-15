export type ViewMode = 'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action' | 'sylow' | 'tree' | 'prestable'

export type MultiplyType = 'right' | 'left'

export type Layout3D = 'circular' | 'dihedral' | 'spherical' | 'cylinder' | 'torus' | 'tetrahedron' | 'cube' | 'hexagon' | 'cuboctahedron' | 'lattice' | 'semidirectCylinder' | 'truncatedTetrahedron' | 'truncatedCube' | 'rhombicuboctahedron' | 'truncatedOctahedron2' | 'truncatedOctahedron3' | 'truncatedIcosahedron' | 'truncatedDodecahedron' | 'hypercube'

export type CayleyShape2D = 'grid' | 'circular' | 'spherical' | 'concentric' | 'dualRing' | 'archimedean' | 'spiral' | 'coil' | 'projection3D' | 'rewiring' | 'cylinder' | 'torus' | 'ringGrid' | 'pythagoreanSquare'

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

/**
 * Named semidirect-product groups (GAP StructureDescription has no ':')
 * that benefit from the rewiring shape. These groups carry no ':' in their
 * symbol so isGroupSemidirectProduct is false, yet their canonical structure
 * is a semidirect product N⋊H, recovered by getSemidirectProductMeta.
 *   QD16      = SmallGroup(16,8)  ≈ C₈⋊C₂ (cyclic normal)
 *   (C₄×C₂):C₂ = SmallGroup(16,13) ≈ (C₄×C₂)⋊C₂ (abelian normal)
 */
export function isNamedRewiringGroup(group: Group): boolean {
  if (group.order > 60) return false
  // QD16 专名；其余为符号冲突回退类（symbol 被替换为 SmallGroup(n,i) 的注册表群，
  // 如 (20,3) ≈ C₅⋊C₄、(16,13) ≈ (C₄×C₂)⋊C₂），结构均为半直积，走重布线形状
  return group.symbol === 'QD_{16}' || group.symbol.startsWith('SmallGroup(')
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

  if (isGroupSemidirectProduct(group) || isNamedRewiringGroup(group)) {
    // lattice/torus 依赖直积因子结构，半直积群布局失败会静默球化 → 不提供
    shapes.push('semidirectCylinder', 'circular')
    return shapes
  }

  if (isGroupDirectProduct(group)) {
    // 归组分类（相邻同底循环合并 C₂×C₂→C₂² 视为非循环因子），与 2D classifyDirectProduct2D 对齐
    const info = analyzeDPFactorsGrouped2D(group)
    if (info) {
      if (info.count <= 1 || info.allCyclic) {
        shapes.push('lattice', 'circular')
      } else if (info.cyclicCount === 0) {
        shapes.push('lattice', 'torus', 'circular')
      } else {
        // 含循环 + 非循环因子：cylinder（多循环因子轴向堆叠，任意因子数）
        shapes.push('cylinder', 'lattice', 'circular')
      }
    } else {
      shapes.push('lattice', 'torus', 'circular')
    }
    if (isC2Cube(group)) shapes.push('cube')
    if (isC2Tesseract(group)) shapes.push('hypercube')
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
    // C₂³ 凯莱图 = 立方体（8 顶点标准立方体网格）
    if (isC2Cube(group)) shapes.push('cube')
    // C₂⁴ 凯莱图 = 超立方体（16 顶点内外立方体同心投影）
    if (isC2Tesseract(group)) shapes.push('hypercube')
    if (group.order === 4) shapes.push('tetrahedron')
    return shapes
  }

  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') {
    shapes.push('circular', 'hexagon')
  } else if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') {
    shapes.push('circular', 'truncatedCube', 'rhombicuboctahedron', 'truncatedOctahedron2', 'truncatedOctahedron3')
  } else if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') {
    shapes.push('cube')
  } else if (sym === 'Q_{16}' || sym === 'Q16' || sym === 'Q₁₆') {
    // Q₁₆（广义四元数群，GE 记为 Q₈）：⟨b⟩-陪集圆柱（GE 风格）
    shapes.push('semidirectCylinder')
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
  // 半直积默认 N⋊H 圆柱（N 环 + H 沿轴，对应 2D rewiring 的 3D 形态）
  if (isGroupSemidirectProduct(group) || isNamedRewiringGroup(group)) return 'semidirectCylinder'
  // C₂³ 凯莱图 = 立方体（优先于直积/阿贝尔分类）
  if (isC2Cube(group)) return 'cube'
  // C₂⁴ 凯莱图 = 超立方体（16 顶点内外立方体同心投影）
  if (isC2Tesseract(group)) return 'hypercube'
  if (isGroupDirectProduct(group)) {
    const info = analyzeDPFactorsGrouped2D(group)
    if (info) {
      if (info.count <= 1 || info.allCyclic) return 'lattice'
      if (info.cyclicCount === 0) return 'torus'
      return 'cylinder'
    }
    return 'lattice'
  }
  if (isGroupDihedral(group)) return 'dihedral'
  if (isGroupCyclic(group)) return 'circular'
  if (group.isAbelian) return 'circular'
  const sym = group.symbol
  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') return 'hexagon'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'cube'
  if (sym === 'Q_{16}' || sym === 'Q16' || sym === 'Q₁₆') return 'semidirectCylinder'
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

/** C₂⁴ (elementary abelian 16-group): order 16, non-cyclic, every element of order 2. */
export function isC2Tesseract(group: Group): boolean {
  if (!group || group.order !== 16 || isGroupCyclic(group)) return false
  if (!group.elements || group.elements.length !== group.order) return false
  const id = group.identity
  for (const el of group.elements) {
    if (el.id === id.id) continue
    if (group.multiply(el, el).id !== id.id) return false
  }
  return true
}

/** 球面投影（projection3D）仅适配少数置换群：S₃/S₄/S₅/A₄/A₅。 */
const PROJECTION_3D_SYMBOLS = new Set([
  'S_{3}', 'S_{4}', 'S_{5}', 'S3', 'S4', 'S5', 'S₃', 'S₄', 'S₅',
  'A_{4}', 'A4', 'A_{5}', 'A5',
])
export function isProjection3DGroup(group: Group): boolean {
  return PROJECTION_3D_SYMBOLS.has(group.symbol)
}

export interface RingGridDecomposition {
  ringGen: GroupElement // 环生成元（阶 n，x 幂环）
  v1: GroupElement // 网格生成元 1（阶 p）
  v2: GroupElement // 网格生成元 2（阶 p）
  n: number // 环点数（阶）
  p?: number // 网格素数（2 → 2×2 网格，3 → 3×3 网格），缺省 2
  map: Map<string, { i: number; v: GroupElement }> // 元素 id → (环幂 i, 网格元素 v)
}

/**
 * 环网格（ring grid）分解探测：寻找 G ≅ Cₙ × C_p² 的直积分解——
 * 环生成元 x（阶 n ≥ 3）+ 网格 V = C_p²（v1, v2 为相异阶 p 元素，p ∈ {2,3}），
 * 要求 ⟨x⟩·V 无重复覆盖全群（唯一分解，蕴含真正的直积结构，非交换群自动失败）。
 * 纯群论实现：pipe 直积群、注册表 GAP 表群、同构群统一走同一条路。
 * 示例：C₄×C₂×C₂ → x 阶 4、V = C₂²；C₆×C₂×C₂ → x 阶 6；C₃³ → x 阶 3、V = C₃²。
 */
export function findRingGridDecomposition(group: Group): RingGridDecomposition | null {
  if (!group || !group.elements || group.elements.length !== group.order || group.order < 16) {
    return null
  }
  // 环网格仅用于 ≥3 个循环群因子的直积（Cₙ×C_p² 型）；两因子直积
  // （如 C₁₀×C₂）虽可能有 C₅×V₄ 分解，但走 grid/cylinder 更合适。
  const isCyclicBase = (base: string): boolean =>
    /^C_\{\s*\d+\s*\}$/.test(base) || /^Z_\{\s*\d+\s*\}$/.test(base)
  let cyclicCount = 0
  if (group.symbol.includes('\\times')) {
    for (const p of group.symbol.split('\\times').map(s => s.trim()).filter(Boolean)) {
      const m = p.match(/^(.+)\^\{(\d+)\}$/)
      const base = m ? m[1] : p
      const segs = m ? Number(m[2]) : 1
      if (isCyclicBase(base)) cyclicCount += segs
    }
  } else {
    // 纯幂紧凑符号（直积面板幂合并，如 C_{2}^{4}、C_{3}^{3}）：整体展开
    const sup = group.symbol.match(/^(.+)\^\{(\d+)\}$/)
    if (sup && isCyclicBase(sup[1])) cyclicCount += Number(sup[2])
  }
  if (cyclicCount < 3) return null
  const idId = group.identity.id
  const orderOf = (el: GroupElement): number => {
    let cur = el
    let k = 2
    while (k <= group.order && cur.id !== idId) {
      cur = group.multiply(cur, el)
      k++
    }
    return cur.id === idId ? k - 1 : group.order
  }
  // 网格素数 p：p=2 为 2×2 网格（原行为），p=3 支持 C₃³ 等 3×3 网格
  for (const p of [2, 3]) {
    const pSq = p * p
    const n = group.order / pSq
    if (!Number.isInteger(n) || n < 3) continue
    const pEls = group.elements.filter(e => e.id !== idId && orderOf(e) === p)
    if (pEls.length < 2) continue
    for (let a = 0; a < pEls.length; a++) {
      for (let b = a + 1; b < pEls.length; b++) {
        const v1 = pEls[a]
        const v2 = pEls[b]
        // 交换性（真直积前提）
        if (group.multiply(v1, v2).id !== group.multiply(v2, v1).id) continue
        // 独立性：v1 ∉ ⟨v2⟩（素数阶下等价于 v1 ≠ v2^i, 1 ≤ i < p）
        let dependent = false
        let cur = v2
        for (let i = 1; i < p; i++) {
          if (cur.id === v1.id) {
            dependent = true
            break
          }
          cur = group.multiply(cur, v2)
        }
        if (dependent) continue
        // 网格元素 V = { v1^i · v2^j | 0 ≤ i,j < p }，index = i*p + j
        const vArr: GroupElement[] = []
        for (let i = 0; i < p; i++) {
          let rowEl = group.identity
          for (let k = 0; k < i; k++) rowEl = group.multiply(rowEl, v1)
          for (let j = 0; j < p; j++) {
            let el = rowEl
            for (let k = 0; k < j; k++) el = group.multiply(el, v2)
            vArr.push(el)
          }
        }
        for (const cand of group.elements) {
          if (cand.id === idId || vArr.some(v => v.id === cand.id)) continue
          if (orderOf(cand) !== n) continue
          const map = new Map<string, { i: number; v: GroupElement }>()
          let cur2 = group.identity
          let covered = true
          for (let i = 0; i < n && covered; i++) {
            for (const v of vArr) {
              const el = group.multiply(cur2, v)
              if (map.has(el.id)) {
                covered = false
                break
              }
              map.set(el.id, { i, v })
            }
            cur2 = group.multiply(cur2, cand)
          }
          if (covered && map.size === group.order) {
            // 交换性检查：需为真直积 G ≅ Cₙ × V（x 与 v1/v2 交换）。
            // 非交换群（如 C₂×D₄）可能有唯一集合分解但乘法结构不是直积，拒绝。
            const commutes =
              group.multiply(cand, v1).id === group.multiply(v1, cand).id &&
              group.multiply(cand, v2).id === group.multiply(v2, cand).id
            if (commutes) return { ringGen: cand, v1, v2, n, p, map }
          }
        }
      }
    }
  }
  return null
}

/** 环网格群：存在 G ≅ Cₙ × C_p²（n ≥ 3，p ∈ {2,3}）分解（如 C₄×C₂×C₂、C₃³）。 */
export function isRingGridGroup(group: Group): boolean {
  return findRingGridDecomposition(group) !== null
}

export function getDefaultShape2D(group: Group): CayleyShape2D {
  if (isQuotientGroup(group)) return 'circular'
  // 7 阶（含）以内所有群只需圆形
  if (group.order <= 7) return 'circular'
  // Semidirect product: coset layout of N across H — the "rewiring" shape
  if (isGroupSemidirectProduct(group)) return 'rewiring'
  // 命名半直积群（GAP 无 ':' 记号，如 QD16 = C₈⋊C₂）同样走重布线
  if (isNamedRewiringGroup(group)) return 'rewiring'
  // C₂³ 摆成 D₄ 风格双环（优先于直积分类）
  if (isC2Cube(group)) return 'dualRing'
  // 环网格：G ≅ Cₙ×C_p²（n≥3，p∈{2,3}）时循环部分做环、阶 p 部分做 p×p 网格
  // （C₄×C₂×C₂ / C₃³ 类；优先于 cylinder 的同心多层环，cylinder 可手动选择）
  if (isRingGridGroup(group)) return 'ringGrid'
  if (isGroupDirectProduct(group)) return classifyDirectProduct2D(group)
  const sym = group.symbol
  // 球面投影仅适配少数置换群（S₃/S₄/S₅/A₄/A₅），其他群不套用
  if (isProjection3DGroup(group)) return 'projection3D'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'pythagoreanSquare'
  if (isGroupCyclic(group)) {
    // 循环群凯莱图 = 单生成元多边形，圆形布局弧长均匀无交叉；
    // 螺旋（spiral/coil）仅作手动可选形状，不做默认（C16 等大循环会显得杂乱）
    return 'circular'
  }
  if (isGroupDihedral(group)) return 'dualRing'
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
      return ['rewiring', 'circular', 'spherical']
    }
    if (isNamedRewiringGroup(group)) {
      return ['rewiring', 'circular', 'spherical']
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
    const isSpecial = sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈'
    if (isProjection3DGroup(group) || isSpecial) {
      shapes.push(isSpecial ? 'pythagoreanSquare' : 'projection3D')
    }
    if (isGroupDirectProduct(group)) {
      const cls = classifyDirectProduct2D(group)
      if (cls !== 'grid') shapes.push(cls)
      if (isRingGridGroup(group)) shapes.push('ringGrid')
      shapes.push('grid')
    }
    // 注册表等非直积来源的环网格群（如 GAP 表群 C₄×C₂×C₂）也提供该形状
    if (isRingGridGroup(group) && !shapes.includes('ringGrid')) shapes.push('ringGrid')
    shapes.push('spherical')
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




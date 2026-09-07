/** 群 → 对称几何体类型判定（纯字符串逻辑，无 R3F/three 依赖，供画布与 UI 面板共用）。 */
export type SymmetryType = 'cyclic' | 'dihedral' | 'tetrahedron' | 'cube' | 'icosahedron' | 'rectangle' | 'unsupported'

export function getSymmetryType(group: { symbol: string }): SymmetryType {
  const sym = group.symbol
  // Direct products / powers are not full symmetry groups of a single 3D figure.
  // These must be checked before the C/D prefix classes (whose symbols they share).
  if (sym === 'C_{2}^{2}' || sym === 'C_{2}\\times C_{2}') return 'rectangle'
  if (sym.includes('\\times') || sym.includes('^{')) return 'unsupported'
  if (sym.startsWith('C')) return 'cyclic'
  if (sym.startsWith('D')) return 'dihedral'
  if (sym === 'S_{3}') return 'dihedral'
  if (sym === 'A_{4}') return 'tetrahedron'
  if (sym === 'S_{4}') return 'cube'
  if (sym === 'A_{5}') return 'icosahedron'
  if (sym === 'V_{4}') return 'rectangle'
  if (sym.startsWith('S') || sym.startsWith('A')) return 'unsupported'
  return 'unsupported'
}

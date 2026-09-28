import type { Group, Layout3D } from '../types'
import { fibonacciSphere, type Vec3 } from './layouts3D/shared'
import { latticeLayout3D, cylinderLayout3D, torusLayout3D } from './layouts3D/factorLayouts3D'
import {
  semidirectCylinderLayout3D, coneLayout3D,
  circularLayout3D, hexagonLayout3D, dihedralLayout3D,
} from './layouts3D/ringShapeLayouts3D'
import {
  tetrahedronLayout3D, cubeLayout3D,
  hypercubeLayout3D, cuboctahedronLayout3D,
} from './layouts3D/platonicLayouts3D'
import {
  truncatedTetrahedronLayout3D, truncatedCubeLayout3D,
  rhombicuboctahedronLayout3D, truncatedOctahedron2Layout3D,
  truncatedOctahedron3Layout3D, truncatedIcosahedronLayout3D,
  truncatedDodecahedronLayout3D,
} from './layouts3D/archimedeanLayouts3D'
import { wordLengthSphereLayout3D } from './layouts3D/wordLengthSphereLayout3D'
import { torusHexLayout3D } from './layouts3D/torusHexLayout3D'

/**
 * 3D 布局的统一尺度：所有 *Layout3D 都以它为半径参数。
 * 曲面类布局（torusHex 等）在场景里取几何时必须用同一值，否则节点与曲面错位。
 */
export const LAYOUT_3D_RADIUS = 5

export interface Layout3DOptions {
  /**
   * torusHex 专用：沿管子（经向）的相位（弧度）—— 图沿每根管的截面绕行（环面 = S¹×S¹，
   * 两个因子各有一种旋转；这是**经向**那个）。其余布局忽略。缺省 0 ⇒ 逐位不变。
   *
   * 另一支（大圆/纬向）**不进布局**：它在三维里等价于整块内容绕 `TORUS_HEX_RING_AXIS`
   * 刚体旋转，由场景转一个 group 完成，几何不必重算（见 torusHexLayout3D 的头部说明）。
   */
  tubePhase?: number
}

export function compute3DPositions(group: Group, layout: Layout3D, opts?: Layout3DOptions): Vec3[] {
  const n = group.order
  const radius = LAYOUT_3D_RADIUS
  const positions: Vec3[] = new Array(n)

  let placed: Vec3[] | null = null
  switch (layout) {
    case 'lattice': placed = latticeLayout3D(group, radius); break
    case 'semidirectCylinder': placed = semidirectCylinderLayout3D(group, radius); break
    case 'cylinder': placed = cylinderLayout3D(group, radius); break
    case 'cone': placed = coneLayout3D(group, radius); break
    case 'circular': placed = circularLayout3D(group, radius); break
    case 'torus': placed = torusLayout3D(group, radius); break
    case 'hexagon': placed = hexagonLayout3D(group, radius); break
    case 'dihedral': placed = dihedralLayout3D(group, radius); break
    case 'tetrahedron': placed = tetrahedronLayout3D(group, radius); break
    case 'cube': placed = cubeLayout3D(group, radius); break
    case 'hypercube': placed = hypercubeLayout3D(group, radius); break
    case 'cuboctahedron': placed = cuboctahedronLayout3D(group, radius); break
    case 'truncatedTetrahedron': placed = truncatedTetrahedronLayout3D(group, radius); break
    case 'truncatedCube': placed = truncatedCubeLayout3D(group, radius); break
    case 'rhombicuboctahedron': placed = rhombicuboctahedronLayout3D(group, radius); break
    case 'truncatedOctahedron2': placed = truncatedOctahedron2Layout3D(group, radius); break
    case 'truncatedOctahedron3': placed = truncatedOctahedron3Layout3D(group, radius); break
    case 'truncatedIcosahedron': placed = truncatedIcosahedronLayout3D(group, radius); break
    case 'truncatedDodecahedron': placed = truncatedDodecahedronLayout3D(group, radius); break
    case 'wordLengthSphere': placed = wordLengthSphereLayout3D(group, radius); break
    case 'torusHex': placed = torusHexLayout3D(group, radius, opts?.tubePhase ?? 0); break
    default:
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      break
  }

  if (placed) {
    for (let i = 0; i < n; i++) {
      const v = placed[i]
      if (v) positions[i] = v
    }
  }

  // Specialized placements (S4/A5/...) only fill positions whose element ids
  // match the canonical permutation format; fill any leftovers so downstream
  // destructuring never hits undefined.
  for (let i = 0; i < n; i++) {
    if (!positions[i]) positions[i] = fibonacciSphere(n, radius)[i]
  }

  return positions
}

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

export function compute3DPositions(group: Group, layout: Layout3D): Vec3[] {
  const n = group.order
  const radius = 5
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

import type { Group, NodePosition, CayleyShape2D } from '../types'
import {
  directProductGridLayout2D,
  concentricLayout,
  dualRingLayout,
  archimedeanSpiralLayout,
  spiralLayout,
  coilLayout,
  projection3DLayout,
  semidirectProductLayout,
  cylinderLayout2D,
  torusLayout2D,
  ringGridLayout2D,
  q8PythagoreanLayout,
  coneLayout2D,
} from './forceLayout'

export function computeShape2DPositions(
  group: Group,
  shape: CayleyShape2D,
  width: number,
  height: number,
): Map<string, NodePosition> | null {
  switch (shape) {
    case 'grid':
      return directProductGridLayout2D(group, width, height)
    case 'concentric':
      return concentricLayout(group, width, height)
    case 'dualRing':
      return dualRingLayout(group, width, height)
    case 'archimedean':
      return archimedeanSpiralLayout(group, width, height)
    case 'spiral':
      return spiralLayout(group, width, height)
    case 'coil':
      return coilLayout(group, width, height)
    case 'projection3D':
      return projection3DLayout(group, width, height)
    case 'rewiring':
      return semidirectProductLayout(group, width, height)
    case 'cylinder':
      return cylinderLayout2D(group, width, height)
    case 'torus':
      return torusLayout2D(group, width, height)
    case 'ringGrid':
      return ringGridLayout2D(group, width, height)
    case 'pythagoreanSquare':
      return q8PythagoreanLayout(group, width, height)
    case 'cone':
      return coneLayout2D(group, width, height)
    default:
      return null
  }
}

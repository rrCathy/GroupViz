import type { Group } from '../../types'
import type { Vec3 } from './shared'

export function getTetrahedronVerts(radius: number): Vec3[] {
  const a = radius * 0.8
  return [
    [a, a, a], [a, -a, -a], [-a, a, -a], [-a, -a, a],
  ]
}

export function getCubeVerts(radius: number): Vec3[] {
  const a = radius * 0.6
  return [
    [-a, -a, -a], [a, -a, -a], [-a, a, -a], [a, a, -a],
    [-a, -a, a], [a, -a, a], [-a, a, a], [a, a, a],
  ]
}

export function getCuboctahedronVerts(radius: number): Vec3[] {
  const a = radius * 0.7
  return [
    [a, a, 0], [a, -a, 0], [-a, a, 0], [-a, -a, 0],
    [a, 0, a], [a, 0, -a], [-a, 0, a], [-a, 0, -a],
    [0, a, a], [0, a, -a], [0, -a, a], [0, -a, -a],
  ]
}

const GE_VALUES: number[][] = [
  [0,1,2,3], [0,3,1,2], [0,2,3,1],
  [1,0,2,3], [1,3,0,2], [1,2,3,0],
  [3,0,1,2], [3,2,0,1], [3,1,2,0],
  [3,1,0,2], [3,2,1,0], [3,0,2,1],
  [2,0,3,1], [2,1,0,3], [2,3,1,0],
  [2,1,3,0], [2,0,1,3], [2,3,0,1],
  [1,2,0,3], [1,3,2,0], [1,0,3,2],
  [0,2,1,3], [0,3,2,1], [0,1,3,2],
]

export function placeS4Elements(
  group: Group,
  coords: [number, number, number][],
  positions: Vec3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 24; geIdx++) {
    const myValue = GE_VALUES[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = [x * radius, y * radius, z * radius]
    }
  }
}

const GE_VALUES_A5: number[][] = [
  [0,1,2,3,4],[1,2,3,4,0],[2,3,4,0,1],[3,4,0,1,2],[4,0,1,2,3],
  [1,0,3,2,4],[0,3,2,4,1],[3,2,4,1,0],[2,4,1,0,3],[4,1,0,3,2],
  [2,1,4,3,0],[1,4,3,0,2],[4,3,0,2,1],[3,0,2,1,4],[0,2,1,4,3],
  [3,0,4,2,1],[0,4,2,1,3],[4,2,1,3,0],[2,1,3,0,4],[1,3,0,4,2],
  [3,2,0,4,1],[2,0,4,1,3],[0,4,1,3,2],[4,1,3,2,0],[1,3,2,0,4],
  [2,3,1,4,0],[3,1,4,0,2],[1,4,0,2,3],[4,0,2,3,1],[0,2,3,1,4],
  [4,3,1,0,2],[3,1,0,2,4],[1,0,2,4,3],[0,2,4,3,1],[2,4,3,1,0],
  [4,2,0,1,3],[2,0,1,3,4],[0,1,3,4,2],[1,3,4,2,0],[3,4,2,0,1],
  [4,0,3,1,2],[0,3,1,2,4],[3,1,2,4,0],[1,2,4,0,3],[2,4,0,3,1],
  [4,1,2,0,3],[1,2,0,3,4],[2,0,3,4,1],[0,3,4,1,2],[3,4,1,2,0],
  [0,1,4,2,3],[1,4,2,3,0],[4,2,3,0,1],[2,3,0,1,4],[3,0,1,4,2],
  [1,0,4,3,2],[0,4,3,2,1],[4,3,2,1,0],[3,2,1,0,4],[2,1,0,4,3],
]

export function placeA5Elements(
  group: Group,
  coords: [number, number, number][],
  positions: Vec3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 60; geIdx++) {
    const myValue = GE_VALUES_A5[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = [x * radius, y * radius, z * radius]
    }
  }
}

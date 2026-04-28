import { useRef, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import type { Group, Generator, CayleyEdgeData, Layout3D } from '../../core/types'
import { computeCayleyActionEdges } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import { truncatedTetrahedron } from '../../core/polyhedra'

interface EdgeData {
  fromIdx: number
  toIdx: number
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  gen: Generator
  isSelfLoop: boolean
  isBidirectional?: boolean
}

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const phi = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = phi * i
    points.push(new THREE.Vector3(
      Math.cos(theta) * radiusAtY * radius,
      y * radius,
      Math.sin(theta) * radiusAtY * radius
    ))
  }
  return points
}

function getTetrahedronVerts(radius: number): THREE.Vector3[] {
  const a = radius * 0.8
  return [
    new THREE.Vector3(a, a, a),
    new THREE.Vector3(a, -a, -a),
    new THREE.Vector3(-a, a, -a),
    new THREE.Vector3(-a, -a, a),
  ]
}

function getCubeVerts(radius: number): THREE.Vector3[] {
  const a = radius * 0.6
  return [
    new THREE.Vector3(-a, -a, -a), new THREE.Vector3(a, -a, -a),
    new THREE.Vector3(-a, a, -a), new THREE.Vector3(a, a, -a),
    new THREE.Vector3(-a, -a, a), new THREE.Vector3(a, -a, a),
    new THREE.Vector3(-a, a, a), new THREE.Vector3(a, a, a),
  ]
}

function getCuboctahedronVerts(radius: number): THREE.Vector3[] {
  const a = radius * 0.7
  return [
    new THREE.Vector3(a, a, 0), new THREE.Vector3(a, -a, 0),
    new THREE.Vector3(-a, a, 0), new THREE.Vector3(-a, -a, 0),
    new THREE.Vector3(a, 0, a), new THREE.Vector3(a, 0, -a),
    new THREE.Vector3(-a, 0, a), new THREE.Vector3(-a, 0, -a),
    new THREE.Vector3(0, a, a), new THREE.Vector3(0, a, -a),
    new THREE.Vector3(0, -a, a), new THREE.Vector3(0, -a, -a),
  ]
}

const GE_VALUES: number[][] = [
  [0,1,2,3], [0,3,1,2], [0,2,3,1], [1,0,2,3], [1,3,0,2], [1,2,3,0],
  [3,0,1,2], [3,2,0,1], [3,1,2,0], [3,1,0,2], [3,2,1,0], [3,0,2,1],
  [2,0,3,1], [2,1,0,3], [2,3,1,0], [2,1,3,0], [2,0,1,3], [2,3,0,1],
  [1,2,0,3], [1,3,2,0], [1,0,3,2], [0,2,1,3], [0,3,2,1], [0,1,3,2],
]

function placeS4Elements(
  group: Group,
  coords: [number, number, number][],
  positions: THREE.Vector3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 24; geIdx++) {
    const myValue = GE_VALUES[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = new THREE.Vector3(x * radius, y * radius, z * radius)
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

function placeA5Elements(
  group: Group,
  coords: [number, number, number][],
  positions: THREE.Vector3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 60; geIdx++) {
    const myValue = GE_VALUES_A5[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = new THREE.Vector3(x * radius, y * radius, z * radius)
    }
  }
}

function compute3DPositions(group: Group, layout: Layout3D): THREE.Vector3[] {
  const n = group.order
  const radius = 5
  const positions: THREE.Vector3[] = new Array(n)

  switch (layout) {
    case 'lattice': {
      const vals = group.elements.map(el => el.value)
      const dim = vals[0]?.length || 0
      const spacing = 2.5

      if (dim === 2) {
        const spanX = Math.max(...vals.map(v => v[0])) + 1
        const spanZ = Math.max(...vals.map(v => v[1])) + 1
        const offX = (spanX - 1) * spacing / 2
        const offZ = (spanZ - 1) * spacing / 2
        for (let i = 0; i < n; i++) {
          const v = group.elements[i].value
          positions[i] = new THREE.Vector3(
            v[0] * spacing - offX,
            0,
            v[1] * spacing - offZ
          )
        }
      } else if (dim === 3) {
        const spanX = Math.max(...vals.map(v => v[0])) + 1
        const spanY = Math.max(...vals.map(v => v[1])) + 1
        const spanZ = Math.max(...vals.map(v => v[2])) + 1
        const offX = (spanX - 1) * spacing / 2
        const offY = (spanY - 1) * spacing / 2
        const offZ = (spanZ - 1) * spacing / 2
        for (let i = 0; i < n; i++) {
          const v = group.elements[i].value
          positions[i] = new THREE.Vector3(
            v[0] * spacing - offX,
            v[1] * spacing - offY,
            v[2] * spacing - offZ
          )
        }
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'circular':
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n
        positions[i] = new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        )
      }
      break

    case 'hexagon': {
      if (n === 6 && (group.symbol === 'S3' || group.symbol === 'S\u2083')) {
        const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
        // 六边形循环顺序：e → (12) → (132) → (13) → (123) → (23) → e
        const hexagonIds = ['1,2,3', '2,1,3', '3,1,2', '3,2,1', '2,3,1', '1,3,2']
        hexagonIds.forEach((id, i) => {
          const idx = idToIdx.get(id)
          if (idx !== undefined) {
            const angle = (i * 2 * Math.PI) / n
            positions[idx] = new THREE.Vector3(
              Math.cos(angle) * radius,
              0,
              Math.sin(angle) * radius
            )
          }
        })
      } else {
        for (let i = 0; i < n; i++) {
          const angle = (i * 2 * Math.PI) / n
          positions[i] = new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
          )
        }
      }
      break
    }

    case 'dihedral': {
      const halfN = Math.floor(n / 2)
      const rRadius = radius * 0.85
      for (let i = 0; i < halfN; i++) {
        const angle = (i * 2 * Math.PI) / halfN
        positions[i] = new THREE.Vector3(
          Math.cos(angle) * rRadius,
          -radius * 0.25,
          Math.sin(angle) * rRadius
        )
      }
      for (let i = halfN; i < n; i++) {
        const angle = ((i - halfN) * 2 * Math.PI) / (n - halfN)
        positions[i] = new THREE.Vector3(
          Math.cos(angle) * rRadius,
          radius * 0.25,
          Math.sin(angle) * rRadius
        )
      }
      break
    }

    case 'tetrahedron': {
      const verts = getTetrahedronVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.2)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'cube': {
      const verts = getCubeVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.3)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'cuboctahedron': {
      const verts = getCuboctahedronVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.1)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'truncatedTetrahedron': {
      if (n === 12) {
        const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))

        const faceIds: string[][] = [
          ['1,3,4,2', '1,4,2,3', '1,2,3,4'],           // {(234), (243), e}
          ['2,4,3,1', '2,3,1,4', '2,1,4,3'],           // {(124), (123), (12)(34)}
          ['4,2,1,3', '4,1,3,2', '4,3,2,1'],           // {(143), (142), (14)(23)}
          ['3,1,2,4', '3,2,4,1', '3,4,1,2'],           // {(132), (134), (13)(24)}
        ]

        const verts = truncatedTetrahedron(radius)

        for (let f = 0; f < 4; f++) {
          for (let v = 0; v < 3; v++) {
            const idx = idToIdx.get(faceIds[f][v])
            if (idx !== undefined) {
              const [x, y, z] = verts[f * 3 + v]
              positions[idx] = new THREE.Vector3(x, y, z)
            }
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'truncatedCube': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [0.6, -1.0, 1.0], [1.0, -0.6, 1.0], [1.0, -1.0, 0.6],
          [-0.6, -1.0, 1.0], [-1.0, -1.0, 0.6], [-1.0, -0.6, 1.0],
          [1.0, 0.6, 1.0], [0.6, 1.0, 1.0], [1.0, 1.0, 0.6],
          [-1.0, -1.0, -0.6], [-0.6, -1.0, -1.0], [-1.0, -0.6, -1.0],
          [1.0, -1.0, -0.6], [1.0, -0.6, -1.0], [0.6, -1.0, -1.0],
          [-1.0, 0.6, 1.0], [-1.0, 1.0, 0.6], [-0.6, 1.0, 1.0],
          [1.0, 0.6, -1.0], [1.0, 1.0, -0.6], [0.6, 1.0, -1.0],
          [-1.0, 1.0, -0.6], [-1.0, 0.6, -1.0], [-0.6, 1.0, -1.0],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'rhombicuboctahedron': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [-0.5, 0.5, 1.0], [-1.0, -0.5, -0.5], [0.5, -1.0, 0.5],
          [0.5, -1.0, -0.5], [1.0, 0.5, 0.5], [-0.5, -0.5, 1.0],
          [0.5, 0.5, 1.0], [-0.5, 1.0, -0.5], [-1.0, -0.5, 0.5],
          [-0.5, -1.0, -0.5], [0.5, 0.5, -1.0], [1.0, -0.5, 0.5],
          [-1.0, 0.5, -0.5], [0.5, -0.5, -1.0], [-0.5, -1.0, 0.5],
          [1.0, 0.5, -0.5], [-0.5, 1.0, 0.5], [0.5, -0.5, 1.0],
          [-1.0, 0.5, 0.5], [0.5, 1.0, -0.5], [-0.5, -0.5, -1.0],
          [1.0, -0.5, -0.5], [-0.5, 0.5, -1.0], [0.5, 1.0, 0.5],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'truncatedOctahedron2': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [0.3, -1.0, 0.0], [0.0, -0.3, 1.0], [1.0, 0.0, 0.3],
          [1.0, -0.3, 0.0], [0.3, 0.0, -1.0], [0.0, -1.0, -0.3],
          [0.0, -1.0, 0.3], [-1.0, -0.3, 0.0], [-0.3, 0.0, 1.0],
          [1.0, 0.0, -0.3], [0.3, 1.0, 0.0], [0.0, 0.3, -1.0],
          [0.3, 0.0, 1.0], [0.0, 1.0, 0.3], [1.0, 0.3, 0.0],
          [0.0, -0.3, -1.0], [-1.0, 0.0, -0.3], [-0.3, -1.0, 0.0],
          [0.0, 0.3, 1.0], [-1.0, 0.0, 0.3], [-0.3, 1.0, 0.0],
          [-0.3, 0.0, -1.0], [0.0, 1.0, -0.3], [-1.0, 0.3, 0.0],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'truncatedOctahedron3': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [0.333, -0.667, 0.000], [0.000, -0.333, -0.667], [0.667, 0.000, -0.333],
          [0.000, -0.667, 0.333], [-0.667, -0.333, 0.000], [-0.333, 0.000, 0.667],
          [-0.333, 0.000, -0.667], [0.000, 0.667, -0.333], [-0.667, 0.333, 0.000],
          [-0.667, 0.000, -0.333], [-0.333, 0.667, 0.000], [0.000, 0.333, -0.667],
          [0.667, 0.333, 0.000], [0.333, 0.000, 0.667], [0.000, 0.667, 0.333],
          [0.000, 0.333, 0.667], [0.667, 0.000, 0.333], [0.333, 0.667, 0.000],
          [0.000, -0.333, 0.667], [-0.667, 0.000, 0.333], [-0.333, -0.667, 0.000],
          [0.667, -0.333, 0.000], [0.333, 0.000, -0.667], [0.000, -0.667, -0.333],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'truncatedIcosahedron': {
      if (n === 60) {
        const coords: [number, number, number][] = [
          [0.0, 1.2135, 0.25], [0.4045, 1.059, 0.5], [0.25, 0.809, 0.9045],
          [-0.25, 0.809, 0.9045], [-0.4045, 1.059, 0.5], [0.0, 1.2135, -0.25],
          [-0.4045, 1.059, -0.5], [-0.25, 0.809, -0.9045], [0.25, 0.809, -0.9045],
          [0.4045, 1.059, -0.5], [0.809, 0.9045, 0.25], [0.809, 0.9045, -0.25],
          [1.059, 0.5, -0.4045], [1.2135, 0.25, 0.0], [1.059, 0.5, 0.4045],
          [-0.809, 0.9045, -0.25], [-0.809, 0.9045, 0.25], [-1.059, 0.5, 0.4045],
          [-1.2135, 0.25, 0.0], [-1.059, 0.5, -0.4045], [0.5, 0.4045, 1.059],
          [0.9045, 0.25, 0.809], [0.9045, -0.25, 0.809], [0.5, -0.4045, 1.059],
          [0.25, 0.0, 1.2135], [-0.5, 0.4045, -1.059], [-0.9045, 0.25, -0.809],
          [-0.9045, -0.25, -0.809], [-0.5, -0.4045, -1.059], [-0.25, 0.0, -1.2135],
          [-0.5, 0.4045, 1.059], [-0.25, 0.0, 1.2135], [-0.5, -0.4045, 1.059],
          [-0.9045, -0.25, 0.809], [-0.9045, 0.25, 0.809], [0.5, 0.4045, -1.059],
          [0.25, 0.0, -1.2135], [0.5, -0.4045, -1.059], [0.9045, -0.25, -0.809],
          [0.9045, 0.25, -0.809], [1.059, -0.5, 0.4045], [1.2135, -0.25, 0.0],
          [1.059, -0.5, -0.4045], [0.809, -0.9045, -0.25], [0.809, -0.9045, 0.25],
          [-1.059, -0.5, -0.4045], [-1.2135, -0.25, 0.0], [-1.059, -0.5, 0.4045],
          [-0.809, -0.9045, 0.25], [-0.809, -0.9045, -0.25], [-0.25, -0.809, 0.9045],
          [0.25, -0.809, 0.9045], [0.4045, -1.059, 0.5], [0.0, -1.2135, 0.25],
          [-0.4045, -1.059, 0.5], [0.25, -0.809, -0.9045], [-0.25, -0.809, -0.9045],
          [-0.4045, -1.059, -0.5], [0.0, -1.2135, -0.25], [0.4045, -1.059, -0.5],
        ]
        placeA5Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'truncatedDodecahedron': {
      if (n === 60) {
        const coords: [number, number, number][] = [
          [0.6505, 1.2322, -0.2909], [1.2322, -0.2909, -0.6505], [0.1798, -1.412, 0.0],
          [-1.0525, -0.5818, 0.7616], [-0.7616, 1.0525, 0.5818], [0.5818, -0.7616, 1.0525],
          [-0.2909, 0.6505, 1.2322], [-0.6505, 1.2322, -0.2909], [0.0, 0.1798, -1.412],
          [0.7616, -1.0525, -0.5818], [0.0, -0.1798, 1.412], [0.7616, 1.0525, 0.5818],
          [0.5818, 0.7616, -1.0525], [-0.2909, -0.6505, -1.2322], [-0.6505, -1.2322, 0.2909],
          [1.0525, 0.5818, -0.7616], [1.2322, -0.2909, 0.6505], [-0.2909, -0.6505, 1.2322],
          [-1.412, 0.0, 0.1798], [-0.5818, 0.7616, -1.0525], [0.2909, 0.6505, 1.2322],
          [1.412, 0.0, 0.1798], [0.5818, -0.7616, -1.0525], [-1.0525, -0.5818, -0.7616],
          [-1.2322, 0.2909, 0.6505], [1.412, 0.0, -0.1798], [0.5818, 0.7616, 1.0525],
          [-1.0525, 0.5818, 0.7616], [-1.2322, -0.2909, -0.6505], [0.2909, -0.6505, -1.2322],
          [1.0525, 0.5818, 0.7616], [0.7616, -1.0525, 0.5818], [-0.6505, -1.2322, -0.2909],
          [-1.2322, 0.2909, -0.6505], [-0.1798, 1.412, 0.0], [1.2322, 0.2909, 0.6505],
          [0.1798, 1.412, 0.0], [-1.0525, 0.5818, -0.7616], [-0.7616, -1.0525, -0.5818],
          [0.6505, -1.2322, 0.2909], [-0.5818, -0.7616, 1.0525], [1.0525, -0.5818, 0.7616],
          [1.2322, 0.2909, -0.6505], [-0.2909, 0.6505, -1.2322], [-1.412, 0.0, -0.1798],
          [0.2909, 0.6505, -1.2322], [0.6505, 1.2322, 0.2909], [0.0, 0.1798, 1.412],
          [-0.7616, -1.0525, 0.5818], [-0.5818, -0.7616, -1.0525], [-0.5818, 0.7616, 1.0525],
          [0.2909, -0.6505, 1.2322], [0.6505, -1.2322, -0.2909], [0.0, -0.1798, -1.412],
          [-0.7616, 1.0525, -0.5818], [1.0525, -0.5818, -0.7616], [0.7616, 1.0525, -0.5818],
          [-0.6505, 1.2322, 0.2909], [-1.2322, -0.2909, 0.6505], [-0.1798, -1.412, 0.0],
        ]
        placeA5Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) {
          positions[i] = fibonacciSphere(n, radius)[i]
        }
      }
      break
    }

    case 'spherical':
    default:
      for (let i = 0; i < n; i++) {
        positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
  }

  return positions
}

function getElementColor(idx: number, total: number, isAbelian: boolean): string {
  if (isAbelian) {
    const hue = (idx / total) * 360
    return `hsl(${hue}, 60%, 55%)`
  }
  const hue = (idx * 137.508) % 360
  return `hsl(${hue}, 65%, 55%)`
}

interface NodeSphereProps {
  position: THREE.Vector3
  label: string
  color: string
  isSelected: boolean
  isHovered: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

interface NodeSphereProps {
  position: THREE.Vector3
  label: string
  color: string
  isSelected: boolean
  isHovered: boolean
  subsetColor: string | null
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

function NodeSphere({ position, label, color, isSelected, isHovered, subsetColor, onClick, onPointerEnter, onPointerLeave }: NodeSphereProps) {
  const texLabel = useMemo(() => renderTex(texify(label)), [label])

  return (
    <group position={position}>
      <mesh onClick={onClick} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
        <sphereGeometry args={[isSelected || isHovered ? 0.55 : 0.42, 32, 32]} />
        <meshStandardMaterial
          color={isSelected || isHovered ? color : subsetColor || color}
          emissive={isSelected || isHovered ? color : subsetColor || color}
          emissiveIntensity={isSelected || isHovered ? 0.6 : subsetColor ? 0.4 : 0.2}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {subsetColor && !isSelected && (
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial color={subsetColor} transparent opacity={0.25} />
        </mesh>
      )}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshBasicMaterial color="#ffd93d" transparent opacity={0.3} />
        </mesh>
      )}
      <Html distanceFactor={12} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          style={{
            color: '#fff', fontSize: 11, fontWeight: 'bold',
            textShadow: '0 0 6px rgba(0,0,0,0.8)', whiteSpace: 'nowrap',
            fontFamily: 'serif', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          dangerouslySetInnerHTML={{ __html: texLabel }}
        />
      </Html>
    </group>
  )
}

interface EdgeLineProps {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  isHighlighted: boolean
  isSelfLoop: boolean
  isBidirectional?: boolean
}

function StraightEdge({ start, end, color, isHighlighted }: { start: THREE.Vector3; end: THREE.Vector3; color: string; isHighlighted: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  dir.normalize()

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const thickness = isHighlighted ? 0.08 : 0.05

  useEffect(() => {
    if (!meshRef.current) return
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone())
    meshRef.current.quaternion.copy(quat)
  }, [dir])

  return (
    <mesh ref={meshRef} position={mid}>
      <cylinderGeometry args={[thickness, thickness, len, 6, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.25} roughness={0.4} />
    </mesh>
  )
}

function EdgeLine({ start, end, color, isHighlighted, isSelfLoop, isBidirectional }: EdgeLineProps) {
  if (isSelfLoop) {
    return (
      <group position={start}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.0, 0]}>
          <torusGeometry args={[0.4, 0.04, 8, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.2} roughness={0.4} />
        </mesh>
        <mesh position={[0.4, 1.0, 0]}>
          <coneGeometry args={[0.08, 0.2, 6, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.2} roughness={0.4} />
        </mesh>
      </group>
    )
  }

  const dir = new THREE.Vector3().subVectors(end, start)
  dir.normalize()

  return (
    <group>
      <StraightEdge start={start} end={end} color={color} isHighlighted={isHighlighted} />
      {!isBidirectional && (
        <ArrowCone position={end} direction={dir} color={color} highlighted={isHighlighted} />
      )}
    </group>
  )
}

function ArrowCone({ position, direction, color, highlighted }: { position: THREE.Vector3; direction: THREE.Vector3; color: string; highlighted: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (!meshRef.current) return
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    meshRef.current.quaternion.copy(quat)
  }, [direction])

  const base = position.clone().addScaledVector(direction.clone().normalize(), -0.4)

  return (
    <mesh ref={meshRef} position={base}>
      <coneGeometry args={[0.12, 0.4, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={highlighted ? 0.7 : 0.25} roughness={0.4} />
    </mesh>
  )
}

function SceneContent() {
  const {
    currentGroup, selectedElements, selectElement, setHoverElement,
    hoverElement, cayleyActions, cayleyMultiplyType, cayleyShape3D, subsets
  } = useGroup()
  const { t } = useTranslation()

  const cayleyEdges = useMemo(() => {
    if (!currentGroup) return [] as CayleyEdgeData[]
    return computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType)
  }, [currentGroup, cayleyActions, cayleyMultiplyType])

  const positions = useMemo(() => {
    if (!currentGroup) return [] as THREE.Vector3[]
    return compute3DPositions(currentGroup, cayleyShape3D)
  }, [currentGroup, cayleyShape3D])

  const edgeDataMap = useMemo(() => {
    const m = new Map<string, EdgeData>()
    if (!currentGroup) return m
    for (const edge of cayleyEdges) {
      const key = [edge.fromIdx, edge.toIdx].sort().join('|')
      if (!m.has(key)) {
        m.set(key, {
          fromIdx: edge.fromIdx,
          toIdx: edge.toIdx,
          fromPos: positions[edge.fromIdx],
          toPos: positions[edge.toIdx],
          gen: {
            name: edge.actionElementId,
            symbol: currentGroup.elements.find(e => e.id === edge.actionElementId)?.label || '',
            color: edge.color,
            apply: () => currentGroup.elements[0],
            inverse: {} as Generator
          },
          isSelfLoop: edge.isSelfLoop,
          isBidirectional: edge.isBidirectional,
        })
      }
    }
    return m
  }, [cayleyEdges, positions, currentGroup])

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} color="#4488ff" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#ffffff" />

      {currentGroup && (
        <Html fullscreen position={[0, 0, 0]}>
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(15, 15, 26, 0.85)', color: '#ccc',
            padding: '6px 12px', borderRadius: 8, fontSize: 13,
            fontFamily: 'monospace', pointerEvents: 'none'
          }}>
            <span style={{ fontWeight: 'bold' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.symbol)) }} />
            <span style={{ marginLeft: 8, color: '#888' }}>|G| = {currentGroup.order}</span>
          </div>
        </Html>
      )}

      {currentGroup && cayleyActions.length > 0 && (
        <Html fullscreen position={[0, 0, 0]}>
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(15, 15, 26, 0.85)', color: '#ccc',
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            fontFamily: 'monospace', pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {cayleyMultiplyType === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')}
            </div>
            {cayleyActions.filter(a => a.enabled).map(action => {
              const el = currentGroup.elements.find(e => e.id === action.elementId)
              const label = el?.label || action.elementId
              return (
                <div key={action.elementId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 12, height: 3, background: action.color, borderRadius: 2 }} />
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(label)) }} />
                </div>
              )
            })}
          </div>
        </Html>
      )}

      {Array.from(edgeDataMap.values()).map((edge) => {
        const fromEl = currentGroup!.elements[edge.fromIdx]
        const toEl = currentGroup!.elements[edge.toIdx]
        const isHighlighted = (
          selectedElements.has(fromEl.id) ||
          selectedElements.has(toEl.id)
        )
        return (
          <EdgeLine
            key={`edge-${edge.fromIdx}-${edge.toIdx}`}
            start={edge.fromPos}
            end={edge.toPos}
            color={edge.gen.color}
            isHighlighted={isHighlighted}
            isSelfLoop={edge.isSelfLoop}
            isBidirectional={edge.isBidirectional}
          />
        )
      })}

      {positions.map((pos, i) => {
        const el = currentGroup!.elements[i]
        const isSelected = selectedElements.has(el.id)
        const parentSubset = subsets.find(s => s.elementIds.includes(el.id))
        return (
          <NodeSphere
            key={el.id}
            position={pos}
            label={el.label}
            color={getElementColor(i, currentGroup!.order, currentGroup!.isAbelian)}
            isSelected={isSelected}
            isHovered={hoverElement?.id === el.id}
            subsetColor={parentSubset ? parentSubset.color : null}
            onClick={(e) => {
              e.stopPropagation()
              selectElement(el.id, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)
            }}
            onPointerEnter={() => setHoverElement(el)}
            onPointerLeave={() => setHoverElement(null)}
          />
        )
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={1.2}
        rotateSpeed={0.8}
        minDistance={3}
        maxDistance={25}
        dampingFactor={0.1}
      />
    </>
  )
}

export function Cayley3DView() {
  const { currentGroup } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a1a' }}>
      <Canvas
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0a0a1a']} />
        <SceneContent />
      </Canvas>
    </div>
  )
}

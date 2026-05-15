import { useRef, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import type { Group, GroupElement, Generator, CayleyEdgeData, Layout3D } from '../../core/types'
import { computeCayleyActionEdges, ringOrder } from '../../core/algebra/forceLayout'
import { texify, renderTex } from '../../utils/texify'
import { truncatedTetrahedron } from '../../core/polyhedra'

interface EdgeData {
  fromIdx: number
  toIdx: number
  fromId: string
  toId: string
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  gen: Generator
  isSelfLoop: boolean
  isBidirectional?: boolean
}

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []

  if (n === 0) return points
  if (n === 1) {
    points.push(new THREE.Vector3(0, 0, 0))
    return points
  }

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

// S4 element order matching Group Explorer's canonical 0-23 indexing (IMAGE convention)
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
      // Robust 3D lattice layout for direct-product groups.
      // Strategy: partition group factors into three axis groups and
      // map each element's multi-dimensional index into (ix,iy,iz)
      // using mixed-radix indexing. This works for pipe-delimited
      // dynamic products and value-array products (prebuilt).
      const vals = group.elements.map(el => el.value || [])
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

      // If no factor data, fall back to spherical
      if (n === 0) break

      // Helper: greedy partition of factor sizes into up to 3 axis groups.
      // Uses <= so that equal-product groups are round-robined for balanced lattice.
      const partitionFactors = (sizes: number[]) => {
        const axisGroups: { indices: number[]; prod: number; id: number }[] = [
          { indices: [], prod: 1, id: 0 },
          { indices: [], prod: 1, id: 1 },
          { indices: [], prod: 1, id: 2 }
        ]
        const idxs = sizes.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i).map(o => o.i)
        for (const fi of idxs) {
          let target = 0
          for (let j = 1; j < axisGroups.length; j++) {
            const aj = axisGroups[j]
            const at = axisGroups[target]
            if (aj.prod < at.prod || (aj.prod === at.prod && aj.id < at.id)) target = j
          }
          axisGroups[target].indices.push(fi)
          axisGroups[target].prod *= Math.max(1, sizes[fi])
        }
        return axisGroups
      }

      if (isPipeProduct) {
        // Tokenize ids and collect unique keys per token position
        const tokenLists = group.elements.map(el => el.id.split('|'))
        const maxTokens = Math.max(...tokenLists.map(t => t.length))
        const tokenKeys: string[][] = []
        for (let j = 0; j < maxTokens; j++) {
          tokenKeys.push(Array.from(new Set(tokenLists.map(t => t[j] ?? ''))))
        }
        const sizes = tokenKeys.map(k => k.length)
        if (sizes.length === 0) {
          for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
          break
        }

        const axisGroups = partitionFactors(sizes)
        const tokenMaps = tokenKeys.map(arr => {
          const allNumeric = arr.every(k => /^-?\d+$/.test(k))
          const sorted = arr.slice().sort(allNumeric ? (a, b) => Number(a) - Number(b) : undefined)
          return new Map(sorted.map((k, i) => [k, i]))
        })

        const sizeX = Math.max(1, axisGroups[0].prod)
        const sizeY = Math.max(1, axisGroups[1].prod)
        const sizeZ = Math.max(1, axisGroups[2].prod)

        // Increase spacing so lattice edges are longer and visually clearer
        const spacing = Math.max(0.9, radius * 0.36)
        const halfX = (sizeX - 1) * spacing / 2
        const halfY = (sizeY - 1) * spacing / 2
        const halfZ = (sizeZ - 1) * spacing / 2

        const computeMixedIndex = (tokens: string[], groupIdx: number) => {
          const g = axisGroups[groupIdx]
          if (!g.indices.length) return 0
          let idx = 0
          for (let t = 0; t < g.indices.length; t++) {
            const fi = g.indices[t]
            const key = tokens[fi] ?? ''
            const val = tokenMaps[fi].get(key) ?? 0
            // base is product of sizes of subsequent indices in this group
            let base = 1
            for (let u = t + 1; u < g.indices.length; u++) base *= tokenMaps[g.indices[u]].size
            idx += val * base
          }
          return idx
        }

        for (let i = 0; i < n; i++) {
          const toks = group.elements[i].id.split('|')
          const ix = computeMixedIndex(toks, 0)
          const iy = computeMixedIndex(toks, 1)
          const iz = computeMixedIndex(toks, 2)
          const x = ix * spacing - halfX
          const y = iy * spacing - halfY
          const z = iz * spacing - halfZ
          // small rotation to avoid exact alignment with spherical points
          const ang = Math.PI / 12
          const cosA = Math.cos(ang)
          const sinA = Math.sin(ang)
          const rx = x * cosA - z * sinA
          const rz = x * sinA + z * cosA
          positions[i] = new THREE.Vector3(rx, y, rz)
        }
        break
      }

      // Value-array based direct products (prebuilt groups)
      const dim = vals[0]?.length || 0
      if (dim < 1) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

      // Build value -> index maps per factor so we can use mixed-radix safely
      const valueKeys: number[][] = []
      for (let d = 0; d < dim; d++) {
        const keys = Array.from(new Set(vals.map(v => v[d] ?? 0)))
        keys.sort((a, b) => Number(a) - Number(b))
        valueKeys.push(keys)
      }
      const sizes = valueKeys.map(k => k.length)

      const axisGroups = partitionFactors(sizes)

      const valueMaps = valueKeys.map(arr => new Map(arr.map((k, i) => [k, i])))

      const sizeX = Math.max(1, axisGroups[0].prod)
      const sizeY = Math.max(1, axisGroups[1].prod)
      const sizeZ = Math.max(1, axisGroups[2].prod)

      // Increase spacing so lattice edges are longer and visually clearer
      const spacing = Math.max(0.9, radius * 0.36)
      const halfX = (sizeX - 1) * spacing / 2
      const halfY = (sizeY - 1) * spacing / 2
      const halfZ = (sizeZ - 1) * spacing / 2

      const computeMixedIndexVals = (vec: number[], groupIdx: number) => {
        const g = axisGroups[groupIdx]
        if (!g.indices.length) return 0
        let idx = 0
        for (let t = 0; t < g.indices.length; t++) {
          const fi = g.indices[t]
          const raw = vec[fi] ?? 0
          const val = valueMaps[fi].get(raw) ?? 0
          let base = 1
          for (let u = t + 1; u < g.indices.length; u++) base *= sizes[g.indices[u]]
          idx += val * base
        }
        return idx
      }

      for (let i = 0; i < n; i++) {
        const v = vals[i]
        const ix = computeMixedIndexVals(v, 0)
        const iy = computeMixedIndexVals(v, 1)
        const iz = computeMixedIndexVals(v, 2)
        const x = ix * spacing - halfX
        const y = iy * spacing - halfY
        const z = iz * spacing - halfZ
        const ang = Math.PI / 12
        const cosA = Math.cos(ang)
        const sinA = Math.sin(ang)
        const rx = x * cosA - z * sinA
        const rz = x * sinA + z * cosA
        positions[i] = new THREE.Vector3(rx, y, rz)
      }
      break
    }

    case 'cylinder': {
      // Cylinder layout: arrange the (non-cyclic) symmetric factor around
      // circular rings and place the cyclic factor along the cylinder axis.
      // Only supported for two-factor direct products (e.g. Cn x Sm).
      if (n === 0) break

      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
      // Expand compact superscript form (S_{3}^{2} → S_{3} \times S_{3}) for parsing
      let rawSymbol = group.symbol
      if (!rawSymbol.includes('\\times')) {
        const supMatch = rawSymbol.match(/^(.+)\^\{(\d+)\}$/)
        if (supMatch) {
          const base = supMatch[1]
          const count = parseInt(supMatch[2], 10)
          if (count >= 2) rawSymbol = Array(count).fill(base).join(' \\times ')
        }
      }
      const parts = rawSymbol.includes('\\times') ? rawSymbol.split('\\times').map(s => s.trim()) : []

      // We only handle the simple two-factor product case here.
      if (!isPipeProduct || parts.length !== 2) {
        // Fallback to torus for two-factor prebuilt value arrays (handled elsewhere),
        // otherwise defer to spherical fallback outside this branch.
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

      const tokenLists = group.elements.map(el => el.id.split('|'))
      const tokenKeys: string[][] = []
      for (let j = 0; j < parts.length; j++) {
        tokenKeys.push(Array.from(new Set(tokenLists.map(t => t[j] ?? ''))))
      }

      // Identify cyclic factor (startsWith 'C') and the other (non-cyclic)
      const cycPartIdx = parts.findIndex(p => p.startsWith('C'))
      const nonCycPartIdx = parts.findIndex(p => !p.startsWith('C'))
      if (cycPartIdx === -1 || nonCycPartIdx === -1) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

      const sizeC = tokenKeys[cycPartIdx].length
      const sizeS = tokenKeys[nonCycPartIdx].length
      if (sizeC === 0 || sizeS === 0) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

      // Use ringOrder to compute an ordering that minimizes crossings for
      // known patterns (S3, Gray code for bit vectors). Fall back to sort.
      const tokenOrders = tokenKeys.map(arr => ringOrder(arr))
      const tokenMaps = tokenOrders.map(arr => new Map(arr.map((k, i) => [k, i])))

      // Compute ring radius so that nodes don't overlap on circumference
      const minArc = 0.9 // minimal arc spacing per node
      const ringRadius = Math.max(radius * 0.55, (sizeS * minArc) / (2 * Math.PI))

      // Vertical spacing across cyclic factor layers (fit within ~1.8*radius)
      const verticalGap = Math.max(0.9, (radius * 1.8) / Math.max(1, sizeC))
      const halfH = (sizeC - 1) * verticalGap / 2

      for (let i = 0; i < n; i++) {
        const toks = group.elements[i].id.split('|')
        const cTok = toks[cycPartIdx] ?? ''
        const sTok = toks[nonCycPartIdx] ?? ''
        const ci = tokenMaps[cycPartIdx].get(cTok) ?? 0
        const si = tokenMaps[nonCycPartIdx].get(sTok) ?? 0

        // stagger rings slightly to reduce visual overlap
        const stagger = (ci % 2) * (Math.PI / (sizeS * 2))
        const angle = (si * 2 * Math.PI) / sizeS + stagger

        const x = Math.cos(angle) * ringRadius
        const z = Math.sin(angle) * ringRadius
        const y = ci * verticalGap - halfH

        positions[i] = new THREE.Vector3(x, y, z)
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

    case 'torus': {
      // Torus layout: visualize product of two non-cyclic factors as a torus
      // Parameterization: for each element we compute two angles (u,v)
      // corresponding to the two factor indices and map to a torus embedding.
      // We support pipe-delimited two-factor products and prebuilt value-array
      // products where dimension==2. Otherwise fall back to spherical.
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

      let majorRadius = radius * 0.9
      let minorRadius = radius * 0.35

      if (n === 0) break

      if (isPipeProduct) {
        const tokenLists = group.elements.map(el => el.id.split('|'))
        // Expand compact superscript form for parsing
        let rawSymbol = group.symbol
        if (!rawSymbol.includes('\\times')) {
          const supMatch = rawSymbol.match(/^(.+)\^\{(\d+)\}$/)
          if (supMatch) {
            const base = supMatch[1]
            const count = parseInt(supMatch[2], 10)
            if (count >= 2) rawSymbol = Array(count).fill(base).join(' \\times ')
          }
        }
        const parts = rawSymbol.includes('\\times') ? rawSymbol.split('\\times').map(s => s.trim()) : []
        if (parts.length !== 2) {
          for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
          break
        }

        const tok0 = Array.from(new Set(tokenLists.map(t => t[0] ?? '')))
        const tok1 = Array.from(new Set(tokenLists.map(t => t[1] ?? '')))
        const order0 = ringOrder(tok0)
        const order1 = ringOrder(tok1)
        const map0 = new Map(order0.map((k, i) => [k, i]))
        const map1 = new Map(order1.map((k, i) => [k, i]))

        const m0 = order0.length
        const m1 = order1.length
        // adapt radii slightly to avoid collisions when counts small
        majorRadius = Math.max(majorRadius, Math.min(radius * 1.2, Math.max(1, m0) * 0.6))
        minorRadius = Math.max(minorRadius, Math.min(radius * 0.6, Math.max(1, m1) * 0.28))

        for (let i = 0; i < n; i++) {
          const toks = group.elements[i].id.split('|')
          const a = (map0.get(toks[0] ?? '') ?? 0) / Math.max(1, m0) * 2 * Math.PI
          const b = (map1.get(toks[1] ?? '') ?? 0) / Math.max(1, m1) * 2 * Math.PI
          const x = (majorRadius + minorRadius * Math.cos(b)) * Math.cos(a)
          const y = minorRadius * Math.sin(b)
          const z = (majorRadius + minorRadius * Math.cos(b)) * Math.sin(a)
          positions[i] = new THREE.Vector3(x, y, z)
        }
        break
      }

      // Value array prebuilt direct product with dim==2
      const vals = group.elements.map(el => el.value || [])
      const dim = vals[0]?.length || 0
      if (dim === 2) {
        const keys0 = Array.from(new Set(vals.map(v => v[0])))
        const keys1 = Array.from(new Set(vals.map(v => v[1])))
        keys0.sort((a, b) => Number(a) - Number(b))
        keys1.sort((a, b) => Number(a) - Number(b))
        const m0 = keys0.length
        const m1 = keys1.length
        const map0 = new Map(keys0.map((k, i) => [k, i]))
        const map1 = new Map(keys1.map((k, i) => [k, i]))

        majorRadius = Math.max(majorRadius, Math.min(radius * 1.2, m0 * 0.6))
        minorRadius = Math.max(minorRadius, Math.min(radius * 0.6, m1 * 0.28))

        for (let i = 0; i < n; i++) {
          const a = (map0.get(vals[i][0]) ?? 0) / Math.max(1, m0) * 2 * Math.PI
          const b = (map1.get(vals[i][1]) ?? 0) / Math.max(1, m1) * 2 * Math.PI
          const x = (majorRadius + minorRadius * Math.cos(b)) * Math.cos(a)
          const y = minorRadius * Math.sin(b)
          const z = (majorRadius + minorRadius * Math.cos(b)) * Math.sin(a)
          positions[i] = new THREE.Vector3(x, y, z)
        }
        break
      }

      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      break
    }

    case 'hexagon': {
      // For S3, arrange elements in Hamiltonian cycle order so edges wrap around perimeter
      if (n === 6 && group.symbol === 'S_{3}') {
        const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
        const cycleOrder = ['1,2,3','2,1,3','2,3,1','3,2,1','3,1,2','1,3,2']
        cycleOrder.forEach((id, i) => {
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
        <sphereGeometry args={[isSelected || isHovered ? 0.55 : 0.42, isSelected || isHovered ? 24 : 12, isSelected || isHovered ? 24 : 12]} />
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
      {(isSelected || isHovered) && (
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
      )}
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
      <cylinderGeometry args={[thickness, thickness, len, 4, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.25} roughness={0.4} />
    </mesh>
  )
}

function EdgeLine({ start, end, color, isHighlighted, isSelfLoop }: EdgeLineProps) {
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
      {/* Skip arrow cones to reduce draw calls on large graphs */}
    </group>
  )
}

// ArrowCone removed for performance on large graphs

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

  const isLargeGroup = currentGroup ? currentGroup.order > 100 : false
  const visibleElementIds = useMemo(() => {
    if (!currentGroup) return new Set<string>()
    if (!isLargeGroup) return new Set(currentGroup.elements.map(e => e.id))
    const ids = new Set<string>([currentGroup.identity.id])
    for (const a of cayleyActions.filter(x => x.enabled).slice(0, 4)) ids.add(a.elementId)
    for (const id of selectedElements) ids.add(id)
    for (let i = 0; i < currentGroup.elements.length; i += Math.max(1, Math.ceil(currentGroup.order / 24))) {
      ids.add(currentGroup.elements[i].id)
    }
    return ids
  }, [currentGroup, cayleyActions, selectedElements, isLargeGroup])

  const elementLookup = useMemo(() => {
    const m = new Map<string, GroupElement>()
    if (!currentGroup) return m
    for (const el of currentGroup.elements) m.set(el.id, el)
    return m
  }, [currentGroup])

  const actionLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    if (!currentGroup) return m
    for (const a of cayleyActions) {
      const el = elementLookup.get(a.elementId)
      if (el) m.set(a.elementId, el.label)
    }
    return m
  }, [cayleyActions, currentGroup, elementLookup])

  const edgeDataMap = useMemo(() => {
    const m = new Map<string, EdgeData>()
    if (!currentGroup) return m
    const edgeBudget = isLargeGroup ? Math.max(60, currentGroup.order * 2) : Number.POSITIVE_INFINITY
    for (const edge of cayleyEdges) {
      if (isLargeGroup && !visibleElementIds.has(edge.fromId) && !visibleElementIds.has(edge.toId)) continue
      const key = `${Math.min(edge.fromIdx, edge.toIdx)}|${Math.max(edge.fromIdx, edge.toIdx)}|${edge.actionElementId}`
      if (!m.has(key)) {
        m.set(key, {
          fromIdx: edge.fromIdx,
          toIdx: edge.toIdx,
          fromId: edge.fromId,
          toId: edge.toId,
          fromPos: positions[edge.fromIdx],
          toPos: positions[edge.toIdx],
          gen: {
            name: edge.actionElementId,
            symbol: elementLookup.get(edge.actionElementId)?.label || '',
            color: edge.color,
            apply: () => currentGroup.elements[0],
            inverse: {} as Generator
          },
          isSelfLoop: edge.isSelfLoop,
          isBidirectional: edge.isBidirectional,
        })
      }
      if (m.size >= edgeBudget) break
    }
    return m
  }, [cayleyEdges, positions, currentGroup, isLargeGroup, visibleElementIds, elementLookup])

  if (!currentGroup) return null

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
              const label = actionLabelMap.get(action.elementId) || action.elementId
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
        const fromEl = elementLookup.get(edge.fromId)
        const toEl = elementLookup.get(edge.toId)
        if (!fromEl || !toEl) return null
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
        const el = currentGroup.elements[i]
        if (isLargeGroup && !visibleElementIds.has(el.id)) return null
        const isSelected = selectedElements.has(el.id)
        const parentSubset = subsets.find(s => s.elementIds.includes(el.id))
        return (
          <NodeSphere
            key={el.id}
            position={pos}
            label={el.label}
            color={getElementColor(i, currentGroup.order, currentGroup.isAbelian)}
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
  const { theme } = useTheme()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const bgColor = theme === 'dark' ? '#0a0a1a' : '#f4f4f7'

  return (
    <div style={{ width: '100%', height: '100%', background: bgColor }}>
      <Canvas
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <SceneContent />
      </Canvas>
    </div>
  )
}

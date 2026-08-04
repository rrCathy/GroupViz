import type { Group, Layout3D } from '../types'
import { ringOrder } from './forceLayout'
import { truncatedTetrahedron } from '../polyhedra'

type Vec3 = [number, number, number]

function fibonacciSphere(n: number, radius: number): Vec3[] {
  const points: Vec3[] = []
  if (n === 0) return points
  if (n === 1) {
    points.push([0, 0, 0])
    return points
  }
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = phi * i
    points.push([
      Math.cos(theta) * radiusAtY * radius,
      y * radius,
      Math.sin(theta) * radiusAtY * radius
    ])
  }
  return points
}

function getTetrahedronVerts(radius: number): Vec3[] {
  const a = radius * 0.8
  return [
    [a, a, a], [a, -a, -a], [-a, a, -a], [-a, -a, a],
  ]
}

function getCubeVerts(radius: number): Vec3[] {
  const a = radius * 0.6
  return [
    [-a, -a, -a], [a, -a, -a], [-a, a, -a], [a, a, -a],
    [-a, -a, a], [a, -a, a], [-a, a, a], [a, a, a],
  ]
}

function getCuboctahedronVerts(radius: number): Vec3[] {
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

function placeS4Elements(
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

function placeA5Elements(
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

export function compute3DPositions(group: Group, layout: Layout3D): Vec3[] {
  const n = group.order
  const radius = 5
  const positions: Vec3[] = new Array(n)

  switch (layout) {
    case 'lattice': {
      const vals = group.elements.map(el => el.value || [])
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
      if (n === 0) break

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
          const ang = Math.PI / 12
          const cosA = Math.cos(ang)
          const sinA = Math.sin(ang)
          const rx = x * cosA - z * sinA
          const rz = x * sinA + z * cosA
          positions[i] = [rx, y, rz]
        }
        break
      }

      const dim = vals[0]?.length || 0
      if (dim < 1) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

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
        positions[i] = [rx, y, rz]
      }
      break
    }

    case 'cylinder': {
      if (n === 0) break
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
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
      if (!isPipeProduct || parts.length !== 2) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }

      const tokenLists = group.elements.map(el => el.id.split('|'))
      const tokenKeys: string[][] = []
      for (let j = 0; j < parts.length; j++) {
        tokenKeys.push(Array.from(new Set(tokenLists.map(t => t[j] ?? ''))))
      }
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

      const tokenOrders = tokenKeys.map(arr => ringOrder(arr))
      const tokenMaps = tokenOrders.map(arr => new Map(arr.map((k, i) => [k, i])))
      const minArc = 0.9
      const ringRadius = Math.max(radius * 0.55, (sizeS * minArc) / (2 * Math.PI))
      const verticalGap = Math.max(0.9, (radius * 1.8) / Math.max(1, sizeC))
      const halfH = (sizeC - 1) * verticalGap / 2

      for (let i = 0; i < n; i++) {
        const toks = group.elements[i].id.split('|')
        const cTok = toks[cycPartIdx] ?? ''
        const sTok = toks[nonCycPartIdx] ?? ''
        const ci = tokenMaps[cycPartIdx].get(cTok) ?? 0
        const si = tokenMaps[nonCycPartIdx].get(sTok) ?? 0
        const stagger = (ci % 2) * (Math.PI / (sizeS * 2))
        const angle = (si * 2 * Math.PI) / sizeS + stagger
        const x = Math.cos(angle) * ringRadius
        const z = Math.sin(angle) * ringRadius
        const y = ci * verticalGap - halfH
        positions[i] = [x, y, z]
      }
      break
    }

    case 'circular':
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n
        positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
      }
      break

    case 'torus': {
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
      let majorRadius = radius * 0.9
      let minorRadius = radius * 0.35
      if (n === 0) break

      if (isPipeProduct) {
        const tokenLists = group.elements.map(el => el.id.split('|'))
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
        majorRadius = Math.max(majorRadius, Math.min(radius * 1.2, Math.max(1, m0) * 0.6))
        minorRadius = Math.max(minorRadius, Math.min(radius * 0.6, Math.max(1, m1) * 0.28))

        for (let i = 0; i < n; i++) {
          const toks = group.elements[i].id.split('|')
          const a = (map0.get(toks[0] ?? '') ?? 0) / Math.max(1, m0) * 2 * Math.PI
          const b = (map1.get(toks[1] ?? '') ?? 0) / Math.max(1, m1) * 2 * Math.PI
          const x = (majorRadius + minorRadius * Math.cos(b)) * Math.cos(a)
          const y = minorRadius * Math.sin(b)
          const z = (majorRadius + minorRadius * Math.cos(b)) * Math.sin(a)
          positions[i] = [x, y, z]
        }
        break
      }

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
          positions[i] = [x, y, z]
        }
        break
      }
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      break
    }

    case 'hexagon': {
      if (n === 6 && group.symbol === 'S_{3}') {
        const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
        const cycleOrder = ['1,2,3','2,1,3','2,3,1','3,2,1','3,1,2','1,3,2']
        cycleOrder.forEach((id, i) => {
          const idx = idToIdx.get(id)
          if (idx !== undefined) {
            const angle = (i * 2 * Math.PI) / n
            positions[idx] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
          }
        })
      } else {
        for (let i = 0; i < n; i++) {
          const angle = (i * 2 * Math.PI) / n
          positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
        }
      }
      break
    }

    case 'dihedral': {
      const halfN = Math.floor(n / 2)
      const rRadius = radius * 0.85
      for (let i = 0; i < halfN; i++) {
        const angle = (i * 2 * Math.PI) / halfN
        positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
      }
      for (let i = halfN; i < n; i++) {
        const angle = ((i - halfN) * 2 * Math.PI) / (n - halfN)
        positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
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
          ['1,3,4,2', '1,4,2,3', '1,2,3,4'],
          ['2,4,3,1', '2,3,1,4', '2,1,4,3'],
          ['4,2,1,3', '4,1,3,2', '4,3,2,1'],
          ['3,1,2,4', '3,2,4,1', '3,4,1,2'],
        ]
        const verts = truncatedTetrahedron(radius)
        for (let f = 0; f < 4; f++) {
          for (let v = 0; v < 3; v++) {
            const idx = idToIdx.get(faceIds[f][v])
            if (idx !== undefined) {
              const [x, y, z] = verts[f * 3 + v]
              positions[idx] = [x, y, z]
            }
          }
        }
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
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
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'spherical':
    default: {
      const sphereRadius = Math.max(5, Math.pow(n, 1 / 3) * 2.2)
      for (let i = 0; i < n; i++) {
        positions[i] = fibonacciSphere(n, sphereRadius)[i]
      }
      break
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



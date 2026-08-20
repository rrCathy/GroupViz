export type Vec3 = [number, number, number]

const POLYHEDRON_CACHE = new Map<string, Vec3[]>()
const EDGE_CACHE = new Map<string, [number, number][]>()

function scaleVerts(verts: Vec3[], radius: number): Vec3[] {
  const maxCoord = Math.max(...verts.flatMap(v => v.map(Math.abs)))
  const s = radius / maxCoord
  return verts.map(v => [v[0] * s, v[1] * s, v[2] * s])
}

function cachePolyhedron(key: string, radius: number, build: () => Vec3[]): Vec3[] {
  const cacheKey = `${key}:${radius}`
  const cached = POLYHEDRON_CACHE.get(cacheKey)
  if (cached) return cached.map(v => [v[0], v[1], v[2]])
  const verts = build()
  POLYHEDRON_CACHE.set(cacheKey, verts)
  return verts.map(v => [v[0], v[1], v[2]])
}

// ============================================================
// Truncated Tetrahedron  缺角四面体 (12 verts)
// All permutations of (±1, ±1, ±3) with even # of minus signs
// ============================================================
export function truncatedTetrahedron(radius = 5): Vec3[] {
  return scaleVerts([
    [1, 1, 3], [1, 3, 1], [3, 1, 1],
    [1, -1, -3], [1, -3, -1], [3, -1, -1],
    [-1, 1, -3], [-1, 3, -1], [-3, 1, -1],
    [-1, -1, 3], [-1, -3, 1], [-3, -1, 1],
  ], radius)
}

// ============================================================
// Truncated Cube  缺角立方体 (24 verts)
// All permutations of (±1, ±1, ±(1+√2))
// ============================================================
export function truncatedCube(radius = 5): Vec3[] {
  // All permutations of (±1/δ, ±1, ±1) with δ = 1+√2 (silver ratio);
  // 24 vertices, 3-regular, 36 edges.
  const v = Math.SQRT2 - 1
  const raw: Vec3[] = []
  for (const [a, b, c] of [[1, 1, v], [1, v, 1], [v, 1, 1]]) {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          raw.push([a * sx, b * sy, c * sz])
  }
  return scaleVerts(raw, radius)
}

// ============================================================
// Rhombicuboctahedron  （小斜方截半）立方体 (24 verts, 48 edges)
// All permutations of (±1, ±1, ±(1+√2))
// ============================================================
export function rhombicuboctahedron(radius = 5): Vec3[] {
  const v = 1 + Math.SQRT2
  const raw: Vec3[] = []
  for (const p of [[1, 1, v], [1, v, 1], [v, 1, 1]]) {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          raw.push([p[0] * sx, p[1] * sy, p[2] * sz])
  }
  return scaleVerts(raw, radius)
}

// ============================================================
// Truncated Octahedron  截角八面体 (24 verts)
// All permutations of (0, ±1, ±2)
// ============================================================
export function truncatedOctahedron(radius = 5): Vec3[] {
  const raw: Vec3[] = []
  for (const p of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 0, 1], [1, 2, 0], [2, 1, 0]]) {
    for (const s1 of p[0] !== 0 ? [-1, 1] : [1])
      for (const s2 of p[1] !== 0 ? [-1, 1] : [1])
        for (const s3 of p[2] !== 0 ? [-1, 1] : [1])
          raw.push([p[0] * s1, p[1] * s2, p[2] * s3])
  }
  return scaleVerts(raw, radius)
}

// ============================================================
// Truncated Icosahedron  截角二十面体 (60 verts)
// Even permutations of 3 sets: φ = (1+√5)/2
// ============================================================
export function truncatedIcosahedron(radius = 5): Vec3[] {
  return cachePolyhedron('truncatedIcosahedron', radius, () => {
    const φ = (1 + Math.sqrt(5)) / 2
    const raw: Vec3[] = []
    const sets: Vec3[] = [
      [0, 1, 3 * φ],
      [1, 2 + φ, 2 * φ],
      [φ, 2, 1 + 2 * φ],
    ]
    for (const [a, b, c] of sets) {
      const evenPerms: Vec3[] = [[a, b, c], [c, a, b], [b, c, a]]
      for (const [x, y, z] of evenPerms) {
        for (const sx of x !== 0 ? [-1, 1] : [1])
          for (const sy of y !== 0 ? [-1, 1] : [1])
            for (const sz of z !== 0 ? [-1, 1] : [1])
              raw.push([x * sx, y * sy, z * sz])
      }
    }
    return scaleVerts(raw, radius)
  })
}

// ============================================================
// Truncated Dodecahedron  截角十二面体 (60 verts)
// Even permutations of 3 sets: φ = (1+√5)/2
// ============================================================
export function truncatedDodecahedron(radius = 5): Vec3[] {
  return cachePolyhedron('truncatedDodecahedron', radius, () => {
    const φ = (1 + Math.sqrt(5)) / 2
    const raw: Vec3[] = []
    const sets: Vec3[] = [
      [0, 1 / φ, 2 + φ],
      [1 / φ, φ, 2 * φ],
      [φ, 2, φ + 1],
    ]
    for (const [a, b, c] of sets) {
      const evenPerms: Vec3[] = [[a, b, c], [c, a, b], [b, c, a]]
      for (const [x, y, z] of evenPerms) {
        for (const sx of x !== 0 ? [-1, 1] : [1])
          for (const sy of y !== 0 ? [-1, 1] : [1])
            for (const sz of z !== 0 ? [-1, 1] : [1])
              raw.push([x * sx, y * sy, z * sz])
      }
    }
    return scaleVerts(raw, radius)
  })
}

export type PolyhedronType =
  | 'truncatedTetrahedron'
  | 'truncatedCube'
  | 'rhombicuboctahedron'
  | 'truncatedOctahedron'
  | 'truncatedIcosahedron'
  | 'truncatedDodecahedron'

// Compute polyhedron skeleton edges (wireframe) from vertex positions.
// For a convex regular solid the true edge length is the FIRST distance bin
// whose pair count is an integer multiple of n/2 with degree >= 3 (i.e.
// count = d*n/2 where d is the vertex degree: 3-regular solids give 3n/2,
// 4-regular ones like the rhombicuboctahedron give 2n). Pseudo-distance bins
// (e.g. truncated icosahedron's second-nearest spacing → 120 pairs, or the
// rhombicuboctahedron's 24 short pairs) either fall below 3n/2 or precede the
// true edge bin in distance order, so they are skipped. Using the modal bin
// instead selects a pseudo-edge length, which breaks skeleton isomorphism
// detection.
export function computeSkeletonEdges(verts: Vec3[]): [number, number][] {
  const cacheKey = verts.map(v => v.join(',')).join('|')
  const cached = EDGE_CACHE.get(cacheKey)
  if (cached) return cached
  const n = verts.length
  const bins = new Map<number, number>()

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = verts[i][0] - verts[j][0]
      const dy = verts[i][1] - verts[j][1]
      const dz = verts[i][2] - verts[j][2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const key = Math.round(dist * 100)
      bins.set(key, (bins.get(key) || 0) + 1)
    }
  }

  const half = n / 2
  const sortedKeys = [...bins.keys()].sort((a, b) => a - b)
  let edgeKey = 0
  for (const key of sortedKeys) {
    const count = bins.get(key)!
    if (count >= 3 * half && count % half === 0) { edgeKey = key; break }
  }
  if (edgeKey === 0) {
    let maxCount = 0
    for (const [key, count] of bins) {
      if (count > maxCount) { maxCount = count; edgeKey = key }
    }
  }

  const edgeDist = edgeKey / 100
  const tol = edgeDist * 0.03
  const edges: [number, number][] = []

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = verts[i][0] - verts[j][0]
      const dy = verts[i][1] - verts[j][1]
      const dz = verts[i][2] - verts[j][2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (Math.abs(dist - edgeDist) < tol) edges.push([i, j])
    }
  }
  EDGE_CACHE.set(cacheKey, edges)
  return edges
}

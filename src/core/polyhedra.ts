type Vec3 = [number, number, number]

function scaleVerts(verts: Vec3[], radius: number): Vec3[] {
  const maxCoord = Math.max(...verts.flatMap(v => v.map(Math.abs)))
  const s = radius / maxCoord
  return verts.map(v => [v[0] * s, v[1] * s, v[2] * s])
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
  const v = 1 + Math.SQRT2
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
// Rhombicuboctahedron  (24 verts)
// All even permutations of (±1, ±(√2-1), ±(√2+1))
// ============================================================
export function rhombicuboctahedron(radius = 5): Vec3[] {
  const s = Math.SQRT2
  const a = 1, b = s - 1, c = s + 1
  const raw: Vec3[] = []
  for (const p of [[a, b, c], [c, a, b], [b, c, a]]) {
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
}

// ============================================================
// Truncated Dodecahedron  截角十二面体 (60 verts)
// Even permutations of 3 sets: φ = (1+√5)/2
// ============================================================
export function truncatedDodecahedron(radius = 5): Vec3[] {
  const φ = (1 + Math.sqrt(5)) / 2
  const raw: Vec3[] = []
  const sets: Vec3[] = [
    [0, 1 / φ, 2 + φ],
    [1 / φ, 1, 2 * φ],
    [1 / φ, φ, 1 + 2 * φ],
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
}

export type PolyhedronType =
  | 'truncatedTetrahedron'
  | 'truncatedCube'
  | 'rhombicuboctahedron'
  | 'truncatedOctahedron'
  | 'truncatedIcosahedron'
  | 'truncatedDodecahedron'

// Compute polyhedron skeleton edges (wireframe) from vertex positions
// Finds the most common inter-vertex distance (= edge length for uniform solids)
export function computeSkeletonEdges(verts: Vec3[]): [number, number][] {
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

  let maxCount = 0, edgeKey = 0
  for (const [key, count] of bins) {
    if (count > maxCount) { maxCount = count; edgeKey = key }
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
  return edges
}

export function getPolyhedronVerts(type: PolyhedronType, radius = 5): Vec3[] {
  switch (type) {
    case 'truncatedTetrahedron': return truncatedTetrahedron(radius)
    case 'truncatedCube': return truncatedCube(radius)
    case 'rhombicuboctahedron': return rhombicuboctahedron(radius)
    case 'truncatedOctahedron': return truncatedOctahedron(radius)
    case 'truncatedIcosahedron': return truncatedIcosahedron(radius)
    case 'truncatedDodecahedron': return truncatedDodecahedron(radius)
  }
}

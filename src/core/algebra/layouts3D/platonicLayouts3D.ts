import type { Group } from '../../types'
import { isC2Tesseract } from '../../types'
import { fibonacciSphere, type Vec3 } from './shared'
import { getTetrahedronVerts, getCubeVerts, getCuboctahedronVerts } from './polyhedraVerts'

export function tetrahedronLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  const positions: Vec3[] = new Array(n)
  const verts = getTetrahedronVerts(radius)
  for (let i = 0; i < Math.min(n, verts.length); i++) {
    positions[i] = verts[i]
  }
  for (let i = verts.length; i < n; i++) {
    const extra = fibonacciSphere(n - verts.length, radius * 1.2)
    positions[i] = extra[i - verts.length]
  }
  return positions
}

export function cubeLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  const positions: Vec3[] = new Array(n)
  const verts = getCubeVerts(radius)
  for (let i = 0; i < Math.min(n, verts.length); i++) {
    positions[i] = verts[i]
  }
  for (let i = verts.length; i < n; i++) {
    const extra = fibonacciSphere(n - verts.length, radius * 1.3)
    positions[i] = extra[i - verts.length]
  }
  return positions
}

export function cuboctahedronLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  const positions: Vec3[] = new Array(n)
  const verts = getCuboctahedronVerts(radius)
  for (let i = 0; i < Math.min(n, verts.length); i++) {
    positions[i] = verts[i]
  }
  for (let i = verts.length; i < n; i++) {
    const extra = fibonacciSphere(n - verts.length, radius * 1.1)
    positions[i] = extra[i - verts.length]
  }
  return positions
}

export function hypercubeLayout3D(group: Group, radius: number): Vec3[] | null {
  // C₂⁴ 超立方体：外立方体（w=0，边长 radius）× 内立方体（w=1，边长 radius*0.55）同心投影
  const n = group.order
  const positions: Vec3[] = new Array(n)
  if (n !== 16 || !isC2Tesseract(group)) {
    for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    return positions
  }
  const id = group.identity
  const subIds = new Set<string>([id.id])
  const bits: string[] = []
  for (const el of group.elements) {
    if (subIds.size >= n) break
    if (el.id === id.id || subIds.has(el.id)) continue
    const next = new Set(subIds)
    let ok = true
    for (const a of subIds) {
      const elA = group.elements.find(e => e.id === a)
      if (!elA) { ok = false; break }
      const prod = group.multiply(elA, el).id
      if (next.has(prod)) { ok = false; break }
      next.add(prod)
    }
    if (ok) {
      bits.push(el.id)
      for (const x of next) subIds.add(x)
    }
  }
  if (subIds.size !== n) {
    for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    return positions
  }
  const maskOf = new Map<string, number>()
  for (let m = 0; m < n; m++) {
    let acc = group.identity
    for (let b = 0; b < bits.length; b++) {
      if (m & (1 << b)) {
        const elB = group.elements.find(e => e.id === bits[b])
        if (elB) acc = group.multiply(acc, elB)
      }
    }
    maskOf.set(acc.id, m)
  }
  for (let i = 0; i < n; i++) {
    const mask = maskOf.get(group.elements[i].id) ?? i
    const s = (mask & 8) ? radius * 0.55 : radius
    positions[i] = [(mask & 1 ? s : -s), (mask & 2 ? s : -s), (mask & 4 ? s : -s)]
  }
  return positions
}

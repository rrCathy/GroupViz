import type { Group, GroupElement } from './types'

export interface RotationInfo {
  axis: [number, number, number]
  angleRad: number
  label: string
}

function getCycleType(elements: number[]): string {
  const n = elements.length
  const visited = new Array(n).fill(false)
  const cycles: number[] = []
  const normalized = elements.map((v: number) => v - 1)
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    let len = 0
    let j = i
    while (!visited[j]) { visited[j] = true; j = normalized[j]; len++ }
    if (len > 1) cycles.push(len)
  }
  return cycles.sort().join('-') || '1'
}

function elementHash(mod: number, ...ids: string[]): number {
  let h = 0
  for (const s of ids) for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

function getNormalizedAxis(k: number, count: number, axes: readonly [number, number, number][]): [number, number, number] {
  return axes[k % count]
}

const CUBE_FACE_AXES: readonly [number, number, number][] = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
]

const invSqrt3 = 1 / Math.sqrt(3)
const invSqrt2 = 1 / Math.sqrt(2)

const CUBE_DIAGONAL_AXES: readonly [number, number, number][] = [
  [invSqrt3, invSqrt3, invSqrt3], [invSqrt3, -invSqrt3, -invSqrt3], [-invSqrt3, invSqrt3, -invSqrt3], [-invSqrt3, -invSqrt3, invSqrt3],
]

const CUBE_EDGE_AXES: readonly [number, number, number][] = [
  [invSqrt2, invSqrt2, 0], [invSqrt2, 0, invSqrt2], [0, invSqrt2, invSqrt2],
  [invSqrt2, -invSqrt2, 0], [invSqrt2, 0, -invSqrt2], [0, invSqrt2, -invSqrt2],
]

const TETRA_VERTEX_AXES: readonly [number, number, number][] = [
  [invSqrt3, invSqrt3, invSqrt3], [invSqrt3, -invSqrt3, -invSqrt3], [-invSqrt3, invSqrt3, -invSqrt3], [-invSqrt3, -invSqrt3, invSqrt3],
]

const TETRA_EDGE_AXES: readonly [number, number, number][] = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
]

export function computeElementRotation(group: Group, element: GroupElement): RotationInfo | null {
  const sym = group.symbol
  const val = element.value
  const order = group.order
  const idx = group.elements.findIndex(e => e.id === element.id)

  if (idx === 0) {
    return { axis: [0, 1, 0], angleRad: 0, label: '恒等变换' }
  }

  if (sym.startsWith('C')) {
    const count = val[0] ?? 0
    const deg = Math.round((count * 360) / order) % 360
    return { axis: [0, 1, 0], angleRad: (count * 2 * Math.PI) / order, label: `绕 Y 轴旋转 ${deg}°` }
  }

  if (sym.startsWith('D')) {
    const n = order / 2
    const k = val[0]
    const s = val[1] ?? 0
    if (s === 0) {
      const deg = Math.round((k * 360) / n) % 360
      return { axis: [0, 1, 0], angleRad: (k * 2 * Math.PI) / n, label: `绕 Y 轴旋转 ${deg}°` }
    }
    const refAngle = (k * Math.PI) / n
    return { axis: [Math.cos(refAngle), 0, Math.sin(refAngle)], angleRad: Math.PI, label: `绕 ${Math.round(refAngle*180/Math.PI)}° 轴翻转 180°` }
  }

  if (sym === 'V₄' || sym === 'V4') {
    const m: Record<string, RotationInfo> = {
      '1,3,2,4': { axis: [0, 1, 0], angleRad: Math.PI, label: '绕 Y 轴旋转 180°' },
      '2,1,4,3': { axis: [1, 0, 0], angleRad: Math.PI, label: '绕 X 轴旋转 180°' },
      '2,3,1,4': { axis: [0, 0, 1], angleRad: Math.PI, label: '绕 Z 轴旋转 180°' },
    }
    for (const pattern of Object.keys(m)) {
      const patternNums = pattern.split(',').map(Number)
      if (val.length === patternNums.length && val.every((v: number, i: number) => v === patternNums[i])) {
        return m[pattern]
      }
    }
    return { axis: [0, 1, 0], angleRad: ((idx) * 2 * Math.PI) / order, label: `旋转 ${Math.round((idx*360)/order)}°` }
  }

  if ((sym === 'A₄' || sym === 'A4') && val.length >= 4) {
    const ct = getCycleType(val)
    if (ct === '3') {
      const k = elementHash(4, element.id)
      const axis = getNormalizedAxis(k, 4, TETRA_VERTEX_AXES)
      const deg = 120
      return { axis, angleRad: (2 * Math.PI) / 3 * (k % 2 === 0 ? 1 : -1), label: `绕体对角线旋转 ${deg}°` }
    }
    if (ct === '2-2') {
      const k = elementHash(3, element.id)
      const axis = getNormalizedAxis(k, 3, TETRA_EDGE_AXES)
      return { axis, angleRad: Math.PI, label: '绕边中点轴旋转 180°' }
    }
    return { axis: [0, 1, 0], angleRad: 0, label: '' }
  }

  if ((sym === 'S₄' || sym === 'S4') && val.length >= 4) {
    const ct = getCycleType(val)
    if (ct === '4') {
      const k = elementHash(3, element.id, '4c')
      const axis = getNormalizedAxis(k, 3, CUBE_FACE_AXES)
      const deg = 90
      return { axis, angleRad: (Math.PI / 2) * (k % 2 === 0 ? 1 : -1), label: `绕面心轴旋转 ${deg}°` }
    }
    if (ct === '3') {
      const k = elementHash(4, element.id, '3c')
      const axis = getNormalizedAxis(k, 4, CUBE_DIAGONAL_AXES)
      const deg = 120
      return { axis, angleRad: (2 * Math.PI) / 3 * (k % 2 === 0 ? 1 : -1), label: `绕体对角线旋转 ${deg}°` }
    }
    if (ct === '2-2') {
      const k = elementHash(3, element.id, '2c')
      const axis = getNormalizedAxis(k, 3, CUBE_FACE_AXES)
      return { axis, angleRad: Math.PI, label: '绕面心轴旋转 180°' }
    }
    if (ct === '2') {
      const k = elementHash(6, element.id, 'tc')
      const axis = getNormalizedAxis(k, 6, CUBE_EDGE_AXES)
      return { axis, angleRad: Math.PI, label: '绕边中点轴旋转 180°' }
    }
    return { axis: [0, 1, 0], angleRad: 0, label: '' }
  }

  if ((sym === 'A₅' || sym === 'A5') && val.length >= 5) {
    const ct = getCycleType(val)
    if (ct === '5') {
      const k = elementHash(6, element.id, '5c')
      const axis = getNormalizedAxis(k, 6, CUBE_FACE_AXES.concat(CUBE_DIAGONAL_AXES))
      const deg = 72
      return { axis, angleRad: (2 * Math.PI) / 5 * (k % 2 === 0 ? 1 : -1), label: `绕五阶轴旋转 ${deg}°` }
    }
    if (ct === '3') {
      const k = elementHash(10, element.id, '3c')
      const axis = getNormalizedAxis(k, 10, CUBE_DIAGONAL_AXES.concat(CUBE_EDGE_AXES.slice(0, 3)).concat(CUBE_FACE_AXES))
      const deg = 120
      return { axis, angleRad: (2 * Math.PI) / 3 * (k % 2 === 0 ? 1 : -1), label: `绕三阶轴旋转 ${deg}°` }
    }
    if (ct === '2-2') {
      const invLen1 = 1 / Math.sqrt(1 + 0.618 * 0.618)
      const k = elementHash(15, element.id, '2c')
      const axis = getNormalizedAxis(k, 15, [
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [invSqrt2, invSqrt2, 0], [invSqrt2, 0, invSqrt2], [0, invSqrt2, invSqrt2],
        [invSqrt2, -invSqrt2, 0], [invSqrt2, 0, -invSqrt2], [0, invSqrt2, -invSqrt2],
        [invLen1, 0.618 * invLen1, 0], [0, invLen1, 0.618 * invLen1], [0.618 * invLen1, 0, invLen1],
        [invLen1, -0.618 * invLen1, 0], [0, invLen1, -0.618 * invLen1], [-0.618 * invLen1, 0, invLen1],
      ])
      return { axis, angleRad: Math.PI, label: '绕二阶轴旋转 180°' }
    }
    return { axis: [0, 1, 0], angleRad: 0, label: '' }
  }

  return null
}

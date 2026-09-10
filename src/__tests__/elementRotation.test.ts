import { describe, it, expect } from 'vitest'
import { computeElementRotation } from '../core/elementRotation'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import type { Group } from '../core/types'

function mockGroup(symbol: string, order: number, values: number[][]): Group {
  const elements = values.map((value, i) => ({ id: String(i), label: '', value }))
  return {
    symbol,
    order,
    identity: elements[0],
    elements,
  } as unknown as Group
}

// ---- 几何反解回归工具 ----
function cycleLengths(val: number[]): number[] {
  const n = val.length
  const visited = new Array(n).fill(false)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    let len = 0, j = i
    while (j >= 0 && j < n && !visited[j]) { visited[j] = true; j = val[j] - 1; len++ }
    if (len > 1) out.push(len)
  }
  return out.sort()
}
function cycleType(val: number[]): string { return cycleLengths(val).join('-') || '1' }

function axisKey(a: [number, number, number]): string {
  const r = a.map(x => Math.round(x * 1e4) / 1e4)
  const f = r.find(v => Math.abs(v) > 1e-9) ?? 0
  return (f < 0 ? r.map(x => -x) : r).join(',')
}

/** 由轴角重建旋转矩阵（列主序无关，按行主序），用于验证群同态。 */
function rodrigues(axis: [number, number, number], ang: number): number[][] {
  const len = Math.hypot(...axis)
  const [x, y, z] = axis.map(v => v / len)
  const c = Math.cos(ang), s = Math.sin(ang), C = 1 - c
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ]
}
function matMul(A: number[][], B: number[][]) {
  return A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
}

function rotationsOf(group: Group) {
  return group.elements.map(el => ({ el, r: computeElementRotation(group, el)! }))
}

function assertHomomorphism(group: Group) {
  const map = new Map<string, number[][]>()
  for (const el of group.elements) {
    const r = computeElementRotation(group, el)!
    map.set(el.id, rodrigues(r.axis, r.angleRad))
  }
  for (const a of group.elements) {
    for (const b of group.elements) {
      const ab = group.multiply(a, b)
      const lhs = map.get(ab.id)!
      const rhs = matMul(map.get(a.id)!, map.get(b.id)!)
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        expect(Math.abs(lhs[i][j] - rhs[i][j])).toBeLessThan(1e-7)
      }
    }
  }
}

function axesByCycleType(group: Group): Map<string, { axes: Set<string>; count: number }> {
  const out = new Map<string, { axes: Set<string>; count: number }>()
  for (const el of group.elements) {
    const r = computeElementRotation(group, el)!
    const ct = cycleType(el.value)
    const e = out.get(ct) ?? { axes: new Set<string>(), count: 0 }
    if (r.angleRad !== 0) e.axes.add(axisKey(r.axis))
    e.count++
    out.set(ct, e)
  }
  return out
}

describe('computeElementRotation', () => {
  it('identity element gets the identity rotation (angle 0)', () => {
    const group = mockGroup('S_{4}', 24, [[], [2, 1, 4, 3]])
    const r = computeElementRotation(group, group.elements[0])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(0)
  })

  it('returns rotation info for valid S4 double transposition', () => {
    const group = mockGroup('S_{4}', 24, [[], [2, 1, 4, 3]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(Math.PI)
  })

  it('does not hang on malformed values (0-indexed or out-of-range entries)', () => {
    const group = mockGroup('A_{5}', 60, [
      [],
      [1, 2, 0, 4, 5],
      [2, 3, 1, 5, 4],
      [1, 0, 2, 3, 4],
    ])
    for (const el of group.elements.slice(1)) {
      const r = computeElementRotation(group, el)
      expect(r).not.toBeNull()
    }
  })

  it('returns null for unsupported group symbols', () => {
    const group = mockGroup('X_{9}', 9, [[], [1, 2, 3]])
    expect(computeElementRotation(group, group.elements[1])).toBeNull()
  })

  it('maps cyclic group element to a rotation around Y axis', () => {
    const group = mockGroup('C_{6}', 6, [[], [2]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.axis).toEqual([0, 1, 0])
    expect(r!.angleRad).toBeCloseTo((2 * 2 * Math.PI) / 6)
  })

  it('maps S3 3-cycle to 120° rotation and transposition to 180° flip', () => {
    // S3 ≅ D3: identity + two 3-cycles (ct '3') + three transpositions (ct '2')
    const group = mockGroup('S_{3}', 6, [
      [],
      [2, 3, 1], // 3-cycle
      [3, 1, 2], // 3-cycle
      [2, 1, 3], // transposition (fix 3)
    ])
    const r3 = computeElementRotation(group, group.elements[1])
    expect(r3).not.toBeNull()
    expect(Math.abs(r3!.angleRad)).toBeCloseTo((2 * Math.PI) / 3, 5)
    const r2 = computeElementRotation(group, group.elements[3])
    expect(r2).not.toBeNull()
    expect(r2!.angleRad).toBe(Math.PI)
    expect(r2!.axis[1]).toBe(0)
  })

  it('maps dihedral reflection to a flip about an axis in the XZ plane', () => {
    const group = mockGroup('D_{4}', 8, [[0, 0], [1, 1]])
    const r = computeElementRotation(group, group.elements[1])
    expect(r).not.toBeNull()
    expect(r!.angleRad).toBe(Math.PI)
    expect(r!.axis[1]).toBe(0)
  })
})

// 回归：轴由置换几何反解，不再 hash(id)%n 撞桶（BUGREPORT 2026-09-10）
describe('computeElementRotation — permutation-derived axes', () => {
  const A4 = createAlternatingGroup(4)
  const S4 = createSymmetricGroup(4)
  const A5 = createAlternatingGroup(5)

  it('A4: 8 three-cycles split into 4 axes, each pair inverse (opposite sign)', () => {
    const three = rotationsOf(A4).filter(({ el }) => cycleType(el.value) === '3')
    expect(three).toHaveLength(8)
    const axes = new Set(three.map(({ r }) => axisKey(r.axis)))
    expect(axes.size).toBe(4)
    for (const key of axes) {
      const pair = three.filter(({ r }) => axisKey(r.axis) === key)
      expect(pair).toHaveLength(2)
      const sign = Math.sign(pair[0].r.angleRad)
      expect(Math.abs(pair[0].r.angleRad)).toBeCloseTo((2 * Math.PI) / 3, 6)
      expect(Math.abs(pair[1].r.angleRad)).toBeCloseTo((2 * Math.PI) / 3, 6)
      expect(Math.sign(pair[1].r.angleRad)).toBe(-sign)
    }
  })

  it('A4: 3-cycle axis passes through the fixed point vertex', () => {
    const inv = 1 / Math.sqrt(3)
    const vertices: [number, number, number][] = [
      [inv, inv, inv], [inv, -inv, -inv], [-inv, inv, -inv], [-inv, -inv, inv],
    ]
    for (const el of A4.elements) {
      if (cycleType(el.value) !== '3') continue
      const fixed = el.value.findIndex((v, i) => v === i + 1)
      const r = computeElementRotation(A4, el)!
      const v = vertices[fixed]
      const dot = r.axis[0] * v[0] + r.axis[1] * v[1] + r.axis[2] * v[2]
      expect(Math.abs(dot)).toBeCloseTo(1, 6) // 轴 ∥ 不动点所在顶点
    }
  })

  it('A4: distinct axis counts match the spec (3-cycle=4, 2-2=3)', () => {
    const by = axesByCycleType(A4)
    expect(by.get('3')!.axes.size).toBe(4)
    expect(by.get('2-2')!.axes.size).toBe(3)
  })

  it('S4: distinct axis counts match the spec (4c=3, 3c=4, 2-2=3, 2c=6)', () => {
    const by = axesByCycleType(S4)
    expect(by.get('4')!.axes.size).toBe(3)
    expect(by.get('3')!.axes.size).toBe(4)
    expect(by.get('2-2')!.axes.size).toBe(3)
    expect(by.get('2')!.axes.size).toBe(6)
  })

  it('A5: distinct axis counts match the spec (5c=6, 3c=10, 2-2=15)', () => {
    const by = axesByCycleType(A5)
    expect(by.get('5')!.axes.size).toBe(6)
    expect(by.get('3')!.axes.size).toBe(10)
    expect(by.get('2-2')!.axes.size).toBe(15)
  })

  it('A4/S4/A5: axis+angle form a faithful rotation representation (homomorphism)', () => {
    assertHomomorphism(A4)
    assertHomomorphism(S4)
    assertHomomorphism(A5)
  })

  it('all returned axes are unit vectors', () => {
    for (const group of [A4, S4, A5]) {
      for (const el of group.elements) {
        const r = computeElementRotation(group, el)!
        expect(Math.hypot(...r.axis)).toBeCloseTo(1, 6)
      }
    }
  })
})


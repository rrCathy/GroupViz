import { describe, it, expect } from 'vitest'
import { multiplyGL2, detGL2, inverseGL2, type GL2Matrix } from '../core/groups/GeneralLinearGroup'
import { createTableGroup } from '../core/groups/SmallGroups/tableGroup'
import { sl23Quat, sl23Matrix, sl23MatrixLabel, sl23Spin } from '../core/groups/sl23'
import { SMALL_GROUP_DATA } from '../core/groups/smallGroupData'

const F3 = 3
const rec = SMALL_GROUP_DATA.find(r => r.n === 24 && r.i === 3)!
const table = rec.table
const N = 24

const qmul = (p: number[], q: number[]): number[] => {
  const [a1, b1, c1, d1] = p
  const [a2, b2, c2, d2] = q
  // 与模块同口径归一 -0（(-k)*0 的 IEEE 产物）：否则 toEqual 会把 -0 与 0 判为不等
  const nz = (v: number): number => (v === 0 ? 0 : v)
  return [
    nz((a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2) / 2),
    nz((a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2) / 2),
    nz((a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2) / 2),
    nz((a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2) / 2),
  ]
}

describe('sl23 同构（SmallGroup(24,3) ↔ 2T ↔ SL(2,3) 矩阵）', () => {
  it('表群 (24,3) 存在且阶 24', () => {
    expect(rec.structure).toBe('SL(2,3)')
    expect(table.length).toBe(N)
  })

  it('配对是同态：24×24 乘法表逐格成立', () => {
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const want = sl23Quat(table[x][y] - 1)
        const got = qmul(sl23Quat(x), sl23Quat(y))
        expect(got).toEqual(want)
      }
    }
  })

  it('配对是双射（24 个四元数互不相同）', () => {
    const keys = new Set<string>()
    for (let k = 0; k < N; k++) keys.add(sl23Quat(k).join(','))
    expect(keys.size).toBe(N)
  })

  it('矩阵嵌入：全部 det=1、规范入口 [0,3)、同态、单射', () => {
    const seen = new Set<string>()
    for (let k = 0; k < N; k++) {
      const m = sl23Matrix(k)
      expect(detGL2(m, F3)).toBe(1)
      // 规范入口：JS `%` 保号，未归一会出 -1/-2——标签直接插值、multiplyGL2 键查找都假定规范
      expect(m.every(v => v >= 0 && v < F3)).toBe(true)
      seen.add(m.join(','))
    }
    expect(seen.size).toBe(N)
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const want = sl23Matrix(table[x][y] - 1)
        const got = multiplyGL2(sl23Matrix(x), sl23Matrix(y), F3)
        expect(got).toEqual(want)
      }
    }
  })

  it('四元数阶分布 = {1:1, 2:1, 3:8, 4:6, 6:8}', () => {
    const ordOf = (q: number[]): number => {
      // 恒等四元数 = (2,0,0,0)（即 (a+bi+cj+dk)/2 的 a=2 其余 0）；
      // 曾误写为 `every(v => v === 0) && cur[0] === 2`（永假，tsc TS2367 抓到）
      const isOne = (x: number[]): boolean => x[0] === 2 && x[1] === 0 && x[2] === 0 && x[3] === 0
      let cur = [2, 0, 0, 0]
      for (let n = 1; n <= 24; n++) {
        cur = qmul(cur, q)
        if (isOne(cur)) return n
      }
      return -1
    }
    const dist: Record<number, number> = {}
    for (let k = 0; k < N; k++) {
      const o = ordOf(sl23Quat(k))
      dist[o] = (dist[o] ?? 0) + 1
    }
    expect(dist).toEqual({ 1: 1, 2: 1, 3: 8, 4: 6, 6: 8 })
  })

  it('双覆盖：24 个元素按 (axis, angle) 分像恰 12 类、每类 2 元', () => {
    // (axis, θ) 与 (-axis, 2π-θ) 是同一旋转——分像计数必须先把四元数对
    // {q, -q} 的两种规范折叠到同一 key；θ=π 边界（±i/±j/±k 四个 4 阶元对）
    // 还要规范轴本身（(û,π) 与 (−û,π) 同旋转）；恒等类（+I 的 angle=0 与
    // -I 的 fullTurn）折叠为 'id'。
    const EPS = 1e-9
    const canonKey = (s: { axis: [number, number, number] | null; angleRad: number; fullTurn: boolean }): string => {
      if (s.fullTurn || s.angleRad < EPS) return 'id'
      let a = s.angleRad
      let ax = s.axis
      if (a > Math.PI + EPS && ax) {
        a = 2 * Math.PI - a
        ax = ax.map(v => -v) as [number, number, number]
      } else if (Math.abs(a - Math.PI) < EPS && ax) {
        // (û,π) ≡ (−û,π)：规范轴 = 首个非零分量为正
        const i = ax.findIndex(v => Math.abs(v) > EPS)
        if (i >= 0 && ax[i] < 0) ax = ax.map(v => -v) as [number, number, number]
      }
      return `${ax!.map(v => v.toFixed(6)).join(',')}@${a.toFixed(6)}`
    }
    const image = new Map<string, number[]>()
    for (let k = 0; k < N; k++) {
      const s = sl23Spin(k)
      const key = canonKey(s)
      if (!image.has(key)) image.set(key, [])
      image.get(key)!.push(k)
    }
    expect(image.size).toBe(12)
    for (const ks of image.values()) expect(ks.length).toBe(2)
  })

  it('皮带戏法：−I（唯一 2 阶元）angleRad=2π、beltTwist=2π；单位元全 0', () => {
    let twoIdx = -1
    for (let k = 1; k < N; k++) {
      // 2 阶元素：表里 k·k = 0
      if (table[k][k] - 1 === 0) twoIdx = k
    }
    expect(twoIdx).toBeGreaterThan(0)
    const s = sl23Spin(twoIdx)
    expect(s.fullTurn).toBe(true)
    expect(s.angleRad).toBeCloseTo(Math.PI * 2, 9)
    expect(s.beltTwist).toBeCloseTo(Math.PI * 2, 9)
    expect(sl23Spin(0)).toEqual({ axis: null, angleRad: 0, beltTwist: 0, fullTurn: false })
  })

  it('矩阵标签：24 个互异 smallmatrix，恒等元 = 单位矩阵，无负项', () => {
    const labels = new Set<string>()
    for (let k = 0; k < N; k++) {
      const lb = sl23MatrixLabel(k)
      expect(lb.startsWith('\\begin{smallmatrix}')).toBe(true)
      // F₃ 元素显示为 0/1/2；出现 '-' 即 quatToMatrix 出口未归一
      expect(lb).not.toContain('-')
      labels.add(lb)
    }
    expect(labels.size).toBe(N)
    expect(sl23MatrixLabel(0)).toBe('\\begin{smallmatrix}1&0\\\\0&1\\end{smallmatrix}')
  })

  it('tableGroup(24,3)：label 已是矩阵、词标签 stash 进 wordLabel', () => {
    const g = createTableGroup(24, 3)
    expect(g.symbol).toBe('SL(2,3)')
    expect(g.order).toBe(24)
    expect(g.elements.length).toBe(24)
    for (const el of g.elements) {
      expect(el.label.startsWith('\\begin{smallmatrix}')).toBe(true)
      expect(typeof el.wordLabel).toBe('string')
      expect(el.wordLabel!.length).toBeGreaterThan(0)
    }
    // 恒等元标签 = 单位矩阵
    expect(g.identity.label).toBe('\\begin{smallmatrix}1&0\\\\0&1\\end{smallmatrix}')
  })

  it('矩阵群公理抽查：createTableGroup(24,3) 的 multiply 与矩阵乘法一致', () => {
    const g = createTableGroup(24, 3)
    const matOf = (id: string): GL2Matrix => sl23Matrix(Number(id.slice(1)))
    for (let x = 0; x < N; x += 5) {
      for (let y = 0; y < N; y += 7) {
        const prod = g.multiply(g.elements[x]!, g.elements[y]!)
        const want = multiplyGL2(matOf(g.elements[x]!.id), matOf(g.elements[y]!.id), F3)
        expect(sl23Matrix(Number(prod.id.slice(1)))).toEqual(want)
      }
    }
    // 逆元
    const inv = g.inverse(g.elements[3]!)
    const m = matOf(g.elements[3]!.id)
    expect(multiplyGL2(m, matOf(inv.id), F3)).toEqual([1, 0, 0, 1])
    void inverseGL2
  })
})

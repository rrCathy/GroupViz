import { describe, it, expect } from 'vitest'
import { createGL2, matrixLabel, multiplyGL2, inverseGL2, detGL2 } from '../core/groups/GeneralLinearGroup'
import { detectIsomorphicGroup } from '../core/algebra/subgroups'

describe('GL(2,p) matrix utilities', () => {
  it('matrixLabel produces a TeX smallmatrix', () => {
    expect(matrixLabel([1, 2, 0, 1])).toBe('\\begin{smallmatrix}1&2\\\\0&1\\end{smallmatrix}')
  })

  it('multiplyGL2 computes matrix product mod p', () => {
    // [1 2; 0 1] * [0 1; 1 2] mod 3 = [2 5; 1 2] = [2 2; 1 2]
    expect(multiplyGL2([1, 2, 0, 1], [0, 1, 1, 2], 3)).toEqual([2, 2, 1, 2])
    // mod 2 arithmetic wraps correctly
    expect(multiplyGL2([1, 1, 0, 1], [0, 1, 1, 0], 2)).toEqual([1, 1, 1, 0])
  })

  it('inverseGL2 inverts a matrix mod p', () => {
    // det([1 2; 0 1]) = 1 -> inverse is [1 -2; 0 1] = [1 1; 0 1] mod 3
    expect(inverseGL2([1, 2, 0, 1], 3)).toEqual([1, 1, 0, 1])
    const m = [1, 2, 3, 2] as [number, number, number, number]
    const inv = inverseGL2(m, 5)
    expect(multiplyGL2(m, inv, 5)).toEqual([1, 0, 0, 1])
    expect(multiplyGL2(inv, m, 5)).toEqual([1, 0, 0, 1])
  })

  it('detGL2 computes determinant mod p', () => {
    expect(detGL2([1, 2, 3, 4], 5)).toBe(3) // 4 - 6 = -2 = 3 mod 5
    expect(detGL2([0, 1, 1, 0], 2)).toBe(1)
  })
})

describe('GL(2,2) — isomorphic to S3', () => {
  it('has order 6 and is non-abelian', () => {
    const g = createGL2(2)
    expect(g.order).toBe(6)
    expect(g.isAbelian).toBe(false)
    expect(g.identity.value).toEqual([1, 0, 0, 1])
  })

  it('generators a and b both have order 2', () => {
    const g = createGL2(2)
    const [a, b] = g.generators
    expect(g.multiply(a.apply(g.identity), a.apply(g.identity)).id).toBe(g.identity.id)
    expect(g.multiply(b.apply(g.identity), b.apply(g.identity)).id).toBe(g.identity.id)
  })

  it('ab has order 3, so <a,b> is the whole group (S3)', () => {
    const g = createGL2(2)
    const [a, b] = g.generators
    const ab = g.multiply(a.apply(g.identity), b.apply(g.identity))
    const ab2 = g.multiply(ab, ab)
    expect(g.multiply(ab2, ab).id).toBe(g.identity.id)
    expect(ab.id).not.toBe(g.identity.id)
    expect(ab2.id).not.toBe(g.identity.id)
    // closure: every element is reachable from the two generators
    const reached = new Set<string>([g.identity.id])
    let frontier: string[] = [g.identity.id]
    while (frontier.length > 0) {
      const next: string[] = []
      for (const fid of frontier) {
        const el = g.elements.find(e => e.id === fid)!
        for (const gen of g.generators) {
          const t = gen.apply(el)
          if (!reached.has(t.id)) {
            reached.add(t.id)
            next.push(t.id)
          }
        }
      }
      frontier = next
    }
    expect(reached.size).toBe(6)
  })

  it('is detected as isomorphic to S3 (reported as D3, since D3 ≅ S3)', () => {
    const g = createGL2(2)
    expect(detectIsomorphicGroup(g)).toBe('D_{3}')
  })
})

describe('GL(2,3) — order 48', () => {
  it('has order 48 with all invertible matrices', () => {
    const g = createGL2(3)
    expect(g.order).toBe(48)
    // every element has nonzero determinant
    for (const el of g.elements) {
      expect(detGL2(el.value as [number, number, number, number], 3)).not.toBe(0)
    }
  })

  it('det: G -> GF(3)* is a homomorphism with kernel SL(2,3) of size 24', () => {
    const g = createGL2(3)
    const countDet1 = g.elements.filter(el => detGL2(el.value as [number, number, number, number], 3) === 1).length
    expect(countDet1).toBe(24)
    const a = g.elements[1]
    const b = g.elements[2]
    const da = detGL2(a.value as [number, number, number, number], 3)
    const db = detGL2(b.value as [number, number, number, number], 3)
    const dab = detGL2(g.multiply(a, b).value as [number, number, number, number], 3)
    expect(dab).toBe((da * db) % 3)
  })

  it('has center {±I} of size 2', () => {
    const g = createGL2(3)
    const center = g.elements.filter(el => g.elements.every(x => g.multiply(el, x).id === g.multiply(x, el).id))
    expect(center.length).toBe(2)
    expect(center.some(el => el.value.join(',') === '1,0,0,1')).toBe(true)
    expect(center.some(el => el.value.join(',') === '2,0,0,2')).toBe(true)
  })

  it('generators have order 3 and 2', () => {
    const g = createGL2(3)
    const [a, b] = g.generators
    const a2 = g.multiply(a.apply(g.identity), a.apply(g.identity))
    expect(g.multiply(a2, a.apply(g.identity)).id).toBe(g.identity.id)
    expect(a2.id).not.toBe(g.identity.id)
    expect(g.multiply(b.apply(g.identity), b.apply(g.identity)).id).toBe(g.identity.id)
  })

  it('inverse and identity hold for every element', () => {
    const g = createGL2(3)
    for (const el of g.elements) {
      expect(g.multiply(el, g.inverse(el)).id).toBe(g.identity.id)
    }
  })

  it('is associative on a sample', () => {
    const g = createGL2(3)
    for (let i = 0; i < 30; i++) {
      const [a, b, c] = [g.elements[(i * 7) % 48], g.elements[(i * 13) % 48], g.elements[(i * 17) % 48]]
      expect(g.multiply(g.multiply(a, b), c).id).toBe(g.multiply(a, g.multiply(b, c)).id)
    }
  })
})

describe('GL(2,p) parameter validation', () => {
  it('throws for non-prime p', () => {
    expect(() => createGL2(1)).toThrow()
    expect(() => createGL2(4)).toThrow()
    expect(() => createGL2(6)).toThrow()
  })

  it('computes GL(2,5) of order 480', () => {
    const g = createGL2(5)
    expect(g.order).toBe(480)
  })
})

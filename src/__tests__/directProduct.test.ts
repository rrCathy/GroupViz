import { describe, it, expect } from 'vitest'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createKleinFour } from '../core/groups/SpecialGroup'
import type { Group } from '../core/types'

function assertGroupAxioms(G: Group, sample = 15) {
  const idSet = new Set(G.elements.map(e => e.id))

  for (const a of G.elements) {
    expect(G.multiply(a, G.identity).id).toBe(a.id)
    expect(G.multiply(G.identity, a).id).toBe(a.id)
    const inv = G.inverse(a)
    expect(G.multiply(a, inv).id).toBe(G.identity.id)
    expect(G.multiply(inv, a).id).toBe(G.identity.id)
  }

  for (let i = 0; i < sample; i++) {
    const a = G.elements[Math.floor(Math.random() * G.order)]
    const b = G.elements[Math.floor(Math.random() * G.order)]
    const c = G.elements[Math.floor(Math.random() * G.order)]
    expect(idSet.has(G.multiply(a, b).id)).toBe(true)
    const ab = G.multiply(a, b)
    const bc = G.multiply(b, c)
    expect(G.multiply(ab, c).id).toBe(G.multiply(a, bc).id)
  }
}

describe('createDirectProduct', () => {
  it('C2 x C2 is the Klein four group (order 4, exponent 2)', () => {
    const G = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    expect(G.order).toBe(4)
    expect(G.isAbelian).toBe(true)
    expect(G.exponent).toBe(2)
    assertGroupAxioms(G)
  })

  it('C2 x C3 is cyclic of order 6 (isomorphic to C6)', () => {
    const G = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    expect(G.order).toBe(6)
    expect(G.exponent).toBe(6)
    assertGroupAxioms(G)
  })

  it('C4 x C2 has order 8 and exponent 4', () => {
    const G = createDirectProduct(createCyclicGroup(4), createCyclicGroup(2))
    expect(G.order).toBe(8)
    expect(G.exponent).toBe(4)
    assertGroupAxioms(G)
  })

  it('C3 x C3 has order 9 and exponent 3', () => {
    const G = createDirectProduct(createCyclicGroup(3), createCyclicGroup(3))
    expect(G.order).toBe(9)
    expect(G.exponent).toBe(3)
    assertGroupAxioms(G)
  })

  it('S3 x C2 has order 12 and is non-abelian', () => {
    const G = createDirectProduct(createS3(), createCyclicGroup(2))
    expect(G.order).toBe(12)
    expect(G.isAbelian).toBe(false)
    assertGroupAxioms(G)
  })

  it('D4 x V4 has order 32', () => {
    const G = createDirectProduct(createDihedralGroup(4), createKleinFour())
    expect(G.order).toBe(32)
    assertGroupAxioms(G)
  })

  it('element ids use pipe separator with component ids', () => {
    const G = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    for (const el of G.elements) {
      expect(el.id).toContain('|')
      expect(el.id.split('|')).toHaveLength(2)
    }
  })

  it('identity of product is product of identities', () => {
    const A = createS3()
    const B = createKleinFour()
    const G = createDirectProduct(A, B)
    expect(G.identity.id).toBe(`${A.identity.id}|${B.identity.id}`)
  })

  it('multiply distributes per-component', () => {
    const A = createS3()
    const B = createDihedralGroup(3)
    const G = createDirectProduct(A, B)
    for (let i = 0; i < 20; i++) {
      const a1 = A.elements[Math.floor(Math.random() * A.order)]
      const a2 = A.elements[Math.floor(Math.random() * A.order)]
      const b1 = B.elements[Math.floor(Math.random() * B.order)]
      const b2 = B.elements[Math.floor(Math.random() * B.order)]
      const x = G.elements.find(e => e.id === `${a1.id}|${b1.id}`)!
      const y = G.elements.find(e => e.id === `${a2.id}|${b2.id}`)!
      const expected = `${A.multiply(a1, a2).id}|${B.multiply(b1, b2).id}`
      expect(G.multiply(x, y).id).toBe(expected)
    }
  })

  it('inverse is component-wise', () => {
    const A = createS3()
    const B = createKleinFour()
    const G = createDirectProduct(A, B)
    for (const el of G.elements) {
      const [aId, bId] = el.id.split('|')
      const a = A.elements.find(e => e.id === aId)!
      const b = B.elements.find(e => e.id === bId)!
      expect(G.inverse(el).id).toBe(`${A.inverse(a).id}|${B.inverse(b).id}`)
    }
  })

  it('compact symbol groups repeated factors: C3 x C3 -> C_{3}^{2}', () => {
    const G = createDirectProduct(createCyclicGroup(3), createCyclicGroup(3))
    expect(G.symbol).toBe('C_{3}^{2}')
  })

  it('non-repeated factors keep expanded symbol', () => {
    const G = createDirectProduct(createCyclicGroup(4), createCyclicGroup(2))
    expect(G.symbol).toBe('C_{4} \\times C_{2}')
  })

  it('generators lift: applying generator keeps other component fixed', () => {
    const A = createCyclicGroup(4)
    const B = createCyclicGroup(2)
    const G = createDirectProduct(A, B)
    for (const gen of G.generators) {
      const out = gen.apply(G.identity)
      expect(out.id.startsWith(`${A.identity.id}|`) || out.id.endsWith(`|${B.identity.id}`)).toBe(true)
    }
  })

  it('generator inverses are consistent', () => {
    const A = createCyclicGroup(5)
    const B = createCyclicGroup(2)
    const G = createDirectProduct(A, B)
    for (const gen of G.generators) {
      const out = gen.apply(G.identity)
      const back = gen.inverse.apply(out)
      expect(back.id).toBe(G.identity.id)
    }
  })

  it('generator set generates the whole group', () => {
    const G = createDirectProduct(createCyclicGroup(4), createCyclicGroup(2))
    const reachable = new Set<string>([G.identity.id])
    const queue = [G.identity.id]
    while (queue.length) {
      const cur = queue.shift()!
      const el = G.elements.find(e => e.id === cur)!
      for (const gen of G.generators) {
        for (const dir of [gen, gen.inverse]) {
          const next = dir.apply(el)
          if (!reachable.has(next.id)) {
            reachable.add(next.id)
            queue.push(next.id)
          }
        }
      }
    }
    expect(reachable.size).toBe(G.order)
  })
})

import { describe, it, expect } from 'vitest'
import { createGroupFromImport, findTwoGeneratorPair } from '../core/groups/importGroup'
import type { ApiImportGroup } from '../utils/api'

// 1-based Cayley table for S₃ with elements ordered as in GAP idents:
// ['()', '(2,3)', '(1,2)', '(1,2,3)', '(1,3,2)', '(1,3)'].
function s3Table(): number[][] {
  const perms = [
    [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1],
  ]
  const table: number[][] = []
  for (let i = 0; i < 6; i++) {
    const row: number[] = []
    for (let j = 0; j < 6; j++) {
      const p = perms[i]
      const q = perms[j]
      const comp = q.map(k => p[k - 1])
      const idx = perms.findIndex(pr => pr.every((v, k) => v === comp[k]))
      row.push(idx + 1)
    }
    table.push(row)
  }
  return table
}

const S3_IMPORT: ApiImportGroup = {
  gap_expr: 'SymmetricGroup(3)',
  order: 6,
  table: s3Table(),
  gens: [4, 3], // (1,2,3) and (1,2)
  idents: ['()', '(2,3)', '(1,2)', '(1,2,3)', '(1,3,2)', '(1,3)'],
  structure: 'S3',
}

// 1-based Cayley table for C₄, elements ['e','a','a^{2}','a^{3}'].
const C4_IMPORT: ApiImportGroup = {
  gap_expr: 'CyclicGroup(4)',
  order: 4,
  table: [[1, 2, 3, 4], [2, 3, 4, 1], [3, 4, 1, 2], [4, 1, 2, 3]],
  gens: [2],
  idents: ['e', 'a', 'a^{2}', 'a^{3}'],
  structure: 'C4',
}

// D₄ with elements ordered (index = i + 4j) as r^i·s^j for j=0,1.
function d4Table(): number[][] {
  const table: number[][] = []
  for (let a = 0; a < 8; a++) {
    const i1 = a % 4
    const j1 = Math.floor(a / 4)
    const row: number[] = []
    for (let b = 0; b < 8; b++) {
      const i2 = b % 4
      const j2 = Math.floor(b / 4)
      const i = (i1 + (j1 === 0 ? i2 : (4 - i2) % 4)) % 4
      const j = (j1 + j2) % 2
      row.push(i + 4 * j + 1)
    }
    table.push(row)
  }
  return table
}

const D4_IMPORT: ApiImportGroup = {
  gap_expr: 'DihedralGroup(8)',
  order: 8,
  table: d4Table(),
  gens: [2, 5], // r and s
  idents: ['e', 'r', 'r^{2}', 'r^{3}', 's', 'rs', 'r^{2}s', 'r^{3}s'],
  structure: 'D4',
}

// Q₈ with elements ordered (index = i + 4j) as a^i·b^j,
// relations a⁴=e, b²=a², b·a = a³·b.
function q8Table(): number[][] {
  const table: number[][] = []
  for (let x = 0; x < 8; x++) {
    const i1 = x % 4
    const j1 = Math.floor(x / 4)
    const row: number[] = []
    for (let y = 0; y < 8; y++) {
      const i2 = y % 4
      const j2 = Math.floor(y / 4)
      let i: number
      let j: number
      if (j1 === 0) {
        i = (i1 + i2) % 4
        j = j2
      } else if (j2 === 0) {
        i = (4 - ((i1 + i2) % 4)) % 4
        j = 1
      } else {
        i = (2 - i1 + 4) % 4
        j = 0
      }
      row.push(i + 4 * j + 1)
    }
    table.push(row)
  }
  return table
}

const Q8_IMPORT: ApiImportGroup = {
  gap_expr: 'QuaternionGroup(8)',
  order: 8,
  table: q8Table(),
  gens: [2, 3, 5, 6], // a, a², b, a·b (redundant, triggers reduction)
  idents: ['1', 'a', 'a2', 'a3', 'b', 'a*b', 'a2*b', 'a3*b'],
  structure: 'Q8',
}

// C₂³ with xor Cayley table (1-based).
function c2cubedTable(): number[][] {
  const table: number[][] = []
  for (let i = 0; i < 8; i++) {
    const row: number[] = []
    for (let j = 0; j < 8; j++) row.push((i ^ j) + 1)
    table.push(row)
  }
  return table
}

const C2CUBED_IMPORT: ApiImportGroup = {
  gap_expr: 'DirectProduct(CyclicGroup(2),DirectProduct(CyclicGroup(2),CyclicGroup(2)))',
  order: 8,
  table: c2cubedTable(),
  gens: [2, 3, 5, 6],
  idents: ['<identity>', 'f1', 'f2', 'f1*f2', 'f3', 'f1*f3', 'f2*f3', 'f1*f2*f3'],
  structure: 'C2 x C2 x C2',
}

describe('createGroupFromImport', () => {
  it('builds S₃ with correct structure, generators and non-abelian flag', () => {
    const g = createGroupFromImport(S3_IMPORT)
    expect(g.order).toBe(6)
    expect(g.symbol).toBe('S3')
    expect(g.elements).toHaveLength(6)
    expect(g.generators).toHaveLength(2)
    expect(g.generators[0].name).toBe('a')
    expect(g.generators[1].name).toBe('b')
    expect(g.isAbelian).toBe(false)
    expect(g.identity.id).toBe('g0')
  })

  it('multiply follows the Cayley table; identity row is a no-op', () => {
    const g = createGroupFromImport(S3_IMPORT)
    const [e, a, b] = g.elements
    expect(g.multiply(e, a).id).toBe(a.id)
    expect(g.multiply(a, e).id).toBe(a.id)
    expect(g.multiply(a, b).id).toBe(g.elements[4].id)
    const viaComposition = g.elements[s3Table()[1][2] - 1]
    expect(g.multiply(a, b).id).toBe(viaComposition.id)
  })

  it('inverse agrees with the Cayley table', () => {
    const g = createGroupFromImport(S3_IMPORT)
    const [e, a, b, c, d] = g.elements
    expect(g.multiply(a, g.inverse(a)).id).toBe(e.id)
    expect(g.multiply(c, g.inverse(c)).id).toBe(e.id)
    expect(g.inverse(c).id).toBe(d.id)
    expect(g.multiply(b, g.inverse(b)).id).toBe(e.id)
  })

  it('assigns word labels along generators', () => {
    const g = createGroupFromImport(C4_IMPORT)
    expect(g.elements[0].label).toBe('e')
    expect(g.elements[1].label).toBe('a')
    expect(g.elements[2].label).toBe('a^2')
    expect(g.elements[3].label).toBe('a^3')
  })

  it('marks abelian groups abelian', () => {
    expect(createGroupFromImport(C4_IMPORT).isAbelian).toBe(true)
  })

  it('applies dihedral normal form for D structures, symbol keeps D form', () => {
    const g = createGroupFromImport(D4_IMPORT)
    expect(g.symbol).toBe('D4')
    expect(g.elements[0].label).toBe('e')
    expect(g.elements[1].label).toBe('a')
    expect(g.elements[2].label).toBe('a^2')
    expect(g.elements[3].label).toBe('a^3')
    expect(g.elements[4].label).toBe('b')
    expect(g.elements[5].label).toBe('a b')
    expect(g.elements[6].label).toBe('a^2 b')
    expect(g.elements[7].label).toBe('a^3 b')
  })

  it('generator inverse applies left multiplication by the inverse element', () => {
    const g = createGroupFromImport(C4_IMPORT)
    const gen = g.generators[0]
    const x = g.elements[3]
    expect(g.multiply(g.multiply(x, gen.apply(g.elements[0])), gen.inverse.apply(g.elements[0])).id)
      .toBe(x.id)
  })

  it('reduces many GAP generators to a two-generator pair (Q₈)', () => {
    const g = createGroupFromImport(Q8_IMPORT)
    expect(g.generators).toHaveLength(2)
    expect(g.generators[0].name).toBe('a')
    expect(g.generators[1].name).toBe('b')
    const a = g.generators[0].apply(g.identity)
    expect(g.multiply(g.multiply(g.multiply(a, a), a), a).id).toBe(g.identity.id)
    const b = g.generators[1].apply(g.identity)
    expect(g.multiply(g.multiply(b, b), g.inverse(g.multiply(a, a))).id).toBe(g.identity.id)
    expect(g.elements[4].label).toBe('b')
    expect(g.elements[5].label).toBe('a b')
    expect(g.elements[7].label).toBe('b a')
  })

  it('keeps original generators when two do not generate (C₂³)', () => {
    const g = createGroupFromImport(C2CUBED_IMPORT)
    expect(g.generators).toHaveLength(4)
    expect(g.generators[0].name).toBe('a')
  })

  it('findTwoGeneratorPair finds ⟨a,b⟩ = G with a of maximal order', () => {
    const g = createGroupFromImport(Q8_IMPORT)
    const pair = findTwoGeneratorPair(g.elements, g.multiply, g.identity.id)!
    const order = (start: typeof pair.a): number => {
      let cur = start
      let k = 1
      while (cur.id !== g.identity.id) {
        cur = g.multiply(cur, start)
        k++
      }
      return k
    }
    expect(order(pair.a)).toBe(4)
    expect(order(pair.b)).toBe(4)
    expect(pair.a.id).not.toBe(pair.b.id)
    expect(findTwoGeneratorPair(g.elements, g.multiply, g.identity.id)).not.toBeNull()
  })
})
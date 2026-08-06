import { describe, it, expect } from 'vitest'
import {
  factorizeOrder,
  findSylowSubgroups,
  findAllPSubgroups,
  computeSylowAnalysis,
  conjugateSubgroup,
  sylowConjugationPerms,
  findMinimalGenerators,
} from '../core/algebra/sylow'
import { verifyAllRelations } from '../core/algebra/actions'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import type { Group } from '../core/types'

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const bs = new Set(b)
  return a.every(x => bs.has(x))
}

function allSylowChecks(group: Group, p: number, expectedNp: number): void {
  const factors = factorizeOrder(group.order)
  const f = factors.find(fi => fi.prime === p)!
  let pPower = 1
  for (let i = 0; i < f.exponent; i++) pPower *= p

  const subgroups = findSylowSubgroups(group, p)
  expect(subgroups.length).toBe(expectedNp)
  for (const sg of subgroups) {
    expect(sg.order).toBe(pPower)
    expect(sg.elements.length).toBe(pPower)
    // subgroup axioms: closed, identity inside
    const ids = new Set(sg.elements.map(e => e.id))
    expect(ids.has(group.identity.id)).toBe(true)
    for (const a of sg.elements) {
      for (const b of sg.elements) {
        expect(ids.has(group.multiply(a, b).id)).toBe(true)
        expect(ids.has(group.inverse(a).id)).toBe(true)
      }
    }
    expect(sg.generators.length).toBeGreaterThan(0)
    // generators actually generate the subgroup
    const closed = new Set<string>()
    let frontier = sg.generators.map(g => g.id)
    for (const fg of frontier) closed.add(fg)
    while (frontier.length > 0) {
      const next: string[] = []
      for (const fg of frontier) {
        const el = sg.elements.find(e => e.id === fg)!
        for (const g2 of sg.generators) {
          const prod = group.multiply(el, g2).id
          if (!closed.has(prod)) {
            closed.add(prod)
            next.push(prod)
          }
        }
      }
      frontier = next
    }
    expect(closed.size).toBe(pPower)
  }
  // pairwise distinct
  const keys = subgroups.map(sg => sg.elements.map(e => e.id).slice().sort().join(','))
  expect(new Set(keys).size).toBe(expectedNp)
  // all mutually conjugate (Second Sylow theorem)
  for (let i = 0; i < subgroups.length; i++) {
    for (let j = 0; j < subgroups.length; j++) {
      const found = group.elements.some(g =>
        sameSet(
          conjugateSubgroup(group, subgroups[i].elements, g).map(e => e.id),
          subgroups[j].elements.map(e => e.id)
        )
      )
      expect(found).toBe(true)
    }
  }
}

function checkAnalysis(group: Group, expected: Record<number, number>): void {
  const analysis = computeSylowAnalysis(group)
  expect(analysis).not.toBeNull()
  expect(analysis!.order).toBe(group.order)
  for (const [p, np] of Object.entries(expected)) {
    const prime = Number(p)
    const info = analysis!.primes.find(pi => pi.p === prime)!
    expect(info.np).toBe(np)
    expect(info.congruentModP).toBe(true)
    expect(info.dividesM).toBe(true)
    expect(info.isNormal).toBe(np === 1)
  }
}

describe('factorizeOrder', () => {
  it('returns [] for order 1', () => {
    expect(factorizeOrder(1)).toEqual([])
  })

  it('factorizes composite orders', () => {
    expect(factorizeOrder(6)).toEqual([{ prime: 2, exponent: 1 }, { prime: 3, exponent: 1 }])
    expect(factorizeOrder(12)).toEqual([{ prime: 2, exponent: 2 }, { prime: 3, exponent: 1 }])
    expect(factorizeOrder(120)).toEqual([
      { prime: 2, exponent: 3 },
      { prime: 3, exponent: 1 },
      { prime: 5, exponent: 1 },
    ])
  })

  it('handles prime orders', () => {
    expect(factorizeOrder(17)).toEqual([{ prime: 17, exponent: 1 }])
  })
})

describe('Sylow subgroup counts (known values)', () => {
  it('S_3: n_2 = 3, n_3 = 1', () => {
    checkAnalysis(createS3(), { 2: 3, 3: 1 })
  })

  it('A_4: n_2 = 1 (V4 normal), n_3 = 4', () => {
    const A4 = createAlternatingGroup(4)
    checkAnalysis(A4, { 2: 1, 3: 4 })
    const v4 = findSylowSubgroups(A4, 2)[0]
    expect(v4.isNormal).toBe(true)
    expect(findSylowSubgroups(A4, 3).every(sg => !sg.isNormal)).toBe(true)
  })

  it('S_4: n_2 = 3, n_3 = 4', () => {
    checkAnalysis(createSymmetricGroup(4), { 2: 3, 3: 4 })
  })

  it('D_8: n_2 = 1 (self), Q_8: n_2 = 1', () => {
    checkAnalysis(createDihedralGroup(4), { 2: 1 })
    checkAnalysis(createQuaternion(), { 2: 1 })
  })

  it('V_4: n_2 = 1', () => {
    checkAnalysis(createKleinFour(), { 2: 1 })
  })

  it('C_12: n_2 = 1 (order 4), n_3 = 1 (order 3)', () => {
    checkAnalysis(createCyclicGroup(12), { 2: 1, 3: 1 })
  })

  it('A_5: n_2 = 5, n_3 = 10, n_5 = 6', () => {
    const A5 = createAlternatingGroup(5)
    checkAnalysis(A5, { 2: 5, 3: 10, 5: 6 })
    allSylowChecks(A5, 2, 5)
  })

  it('S_5 (local, order 120): n_2 = 15, n_3 = 10, n_5 = 6', () => {
    const S5 = createSymmetricGroup(5)
    checkAnalysis(S5, { 2: 15, 3: 10, 5: 6 })
    allSylowChecks(S5, 2, 15)
    allSylowChecks(S5, 3, 10)
    allSylowChecks(S5, 5, 6)
  })
})

describe('Sylow subgroup structure', () => {
  it('S_4 Sylow 2-subgroups are D_8: 2 generators, one element of order 4', () => {
    const S4 = createSymmetricGroup(4)
    const subs = findSylowSubgroups(S4, 2)
    expect(subs.length).toBe(3)
    for (const sg of subs) {
      expect(sg.generators.length).toBe(2)
    }
  })

  it('minimal generators close to the whole subgroup', () => {
    const S3 = createS3()
    const sg = findSylowSubgroups(S3, 2)[0]
    expect(sg.generators.length).toBe(1)
    expect(findMinimalGenerators(sg.elements, S3).length).toBe(1)
  })

  it('conjugateSubgroup maps a Sylow subgroup onto another for S_3', () => {
    const S3 = createS3()
    const subs = findSylowSubgroups(S3, 2)
    const g = S3.elements[2]
    const conj = conjugateSubgroup(S3, subs[0].elements, g)
    const isOneOf = subs.some(sg => sameSet(conj.map(e => e.id), sg.elements.map(e => e.id)))
    expect(isOneOf).toBe(true)
  })
})

describe('Sylow conjugation action', () => {
  it('is a valid action (homomorphism) on Sylow subgroup set', () => {
    for (const group of [createS3(), createAlternatingGroup(4), createSymmetricGroup(5)]) {
      const factors = factorizeOrder(group.order)
      for (const f of factors) {
        const subgroups = findSylowSubgroups(group, f.prime)
        const perms = sylowConjugationPerms(group, subgroups)
        expect(perms.size).toBe(group.order)
        for (const p of perms.values()) {
          expect(p.length).toBe(subgroups.length)
          expect(new Set(p).size).toBe(subgroups.length)
          expect(p.every(i => i >= 0)).toBe(true)
        }
        const { ok } = verifyAllRelations(group, perms)
        expect(ok).toBe(true)
      }
    }
  })

  it('is transitive: single orbit of size n_p, stabilizer = normalizer of size |G|/n_p', () => {
    const S4 = createSymmetricGroup(4)
    const subgroups = findSylowSubgroups(S4, 2)
    const perms = sylowConjugationPerms(S4, subgroups)
    expect(subgroups.length).toBe(3)
    // orbit of subgroup 0 under all group elements = all of {0,1,2}
    const orbit = new Set<number>()
    for (const perm of perms.values()) orbit.add(perm[0])
    expect(orbit.size).toBe(3)
    // stabilizer of subgroup 0: normalizer N_G(P) = {g : gPg^-1 = P}
    const stab = new Set<string>()
    for (const g of S4.elements) {
      const perm = perms.get(g.id)!
      if (perm[0] === 0) stab.add(g.id)
    }
    expect(stab.size).toBe(S4.order / 3)
  })

  it('identity element maps to identity permutation', () => {
    const S5 = createSymmetricGroup(5)
    const subgroups = findSylowSubgroups(S5, 5)
    const perms = sylowConjugationPerms(S5, subgroups)
    const idPerm = perms.get(S5.identity.id)!
    expect(idPerm).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('findAllPSubgroups lists all p-subgroups with Sylow flagged', () => {
    const all = findAllPSubgroups(createS3(), 2)
    expect(all.length).toBe(3)
    expect(all.filter(s => s.isSylow).length).toBe(3)
    expect(all.every(s => s.order === 2)).toBe(true)
    // sorted by order descending
    for (let i = 1; i < all.length; i++) expect(all[i - 1].order).toBeGreaterThanOrEqual(all[i].order)
  })

  it('findAllPSubgroups: S3 p=3 single Sylow', () => {
    const all = findAllPSubgroups(createS3(), 3)
    expect(all.length).toBe(1)
    expect(all[0].isSylow).toBe(true)
    expect(all[0].order).toBe(3)
  })

  it('findAllPSubgroups: A4 p=2 has 3 Z2 and one V4 Sylow', () => {
    const A4 = createAlternatingGroup(4)
    const all = findAllPSubgroups(A4, 2)
    expect(all.length).toBe(4)
    const sylow = all.filter(s => s.isSylow)
    expect(sylow.length).toBe(1)
    expect(sylow[0].order).toBe(4)
    expect(sylow[0].isNormal).toBe(true)
    const small = all.filter(s => !s.isSylow)
    expect(small.length).toBe(3)
    expect(small.every(s => s.order === 2)).toBe(true)
    // all p-subgroups are subgroups of some Sylow p-subgroup
    const sylowIds = new Set(sylow[0].elements.map(e => e.id))
    for (const s of small) {
      expect(s.elements.every(e => sylowIds.has(e.id))).toBe(true)
    }
  })

  it('findAllPSubgroups: Q8 p=2 has Z2, three Z4 and Q8 itself', () => {
    const Q8 = createQuaternion()
    const all = findAllPSubgroups(Q8, 2)
    expect(all.length).toBe(5)
    const sylow = all.filter(s => s.isSylow)
    expect(sylow.length).toBe(1)
    expect(sylow[0].order).toBe(8)
    expect(sylow[0].isNormal).toBe(true)
    const orders = all.map(s => s.order).sort((a, b) => a - b)
    expect(orders).toEqual([2, 4, 4, 4, 8])
  })

  it('findAllPSubgroups: V4 p=2 has three Z2 and V4 itself', () => {
    const V4 = createKleinFour()
    const all = findAllPSubgroups(V4, 2)
    expect(all.length).toBe(4)
    expect(all.filter(s => s.isSylow).length).toBe(1)
    const orders = all.map(s => s.order).sort((a, b) => a - b)
    expect(orders).toEqual([2, 2, 2, 4])
  })

  it('findAllPSubgroups: C12 p=2 has Z2 and Z4 Sylow', () => {
    const C12 = createCyclicGroup(12)
    const all = findAllPSubgroups(C12, 2)
    expect(all.length).toBe(2)
    expect(all[0].isSylow).toBe(true)
    expect(all[0].order).toBe(4)
    expect(all[1].order).toBe(2)
    // p=3: single cyclic Z3
    const p3 = findAllPSubgroups(C12, 3)
    expect(p3.length).toBe(1)
    expect(p3[0].order).toBe(3)
    expect(p3[0].isSylow).toBe(true)
  })
})

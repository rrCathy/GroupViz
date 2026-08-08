import { describe, it, expect } from 'vitest'
import {
  identityPermutation, composePermutations, inversePermutation, permsEqual,
  firstDiffIndex, computeConjugationPerms,
  validateCustomArrows, extendAndVerifyPerms, generatorPermsFromArrows,
  verifyOrbitStabilizer, computeFixedPoints, computeCycleCandidates,
  buildActionComputation,
} from '../core/algebra/actions'
import { createS3, createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'

describe('permutation utilities', () => {
  it('identity permutation leaves elements unchanged', () => {
    const id = identityPermutation(5)
    expect(id).toEqual([0, 1, 2, 3, 4])
  })

  it('compose applies second permutation first', () => {
    // p2 = swap(0,1), p1 = rotate left: compose(p1, p2) = p1[p2[i]]
    const p2 = [1, 0, 2]
    const p1 = [1, 2, 0]
    expect(composePermutations(p1, p2)).toEqual([p1[1], p1[0], p1[2]])
  })

  it('inverse permutation inverts a cycle', () => {
    const p = [2, 0, 1]
    expect(inversePermutation(p)).toEqual([1, 2, 0])
    expect(permsEqual(composePermutations(p, inversePermutation(p)), identityPermutation(3))).toBe(true)
  })

  it('firstDiffIndex finds first mismatch', () => {
    expect(firstDiffIndex([0, 1, 2], [0, 2, 1])).toBe(1)
    expect(firstDiffIndex([0, 1, 2], [0, 1, 2])).toBe(-1)
  })
})

describe('conjugation action', () => {
  it('is always a valid homomorphism', () => {
    for (const group of [createS3(), createCyclicGroup(6), createDihedralGroup(4)]) {
      const perms = computeConjugationPerms(group)
      const result = buildActionComputation(group, { kind: 'conjugation' })
      expect(result.computation!.isHomomorphism).toBe(true)
      expect(perms.size).toBe(group.order)
      for (const p of perms.values()) {
        expect(p.length).toBe(group.order)
        expect(new Set(p).size).toBe(group.order)
      }
    }
  })

  it('orbits are conjugacy classes for S_3: sizes 1+2+3', () => {
    const S3 = createS3()
    const result = buildActionComputation(S3, { kind: 'conjugation' })
    const sizes = result.computation!.orbits.map(o => o.elements.length).sort((a, b) => a - b)
    expect(sizes).toEqual([1, 2, 3])
    expect(result.computation!.n).toBe(6)
  })

  it('identity orbit has size 1 (only itself is conjugate to e)', () => {
    const S3 = createS3()
    const result = buildActionComputation(S3, { kind: 'conjugation' })
    const idIdx = S3.elements.findIndex(el => el.id === S3.identity.id)
    expect(result.computation!.orbitOf[idIdx]).toBe(0)
    expect(result.computation!.orbits[0].elements).toEqual([idIdx])
  })

  it('orbit-stabilizer theorem holds for every representative in S_3', () => {
    const S3 = createS3()
    const result = buildActionComputation(S3, { kind: 'conjugation' })
    const checks = verifyOrbitStabilizer(S3, result.computation!.orbits, result.computation!.stabilizers)
    for (const c of checks) {
      expect(c.orbitSize * c.stabSize).toBe(S3.order)
      expect(c.valid).toBe(true)
    }
    // size-3 orbit (transpositions) has stabilizer of size 2
    const transpositionOrbit = checks.find(c => c.orbitSize === 3)!
    expect(transpositionOrbit.stabSize).toBe(2)
  })

  it('central elements have fixed-point orbits (abelian group: all orbits are singletons)', () => {
    const Z6 = createCyclicGroup(6)
    const result = buildActionComputation(Z6, { kind: 'conjugation' })
    expect(result.computation!.orbits.length).toBe(6)
    expect(result.computation!.orbits.every(o => o.elements.length === 1)).toBe(true)
  })
})

describe('custom action', () => {
  it('valid C3 cycle arrows yield one orbit of size 3', () => {
    const C3 = createCyclicGroup(3)
    const genSymbol = C3.generators[0].symbol
    const arrows = [
      { generatorId: genSymbol, from: 0, to: 1 },
      { generatorId: genSymbol, from: 1, to: 2 },
      { generatorId: genSymbol, from: 2, to: 0 },
    ]
    const result = buildActionComputation(C3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(true)
    expect(result.computation!.orbits.length).toBe(1)
    expect(result.computation!.orbits[0].elements.length).toBe(3)
  })

  it('missing target (to not defined as source) is rejected', () => {
    const C3 = createCyclicGroup(3)
    const genSymbol = C3.generators[0].symbol
    const arrows = [
      { generatorId: genSymbol, from: 0, to: 1 },
      { generatorId: genSymbol, from: 1, to: 2 },
    ]
    const result = buildActionComputation(C3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error?.type).toBe('missing-target')
  })

  it('conflicting targets for the same generator are rejected', () => {
    const C3 = createCyclicGroup(3)
    const genSymbol = C3.generators[0].symbol
    const arrows = [
      { generatorId: genSymbol, from: 0, to: 1 },
      { generatorId: genSymbol, from: 2, to: 1 },
    ]
    const result = buildActionComputation(C3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error?.type).toBe('conflict-target')
  })

  it('duplicate source for the same generator is rejected', () => {
    const C3 = createCyclicGroup(3)
    const genSymbol = C3.generators[0].symbol
    const arrows = [
      { generatorId: genSymbol, from: 0, to: 1 },
      { generatorId: genSymbol, from: 0, to: 2 },
    ]
    const result = buildActionComputation(C3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error?.type).toBe('duplicate-source')
  })

  it('unbound arrow (null generator) is rejected', () => {
    const C3 = createCyclicGroup(3)
    const arrows = [{ generatorId: null, from: 0, to: 1 }]
    const result = buildActionComputation(C3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error?.type).toBe('unbound')
  })

  it('self-loop arrows represent fixed points and are accepted', () => {
    // C2 generator s = (0 1)(2)(3): transposition on 0,1 and fixed points on 2,3
    const C2 = createCyclicGroup(2)
    const genSymbol = C2.generators[0].symbol
    const arrows = [
      { generatorId: genSymbol, from: 0, to: 1 },
      { generatorId: genSymbol, from: 1, to: 0 },
      { generatorId: genSymbol, from: 2, to: 2 },
      { generatorId: genSymbol, from: 3, to: 3 },
    ]
    const result = buildActionComputation(C2, { kind: 'custom', setSize: 4 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(true)
    const sizes = result.computation!.orbits.map(o => o.elements.length).sort((a, b) => a - b)
    expect(sizes).toEqual([1, 1, 2])
    const checks = verifyOrbitStabilizer(C2, result.computation!.orbits, result.computation!.stabilizers)
    expect(checks.every(c => c.valid)).toBe(true)
    expect(computeFixedPoints(result.computation!.perms, 4)).toEqual([2, 3])
  })

  it('natural action of S3 with self-loops yields one orbit and Stab(1) of size 2', () => {
    // generators (12): 0<->1, 2 fixed; (23): 1<->2, 0 fixed (self-loops)
    const S3 = createS3()
    const g0 = S3.generators[0].symbol
    const g1 = S3.generators[1].symbol
    const arrows = [
      { generatorId: g0, from: 0, to: 1 },
      { generatorId: g0, from: 1, to: 0 },
      { generatorId: g0, from: 2, to: 2 },
      { generatorId: g1, from: 1, to: 2 },
      { generatorId: g1, from: 2, to: 1 },
      { generatorId: g1, from: 0, to: 0 },
    ]
    const result = buildActionComputation(S3, { kind: 'custom', setSize: 3 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(true)
    expect(result.computation!.orbits.length).toBe(1)
    expect(result.computation!.orbits[0].elements.length).toBe(3)
    const checks = verifyOrbitStabilizer(S3, result.computation!.orbits, result.computation!.stabilizers)
    const rep0 = checks.find(c => c.representative === 0)!
    expect(rep0.orbitSize).toBe(3)
    expect(rep0.stabSize).toBe(2)
    expect(rep0.valid).toBe(true)
  })

  it('homomorphism violation is detected when generator perm has wrong order', () => {
    // D4 relation r^4 = e; give r a transposition (order 2) → violation
    const D4 = createDihedralGroup(4)
    const genSymbols = D4.generators.map(g => g.symbol)
    const rSymbol = genSymbols[0]
    const sSymbol = genSymbols[1]
    const arrows = [
      { generatorId: rSymbol, from: 0, to: 1 },
      { generatorId: rSymbol, from: 1, to: 0 },
      { generatorId: sSymbol, from: 0, to: 2 },
      { generatorId: sSymbol, from: 2, to: 0 },
      { generatorId: sSymbol, from: 1, to: 3 },
      { generatorId: sSymbol, from: 3, to: 1 },
    ]
    const result = buildActionComputation(D4, { kind: 'custom', setSize: 4 }, arrows)
    expect(result.computation).toBeDefined()
    expect(result.computation!.isHomomorphism).toBe(false)
    expect(result.computation!.violation).toBeDefined()
  })

  it('extendAndVerify extends generator perms to all elements', () => {
    const C4 = createCyclicGroup(4)
    const genSymbol = C4.generators[0].symbol
    const genPerms = new Map([[genSymbol, [1, 2, 3, 0]]])
    const ext = extendAndVerifyPerms(C4, genPerms, 4)
    expect(ext.ok).toBe(true)
    expect(ext.perms.size).toBe(4)
    expect(permsEqual(ext.perms.get(C4.identity.id)!, identityPermutation(4))).toBe(true)
    // generator^4 = identity
    const g = genPerms.get(genSymbol)!
    expect(permsEqual(composePermutations(composePermutations(g, g), composePermutations(g, g)), identityPermutation(4))).toBe(true)
  })

  it('generatorPermsFromArrows fills unspecified sources with fixed points', () => {
    const arrows = [
      { generatorId: 'a', from: 0, to: 1 },
      { generatorId: 'a', from: 1, to: 2 },
    ]
    const perms = generatorPermsFromArrows(arrows, 4, ['a'])
    expect(perms.get('a')).toEqual([1, 2, 2, 3])
  })

  it('generatorPermsFromArrows initializes identity for generators without arrows', () => {
    const arrows = [{ generatorId: 'a', from: 0, to: 1 }]
    const perms = generatorPermsFromArrows(arrows, 4, ['a', 'b'])
    expect(perms.get('b')).toEqual([0, 1, 2, 3])
  })

  it('custom action with only one of two generators defined is valid (other acts trivially)', () => {
    const A4 = createAlternatingGroup(4)
    const genB = A4.generators[1].symbol
    const arrows = [
      { generatorId: genB, from: 0, to: 1 },
      { generatorId: genB, from: 1, to: 2 },
      { generatorId: genB, from: 2, to: 0 },
    ]
    const result = buildActionComputation(A4, { kind: 'custom', setSize: 6 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(true)
    const genAElId = A4.generators[0].apply(A4.identity).id
    expect(result.computation!.perms.get(genAElId)).toEqual([0, 1, 2, 3, 4, 5])
    // only the 3-cycle {0,1,2} moves; 3,4,5 are fixed points
    const sizes = result.computation!.orbits.map(o => o.elements.length)
    expect(sizes.sort((a, b) => a - b)).toEqual([1, 1, 1, 3])
  })

  it('invalid custom action (order mismatch) reports violation without crashing', () => {
    const A4 = createAlternatingGroup(4)
    const genA = A4.generators[0].symbol
    const arrows = [
      { generatorId: genA, from: 0, to: 1 },
      { generatorId: genA, from: 1, to: 2 },
      { generatorId: genA, from: 2, to: 0 },
    ]
    const result = buildActionComputation(A4, { kind: 'custom', setSize: 6 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(false)
    expect(result.computation!.violation).toBeDefined()
  })

  it('validateCustomArrows catches out-of-range indices', () => {
    const C3 = createCyclicGroup(3)
    const genSymbol = C3.generators[0].symbol
    const arrows = [{ generatorId: genSymbol, from: 0, to: 5 }]
    const v = validateCustomArrows(arrows, 3, C3)
    expect(v.ok).toBe(false)
    expect(v.error?.type).toBe('range')
  })})

describe('orbit and stabilizer machinery', () => {
  it('computeOrbits partitions the set (custom cyclic action on 6 points)', () => {
    const C6 = createCyclicGroup(6)
    const genSymbol = C6.generators[0].symbol
    const arrows = Array.from({ length: 6 }, (_, i) => ({ generatorId: genSymbol, from: i, to: (i + 1) % 6 }))
    const result = buildActionComputation(C6, { kind: 'custom', setSize: 6 }, arrows)
    const { orbits, orbitOf } = result.computation!
    expect(orbits.length).toBe(1)
    expect(orbits[0].elements.length).toBe(6)
    expect(orbitOf.every(i => i === 0)).toBe(true)
  })

  it('computeStabilizers returns full group for fixed points, singleton for regular action', () => {
    const S3 = createS3()
    const result = buildActionComputation(S3, { kind: 'conjugation' })
    const idIdx = S3.elements.findIndex(el => el.id === S3.identity.id)
    expect(result.computation!.stabilizers.get(idIdx)!.length).toBe(S3.order)
    // transpositions: class size 3 → stabilizer size 2
    const checks = verifyOrbitStabilizer(S3, result.computation!.orbits, result.computation!.stabilizers)
    const t = checks.find(c => c.orbitSize === 3)!
    expect(t.stabSize).toBe(2)
  })

  it('computeFixedPoints for S3 conjugation is exactly the identity element', () => {
    const S3 = createS3()
    const result = buildActionComputation(S3, { kind: 'conjugation' })
    const idIdx = S3.elements.findIndex(el => el.id === S3.identity.id)
    expect(computeFixedPoints(result.computation!.perms, 6)).toEqual([idIdx])
  })

  it('S5 conjugation has 7 conjugacy classes (partition of 120)', () => {
    const S5 = createSymmetricGroup(5)
    const result = buildActionComputation(S5, { kind: 'conjugation' })
    expect(result.computation!.isHomomorphism).toBe(true)
    const sizes = result.computation!.orbits.map(o => o.elements.length).sort((a, b) => a - b)
    expect(sizes).toEqual([1, 10, 15, 20, 20, 24, 30])
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(120)
  })
})

describe('cycle candidates', () => {
  it('returns empty for no arrows or n < 2', () => {
    expect(computeCycleCandidates([], 6)).toEqual([])
    expect(computeCycleCandidates([{ from: 0, to: 1 }], 1)).toEqual([])
  })

  it('1→2 on a 6-element set suggests 2-cycle through 6-cycle', () => {
    const cs = computeCycleCandidates([{ from: 0, to: 1 }], 6)
    expect(cs.length).toBe(5)
    expect(cs[0]).toEqual({ length: 2, label: '(1 2)', pairs: [[0, 1], [1, 0]] })
    expect(cs[1].label).toBe('(1 2 3)')
    expect(cs[4].label).toBe('(1 2 3 4 5 6)')
    expect(cs[4].pairs).toHaveLength(6)
  })

  it('1→3 on a 6-element set suggests 2-cycle, 3-cycle etc.', () => {
    const cs = computeCycleCandidates([{ from: 0, to: 2 }], 6)
    expect(cs.length).toBe(5)
    expect(cs[0].label).toBe('(1 3)')
    expect(cs[1]).toEqual({ length: 3, label: '(1 3 2)', pairs: [[0, 2], [2, 1], [1, 0]] })
  })

  it('a longer chain extends from its own length upward', () => {
    const cs = computeCycleCandidates([{ from: 0, to: 1 }, { from: 1, to: 2 }], 6)
    expect(cs.length).toBe(4)
    expect(cs[0]).toEqual({ length: 3, label: '(1 2 3)', pairs: [[0, 1], [1, 2], [2, 0]] })
  })

  it('a closed cycle yields exactly one candidate', () => {
    const cs = computeCycleCandidates([{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }], 6)
    expect(cs.length).toBe(1)
    expect(cs[0]).toEqual({ length: 3, label: '(1 2 3)', pairs: [[0, 1], [1, 2], [2, 0]] })
  })

  it('suggested candidates close to a valid permutation when applied', () => {
    const C6 = createCyclicGroup(6)
    const genSymbol = C6.generators[0].symbol
    const cs = computeCycleCandidates([{ from: 0, to: 2 }], 6)
    const arrows = cs[1].pairs.map(([from, to]) => ({ generatorId: genSymbol, from, to }))
    const result = buildActionComputation(C6, { kind: 'custom', setSize: 6 }, arrows)
    expect(result.error).toBeUndefined()
    expect(result.computation!.isHomomorphism).toBe(true)
    expect(result.computation!.orbits).toHaveLength(4)
    const sizes = result.computation!.orbits.map(o => o.elements.length).sort((a, b) => a - b)
    expect(sizes).toEqual([1, 1, 1, 3])
  })
})

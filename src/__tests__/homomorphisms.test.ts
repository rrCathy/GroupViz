import { describe, it, expect } from 'vitest'
import {
  verifyHomomorphism,
  getHomomorphismProperties,
  trivialMapping,
  naturalProjectionMapping,
  autoBuildMapping,
  subgroupInclusionMapping,
  directProductProjectionMapping,
  extendFromGenerators,
  formatKernelLabel,
  isElementIdentity,
} from '../core/algebra/homomorphisms'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createKleinFour } from '../core/groups/SpecialGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { findAllSubgroups } from '../core/algebra/subgroups'
import type { Group, GroupElement } from '../core/types'

function identityMap(group: Group) {
  const map = new Map<string, string>()
  for (const el of group.elements) map.set(el.id, el.id)
  return map
}

function computeElementOrder(group: Group, el: GroupElement): number {
  let a = el
  let count = 0
  do {
    a = group.multiply(a, el)
    count++
    if (count > 1000) break
  } while (a.id !== el.id)
  return count
}

describe('verifyHomomorphism', () => {
  it('identity mapping S3 -> S3 is a homomorphism', () => {
    const S3 = createS3()
    const result = verifyHomomorphism(S3, S3, identityMap(S3))
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(1)
    expect(result.image.length).toBe(S3.order)
  })

  it('maps identity to non-identity fails homomorphism property', () => {
    const S3 = createS3()
    const map = new Map<string, string>()
    S3.elements.forEach((el, i) => map.set(el.id, S3.elements[(i + 1) % S3.order].id))
    const result = verifyHomomorphism(S3, S3, map)
    expect(result.isHomomorphism).toBe(false)
  })

  it('non-homomorphic mapping reports a violation pair', () => {
    const C4 = createCyclicGroup(4)
    const C2 = createCyclicGroup(2)
    // f(1)=1 but f(2)=1: then f(1·1)=f(2)=1 while f(1)·f(1)=1·1=0 -> violation
    const map = new Map<string, string>()
    map.set(C4.elements[0].id, C2.elements[0].id)
    map.set(C4.elements[1].id, C2.elements[1].id)
    map.set(C4.elements[2].id, C2.elements[1].id)
    map.set(C4.elements[3].id, C2.elements[0].id)
    const result = verifyHomomorphism(C4, C2, map)
    expect(result.isHomomorphism).toBe(false)
    expect(result.violation).toBeDefined()
  })

  it('trivial mapping to identity is always a homomorphism with kernel = G', () => {
    const S3 = createS3()
    const V4 = createKleinFour()
    const map = trivialMapping(S3, V4)
    const result = verifyHomomorphism(S3, V4, map)
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(S3.order)
    expect(result.image.length).toBe(1)
  })

  it('partial mapping (missing elements) is rejected as a homomorphism', () => {
    const S3 = createS3()
    const map = new Map<string, string>()
    map.set(S3.elements[0].id, S3.elements[0].id)
    map.set(S3.elements[1].id, S3.elements[1].id)
    const result = verifyHomomorphism(S3, S3, map)
    expect(result.isHomomorphism).toBe(false)
    expect(result.violation).toBeDefined()
    expect(result.kernel.length).toBe(0)
    expect(result.image.length).toBe(0)
  })
})

describe('naturalProjectionMapping', () => {
  it('Z6 -> Z3 projection is a homomorphism with kernel of size 2', () => {
    const Z6 = createCyclicGroup(6)
    const Z3 = createCyclicGroup(3)
    const map = naturalProjectionMapping(Z6, Z3)
    expect(map).not.toBeNull()
    const result = verifyHomomorphism(Z6, Z3, map!)
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(2)
    expect(result.image.length).toBe(3)
  })

  it('Z12 -> Z4 projection has kernel of size 3', () => {
    const Z12 = createCyclicGroup(12)
    const Z4 = createCyclicGroup(4)
    const map = naturalProjectionMapping(Z12, Z4)
    expect(map).not.toBeNull()
    const result = verifyHomomorphism(Z12, Z4, map!)
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(3)
  })

  it('returns null when divisibility fails (Z6 -> Z4)', () => {
    const Z6 = createCyclicGroup(6)
    const Z4 = createCyclicGroup(4)
    expect(naturalProjectionMapping(Z6, Z4)).toBeNull()
  })

  it('returns null for non-cyclic symbols', () => {
    const S3 = createS3()
    const Z3 = createCyclicGroup(3)
    expect(naturalProjectionMapping(S3, Z3)).toBeNull()
  })
})

describe('autoBuildMapping', () => {
  it('Z6 -> Z3 produces a projection mapping', () => {
    const result = autoBuildMapping(createCyclicGroup(6), createCyclicGroup(3))
    expect(result).not.toBeNull()
    expect(result!.type).toBe('projection')
  })

  it('S3 -> S3 produces nothing', () => {
    const S3 = createS3()
    expect(autoBuildMapping(S3, S3)).toBeNull()
  })
})

describe('getHomomorphismProperties', () => {
  it('identity mapping is an isomorphism', () => {
    const S3 = createS3()
    const result = verifyHomomorphism(S3, S3, identityMap(S3))
    const props = getHomomorphismProperties(S3, S3, result)
    expect(props.isInjective).toBe(true)
    expect(props.isSurjective).toBe(true)
    expect(props.isIsomorphism).toBe(true)
    expect(props.kernelOrder).toBe(1)
    expect(props.imageOrder).toBe(6)
  })

  it('trivial mapping into larger group is neither injective nor surjective', () => {
    const S3 = createS3()
    const V4 = createKleinFour()
    const result = verifyHomomorphism(S3, V4, trivialMapping(S3, V4))
    const props = getHomomorphismProperties(S3, V4, result)
    expect(props.isInjective).toBe(false)
    expect(props.isSurjective).toBe(false)
    expect(props.isIsomorphism).toBe(false)
    expect(props.kernelOrder).toBe(6)
    expect(props.imageOrder).toBe(1)
  })

  it('Z6 -> Z3 projection is surjective but not injective', () => {
    const Z6 = createCyclicGroup(6)
    const Z3 = createCyclicGroup(3)
    const map = naturalProjectionMapping(Z6, Z3)!
    const result = verifyHomomorphism(Z6, Z3, map)
    const props = getHomomorphismProperties(Z6, Z3, result)
    expect(props.isSurjective).toBe(true)
    expect(props.isInjective).toBe(false)
  })
})

describe('subgroupInclusionMapping', () => {
  it('injecting a subgroup into the parent group is a homomorphism', () => {
    const S3 = createS3()
    const A3 = createAlternatingGroup(3)
    const map = subgroupInclusionMapping(A3, S3, A3.elements.map(e => e.id))
    expect(map).not.toBeNull()
    const result = verifyHomomorphism(A3, S3, map!)
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(1)
  })

  it('pointwise collapse of non-subgroup elements is not a homomorphism', () => {
    const S3 = createS3()
    const subgroups = findAllSubgroups(S3)
    const sub = subgroups.find(s => s.order === 3)!
    const sourceIds = sub.elements.map(e => e.id)
    const map = subgroupInclusionMapping(S3, S3, sourceIds)
    expect(map).not.toBeNull()
    const result = verifyHomomorphism(S3, S3, map!)
    // subgroup elements keep their position, everything else maps to identity
    expect(result.isHomomorphism).toBe(false)
    expect(result.violation).toBeDefined()
    // every element outside the subgroup maps to identity
    const mappedToIdentity = S3.elements.filter(el => map!.get(el.id) === S3.identity.id).length
    expect(mappedToIdentity).toBe(1 + (S3.order - 3))
  })

  it('non-subgroup elements of source collapse onto target identity', () => {
    const S3 = createS3()
    const map = subgroupInclusionMapping(S3, S3, [S3.identity.id])
    expect(map).not.toBeNull()
    expect(map!.get(S3.identity.id)).toBe(S3.identity.id)
    expect(map!.get(S3.elements[1].id)).toBe(S3.identity.id)
  })
})

describe('directProductProjectionMapping', () => {
  it('projects Z2 x Z2 onto its first factor as a homomorphism', () => {
    const Z2 = createCyclicGroup(2)
    const DP = createDirectProduct(Z2, Z2)
    const map = directProductProjectionMapping(DP, Z2, 0)
    expect(map).not.toBeNull()
    const result = verifyHomomorphism(DP, Z2, map!)
    expect(result.isHomomorphism).toBe(true)
    expect(result.kernel.length).toBe(2)
    expect(result.image.length).toBe(2)
  })

  it('returns null for a non-direct-product source', () => {
    const S3 = createS3()
    const Z2 = createCyclicGroup(2)
    expect(directProductProjectionMapping(S3, Z2, 0)).toBeNull()
  })
})

describe('extendFromGenerators', () => {
  it('an automorphism defined on generators extends to the whole group', () => {
    const C11 = createCyclicGroup(11)
    const genEl = C11.generators[0].apply(C11.identity)
    // send generator to its square: value k -> 2k mod 11
    const k = genEl.value[0]
    const targetEl = C11.elements.find(e => e.value[0] === (2 * k) % 11)!
    const genMap = new Map<string, string>([[genEl.id, targetEl.id]])
    const full = extendFromGenerators(C11, C11, genMap)
    expect(full).not.toBeNull()
    expect(full!.size).toBe(11)
    const result = verifyHomomorphism(C11, C11, full!)
    expect(result.isHomomorphism).toBe(true)
  })

  it('returns null when generators cannot reach the whole group', () => {
    const C6 = createCyclicGroup(6)
    // e2 has order 3 and only generates {e0, e2, e4} -> BFS cannot cover C6
    const el = C6.elements.find(e => computeElementOrder(C6, e) === 3)!
    const genMap = new Map<string, string>([[el.id, el.id]])
    const full = extendFromGenerators(C6, C6, genMap)
    expect(full).toBeNull()
  })
})

describe('formatKernelLabel', () => {
  it('single-element kernel renders as trivial set', () => {
    const S3 = createS3()
    expect(formatKernelLabel(S3, [S3.identity.id])).toBe('\\{e\\}')
  })

  it('multi-element kernel is wrapped in braces', () => {
    const S3 = createS3()
    const label = formatKernelLabel(S3, [S3.identity.id, S3.elements[1].id])
    expect(label.startsWith('\\{')).toBe(true)
    expect(label.endsWith('\\}')).toBe(true)
  })

  it('long kernels get ellipsis', () => {
    const Z12 = createCyclicGroup(12)
    const label = formatKernelLabel(Z12, Z12.elements.map(e => e.id))
    expect(label).toContain('\\dots')
  })
})

describe('isElementIdentity', () => {
  it('checks against identity id', () => {
    const S3 = createS3()
    expect(isElementIdentity(S3, S3.identity.id)).toBe(true)
    expect(isElementIdentity(S3, S3.elements[1].id)).toBe(false)
  })
})

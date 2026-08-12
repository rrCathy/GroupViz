import { describe, it, expect } from 'vitest'
import {
  isQuotientGroup,
  isAutomorphismGroup,
  isGroupCyclic,
  isGroupDihedral,
  isGroupDirectProduct,
  isGroupSemidirectProduct,
  analyzeDPFactors,
  analyzeDPFactorsGrouped2D,
  isCyclicFactorKeys,
  getAvailableShapes3D,
  getDefaultLayout3D,
  getDefaultShape2D,
  getAvailableShapesForView,
  hasTopLevelTimes,
  classifyDirectProduct2D,
  isC2Cube,
} from '../core/types'
import type { Group, GroupElement } from '../core/types'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'

const ID: GroupElement = { id: 'e', label: '0', value: [] }

function mk(overrides: Partial<Group>): Group {
  return {
    name: '',
    symbol: '',
    order: 1,
    elements: [],
    generators: [],
    multiply: (a) => a,
    inverse: (el) => el,
    identity: ID,
    isAbelian: false,
    ...overrides,
  }
}

describe('group property predicates', () => {
  it('isQuotientGroup detects /N in symbol', () => {
    expect(isQuotientGroup(mk({ symbol: 'S_{4}/N' }))).toBe(true)
    expect(isQuotientGroup(mk({ symbol: 'C_{6}' }))).toBe(false)
  })

  it('isAutomorphismGroup requires a non-empty parent symbol', () => {
    expect(isAutomorphismGroup(mk({ symbol: 'Aut(C_6)', automorphismParentSymbol: 'C_6' }))).toBe(true)
    expect(isAutomorphismGroup(mk({ symbol: 'Aut(C_6)', automorphismParentSymbol: '' }))).toBe(false)
    expect(isAutomorphismGroup(mk({ symbol: 'C_6' }))).toBe(false)
  })

  it('isGroupCyclic / isGroupDihedral / isGroupSemidirectProduct', () => {
    expect(isGroupCyclic(mk({ symbol: 'C_{6}' }))).toBe(true)
    expect(isGroupCyclic(mk({ symbol: 'D_6' }))).toBe(false)
    expect(isGroupDihedral(mk({ symbol: 'D_6' }))).toBe(true)
    expect(isGroupDihedral(mk({ symbol: 'C_6' }))).toBe(false)
    expect(isGroupSemidirectProduct(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}' }))).toBe(true)
    expect(isGroupSemidirectProduct(mk({ symbol: 'C_{2} \\times C_{3}' }))).toBe(false)
    expect(isGroupSemidirectProduct(mk({ symbol: '(C_{4}\\times C_{2}):C_{2}' }))).toBe(true)
    expect(isGroupSemidirectProduct(mk({ symbol: 'C_{2} \\times (C_{3}:C_{2})' }))).toBe(false)
  })

  it('isGroupDirectProduct rules', () => {
    expect(isGroupDirectProduct(mk({ symbol: 'C_{2} \\times C_{3}' }))).toBe(true)
    expect(isGroupDirectProduct(mk({ symbol: 'C_{2}^{3}' }))).toBe(true)
    expect(isGroupDirectProduct(mk({
      symbol: 'x',
      elements: [{ id: 'a|b', label: '', value: [] }],
    }))).toBe(true)
    expect(isGroupDirectProduct(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}' }))).toBe(false)
    expect(isGroupDirectProduct(mk({ symbol: 'S_{3}' }))).toBe(false)
  })

  it('hasTopLevelTimes ignores \\times inside brackets', () => {
    expect(hasTopLevelTimes('C_{2} \\times C_{3}')).toBe(true)
    expect(hasTopLevelTimes('(Z_{4} \\times Z_{2}) : Z_{2}')).toBe(false)
    expect(hasTopLevelTimes('C_{2} \\times (C_{3}:C_{2})')).toBe(true)
    expect(hasTopLevelTimes('Z_{2} \\times D_{8}')).toBe(true)
    expect(hasTopLevelTimes('C_{3} \\rtimes_{\\phi} C_{2}')).toBe(false)
  })

  it('isGroupDirectProduct rejects semidirect-marked registry groups', () => {
    const group163 = getSmallGroup(16, 2)
    expect(group163).not.toBeNull()
    expect(group163!.group.symbol).toBe('(C_{4}\\times C_{2}):C_{2}')
    expect(isGroupDirectProduct(group163!.group)).toBe(false)
    const group162 = getSmallGroup(16, 1)
    expect(isGroupDirectProduct(group162!.group)).toBe(true)
  })
})

describe('analyzeDPFactors', () => {
  it('parses \\times parts', () => {
    const info = analyzeDPFactors(mk({ symbol: 'C_{2} \\times C_{3}' }))
    expect(info).toEqual({ symbolParts: ['C_{2}', 'C_{3}'], totalFactors: 2, cyclicCount: 2, allCyclic: true, isPipeProduct: false })
  })

  it('parses ^{n} superscript form', () => {
    const info = analyzeDPFactors(mk({ symbol: 'C_{2}^{3}' }))
    expect(info?.totalFactors).toBe(3)
    expect(info?.allCyclic).toBe(true)
  })

  it('fills unspecified parts for pipe-only symbols', () => {
    const info = analyzeDPFactors(mk({
      symbol: 'G',
      elements: [{ id: 'a|b|c', label: '', value: [] }],
    }))
    expect(info?.symbolParts).toEqual(['unknown', 'unknown', 'unknown'])
    expect(info?.isPipeProduct).toBe(true)
  })

  it('returns null for non-direct products', () => {
    expect(analyzeDPFactors(mk({ symbol: 'S_{3}' }))).toBeNull()
  })

  it('returns null when nothing can be parsed', () => {
    const info = analyzeDPFactors(mk({ symbol: 'x', elements: [{ id: 'ab', label: '', value: [] }] }))
    expect(info?.totalFactors).toBeFalsy()
    expect(info).toBeNull()
  })
})

describe('isCyclicFactorKeys', () => {
  it('accepts binary vector keys', () => {
    expect(isCyclicFactorKeys(['0,0', '1,0', '1,1', '0,1'])).toBe(true)
  })
  it('accepts 0..n-1 integer keys', () => {
    expect(isCyclicFactorKeys(['0', '1', '2', '3'])).toBe(true)
  })
  it('rejects non-canonical keys and empty input', () => {
    expect(isCyclicFactorKeys(['a', 'b'])).toBe(false)
    expect(isCyclicFactorKeys([])).toBe(false)
  })
})

describe('getAvailableShapes3D', () => {
  it('returns empty for quotient groups', () => {
    expect(getAvailableShapes3D(mk({ symbol: 'S_{4}/N' }))).toEqual([])
  })

  it('offers lattice/torus/circular for semidirect products', () => {
    const shapes = getAvailableShapes3D(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}' }))
    expect(shapes).toEqual(['spherical', 'semidirectCylinder', 'lattice', 'torus', 'circular'])
  })

  it('handles direct products by factor type', () => {
    expect(getAvailableShapes3D(mk({ symbol: 'C_{2} \\times C_{3}' }))).toEqual(['spherical', 'lattice', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'C_{2} \\times S_{3}' }))).toEqual(['spherical', 'cylinder', 'lattice', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'C_{2} \\times C_{3} \\times C_{5}' }))).toEqual(['spherical', 'lattice', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'S_{3} \\times S_{4} \\times S_{5}' }))).toEqual(['spherical', 'lattice', 'torus', 'circular'])
  })

  it('handles cyclic, dihedral, abelian order-4 and generic groups', () => {
    expect(getAvailableShapes3D(mk({ symbol: 'C_{7}' }))).toEqual(['spherical', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'D_4' }))).toEqual(['spherical', 'dihedral', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'V_{4}', isAbelian: true, order: 4 }))).toEqual(['spherical', 'circular', 'tetrahedron'])
    expect(getAvailableShapes3D(mk({ symbol: 'V_{4}', isAbelian: true, order: 8 }))).toEqual(['spherical', 'circular'])
  })

  it('assigns special polyhedra for named groups', () => {
    expect(getAvailableShapes3D(mk({ symbol: 'S_{3}' }))).toContain('hexagon')
    expect(getAvailableShapes3D(mk({ symbol: 'S_{4}' }))).toContain('truncatedCube')
    expect(getAvailableShapes3D(mk({ symbol: 'Q_{8}' }))).toContain('cube')
    expect(getAvailableShapes3D(mk({ symbol: 'A_{4}' }))).toContain('truncatedTetrahedron')
    expect(getAvailableShapes3D(mk({ symbol: 'A_{5}' }))).toContain('truncatedIcosahedron')
    expect(getAvailableShapes3D(mk({ symbol: 'A_{6}' }))).toEqual(['spherical', 'circular'])
    expect(getAvailableShapes3D(mk({ symbol: 'S_{6}' }))).toEqual(['spherical', 'circular'])
  })
})

describe('getDefaultLayout3D', () => {
  it('chooses layout per family', () => {
    expect(getDefaultLayout3D(mk({ symbol: 'S_{4}/N' }))).toBe('spherical')
    expect(getDefaultLayout3D(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}' }))).toBe('lattice')
    expect(getDefaultLayout3D(mk({ symbol: 'C_{2} \\times C_{3}' }))).toBe('lattice')
    expect(getDefaultLayout3D(mk({ symbol: 'C_{2} \\times S_{3}' }))).toBe('cylinder')
    expect(getDefaultLayout3D(mk({ symbol: 'S_{3} \\times S_{4}' }))).toBe('torus')
    expect(getDefaultLayout3D(mk({ symbol: 'D_{3}' }))).toBe('dihedral')
    expect(getDefaultLayout3D(mk({ symbol: 'C_{5}' }))).toBe('circular')
    expect(getDefaultLayout3D(mk({ symbol: 'V_{4}', isAbelian: true }))).toBe('circular')
    expect(getDefaultLayout3D(mk({ symbol: 'S_{3}' }))).toBe('hexagon')
    expect(getDefaultLayout3D(mk({ symbol: 'Q_{8}' }))).toBe('cube')
    expect(getDefaultLayout3D(mk({ symbol: 'A_{4}' }))).toBe('truncatedTetrahedron')
    expect(getDefaultLayout3D(mk({ symbol: 'A_{5}' }))).toBe('truncatedIcosahedron')
    expect(getDefaultLayout3D(mk({ symbol: 'S_{4}' }))).toBe('truncatedCube')
    expect(getDefaultLayout3D(mk({ symbol: 'S_{6}' }))).toBe('circular')
    expect(getDefaultLayout3D(mk({ symbol: 'Weird_{x}' }))).toBe('spherical')
  })
})

describe('getDefaultShape2D', () => {
  it('assigns 2D default shapes', () => {
    expect(getDefaultShape2D(mk({ symbol: 'S_{4}/N' }))).toBe('circular')
    expect(getDefaultShape2D(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}', order: 12 }))).toBe('rewiring')
    expect(getDefaultShape2D(mk({ symbol: 'C_{2} \\times C_{3}', order: 12 }))).toBe('grid')
    expect(getDefaultShape2D(mk({ symbol: 'S_{3}', order: 6 }))).toBe('circular') // ≤7 阶只有圆形
    expect(getDefaultShape2D(mk({ symbol: 'A_{5}', order: 60 }))).toBe('projection3D')
    expect(getDefaultShape2D(mk({ symbol: 'Q_{8}', order: 8 }))).toBe('pythagoreanSquare')
    expect(getDefaultShape2D(mk({ symbol: 'S_{9}', order: 9 }))).toBe('projection3D')
    expect(getDefaultShape2D(mk({ symbol: 'C_{5}', order: 5 }))).toBe('circular') // ≤7 阶只有圆形
    expect(getDefaultShape2D(mk({ symbol: 'D_{3}', order: 6 }))).toBe('circular') // ≤7 阶只有圆形
    expect(getDefaultShape2D(mk({ symbol: 'X_{1}', order: 40 }))).toBe('archimedean')
    expect(getDefaultShape2D(mk({ symbol: 'S_{3} \\times C_{2}', order: 20 }))).toBe('cylinder')
  })

  it('assigns rewiring to registered semidirect products (GAP : notation)', () => {
    expect(getDefaultShape2D(getSmallGroup(16, 2)!.group)).toBe('rewiring')
  })

  it('uses circular for all groups of order <= 7', () => {
    expect(getDefaultShape2D(createS3())).toBe('circular')
    expect(getDefaultShape2D(createCyclicGroup(5))).toBe('circular')
  })

  it('uses circular for all cyclic groups (spiral is manual only)', () => {
    expect(getDefaultShape2D(createCyclicGroup(9))).toBe('circular')
    expect(getDefaultShape2D(createCyclicGroup(10))).toBe('circular')
    expect(getDefaultShape2D(createCyclicGroup(16))).toBe('circular')
    expect(getDefaultShape2D(createCyclicGroup(24))).toBe('circular')
  })

  it('lays out C2^3 as a dual ring (D4 style)', () => {
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    expect(getDefaultShape2D(cube)).toBe('dualRing')
  })
})

describe('analyzeDPFactorsGrouped2D', () => {
  it('groups adjacent same-base cyclic parts (C2 x C2 -> C2^2)', () => {
    const info = analyzeDPFactorsGrouped2D(mk({ symbol: 'C_{2} \\times C_{2} \\times S_{3}' }))
    expect(info).not.toBeNull()
    expect(info!.count).toBe(2)
    expect(info!.parts).toEqual(['C_{2}^{2}', 'S_{3}'])
    expect(info!.cyclic).toEqual([false, false])
    expect(info!.cyclicCount).toBe(0)
    expect(info!.allCyclic).toBe(false)
  })

  it('keeps distinct cyclic parts separate (C2 x C3 x S3)', () => {
    const info = analyzeDPFactorsGrouped2D(mk({ symbol: 'C_{2} \\times C_{3} \\times S_{3}' }))
    expect(info).not.toBeNull()
    expect(info!.count).toBe(3)
    expect(info!.parts).toEqual(['C_{2}', 'C_{3}', 'S_{3}'])
    expect(info!.cyclic).toEqual([true, true, false])
    expect(info!.cyclicCount).toBe(2)
    expect(info!.allCyclic).toBe(false)
  })

  it('does not expand a compact power (C2^3 stays one factor)', () => {
    const info = analyzeDPFactorsGrouped2D(mk({ symbol: 'C_{2}^{3}' }))
    expect(info).not.toBeNull()
    expect(info!.count).toBe(1)
    expect(info!.parts).toEqual(['C_{2}^{3}'])
    expect(info!.cyclic).toEqual([false])
    expect(info!.allCyclic).toBe(false)
  })

  it('never merges non-cyclic parts (S3 x S3)', () => {
    const info = analyzeDPFactorsGrouped2D(mk({ symbol: 'S_{3} \\times S_{3}' }))
    expect(info).not.toBeNull()
    expect(info!.count).toBe(2)
    expect(info!.parts).toEqual(['S_{3}', 'S_{3}'])
    expect(info!.cyclic).toEqual([false, false])
  })

  it('returns null for non-direct-product symbols', () => {
    expect(analyzeDPFactorsGrouped2D(mk({ symbol: 'S_{3}' }))).toBeNull()
    expect(analyzeDPFactorsGrouped2D(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}' }))).toBeNull()
  })
})

describe('classifyDirectProduct2D', () => {
  it('classifies registry direct products (non-pipe) by symbol factors', () => {
    expect(classifyDirectProduct2D(getSmallGroup(16, 1)!.group)).toBe('grid') // C₄×C₄ 全循环
    expect(classifyDirectProduct2D(getSmallGroup(16, 10)!.group)).toBe('cylinder') // Z₂×D₄
    expect(classifyDirectProduct2D(getSmallGroup(16, 11)!.group)).toBe('cylinder') // Z₂×Q₈
    expect(classifyDirectProduct2D(getSmallGroup(16, 2)!.group)).toBe('grid') // (Z₄×Z₂):Z₂ 半直积防御
    expect(classifyDirectProduct2D(getSmallGroup(24, 13)!.group)).toBe('torus') // C₂×C₂×S₃ 归组 C₂²×S₃ 全非循环
  })
})

describe('isC2Cube', () => {
  it('detects the elementary abelian 2-group of order 8 (C2^3)', () => {
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    expect(isC2Cube(cube)).toBe(true)
  })

  it('rejects cyclic, dihedral, quaternion, and order-4 groups', () => {
    expect(isC2Cube(createCyclicGroup(8))).toBe(false) // C8 has order-8 element
    expect(isC2Cube(createCyclicGroup(2))).toBe(false) // order 4? no—order 2, still not 8
    expect(isC2Cube(createS3())).toBe(false) // order 6
    const v4 = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    expect(isC2Cube(v4)).toBe(false) // order 4
  })
})

describe('getAvailableShapesForView', () => {
  it('returns circular for null group', () => {
    expect(getAvailableShapesForView(null, 'cayley')).toEqual(['circular'])
  })

  it('cayley view per family', () => {
    expect(getAvailableShapesForView(mk({ symbol: 'S_{4}/N' }), 'cayley')).toEqual(['circular'])
    expect(getAvailableShapesForView(mk({ symbol: 'C_{3} \\rtimes_{\\phi} C_{2}', order: 12 }), 'cayley')).toEqual(['rewiring', 'circular', 'spherical', 'concentric'])
    expect(getAvailableShapesForView(getSmallGroup(16, 2)!.group, 'cayley')).toEqual(['rewiring', 'circular', 'spherical', 'concentric'])
    expect(getAvailableShapesForView(mk({ symbol: 'C_{12}', order: 12 }), 'cayley')).toEqual(['circular', 'spherical', 'spiral', 'coil'])
    expect(getAvailableShapesForView(mk({ symbol: 'D_{4}', order: 8 }), 'cayley')).toEqual(['circular', 'spherical', 'dualRing'])

    const s3 = getAvailableShapesForView(mk({ symbol: 'S_{3}', order: 6 }), 'cayley')
    expect(s3).toEqual(['circular']) // ≤7 阶只有圆形

    const s4 = getAvailableShapesForView(mk({ symbol: 'S_{4}', order: 24 }), 'cayley')
    expect(s4).toContain('projection3D')
    expect(s4).toContain('spherical')

    const g = getAvailableShapesForView(mk({ symbol: 'C_{2} \\times S_{3}', order: 12 }), 'cayley')
    expect(g).toContain('grid')
    expect(g).toContain('archimedean')
    expect(g).not.toContain('concentric')

    const gg = getAvailableShapesForView(mk({ symbol: 'C_{2} \\times C_{3}', order: 12 }), 'cayley')
    expect(gg.filter(s => s === 'grid').length).toBe(1)
  })

  it('limits C9/C10 and C2^3 shape lists', () => {
    expect(getAvailableShapesForView(createCyclicGroup(9), 'cayley')).toEqual(['circular'])
    expect(getAvailableShapesForView(createCyclicGroup(10), 'cayley')).toEqual(['circular'])
    const c2 = createCyclicGroup(2)
    const cube = createDirectProduct(createDirectProduct(c2, c2), c2)
    expect(getAvailableShapesForView(cube, 'cayley')).toEqual(['circular', 'dualRing', 'grid'])
  })

  it('Q8 shows pythagoreanSquare in available shapes', () => {
    const q8 = mk({ symbol: 'Q_{8}', order: 8 })
    const shapes = getAvailableShapesForView(q8, 'cayley')
    expect(shapes).toContain('pythagoreanSquare')
    expect(shapes).toContain('circular')
  })

  it('other views get a single default', () => {
    expect(getAvailableShapesForView(mk({ symbol: 'C_{6}' }), 'cycle')).toEqual(['circular'])
    expect(getAvailableShapesForView(mk({ symbol: 'C_{6}' }), 'set')).toEqual(['circular'])
  })
})
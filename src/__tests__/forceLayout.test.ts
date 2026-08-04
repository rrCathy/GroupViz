import { describe, it, expect } from 'vitest'
import {
  directProductGridLayout2D,
  fibonacci2DLayout,
  computeElementOrder,
  concentricLayout,
  dualRingLayout,
  archimedeanSpiralLayout,
  spiralLayout,
  coilLayout,
  cosetStripLayout,
  projection3DLayout,
  semidirectProductLayout,
} from '../core/algebra/forceLayout'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createDirectProduct } from '../core/groups/DirectProduct'
import { createSemidirectProduct } from '../core/groups/SemidirectProduct'
import { findAllSubgroups } from '../core/algebra/subgroups'
import type { Group, GroupElement } from '../core/types'
import type { Automorphism } from '../core/algebra/automorphisms'

function identityAuto(group: Group): Automorphism {
  return {
    id: 'id',
    map: new Map(group.elements.map(e => [e.id, e.id])),
    label: '\\mathrm{id}',
    apply: (el: GroupElement) => el,
  }
}

describe('directProductGridLayout2D', () => {
  it('returns null for non-direct-product groups', () => {
    expect(directProductGridLayout2D(createS3(), 800, 600)).toBeNull()
  })

  it('lays out Z2 x Z2 as a 2x2 grid', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(2))
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(4)
  })

  it('lays out pipe-id products via matrix grid', () => {
    const dp = createDirectProduct(createCyclicGroup(2), createCyclicGroup(3))
    expect(dp.elements[0].id.includes('|')).toBe(true)
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })

  it('lays out products with non-cyclic factors via nested layout', () => {
    const dp = createDirectProduct(createS3(), createCyclicGroup(2))
    const pos = directProductGridLayout2D(dp, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(12)
  })
})

describe('fibonacci2DLayout', () => {
  it('returns a position for every element', () => {
    const pos = fibonacci2DLayout(createCyclicGroup(6), 800, 600)
    expect(pos.size).toBe(6)
  })

  it('centers a single-element group', () => {
    const c1 = createCyclicGroup(1)
    const pos = fibonacci2DLayout(c1, 800, 600)
    expect(pos.size).toBe(1)
    expect(pos.get(c1.identity.id)).toEqual({ x: 400, y: 300 })
  })
})

describe('computeElementOrder', () => {
  it('identity has order 1', () => {
    const c6 = createCyclicGroup(6)
    expect(computeElementOrder(c6.identity, c6)).toBe(1)
  })

  it('matches known orders in C6', () => {
    const c6 = createCyclicGroup(6)
    const e1 = c6.elements.find(e => e.value[0] === 1)!
    const e2 = c6.elements.find(e => e.value[0] === 2)!
    expect(computeElementOrder(e1, c6)).toBe(6)
    expect(computeElementOrder(e2, c6)).toBe(3)
  })
})

describe('concentricLayout', () => {
  it('places every element of S3', () => {
    const pos = concentricLayout(createS3(), 800, 600)
    expect(pos.size).toBe(6)
  })
})

describe('dualRingLayout', () => {
  it('places every element of D4', () => {
    const pos = dualRingLayout(createDihedralGroup(4), 800, 600)
    expect(pos.size).toBe(8)
  })
})

describe('spiral layouts', () => {
  const c6 = createCyclicGroup(6)

  it('archimedean spiral places every element', () => {
    expect(archimedeanSpiralLayout(c6, 800, 600).size).toBe(6)
  })

  it('spiral places every element', () => {
    expect(spiralLayout(c6, 800, 600).size).toBe(6)
  })

  it('coil places every element', () => {
    expect(coilLayout(c6, 800, 600).size).toBe(6)
  })
})

describe('cosetStripLayout', () => {
  it('returns empty data for an empty group', () => {
    const empty = { order: 0, elements: [], identity: { id: '', label: '', value: [] } } as unknown as Group
    const data = cosetStripLayout(empty, 800, 400)
    expect(data.positions.size).toBe(0)
    expect(data.strips.length).toBe(0)
  })

  it('lays out S3 by cosets of A3 into two strips', () => {
    const s3 = createS3()
    const a3 = findAllSubgroups(s3).find(s => s.order === 3)!
    const a3Ids = a3.elements.map(e => e.id)
    const a3Set = new Set(a3Ids)
    const cosetMap = new Map<string, number>()
    for (const el of s3.elements) cosetMap.set(el.id, a3Set.has(el.id) ? 0 : 1)

    const data = cosetStripLayout(s3, 800, 400, a3Ids, cosetMap, 2)
    expect(data.positions.size).toBe(6)
    expect(data.strips.length).toBe(2)
  })
})

describe('projection3DLayout', () => {
  it('projects S3 onto its 3D layout', () => {
    const pos = projection3DLayout(createS3(), 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })

  it('projects a cyclic group onto its 3D layout', () => {
    const pos = projection3DLayout(createCyclicGroup(6), 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })
})

describe('semidirectProductLayout', () => {
  it('returns null for groups without semidirect product structure', () => {
    expect(semidirectProductLayout(createS3(), 800, 600)).toBeNull()
  })

  it('lays out C3 ⋊ C2 (identity action) on N-per-H rings', () => {
    const C3 = createCyclicGroup(3)
    const C2 = createCyclicGroup(2)
    const phi = new Map<string, Automorphism>([
      ['e0', identityAuto(C3)],
      ['e1', identityAuto(C3)],
    ])
    const G = createSemidirectProduct(C3, C2, phi)
    expect(G).not.toBeNull()
    const pos = semidirectProductLayout(G!, 800, 600)
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })
})

import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'

import { getDefaultShape2D, getDefaultLayout3D } from '../core/types'
import { initializeNodePositions } from '../context/positionUtils'
import { getInitialCayleyActions } from '../context/cayleyActions'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'

describe('Quotient Group S4/V4 Full Flow', () => {
  it('should initialize node positions with default shape and compute edges', () => {
    const s4 = createSymmetricGroup(4)
    const subgroups = findAllSubgroups(s4!)
    const normal4 = subgroups.find(sg => sg.isNormal && sg.order === 4)
    expect(normal4).toBeDefined()

    const qg = computeQuotientGroup(s4!, normal4!)
    expect(qg).toBeDefined()

    const defaultShape = getDefaultShape2D(qg!)
    expect(defaultShape).toBe('circular')

    // Verify quotient groups have no 3D shapes
    const default3D = getDefaultLayout3D(qg!)
    expect(default3D).toBe('cone')

    // Simulate setCurrentGroup initializing node positions with default shape
    const positions = initializeNodePositions(qg!, 'cayley', defaultShape)
    expect(positions.size).toBe(6)

    // For circular layout, positions should be centered around the viewBox center
    const centerX = 2000 / 2
    const centerY = 2000 / 2
    let minDist = Infinity, maxDist = 0
    for (const [, pos] of positions) {
      const dx = pos.x - centerX
      const dy = pos.y - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      minDist = Math.min(minDist, dist)
      maxDist = Math.max(maxDist, dist)
    }
    // All nodes should be roughly on the same circle (within 1px tolerance)
    expect(maxDist - minDist).toBeLessThan(1)

    // Verify edges exist with correct actions
    const actions = getInitialCayleyActions(qg!)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(a => qg!.elements.some(e => e.id === a.elementId))).toBe(true)

    const edges = computeCayleyActionEdges(qg!, actions, 'right')
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every(e => qg!.elements.some(el => el.id === e.fromId) && qg!.elements.some(el => el.id === e.toId))).toBe(true)
  })
})

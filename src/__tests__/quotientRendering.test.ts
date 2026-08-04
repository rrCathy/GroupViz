import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { findAllSubgroups, computeQuotientGroup } from '../core/algebra/subgroups'
import { ringOrder } from '../core/algebra/ringOrder'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { getInitialCayleyActions } from '../context/cayleyActions'

describe('Quotient Group Rendering', () => {
  it('should have correct indexMap and positions for S4/V4', () => {
    const s4 = createSymmetricGroup(4)
    const normalV4 = findAllSubgroups(s4).find(s => s.order === 4 && s.isNormal)
    expect(normalV4).toBeDefined()
    const qg = computeQuotientGroup(s4, normalV4!)!
    
    // Verify all qcoset IDs are present
    const ids = qg.elements.map(e => e.id)
    expect(ids).toEqual(['qcoset-0', 'qcoset-1', 'qcoset-2', 'qcoset-3', 'qcoset-4', 'qcoset-5'])
    
    // Verify ringOrder handles qcoset IDs correctly
    const ordered = ringOrder(ids)
    expect(ordered).toEqual(['qcoset-0', 'qcoset-1', 'qcoset-2', 'qcoset-3', 'qcoset-4', 'qcoset-5'])
    
    // Build indexMap like GroupCanvas does
    const indexMap = new Map<string, number>()
    const keys = qg.elements.map(e => e.id)
    const order = ringOrder(keys)
    order.forEach((key, i) => indexMap.set(key, i))
    
    ids.forEach((id, expectedIdx) => {
      expect(indexMap.get(id)).toBe(expectedIdx)
    })
    
    // Verify edges reference valid IDs
    const actions = getInitialCayleyActions(qg)
    const edges = computeCayleyActionEdges(qg, actions, 'right')
    expect(edges.length).toBeGreaterThan(0)
    
    edges.forEach(edge => {
      expect(ids).toContain(edge.fromId)
      expect(ids).toContain(edge.toId)
      // Verify positions exist for both endpoints
      const fromIdx = indexMap.get(edge.fromId)
      const toIdx = indexMap.get(edge.toId)
      expect(fromIdx).toBeDefined()
      expect(toIdx).toBeDefined()
    })
  })
})

import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { findAllSubgroups, computeQuotientGroup } from '../core/algebra/subgroups'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { getInitialCayleyActions } from '../context/cayleyActions'

describe('Quotient Group S4/V4', () => {
  it('should create quotient group with correct order', () => {
    const s4 = createSymmetricGroup(4)
    expect(s4).not.toBeNull()
    const normalV4 = findAllSubgroups(s4!).find(s => s.order === 4 && s.isNormal)
    expect(normalV4).toBeDefined()
    const q = computeQuotientGroup(s4!, normalV4!)
    expect(q).not.toBeNull()
    expect(q!.order).toBe(6)
    console.log('Quotient elements:', q!.elements.map(e => ({ id: e.id, label: e.label })))
    console.log('Quotient generators:', q!.generators.map(g => ({ name: g.name, symbol: g.symbol })))
  })

  it('should compute Cayley edges for quotient group', () => {
    const s4 = createSymmetricGroup(4)
    const normalV4 = findAllSubgroups(s4!).find(s => s.order === 4 && s.isNormal)
    const q = computeQuotientGroup(s4!, normalV4!)
    
    const actions = getInitialCayleyActions(q!)
    console.log('Actions:', actions)
    
    const edges = computeCayleyActionEdges(q!, actions, 'right')
    console.log('Edges count:', edges.length)
    console.log('Edges:', edges.map(e => `${e.fromId} -> ${e.toId} (action: ${e.actionElementId})`))
    
    expect(edges.length).toBeGreaterThan(0)
  })
})

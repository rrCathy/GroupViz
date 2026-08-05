import { describe, it, expect } from 'vitest'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import type { Group, CayleyAction } from '../core/types'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'

function makeAction(elementId: string, color = '#ff0000'): CayleyAction {
  return { elementId, enabled: true, color }
}

describe('computeCayleyActionEdges', () => {
  it('returns [] for empty actions', () => {
    const C6 = createCyclicGroup(6)
    expect(computeCayleyActionEdges(C6, [], 'right')).toEqual([])
  })

  it('returns [] when all actions are disabled', () => {
    const C6 = createCyclicGroup(6)
    const actions = [{ elementId: 'e1', enabled: false, color: '#ff0000' }]
    expect(computeCayleyActionEdges(C6, actions, 'right')).toEqual([])
  })

  it('ignores actions whose element id is unknown', () => {
    const C6 = createCyclicGroup(6)
    const actions = [makeAction('does-not-exist')]
    expect(computeCayleyActionEdges(C6, actions, 'right')).toEqual([])
  })

  it('C6 with generator action yields a directed 6-cycle', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    expect(edges.length).toBe(6)
    for (const e of edges) {
      expect(e.isSelfLoop).toBe(false)
      expect(e.isBidirectional).toBe(false)
      expect(Number(e.toId.slice(1))).toBe((Number(e.fromId.slice(1)) + 1) % 6)
    }
    const sources = new Set(edges.map(e => e.fromId))
    const targets = new Set(edges.map(e => e.toId))
    expect(sources.size).toBe(6)
    expect(targets.size).toBe(6)
  })

  it('C6 with involution action dedups to 3 bidirectional edges', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e3')], 'right')
    expect(edges.length).toBe(3)
    for (const e of edges) {
      expect(e.isBidirectional).toBe(true)
      expect(e.isSelfLoop).toBe(false)
    }
  })

  it('C6 with identity action yields 6 self-loops', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e0')], 'right')
    expect(edges.length).toBe(6)
    for (const e of edges) {
      expect(e.isSelfLoop).toBe(true)
      expect(e.isBidirectional).toBe(true)
      expect(e.fromId).toBe(e.toId)
    }
  })

  it('isBidirectional reflects the action element being self-inverse', () => {
    const C6 = createCyclicGroup(6)
    const involution = computeCayleyActionEdges(C6, [makeAction('e3')], 'right')
    expect(involution.every(e => e.isBidirectional)).toBe(true)
    const generator = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    expect(generator.every(e => !e.isBidirectional)).toBe(true)
  })

  it('left vs right multiply differ for a non-abelian group', () => {
    const S3 = createS3()
    const transposition = S3.elements.find(el => S3.inverse(el).id === el.id && el.id !== S3.identity.id)!
    const right = computeCayleyActionEdges(S3, [makeAction(transposition.id)], 'right')
    const left = computeCayleyActionEdges(S3, [makeAction(transposition.id)], 'left')
    expect(right.length).toBe(3)
    expect(left.length).toBe(3)
    const rightPairs = right.map(e => `${e.fromId}->${e.toId}`).sort()
    const leftPairs = left.map(e => `${e.fromId}->${e.toId}`).sort()
    expect(rightPairs).not.toEqual(leftPairs)
  })

  it('left and right coincide for an abelian group', () => {
    const C6 = createCyclicGroup(6)
    const right = computeCayleyActionEdges(C6, [makeAction('e2')], 'right')
    const left = computeCayleyActionEdges(C6, [makeAction('e2')], 'left')
    expect(right).toEqual(left)
  })

  it('edge color is taken from the action', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1', '#123456')], 'right')
    expect(edges.every(e => e.color === '#123456')).toBe(true)
  })

  it('limits edges to max(120, order*3) for order > 60', () => {
    const C120 = createCyclicGroup(120)
    const actions: CayleyAction[] = C120.elements.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: `#${(i * 1000).toString(16).padStart(6, '0')}`,
    }))
    const edges = computeCayleyActionEdges(C120, actions, 'right')
    expect(edges.length).toBe(Math.max(120, C120.order * 3))
  })

  it('does not limit edges for order <= 60', () => {
    const C60 = createCyclicGroup(60)
    const actions: CayleyAction[] = C60.elements.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: `#${(i * 1000).toString(16).padStart(6, '0')}`,
    }))
    const edges = computeCayleyActionEdges(C60, actions, 'right')
    expect(edges.length).toBeGreaterThan(60 * 2)
  })

  it('edge pairs reference valid element indices', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    for (const e of edges) {
      expect(e.fromIdx).toBeGreaterThanOrEqual(0)
      expect(e.fromIdx).toBeLessThan(6)
      expect(e.toIdx).toBeGreaterThanOrEqual(0)
      expect(e.toIdx).toBeLessThan(6)
    }
  })

  it('S3 with both generators keeps 6 edges (3 per action, no cross-action dedup)', () => {
    const S3: Group = createS3()
    const a = S3.generators[0].apply(S3.identity)
    const b = S3.generators[1].apply(S3.identity)
    const edges = computeCayleyActionEdges(S3, [makeAction(a!.id), makeAction(b!.id)], 'right')
    expect(edges.length).toBe(6)
    const actionIds = new Set(edges.map(e => e.actionElementId))
    expect(actionIds.size).toBe(2)
    const perAction = new Map<string, number>()
    for (const e of edges) perAction.set(e.actionElementId, (perAction.get(e.actionElementId) ?? 0) + 1)
    expect([...perAction.values()]).toEqual([3, 3])
  })
})

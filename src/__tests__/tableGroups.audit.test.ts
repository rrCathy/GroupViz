import { describe, it, expect } from 'vitest'
import { getAllSmallGroups } from '../core/groups/SmallGroups'
import { computeShape2DPositions } from '../core/algebra/shapeLayouts'
import { cayleyCircleLayout } from '../core/algebra/forceLayout'
import { getAvailableShapesForView, getDefaultShape2D, hasTopLevelColon } from '../core/types'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { getSemidirectProductMeta } from '../core/algebra/semidirectDecompositions'
import type { Group } from '../core/types'

const W = 900
const H = 700

function isTableGroup(g: Group): boolean {
  return g.elements.length > 0 && g.elements[0].id.startsWith('g')
}

describe('GAP table groups: visualization integrity', () => {
  const groups = getAllSmallGroups().filter(g => isTableGroup(g.group)).map(e => e.group)
  it(`audits ${groups.length} table groups`, () => {
    expect(groups.length).toBeGreaterThan(50)
  })

  for (const group of groups) {
    const shapes = getAvailableShapesForView(group, 'cayley')
    const def = getDefaultShape2D(group)
    it(`${group.symbol} (order ${group.order}): default shape ${def} lays out`, () => {
      if (def === 'circular') {
        const pos = cayleyCircleLayout(group, W / 2, H / 2, 200)
        expect(pos.size, 'circular via cayleyCircleLayout missing elements').toBe(group.order)
        return
      }
      const pos = computeShape2DPositions(group, def, W, H)
      expect(pos, `${def} layout returned null`).not.toBeNull()
      const ids = new Set<string>()
      for (const el of group.elements) {
        const p = pos!.get(el.id)
        expect(p, `no position for ${el.label}`).toBeDefined()
        expect(Number.isFinite(p!.x), `x not finite for ${el.label}`).toBe(true)
        expect(Number.isFinite(p!.y), `y not finite for ${el.label}`).toBe(true)
        const key = `${Math.round(p!.x * 100)}:${Math.round(p!.y * 100)}`
        expect(ids.has(key), `duplicate position for ${el.label}`).toBe(false)
        ids.add(key)
      }
    })

    it(`${group.symbol}: every available shape lays out`, () => {
      for (const shape of shapes.filter(s => s !== 'circular')) {
        const pos = computeShape2DPositions(group, shape, W, H)
        expect(pos, `${shape} layout returned null`).not.toBeNull()
        expect(pos!.size, `${shape} missing elements`).toBe(group.order)
        for (const el of group.elements) {
          const p = pos!.get(el.id)
          expect(Number.isFinite(p!.x) && Number.isFinite(p!.y), `${shape} non-finite for ${el.label}`).toBe(true)
        }
      }
    })

    it(`${group.symbol}: circle layout distinct & finite`, () => {
      const pos = cayleyCircleLayout(group, W / 2, H / 2, 200)
      const seen = new Set<string>()
      for (const el of group.elements) {
        const p = pos.get(el.id)
        expect(p, `no circle position for ${el.label}`).toBeDefined()
        expect(Number.isFinite(p!.x) && Number.isFinite(p!.y), `non-finite for ${el.label}`).toBe(true)
        const key = `${p!.x.toFixed(3)}:${p!.y.toFixed(3)}`
        expect(seen.has(key), `duplicate circle position for ${el.label}`).toBe(false)
        seen.add(key)
      }
    })

    it(`${group.symbol}: generator Cayley edges all valid`, () => {
      const actions = group.generators.map((g) => ({
        elementId: g.apply(group.identity).id,
        enabled: true,
        color: '#000',
      }))
      const edges = computeCayleyActionEdges(group, actions, 'right')
      expect(edges.length, 'no edges').toBeGreaterThan(0)
      const ids = new Set(group.elements.map(e => e.id))
      for (const e of edges) {
        expect(ids.has(e.fromId), `bad from ${e.fromId}`).toBe(true)
        expect(ids.has(e.toId), `bad to ${e.toId}`).toBe(true)
      }
    })

    if (hasTopLevelColon(group.symbol)) {
      it(`${group.symbol}: semidirect meta available`, () => {
        expect(getSemidirectProductMeta(group), 'no semidirect meta for ":" symbol').not.toBeNull()
      })
    }
  }
})

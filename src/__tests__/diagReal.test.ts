import { describe, expect, it } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { computeCayleyActionEdges } from '../core/algebra/forceLayout'
import { embedSphereGraph, polylinesNear, polylinesNearEx, type Vec3, type SphereEdge } from '../core/algebra/sphereGraph'
import type { Group } from '../core/types'

const DEG = Math.PI / 180
const TH = 4.5 * DEG

function arcsCrossStrict(p: Vec3[], q: Vec3[], ae: SphereEdge, be: SphereEdge): boolean {
  if (ae.fromIdx === be.fromIdx || ae.fromIdx === be.toIdx || ae.toIdx === be.fromIdx || ae.toIdx === be.toIdx) {
    const sharedA = ae.fromIdx === be.fromIdx || ae.fromIdx === be.toIdx
    const exDir = sharedA ? p[0] : p[p.length - 1]
    return polylinesNearEx(p, q, TH, 1, exDir)
  }
  return polylinesNear(p, q, TH)
}

function realEdges(group: Group): SphereEdge[] {
  const actions = group.generators.map(gen => {
    const el = gen.apply(group.identity)
    return { elementId: el?.id || group.elements[0].id, enabled: true, color: '#fff' }
  })
  const cay = computeCayleyActionEdges(group, actions, 'right')
  const seen = new Set<string>()
  const edges: SphereEdge[] = []
  for (const e of cay) {
    if (e.isSelfLoop) continue
    const key = `${Math.min(e.fromIdx, e.toIdx)}|${Math.max(e.fromIdx, e.toIdx)}|${e.actionElementId}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ fromIdx: e.fromIdx, toIdx: e.toIdx })
  }
  return edges
}

describe('diag', () => {
  it('s3 seed check: cyclic seeds lie on equator plane', { timeout: 60000 }, () => {
    const s3 = createSymmetricGroup(3)
    const c6 = createCyclicGroup(6)
    for (const [name, g] of [['S3', s3], ['C6', c6]] as Array<[string, Group]>) {
      const edges = realEdges(g)
      const emb = embedSphereGraph(g.order, edges)
      for (const d of emb.directions) {
        expect(Math.abs(d[2]), `${name}: seed on equator`).toBeLessThan(1e-9)
      }
    }
  })

  it('real default cases: planar groups keep all arcs, no shared-endpoint tangles', { timeout: 300000 }, () => {
    const planar = new Set(['C6', 'V4', 'S3', 'D4', 'D5', 'A4', 'S4', 'D6', 'C2xC2xC2'])
    const cases: Array<[string, Group]> = [
      ['C6', createCyclicGroup(6)],
      ['V4', createKleinFour()],
      ['S3', createSymmetricGroup(3)],
      ['D4', createDihedralGroup(4)],
      ['Q8', createQuaternion()],
      ['D5', createDihedralGroup(5)],
      ['A4', createAlternatingGroup(4)],
      ['S4', createSymmetricGroup(4)],
      ['D6', createDihedralGroup(6)],
      ['Q16', getSmallGroup(16, 8)!.group],
      ['C2xC2xC2', createCyclicGroup(2)],
    ] as Array<[string, Group]>
    for (const [name, g] of cases) {
      const edges = realEdges(g)
      const emb = embedSphereGraph(g.order, edges)
      let cross = 0
      for (let i = 0; i < emb.layers[0].arcs.length; i++) {
        for (let j = i + 1; j < emb.layers[0].arcs.length; j++) {
          const ae = emb.layers[0].arcs[i]
          const be = emb.layers[0].arcs[j]
          if (arcsCrossStrict(ae.samples, be.samples, ae, be)) cross++
        }
      }
      const totalArcs = emb.layers.reduce((s, l) => s + l.arcs.length, 0)
      console.log(`${name} order=${g.order} edges=${edges.length} kept=${emb.layers[0].arcs.length} chords=${emb.chords.length} layers=${emb.layers.length} crossShared=${cross}`)
      expect(totalArcs + emb.chords.length, `${name}: arc+chord conservation`).toBe(edges.length)
      if (planar.has(name)) {
        expect(emb.chords.length, `${name}: planar keeps all arcs`).toBe(0)
        expect(emb.layers.length, `${name}: planar single layer`).toBe(1)
        expect(cross, `${name}: planar no tangles at 4.5deg`).toBe(0)
      }
    }
  })
})
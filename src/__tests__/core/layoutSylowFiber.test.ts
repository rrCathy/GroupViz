import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'
import { createGL2 } from '../../core/groups/GeneralLinearGroup'
import { layoutSylowFiber, type SylowFiberNode } from '../../core/algebra/layoutSylowFiber'
import type { Group } from '../../core/types'

/** 节点球直径（与 SylowTorusScene 的 NODE_RADIUS 对齐）：两节点不得靠得比它更近 */
const NODE_DIAMETER = 0.6

function minPairDistance(nodes: SylowFiberNode[]): number {
  let min = Infinity
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position
      const b = nodes[j].position
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z))
    }
  }
  return min
}

describe('layoutSylowFiber', () => {
  it('S₄ 的 Sylow 2-子群：3 层 → 弧状柱面，24 节点', () => {
    const L = layoutSylowFiber(createSymmetricGroup(4), 2)!
    expect(L.mode).toBe('cylinder')
    expect(L.nP).toBe(3)
    expect(L.pOrder).toBe(8)
    expect(L.nodes).toHaveLength(24)
    expect(L.closesCleanly).toBe(true)
  })

  it('S₅ 的 Sylow 2-子群：15 层 → 圆环面，120 节点', () => {
    const L = layoutSylowFiber(createSymmetricGroup(5), 2)!
    expect(L.mode).toBe('torus')
    expect(L.nP).toBe(15)
    expect(L.pOrder).toBe(8)
    expect(L.nodes).toHaveLength(120)
    expect(L.closesCleanly).toBe(true)
  })

  it('GL(2,3) 的 Sylow 2-子群：48 节点，且闭合带回旋扭转', () => {
    const L = layoutSylowFiber(createGL2(3), 2)!
    expect(L.mode).toBe('cylinder')
    expect(L.nP).toBe(3)
    expect(L.pOrder).toBe(16)
    expect(L.nodes).toHaveLength(48)
    // 绕一圈复合出的自同构非恒等（N_G(P) 在 P 上的作用有非平凡元）
    expect(L.closesCleanly).toBe(false)
  })

  it('Sylow p-子群唯一（正规）时没有共轭轨道 → null', () => {
    expect(layoutSylowFiber(createDihedralGroup(4), 2)).toBeNull()
    expect(layoutSylowFiber(createDihedralGroup(6), 3)).toBeNull()
  })

  it('节点互不重叠：任意两节点距离 ≥ 球直径', () => {
    const cases: [Group, number][] = [
      [createSymmetricGroup(3), 2],
      [createSymmetricGroup(4), 2],
      [createSymmetricGroup(4), 3],
      [createSymmetricGroup(5), 2],
      [createSymmetricGroup(5), 3],
      [createSymmetricGroup(5), 5],
      [createAlternatingGroup(5), 2],
      [createGL2(3), 2],
    ]
    for (const [g, p] of cases) {
      const L = layoutSylowFiber(g, p)!
      expect(L, `${g.symbol} p=${p}`).not.toBeNull()
      expect(minPairDistance(L.nodes), `${g.symbol} p=${p}`).toBeGreaterThan(NODE_DIAMETER)
    }
  })

  it('层间共轭连线逐点覆盖：conj 边数 = n_p × |P|', () => {
    const L = layoutSylowFiber(createSymmetricGroup(5), 2)!
    expect(L.edges.filter(e => e.kind === 'conj')).toHaveLength(15 * 8)
    const L4 = layoutSylowFiber(createGL2(3), 2)!
    expect(L4.edges.filter(e => e.kind === 'conj')).toHaveLength(3 * 16)
  })

  it('每层节点都在该层截面上：到层心距离恒等于截面半径', () => {
    const L = layoutSylowFiber(createSymmetricGroup(5), 2)!
    for (const l of L.layers) {
      const own = L.nodes.filter(n => n.layer === l.index)
      expect(own).toHaveLength(L.pOrder)
      for (const n of own) {
        const d = Math.hypot(
          n.position.x - l.center.x,
          n.position.y - l.center.y,
          n.position.z - l.center.z,
        )
        expect(d).toBeCloseTo(l.radius, 6)
      }
    }
  })

  it('层内边只连同一层、共轭边只连相邻层', () => {
    const L = layoutSylowFiber(createSymmetricGroup(4), 2)!
    for (const e of L.edges) {
      const la = Number(e.a.split(':')[0])
      const lb = Number(e.b.split(':')[0])
      if (e.kind === 'inner') expect(la).toBe(lb)
      else expect(Math.abs(la - lb) === 1 || Math.abs(la - lb) === L.nP - 1).toBe(true)
    }
  })

  it('mode 可强制覆盖阈值', () => {
    const forced = layoutSylowFiber(createSymmetricGroup(4), 2, { mode: 'torus' })!
    expect(forced.mode).toBe('torus')
    const flat = layoutSylowFiber(createSymmetricGroup(5), 2, { mode: 'cylinder' })!
    expect(flat.mode).toBe('cylinder')
  })
})

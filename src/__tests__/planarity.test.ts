import { describe, it, expect } from 'vitest'
import { testGraphPlanarity } from '../core/algebra/planarity'
import type { Group } from '../core/types'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createQuaternion } from '../core/groups/SpecialGroup'
import { createGL2 } from '../core/groups/GeneralLinearGroup'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { getGeneratorElement } from '../core/algebra/homomorphisms'

/** 由群 + 全部生成元右乘生成无向简单凯莱边 */
function cayleyEdges(group: Group): Array<[number, number]> {
  const edges: Array<[number, number]> = []
  const visited = new Set<string>()
  for (const gen of group.generators) {
    const genEl = getGeneratorElement(group, gen)
    if (!genEl) continue
    for (let i = 0; i < group.elements.length; i++) {
      const to = group.multiply(group.elements[i], genEl)
      const toIdx = group.elements.findIndex(e => e.id === to.id)
      if (toIdx < 0 || toIdx === i) continue
      const a = Math.min(i, toIdx)
      const b = Math.max(i, toIdx)
      const key = `${a}|${b}`
      if (!visited.has(key)) {
        visited.add(key)
        edges.push([a, b])
      }
    }
  }
  return edges
}

/** 组合嵌入有效性：双向半边 + 每连通分量欧拉公式 n - m + f = 2 */
function expectValidEmbedding(n: number, edges: Array<[number, number]>, embedding: Map<number, number[]>): void {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const [u, v] of edges) {
    adj[u].push(v)
    adj[v].push(u)
  }
for (let v = 0; v < n; v++) {
      const order = embedding.get(v) ?? []
      expect(order.length).toBe(adj[v].length)
      expect(order.length).toBe(new Set(order).size)
      for (const w of order) {
        void w
        expect(embedding.get(w)).toContain(v)
      }
    }
  const visited = new Set<number>()
  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue
    const comp: number[] = []
    const queue = [start]
    visited.add(start)
    while (queue.length > 0) {
      const v = queue.pop()!
      comp.push(v)
      for (const w of adj[v]) {
        if (!visited.has(w)) {
          visited.add(w)
          queue.push(w)
        }
      }
    }
    let halfEdges = 0
    for (const v of comp) {
      const order = embedding.get(v) ?? []
      halfEdges += order.length
    }
    if (halfEdges === 0) continue
    const m = halfEdges / 2
    const marked = new Set<string>()
    let faces = 0
    for (const v of comp) {
      const order = embedding.get(v) ?? []
      for (const w of order) {
        if (marked.has(`${v}|${w}`)) continue
        faces++
        let a = v
        let b = w
        while (!marked.has(`${a}|${b}`)) {
          marked.add(`${a}|${b}`)
          const nb = embedding.get(b) ?? []
          const idx = nb.indexOf(a)
          const next = nb[(idx + 1) % nb.length]
          a = b
          b = next
        }
      }
    }
    expect(comp.length - m + faces).toBe(2)
  }
}

describe('testGraphPlanarity', () => {
  it('K5 非平面（欧拉快速路径）', () => {
    const edges: Array<[number, number]> = []
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edges.push([i, j])
    const r = testGraphPlanarity(5, edges)
    expect(r.planar).toBe(false)
    expect(r.embedding).toBeNull()
  })

  it('K3,3 非平面', () => {
    const edges: Array<[number, number]> = []
    for (let i = 0; i < 3; i++) for (let j = 3; j < 6; j++) edges.push([i, j])
    const r = testGraphPlanarity(6, edges)
    expect(r.planar).toBe(false)
  })

  it('Petersen 图非平面', () => {
    const edges: Array<[number, number]> = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
      [5, 7], [7, 9], [9, 6], [6, 8], [8, 5],
      [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],
    ]
    expect(testGraphPlanarity(10, edges).planar).toBe(false)
  })

  it('去自环/去重：单边重复图平面', () => {
    const r = testGraphPlanarity(3, [[0, 1], [1, 0], [2, 2], [0, 1]])
    expect(r.planar).toBe(true)
    expectValidEmbedding(3, [[0, 1]], r.embedding!)
  })

  const planarGroups: Array<[string, Group]> = [
    ['C6', createCyclicGroup(6)],
    ['S3', createSymmetricGroup(3)],
    ['D4', createDihedralGroup(4)],
    ['D6', createDihedralGroup(6)],
    ['A4', createAlternatingGroup(4)],
    ['S4', createSymmetricGroup(4)],
    ['A5', createAlternatingGroup(5)],
  ]

  for (const [name, group] of planarGroups) {
    it(`${name} 凯莱图平面，组合嵌入有效`, () => {
      const edges = cayleyEdges(group)
      expect(edges.length).toBeGreaterThan(0)
      const r = testGraphPlanarity(group.order, edges)
      expect(r.planar, `${name} n=${group.order} m=${edges.length}`).toBe(true)
      expect(r.embedding).not.toBeNull()
      expectValidEmbedding(group.order, edges, r.embedding!)
    })
  }

  const nonPlanarGroups: Array<[string, Group]> = [
    ['Q8', createQuaternion()],
    ['Q16', getSmallGroup(16, 7)!.group],
    ['GL(2,3)', createGL2(3)],
  ]

  for (const [name, group] of nonPlanarGroups) {
    it(`${name} 凯莱图非平面`, () => {
      const edges = cayleyEdges(group)
      const r = testGraphPlanarity(group.order, edges)
      expect(r.planar, `${name} n=${group.order} m=${edges.length}`).toBe(false)
      expect(r.embedding).toBeNull()
    })
  }
})

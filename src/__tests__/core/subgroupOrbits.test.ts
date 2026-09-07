import { describe, it, expect } from 'vitest'
import {
  computeSubgroupLattice,
  subgroupConjugacyOrbits,
  mergeLatticeByConjugacy,
  subgroupSetKey,
  transitiveReduce,
  MERGE_MAX_NODES,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from '../../core/algebra/subgroups'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createKleinFour } from '../../core/groups/SpecialGroup'
import type { Group } from '../../core/types'

/** 教科书式暴力轨道：对每个未访问节点，用全部元素共轭做 BFS（不走生成元 shortcut） */
function bruteForceOrbits(group: Group, nodes: SubgroupLatticeNode[]): Set<number>[] {
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const keyToIdx = new Map<string, number>()
  nodes.forEach((nd, i) => {
    const k = subgroupSetKey(nd.elementIds)
    if (!keyToIdx.has(k)) keyToIdx.set(k, i)
  })
  const conjKey = (idx: number, g: Group['identity']): string | null => {
    const gInv = group.inverse(g)
    const out: string[] = []
    for (const id of nodes[idx].elementIds) {
      const x = byId.get(id)
      if (!x) return null
      out.push(group.multiply(group.multiply(g, x), gInv).id)
    }
    return subgroupSetKey(out)
  }
  const visited = new Set<number>()
  const orbits: Set<number>[] = []
  nodes.forEach((_, start) => {
    if (visited.has(start)) return
    const orbit = new Set<number>([start])
    visited.add(start)
    const queue = [start]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const g of group.elements) {
        const nk = conjKey(cur, g)
        if (nk === null) continue
        const ni = keyToIdx.get(nk)
        if (ni !== undefined && !orbit.has(ni)) {
          orbit.add(ni)
          visited.add(ni)
          queue.push(ni)
        }
      }
    }
    orbits.push(orbit)
  })
  return orbits
}

describe('subgroupConjugacyOrbits', () => {
  it('groups S₃’s three order-2 subgroups into one orbit of size 3', () => {
    const group = createSymmetricGroup(3)!
    const { nodes } = computeSubgroupLattice(group)
    const orbits = subgroupConjugacyOrbits(group, nodes)
    expect(orbits.map(o => o.size).sort((a, b) => a - b)).toEqual([1, 1, 1, 3])
    const big = orbits.find(o => o.size === 3)!
    expect(big.memberIndices.every(i => nodes[i].order === 2)).toBe(true)
  })

  it('partitions the node set exactly once', () => {
    const group = createSymmetricGroup(4)!
    const { nodes } = computeSubgroupLattice(group)
    const orbits = subgroupConjugacyOrbits(group, nodes)
    const all = orbits.flatMap(o => o.memberIndices)
    expect(all).toHaveLength(nodes.length)
    expect(new Set(all).size).toBe(nodes.length)
  })

  it('satisfies orbit-stabilizer: |orbit| · |N_G(H)| = |G|', () => {
    for (const group of [createSymmetricGroup(3)!, createAlternatingGroup(4)!, createSymmetricGroup(4)!]) {
      const { nodes } = computeSubgroupLattice(group)
      for (const o of subgroupConjugacyOrbits(group, nodes)) {
        expect(o.size * o.normalizerOrder).toBe(group.order)
      }
    }
  })

  it('agrees with conjugating by every element (generator closure is enough)', () => {
    for (const group of [createSymmetricGroup(3)!, createAlternatingGroup(4)!]) {
      const { nodes } = computeSubgroupLattice(group)
      const fast = subgroupConjugacyOrbits(group, nodes)
        .map(o => new Set(o.memberIndices))
        .sort((a, b) => a.size - b.size || Math.min(...a) - Math.min(...b))
      const slow = bruteForceOrbits(group, nodes)
        .sort((a, b) => a.size - b.size || Math.min(...a) - Math.min(...b))
      expect(fast.map(s => [...s].sort((x, y) => x - y))).toEqual(
        slow.map(s => [...s].sort((x, y) => x - y))
      )
    }
  })

  it('normal subgroups are exactly the singleton orbits', () => {
    const group = createSymmetricGroup(3)!
    const { nodes } = computeSubgroupLattice(group)
    const orbits = subgroupConjugacyOrbits(group, nodes)
    const singletonNodes = new Set(
      orbits.filter(o => o.size === 1).flatMap(o => o.memberIndices)
    )
    nodes.forEach((nd, i) => {
      expect(nd.isNormal).toBe(singletonNodes.has(i))
    })
  })

  it('A₄ has four conjugate order-3 subgroups with normalizer order 3', () => {
    const group = createAlternatingGroup(4)!
    const { nodes } = computeSubgroupLattice(group)
    const orbits = subgroupConjugacyOrbits(group, nodes)
    const sylow3 = orbits.find(o => nodes[o.repIndex].order === 3 && o.size > 1)
    expect(sylow3?.size).toBe(4)
    expect(sylow3?.normalizerOrder).toBe(3)
  })

  it('every subgroup of an abelian group forms its own orbit', () => {
    const group = createKleinFour()
    const { nodes } = computeSubgroupLattice(group)
    const orbits = subgroupConjugacyOrbits(group, nodes)
    expect(orbits).toHaveLength(nodes.length)
    expect(orbits.every(o => o.size === 1 && o.normalizerOrder === group.order)).toBe(true)
  })
})

describe('mergeLatticeByConjugacy', () => {
  it('collapses S₃ from 6 nodes to 4 and keeps a well-formed Hasse graph', () => {
    const group = createSymmetricGroup(3)!
    const { nodes, edges } = computeSubgroupLattice(group)
    const merged = mergeLatticeByConjugacy(group, nodes, edges)!
    expect(merged.nodes).toHaveLength(4)
    expect(merged.nodes.map(n => n.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 6])
    const mergedOrbitSizes = merged.nodes.map(n => (n as { orbitSize?: number }).orbitSize)
    expect(mergedOrbitSizes.sort((a, b) => a! - b!)).toEqual([1, 1, 1, 3])
    // 无自环 + 无重复边 + 已传递归约
    expect(merged.edges.every(e => e.from !== e.to)).toBe(true)
    const keys = merged.edges.map(e => `${e.from}>${e.to}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(transitiveReduce(merged.nodes.length, merged.edges)).toEqual(merged.edges)
  })

  it('leaves an abelian lattice untouched (orbit lattice == subgroup lattice)', () => {
    const group = createKleinFour()
    const { nodes, edges } = computeSubgroupLattice(group)
    const merged = mergeLatticeByConjugacy(group, nodes, edges)!
    expect(merged.nodes).toHaveLength(nodes.length)
    expect(merged.edges).toEqual(edges)
    expect(merged.orbitOf).toEqual(nodes.map((_, i) => i))
  })

  it('reduces S₄ and keeps a unique top and bottom with consistent levels', () => {
    const group = createSymmetricGroup(4)!
    const { nodes, edges } = computeSubgroupLattice(group)
    const merged = mergeLatticeByConjugacy(group, nodes, edges)!
    expect(merged.nodes.length).toBeLessThan(nodes.length)
    expect(merged.nodes.filter(n => n.order === group.order)).toHaveLength(1)
    expect(merged.nodes.filter(n => n.order === 1)).toHaveLength(1)
    // 层级仍按阶分档：阶越大 level 越小
    for (const e of merged.edges) {
      expect(merged.nodes[e.from].order).toBeLessThan(merged.nodes[e.to].order)
      expect(merged.nodes[e.from].level).toBeGreaterThan(merged.nodes[e.to].level)
    }
    // 轨道长整除群阶，且合并后每个轨道代表都仍是子群
    expect(merged.nodes.every(n => n.order > 0 && n.elementIds.length === n.order)).toBe(true)
  })

  it('returns null instead of merging past the guard', () => {
    const group = createSymmetricGroup(3)!
    const tooMany: SubgroupLatticeNode[] = Array.from({ length: MERGE_MAX_NODES + 1 }, (_, i) => ({
      id: `x${i}`, label: '1', elementIds: [group.identity.id], order: 1, index: 0,
      isNormal: true, level: 0,
    }))
    const edges: SubgroupLatticeEdge[] = [{ from: 0, to: 1 }]
    expect(mergeLatticeByConjugacy(group, tooMany, edges)).toBeNull()
  })
})

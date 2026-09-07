import type { Group, GroupElement } from '../../types'
import {
  transitiveReduce,
  levelsByOrderRank,
  type SubgroupLatticeNode,
  type SubgroupLatticeEdge,
} from './lattice'

export function getGroupCenter(group: Group, allowLarge = false): GroupElement[] {
  if (group.order > 60 && !allowLarge) return group.isAbelian ? [...group.elements] : [group.identity]
  const center: GroupElement[] = []

  for (const a of group.elements) {
    let commutes = true
    for (const g of group.elements) {
      if (group.multiply(g, a).id !== group.multiply(a, g).id) {
        commutes = false
        break
      }
    }
    if (commutes) center.push(a)
  }

  return center
}

export function getCentralizer(group: Group, elements: GroupElement[]): GroupElement[] {
  if (elements.length === 0) return [...group.elements]
  const result: GroupElement[] = []

  for (const g of group.elements) {
    let centralizes = true
    for (const x of elements) {
      if (group.multiply(g, x).id !== group.multiply(x, g).id) {
        centralizes = false
        break
      }
    }
    if (centralizes) result.push(g)
  }

  return result
}

export function getNormalizer(group: Group, elements: GroupElement[]): GroupElement[] {
  if (elements.length === 0) return [...group.elements]
  const eSet = new Set(elements.map(e => e.id))
  const result: GroupElement[] = []

  for (const g of group.elements) {
    const conjSet = new Set<string>()
    for (const x of elements) {
      conjSet.add(group.multiply(group.multiply(g, x), group.inverse(g)).id)
    }
    if (conjSet.size === eSet.size && [...conjSet].every(id => eSet.has(id))) {
      result.push(g)
    }
  }

  return result
}

export function getConjugacyClasses(group: Group, allowLarge = false): GroupElement[][] {
  if (group.order > 60 && !allowLarge) {
    return group.elements.map(e => [e])
  }
  const classes: GroupElement[][] = []
  const used = new Set<string>()

  for (const a of group.elements) {
    if (used.has(a.id)) continue

    const seen = new Set<string>()
    const conjugates: GroupElement[] = []
    for (const g of group.elements) {
      const conj = group.multiply(group.multiply(g, a), group.inverse(g))
      if (!seen.has(conj.id)) {
        seen.add(conj.id)
        conjugates.push(conj)
        used.add(conj.id)
      }
    }
    classes.push(conjugates)
  }

  return classes
}

/** 共轭合并的节点数上限（超过则放弃合并，视图给出提示）。 */
export const MERGE_MAX_NODES = 2000

/** 子群共轭轨道（G 以内自同构 g·H·g⁻¹ 作用在子群集合上的轨道）。 */
export interface SubgroupConjugacyOrbit {
  /** 代表子群的规范键（元素 id 升序 join），可与 series/子集键直接比对 */
  key: string
  /** 代表在输入 nodes 数组中的下标 */
  repIndex: number
  memberIndices: number[]
  /** 轨道长 n = |G : N_G(H)| */
  size: number
  /** |N_G(H)| = |G| / n（轨道-稳定子定理） */
  normalizerOrder: number
}

/** 共轭合并后的格节点：代表子群 + 轨道信息 */
export interface MergedLatticeNode extends SubgroupLatticeNode {
  orbitSize: number
  orbitIndices: number[]
  normalizerOrder: number
}

/** 子群元素集合的规范键（与 seriesNodeMap / sylowConjugationPerms 同约定） */
export function subgroupSetKey(elementIds: string[]): string {
  return [...elementIds].sort().join(',')
}

/**
 * 求 G 在其全部子群（以元素 id 集合表示）上的共轭轨道。
 *
 * 闭包只用生成元：⟨S⟩ = G ⇒ 生成元共轭的闭包 = 全元素共轭的轨道，
 * 代价 O(Σ|orbit| · |S| · |H|) 而非 O(|G| · |H| · n)——S₆（1455 子群）也可用。
 */
export function subgroupConjugacyOrbits(
  group: Group,
  nodes: Array<Pick<SubgroupLatticeNode, 'elementIds'>>
): SubgroupConjugacyOrbit[] {
  const byId = new Map<string, GroupElement>()
  for (const el of group.elements) byId.set(el.id, el)

  // 共轭元集合：优先用生成元（含其逆），退化情形（无生成元/解析失败）用全部元素
  const conjugators: GroupElement[] = []
  for (const gen of group.generators ?? []) {
    const s = gen.apply(group.identity)
    const sInv = gen.inverse.apply(group.identity)
    if (s && byId.has(s.id)) conjugators.push(byId.get(s.id)!)
    if (sInv && byId.has(sInv.id) && sInv.id !== s.id) conjugators.push(byId.get(sInv.id)!)
  }
  if (conjugators.length === 0) conjugators.push(...group.elements)

  const pairs = conjugators.map(g => ({ g, gInv: group.inverse(g) }))
  const conjugateKey = (ids: string[], g: GroupElement, gInv: GroupElement): string | null => {
    const out: string[] = []
    for (const id of ids) {
      const x = byId.get(id)
      if (!x) return null
      out.push(group.multiply(group.multiply(g, x), gInv).id)
    }
    return subgroupSetKey(out)
  }

  const keyToIdx = new Map<string, number>()
  nodes.forEach((nd, i) => {
    const k = subgroupSetKey(nd.elementIds)
    if (!keyToIdx.has(k)) keyToIdx.set(k, i)
  })

  const orbits: SubgroupConjugacyOrbit[] = []
  const assigned = new Array<boolean>(nodes.length).fill(false)

  for (let i = 0; i < nodes.length; i++) {
    if (assigned[i]) continue
    const repKey = subgroupSetKey(nodes[i].elementIds)
    const memberIndices = [i]
    assigned[i] = true
    const queue = [i]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const { g, gInv } of pairs) {
        const next = conjugateKey(nodes[cur].elementIds, g, gInv)
        if (next === null) continue // 元素 id 无法解析：保守地留在当前轨道
        const ni = keyToIdx.get(next)
        if (ni !== undefined && !assigned[ni]) {
          assigned[ni] = true
          memberIndices.push(ni)
          queue.push(ni)
        }
      }
    }
    const size = memberIndices.length
    orbits.push({
      key: repKey,
      repIndex: i,
      memberIndices,
      size,
      normalizerOrder: size > 0 ? Math.round(group.order / size) : group.order,
    })
  }

  return orbits
}

/**
 * 把子群格按共轭轨道压缩为"轨道格"：一个轨道 = 一个节点（×n 角标）。
 *
 * 数学依据：共轭是格的自同构，故 Hasse 边的像仍是格序关系；轨道上的偏序
 * A ≤ B ⟺ ∃a∈A, b∈B, a ⊆ b 是偏序（反对称：|a| ≤ |b| ≤ |a'| 且 a,a' 同阶 ⇒ a = b），
 * 其覆盖关系 = 候选边（原 Hasse 边的像）的传递归约。
 *
 * 返回 null 表示节点数超过 MERGE_MAX_NODES，调用方应保持原格。
 */
export function mergeLatticeByConjugacy(
  group: Group,
  nodes: SubgroupLatticeNode[],
  edges: SubgroupLatticeEdge[]
): { nodes: MergedLatticeNode[]; edges: SubgroupLatticeEdge[]; orbitOf: number[] } | null {
  if (nodes.length > MERGE_MAX_NODES) return null
  const orbits = subgroupConjugacyOrbits(group, nodes)
  if (orbits.length === nodes.length) {
    // 全单点轨道（如阿贝尔群）：轨道格 = 原子群格，直接沿用原边集避免无谓重算
    return {
      nodes: nodes.map((nd, i) => ({
        ...nd,
        orbitSize: 1,
        orbitIndices: [i],
        normalizerOrder: group.order,
      })),
      edges,
      orbitOf: nodes.map((_, i) => i),
    }
  }

  const orbitOf = new Array<number>(nodes.length).fill(-1)
  orbits.forEach((ob, oi) => {
    for (const m of ob.memberIndices) orbitOf[m] = oi
  })

  const seen = new Set<string>()
  const candidate: SubgroupLatticeEdge[] = []
  for (const e of edges) {
    const from = orbitOf[e.from]
    const to = orbitOf[e.to]
    if (from < 0 || to < 0 || from === to) continue
    const k = `${from}>${to}`
    if (seen.has(k)) continue
    seen.add(k)
    candidate.push({ from, to })
  }

  const mergedNodes: MergedLatticeNode[] = orbits.map((ob, oi) => {
    const rep = nodes[ob.repIndex]
    return {
      ...rep,
      id: `orb-${oi}`,
      // 轨道内子群同阶同正规性（正规 ⇔ 单点轨道），按代表呈现
      isNormal: ob.size === 1,
      orbitSize: ob.size,
      orbitIndices: ob.memberIndices,
      normalizerOrder: ob.normalizerOrder,
      level: 0,
    }
  })

  const reduced = transitiveReduce(mergedNodes.length, candidate)
  const levels = levelsByOrderRank(mergedNodes.map(nd => nd.order))
  mergedNodes.forEach((nd, i) => { nd.level = levels[i] })

  return { nodes: mergedNodes, edges: reduced, orbitOf }
}

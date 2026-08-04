import type { Group, GroupElement } from '../types'
import { COLOR_PALETTE } from '../types'
import { createCyclicGroup } from '../groups/CyclicGroup'
import { createDihedralGroup } from '../groups/DihedralGroup'
import { createSymmetricGroup } from '../groups/SymmetricGroup'
import { createAlternatingGroup } from '../groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../groups/SpecialGroup'
import { createDirectProduct } from '../groups/DirectProduct'
import { computeCayleyActionEdges, type ForceLayoutEdge } from './cayleyEdges'
import { forceLayout } from './cycleLayouts'

export interface Subgroup {
  elements: GroupElement[]
  order: number
  index: number
  generators: GroupElement[]
  isNormal: boolean
}

export interface SubgroupLatticeNode {
  id: string
  label: string
  elementIds: string[]
  order: number
  index: number
  isNormal: boolean
  level: number
}

export interface SubgroupLatticeEdge {
  from: number
  to: number
}

export function computeSubgroupLattice(group: Group): {
  nodes: SubgroupLatticeNode[]
  edges: SubgroupLatticeEdge[]
} {
  const cyclicSubgroups = findAllSubgroups(group)
  const identityEl = group.identity

  const nodes: SubgroupLatticeNode[] = []

  const identityElementIds = [identityEl.id]
  const identityKey = identityEl.id

  const seenKeys = new Set<string>()

  nodes.push({
    id: 'sg-trivial',
    label: '{e}',
    elementIds: identityElementIds,
    order: 1,
    index: group.order,
    isNormal: true,
    level: 0
  })
  seenKeys.add(identityKey)

  cyclicSubgroups.forEach((sg, i) => {
    const elementIds = sg.elements.map(e => e.id)
    const key = elementIds.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(',')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    nodes.push({
      id: `sg-${i}`,
      label: formatSubgroupLabel(sg),
      elementIds,
      order: sg.order,
      index: sg.index,
      isNormal: sg.isNormal,
      level: 0
    })
  })

  const fullKey = group.elements.map(e => e.id).sort().join(',')
  if (!seenKeys.has(fullKey)) {
    nodes.push({
      id: 'sg-full',
      label: group.symbol,
      elementIds: group.elements.map(e => e.id),
      order: group.order,
      index: 1,
      isNormal: true,
      level: 0
    })
  }

  const byOrder = new Map<number, number[]>()
  nodes.forEach((node, i) => {
    const arr = byOrder.get(node.order) || []
    arr.push(i)
    byOrder.set(node.order, arr)
  })

  const sortedOrders = Array.from(byOrder.keys()).sort((a, b) => a - b)

  const n = nodes.length
  const contains: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))
  const elementSet = nodes.map(node => new Set(node.elementIds))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      let isSub = true
      for (const eid of nodes[i].elementIds) {
        if (!elementSet[j].has(eid)) {
          isSub = false
          break
        }
      }
      contains[i][j] = isSub
    }
  }

  const hasseEdges: SubgroupLatticeEdge[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!contains[i][j] || nodes[i].order >= nodes[j].order) continue

      let isDirect = true
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue
        if (contains[i][k] && contains[k][j]) {
          isDirect = false
          break
        }
      }
      if (isDirect) {
        hasseEdges.push({ from: i, to: j })
      }
    }
  }

  const levelMap = new Map<number, number>()
  sortedOrders.forEach((order, idx) => {
    levelMap.set(order, idx)
  })
  const maxLevel = sortedOrders.length - 1

  nodes.forEach(node => {
    node.level = maxLevel - (levelMap.get(node.order) ?? 0)
  })

  return { nodes, edges: hasseEdges }
}

function formatSubgroupLabel(sg: Subgroup): string {
  if (sg.order === 1) return '{e}'
  const genLabels = sg.generators.map(g => g.label).join(', ')
  return `⟨${genLabels}⟩`
}

export const SUBLATTICE_COLORS = [
  '#a78bfa', '#4ecdc4', '#ffd93d', '#f97316',
  '#38bdf8', '#84cc16', '#f43f5e', '#eab308',
  '#6366f1', '#14b8a6', '#ec4899', '#0ea5e9',
  '#ff6b6b', '#a855f7', '#22c55e', '#06b6d4',
]

export function isSimpleGroup(group: Group): boolean {
  if (group.order <= 1) return false

  if (group.isAbelian) {
    return isPrime(group.order)
  }

  // Short-circuit for large groups to avoid main thread freeze
  if (group.order > 60) return false

  const normalSubgroups = findAllNormalSubgroups(group)
  return normalSubgroups.length <= 2
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n === 2) return true
  if (n % 2 === 0) return false
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false
  }
  return true
}

export function findAllNormalSubgroups(group: Group): Subgroup[] {
  // Short-circuit for large groups to avoid 2^N conjugacy class combinations freeze
  if (group.order > 60) return []

  const classes = getConjugacyClasses(group)
  const identityClass = classes.find(c =>
    c.some(e => e.id === group.identity.id)
  )
  if (!identityClass) return []

  const otherClasses = classes.filter(c => c !== identityClass)

  // JS bitwise shifts operate on 32-bit ints; >=31 classes causes 1<<31 overflow.
  // 2^k subset enumeration freezes the main thread for k >= 20 (e.g. S3 x C10 has
  // 3x10 = 30 conjugacy classes -> 2^29 iterations), so fall back below that.
  if (otherClasses.length >= 20 || group.isAbelian) {
    const all = findAllSubgroups(group)
    const subgs: Subgroup[] = []
    const seen = new Set<string>()
    for (const sg of all) {
      const key = sg.elements.map(e => e.id).sort().join(',')
      if (seen.has(key)) continue
      seen.add(key)
      let isNormal = true
      for (const h of sg.elements) {
        for (const g of group.elements) {
          const conj = group.multiply(group.multiply(g, h), group.inverse(g))
          if (!sg.elements.some(e => e.id === conj.id)) { isNormal = false; break }
        }
        if (!isNormal) break
      }
      // fallback reuses findAllSubgroups which lists ALL subgroups; only normal
      // ones may be returned (mask path only yields normal candidates).
      if (!isNormal) continue
      subgs.push({ ...sg, isNormal })
    }
    // findAllSubgroups excludes the full group; the mask path includes it, so
    // keep both paths consistent (G is always a normal subgroup).
    subgs.push({
      elements: group.elements,
      order: group.order,
      index: 1,
      generators: [],
      isNormal: true,
    })
    return subgs.sort((a, b) => a.order - b.order)
  }

  const normalSubgroups: Subgroup[] = []
  const seen = new Set<string>()

  for (let mask = 0; mask < (1 << otherClasses.length); mask++) {
    const candidate: GroupElement[] = [...identityClass]

    for (let j = 0; j < otherClasses.length; j++) {
      if (mask & (1 << j)) {
        candidate.push(...otherClasses[j])
      }
    }

    if (!isSubgroupClosed(group, candidate)) continue

    const key = candidate.map(e => e.id).sort().join(',')
    if (seen.has(key)) continue
    seen.add(key)

    let isNormal = true
    for (const h of candidate) {
      for (const g of group.elements) {
        const conj = group.multiply(group.multiply(g, h), group.inverse(g))
        if (!candidate.some(e => e.id === conj.id)) {
          isNormal = false
          break
        }
      }
      if (!isNormal) break
    }

    normalSubgroups.push({
      elements: candidate,
      order: candidate.length,
      index: group.order / candidate.length,
      generators: [],
      isNormal
    })
  }

  return normalSubgroups.sort((a, b) => a.order - b.order)
}

function isSubgroupClosed(group: Group, elements: GroupElement[]): boolean {
  if (elements.length === 0) return false
  const set = new Set(elements.map(e => e.id))
  for (const a of elements) {
    for (const b of elements) {
      if (!set.has(group.multiply(a, b).id)) return false
    }
  }
  return true
}

function closeUnderMultiply(group: Group, seed: GroupElement[]): GroupElement[] {
  const result: GroupElement[] = []
  const resultSet = new Set<string>()
  for (const el of seed) {
    if (!resultSet.has(el.id)) {
      resultSet.add(el.id)
      result.push(el)
    }
  }
  let changed = true
  while (changed) {
    changed = false
    const cur = result.slice()
    for (let i = 0; i < cur.length; i++) {
      for (let j = i; j < cur.length; j++) {
        const prod = group.multiply(cur[i], cur[j])
        if (!resultSet.has(prod.id)) {
          resultSet.add(prod.id)
          result.push(prod)
          changed = true
        }
      }
    }
  }
  return result
}

function isNormalClosure(group: Group, elements: GroupElement[]): boolean {
  const elementSet = new Set(elements.map(e => e.id))
  for (const h of elements) {
    for (const g of group.elements) {
      const conj = group.multiply(group.multiply(g, h), group.inverse(g))
      if (!elementSet.has(conj.id)) return false
    }
  }
  return true
}

export function findAllSubgroups(group: Group): Subgroup[] {
  const subgroups: Subgroup[] = []
  const subgroupKeys = new Set<string>()

  // Short-circuit for large groups to avoid combinatorial explosion
  if (group.order > 60) return []

  function addSubgroup(elements: GroupElement[]): void {
    if (elements.length >= group.order) return
    const key = elements.map(e => e.id).sort().join(',')
    if (subgroupKeys.has(key)) return
    subgroupKeys.add(key)
    subgroups.push({
      elements,
      order: elements.length,
      index: group.order / elements.length,
      generators: [],
      isNormal: isNormalClosure(group, elements),
    })
  }

  // Phase 1: all cyclic subgroups
  for (const gen of group.elements) {
    const cyc: GroupElement[] = []
    const seen = new Set<string>()
    let cur = gen
    while (!seen.has(cur.id)) {
      seen.add(cur.id)
      cyc.push(cur)
      cur = group.multiply(cur, gen)
    }
    addSubgroup(cyc)
  }

  // Phase 2: pair-join closure — expand to non-cyclic subgroups
  for (let prevCount = -1; subgroups.length !== prevCount;) {
    prevCount = subgroups.length
    const all = subgroups.slice()
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const join = closeUnderMultiply(group, [...all[i].elements, ...all[j].elements])
        addSubgroup(join)
      }
    }
  }

  subgroups.sort((a, b) => a.order - b.order)
  return subgroups
}

export function getGroupCenter(group: Group): GroupElement[] {
  if (group.order > 60) return group.isAbelian ? [...group.elements] : [group.identity]
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

export function getConjugacyClasses(group: Group): GroupElement[][] {
  if (group.order > 60) {
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

export interface CosetInfo {
  subgroup: Subgroup
  leftCosets: GroupElement[][]
  rightCosets: GroupElement[][]
  isNormal: boolean
}

export function computeQuotientGroup(group: Group, normalSubgroup: Subgroup): Group | null {
  if (!normalSubgroup.isNormal) return null

  const cosets = computeCosets(group, normalSubgroup)
  let leftCosets = cosets.leftCosets

  // Sort cosets deterministically: identity coset first, then by smallest element ID.
  // This ensures qcoset-N IDs remain stable after page refresh / localStorage restore.
  const normalKey = normalSubgroup.elements.map(e => e.id).sort().join(',')
  leftCosets = [...leftCosets].sort((a, b) => {
    const aKey = a.map(e => e.id).sort().join(',')
    const bKey = b.map(e => e.id).sort().join(',')
    if (aKey === normalKey) return -1
    if (bKey === normalKey) return 1
    // Compare by smallest element ID for deterministic ordering
    const aMin = a.map(e => e.id).sort()[0]
    const bMin = b.map(e => e.id).sort()[0]
    return aMin < bMin ? -1 : aMin > bMin ? 1 : 0
  })

  const elements: GroupElement[] = leftCosets.map((coset, i) => {
    const rep = coset[0]
    const memberLabels = coset.map(e => e.label)
    const label = coset.length <= 4
      ? memberLabels.join(', ')
      : `${rep.label}, \\dots`
    return {
      id: `qcoset-${i}`,
      label,
      value: [i],
      cosetMemberLabels: memberLabels,
    }
  })

  const cosetMap = new Map<string, number>()
  leftCosets.forEach((coset, idx) => {
    const key = coset.map(e => e.id).sort().join(',')
    cosetMap.set(key, idx)
  })

  const identityIdx = cosetMap.get(normalSubgroup.elements.map(e => e.id).sort().join(',')) ?? 0

  const nSubgroup = leftCosets[identityIdx]
  const actionCandidates: GroupElement[] = []
  for (const nEl of nSubgroup) {
    if (nEl.id === group.identity.id) continue
    const ord = computeElementOrderInGroup(nEl, group)
    if (ord === 2 || ord === 3) actionCandidates.push(nEl)
    if (actionCandidates.length >= 3) break
  }
  if (actionCandidates.length === 0) {
    for (const nEl of nSubgroup) {
      if (nEl.id !== group.identity.id) {
        actionCandidates.push(nEl)
        break
      }
    }
  }

  if (actionCandidates.length > 0) {
    const palette = ['#ff6b6b','#4ecdc4','#ffd93d']
    const actions: import('../types').GroupAction[] = actionCandidates.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: palette[i % palette.length],
    }))
    const parentEdges = computeCayleyActionEdges(group, actions, 'right')

    const nIdSet = new Set(nSubgroup.map(e => e.id))
    const nIdToIdx = new Map<string, number>()
    nSubgroup.forEach((e, i) => nIdToIdx.set(e.id, i))

    const parentElMap = new Map<string, GroupElement>()
    for (const el of group.elements) parentElMap.set(el.id, el)

    const internalEdges: import('../types').InternalEdgeData[] = []
    for (const edge of parentEdges) {
      if (nIdSet.has(edge.fromId) && nIdSet.has(edge.toId)) {
        const actionEl = parentElMap.get(edge.actionElementId)
        internalEdges.push({
          fromInnerIdx: nIdToIdx.get(edge.fromId)!,
          toInnerIdx: nIdToIdx.get(edge.toId)!,
          color: edge.color,
          isBidirectional: edge.isBidirectional,
          actionElementId: edge.actionElementId,
          actionLabel: actionEl?.label || edge.actionElementId,
        })
      }
    }

    if (internalEdges.length > 0) {
      // Compute a normalized force-directed layout for the internal Cayley
      // graph of the normal subgroup. All cosets are isomorphic to N, so the
      // same layout is reused for every compound node and scaled at render time.
      const layoutEdges: ForceLayoutEdge[] = internalEdges.map(e => ({
        source: nSubgroup[e.fromInnerIdx].id,
        target: nSubgroup[e.toInnerIdx].id,
      }))
      const positions = forceLayout(nSubgroup, layoutEdges, 100, 100, { cycleSubgroups: [] })
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      positions.forEach(p => {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      })
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const range = Math.max(maxX - minX, maxY - minY, 1e-6)
      const internalLayout = nSubgroup.map(e => {
        const p = positions.get(e.id)
        if (!p) return { x: 0, y: 0 }
        return {
          x: (p.x - centerX) / range * 2,
          y: (p.y - centerY) / range * 2,
        }
      })

      for (const el of elements) {
        el.cosetInternalEdges = internalEdges
        el.cosetInternalLayout = internalLayout
      }
    }
  }

  const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
    const aIdx = parseInt(a.id.split('-')[1], 10)
    const bIdx = parseInt(b.id.split('-')[1], 10)
    if (!isFinite(aIdx) || aIdx < 0 || aIdx >= leftCosets.length) return elements[0]
    if (!isFinite(bIdx) || bIdx < 0 || bIdx >= leftCosets.length) return elements[0]
    const aRep = leftCosets[aIdx][0]
    const bRep = leftCosets[bIdx][0]
    const product = group.multiply(aRep, bRep)
    // Find which coset contains the product element
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === product.id)) return elements[i]
    }
    // Fallback: match by value
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e =>
        e.value.length === product.value.length && e.value.every((v, j) => v === product.value[j])
      )) return elements[i]
    }
    return elements[0]
  }

  const inverse = (el: GroupElement): GroupElement => {
    const idx = parseInt(el.id.split('-')[1], 10)
    if (!isFinite(idx) || idx < 0 || idx >= leftCosets.length) return elements[0]
    const rep = leftCosets[idx][0]
    const inv = group.inverse(rep)
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === inv.id)) return elements[i]
    }
    // Fallback: match by value
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e =>
        e.value.length === inv.value.length && e.value.every((v, j) => v === inv.value[j])
      )) return elements[i]
    }
    return elements[0]
  }

  const order = leftCosets.length
  // A quotient of an abelian group is abelian, but a NON-abelian group can also
  // have an abelian quotient (e.g. (S3 x C5) / (A3 x {e}) ~= C10), so verify
  // commutativity on the quotient elements directly (order <= 60 locally).
  let isAbelian = true
  outer: for (let i = 0; i < order; i++) {
    for (let j = i + 1; j < order; j++) {
      if (multiply(elements[i], elements[j]).id !== multiply(elements[j], elements[i]).id) {
        isAbelian = false
        break outer
      }
    }
  }

  const generators: import('../types').Generator[] = []
  const sourceGens = group.generators.length > 0
    ? group.generators.map(g => g.apply(group.identity))
    : []

  const seenGens = new Set<number>()
  for (let genIdx = 0; genIdx < sourceGens.length; genIdx++) {
    const genEl = sourceGens[genIdx]
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === genEl.id)) {
        if (i !== identityIdx && !seenGens.has(i)) {
          seenGens.add(i)
          const idx = i
          const parentColor = group.generators[genIdx]?.color ?? COLOR_PALETTE[generators.length % COLOR_PALETTE.length]
          const gen: import('../types').Generator = {
            name: `g${idx}`,
            symbol: `\\bar{g}_{${idx}}`,
            color: parentColor,
            apply: (el: GroupElement) => multiply(el, elements[idx]),
            inverse: {} as import('../types').Generator,
          }
          generators.push(gen)
        }
        break
      }
    }
  }

  if (generators.length === 0 && order > 1) {
    for (let i = 1; i < leftCosets.length && generators.length < 3; i++) {
      if (seenGens.has(i)) continue
      seenGens.add(i)
      const idx = i
      const gen: import('../types').Generator = {
        name: `g${idx}`,
        symbol: `\\bar{g}_{${idx}}`,
        color: COLOR_PALETTE[generators.length % COLOR_PALETTE.length],
        apply: (el: GroupElement) => multiply(el, elements[idx]),
        inverse: {} as import('../types').Generator,
      }
      generators.push(gen)
    }
  }

  const invIndex = new Map<number, number>()
  for (let i = 0; i < elements.length; i++) {
    const inv = inverse(elements[i])
    invIndex.set(i, parseInt(inv.id.split('-')[1], 10))
  }

  for (const gen of generators) {
    const genIdx = parseInt(gen.apply(elements[identityIdx]).id.split('-')[1], 10)
    const targetInvIdx = invIndex.get(genIdx) ?? genIdx
    const existingInv = generators.find(g => {
      const gIdx = parseInt(g.apply(elements[identityIdx]).id.split('-')[1], 10)
      return gIdx === targetInvIdx
    })
    if (existingInv) {
      gen.inverse = existingInv
      if (gen === existingInv) existingInv.inverse = existingInv
    } else {
      // Create an inverse generator reference but do not add it to the public
      // generator set so the quotient Cayley graph only shows the chosen
      // generating directions.
      gen.inverse = {
        name: `g${targetInvIdx}`,
        symbol: `\\bar{g}_{${targetInvIdx}}`,
        color: gen.color,
        apply: (el: GroupElement) => multiply(el, elements[targetInvIdx]),
        inverse: gen,
      }
    }
  }

  const quotientSymbol = `${group.symbol}/N`
  const quotientName = `Quotient Group ${group.symbol}/N`

  return {
    name: quotientName,
    symbol: quotientSymbol,
    order,
    elements,
    generators,
    multiply,
    inverse,
    identity: elements[identityIdx],
    isAbelian,
    normalSubgroupElementIds: normalSubgroup.elements.map(e => e.id),
  }
}

export function computeCosets(group: Group, subgroup: Subgroup): CosetInfo {
  const leftCosets: GroupElement[][] = []
  const rightCosets: GroupElement[][] = []
  const usedLeft = new Set<string>()
  const usedRight = new Set<string>()
  
  for (const g of group.elements) {
    const cosetLeft = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(g, sh).id === h.id
      })
      return exists
    })
    const key = cosetLeft.map(e => e.id).sort().join(',')
    if (!usedLeft.has(key)) {
      usedLeft.add(key)
      leftCosets.push(cosetLeft)
    }
  }
  
  for (const g of group.elements) {
    const cosetRight = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(sh, g).id === h.id
      })
      return exists
    })
    const key = cosetRight.map(e => e.id).sort().join(',')
    if (!usedRight.has(key)) {
      usedRight.add(key)
      rightCosets.push(cosetRight)
    }
  }
  
  const leftKeys = new Set(leftCosets.map(lc => lc.map(e => e.id).sort().join(',')))
  const rightKeys = new Set(rightCosets.map(rc => rc.map(e => e.id).sort().join(',')))
  const isNormal = leftKeys.size === rightKeys.size && [...leftKeys].every(k => rightKeys.has(k))
  
  return { subgroup, leftCosets, rightCosets, isNormal }
}

export function computeElementOrderInGroup(el: GroupElement, group: Group): number {
  let current = el
  let ord = 0
  do {
    current = group.multiply(current, el)
    ord++
    if (ord > group.order) return group.order
  } while (current.id !== el.id)
  return ord
}

function getOrderDistribution(group: Group): Map<number, number> {
  const dist = new Map<number, number>()
  for (const el of group.elements) {
    const ord = computeElementOrderInGroup(el, group)
    dist.set(ord, (dist.get(ord) ?? 0) + 1)
  }
  return dist
}

function distributionsEqual(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false
  }
  return true
}

export function detectIsomorphicGroup(quotientGroup: Group): string | null {
  const qOrder = quotientGroup.order
  const qAbelian = quotientGroup.isAbelian
  const qDist = getOrderDistribution(quotientGroup)

  const tests: Array<{ symbol: string; factory: () => Group | null }> = []

  tests.push({ symbol: `C_{${qOrder}}`, factory: () => createCyclicGroup(qOrder) })

  if (qOrder >= 6 && qOrder % 2 === 0) {
    const dN = qOrder / 2
    tests.push({ symbol: `D_{${dN}}`, factory: () => createDihedralGroup(dN) })
  }

  for (let a = 2; a * a <= qOrder; a++) {
    if (qOrder % a !== 0) continue
    const b = qOrder / a
    const fa = a
    const fb = b
    tests.push({
      symbol: `C_{${a}}\\times C_{${b}}`,
      factory: () => {
        const ga = createCyclicGroup(fa)
        const gb = createCyclicGroup(fb)
        if (!ga || !gb) return null
        try { return createDirectProduct(ga, gb) } catch { return null }
      },
    })
  }

  if (qOrder === 4) tests.push({ symbol: 'V_{4}', factory: createKleinFour })
  if (qOrder === 8) tests.push({ symbol: 'Q_{8}', factory: createQuaternion })
  if (qOrder === 12) tests.push({ symbol: 'A_{4}', factory: () => createAlternatingGroup(4) })
  if (qOrder === 60) tests.push({ symbol: 'A_{5}', factory: () => createAlternatingGroup(5) })
  if (qOrder === 6) tests.push({ symbol: 'S_{3}', factory: () => createSymmetricGroup(3) })
  if (qOrder === 24) tests.push({ symbol: 'S_{4}', factory: () => createSymmetricGroup(4) })
  if (qOrder === 120) tests.push({ symbol: 'S_{5}', factory: () => createSymmetricGroup(5) })

  const seen = new Set<string>()
  for (const { symbol, factory } of tests) {
    if (seen.has(symbol)) continue
    seen.add(symbol)
    try {
      const candidate = factory()
      if (!candidate || candidate.order !== qOrder) continue
      if (candidate.isAbelian !== qAbelian) continue
      const cDist = getOrderDistribution(candidate)
      if (distributionsEqual(qDist, cDist)) {
        return symbol
      }
    } catch {
      continue
    }
  }

  return null
}
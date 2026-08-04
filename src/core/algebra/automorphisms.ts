import type { Group, GroupElement, Generator, HomomorphismMap } from '../types'
import { COLOR_PALETTE, isGroupCyclic } from '../types'
import { verifyHomomorphism, getGeneratorElements } from './homomorphisms'
import { computeElementOrderInGroup, detectIsomorphicGroup } from './subgroups'

export interface Automorphism {
  id: string
  map: Map<string, string>
  label: string
  apply(element: GroupElement): GroupElement
}

function extendFromGeneratorMap(
  group: Group,
  genMap: Map<string, string>
): HomomorphismMap | null {
  const fullMap = new Map<string, string>()
  fullMap.set(group.identity.id, group.identity.id)

  const genPairs = getGeneratorElements(group)
  const elById = new Map(group.elements.map(e => [e.id, e]))

  // Validate all generator mappings exist
  for (const { el } of genPairs) {
    const tgtId = genMap.get(el.id)
    if (tgtId === undefined || !elById.has(tgtId)) return null
  }

  const queue: GroupElement[] = [group.identity]
  const visited = new Set<string>([group.identity.id])

  while (queue.length > 0) {
    const a = queue.shift()!
    const fa = elById.get(fullMap.get(a.id)!)
    if (!fa) return null

    for (const { el: genEl } of genPairs) {
      // b = a * gen (right multiply in source, consistent with Group.multiply)
      const aEl = elById.get(a.id)!
      const gEl = elById.get(genEl.id)!
      const b = group.multiply(aEl, gEl)
      if (visited.has(b.id)) continue

      const fgen = elById.get(genMap.get(genEl.id)!)
      if (!fgen) return null

      // f(b) = f(a) * f(gen) (right multiply in target)
      const fb = group.multiply(fa, fgen)
      fullMap.set(b.id, fb.id)
      visited.add(b.id)
      queue.push(b)
    }
  }

  if (visited.size < group.order) return null
  return fullMap
}

export function findAllAutomorphisms(group: Group): Automorphism[] {
  const genPairs = getGeneratorElements(group)

  if (genPairs.length === 0) {
    const idAuto: Automorphism = {
      id: 'auto-0',
      map: new Map(group.elements.map(e => [e.id, e.id])),
      label: '\\mathrm{id}',
      apply: (el) => el,
    }
    return [idAuto]
  }

  // Build candidates for each generator: elements with the same order
  const candidatesPerGen: GroupElement[][] = genPairs.map(({ el }) => {
    const genOrder = computeElementOrderInGroup(el, group)
    if (genOrder === 1) return [el] // identity generator → only identity candidate
    return group.elements.filter(e => computeElementOrderInGroup(e, group) === genOrder)
  })

  const totalCombinations = candidatesPerGen.reduce((acc, c) => acc * c.length, 1)
  const MAX_COMBINATIONS = 30000
  const MAX_RESULTS = 1000
  if (totalCombinations > MAX_COMBINATIONS) {
    // Too many generator mapping combinations (e.g. Z2^4: 15^4 = 50625, |Aut| = 20160)
    // Computing the full automorphism group would freeze the page — bail out.
    return []
  }

  const results: Automorphism[] = []
  const seenMaps = new Set<string>()

  // Create lookup table for GroupElement
  const elementById = new Map(group.elements.map(e => [e.id, e]))

  // Enumerate all generator mapping combinations
  function enumerate(idx: number, genMap: Map<string, string>) {
    if (idx >= genPairs.length) {
      // Try to extend this generator mapping
      const fullMap = extendFromGeneratorMap(group, genMap)
      if (!fullMap) return

      // Verify homomorphism
      const result = verifyHomomorphism(group, group, fullMap)
      if (!result.isHomomorphism) return

      // Check bijectivity (since source==target, kernel=1 is enough for injectivity,
      // and |image|=order is enough for surjectivity)
      if (result.kernel.length !== 1) return
      if (result.image.length !== group.order) return

      // Deduplicate by canonical string representation
      const key = [...fullMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('|')
      if (seenMaps.has(key)) return
      seenMaps.add(key)

      const autoId = `auto-${results.length}`
      const apply = (el: GroupElement): GroupElement => {
        const mappedId = fullMap.get(el.id)
        if (mappedId === undefined) return el
        return elementById.get(mappedId) || el
      }

      results.push({
        id: autoId,
        map: fullMap,
        label: '', // assigned later in createAutomorphismGroup
        apply,
      })
      return
    }

    const candidates = candidatesPerGen[idx]
    const genEl = genPairs[idx].el
    for (const candidate of candidates) {
      if (results.length >= MAX_RESULTS) return
      const newMap = new Map(genMap)
      newMap.set(genEl.id, candidate.id)
      enumerate(idx + 1, newMap)
    }
  }

  enumerate(0, new Map())

  return results
}

export function createAutomorphismGroup(group: Group, automorphisms?: Automorphism[]): Group | null {
  const autos = automorphisms ?? findAllAutomorphisms(group)
  if (autos.length === 0) return null

  const order = autos.length

  // Build GroupElements
  const autoById = new Map<string, Automorphism>()
  const elements: GroupElement[] = []
  let identityIdx = 0

  // Find identity automorphism (maps everything to itself)
  for (let i = 0; i < autos.length; i++) {
    const auto = autos[i]
    let isIdentity = true
    for (const [k, v] of auto.map) {
      if (k !== v) { isIdentity = false; break }
    }
    if (isIdentity) identityIdx = i

    const el: GroupElement = {
      id: auto.id,
      label: auto.label,
      value: [i],
    }
    elements.push(el)
    autoById.set(auto.id, auto)
  }

  // Sort elements: identity first, then by automorphism label
  const sorted: GroupElement[] = [elements[identityIdx]]
  for (let i = 0; i < elements.length; i++) {
    if (i === identityIdx) continue
    sorted.push(elements[i])
  }

  // For cyclic groups, label automorphisms by the image of the canonical generator
  // so that α_k corresponds to multiplication by k.
  const isCyclicParent = isGroupCyclic(group)
  const canonicalGenEl = isCyclicParent && group.generators.length > 0
    ? group.generators[0].apply(group.identity)
    : null
  const elById = new Map(group.elements.map(e => [e.id, e]))

  // Assign short labels based on sorted order, or by multiplier for cyclic parents
  sorted.forEach((el, i) => {
    if (i === 0) {
      el.label = '\\mathrm{id}'
      return
    }
    if (canonicalGenEl) {
      const auto = autoById.get(el.id)
      const imgId = auto?.map.get(canonicalGenEl.id)
      const imgEl = imgId ? elById.get(imgId) : undefined
      if (imgEl && imgEl.value.length > 0) {
        const k = imgEl.value[0]
        el.label = k >= 10 ? `\\alpha_{${k}}` : `\\alpha_${k}`
        return
      }
    }
    el.label = i >= 10 ? `\\alpha_{${i}}` : `\\alpha_${i}`
  })

  // Sync the Automorphism objects' labels so the popup title and other consumers see the same text.
  for (const auto of autoById.values()) {
    const el = sorted.find(e => e.id === auto.id)
    if (el) auto.label = el.label
  }

  // Re-index
  const elIdxMap = new Map<string, number>()
  sorted.forEach((el, i) => {
    el.value = [i]
    elIdxMap.set(el.id, i)
  })

  const identity = sorted[0]

  const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
    const autoA = autoById.get(a.id)
    const autoB = autoById.get(b.id)
    if (!autoA || !autoB) return identity

    // Compose: (a ∘ b)(x) = a(b(x)) — standard composition,
    // consistent with the semidirect product homomorphism condition φ(h1·h2) = φ(h1) ∘ φ(h2)
    const composed = new Map<string, string>()
    for (const [srcId] of autoB.map) {
      const intermediateId = autoB.map.get(srcId)!
      const finalId = autoA.map.get(intermediateId)!
      composed.set(srcId, finalId)
    }

    // Find which automorphism this composition matches
    for (const [autoId, auto] of autoById) {
      let match = true
      for (const [k, v] of composed) {
        if (auto.map.get(k) !== v) { match = false; break }
      }
      if (match) return sorted[elIdxMap.get(autoId)!]
    }

    return identity
  }

  const inverse = (el: GroupElement): GroupElement => {
    const auto = autoById.get(el.id)
    if (!auto) return identity

    // Inverse automorphism: find f' s.t. f'(f(x)) = x
    const invMap = new Map<string, string>()
    for (const [k, v] of auto.map) {
      invMap.set(v, k)
    }

    for (const [autoId, cand] of autoById) {
      let match = true
      for (const [k, v] of invMap) {
        if (cand.map.get(k) !== v) { match = false; break }
      }
      if (match) return sorted[elIdxMap.get(autoId)!]
    }

    return identity
  }

  const isAbelian = checkAutomorphismAbelian(sorted, multiply)

  // Build generators — greedy: find minimal set of automorphisms that generate the whole group
  const generators = buildAutomorphismGenerators(sorted, elIdxMap, identity, multiply, inverse, group)

  const autoGroup: Group = {
    name: `Automorphism Group Aut(${group.symbol})`,
    symbol: `\\operatorname{Aut}(${group.symbol})`,
    order,
    elements: sorted,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian,
    automorphismParentSymbol: group.symbol,
    _automorphismById: autoById,
  }

  // Detect isomorphic standard group
  try {
    const detected = detectIsomorphicGroup(autoGroup)
    if (detected) {
      autoGroup.isoSymbol = detected
    }
  } catch {
    // Ignore detection failures
  }

  return autoGroup
}

function checkAutomorphismAbelian(
  elements: GroupElement[],
  multiply: (a: GroupElement, b: GroupElement) => GroupElement,
): boolean {
  // |Aut(G)| can exceed 20 (e.g. 168 for GL(3,2), 96 for C4 x C4), so sampling
  // only the first 20 elements could certify a non-abelian automorphism group.
  // Full pairwise check: at most 168^2/2 ~ 14k multiplications, fine locally.
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const ab = multiply(elements[i], elements[j])
      const ba = multiply(elements[j], elements[i])
      if (ab.id !== ba.id) return false
    }
  }
  return true
}

function buildAutomorphismGenerators(
  elements: GroupElement[],
  elIdxMap: Map<string, number>,
  identity: GroupElement,
  multiply: (a: GroupElement, b: GroupElement) => GroupElement,
  inverse: (el: GroupElement) => GroupElement,
  _parentGroup: Group,
): Generator[] {
  if (elements.length <= 1) return []

  const generators: Generator[] = []

  // Greedily select elements that generate the group
  const generated = new Set<number>()
  generated.add(elIdxMap.get(identity.id)!)

  // Helper: compute the subgroup generated by current ∪ {elIdx}
  const expandWith = (elIdx: number, currentIndices: Set<number>): Set<number> => {
    const result = new Set(currentIndices)
    result.add(elIdx)
    
    let changed = true
    while (changed) {
      changed = false
      const currentArr = [...result]
      for (const i of currentArr) {
        for (const j of currentArr) {
          const prod = multiply(elements[i], elements[j])
          const prodIdx = elIdxMap.get(prod.id)
          if (prodIdx !== undefined && !result.has(prodIdx)) {
            result.add(prodIdx)
            changed = true
          }
        }
      }
    }
    return result
  }

  // Greedy: repeatedly pick the element that expands the generated set the most
  const remaining = new Set<number>()
  for (let i = 0; i < elements.length; i++) {
    if (i !== elIdxMap.get(identity.id)!) remaining.add(i)
  }

  while (generated.size < elements.length && remaining.size > 0) {
    let bestIdx = -1
    let bestSize = generated.size

    for (const idx of remaining) {
      const expanded = expandWith(idx, generated)
      if (expanded.size > bestSize) {
        bestSize = expanded.size
        bestIdx = idx
      }
    }

    if (bestIdx === -1) break

    const el = elements[bestIdx]
    const gen: Generator = {
      name: el.label,
      symbol: el.label,
      color: COLOR_PALETTE[generators.length % COLOR_PALETTE.length],
      apply: (e) => multiply(e, el),
      inverse: {} as Generator,
    }
    generators.push(gen)
    const expanded = expandWith(bestIdx, generated)
    generated.forEach(i => expanded.add(i))
    for (const i of expanded) {
      generated.add(i)
      remaining.delete(i)
    }
  }

  // Wire up inverses
  const invIndex = new Map<string, number>()
  for (const el of elements) {
    const invEl = inverse(el)
    invIndex.set(el.id, elIdxMap.get(invEl.id)!)
  }

  for (const gen of generators) {
    const genEl = gen.apply(identity)
    const invIdx = invIndex.get(genEl.id)
    const invEl = elements[invIdx!]
    // Find existing generator that matches
    const existingInv = generators.find(g => {
      const gEl = g.apply(identity)
      return elIdxMap.get(gEl.id) === invIdx
    })
    if (existingInv) {
      gen.inverse = existingInv
    } else {
      gen.inverse = {
        name: invEl.label,
        symbol: invEl.label,
        color: gen.color,
        apply: (e) => multiply(e, invEl),
        inverse: gen,
      }
    }
  }

  return generators
}

export function isAutomorphismGroup(group: Group): boolean {
  const g = group as Group & { automorphismParentSymbol?: string }
  return typeof g.automorphismParentSymbol === 'string' && g.automorphismParentSymbol !== ''
}

import type { Group, GroupElement } from '../../types'
import { COLOR_PALETTE } from '../../types'
import { computeElementOrderInGroup } from './detection'
import { type Subgroup } from './shared'
import { computeCayleyActionEdges, type ForceLayoutEdge } from '../cayleyEdges'
import { forceLayout } from '../cycleLayouts'

export interface CosetInfo {
  subgroup: Subgroup
  leftCosets: GroupElement[][]
  rightCosets: GroupElement[][]
  isNormal: boolean
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
    const actions: import('../../types').CayleyAction[] = actionCandidates.map((el, i) => ({
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

    const internalEdges: import('../../types').InternalEdgeData[] = []
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

  const generators: import('../../types').Generator[] = []
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
          const gen: import('../../types').Generator = {
            name: `g${idx}`,
            symbol: `\\bar{g}_{${idx}}`,
            color: parentColor,
            apply: (el: GroupElement) => multiply(el, elements[idx]),
            inverse: {} as import('../../types').Generator,
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
      const gen: import('../../types').Generator = {
        name: `g${idx}`,
        symbol: `\\bar{g}_{${idx}}`,
        color: COLOR_PALETTE[generators.length % COLOR_PALETTE.length],
        apply: (el: GroupElement) => multiply(el, elements[idx]),
        inverse: {} as import('../../types').Generator,
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

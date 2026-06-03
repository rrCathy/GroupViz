import type { Group, GroupElement, NodePosition, GroupAction, CayleyEdgeData, MultiplyType, Layout3D } from '../types'
import { getDefaultLayout3D, isGroupDirectProduct, isCyclicFactorKeys } from '../types'
import { compute3DPositions } from './layout3D'

export interface ForceLayoutEdge {
  source: string
  target: string
}

export function computeCayleyActionEdges(
  group: Group,
  actions: GroupAction[],
  multiplyType: MultiplyType
): CayleyEdgeData[] {
  const idToIdx = new Map<string, number>()
  const idToEl = new Map<string, GroupElement>()
  group.elements.forEach((el, i) => {
    idToIdx.set(el.id, i)
    idToEl.set(el.id, el)
  })

  const enabledActions = actions.filter(a => a.enabled)
  if (enabledActions.length === 0) return []

  const maxEdges = group.order > 60 ? Math.max(120, group.order * 3) : Number.POSITIVE_INFINITY

  const actionElementMap = new Map<string, GroupElement>()
  for (const action of enabledActions) {
    const el = idToEl.get(action.elementId)
    if (el) actionElementMap.set(action.elementId, el)
  }

  const allEdges: CayleyEdgeData[] = []

  for (let i = 0; i < group.elements.length; i++) {
    const fromEl = group.elements[i]
    for (const action of enabledActions) {
      const actionEl = actionElementMap.get(action.elementId)
      if (!actionEl) continue

      let toEl: GroupElement | undefined
      if (multiplyType === 'right') {
        toEl = group.multiply(fromEl, actionEl)
      } else {
        toEl = group.multiply(actionEl, fromEl)
      }

      if (!toEl) continue
      const toIdx = idToIdx.get(toEl.id)
      if (toIdx === undefined) continue

      const isSelfLoop = fromEl.id === toEl.id
      // Undirected edge rule: for right/left multiplication by element c,
      // the permutation cycles have length equal to the order of c. When c
      // is self-inverse (order 2), edges are reciprocal (a<->b). Mark those
      // edges as bidirectional for this action only.
      const isSelfInverse = group.inverse(actionEl).id === actionEl.id

      allEdges.push({
        fromIdx: i,
        toIdx,
        fromId: fromEl.id,
        toId: toEl.id,
        actionElementId: action.elementId,
        color: action.color,
        isBidirectional: isSelfInverse,
        isSelfLoop,
      })

      if (allEdges.length >= maxEdges) break
    }
    if (allEdges.length >= maxEdges) break
  }

  // Dedupe edges per action element, not across all actions. This ensures
  // multiple actions producing the same pair still render as distinct edges.
  const processedEdges = new Map<string, CayleyEdgeData>()
  allEdges.forEach(edge => {
    const key = `${Math.min(edge.fromIdx, edge.toIdx)}|${Math.max(edge.fromIdx, edge.toIdx)}|${edge.actionElementId}`
    if (!processedEdges.has(key)) {
      processedEdges.set(key, edge)
    }
  })

  return Array.from(processedEdges.values())
}

export interface PlanarCycleInput {
  elements: { id: string }[]
  order: number
}

export interface ForceLayoutOptions {
  initialPositions?: Map<string, NodePosition>
  cycleSubgroups?: number[][]
}

export function computeCycleSubgroups(group: Group): number[][] {
  const subgroups: number[][] = []
  const seenKeys = new Set<string>()
  const idToIdx = new Map<string, number>()
  group.elements.forEach((el, i) => idToIdx.set(el.id, i))

  for (const el of group.elements) {
    const cycle: string[] = []
    const visited = new Set<string>()
    let current = el
    while (!visited.has(current.id)) {
      visited.add(current.id)
      cycle.push(current.id)
      current = group.multiply(current, el)
    }
    if (cycle.length > 2) {
      const key = cycle.slice().sort().join(',')
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        subgroups.push(cycle.map(id => idToIdx.get(id)!).filter(i => i !== undefined))
      }
    }
  }
  return subgroups
}

interface ForceLayoutState {
  pos: { x: number; y: number }[]
  n: number
  elements: GroupElement[]
  edgePairs: [number, number][]
  width: number; height: number
  centerX: number; centerY: number
  repC: number; attC: number; restLen: number; gravity: number; cycleRep: number
  iterations: number
  padX: number; padY: number
  cycleSubgroups?: number[][]
}

function initForceLayoutState(
  elements: GroupElement[],
  edges: ForceLayoutEdge[],
  width: number,
  height: number,
  options: ForceLayoutOptions = {}
): ForceLayoutState {
  const n = elements.length
  const idToIdx = new Map<string, number>()
  elements.forEach((el, i) => idToIdx.set(el.id, i))

  const pos: { x: number; y: number }[] = new Array(n)
  const centerX = width / 2
  const centerY = height / 2
  const targetRadius = Math.min(width * 0.4, 250 + n * 15)

  for (let i = 0; i < n; i++) {
    const saved = options.initialPositions?.get(elements[i].id)
    if (saved) {
      pos[i] = { x: saved.x, y: saved.y }
    } else {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      pos[i] = {
        x: centerX + targetRadius * Math.cos(angle),
        y: centerY + targetRadius * Math.sin(angle)
      }
    }
  }

  const edgePairs: [number, number][] = edges
    .map(e => {
      const si = idToIdx.get(e.source)
      const ti = idToIdx.get(e.target)
      if (si === undefined || ti === undefined || si === ti) return null
      return [si, ti] as [number, number]
    })
    .filter((e): e is [number, number] => e !== null)

  const edgeCount = edgePairs.length
  const avgDegree = edgeCount > 0 ? (edgeCount * 2) / n : 1
  const baseDist = Math.sqrt((width * height) / n)
  const idealDist = baseDist * 1.8 / Math.sqrt(Math.max(1, avgDegree))

  return {
    pos,
    n,
    elements,
    edgePairs,
    width, height,
    centerX, centerY,
    repC: idealDist * idealDist * 0.8,
    attC: 0.08,
    restLen: idealDist * 0.9,
    gravity: 0.015,
    cycleRep: (idealDist * idealDist * 0.8) * 3,
    iterations: Math.max(150, Math.min(500, n * 5)),
    padX: width * 0.06,
    padY: height * 0.06,
    cycleSubgroups: options.cycleSubgroups,
  }
}

function runForceLayoutIteration(st: ForceLayoutState, iter: number): void {
  const { pos, n, edgePairs, centerX, centerY, repC, attC, restLen, gravity, cycleRep, padX, padY, cycleSubgroups, iterations, width, height } = st
  const t = iter / iterations
  const cool = Math.pow(1 - t, 1.8)
  const temp = 8 * cool

  const disp: { x: number; y: number }[] = new Array(n)
  for (let i = 0; i < n; i++) disp[i] = { x: 0, y: 0 }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pos[i].x - pos[j].x
      const dy = pos[i].y - pos[j].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = repC / (dist * dist)
      disp[i].x += (dx / dist) * f
      disp[i].y += (dy / dist) * f
      disp[j].x -= (dx / dist) * f
      disp[j].y -= (dy / dist) * f
    }
  }

  for (const [si, ti] of edgePairs) {
    const dx = pos[ti].x - pos[si].x
    const dy = pos[ti].y - pos[si].y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
    const f = (dist - restLen) * attC
    disp[si].x += (dx / dist) * f
    disp[si].y += (dy / dist) * f
    disp[ti].x -= (dx / dist) * f
    disp[ti].y -= (dy / dist) * f
  }

  if (cycleSubgroups) {
    for (const subgroup of cycleSubgroups) {
      const m = subgroup.length
      if (m < 3) continue
      for (let a = 0; a < m; a++) {
        for (let b = a + 1; b < m; b++) {
          const ia = subgroup[a]
          const ib = subgroup[b]
          const diff = Math.abs(a - b)
          const isNeighbor = diff === 1 || diff === m - 1
          if (isNeighbor) continue
          const dx = pos[ia].x - pos[ib].x
          const dy = pos[ia].y - pos[ib].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
          const f = cycleRep / (dist * dist)
          disp[ia].x += (dx / dist) * f
          disp[ia].y += (dy / dist) * f
          disp[ib].x -= (dx / dist) * f
          disp[ib].y -= (dy / dist) * f
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const dx = pos[i].x - centerX
    const dy = pos[i].y - centerY
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
    disp[i].x -= (dx / dist) * dist * gravity
    disp[i].y -= (dy / dist) * dist * gravity
  }

  for (let i = 0; i < n; i++) {
    const len = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) || 1
    const move = Math.min(len, temp)
    pos[i].x += (disp[i].x / len) * move
    pos[i].y += (disp[i].y / len) * move
    pos[i].x = Math.max(padX, Math.min(width - padX, pos[i].x))
    pos[i].y = Math.max(padY, Math.min(height - padY, pos[i].y))
  }
}

function finalizeForceLayout(st: ForceLayoutState): Map<string, NodePosition> {
  const { pos, n, elements, centerX, centerY, padX, padY, width, height } = st
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += pos[i].x; cy += pos[i].y }
  cx /= n; cy /= n
  const offX = centerX - cx
  const offY = centerY - cy

  let maxR = 0
  for (let i = 0; i < n; i++) {
    const dx = pos[i].x + offX - centerX
    const dy = pos[i].y + offY - centerY
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r > maxR) maxR = r
  }

  const scale = maxR > 0 ? Math.min((width / 2 - padX) / maxR, (height / 2 - padY) / maxR, 1) : 1

  const result = new Map<string, NodePosition>()
  for (let i = 0; i < n; i++) {
    const dx = pos[i].x + offX - centerX
    const dy = pos[i].y + offY - centerY
    result.set(elements[i].id, {
      x: centerX + dx * scale,
      y: centerY + dy * scale
    })
  }
  return result
}

export function forceLayout(
  elements: GroupElement[],
  edges: ForceLayoutEdge[],
  width: number,
  height: number,
  options: ForceLayoutOptions = {}
): Map<string, NodePosition> {
  const st = initForceLayoutState(elements, edges, width, height, options)
  if (st.n === 0) return new Map()
  for (let iter = 0; iter < st.iterations; iter++) {
    runForceLayoutIteration(st, iter)
  }
  return finalizeForceLayout(st)
}

const RAF_CHUNK = 15

export function forceLayoutAsync(
  elements: GroupElement[],
  edges: ForceLayoutEdge[],
  width: number,
  height: number,
  options: ForceLayoutOptions = {},
  onProgress?: (pct: number) => void
): Promise<Map<string, NodePosition>> {
  const st = initForceLayoutState(elements, edges, width, height, options)
  if (st.n === 0) return Promise.resolve(new Map())
  return new Promise(resolve => {
    let iter = 0
    function processChunk() {
      const end = Math.min(iter + RAF_CHUNK, st.iterations)
      for (; iter < end; iter++) {
        runForceLayoutIteration(st, iter)
      }
      onProgress?.(iter / st.iterations)
      if (iter < st.iterations) {
        requestAnimationFrame(processChunk)
      } else {
        resolve(finalizeForceLayout(st))
      }
    }
    requestAnimationFrame(processChunk)
  })
}

export function planarCycleLayout(
  elements: GroupElement[],
  cycles: PlanarCycleInput[],
  width: number,
  height: number,
  options: ForceLayoutOptions = {}
): Map<string, NodePosition> {
  const n = elements.length
  if (n === 0) return new Map()

  const idToIdx = new Map<string, number>()
  elements.forEach((el, i) => idToIdx.set(el.id, i))

  const pos = new Map<string, { x: number; y: number }>()
  const centerX = width / 2
  const centerY = height / 2

  const identityIdx = findIdentityIdx(elements)
  pos.set(elements[identityIdx].id, { x: centerX, y: centerY })

  const validCycles = cycles.filter(c => c.elements.length > 1)
  if (validCycles.length === 0) {
    const radius = Math.min(width * 0.35, 120 + n * 10)
    for (let i = 0; i < n; i++) {
      if (i === identityIdx) continue
      const angle = (i - 1) * 2 * Math.PI / (n - 1) - Math.PI / 2
      pos.set(elements[i].id, { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) })
    }
  } else {
    const cycleElements = new Map<string, number[]>()
    for (let ci = 0; ci < validCycles.length; ci++) {
      const cycle = validCycles[ci]
      for (const e of cycle.elements) {
        const existing = cycleElements.get(e.id) || []
        existing.push(ci)
        cycleElements.set(e.id, existing)
      }
    }

    const hasShared = [...cycleElements.values()].some(arr => arr.length > 1)
    const sharedElements = [...cycleElements.entries()].filter(([, cycles]) => cycles.length > 1).map(([id]) => id)
    const uniqueToCycle = new Map<string, number>()
    for (let ci = 0; ci < validCycles.length; ci++) {
      const cycle = validCycles[ci]
      const uniqueEls = cycle.elements.filter(e => !sharedElements.includes(e.id) || (cycleElements.get(e.id)?.length === 1))
      uniqueToCycle.set(cycle.elements[0]?.id || '', uniqueEls.length)
    }

    if (validCycles.every(c => c.elements.length <= 2) || (hasShared && sharedElements.length > 2)) {
      const radius = Math.min(width * 0.35, 120 + n * 10)
      const angleStep = (2 * Math.PI) / Math.max(validCycles.length, n - 1)
      for (let i = 0; i < n; i++) {
        if (i === identityIdx) continue
        const el = elements[i]
        const angle = (i - (i > identityIdx ? 1 : 0)) * angleStep - Math.PI / 2
        pos.set(el.id, { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) })
      }
    } else if (hasShared) {
      const sharedNonId = sharedElements.filter(id => id !== elements[identityIdx].id)
      const sharedCount = sharedNonId.length
      
      if (sharedCount >= 1) {
        const orderedShared: string[][] = []
        const usedShared = new Set<string>()
        
        for (const cycle of validCycles) {
          const cycleShared = cycle.elements
            .map(e => e.id)
            .filter(id => sharedElements.includes(id) && id !== elements[identityIdx].id)
          
          if (cycleShared.length > 0) {
            orderedShared.push(cycleShared)
            cycleShared.forEach(id => usedShared.add(id))
          }
        }
        
        const remainingShared = sharedNonId.filter(id => !usedShared.has(id))
        for (const id of remainingShared) {
          orderedShared.push([id])
        }

        if (orderedShared.length > 0) {
          const anglePerShared = (2 * Math.PI - Math.PI / 4) / orderedShared.length
          
          for (let si = 0; si < orderedShared.length; si++) {
            const sharedEl = orderedShared[si][0]
            const baseAngle = si * anglePerShared - Math.PI / 8
            const r = Math.min(width, height) * 0.42
            pos.set(sharedEl, { x: centerX + r * Math.cos(baseAngle), y: centerY + r * Math.sin(baseAngle) })
          }
        }
      }

      for (const cycle of validCycles) {
        const cycleEls = cycle.elements
          .map(e => e.id)
          .filter(id => id !== elements[identityIdx].id && !pos.has(id))
        
        if (cycleEls.length <= 1) continue
        
        const generatorId = cycle.elements[0]?.id
        
        let baseAngle = 0
        if (generatorId && pos.has(generatorId)) {
          const p = pos.get(generatorId)!
          baseAngle = Math.atan2(p.y - centerY, p.x - centerX)
        } else {
          const cycleIdx = validCycles.indexOf(cycle)
          baseAngle = cycleIdx * (2 * Math.PI / validCycles.length)
        }

        const fanAngle = Math.PI / 8
        const maxR = Math.min(width, height) * 0.28

        for (let j = 0; j < cycleEls.length; j++) {
          const elId = cycleEls[j]
          if (pos.has(elId)) continue
          
          const r = maxR * (0.5 + 0.5 * (j + 1) / cycleEls.length)
          const angleOffset = fanAngle * (1 - 2 * (j + 1) / (cycleEls.length + 1))
          const angle = baseAngle + angleOffset
          pos.set(elId, { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) })
        }
      }
    } else {
      const cycleCount = validCycles.length
      const baseAngleStep = (2 * Math.PI - Math.PI / 2) / cycleCount

      for (let ci = 0; ci < cycleCount; ci++) {
        const cycle = validCycles[ci]
        const baseAngle = (ci * baseAngleStep) - Math.PI / 4

        const nonIdElements = cycle.elements
          .map(e => e.id)
          .filter(id => id !== elements[identityIdx].id)

        if (nonIdElements.length === 0) continue

        if (nonIdElements.length === 1) {
          const elId = nonIdElements[0]
          const angle = baseAngle
          const r = Math.min(width, height) * 0.35
          pos.set(elId, { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) })
          continue
        }

        const fanAngle = Math.PI / 6
        const maxR = Math.min(width, height) * 0.38

        for (let j = 0; j < nonIdElements.length; j++) {
          const elId = nonIdElements[j]
          const r = maxR * (0.3 + 0.7 * (j + 1) / nonIdElements.length)
          const angleOffset = fanAngle * (1 - 2 * (j + 1) / (nonIdElements.length + 1))
          const angle = baseAngle + angleOffset
          pos.set(elId, { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) })
        }
      }
    }

    for (let i = 0; i < n; i++) {
      if (!pos.has(elements[i].id)) {
        const saved = options.initialPositions?.get(elements[i].id)
        if (saved) {
          pos.set(elements[i].id, { ...saved })
        } else {
          const angle = (i) * 2 * Math.PI / n
          const r = Math.min(width, height) * 0.2
          pos.set(elements[i].id, { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) })
        }
      }
    }
  }

  const result = new Map<string, NodePosition>()
  for (const el of elements) {
    const p = pos.get(el.id) || { x: centerX, y: centerY }
    result.set(el.id, { x: p.x, y: p.y })
  }
  return result
}

function findIdentityIdx(elements: GroupElement[]): number {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (el.label === 'e' || el.label === '0') return i
    if (el.value.length === 1 && el.value[0] === 0) return i
    if (el.value.length > 1 && el.value.every((v, j) => v === j + 1)) return i
  }
  return 0
}

export function computeMaximalCycles(cycles: PlanarCycleInput[]): PlanarCycleInput[] {
  const cycleIdSets = cycles.map(c => new Set(c.elements.map(e => e.id)))
  return cycles.filter((_, i) => {
    const cycleSet = cycleIdSets[i]
    return !cycles.some((_, j) => {
      if (i === j) return false
      const otherSet = cycleIdSets[j]
      const cycleArr = [...cycleSet]
      return cycleArr.every(id => otherSet.has(id)) && cycleSet.size < otherSet.size
    })
  })
}

const S3_PERM_IDS = ['1,2,3', '2,1,3', '2,3,1', '3,2,1', '3,1,2', '1,3,2']

function detectS3PermSet(keys: string[]): boolean {
  if (keys.length !== 6) return false
  const s = new Set(keys)
  return S3_PERM_IDS.every(k => s.has(k))
}

export function ringOrder(keys: string[]): string[] {
  // S3 → Hamiltonian cycle order
  if (detectS3PermSet(keys)) return S3_PERM_IDS

  // Check if these are bit vectors (Z2^k) — use Gray code
  const vecs = keys.map(k => k.split(',').map(Number))
  const allBits = vecs.every(v => v.every(x => x === 0 || x === 1))
  if (allBits && vecs.length === 4 && vecs[0].length === 2) {
    return ['0,0', '1,0', '1,1', '0,1']
  }
  if (allBits && vecs.length === 8 && vecs[0].length === 3) {
    return ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  }

  // Default: numeric sort for all-numeric keys, lexicographic otherwise
  const deduped = Array.from(new Set(keys))
  if (deduped.every(k => /^-?\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a) - Number(b))
  }
  // Cn cyclic group: "e0", "e1", ... — sort numerically by suffix
  if (deduped.every(k => /^e\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }
  return deduped.sort()
}

// ─── Direct Product Factor Classification ──────────────────────────────

interface ProductFactors {
  colSize: number
  rowSize: number
  getCol: (el: GroupElement) => number
  getRow: (el: GroupElement) => number
}

function parseProductFactors(group: Group): ProductFactors | null {
  const n = group.elements.length
  if (n === 0) return null

  const isPipeProduct = group.elements[0].id.includes('|')

  if (isPipeProduct) {
    const prefixSet = new Set<string>()
    const suffixSet = new Set<string>()
    for (const el of group.elements) {
      const pipeIdx = el.id.indexOf('|')
      if (pipeIdx === -1) continue
      prefixSet.add(el.id.substring(0, pipeIdx))
      suffixSet.add(el.id.substring(pipeIdx + 1))
    }
    const colKeys = ringOrder(Array.from(prefixSet))
    const rowKeys = ringOrder(Array.from(suffixSet))
    const colMap = new Map(colKeys.map((k, i) => [k, i]))
    const rowMap = new Map(rowKeys.map((k, i) => [k, i]))
    return {
      colSize: colKeys.length,
      rowSize: rowKeys.length,
      getCol: (el) => { const p = el.id.indexOf('|'); return colMap.get(el.id.substring(0, p)) ?? 0 },
      getRow: (el) => { const p = el.id.indexOf('|'); return rowMap.get(el.id.substring(p + 1)) ?? 0 }
    }
  }

  const vals = group.elements.map(el => el.value)
  const dim = vals[0]?.length || 0
  if (dim < 2) return null

  if (dim === 2) {
    const colSize = new Set(vals.map(v => v[0])).size
    const rowSize = new Set(vals.map(v => v[1])).size
    if (colSize * rowSize !== n) return null
    return { colSize, rowSize, getCol: (el) => el.value[0], getRow: (el) => el.value[1] }
  }

  // dim >= 3 — merge first (dim-1) dimensions as rows, last as columns (Z2^3 style)
  const rowKeys = Array.from(new Set(vals.map(v => v.slice(0, dim - 1).join(','))))
  const rowVecs = rowKeys.map(k => k.split(',').map(Number))
  const allBits = rowVecs.every(v => v.every(x => x === 0 || x === 1))
  let orderedRows: string[]
  if (allBits && rowVecs.length === 4 && rowVecs[0].length === 2) orderedRows = ['0,0', '1,0', '1,1', '0,1']
  else if (allBits && rowVecs.length === 8 && rowVecs[0].length === 3) orderedRows = ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  else {
    const allNumeric = rowKeys.every(k => /^-?\d+$/.test(k))
    orderedRows = rowKeys.slice().sort(allNumeric ? (a, b) => Number(a) - Number(b) : undefined)
  }
  const rowMap = new Map(orderedRows.map((k, i) => [k, i]))

  const colVals = Array.from(new Set(vals.map(v => v[dim - 1]))).sort((a, b) => a - b)
  const colMap = new Map(colVals.map((v, i) => [v, i]))

  return {
    colSize: colVals.length,
    rowSize: orderedRows.length,
    getCol: (el) => colMap.get(el.value[dim - 1]) ?? 0,
    getRow: (el) => rowMap.get(el.value.slice(0, dim - 1).join(',')) ?? 0
  }
}

function matrixGridLayout(
  colSize: number, rowSize: number,
  getCol: (el: GroupElement) => number, getRow: (el: GroupElement) => number,
  group: Group, width: number, height: number
): Map<string, NodePosition> {
  const margin = 60
  let [c, r] = [colSize, rowSize]
  let [fnC, fnR] = [getCol, getRow]
  let swapped = false
  if (r > c) { [c, r] = [r, c]; [fnC, fnR] = [fnR, fnC]; swapped = true }

  const usableW = width - 2 * margin
  const usableH = height - 2 * margin
  const cellSize = Math.max(80, Math.min(usableW / c, usableH / r, 160))
  const gridW = c * cellSize
  const gridH = r * cellSize
  const offX = (width - gridW) / 2 + cellSize / 2
  const offY = (height - gridH) / 2 + cellSize / 2

  const result = new Map<string, NodePosition>()
  for (const el of group.elements) {
    const ci = swapped ? fnR(el) : fnC(el)
    const ri = swapped ? fnC(el) : fnR(el)
    result.set(el.id, { x: offX + ci * cellSize, y: offY + ri * cellSize })
  }
  return result
}

// ─── Direct Product Nested Factor Layout ─────────────────────────────

function cayleyRingKeys(keys: string[]): string[] {
  // S3 permutations → Hamiltonian cycle for clean Cayley ring
  if (detectS3PermSet(keys)) return S3_PERM_IDS
  // Z2^k bit vectors → Gray code
  const vecs = keys.map(k => k.split(',').map(Number))
  if (vecs.every(v => v.every(x => x === 0 || x === 1))) {
    const n = vecs.length
    const d = vecs[0].length
    if (n === 4 && d === 2) return ['0,0', '1,0', '1,1', '0,1']
    if (n === 8 && d === 3) return ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  }
  const deduped = [...new Set(keys)]
  if (deduped.every(k => /^-?\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a) - Number(b))
  }
  if (deduped.every(k => /^e\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }
  return deduped.sort()
}

function nestedFactorLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  if (group.elements.length === 0) return null
  if (!group.elements[0].id.includes('|')) return null

  // Extract factor keys
  const prefixGroups = new Map<string, GroupElement[]>()
  const suffixSet = new Set<string>()
  for (const el of group.elements) {
    const p = el.id.indexOf('|')
    if (p === -1) continue
    const pref = el.id.substring(0, p)
    const suf = el.id.substring(p + 1)
    if (!prefixGroups.has(pref)) prefixGroups.set(pref, [])
    prefixGroups.get(pref)!.push(el)
    suffixSet.add(suf)
  }

  const prefixKeys = cayleyRingKeys([...prefixGroups.keys()])
  const suffixKeys = cayleyRingKeys([...suffixSet])

  const outerCount = prefixKeys.length
  const innerCount = suffixKeys.length
  const cx = width / 2
  const cy = height / 2

  // Outer ring: one position per G element, spaced to leave room for inner H rings
  const outerR = outerCount <= 2
    ? Math.min(width * 0.22, height * 0.35, 400)
    : Math.min(Math.min(width, height) * 0.30, 50 + outerCount * 60)

  // Inner ring radius: small enough that adjacent inner rings don't collide
  const adjacentArc = outerCount > 2
    ? 2 * outerR * Math.sin(Math.PI / outerCount)
    : outerR * 2  // for 2 copies: distance across diameter
  const maxInnerByCopyGap = adjacentArc * 0.42
  const maxInnerByOuterScale = outerR * 0.38
  const innerR = Math.max(30, Math.min(maxInnerByCopyGap, maxInnerByOuterScale, 180))

  const result = new Map<string, NodePosition>()

  for (let oi = 0; oi < outerCount; oi++) {
    const pKey = prefixKeys[oi]
    const pAngle = (oi * 2 * Math.PI) / outerCount - Math.PI / 2
    const oX = cx + outerR * Math.cos(pAngle)
    const oY = cy + outerR * Math.sin(pAngle)

    for (let ii = 0; ii < innerCount; ii++) {
      const sKey = suffixKeys[ii]
      const sAngle = (ii * 2 * Math.PI) / innerCount - Math.PI / 2
      result.set(`${pKey}|${sKey}`, {
        x: oX + innerR * Math.cos(sAngle),
        y: oY + innerR * Math.sin(sAngle)
      })
    }
  }

  return result
}

// ─── Public Entry Point ─────────────────────────────────────────────────

export function directProductGridLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  if (!isGroupDirectProduct(group)) return null

  const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

  // ── Dynamic (pipe-delimited) products ─────────────────────────────────
  if (isPipeProduct) {
    const prefixKeys = new Set<string>()
    const suffixKeys = new Set<string>()
    for (const el of group.elements) {
      const p = el.id.indexOf('|')
      if (p === -1) continue
      prefixKeys.add(el.id.substring(0, p))
      suffixKeys.add(el.id.substring(p + 1))
    }
    const prefCyclic = isCyclicFactorKeys([...prefixKeys])
    const suffCyclic = isCyclicFactorKeys([...suffixKeys])

    if (prefCyclic && suffCyclic) {
      // Both factors cyclic → matrix grid
      const factors = parseProductFactors(group)
      if (!factors) return null
      return matrixGridLayout(factors.colSize, factors.rowSize, factors.getCol, factors.getRow, group, width, height)
    }
    // At least one factor non-cyclic → nested factor layout
    return nestedFactorLayout2D(group, width, height)
  }

  // ── Pre-built products (Zn x Zm, Z2^3 — always cyclic) ─────────────────
  const factors = parseProductFactors(group)
  if (!factors) return null
  return matrixGridLayout(factors.colSize, factors.rowSize, factors.getCol, factors.getRow, group, width, height)
}

// ─── Fibonacci 2D spherical distribution ───────────────────────────────

export function fibonacci2DLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const r = Math.min(width, height) * 0.38

  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const phi = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = phi * i

    result.set(group.elements[i].id, {
      x: cx + Math.cos(theta) * radiusAtY * r,
      y: cy + y * r
    })
  }

  return result
}

// ─── Concentric Layout (by conjugacy classes) ─────────────────────────

function computeElementOrder(el: GroupElement, group: Group): number {
  let current = el
  let ord = 0
  do {
    current = group.multiply(current, el)
    ord++
    if (ord > group.order) return group.order
  } while (current.id !== el.id)
  return ord
}

export function concentricLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const idToEl = new Map<string, GroupElement>()
  group.elements.forEach(el => idToEl.set(el.id, el))

  const conjugacyClasses: GroupElement[][] = []
  const used = new Set<string>()

  for (const a of group.elements) {
    if (used.has(a.id)) continue
    const conjugates: GroupElement[] = []
    const maxIters = group.order > 60 ? 10 : group.order
    const sample = group.order > 60
      ? [group.identity, ...group.elements.slice(0, Math.min(maxIters - 1, group.order - 1))]
      : group.elements
    for (const g of sample) {
      const conj = group.multiply(group.multiply(g, a), group.inverse(g))
      if (!used.has(conj.id)) {
        conjugates.push(conj)
        used.add(conj.id)
      }
    }
    if (conjugates.length > 0) conjugacyClasses.push(conjugates)
  }

  conjugacyClasses.sort((a, b) => a.length - b.length)

  const maxRadius = Math.min(width, height) * 0.44
  const minRadius = 0
  const ringCount = conjugacyClasses.length
  const idClass = conjugacyClasses.find(cls => cls.length === 1 && cls[0].id === group.identity.id)

  let ringIndex = 0
  for (const cls of conjugacyClasses) {
    const isIdentityRing = cls === idClass
    const m = cls.length

    let ringRadius: number
    if (isIdentityRing) {
      ringRadius = 0
    } else {
      const effectiveRingIdx = ringIndex
      const totalRings = idClass ? ringCount - 1 : ringCount
      const t = totalRings > 1 ? effectiveRingIdx / (totalRings - 1) : 0.5
      ringRadius = minRadius + (maxRadius - minRadius) * (0.15 + t * 0.85)
    }

    for (let i = 0; i < m; i++) {
      let x: number, y: number
      if (m === 1) {
        x = cx
        y = cy + ringRadius
      } else {
        const angle = (i * 2 * Math.PI) / m - Math.PI / 2
        x = cx + ringRadius * Math.cos(angle)
        y = cy + ringRadius * Math.sin(angle)
      }
      result.set(cls[i].id, { x, y })
    }

    if (!isIdentityRing) ringIndex++
  }

  return result
}

// ─── Dual Ring Layout (for Dihedral groups) ───────────────────────────

export function dualRingLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result

  const m = n / 2

  const rotations: GroupElement[] = []
  const reflections: GroupElement[] = []

  for (const el of group.elements) {
    if (el.value.length >= 2 && el.value[1] === 0) {
      rotations.push(el)
    } else {
      reflections.push(el)
    }
  }

  if (rotations.length === 0 || reflections.length === 0) {
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const r = Math.min(width, height) * 0.38
      result.set(group.elements[i].id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return result
  }

  rotations.sort((a, b) => (a.value[0] ?? 0) - (b.value[0] ?? 0))
  reflections.sort((a, b) => (a.value[0] ?? 0) - (b.value[0] ?? 0))

  const outerR = Math.min(width, height) * 0.38
  const innerR = outerR * 0.55

  const refByRotIndex = new Map<number, GroupElement>()
  for (const ref of reflections) {
    refByRotIndex.set(ref.value[0] ?? 0, ref)
  }

  const rotationLabelOrder = new Map<string, number>()
  rotations.forEach((el, i) => rotationLabelOrder.set(el.id, i))

  for (let i = 0; i < rotations.length; i++) {
    const el = rotations[i]
    const angle = (i * 2 * Math.PI) / m - Math.PI / 2
    result.set(el.id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
  }

  for (let i = 0; i < rotations.length; i++) {
    const rotIdx = rotations[i].value[0] ?? 0
    const ref = refByRotIndex.get(rotIdx)
    const angle = (i * 2 * Math.PI) / m - Math.PI / 2
    if (ref) {
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
  }

  for (const ref of reflections) {
    if (!result.has(ref.id)) {
      const idx = reflections.indexOf(ref)
      const angle = (idx * 2 * Math.PI) / reflections.length - Math.PI / 2
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
  }

  return result
}

// ─── Coset Strip Layout ────────────────────────────────────────────────

export interface CosetStripData {
  positions: Map<string, NodePosition>
  strips: CosetStripInfo[]
}

export interface CosetStripInfo {
  elementIds: string[]
  label: string
  color: string
  x: number
  y: number
  w: number
  h: number
  isSubgroup: boolean
}

const COSET_STRIP_COLORS: string[] = [
  '#ff6b6b', '#4ecdc4', '#ffd93d', '#84cc16',
  '#a78bfa', '#f97316', '#38bdf8', '#f43f5e',
  '#eab308', '#6366f1', '#ec4899', '#14b8a6',
  '#0ea5e9', '#22c55e', '#a855f7', '#06b6d4',
]

const NODE_RADIUS = 28
const NODE_DIAMETER = NODE_RADIUS * 2
const MIN_NODE_GAP = 20
const MIN_NODE_STEP = NODE_DIAMETER + MIN_NODE_GAP  // 76px center-to-center
const IDEAL_NODE_STEP = NODE_DIAMETER + 46          // 102px
const MIN_COL_WIDTH = NODE_DIAMETER + 14             // 70px — node fits with 7px side margin

function computeCosetGrid(totalStrips: number, stripSize: number, usableW: number, usableH: number) {
  // Step 1: always prefer 1 row — that maximizes vertical node spacing.
  let cols = totalStrips
  let rows = 1
  let colWidth = usableW / totalStrips
  let nodeStep = usableH / Math.max(1, stripSize)

  // Step 2: if columns are too narrow, wrap to a second row.
  // This reduces vertical space per row, so only do it if horizontal space
  // is constraining and there's enough vertical headroom.
  if (colWidth < MIN_COL_WIDTH && totalStrips > 1) {
    const candidateCols = Math.max(1, Math.floor(usableW / MIN_COL_WIDTH))
    const candidateRows = Math.ceil(totalStrips / candidateCols)
    const candidateStep = usableH / candidateRows / Math.max(1, stripSize)

    // Only wrap if vertical spacing remains above the minimum
    if (candidateStep >= MIN_NODE_STEP) {
      cols = Math.min(candidateCols, totalStrips)
      rows = candidateRows
      colWidth = usableW / cols
      nodeStep = candidateStep
    }
  }

  // Clamp nodeStep to a reasonable range
  nodeStep = Math.max(nodeStep, MIN_NODE_STEP)   // hard floor: minimum node spacing
  nodeStep = Math.min(nodeStep, IDEAL_NODE_STEP)

  return { cols, rows, colWidth, nodeStep }
}

export function cosetStripLayout(
  group: Group,
  width: number,
  height: number,
  subgroupElementIds?: string[],
  cosetElementMap?: Map<string, number>,
  cosetCount?: number,
  cosetColors?: string[],
): CosetStripData {
  const n = group.order
  const result = new Map<string, NodePosition>()
  const strips: CosetStripInfo[] = []

  if (n === 0) return { positions: result, strips }

  // ── use global coset data if available ──
  if (cosetElementMap && cosetElementMap.size > 0 && cosetCount && cosetCount > 0) {
    const mapEi = cosetElementMap
    const totalCosets = cosetCount
    const colors = cosetColors && cosetColors.length > 0 ? cosetColors : COSET_STRIP_COLORS

    // Collect elements per coset
    const cosetBuckets: string[][] = Array.from({ length: totalCosets }, () => [])
    for (const el of group.elements) {
      const ci = mapEi.get(el.id)
      if (ci !== undefined && ci < totalCosets) {
        cosetBuckets[ci].push(el.id)
      }
    }

    // Determine representative labels for each coset (use first non-subgroup element)
    const subGroupSet = new Set(cosetBuckets[0]) // coset 0 = H
    const repLabels: string[] = []
    for (let c = 0; c < totalCosets; c++) {
      if (c === 0) {
        repLabels.push('H')
      } else {
        const repId = cosetBuckets[c].find(id => !subGroupSet.has(id)) || cosetBuckets[c][0]
        const repEl = group.elements.find(e => e.id === repId)
        repLabels.push(repEl ? `g_{${c}}H` : `c_{${c}}`)
      }
    }

    // Determine coset height = max elements in any coset
    const maxCosetSize = Math.max(...cosetBuckets.map(b => b.length))
    const marginX = 50
    const marginTop = 55
    const marginBottom = 25
    const labelGap = 16
    const usableW = width - 2 * marginX
    const usableH = height - marginTop - marginBottom

    const { cols: colsPerRow, rows: numRows, colWidth, nodeStep } = computeCosetGrid(totalCosets, maxCosetSize, usableW, usableH)

    for (let c = 0; c < totalCosets; c++) {
      const row = Math.floor(c / colsPerRow)
      const col = c % colsPerRow
      const bucket = cosetBuckets[c]
      const bx = marginX + colWidth * (col + 0.5)
      const stripTop = marginTop + row * usableH / Math.max(1, numRows) + labelGap
      const by = stripTop + (bucket.length > 0 ? (bucket.length - 1) * nodeStep / 2 : 0) + nodeStep / 2

      bucket.forEach((elId, ri) => {
        result.set(elId, {
          x: bx,
          y: by + (ri - (bucket.length - 1) / 2) * nodeStep
        })
      })

      strips.push({
        elementIds: bucket,
        label: repLabels[c],
        color: colors[c % colors.length],
        x: marginX + colWidth * col + 4,
        y: stripTop - nodeStep / 2,
        w: colWidth - 8,
        h: Math.max(1, bucket.length) * nodeStep,
        isSubgroup: c === 0,
      })
    }

    return { positions: result, strips }
  }

  // ── fallback: auto-detect cyclic subgroup from first generator ──
  let subgroupSet: Set<string>
  if (subgroupElementIds && subgroupElementIds.length > 0) {
    subgroupSet = new Set(subgroupElementIds)
  } else {
    subgroupSet = new Set([group.identity.id])
    const firstGenEl = group.generators[0]?.apply(group.identity)
    if (!firstGenEl) {
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2
        const r = Math.min(width, height) * 0.35
        result.set(group.elements[i].id, { x: width / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle) })
      }
      return { positions: result, strips }
    }
    let current = group.identity
    let next = firstGenEl
    while (!subgroupSet.has(next.id)) {
      subgroupSet.add(next.id)
      current = next
      next = group.multiply(current, firstGenEl)
    }
  }

  const subgroupIds = Array.from(subgroupSet)
  const used = new Set<string>(subgroupSet)
  const cosetReps: string[] = []
  for (const el of group.elements) {
    if (!used.has(el.id)) {
      cosetReps.push(el.id)
      const subList = subgroupIds.map(id => {
        const hEl = group.elements.find(e => e.id === id)!
        return group.multiply(el, hEl).id
      })
      subList.forEach(id => used.add(id))
    }
  }

  const numStrips = 1 + cosetReps.length
  const hSize = subgroupIds.length

  // Build coset maps
  const allCosetStrips: string[][] = [subgroupIds]
  for (const repId of cosetReps) {
    const rep = group.elements.find(e => e.id === repId)!
    const strip: string[] = subgroupIds.map(id => {
      const hEl = group.elements.find(e => e.id === id)!
      return group.multiply(rep, hEl).id
    })
    allCosetStrips.push(strip)
  }

  // Layout: wrap many cosets to multiple rows for readability
  const marginX = 50
  const marginTop = 55
  const marginBottom = 25
  const labelGap = 16
  const usableW = width - 2 * marginX
  const usableH = height - marginTop - marginBottom
  const { cols, rows, colWidth: colW, nodeStep: step } = computeCosetGrid(numStrips, hSize, usableW, usableH)

  for (let s = 0; s < allCosetStrips.length; s++) {
    const row = Math.floor(s / cols)
    const col = s % cols
    const strip = allCosetStrips[s]
    const bx = marginX + colW * (col + 0.5)
    const stripTop = marginTop + row * usableH / Math.max(1, rows) + labelGap
    const by = stripTop + (strip.length - 1) * step / 2 + step / 2

    strip.forEach((elId, ri) => {
      result.set(elId, {
        x: bx,
        y: by + (ri - (strip.length - 1) / 2) * step
      })
    })

    const color = COSET_STRIP_COLORS[s % COSET_STRIP_COLORS.length]
    strips.push({
      elementIds: strip,
      label: s === 0 ? 'H' : `g_{${s}}H`,
      color,
      x: marginX + colW * col + 4,
      y: stripTop - step / 2,
      w: colW - 8,
      h: Math.max(1, strip.length) * step,
      isSubgroup: s === 0,
    })
  }

  // Fallback for any unassigned elements
  for (const el of group.elements) {
    if (!result.has(el.id)) {
      const idx = group.elements.indexOf(el)
      const col = idx % cols
      result.set(el.id, {
        x: marginX + colW * (col + 0.5),
        y: marginTop + (idx % hSize) * step + step / 2
      })
    }
  }

  return { positions: result, strips }
}

// ─── Archimedean Spiral Layout ─────────────────────────────────────────

export function archimedeanSpiralLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.44
  const turns = Math.max(2, Math.ceil(n / 8))
  const a = maxR / (turns * 2 * Math.PI)

  // Sort elements by order to make it slightly more structured
  const elementsWithOrder = group.elements.map(el => ({
    el,
    order: computeElementOrder(el, group)
  }))
  elementsWithOrder.sort((a, b) => {
    if (a.el.id === group.identity.id && b.el.id !== group.identity.id) return -1
    if (a.el.id !== group.identity.id && b.el.id === group.identity.id) return 1
    return a.order - b.order || a.el.id.localeCompare(b.el.id)
  })

  for (let i = 0; i < elementsWithOrder.length; i++) {
    const t = i / (n - 1)
    const theta = t * turns * 2 * Math.PI
    const r = a * theta

    result.set(elementsWithOrder[i].el.id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

// ─── Spiral Layout (optimized for Cyclic groups Cn) ────────────────────
//
// Multi-turn Archimedean spiral following generator order.
// Consecutive edges (e_i→e_{i+1}) are short and adjacent on the spiral.
// The wrap-around edge (e_{n-1}→e_0) cuts from the outer tip to center,
// creating a characteristic "rose" crossing pattern.

export function spiralLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.42
  const turns = Math.max(3, Math.ceil(n / 5))

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const r = maxR * t
    const theta = t * turns * 2 * Math.PI

    result.set(group.elements[i].id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

// ─── Coil Layout (variable-pitch spiral, only wrap-edge crosses) ────────
//
// Angular density increases with radius: inner nodes are sparse (large
// angular gaps), outer nodes are packed tight (small angular gaps).
// This keeps intermediate edges short angularly even at large radii,
// preventing crossings among them.  Only the wrap-around edge jumps back.

export function coilLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> {
  const n = group.order
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()

  if (n === 0) return result
  if (n === 1) {
    result.set(group.elements[0].id, { x: cx, y: cy })
    return result
  }

  const maxR = Math.min(width, height) * 0.42
  const turns = Math.max(2, Math.ceil(n / 6))

  // θ(t) = t^α * turns * 2π  with α < 1
  // dθ/dt ∝ t^(α-1) — large near t=0 (sparse inner), small near t=1 (dense outer)
  const alpha = 0.7

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const r = maxR * t
    const theta = Math.pow(t, alpha) * turns * 2 * Math.PI

    result.set(group.elements[i].id, {
      x: cx + r * Math.cos(theta - Math.PI / 2),
      y: cy + r * Math.sin(theta - Math.PI / 2)
    })
  }

  return result
}

function projectionLayoutForGroup(group: Group): Layout3D {
  const sym = group.symbol
  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') return 'hexagon'
  if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') return 'truncatedCube'
  if (sym === 'A_{4}' || sym === 'A4') return 'truncatedTetrahedron'
  if (sym === 'A_{5}' || sym === 'A5') return 'truncatedIcosahedron'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'cube'
  if (sym.startsWith('S') || sym.startsWith('A')) return 'spherical'
  return getDefaultLayout3D(group)
}

export function projection3DLayout(group: Group, width: number, height: number): Map<string, NodePosition> | null {
  const n = group.order
  if (n === 0) return null

  const layout = projectionLayoutForGroup(group)
  const positions3D = compute3DPositions(group, layout)

  if (!positions3D || positions3D.length !== n) return null

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  const flat: { x: number; y: number }[] = new Array(n)
  const cos30 = Math.cos(Math.PI / 6)
  const sin30 = Math.sin(Math.PI / 6)

  for (let i = 0; i < n; i++) {
    const [x3, y3, z3] = positions3D[i]
    const px = (x3 - z3) * cos30
    const py = (x3 + z3) * sin30 - y3
    flat[i] = { x: px, y: py }
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }

  const dataW = maxX - minX || 1
  const dataH = maxY - minY || 1
  const margin = 80
  const availW = width - margin * 2
  const availH = height - margin * 2
  const scale = Math.min(availW / dataW, availH / dataH)
  const cx = width / 2
  const cy = height / 2
  const dataCx = (minX + maxX) / 2
  const dataCy = (minY + maxY) / 2

  const result = new Map<string, NodePosition>()
  group.elements.forEach((el, i) => {
    const px = cx + (flat[i].x - dataCx) * scale
    const py = cy + (flat[i].y - dataCy) * scale
    result.set(el.id, { x: px, y: py })
  })

  return result
}

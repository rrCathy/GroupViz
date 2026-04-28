import type { Group, GroupElement, NodePosition, GroupAction, CayleyEdgeData, MultiplyType } from '../types'

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
  group.elements.forEach((el, i) => idToIdx.set(el.id, i))

  const enabledActions = actions.filter(a => a.enabled)
  if (enabledActions.length === 0) return []

  const allEdges: CayleyEdgeData[] = []

  for (let i = 0; i < group.elements.length; i++) {
    const fromEl = group.elements[i]
    for (const action of enabledActions) {
      const actionEl = group.elements.find(e => e.id === action.elementId)
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

      allEdges.push({
        fromIdx: i,
        toIdx,
        fromId: fromEl.id,
        toId: toEl.id,
        actionElementId: action.elementId,
        color: action.color,
        isBidirectional: false,
        isSelfLoop,
      })
    }
  }

  const edgeSet = new Set<string>()
  const bidirectionalSet = new Set<string>()
  allEdges.forEach(edge => {
    const key = [edge.fromIdx, edge.toIdx].sort().join('|')
    if (edgeSet.has(key)) {
      bidirectionalSet.add(key)
    } else {
      edgeSet.add(key)
    }
  })

  const processedEdges = new Map<string, CayleyEdgeData>()
  allEdges.forEach(edge => {
    const key = [edge.fromIdx, edge.toIdx].sort().join('|')
    if (!processedEdges.has(key)) {
      processedEdges.set(key, { ...edge, isBidirectional: bidirectionalSet.has(key) })
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

export function computeCayleyEdges(group: Group): ForceLayoutEdge[] {
  const edges: ForceLayoutEdge[] = []
  const seen = new Set<string>()
  for (const el of group.elements) {
    for (const gen of group.generators) {
      const toEl = gen.apply(el)
      if (!toEl) continue
      const key = [el.id, toEl.id].sort().join('|')
      if (!seen.has(key)) {
        seen.add(key)
        edges.push({ source: el.id, target: toEl.id })
      }
    }
  }
  return edges
}

export function computeCycleEdges(group: Group): ForceLayoutEdge[] {
  const edges: ForceLayoutEdge[] = []
  const seen = new Set<string>()
  for (const el of group.elements) {
    const cycle: string[] = []
    const visited = new Set<string>()
    let current = el
    while (!visited.has(current.id)) {
      visited.add(current.id)
      cycle.push(current.id)
      current = group.multiply(current, el)
    }
    if (cycle.length > 1) {
      for (let i = 0; i < cycle.length; i++) {
        const j = (i + 1) % cycle.length
        const key = [cycle[i], cycle[j]].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ source: cycle[i], target: cycle[j] })
        }
      }
    }
  }
  return edges
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

export function forceLayout(
  elements: GroupElement[],
  edges: ForceLayoutEdge[],
  width: number,
  height: number,
  options: ForceLayoutOptions = {}
): Map<string, NodePosition> {
  const n = elements.length
  if (n === 0) return new Map()

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

  const repC = idealDist * idealDist * 0.8
  const attC = 0.08
  const restLen = idealDist * 0.9
  const gravity = 0.015
  const cycleRep = repC * 3

  const iterations = Math.max(150, Math.min(500, n * 5))
  const padX = width * 0.06
  const padY = height * 0.06

  for (let iter = 0; iter < iterations; iter++) {
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

    if (options.cycleSubgroups) {
      for (const subgroup of options.cycleSubgroups) {
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

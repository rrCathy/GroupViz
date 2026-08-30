import type { Group, GroupElement, NodePosition } from '../types'
import type { ForceLayoutEdge, ForceLayoutOptions } from './cayleyEdges'

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

export interface PlanarCycleInput {
  elements: { id: string }[]
  order: number
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
      let dx = pos[i].x - pos[j].x
      let dy = pos[i].y - pos[j].y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1e-6) {
        // Coincident points: a zero-length direction vector cancels both the
        // repulsion and gravity terms, so fully overlapping nodes never
        // separate. Inject a deterministic pseudo-random direction instead.
        const angle = ((i * 127 + j * 311) % 1000) / 1000 * Math.PI * 2
        dx = Math.cos(angle) * 1e-6
        dy = Math.sin(angle) * 1e-6
        dist = 1e-6
      }
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

function findIdentityIdx(elements: GroupElement[]): number {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (el.label === 'e' || el.label === '0') return i
    if (el.value.length === 1 && el.value[0] === 0) return i
    if (el.value.length > 1 && el.value.every((v, j) => v === j + 1)) return i
  }
  return 0
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

// ===== Group Explorer 风格循环图（cycle graph）布局 =====
//
// 约定（对齐 Nathan Carter《群论彩图版》与 Group Explorer 的 CycleGraphView）：
// - 单位元 e 居中，所有极大循环子群都经过 e。
// - 每个极大循环 = 一片「花瓣」：循环的非单位元落在一个圆弧上（e 在圆弧底部，向外张开）。
// - 共享的非单位元 = 花瓣在共享顶点处相交（例 Z₂×Z₄ 的两只「蝴蝶」菱形，共享 e 与一个 2 阶元素）。
// - 不在任何 ≥3 阶循环里的 2 阶元素 = 从 e 出去的「叶柄」（短花瓣）。
//
// 布局策略（精确复刻 GE）：
// - 基础花瓣：非单位元 g^k 落在圆心 (0,R)、半径 R 的圆弧上，坐标 (-R·cosθ, R(1+sinθ))，θ=2π(k/n-0.25)。
// - 循环按共享非单位元聚成 part（并查集），各 part 依循环长度之和比例分配不相交的角度弧，最大 part 垂直向下。
// - part 内多个循环用 gravity=ringNum/part.length 拉向弧中心，共享元素只在首个循环放置、后续循环引用同位置。

export interface OrderedCycleInput {
  /** 子群顺序元素 [e, g, g², ...]，首元素为单位元 */
  elementIds: string[]
}

/**
 * GE CycleGraphView 的花瓣布局原语（精确对齐 Nathan Carter / Group Explorer）：
 * - 基础花瓣：循环的非单位元落在以 (0,R) 为圆心、半径 R 的圆弧上，单位元在圆弧底部原点。
 *   第 k 个非单位元 g^k（k=1..n-1）的基础坐标为 (-R·cosθ, R(1+sinθ))，θ = 2π(k/n - 0.25)。
 * - mutateArc：把基础花瓣映射到 part 弧 [alpha,beta]，并按 gravity g 拉向弧中心（半径 1/2），
 *   使同一 part 内共享元素的多个循环错开、不重叠。
 */

/** 基础花瓣上第 k 个非单位元（g^k，k=1..n-1）的基础坐标（R=1，未映射）。 */
function basePetalPoint(k: number, n: number): { x: number; y: number } {
  const theta = 2 * Math.PI * (k / n - 0.25)
  return { x: -Math.cos(theta), y: 1 + Math.sin(theta) }
}

/** 旋转循环使单位元排在最前（保持循环顺序 [e, g, g², ...]）。 */
function normalizeCycle(elementIds: string[], identityId: string): OrderedCycleInput {
  const idx = elementIds.indexOf(identityId)
  if (idx <= 0) return { elementIds }
  return { elementIds: [...elementIds.slice(idx), ...elementIds.slice(0, idx)] }
}

/** GE mutate：把点 (x,y) 映射到弧 [alpha,beta]，并按 g（0..1）拉向弧中心。 */
function mutateArc(
  x: number,
  y: number,
  alpha: number,
  beta: number,
  g: number,
): { x: number; y: number } {
  const r = Math.sqrt(x * x + y * y)
  const theta = Math.atan2(y, x)
  const theta2 = alpha + (theta / Math.PI) * (beta - alpha)
  const x2 = r * Math.cos(theta2)
  const y2 = r * Math.sin(theta2)
  const cx = Math.cos((alpha + beta) / 2) / 2
  const cy = Math.sin((alpha + beta) / 2) / 2
  return { x: x2 + (cx - x2) * g, y: y2 + (cy - y2) * g }
}

/** GE bestPowerRelativeTo（纯基于元素 ID）：找 t（与 order(h) 互素）使 h^t 轨道与 g 轨道最早相交。 */
function bestPowerRelativeTo(hOrbit: string[], gOrbit: string[]): number {
  const n = hOrbit.length
  if (n <= 2) return 1
  const gSet = new Set(gOrbit.slice(1))
  let bestT = 1
  let bestGIdx = Infinity
  for (let t = 1; t < n; t++) {
    if (gcd(t, n) !== 1) continue
    for (let i = 1; i < n; i++) {
      const el = hOrbit[(i * t) % n]
      if (gSet.has(el)) {
        const gIdx = gOrbit.indexOf(el) - 1
        if (gIdx >= 0 && gIdx < bestGIdx) { bestGIdx = gIdx; bestT = t }
        break
      }
    }
  }
  return bestT
}

/** 重新轮换循环：取 [e, g^t, g^{2t}, ...]。 */
function reorbitCycle(cycleIds: string[], t: number): string[] {
  if (t <= 1) return cycleIds
  const n = cycleIds.length
  const out = new Array<string>(n)
  out[0] = cycleIds[0]
  for (let k = 1; k < n; k++) out[k] = cycleIds[(k * t) % n]
  return out
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

/**
 * 循环图（cycle graph）布局：单位元居中，极大循环作为花瓣展开。
 *
 * 设计原则（精确复刻 Group Explorer 的 CycleGraphView.layoutElementsAndPaths）：
 * 1. 单位元 e 固定在原点，永不重放。
 * 2. 每个极大循环 = 一片「花瓣」：非单位元 g^k 落在圆心 (0,R) 半径 R 的圆弧上，
 *    e 在圆弧底部（basePetalPoint）。循环按共享非单位元聚成 part（并查集，
 *    合并时用 bestPowerRelativeTo 重新轮换被并入 part 的每个循环，使共享元素
 *    在圆弧索引上对齐）。
 * 3. 各 part 按「循环长度之和」比例分配不相交的角度弧；单个 part 退化用半圆弧；
 *    最大 part（循环数最多）的弧中心旋转到正下方。
 * 4. part 内多个循环用 gravity = ringNum/part.length 拉向弧中心；共享元素只由
 *    首个摆放它的循环放置，后续循环引用同一位置（蝴蝶 / SL(2,3) / C5×S3 等）。
 *
 * 风车式改进：所有极大循环都「只共享 e」的群（S3/Dn/A4/A5/V4/纯直积等，partition
 * 中每个 part 都只有单个循环）不走第 3. 条的半球旋转——那会把循环数均分的 S3 型
 * 群的全部 2 阶叶柄压到下半圆并与花瓣交叉。改为每片花瓣/叶柄绕 e 均匀分一整圈
 * （360° 等分扇区，无 gravity），S3 呈现教科书式「三角花瓣 + 三条放射叶柄」。
 */
export function cycleGraphLayout(
  elements: GroupElement[],
  cycles: OrderedCycleInput[],
  width: number,
  height: number,
  identityIdOverride?: string,
): Map<string, NodePosition> {
  const cx = width / 2
  const cy = height / 2
  if (elements.length === 0) return new Map()
  const identityId = identityIdOverride ?? elements[findIdentityIdx(elements)].id
  const result = new Map<string, NodePosition>()
  result.set(identityId, { x: cx, y: cy })
  if (cycles.length === 0) return result

  const normCycles: string[][] = cycles.map(c => normalizeCycle(c.elementIds, identityId).elementIds)

  // GE uniteParts：把「共享非单位元」的循环按共享关系并成 part；
  // 每次合并把被并入 part 的每个循环按 bestPowerRelativeTo 重新轮换，
  // 使共享元素与锚点循环在圆弧索引上对齐（纯元素 ID 运算，faithful GE）。
  const partition: string[][][] = normCycles.map(cycle => [cycle])
  // 注意：循环数组是「含 e 的身份优先」形式，但 e 出现在每个循环里，共享判定
  // 必须排除 e（faithful GE 的循环本就不含 e），否则所有循环恒相交、全部并入一个
  // part——风车式门与 GE 多 part 比例弧都会失效（S3 全部压下半圆即此 bug）。
  const arraysIntersect = (a: string[], b: string[]): boolean =>
    a.slice(1).some(elt => b.slice(1).includes(elt))
  const flattenPart = (part: string[][]): string[] => part.reduce((acc, c) => acc.concat(c.slice(1)), [])
  const uniteParts = (partIndex1: number, partIndex2: number): void => {
    const anchor = partition[partIndex1][0]
    partition[partIndex2].forEach(cycle => {
      partition[partIndex1].push(reorbitCycle(cycle, bestPowerRelativeTo(cycle, anchor)))
    })
    partition.splice(partIndex2, 1)
  }
  let keepChecking = true
  while (keepChecking) {
    keepChecking = false
    for (let i = 0; !keepChecking && i < partition.length; i++) {
      for (let j = 0; !keepChecking && j < i; j++) {
        if (arraysIntersect(flattenPart(partition[i]), flattenPart(partition[j]))) {
          uniteParts(i, j)
          keepChecking = true
        }
      }
    }
  }

  // 花瓣半径 R 与基础花瓣缩放（基础花瓣最远点距原点 2，除以 2 归一到 R）。
  const R = Math.min(width, height) * 0.40
  const scale = R / 2

  // 风车式（windmill）：对「所有极大循环都只共享 e」的群（partition 里每个 part
  // 都只有单个循环，如 S3/D3..D8/A4/A5/V4/Cn×Cm 纯直积），跳过 GE 的「最大 part
  // 朝下」旋转——那把循环数均分的 S3 型群的所有 2 阶叶柄压到下半圆并与花瓣交叉。
  // 改为每片花瓣/叶柄均匀绕 e 分一整圈（360° 等分扇区，无 gravity）。
  if (partition.length > 1 && partition.every(p => p.length === 1)) {
    const sectorCount = partition.length
    const sectorWidth = (2 * Math.PI) / sectorCount
    partition.forEach((part, partIndex) => {
      const center = partIndex * sectorWidth + Math.PI / 2 // 第一片朝上
      const alpha = center - sectorWidth / 2
      const beta = center + sectorWidth / 2
      const cycle = part[0]
      const n = cycle.length
      for (let kk = 1; kk < n; kk++) {
        if (result.has(cycle[kk])) continue
        const base = basePetalPoint(kk, n)
        const p = mutateArc(base.x, base.y, alpha, beta, 0)
        result.set(cycle[kk], { x: cx + p.x * scale, y: cy - p.y * scale })
      }
    })
    for (const el of elements) {
      if (!result.has(el.id)) result.set(el.id, { x: cx + R, y: cy })
    }
    return result
  }

  // GE 弧分配：parts 按循环长度总和比例分配圆周；最大 part 超半圆截断到半圆；
  // 只有一个 part 的退化情形用半圆。
  let cumsums: number[]
  if (partition.length > 1) {
    let partSizes = partition.map(p => p.reduce((acc, c) => acc + c.length, 0))
    let total = partSizes.reduce((a, b) => a + b, 0)
    if (Math.max(...partSizes) > total / 2) {
      partSizes = partSizes.map(x => Math.min(x, total / 2))
      total = partSizes.reduce((a, b) => a + b, 0)
    }
    cumsums = [0]
    for (const s of partSizes) cumsums.push(cumsums[cumsums.length - 1] + (s * 2 * Math.PI) / total)
  } else {
    cumsums = [0, Math.PI]
  }

  // GE 旋转：循环数最多的 part 的弧中心朝正下方（-π/2）。
  let maxPartLength = 0
  let maxPartIndex = 0
  partition.forEach((p, idx) => {
    if (p.length > maxPartLength) { maxPartLength = p.length; maxPartIndex = idx }
  })
  const maxPartCenter = (cumsums[maxPartIndex] + cumsums[maxPartIndex + 1]) / 2
  const rotateDiff = -Math.PI / 2 - maxPartCenter
  cumsums = cumsums.map(a => a + rotateDiff)

  // 花瓣半径：part 内循环数占最大 part 比例开方，下限 0.25（GE 的 r/R 缩放）。
  const partR = partition.map(part => Math.sqrt(Math.max(part.length / maxPartLength, 0.25)))

  // 放置元素：共享元素只由第一个摆放它的循环放置（后续循环通过 result.has
  // 引用同一位置）；gravity = ringNum/part.length 沿弧中心拉，faithful GE。
  partition.forEach((part, partIndex) => {
    const pr = partR[partIndex]
    part.forEach((cycle, ringNum) => {
      const n = cycle.length
      const g = ringNum / part.length
      for (let kk = 1; kk < n; kk++) {
        if (result.has(cycle[kk])) continue
        const base = basePetalPoint(kk, n)
        const p = mutateArc(base.x * pr, base.y * pr, cumsums[partIndex], cumsums[partIndex + 1], g)
        result.set(cycle[kk], { x: cx + p.x * scale, y: cy - p.y * scale })
      }
    })
  })

  // 兜底
  for (const el of elements) {
    if (!result.has(el.id)) result.set(el.id, { x: cx + R, y: cy })
  }

  return result
}

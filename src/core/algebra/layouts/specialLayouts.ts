import type { Group, NodePosition, Layout3D } from '../../types'
import { getDefaultLayout3D } from '../../types'
import { compute3DPositions } from '../layout3D'
import { getSemidirectProductMeta, semidirectFactorMap } from '../semidirectDecompositions'
import { powerRingOrder, dihedralSnakeOrder } from '../ringOrder'

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
const MIN_NODE_GAP = 12
const MIN_NODE_STEP = NODE_DIAMETER + MIN_NODE_GAP
const IDEAL_NODE_STEP = NODE_DIAMETER + 24
const MIN_COL_WIDTH = NODE_DIAMETER + 8

function computeCosetGrid(totalStrips: number, stripSize: number, usableW: number, usableH: number) {
  let cols = totalStrips
  let rows = 1
  let colWidth = usableW / totalStrips
  let nodeStep = usableH / Math.max(1, stripSize)

  if (colWidth < MIN_COL_WIDTH && totalStrips > 1) {
    const candidateCols = Math.max(1, Math.floor(usableW / MIN_COL_WIDTH))
    const candidateRows = Math.ceil(totalStrips / candidateCols)
    const candidateStep = usableH / candidateRows / Math.max(1, stripSize)

    if (candidateStep >= MIN_NODE_STEP) {
      cols = Math.min(candidateCols, totalStrips)
      rows = candidateRows
      colWidth = usableW / cols
      nodeStep = candidateStep
    }
  }

  nodeStep = Math.max(nodeStep, MIN_NODE_STEP)
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
  topPadding?: number,
): CosetStripData {
  const n = group.order
  const result = new Map<string, NodePosition>()
  const strips: CosetStripInfo[] = []

  if (n === 0) return { positions: result, strips }

  if (cosetElementMap && cosetElementMap.size > 0 && cosetCount && cosetCount > 0) {
    const mapEi = cosetElementMap
    const totalCosets = cosetCount
    const colors = cosetColors && cosetColors.length > 0 ? cosetColors : COSET_STRIP_COLORS

    const cosetBuckets: string[][] = Array.from({ length: totalCosets }, () => [])
    for (const el of group.elements) {
      const ci = mapEi.get(el.id)
      if (ci !== undefined && ci < totalCosets) {
        cosetBuckets[ci].push(el.id)
      }
    }

    const subGroupSet = new Set(cosetBuckets[0])
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

    const maxCosetSize = Math.max(...cosetBuckets.map(b => b.length))
    const marginX = 32
    const marginTop = topPadding ?? 44
    const marginBottom = 14
    const labelGap = 12
    const usableW = width - 2 * marginX
    const usableH = height - marginTop - marginBottom

    const { cols: colsPerRow, rows: numRows, colWidth, nodeStep } = computeCosetGrid(totalCosets, maxCosetSize, usableW, usableH)

    const TARGET_COL_WIDTH = NODE_DIAMETER * 3
    const cappedColW = Math.min(colWidth, TARGET_COL_WIDTH)
    const totalWidth = cappedColW * colsPerRow
    const startX = marginX + (usableW - totalWidth) / 2

    const totalLayoutHeight = numRows * (maxCosetSize * nodeStep + labelGap)
    const verticalOffset = (usableH - totalLayoutHeight) / 2

    for (let c = 0; c < totalCosets; c++) {
      const row = Math.floor(c / colsPerRow)
      const col = c % colsPerRow
      const bucket = cosetBuckets[c]
      const rowHeight = usableH / Math.max(1, numRows)
      const bx = startX + cappedColW * (col + 0.5)
      const stripTop = marginTop + verticalOffset + row * rowHeight + labelGap
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
        x: startX + cappedColW * col + 4,
        y: stripTop - nodeStep / 2,
        w: cappedColW - 8,
        h: Math.max(1, bucket.length) * nodeStep,
        isSubgroup: c === 0,
      })
    }

    return { positions: result, strips }
  }

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

  const allCosetStrips: string[][] = [subgroupIds]
  for (const repId of cosetReps) {
    const rep = group.elements.find(e => e.id === repId)!
    const strip: string[] = subgroupIds.map(id => {
      const hEl = group.elements.find(e => e.id === id)!
      return group.multiply(rep, hEl).id
    })
    allCosetStrips.push(strip)
  }

  const marginX = 32
  const marginTop = topPadding ?? 44
  const marginBottom = 14
  const labelGap = 12
  const usableW = width - 2 * marginX
  const usableH = height - marginTop - marginBottom
  const { cols, rows, colWidth: colW, nodeStep: step } = computeCosetGrid(numStrips, hSize, usableW, usableH)

  const TARGET_COL_WIDTH = NODE_DIAMETER * 3
  const cappedColW = Math.min(colW, TARGET_COL_WIDTH)
  const totalWidth = cappedColW * cols
  const startX = marginX + (usableW - totalWidth) / 2

  const totalLayoutHeight = rows * (hSize * step + labelGap)
  const verticalOffset = (usableH - totalLayoutHeight) / 2

  for (let s = 0; s < allCosetStrips.length; s++) {
    const row = Math.floor(s / cols)
    const col = s % cols
    const strip = allCosetStrips[s]
    const rowHeight = usableH / Math.max(1, rows)
    const bx = startX + cappedColW * (col + 0.5)
    const stripTop = marginTop + verticalOffset + row * rowHeight + labelGap
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
      x: startX + cappedColW * col + 4,
      y: stripTop - step / 2,
      w: cappedColW - 8,
      h: Math.max(1, strip.length) * step,
      isSubgroup: s === 0,
    })
  }

  for (const el of group.elements) {
    if (!result.has(el.id)) {
      const idx = group.elements.indexOf(el)
      const col = idx % cols
      result.set(el.id, {
        x: startX + cappedColW * (col + 0.5),
        y: marginTop + (idx % hSize) * step + step / 2
      })
    }
  }

  return { positions: result, strips }
}

// ─── 3D Projection Layout ──────────────────────────────────────────────

function projectionLayoutForGroup(group: Group): Layout3D {
  const sym = group.symbol
  if (sym === 'S_{3}' || sym === 'S3' || sym === 'S₃') return 'hexagon'
  if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') return 'truncatedOctahedron2'
  if (sym === 'A_{4}' || sym === 'A4') return 'truncatedTetrahedron'
  if (sym === 'A_{5}' || sym === 'A5') return 'truncatedIcosahedron'
  if (sym === 'Q_{8}' || sym === 'Q8' || sym === 'Q₈') return 'cube'
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

// ─── Semidirect Product Layout (rewiring shape) ─────────────────────────
//
// The "rewiring" shape shows the semidirect product G = N ⋊ H as |H| copies
// of the normal subgroup N arranged around a main ring of H elements.
// Every copy is drawn TWISTED by φ(h): element n inside ring h sits at the
// angular slot of φ(h)(n), so rings whose φ(h) is non-trivial are visibly
// rotated against the identity ring (for D₄ = C₄ ⋊ C₂ the second copy's
// cycle runs in the opposite direction).
// The automorphisms φ(h) are shown as an overlay on the canvas: the
// generator edges inside ring h are the Cayley edges of N twisted by φ(h),
// φ(h)-fixed points are highlighted, and the x ↦ φ(x)
// rewiring wires are drawn as teal arcs between the affected elements.

export function semidirectProductLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const sd = getSemidirectProductMeta(group)
  if (!sd) return null
  const factorMap = semidirectFactorMap(group, sd)
  if (!factorMap) return null
  const { normal: N, acting: H } = sd

  const cx = width / 2
  const cy = height / 2
  const minDim = Math.min(width, height)
  const R = minDim * 0.32

  const hKeys = powerRingOrder(H)
  const hIdxMap = new Map(hKeys.map((k, i) => [k, i]))
  const nKeys = dihedralSnakeOrder(N) ?? powerRingOrder(N)
  const nIdxMap = new Map(nKeys.map((k, i) => [k, i]))
  const m = H.order
  const minRN = (N.order * 56) / (2 * Math.PI)
  const minRH = (H.order * 56) / (2 * Math.PI)
  const rN = Math.max(minRN * 1.6, R * 0.14)
  const copyGap = Math.max(90, rN * 1.35)
  const rH = Math.max(
    minRH * 1.6,
    (rN + 28 + copyGap / 2) / (m > 1 ? Math.sin(Math.PI / m) : 1)
  )

  const result = new Map<string, NodePosition>()
  for (const el of group.elements) {
    const f = factorMap.get(el.id)
    if (!f) return null
    const hIdx = hIdxMap.get(f.h.id) ?? 0
    const hAngle = (hIdx * 2 * Math.PI / H.order) - Math.PI / 2
    const hp = { x: cx + rH * Math.cos(hAngle), y: cy + rH * Math.sin(hAngle) }
    // φ(h) 扭转：环 h 内的元素按 φ(h)(n) 的索引摆放——φ(h) 非平凡时环被
    // 旋转/重排，使不同半直积（QD16: b→a³、C₈:C₂: b→a⁵、D16: b→a⁻¹）的
    // 跨环辐条连接模式 (n → φ(b)(n)) 互不相同，而非镜像同图。
    // 环内 a-边连接 idx(φ(h)(n)) → idx(φ(h)(n·φ(h)(a)))（φ(h)² = id 时即相邻
    // 环步进），b-边连接两环间同元素，辐条跨环错位直观展示 φ 的扭转。
    const hPhi = sd.phiMap.get(f.h.id)?.map.get(f.n.id)
    const twistedIdx = hPhi !== undefined ? nIdxMap.get(hPhi) : undefined
    const nIdx = twistedIdx ?? nIdxMap.get(f.n.id) ?? 0
    const nAngle = (nIdx * 2 * Math.PI / N.order) - Math.PI / 2
    result.set(el.id, { x: hp.x + rN * Math.cos(nAngle), y: hp.y + rN * Math.sin(nAngle) })
  }

  return result
}

// ─── Q8 Pythagorean Square Layout ──────────────────────────────────────────
//
// A 2D layout for the quaternion group Q₈ inspired by the Pythagorean theorem
// proof diagram:
//   - Outer square: {1, i, -1, -i} at the four corners (cyclic subgroup ⟨i⟩)
//   - Inner rectangle: {j, k, -j, -k}
//   - Right angle at -k = (a, -b)
//   - Leg 1: {1, j, -k} collinear, direction (1, 3)
//   - Leg 2: {-k, i}, direction (3, -1), perpendicular to leg 1
//   - Parameters a, b satisfy a² + b² = c² (Pythagorean theorem verified)
//
// Q8 element indices: [1, -1, i, -i, j, -j, k, -k] = [0,1,2,3,4,5,6,7]
// Position mapping:
//   1  → ( R,  R)   top-right
//   -1 → (-R, -R)   bottom-left
//   i  → ( R, -R)   bottom-right
//   -i → (-R,  R)   top-left
//   j  → ( b,  a)   inner, on leg 1
//   -j → (-b, -a)   inner, opposite j
//   k  → (-a,  b)   inner
//   -k → ( a, -b)   inner, right angle vertex

export function q8PythagoreanLayout(
  group: Group,
  width: number,
  height: number,
): Map<string, NodePosition> | null {
  const sym = group.symbol
  if (group.order !== 8 || (sym !== 'Q_{8}' && sym !== 'Q8' && sym !== 'Q₈')) return null

  const a = 1
  const b = 2
  const R = (a * a + b * b) / (2 * a)

  const corners = [
    { x:  R, y:  R },   // 1   top-right
    { x: -R, y: -R },   // -1  bottom-left
    { x:  R, y: -R },   // i   bottom-right
    { x: -R, y:  R },   // -i  top-left
  ]

  const inner = [
    { x:  b, y:  a },   // j
    { x: -b, y: -a },   // -j
    { x: -a, y:  b },   // k
    { x:  a, y: -b },   // -k  right angle vertex
  ]

  const positions = [
    corners[0], corners[1], corners[2], corners[3],
    inner[0],  inner[1],  inner[2],  inner[3],
  ]

  const minDim = Math.min(width, height)
  const scale = minDim / (2 * R * 1.15)
  const cx = width / 2
  const cy = height / 2

  const result = new Map<string, NodePosition>()
  group.elements.forEach((el, i) => {
    if (i < positions.length) {
      result.set(el.id, {
        x: cx + positions[i].x * scale,
        y: cy - positions[i].y * scale,
      })
    }
  })

  return result
}

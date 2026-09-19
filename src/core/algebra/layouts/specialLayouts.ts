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
/** 条带目标宽度：单列条带的观感上限（分列需要更宽时按需放宽，但仍受列宽约束） */
const TARGET_STRIP_W = NODE_DIAMETER * 3
/** 节点到条带边框的内边距 */
const STRIP_PAD = 4
/** 条带标签（`H` / `g_iH`）占用的纵向间隙 */
const STRIP_LABEL_GAP = 12
/** 步距压缩硬底（空间实在不够时的下限，防止退化成 0/NaN） */
const MIN_STEP_FLOOR = 20

/**
 * 条带网格规划（两个分支共用）。
 *
 * 旧实现的两处硬伤（2026-09-17 实测修复）：
 *  ① `nodeStep` 有**绝对**下限 `MIN_NODE_STEP`（68），|H| 大时条带总高 = |H|×68
 *     远超画布（S₅ 的 A₅：60×68+12 = 4092 vs 可用高 562）→ 条带被画到画布外；
 *  ② 列宽不足时要求「纵向也必须够松」才分行，否则退回 totalStrips 列细条
 *     （S₅ 的 C₂：60 条带各 6px 宽，节点横跨相邻条带）。
 *
 * 现在的口径：
 *  - 横向：每行条带数由 `MIN_COL_WIDTH` 决定，列宽不足就分行（不再退回细条）；
 *  - 条带内：|H| 在最小间距下单列塞不进可用高度时**横向分列**（在条带宽允许的前提下）；
 *  - 步距：先取理想值，空间不足则按可用空间**压缩**（图完整优先，节点可轻微重叠）。
 */
interface CosetStripGrid {
  colsPerRow: number
  numRows: number
  /** 相邻条带中心距（= stripW + 间隙）；条带整体居中而非铺满可用宽度 */
  colStride: number
  rowHeight: number
  /** 条带内横向列数 */
  stripCols: number
  /** 条带内每列节点数 */
  rowsInStrip: number
  stepX: number
  stepY: number
  stripW: number
  /** 条带高（= 内边距 + 节点直径 + 列内行程），保证整条带连同节点外沿都在可用高度内 */
  stripH: number
}

/** 条带间隙（相邻条带之间） */
const STRIP_GAP = 12
/** 单行条带的最小高度：至少容得下一个节点 + 内边距 + 标签行 */
const MIN_ROW_H = NODE_DIAMETER + 2 * STRIP_PAD + STRIP_LABEL_GAP

function planCosetStripGrid(
  totalStrips: number,
  stripSize: number,
  usableW: number,
  usableH: number,
): CosetStripGrid {
  // 行数上限由「每行至少放得下一个节点」决定：否则行高被压到节点直径以下，
  // 节点必然越出条带（S₅ 的 60 条带曾被排成 15 行 × 37.5px 行高）。
  const maxRowsByHeight = Math.max(1, Math.floor(usableH / MIN_ROW_H))
  const clampCols = (w: number) => {
    const byWidth = Math.floor((usableW + STRIP_GAP) / Math.max(1, w + STRIP_GAP))
    const byHeight = Math.ceil(totalStrips / maxRowsByHeight)
    return Math.max(1, Math.min(totalStrips, Math.max(byWidth, byHeight)))
  }

  const build = (colsPerRow: number) => {
    const numRows = Math.max(1, Math.ceil(totalStrips / colsPerRow))
    const rowHeight = usableH / numRows
    // 每条带的可用高度（扣掉标签行）与可用宽度（扣掉内边距）
    const availStripH = Math.max(1, rowHeight - STRIP_LABEL_GAP)
    const availStripW = Math.max(1, usableW / colsPerRow - STRIP_GAP)

    // 条带内分列：单列在最小间距下放得下就保持单列（向后兼容旧观感）
    let stripCols = 1
    let rowsInStrip = Math.max(1, stripSize)
    if (availStripH / Math.max(1, stripSize) < MIN_NODE_STEP) {
      const wantCols = Math.max(1, Math.ceil((stripSize * MIN_NODE_STEP) / availStripH))
      const maxCols = Math.max(1, Math.floor(availStripW / MIN_NODE_STEP))
      stripCols = Math.max(1, Math.min(wantCols, maxCols))
      rowsInStrip = Math.max(1, Math.ceil(stripSize / stripCols))
    }

    // 圆心行程扣掉节点半径与内边距，确保首/末节点外沿也不越出条带
    const innerH = Math.max(1, availStripH - NODE_DIAMETER - 2 * STRIP_PAD)
    const stepY = rowsInStrip > 1
      ? Math.min(IDEAL_NODE_STEP, innerH / (rowsInStrip - 1))
      : IDEAL_NODE_STEP
    const stripH = Math.min(availStripH, (rowsInStrip - 1) * stepY + NODE_DIAMETER + 2 * STRIP_PAD)
    const stripW = Math.min(
      availStripW,
      Math.max(TARGET_STRIP_W, (stripCols - 1) * MIN_NODE_STEP + NODE_DIAMETER + 2 * STRIP_PAD),
    )
    const stepX = stripCols > 1
      ? Math.min(IDEAL_NODE_STEP, Math.max(MIN_STEP_FLOOR, (stripW - NODE_DIAMETER - 2 * STRIP_PAD) / (stripCols - 1)))
      : 0

    return { numRows, rowHeight, stripCols, rowsInStrip, stepX, stepY, stripW, stripH }
  }

  // 条带宽度与每行条带数互相牵制（列多了条带变窄、分列又让条带变宽）——迭代到稳定
  let colsPerRow = clampCols(TARGET_STRIP_W)
  let plan = build(colsPerRow)
  for (let i = 0; i < 4; i++) {
    const next = clampCols(plan.stripW)
    if (next === colsPerRow) break
    colsPerRow = next
    plan = build(colsPerRow)
  }

  return { colsPerRow, colStride: plan.stripW + STRIP_GAP, ...plan }
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

    const maxCosetSize = Math.max(1, ...cosetBuckets.map(b => b.length))
    const marginX = 32
    const marginTop = topPadding ?? 44
    const marginBottom = 14
    const usableW = width - 2 * marginX
    const usableH = height - marginTop - marginBottom

    const { colsPerRow, colStride, rowHeight, stripCols, rowsInStrip, stepX, stepY, stripW, stripH } =
      planCosetStripGrid(totalCosets, maxCosetSize, usableW, usableH)

    // 条带整体居中（窄条带聚拢，不铺满可用宽度）
    const totalWidth = colStride * colsPerRow - STRIP_GAP
    const startX = marginX + Math.max(0, (usableW - totalWidth) / 2)

    for (let c = 0; c < totalCosets; c++) {
      const row = Math.floor(c / colsPerRow)
      const col = c % colsPerRow
      const bucket = cosetBuckets[c]
      const bx = startX + stripW / 2 + col * colStride
      // 条带在行内纵向居中；节点「列优先」填格（stripCols === 1 时与旧观感一致）
      const stripTop = marginTop + row * rowHeight + STRIP_LABEL_GAP
        + Math.max(0, (rowHeight - STRIP_LABEL_GAP - stripH) / 2)
      const firstNodeY = stripTop + STRIP_PAD + NODE_RADIUS

      bucket.forEach((elId, ri) => {
        const ci = Math.floor(ri / rowsInStrip)
        const rj = ri % rowsInStrip
        result.set(elId, {
          x: bx + (stripCols > 1 ? (ci - (stripCols - 1) / 2) * stepX : 0),
          y: firstNodeY + rj * stepY,
        })
      })

      strips.push({
        elementIds: bucket,
        label: repLabels[c],
        color: colors[c % colors.length],
        x: bx - stripW / 2,
        y: stripTop,
        w: stripW,
        h: stripH,
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
  const usableW = width - 2 * marginX
  const usableH = height - marginTop - marginBottom
  const { colsPerRow, colStride, rowHeight, stripCols, rowsInStrip, stepX, stepY, stripW, stripH } =
    planCosetStripGrid(numStrips, hSize, usableW, usableH)

  const totalWidth = colStride * colsPerRow - STRIP_GAP
  const startX = marginX + Math.max(0, (usableW - totalWidth) / 2)

  for (let s = 0; s < allCosetStrips.length; s++) {
    const row = Math.floor(s / colsPerRow)
    const col = s % colsPerRow
    const strip = allCosetStrips[s]
    const bx = startX + stripW / 2 + col * colStride
    const stripTop = marginTop + row * rowHeight + STRIP_LABEL_GAP
      + Math.max(0, (rowHeight - STRIP_LABEL_GAP - stripH) / 2)
    const firstNodeY = stripTop + STRIP_PAD + NODE_RADIUS

    strip.forEach((elId, ri) => {
      const ci = Math.floor(ri / rowsInStrip)
      const rj = ri % rowsInStrip
      result.set(elId, {
        x: bx + (stripCols > 1 ? (ci - (stripCols - 1) / 2) * stepX : 0),
        y: firstNodeY + rj * stepY,
      })
    })

    const color = COSET_STRIP_COLORS[s % COSET_STRIP_COLORS.length]
    strips.push({
      elementIds: strip,
      label: s === 0 ? 'H' : `g_{${s}}H`,
      color,
      x: bx - stripW / 2,
      y: stripTop,
      w: stripW,
      h: stripH,
      isSubgroup: s === 0,
    })
  }

  // 陪集划分不全时的兜底：未落位元素匀在画布底部一行（正常划分不会触发）
  for (const el of group.elements) {
    if (!result.has(el.id)) {
      const idx = group.elements.indexOf(el)
      const col = idx % colsPerRow
      result.set(el.id, {
        x: startX + stripW / 2 + col * colStride,
        y: marginTop + usableH - stepY / 2,
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

  // 视口适配：上面的环半径带绝对下限（minRN/minRH 按 56px/节点起算、copyGap ≥ 90），
  // 容器小于布局需求时（窄屏/矮画布）环会被推出画布裁掉。照 projection3DLayout 的
  // 尾部模式按包围盒整体等比缩放平移到画布内；只缩不放大，环间相位差（φ 扭转）
  // 与边形态保持不变。
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of result.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (isFinite(minX)) {
    const dataW = maxX - minX || 1
    const dataH = maxY - minY || 1
    const margin = 44
    const scale = Math.min(
      (width - margin * 2) / dataW,
      (height - margin * 2) / dataH,
      1,
    )
    const dataCx = (minX + maxX) / 2
    const dataCy = (minY + maxY) / 2
    for (const [id, p] of result) {
      result.set(id, { x: cx + (p.x - dataCx) * scale, y: cy + (p.y - dataCy) * scale })
    }
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

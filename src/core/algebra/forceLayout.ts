import type { Group, GroupElement, NodePosition, Layout3D } from '../types'
import { getDefaultLayout3D, isGroupDirectProduct, isCyclicFactorKeys, isGroupDihedral } from '../types'
import { compute3DPositions } from './layout3D'
import { parseProductFactors, matrixGridLayout, nestedFactorLayout2D, ringOrder, detectS3PermSet, S3_PERM_IDS } from './ringOrder'

// Re-export everything from submodules for backward compatibility
export {
  computeCayleyActionEdges, type ForceLayoutEdge, type ForceLayoutOptions,
} from './cayleyEdges'
export {
  computeCycleSubgroups, computeMaximalCycles, forceLayout, forceLayoutAsync, planarCycleLayout,
} from './cycleLayouts'
export type { PlanarCycleInput } from './cycleLayouts'
export {
  ringOrder, detectS3PermSet, S3_PERM_IDS, cayleyRingKeys, parseProductFactors,
  type ProductFactors, matrixGridLayout, nestedFactorLayout2D,
} from './ringOrder'

// ─── Public Entry Point ─────────────────────────────────────────────────

export function directProductGridLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  if (!isGroupDirectProduct(group)) return null

  const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

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
      const factors = parseProductFactors(group)
      if (!factors) return null
      return matrixGridLayout(factors.colSize, factors.rowSize, factors.getCol, factors.getRow, group, width, height)
    }
    return nestedFactorLayout2D(group, width, height)
  }

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

// ─── Element Order ─────────────────────────────────────────────────────────

export function computeElementOrder(el: GroupElement, group: Group): number {
  if (el.id === group.identity.id) return 1
  let current = el
  let ord = 0
  do {
    current = group.multiply(current, el)
    ord++
    if (ord > group.order) return group.order
  } while (current.id !== el.id)
  return ord
}

// ─── Concentric Layout (by conjugacy classes) ─────────────────────────

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
    // Fallback: plain circle. For S₃-as-permutations use the ring order so the
    // hexagon Cayley graph (generators (12),(23)) is drawn without crossings.
    const keys = group.elements.map(e => e.id)
    const s3Order = detectS3PermSet(keys) ? S3_PERM_IDS : null
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const r = Math.min(width, height) * 0.38
      const el = s3Order ? (group.elements.find(e => e.id === s3Order[i]) ?? group.elements[i]) : group.elements[i]
      result.set(el.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
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

// ─── Cayley Circle Layout (crossing-free for dihedral / S₃ structures) ──

/**
 * Single-circle Cayley layout that avoids edge crossings for the classic
 * dihedral structures:
 *
 * - D* groups (element value = [r, s] with s ∈ {0,1}): rotations on the outer
 *   ring, reflections on the inner ring. Each reflection is placed radially
 *   under its s-edge partner (multiply convention: r_j · s = s_j) so the
 *   spokes and both triangles never cross.
 * - S₃ as permutations: ring order gives the plain 6-cycle (generators
 *   (12), (23)) drawn as a crossing-free hexagon.
 * - Direct-product ids ('a|b'): factor-wise ring order (legacy behavior).
 * - Everything else: ring order on a single circle.
 */
export function cayleyCircleLayout(
  group: Group,
  cx: number,
  cy: number,
  radius: number
): Map<string, NodePosition> {
  const result = new Map<string, NodePosition>()
  const n = group.order
  if (n === 0) return result

  const angleAt = (idx: number) => (idx * 2 * Math.PI) / n - Math.PI / 2

  const isPipe = group.elements.length > 0 && group.elements[0].id.includes('|')
  if (isPipe) {
    const numFactors = group.elements[0].id.split('|').length
    const factorOrders: Map<string, number>[] = []
    for (let col = 0; col < numFactors; col++) {
      const keys = Array.from(new Set(group.elements.map(el => {
        const parts = el.id.split('|')
        return parts[col] ?? ''
      })))
      const ordered = ringOrder(keys)
      factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
    }
    const sorted = [...group.elements].sort((a, b) => {
      const pa = a.id.split('|')
      const pb = b.id.split('|')
      for (let col = 0; col < numFactors; col++) {
        const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
        const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
        if (ai !== bi) return ai - bi
      }
      return 0
    })
    sorted.forEach((el, i) => {
      const angle = angleAt(i)
      result.set(el.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    })
    return result
  }

  const rotations: GroupElement[] = []
  const reflections: GroupElement[] = []
  let dihedralLike = isGroupDihedral(group)
  if (dihedralLike) {
    for (const el of group.elements) {
      const v = el.value
      if (Array.isArray(v) && v.length >= 2 && (v[1] === 0 || v[1] === 1)) {
        if (v[1] === 0) rotations.push(el)
        else reflections.push(el)
      } else {
        dihedralLike = false
        break
      }
    }
  }
  if (dihedralLike && rotations.length > 0 && reflections.length > 0) {
    const m = rotations.length
    const outerR = radius
    const innerR = radius * 0.55
    const rotAngle = new Map<number, number>()
    for (const el of rotations) {
      const j = el.value[0] as number
      const angle = (j * 2 * Math.PI) / m - Math.PI / 2
      rotAngle.set(j, angle)
      result.set(el.id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
    }
    for (const ref of reflections) {
      const k = ref.value[0] as number
      const partner = k % m
      const angle = rotAngle.get(partner) ?? 0
      result.set(ref.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
    }
    return result
  }

  const keys = group.elements.map(e => e.id)
  const order = ringOrder(keys)
  const idxOf = new Map(order.map((k, i) => [k, i]))
  for (const el of group.elements) {
    const idx = idxOf.get(el.id)
    if (idx === undefined) continue
    const angle = angleAt(idx)
    result.set(el.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
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

// ─── 3D Projection Layout ──────────────────────────────────────────────

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

// ─── Semidirect Product Layout (rewiring shape) ─────────────────────────
//
// The "rewiring" shape shows the semidirect product G = N ⋊ H as |H| copies
// of the normal subgroup N arranged around a main ring of H elements.
// Every copy is drawn in the SAME natural element order (like the fixed
// ring of AutomorphismPreviewPopup), so each ring is a plain copy of N.
// The automorphisms φ(h) are shown as an overlay on the canvas: the
// generator edges inside ring h are the Cayley edges of N twisted by φ(h)
// (for D₄ = C₄ ⋊ C₂ the second copy's cycle runs in the opposite
// direction), φ(h)-fixed points are highlighted, and the x ↦ φ(x)
// rewiring wires are drawn as teal arcs between the affected elements.

export function semidirectProductLayout(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const sd = group._semidirectProduct
  if (!sd) return null
  const { normal: N, acting: H } = sd

  const cx = width / 2
  const cy = height / 2
  const minDim = Math.min(width, height)
  const rH = minDim * 0.26
  const rN = minDim * 0.11

  const hKeys = ringOrder(H.elements.map(e => e.id))
  const hIdxMap = new Map(hKeys.map((k, i) => [k, i]))
  const nKeys = ringOrder(N.elements.map(e => e.id))
  const nIdxMap = new Map(nKeys.map((k, i) => [k, i]))

  const result = new Map<string, NodePosition>()
  for (const h of H.elements) {
    const hIdx = hIdxMap.get(h.id) ?? 0
    const hAngle = (hIdx * 2 * Math.PI / H.order) - Math.PI / 2
    const hp = { x: cx + rH * Math.cos(hAngle), y: cy + rH * Math.sin(hAngle) }
    for (const n of N.elements) {
      const nIdx = nIdxMap.get(n.id) ?? 0
      const nAngle = (nIdx * 2 * Math.PI / N.order) - Math.PI / 2
      result.set(`${n.id}|${h.id}`, { x: hp.x + rN * Math.cos(nAngle), y: hp.y + rN * Math.sin(nAngle) })
    }
  }

  return result
}

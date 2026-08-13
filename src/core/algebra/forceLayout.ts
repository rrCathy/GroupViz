import type { Group, GroupElement, NodePosition, Layout3D } from '../types'
import { getDefaultLayout3D, isC2Cube, isGroupDirectProduct, isGroupDihedral, findRingGridDecomposition } from '../types'
import { compute3DPositions } from './layout3D'
import { getSemidirectProductMeta, semidirectFactorMap } from './semidirectDecompositions'
import { parseProductFactors, matrixGridLayout, ringOrder, detectS3PermSet, S3_PERM_IDS, factorPipeGroupsOrTokens, parseCompactFactors, clusterFactorGroups, clusterIsCyclic, factorPipeGroupsGrouped, powerRingOrder, tableFactorSearch } from './ringOrder'

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
  type ProductFactors, matrixGridLayout, nestedFactorLayout2D, factorPipeGroups,
  parseCompactFactors, type CompactFactorPart, clusterFactorGroups, tableGroupFactorSplit, clusterIsCyclic,
  factorPipeGroupsGrouped, type PipeFactorGrouped,
} from './ringOrder'

// ─── Public Entry Point ─────────────────────────────────────────────────

export function directProductGridLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  if (!isGroupDirectProduct(group)) return null
  const factors = parseProductFactors(group)
  if (!factors) return null
  return matrixGridLayout(factors.colSize, factors.rowSize, factors.getCol, factors.getRow, group, width, height)
}

// ─── Direct product factor subgroup ───────────────────────────────────

/**
 * 从直积群中提取第 factorIdx 个因子为独立临时 Group。
 * pipe 群：固定其他因子分量为 identity，因子乘法经 group.multiply 闭包后提取对应分量。
 * 注册表群（非 pipe）：按生成元交换性聚类划分因子，簇元素即因子元素。
 */
export function buildFactorSubgroup(group: Group, factorIdx: number): Group | null {
  const isPipe = group.elements[0]?.id.includes('|')
  if (!isPipe) {
    const idGroups = clusterFactorGroups(group)
    if (!idGroups) return null
    if (factorIdx < 0 || factorIdx >= idGroups.length) return null
    const ids = idGroups[factorIdx]
    const byId = new Map(group.elements.map(e => [e.id, e]))
    const factorEls = ids.map(id => byId.get(id)!)
    const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
      const prod = group.multiply(a, b)
      return byId.get(prod.id)!
    }
    const inverse = (el: GroupElement): GroupElement => byId.get(group.inverse(el).id)!
    const parts = parseCompactFactors(group.symbol)
    const factorName = parts[factorIdx]?.text ?? group.name
    return {
      name: factorName,
      symbol: factorName,
      order: factorEls.length,
      elements: factorEls,
      generators: [],
      multiply,
      inverse,
      identity: byId.get(group.identity.id)!,
      isAbelian: group.isAbelian
    }
  }

  const perEl = factorPipeGroupsOrTokens(group)
  if (!perEl) return null
  const factorCount = perEl[0].length
  if (factorIdx < 0 || factorIdx >= factorCount) return null

  const keyToEl = new Map<string, GroupElement>()
  const elToFactorKeys = new Map<string, string[]>()
  let identityKey = ''
  for (let i = 0; i < group.elements.length; i++) {
    const el = group.elements[i]
    const fk = perEl[i].map(g => g.join('|'))
    const key = fk[factorIdx]
    keyToEl.set(key, el)
    elToFactorKeys.set(el.id, fk)
    if (el.id === group.identity.id) identityKey = key
  }

  const factorKeys = Array.from(new Set(perEl.map(g => g[factorIdx].join('|'))))
  const keyToFactorEl = new Map<string, GroupElement>()
  const factorEls: GroupElement[] = factorKeys.map(k => {
    const src = keyToEl.get(k)!
    const el: GroupElement = { id: k, label: k, value: [...src.value] }
    keyToFactorEl.set(k, el)
    return el
  })

  const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
    const prod = group.multiply(keyToEl.get(a.id)!, keyToEl.get(b.id)!)
    const fk = elToFactorKeys.get(prod.id)![factorIdx]
    return keyToFactorEl.get(fk)!
  }
  const inverse = (el: GroupElement): GroupElement => {
    const inv = group.inverse(keyToEl.get(el.id)!)
    const fk = elToFactorKeys.get(inv.id)![factorIdx]
    return keyToFactorEl.get(fk)!
  }

  const parts = parseCompactFactors(group.symbol)
  const factorName = parts[factorIdx]?.text ?? group.name

  return {
    name: factorName,
    symbol: factorName,
    order: factorKeys.length,
    elements: factorEls,
    generators: [],
    multiply,
    inverse,
    identity: keyToFactorEl.get(identityKey)!,
    isAbelian: group.isAbelian
  }
}

/**
 * 布局归一化：平移至原点并按最大半宽/半高缩放到单位圆，返回单位坐标与半径。
 */
export function normalizeLayout2D(
  pos: Map<string, NodePosition>
): { unit: Map<string, NodePosition>; radius: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!isFinite(minX)) return { unit: pos, radius: 1 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radius = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1e-6)
  const unit = new Map<string, NodePosition>()
  for (const [id, p] of pos) unit.set(id, { x: (p.x - cx) / radius, y: (p.y - cy) / radius })
  return { unit, radius }
}

// ─── Factor copy ring (unit) ───────────────────────────────────────────

/**
 * 因子副本的单位环布局：Dₙ 因子（id 形如 r0…r_{n-1}/s0…s_{n-1}）→ 双环
 * （外环旋转 r=1、内环反射 r=0.55，同位角），其余按 ringOrder 单环。
 * 仅依赖元素 id，不依赖直积拼接的 value 分量。
 */
export function factorCopyRingLayout(tmp: Group): Map<string, NodePosition> {
  const keys = tmp.elements.map(e => e.id)
  const rots = keys.filter(k => /^r\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const refs = keys.filter(k => /^s\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const result = new Map<string, NodePosition>()
  if (rots.length > 0 && refs.length === rots.length) {
    const m = rots.length
    rots.forEach((k, i) => {
      const a = (i * 2 * Math.PI) / m - Math.PI / 2
      result.set(k, { x: Math.cos(a), y: Math.sin(a) })
      result.set(refs[i], { x: 0.55 * Math.cos(a), y: 0.55 * Math.sin(a) })
    })
  } else {
    const ordered = ringOrder(keys)
    const n = Math.max(keys.length, 1)
    ordered.forEach((k, i) => {
      const a = (i * 2 * Math.PI) / n - Math.PI / 2
      result.set(k, { x: Math.cos(a), y: Math.sin(a) })
    })
  }
  return result
}

// ─── Cylinder layout 2D (concentric factor copies) ────────────────────

/**
 * 交错同心圆（内部标识 cylinder）：同心多环——每层圆 = 非循环因子 Xₙ 的
 * 副本结构（Dₙ 副本即双环；S₃/D₃ 副本即凯莱六边形）；层数 = 循环因子
 * Cₙ 的阶，相邻层按副本点距半格交错（offset = layerIdx·π/copyN），
 * Cₙ 生成元边 = 层间斜线（交错感，俯视如交错同心圆）。
 * pipe 群按符号因子分组；注册表群（非 pipe）按生成元交换性聚类分组。
 */
export function cylinderLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const isPipe = group.elements[0]?.id.includes('|')
  if (!isPipe) {
    let clusters = clusterFactorGroups(group)
    if (clusters) {
      const hasCyc = clusters.some(c => clusterIsCyclic(group, c))
      const hasNonCyc = clusters.some(c => !clusterIsCyclic(group, c))
      if (!hasCyc || !hasNonCyc) clusters = null
    }
    if (!clusters) clusters = tableFactorSearch(group)
    if (!clusters) return null
    const byId = new Map(group.elements.map(e => [e.id, e]))
    const cycClusters = clusters.filter(c => clusterIsCyclic(group, c))
    const nonCycClusters = clusters.filter(c => !clusterIsCyclic(group, c))
    if (cycClusters.length === 0 || nonCycClusters.length === 0) return null

    // 层 = 循环簇的笛卡尔积组合；副本 = 非循环簇合并
    const combos: string[][] = [[]]
    for (const c of cycClusters) {
      const next: string[][] = []
      for (const combo of combos) for (const id of c) next.push([...combo, id])
      combos.splice(0, combos.length, ...next)
    }
    const nonEls = nonCycClusters.flat().map(id => byId.get(id)!)
    const pseudoEls = nonEls.map(e => ({ ...e }))
    const copy = factorCopyRingLayout({ elements: pseudoEls } as Group)
    const seen = new Map<string, { layerIdx: number; nonId: string }>()
    for (let ci = 0; ci < combos.length; ci++) {
      let comboEl = group.identity
      for (const id of combos[ci]) comboEl = group.multiply(comboEl, byId.get(id)!)
      for (const nonEl of nonEls) {
        const el = group.multiply(comboEl, nonEl)
        seen.set(el.id, { layerIdx: ci, nonId: nonEl.id })
      }
    }
    if (seen.size !== group.elements.length) return null

    const step = 2.4
    const outerR = 1.1 + (combos.length - 1) * step
    const scale = (Math.min(width, height) * 0.35) / outerR
    const cx = width / 2
    const cy = height / 2

    const result = new Map<string, NodePosition>()
    const copyN = Math.max(nonEls.length, 1)
    for (const el of group.elements) {
      const s = seen.get(el.id)!
      const layerIdx = s.layerIdx
      const uv = copy.get(s.nonId) ?? { x: 0, y: 0 }
      const mag = Math.hypot(uv.x, uv.y) || 1
      const angle = Math.atan2(uv.y, uv.x) + layerIdx * (Math.PI / copyN)
      const r = (1.1 + layerIdx * step) * mag
      result.set(el.id, {
        x: cx + r * Math.cos(angle) * scale,
        y: cy + r * Math.sin(angle) * scale
      })
    }
    return result
  }

  const grouped = factorPipeGroupsGrouped(group)
  if (!grouped || grouped.count < 2) return null
  const perEl = grouped.perEl
  const cycIdxs = grouped.cyclic.map((c, i) => (c ? i : -1)).filter(i => i >= 0)
  if (cycIdxs.length === 0) return null
  const nonCycIdxs = grouped.cyclic.map((_, i) => i).filter(i => !grouped.cyclic[i])
  if (nonCycIdxs.length === 0) return null

  // 层 = 各循环归组因子 distinct key 的笛卡尔积组合
  const cycKeySets = cycIdxs.map(idx => Array.from(new Set(perEl.map(g => g[idx].join('|')))))
  const combos: string[][] = [[]]
  for (const ks of cycKeySets) {
    const next: string[][] = []
    for (const combo of combos) for (const k of ks) next.push([...combo, k])
    combos.splice(0, combos.length, ...next)
  }
  const layerIdxMap = new Map(combos.map((c, i) => [c.join('~'), i]))
  const layerCount = combos.length

  // 副本：单非循环归组因子走 buildFactorSubgroup（保留 Dₙ 双环），多组用组合 key 伪元素
  let copy: Map<string, NodePosition>
  if (nonCycIdxs.length === 1) {
    const tmp = buildFactorSubgroup(group, grouped.offsets[nonCycIdxs[0]])
    if (!tmp) return null
    copy = factorCopyRingLayout(tmp)
  } else {
    const nonKeySet = Array.from(
      new Set(perEl.map(g => nonCycIdxs.map(idx => g[idx].join('|')).join('~')))
    )
    const pseudoEls = nonKeySet.map(k => ({ id: k, label: k, value: [] as number[] }))
    copy = factorCopyRingLayout({ elements: pseudoEls } as Group)
  }

  const step = 2.4
  const outerR = 1.1 + (layerCount - 1) * step
  const scale = (Math.min(width, height) * 0.35) / outerR
  const cx = width / 2
  const cy = height / 2

  const result = new Map<string, NodePosition>()
  const copyN = Math.max(copy.size, 1)
  for (let i = 0; i < group.elements.length; i++) {
    const el = group.elements[i]
    const g = perEl[i]
    const layerKey = cycIdxs.map(idx => g[idx].join('|')).join('~')
    const nonKey = nonCycIdxs.map(idx => g[idx].join('|')).join('~')
    const layerIdx = layerIdxMap.get(layerKey) ?? 0
    const uv = copy.get(nonKey) ?? { x: 0, y: 0 }
    const mag = Math.hypot(uv.x, uv.y) || 1
    const angle = Math.atan2(uv.y, uv.x) + layerIdx * (Math.PI / copyN)
    const r = (1.1 + layerIdx * step) * mag
    result.set(el.id, {
      x: cx + r * Math.cos(angle) * scale,
      y: cy + r * Math.sin(angle) * scale
    })
  }
  return result
}

// ─── Ring-grid layout 2D (cyclic ring × elementary grid) ──────────────

/**
 * 环网格 2D 形态（C₄×C₂×C₂ 类直积）：群的循环部分（阶 n ≥ 4 的环生成元 x）
 * 做 n 边形环（幂序环绕，顶部起始），其余部分 V = {e, v1, v2, v1v2}（初等
 * 交换 4 群）做 2×2 混合进制网格，每个格点中心挂一个完整环。
 * 环上相邻点 = x 幂真实边；网格邻格 = v1/v2 真实边。
 * 依托 findRingGridDecomposition（纯群论探测）：pipe 直积群、注册表 GAP
 * 表群、同构群统一走同一条路。
 */
export function ringGridLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const dec = findRingGridDecomposition(group)
  if (!dec) return null
  const { v1, v2, n, map } = dec
  const cols = 2
  const rows = 2
  // 坐标基底：e→(0,0)、v1→(1,0)、v2→(0,1)、v1v2→(1,1)
  const v12 = group.multiply(v1, v2)
  const idxOf = new Map<string, number>([
    [group.identity.id, 0],
    [v1.id, 1],
    [v2.id, 2],
    [v12.id, 3],
  ])
  const r = Math.max(1.0, n * 0.18)
  const gap = 0.9
  const d = 2 * r + gap
  const spanX = (cols - 1) * d + 2 * r
  const spanY = (rows - 1) * d + 2 * r
  const scale = (Math.min(width, height) * 0.78) / Math.max(spanX, spanY, 1e-6)
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()
  for (const el of group.elements) {
    const hit = map.get(el.id)
    if (!hit) return null
    const idx = idxOf.get(hit.v.id)
    if (idx === undefined) return null
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const gx = (col - (cols - 1) / 2) * d
    const gy = (row - (rows - 1) / 2) * d
    const ang = (hit.i * 2 * Math.PI) / n - Math.PI / 2
    result.set(el.id, {
      x: cx + (gx + r * Math.cos(ang)) * scale,
      y: cy + (gy + r * Math.sin(ang)) * scale,
    })
  }
  return result
}

// ─── Torus layout 2D (factor copies hung on a main ring) ──────────────

/**
 * 甜甜圈 2D 形态 = 主轴环 + 每点挂其余因子的副本（嵌套：每层环以
 * 上一层环点为圆心，半径按相邻点弧长收缩）。
 * pipe 群按归组因子（factorPipeGroupsGrouped，C2×C2→C2² 视为单因子）；
 * 注册表群按生成元交换性聚类，笛卡尔分解校验唯一性。
 */
export function torusLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const isPipe = group.elements[0]?.id.includes('|')

  let unitRings: Map<string, NodePosition>[] | null = null
  let perElKeys: string[][] | null = null

  if (isPipe) {
    const grouped = factorPipeGroupsGrouped(group)
    if (grouped && grouped.count >= 2) {
      unitRings = []
      for (let i = 0; i < grouped.count; i++) {
        const keys = Array.from(new Set(grouped.perEl.map(g => g[i].join('|'))))
        const pseudoEls = keys.map(k => ({ id: k, label: k, value: [] as number[] }))
        unitRings.push(factorCopyRingLayout({ elements: pseudoEls } as Group))
      }
      perElKeys = grouped.perEl.map(g => g.map(gr => gr.join('|')))
    } else {
      const perEl = factorPipeGroupsOrTokens(group)
      if (!perEl || perEl[0].length !== 2) return null
      const A = buildFactorSubgroup(group, 0)
      const B = buildFactorSubgroup(group, 1)
      if (!A || !B) return null
      unitRings = [factorCopyRingLayout(A), factorCopyRingLayout(B)]
      perElKeys = perEl.map(g => g.map(gr => gr.join('|')))
    }
  } else {
    let clusters = clusterFactorGroups(group)
    if (!clusters || clusters.length < 2) clusters = tableFactorSearch(group)
    if (!clusters || clusters.length < 2) return null
    const byId = new Map(group.elements.map(e => [e.id, e]))
    // 笛卡尔枚举分解：每元素 = 各簇元素之积，唯一性校验
    const combos: string[][] = [[]]
    for (const c of clusters) {
      const next: string[][] = []
      for (const combo of combos) for (const id of c) next.push([...combo, id])
      combos.splice(0, combos.length, ...next)
    }
    const comboToEl = new Map<string, GroupElement>()
    for (const combo of combos) {
      let el = group.identity
      for (const id of combo) el = group.multiply(el, byId.get(id)!)
      comboToEl.set(combo.join('~'), el)
    }
    if (comboToEl.size !== group.elements.length) return null
    const elToCombo = new Map<string, string[]>()
    for (const [ck, el] of comboToEl) elToCombo.set(el.id, ck.split('~'))
    const keys: string[][] = []
    for (const el of group.elements) {
      const combo = elToCombo.get(el.id)
      if (!combo) return null
      keys.push(combo)
    }
    unitRings = clusters.map(c => {
      const pseudoEls = c.map(id => ({ id, label: id, value: [] as number[] }))
      return factorCopyRingLayout({ elements: pseudoEls } as Group)
    })
    perElKeys = keys
  }

  return nestedTorusPlacement(group, unitRings, perElKeys, width, height)
}

/**
 * 嵌套甜甜圈放置：第 d 层环半径按上一层相邻点弧长收缩，
 * 每元素 = 各层环点向量加权和（2 因子时退化为经典 torus）。
 */
function nestedTorusPlacement(
  group: Group,
  unitRings: Map<string, NodePosition>[],
  perElKeys: string[][],
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const k = unitRings.length
  if (k < 2 || perElKeys.length !== group.elements.length || perElKeys[0].length !== k) {
    return null
  }
  const radii: number[] = [Math.min(width, height) * 0.32]
  for (let d = 1; d < k; d++) {
    const m = Math.max(unitRings[d - 1].size, 1)
    const arc = 2 * radii[d - 1] * Math.sin(Math.PI / m)
    radii.push(Math.max(radii[d - 1] * 0.05, Math.min(arc * 0.32, radii[d - 1] * 0.24)))
  }
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()
  for (let i = 0; i < group.elements.length; i++) {
    const el = group.elements[i]
    const keys = perElKeys[i]
    let x = 0
    let y = 0
    for (let d = 0; d < k; d++) {
      const uv = unitRings[d].get(keys[d]) ?? { x: 0, y: 0 }
      x += uv.x * radii[d]
      y += uv.y * radii[d]
    }
    result.set(el.id, { x: cx + x, y: cy + y })
  }
  return result
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

/**
 * C₂³ as a D₄-style dual ring: outer square {e, a, ab, b} (generator-power
 * order) with the inner ring {·c} at the same angles. Returns null when the
 * generators do not produce a clean 4+4 split.
 */
function c2CubeDualRing(
  group: Group,
  width: number,
  height: number
): Map<string, NodePosition> | null {
  const cx = width / 2
  const cy = height / 2
  const result = new Map<string, NodePosition>()
  const identity = group.identity
  const gens = group.generators
    .map((g) => g.apply(identity))
    .filter((el) => el.id !== identity.id)
  if (gens.length < 3) return null
  const [a, b, c] = gens
  const ab = group.multiply(a, b)
  const outer = [identity, a, ab, b]
  const inner = outer.map((el) => group.multiply(el, c))
  if (outer.some((el) => !el) || inner.some((el) => !el)) return null
  const ids = new Set([...outer.map((el) => el.id), ...inner.map((el) => el.id)])
  if (ids.size !== group.order) return null
  const outerR = Math.min(width, height) * 0.38
  const innerR = outerR * 0.55
  for (let i = 0; i < 4; i++) {
    const angle = (i * 2 * Math.PI) / 4 - Math.PI / 2
    result.set(outer[i].id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
    result.set(inner[i].id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
  }
  return result
}

/**
 * 不依赖 value 格式的旋转/反射分类（D_m 结构，含注册表群 value=[k]）：
 * 找阶 m 元素 r（m = |G|/2）→ rotations = ⟨r⟩ 幂序 [e, r, r², …]；
 * reflections = 其余元素，反射 s_i 与旋转 r^i 同角配对（s_i = r^i · s₀）。
 * 找不到阶 m 元素、或反射数 ≠ m → null（由调用方回退）。
 */
export function splitDihedralElements(group: Group): {
  rotations: GroupElement[]
  reflectPair: Map<string, number>
} | null {
  const n = group.order
  const m = n / 2
  if (n % 2 !== 0 || m < 2) return null
  const id = group.identity

  for (const el of group.elements) {
    if (el.id === id.id) continue
    const powers: GroupElement[] = [id, el]
    const seen = new Set([id.id, el.id])
    let cur = el
    let closed = false
    for (;;) {
      cur = group.multiply(cur, el)
      if (cur.id === id.id) { closed = true; break }
      if (seen.has(cur.id)) break
      seen.add(cur.id)
      powers.push(cur)
    }
    if (!closed || powers.length !== m) continue
    const rotIds = new Set(powers.map(e => e.id))
    const refs = group.elements.filter(e => !rotIds.has(e.id))
    if (refs.length !== m) continue
    const s0 = refs[0]
    const reflectPair = new Map<string, number>()
    let pairOk = true
    for (let i = 0; i < m; i++) {
      const s_i = group.multiply(powers[i], s0)
      if (rotIds.has(s_i.id) || reflectPair.has(s_i.id)) { pairOk = false; break }
      reflectPair.set(s_i.id, i)
    }
    if (pairOk && reflectPair.size === m) {
      return { rotations: powers, reflectPair }
    }
  }
  return null
}

// 二面体蛇形环序：rotations 幂序正排 + reflections 按配对角反排，
// 摊平为单环（外圈旋转升序 → 内圈反射降序），使生成元边外环相邻、反射边径向。
// 用于半直积布局的 N 盘内环序（注册表群 N 无 pipe id，powerRingOrder 不特判）。
export function dihedralSnakeOrder(group: Group): string[] | null {
  const split = splitDihedralElements(group)
  if (!split) return null
  const refsDesc = Array.from(split.reflectPair.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  return [...split.rotations.map(e => e.id), ...refsDesc]
}

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

  // C₂³（阶 8 基本阿贝尔群）：大正方形套小正方形（D₄ 双环）。
  // 必须优先于 value 分支——pipe 直积群的 value 分支按 value[0] 排序环序，
  // 会把 ⟨a,c⟩ 摆成 [e,c,a,ac]，c→a 与 ac→e 为穿心对角弦（非真实边），
  // 横穿内方造成交叉；c2CubeDualRing 用交替生成元环序 [e,a,ab,b]，
  // 四边全为真实生成元边（信步无交叉），内方 = 外方·分隔生成元（径向连线）。
  if (isC2Cube(group)) {
    const cube = c2CubeDualRing(group, width, height)
    if (cube) return cube
  }

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
    // 注册表二面体群等 value=[k] 一维元素：按元素阶分类旋转/反射
    const split = splitDihedralElements(group)
    if (split) {
      const { rotations: rots, reflectPair } = split
      const cnt = rots.length
      const outerR = Math.min(width, height) * 0.38
      const innerR = outerR * 0.55
      for (let i = 0; i < cnt; i++) {
        const angle = (i * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(rots[i].id, { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) })
      }
      for (const [refId, ri] of reflectPair) {
        const angle = (ri * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(refId, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
      }
      return result
    }
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

  // 注册表二面体群等 value=[k] 一维元素：按元素阶分类旋转/反射（双环免交叉）
  if (dihedralLike) {
    const split = splitDihedralElements(group)
    if (split) {
      const cnt = split.rotations.length
      const innerR = radius * 0.55
      for (let i = 0; i < cnt; i++) {
        const angle = (i * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(split.rotations[i].id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
      }
      for (const [refId, ri] of split.reflectPair) {
        const angle = (ri * 2 * Math.PI) / cnt - Math.PI / 2
        result.set(refId, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) })
      }
      return result
    }
  }

  const keys = group.elements.map(e => e.id)
  const order = keys.every(k => /^[eg]\d+$/.test(k)) ? powerRingOrder(group) : ringOrder(keys)
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

  // r ∝ √t and θ ∝ √t keep arc lengths between consecutive points even
  // (Archimedean spiral with uniform spacing), so large cycles like C16
  // do not pile up inside and stretch apart outside.
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const sq = Math.sqrt(t)
    const r = maxR * sq
    const theta = sq * turns * 2 * Math.PI

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
    const nIdx = nIdxMap.get(f.n.id) ?? 0
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

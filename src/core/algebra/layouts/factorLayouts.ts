import type { Group, GroupElement, NodePosition } from '../../types'
import { isGroupDirectProduct, findRingGridDecomposition } from '../../types'
import {
  parseProductFactors, matrixGridLayout, ringOrder, parseCompactFactors,
  clusterFactorGroups, clusterIsCyclic, factorPipeGroupsOrTokens,
  factorPipeGroupsGrouped, tableFactorSearch,
} from '../ringOrder'

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
 * 环网格 2D 形态（C₄×C₂×C₂ / C₃³ 类直积）：群的循环部分（阶 n ≥ 3 的环生成元 x）
 * 做 n 边形环（幂序环绕，顶部起始），其余部分 V = C_p²（p ∈ {2,3} 素数网格，v1、
 * v2 为相异阶 p 元素）做 p×p 混合进制网格，每个格点中心挂一个完整环。
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
  const p = dec.p ?? 2
  const cols = p
  const rows = p
  // 坐标基底：idx = j*p + i（v1 幂为列、v2 幂为行）；p=2 时与原排列
  // e→(0,0)、v1→(1,0)、v2→(0,1)、v1v2→(1,1) 完全一致
  const idxOf = new Map<string, number>()
  for (let i = 0; i < p; i++) {
    let rowEl = group.identity
    for (let k = 0; k < i; k++) rowEl = group.multiply(rowEl, v1)
    for (let j = 0; j < p; j++) {
      let el = rowEl
      for (let k = 0; k < j; k++) el = group.multiply(el, v2)
      idxOf.set(el.id, j * p + i)
    }
  }
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

import type { Group, GroupElement } from '../../types'
import {
  ringOrder,
  factorPipeGroupsGrouped, clusterFactorGroups, clusterIsCyclic,
  tableFactorSearch,
} from '../ringOrder'
import { fibonacciSphere, type Vec3 } from './shared'

/**
 * 因子副本的单位环（2D factorCopyRingLayout 的 3D 对应）：Dₙ 因子（id 形如
 * r0…r_{n-1}/s0…s_{n-1}）→ 双环（外环 r=1 旋转、内环 r=0.55 反射同位角），
 * 其余按 ringOrder 单环。返回 (x, z) 平面单位坐标。
 */
function factorCopyRing3D(tmp: { elements: { id: string }[] }): Map<string, [number, number]> {
  const keys = tmp.elements.map(e => e.id)
  const rots = keys.filter(k => /^r\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const refs = keys.filter(k => /^s\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const result = new Map<string, [number, number]>()
  if (rots.length > 0 && refs.length === rots.length) {
    const m = rots.length
    rots.forEach((k, i) => {
      const a = (i * 2 * Math.PI) / m - Math.PI / 2
      result.set(k, [Math.cos(a), Math.sin(a)])
      result.set(refs[i], [0.55 * Math.cos(a), 0.55 * Math.sin(a)])
    })
  } else {
    const ordered = ringOrder(keys)
    const cnt = Math.max(keys.length, 1)
    ordered.forEach((k, i) => {
      const a = (i * 2 * Math.PI) / cnt - Math.PI / 2
      result.set(k, [Math.cos(a), Math.sin(a)])
    })
  }
  return result
}

/**
 * 组合下标 → 轴内混合进制索引（低位 = 靠前因子）。
 * 用于表群 lattice：把因子/生成元组合下标投影到 3 轴中的某一轴。
 */
function mixedAxisIndex(
  idx: number,
  sizes: number[],
  axis: { indices: number[] }
): number {
  if (!axis.indices.length) return 0
  const bases: number[] = new Array(sizes.length)
  let b = 1
  for (let c = sizes.length - 1; c >= 0; c--) {
    bases[c] = b
    b *= sizes[c]
  }
  let out = 0
  for (let t = 0; t < axis.indices.length; t++) {
    const c = axis.indices[t]
    const ci = Math.floor(idx / bases[c]) % sizes[c]
    let base = 1
    for (let u = t + 1; u < axis.indices.length; u++) base *= sizes[axis.indices[u]]
    out += ci * base
  }
  return out
}

/**
 * 甜甜圈 3D 放置：k=2 因子 → 经典环面（主轴环 + 竖直小环）；
 * k>2 因子 → 嵌套环（第 d 层环含于上一层点所在的竖直平面，半径按弧长收缩，
 * 推广 2D nestedTorusPlacement 到 3D，退化为经典环面参数式）。
 */
function placeTorusRings(
  group: Group,
  unitRings: Map<string, [number, number]>[],
  perElKeys: string[][],
  radius: number
): Vec3[] | null {
  const k = unitRings.length
  if (k < 2 || perElKeys.length !== group.elements.length || perElKeys[0].length !== k) {
    return null
  }
  const out: Vec3[] = new Array(group.elements.length)
  if (k === 2) {
    const m0 = Math.max(unitRings[0].size, 1)
    const m1 = Math.max(unitRings[1].size, 1)
    const major = Math.max(radius * 0.9, Math.min(radius * 1.2, m0 * 0.6))
    const minor = Math.max(radius * 0.35, Math.min(radius * 0.6, m1 * 0.28))
    for (let i = 0; i < group.elements.length; i++) {
      const keys = perElKeys[i]
      const uv0 = unitRings[0].get(keys[0]) ?? [1, 0]
      const uv1 = unitRings[1].get(keys[1]) ?? [0, 0]
      const a = Math.atan2(uv0[1], uv0[0])
      const b = Math.atan2(uv1[1], uv1[0])
      const x = (major + minor * Math.cos(b)) * Math.cos(a)
      const y = minor * Math.sin(b)
      const z = (major + minor * Math.cos(b)) * Math.sin(a)
      out[i] = [x, y, z]
    }
    return out
  }

  const radii: number[] = [Math.max(radius * 0.9, Math.min(radius * 1.2, Math.max(1, unitRings[0].size) * 0.6))]
  for (let d = 1; d < k; d++) {
    const m = Math.max(unitRings[d - 1].size, 1)
    const arc = 2 * radii[d - 1] * Math.sin(Math.PI / m)
    radii.push(Math.max(radii[d - 1] * 0.05, Math.min(arc * 0.32, radii[d - 1] * 0.24)))
  }
  for (let i = 0; i < group.elements.length; i++) {
    const keys = perElKeys[i]
    const uv0 = unitRings[0].get(keys[0]) ?? [1, 0]
    const a = Math.atan2(uv0[1], uv0[0])
    let px = 0
    let py = 0
    for (let d = 1; d < k; d++) {
      const uv = unitRings[d].get(keys[d]) ?? [0, 0]
      px += uv[0] * radii[d]
      py += uv[1] * radii[d]
    }
    const r = radii[0] + px
    out[i] = [r * Math.cos(a), py, r * Math.sin(a)]
  }
  return out
}

export function latticeLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  const positions: Vec3[] = new Array(n)
  if (n === 0) return null

  const vals = group.elements.map(el => el.value || [])
  const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

  const partitionFactors = (sizes: number[]) => {
    const axisGroups: { indices: number[]; prod: number; id: number }[] = [
      { indices: [], prod: 1, id: 0 },
      { indices: [], prod: 1, id: 1 },
      { indices: [], prod: 1, id: 2 }
    ]
    const idxs = sizes.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i).map(o => o.i)
    for (const fi of idxs) {
      let target = 0
      for (let j = 1; j < axisGroups.length; j++) {
        const aj = axisGroups[j]
        const at = axisGroups[target]
        if (aj.prod < at.prod || (aj.prod === at.prod && aj.id < at.id)) target = j
      }
      axisGroups[target].indices.push(fi)
      axisGroups[target].prod *= Math.max(1, sizes[fi])
    }
    return axisGroups
  }

  if (isPipeProduct) {
    const tokenLists = group.elements.map(el => el.id.split('|'))
    const maxTokens = Math.max(...tokenLists.map(t => t.length))
    const tokenKeys: string[][] = []
    for (let j = 0; j < maxTokens; j++) {
      tokenKeys.push(Array.from(new Set(tokenLists.map(t => t[j] ?? ''))))
    }
    const sizes = tokenKeys.map(k => k.length)
    if (sizes.length === 0) {
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      return positions
    }

    const axisGroups = partitionFactors(sizes)
    // 因子轴内按 ringOrder（S₃ 置换 → 六边形序、gN/eN → 数字序、位向量特判），
    // 使生成元边在轴内相邻（2D 网格同策略）
    const tokenMaps = tokenKeys.map(arr => new Map(ringOrder(arr).map((k, i) => [k, i])))

    const sizeX = Math.max(1, axisGroups[0].prod)
    const sizeY = Math.max(1, axisGroups[1].prod)
    const sizeZ = Math.max(1, axisGroups[2].prod)
    const spacing = Math.max(0.9, radius * 0.36)
    const halfX = (sizeX - 1) * spacing / 2
    const halfY = (sizeY - 1) * spacing / 2
    const halfZ = (sizeZ - 1) * spacing / 2

    const computeMixedIndex = (tokens: string[], groupIdx: number) => {
      const g = axisGroups[groupIdx]
      if (!g.indices.length) return 0
      let idx = 0
      for (let t = 0; t < g.indices.length; t++) {
        const fi = g.indices[t]
        const key = tokens[fi] ?? ''
        const val = tokenMaps[fi].get(key) ?? 0
        let base = 1
        for (let u = t + 1; u < g.indices.length; u++) base *= tokenMaps[g.indices[u]].size
        idx += val * base
      }
      return idx
    }

    for (let i = 0; i < n; i++) {
      const toks = group.elements[i].id.split('|')
      const ix = computeMixedIndex(toks, 0)
      const iy = computeMixedIndex(toks, 1)
      const iz = computeMixedIndex(toks, 2)
      const x = ix * spacing - halfX
      const y = iy * spacing - halfY
      const z = iz * spacing - halfZ
      const ang = Math.PI / 12
      const cosA = Math.cos(ang)
      const sinA = Math.sin(ang)
      const rx = x * cosA - z * sinA
      const rz = x * sinA + z * cosA
      positions[i] = [rx, y, rz]
    }
    return positions
  }

  const dim = vals[0]?.length || 0
  if (dim < 2) {
    // 注册表表群（value 单维 [k]）——旧实现把 16 个不同 value 值当 1 个因子，
    // 全放一根轴 → 退化成一条直线。修复（对应 2D grid 的 tableGroupGridFactors）：
    // 1) 生成元交换性聚类分轴（tableFactorSearch 兜底）；
    // 2) 聚类失败 → 独立生成元幂组合枚举（C₂⁴ → 4×2×2 长方体、C₄×C₄ → 4×4 平面）；
    // 3) 再失败 → 球面。
    let placed = false

    const placeByClusters = (): boolean => {
      let clusters = Array.isArray(group.generators) && group.generators.length >= 2
        ? clusterFactorGroups(group)
        : null
      if (!clusters || clusters.length < 2) clusters = tableFactorSearch(group)
      if (!clusters || clusters.length < 2) return false
      const byId = new Map(group.elements.map(e => [e.id, e]))
      const lists = clusters.map(ids => ids.map(id => byId.get(id)!))
      const sizes = lists.map(l => l.length)
      const axisGroups = partitionFactors(sizes)
      const spacing = Math.max(0.9, radius * 0.36)
      const sizeX = Math.max(1, axisGroups[0].prod)
      const sizeY = Math.max(1, axisGroups[1].prod)
      const sizeZ = Math.max(1, axisGroups[2].prod)
      const halfX = (sizeX - 1) * spacing / 2
      const halfY = (sizeY - 1) * spacing / 2
      const halfZ = (sizeZ - 1) * spacing / 2
      const byElIdx = new Map(group.elements.map((e, i) => [e.id, i]))
      const seen = new Set<string>()
      const total = sizes.reduce((a, b) => a * b, 1)
      if (total !== group.elements.length) return false
      const ang = Math.PI / 12
      const cosA = Math.cos(ang)
      const sinA = Math.sin(ang)
      for (let idx = 0; idx < total; idx++) {
        let el = group.identity
        let rem = idx
        for (let c = 0; c < lists.length; c++) {
          const ci = rem % lists[c].length
          rem = Math.floor(rem / lists[c].length)
          el = group.multiply(el, lists[c][ci])
        }
        if (seen.has(el.id)) return false
        seen.add(el.id)
        const ei = byElIdx.get(el.id)
        if (ei === undefined) continue
        const x = mixedAxisIndex(idx, sizes, axisGroups[0]) * spacing - halfX
        const y = mixedAxisIndex(idx, sizes, axisGroups[1]) * spacing - halfY
        const z = mixedAxisIndex(idx, sizes, axisGroups[2]) * spacing - halfZ
        positions[ei] = [x * cosA - z * sinA, y, x * sinA + z * cosA]
      }
      return seen.size === group.elements.length
    }

    const placeByGenPowers = (): boolean => {
      const genEls = (group.generators ?? [])
        .map(g => g.apply(group.identity))
        .filter(g => g.id !== group.identity.id)
      if (genEls.length < 2) return false
      const orders = genEls.map(g => {
        let cur = g
        let o = 1
        while (group.multiply(cur, g).id !== g.id) {
          cur = group.multiply(cur, g)
          o++
        }
        return o
      })
      const total = orders.reduce((a, b) => a * b, 1)
      if (total !== group.elements.length) return false
      const axisGroups = partitionFactors(orders)
      const spacing = Math.max(0.9, radius * 0.36)
      const sizeX = Math.max(1, axisGroups[0].prod)
      const sizeY = Math.max(1, axisGroups[1].prod)
      const sizeZ = Math.max(1, axisGroups[2].prod)
      const halfX = (sizeX - 1) * spacing / 2
      const halfY = (sizeY - 1) * spacing / 2
      const halfZ = (sizeZ - 1) * spacing / 2
      const byElIdx = new Map(group.elements.map((e, i) => [e.id, i]))
      const seen = new Set<string>()
      const ang = Math.PI / 12
      const cosA = Math.cos(ang)
      const sinA = Math.sin(ang)
      for (let idx = 0; idx < total; idx++) {
        let el = group.identity
        let rem = idx
        for (let g = 0; g < genEls.length; g++) {
          const k = rem % orders[g]
          rem = Math.floor(rem / orders[g])
          for (let p = 0; p < k; p++) el = group.multiply(el, genEls[g])
        }
        if (seen.has(el.id)) return false
        seen.add(el.id)
        const ei = byElIdx.get(el.id)
        if (ei === undefined) continue
        const x = mixedAxisIndex(idx, orders, axisGroups[0]) * spacing - halfX
        const y = mixedAxisIndex(idx, orders, axisGroups[1]) * spacing - halfY
        const z = mixedAxisIndex(idx, orders, axisGroups[2]) * spacing - halfZ
        positions[ei] = [x * cosA - z * sinA, y, x * sinA + z * cosA]
      }
      return seen.size === group.elements.length
    }

    placed = placeByClusters() || placeByGenPowers()
    if (!placed) {
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    }
    return positions
  }

  const valueKeys: number[][] = []
  for (let d = 0; d < dim; d++) {
    const keys = Array.from(new Set(vals.map(v => v[d] ?? 0)))
    keys.sort((a, b) => Number(a) - Number(b))
    valueKeys.push(keys)
  }
  const sizes = valueKeys.map(k => k.length)
  const axisGroups = partitionFactors(sizes)
  const valueMaps = valueKeys.map(arr => new Map(arr.map((k, i) => [k, i])))
  const sizeX = Math.max(1, axisGroups[0].prod)
  const sizeY = Math.max(1, axisGroups[1].prod)
  const sizeZ = Math.max(1, axisGroups[2].prod)
  const spacing = Math.max(0.9, radius * 0.36)
  const halfX = (sizeX - 1) * spacing / 2
  const halfY = (sizeY - 1) * spacing / 2
  const halfZ = (sizeZ - 1) * spacing / 2

  const computeMixedIndexVals = (vec: number[], groupIdx: number) => {
    const g = axisGroups[groupIdx]
    if (!g.indices.length) return 0
    let idx = 0
    for (let t = 0; t < g.indices.length; t++) {
      const fi = g.indices[t]
      const raw = vec[fi] ?? 0
      const val = valueMaps[fi].get(raw) ?? 0
      let base = 1
      for (let u = t + 1; u < g.indices.length; u++) base *= sizes[g.indices[u]]
      idx += val * base
    }
    return idx
  }

  for (let i = 0; i < n; i++) {
    const v = vals[i]
    const ix = computeMixedIndexVals(v, 0)
    const iy = computeMixedIndexVals(v, 1)
    const iz = computeMixedIndexVals(v, 2)
    const x = ix * spacing - halfX
    const y = iy * spacing - halfY
    const z = iz * spacing - halfZ
    const ang = Math.PI / 12
    const cosA = Math.cos(ang)
    const sinA = Math.sin(ang)
    const rx = x * cosA - z * sinA
    const rz = x * sinA + z * cosA
    positions[i] = [rx, y, rz]
  }
  return positions
}

export function cylinderLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')

  // 层 = 循环因子组合（沿 y 轴堆叠），副本 = 非循环因子环。
  // 推广 2D cylinderLayout2D 到 3D：任意因子数（pipe 归组 / 注册表聚类）。
  let layers: string[] = []
  let copy: Map<string, [number, number]> | null = null
  let elPos = new Map<string, { layerIdx: number; uvKey: string }>()

  if (isPipeProduct) {
    const grouped = factorPipeGroupsGrouped(group)
    if (grouped && grouped.count >= 2) {
      const perEl = grouped.perEl
      const cycIdxs = grouped.cyclic.map((c, i) => (c ? i : -1)).filter(i => i >= 0)
      const nonCycIdxs = grouped.cyclic.map((_, i) => i).filter(i => !grouped.cyclic[i])
      if (cycIdxs.length > 0 && nonCycIdxs.length > 0) {
        const cycKeySets = cycIdxs.map(idx => Array.from(new Set(perEl.map(g => g[idx].join('|')))))
        const combos: string[][] = [[]]
        for (const ks of cycKeySets) {
          const next: string[][] = []
          for (const combo of combos) for (const k of ks) next.push([...combo, k])
          combos.splice(0, combos.length, ...next)
        }
        const layerIdxMap = new Map(combos.map((c, i) => [c.join('~'), i]))
        layers = combos.map(c => c.join('~'))
        const nonKeySet = Array.from(new Set(perEl.map(g => nonCycIdxs.map(idx => g[idx].join('|')).join('~'))))
        copy = factorCopyRing3D({ elements: nonKeySet.map(k => ({ id: k })) })
        for (let i = 0; i < group.elements.length; i++) {
          const g = perEl[i]
          const layerKey = cycIdxs.map(idx => g[idx].join('|')).join('~')
          const nonKey = nonCycIdxs.map(idx => g[idx].join('|')).join('~')
          elPos.set(group.elements[i].id, { layerIdx: layerIdxMap.get(layerKey) ?? 0, uvKey: nonKey })
        }
      }
    }
    if (!copy) {
      // 兜底：经典 2 因子 pipe（按符号 part 判定）
      let rawSymbol = group.symbol
      if (!rawSymbol.includes('\\times')) {
        const supMatch = rawSymbol.match(/^(.+)\^\{(\d+)\}$/)
        if (supMatch) {
          const base = supMatch[1]
          const count = parseInt(supMatch[2], 10)
          if (count >= 2) rawSymbol = Array(count).fill(base).join(' \\times ')
        }
      }
      const parts = rawSymbol.includes('\\times') ? rawSymbol.split('\\times').map(s => s.trim()) : []
      if (parts.length === 2) {
        const tokenLists = group.elements.map(el => el.id.split('|'))
        const tokenKeys: string[][] = []
        for (let j = 0; j < parts.length; j++) {
          tokenKeys.push(Array.from(new Set(tokenLists.map(t => t[j] ?? ''))))
        }
        const cycPartIdx = parts.findIndex(p => p.startsWith('C'))
        const nonCycPartIdx = parts.findIndex(p => !p.startsWith('C'))
        if (cycPartIdx !== -1 && nonCycPartIdx !== -1) {
          const sizeC = tokenKeys[cycPartIdx].length
          const sizeS = tokenKeys[nonCycPartIdx].length
          if (sizeC > 0 && sizeS > 0) {
            const tokenOrders = tokenKeys.map(arr => ringOrder(arr))
            const tokenMaps = tokenOrders.map(arr => new Map(arr.map((k, i) => [k, i])))
            const ringRadius2 = Math.max(radius * 0.55, (sizeS * 0.9) / (2 * Math.PI))
            const verticalGap2 = Math.max(0.9, (radius * 1.8) / Math.max(1, sizeC))
            const halfH2 = (sizeC - 1) * verticalGap2 / 2
            for (let i = 0; i < n; i++) {
              const toks = group.elements[i].id.split('|')
              const cTok = toks[cycPartIdx] ?? ''
              const sTok = toks[nonCycPartIdx] ?? ''
              const ci = tokenMaps[cycPartIdx].get(cTok) ?? 0
              const si = tokenMaps[nonCycPartIdx].get(sTok) ?? 0
              const stagger = (ci % 2) * (Math.PI / (sizeS * 2))
              const angle = (si * 2 * Math.PI) / sizeS + stagger
              positions[i] = [Math.cos(angle) * ringRadius2, ci * verticalGap2 - halfH2, Math.sin(angle) * ringRadius2]
            }
            return positions
          }
        }
      }
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      return positions
    }
  } else {
    // 注册表群：生成元交换性聚类（需同时含循环簇和非循环簇），tableFactorSearch 兜底
    let clusters = clusterFactorGroups(group)
    if (clusters) {
      const hasCyc = clusters.some(c => clusterIsCyclic(group, c))
      const hasNonCyc = clusters.some(c => !clusterIsCyclic(group, c))
      if (!hasCyc || !hasNonCyc) clusters = null
    }
    if (!clusters) clusters = tableFactorSearch(group)
    if (clusters) {
      const cycClusters = clusters.filter(c => clusterIsCyclic(group, c))
      const nonCycClusters = clusters.filter(c => !clusterIsCyclic(group, c))
      if (cycClusters.length > 0 && nonCycClusters.length > 0) {
        const combos: string[][] = [[]]
        for (const c of cycClusters) {
          const next: string[][] = []
          for (const combo of combos) for (const id of c) next.push([...combo, id])
          combos.splice(0, combos.length, ...next)
        }
        const byId = new Map(group.elements.map(e => [e.id, e]))
        const seen = new Map<string, { layerIdx: number; uvKey: string }>()
        const nonEls = nonCycClusters.flat().map(id => byId.get(id)!)
        for (let ci = 0; ci < combos.length; ci++) {
          let comboEl = group.identity
          for (const id of combos[ci]) comboEl = group.multiply(comboEl, byId.get(id)!)
          for (const nonEl of nonEls) {
            const el = group.multiply(comboEl, nonEl)
            seen.set(el.id, { layerIdx: ci, uvKey: nonEl.id })
          }
        }
        if (seen.size === group.elements.length) {
          layers = combos.map(c => c.join('~'))
          copy = factorCopyRing3D({ elements: nonEls })
          elPos = seen
        }
      }
    }
    if (!copy) {
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      return positions
    }
  }

  const copyN = Math.max(copy.size, 1)
  const ringRadius = Math.max(radius * 0.55, (copyN * 0.9) / (2 * Math.PI))
  const layerCount = Math.max(1, layers.length)
  const verticalGap = Math.max(0.9, (radius * 1.8) / layerCount)
  const halfH = ((layerCount - 1) * verticalGap) / 2
  for (let i = 0; i < n; i++) {
    const pos = elPos.get(group.elements[i].id)
    if (!pos) {
      positions[i] = fibonacciSphere(n, radius)[i]
      continue
    }
    const uv = copy.get(pos.uvKey) ?? [0, 0]
    const mag = Math.hypot(uv[0], uv[1]) || 1
    const angle = Math.atan2(uv[1], uv[0]) + pos.layerIdx * (Math.PI / copyN)
    const y = pos.layerIdx * verticalGap - halfH
    positions[i] = [Math.cos(angle) * ringRadius * mag, y, Math.sin(angle) * ringRadius * mag]
  }
  return positions
}

export function torusLayout3D(group: Group, radius: number): Vec3[] | null {
  const n = group.order
  if (n === 0) return null
  const positions: Vec3[] = new Array(n)
  const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
  let unitRings: Map<string, [number, number]>[] | null = null
  let perElKeys: string[][] | null = null

  if (isPipeProduct) {
    // 归组因子（C₂×C₂→C₂² 合并、紧凑幂展开）：任意因子数
    const grouped = factorPipeGroupsGrouped(group)
    if (grouped && grouped.count >= 2) {
      unitRings = []
      for (let i = 0; i < grouped.count; i++) {
        const keys = Array.from(new Set(grouped.perEl.map(g => g[i].join('|'))))
        unitRings.push(factorCopyRing3D({ elements: keys.map(k => ({ id: k })) }))
      }
      perElKeys = grouped.perEl.map(g => g.map(gr => gr.join('|')))
    } else {
      // 经典 2 段 token 兜底
      const tokenLists = group.elements.map(el => el.id.split('|'))
      const maxTokens = Math.max(...tokenLists.map(t => t.length))
      if (maxTokens === 2) {
        const tok0 = Array.from(new Set(tokenLists.map(t => t[0] ?? '')))
        const tok1 = Array.from(new Set(tokenLists.map(t => t[1] ?? '')))
        unitRings = [
          factorCopyRing3D({ elements: tok0.map(k => ({ id: k })) }),
          factorCopyRing3D({ elements: tok1.map(k => ({ id: k })) }),
        ]
        perElKeys = group.elements.map(el => el.id.split('|'))
      }
    }
  } else {
    const vals = group.elements.map(el => el.value || [])
    const dim = vals[0]?.length || 0
    if (dim >= 2) {
      // value 多维：每维一个环
      const keySets: string[][] = []
      for (let d = 0; d < dim; d++) {
        const keys = Array.from(new Set(vals.map(v => v[d] ?? 0)))
        keys.sort((a, b) => Number(a) - Number(b))
        keySets.push(keys.map(String))
      }
      unitRings = keySets.map(ks => factorCopyRing3D({ elements: ks.map(k => ({ id: k })) }))
      perElKeys = vals.map(v => v.map(x => String(x)))
    } else {
      // 注册表群：生成元交换性聚类，笛卡尔分解校验唯一性（同 2D torusLayout2D）
      let clusters = clusterFactorGroups(group)
      if (!clusters || clusters.length < 2) clusters = tableFactorSearch(group)
      if (clusters && clusters.length >= 2) {
        const byId = new Map(group.elements.map(e => [e.id, e]))
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
        if (comboToEl.size === group.elements.length) {
          const elToCombo = new Map<string, string[]>()
          for (const [ck, el] of comboToEl) elToCombo.set(el.id, ck.split('~'))
          perElKeys = group.elements.map(el => elToCombo.get(el.id) ?? [])
          unitRings = clusters.map(c => factorCopyRing3D({ elements: c.map(id => ({ id })) }))
        }
      }
    }
  }

  if (!unitRings || !perElKeys) {
    for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    return positions
  }
  const placed = placeTorusRings(group, unitRings, perElKeys, radius)
  if (!placed) {
    for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
    return positions
  }
  for (let i = 0; i < n; i++) positions[i] = placed[i]
  return positions
}

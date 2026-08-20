import type { Group, GroupElement, Layout3D } from '../types'
import { isGroupDihedral, isC2Tesseract } from '../types'
import {
  ringOrder, powerRingOrder,
  factorPipeGroupsGrouped, clusterFactorGroups, clusterIsCyclic,
  tableFactorSearch, splitDihedralElements, dihedralSnakeOrder,
  quaternionCosetMap,
} from './ringOrder'
import { getSemidirectProductMeta, semidirectFactorMap } from './semidirectDecompositions'
import { truncatedTetrahedron } from '../polyhedra'
import { computeConeRingOrder } from './forceLayout'

type Vec3 = [number, number, number]

function fibonacciSphere(n: number, radius: number): Vec3[] {
  const points: Vec3[] = []
  if (n === 0) return points
  if (n === 1) {
    points.push([0, 0, 0])
    return points
  }
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = phi * i
    points.push([
      Math.cos(theta) * radiusAtY * radius,
      y * radius,
      Math.sin(theta) * radiusAtY * radius
    ])
  }
  return points
}

// ─── Q₁₆（广义四元数群）圆柱（Group Explorer 风格） ───────────────────────

/**
 * Q₁₆ 3D 凯莱图布局（对齐 Group Explorer 的 Q16 圆柱）：4 个 ⟨b⟩-陪集
 * a^j⟨b⟩（j = 0..3）为 4 层圆环沿 y 轴堆叠，每层节点 a^j·b^i 圆角
 * 90°·i（各层对齐，a 边 = 竖直直线、b 边 = 层内 90° 弧——GE 圆柱原貌）。
 * 结构不匹配返回 null（调用方回退 fibonacci 球）。
 */
function quaternionCylinder3D(group: Group, radius: number): Vec3[] | null {
  const dec = quaternionCosetMap(group)
  if (!dec) return null
  const sizeS = 4
  const sizeC = 4
  const ringRadius = Math.max(radius * 0.55, (sizeS * 0.9) / (2 * Math.PI))
  const verticalGap = Math.max(0.9, (radius * 1.8) / sizeC)
  const halfH = ((sizeC - 1) * verticalGap) / 2
  const positions: Vec3[] = []
  for (const el of group.elements) {
    const { j, i } = dec.byElement.get(el.id)!
    const angle = (90 * i * Math.PI) / 180
    positions.push([
      Math.cos(angle) * ringRadius,
      j * verticalGap - halfH,
      Math.sin(angle) * ringRadius
    ])
  }
  return positions
}

function getTetrahedronVerts(radius: number): Vec3[] {
  const a = radius * 0.8
  return [
    [a, a, a], [a, -a, -a], [-a, a, -a], [-a, -a, a],
  ]
}

function getCubeVerts(radius: number): Vec3[] {
  const a = radius * 0.6
  return [
    [-a, -a, -a], [a, -a, -a], [-a, a, -a], [a, a, -a],
    [-a, -a, a], [a, -a, a], [-a, a, a], [a, a, a],
  ]
}

function getCuboctahedronVerts(radius: number): Vec3[] {
  const a = radius * 0.7
  return [
    [a, a, 0], [a, -a, 0], [-a, a, 0], [-a, -a, 0],
    [a, 0, a], [a, 0, -a], [-a, 0, a], [-a, 0, -a],
    [0, a, a], [0, a, -a], [0, -a, a], [0, -a, -a],
  ]
}

const GE_VALUES: number[][] = [
  [0,1,2,3], [0,3,1,2], [0,2,3,1],
  [1,0,2,3], [1,3,0,2], [1,2,3,0],
  [3,0,1,2], [3,2,0,1], [3,1,2,0],
  [3,1,0,2], [3,2,1,0], [3,0,2,1],
  [2,0,3,1], [2,1,0,3], [2,3,1,0],
  [2,1,3,0], [2,0,1,3], [2,3,0,1],
  [1,2,0,3], [1,3,2,0], [1,0,3,2],
  [0,2,1,3], [0,3,2,1], [0,1,3,2],
]

function placeS4Elements(
  group: Group,
  coords: [number, number, number][],
  positions: Vec3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 24; geIdx++) {
    const myValue = GE_VALUES[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = [x * radius, y * radius, z * radius]
    }
  }
}

const GE_VALUES_A5: number[][] = [
  [0,1,2,3,4],[1,2,3,4,0],[2,3,4,0,1],[3,4,0,1,2],[4,0,1,2,3],
  [1,0,3,2,4],[0,3,2,4,1],[3,2,4,1,0],[2,4,1,0,3],[4,1,0,3,2],
  [2,1,4,3,0],[1,4,3,0,2],[4,3,0,2,1],[3,0,2,1,4],[0,2,1,4,3],
  [3,0,4,2,1],[0,4,2,1,3],[4,2,1,3,0],[2,1,3,0,4],[1,3,0,4,2],
  [3,2,0,4,1],[2,0,4,1,3],[0,4,1,3,2],[4,1,3,2,0],[1,3,2,0,4],
  [2,3,1,4,0],[3,1,4,0,2],[1,4,0,2,3],[4,0,2,3,1],[0,2,3,1,4],
  [4,3,1,0,2],[3,1,0,2,4],[1,0,2,4,3],[0,2,4,3,1],[2,4,3,1,0],
  [4,2,0,1,3],[2,0,1,3,4],[0,1,3,4,2],[1,3,4,2,0],[3,4,2,0,1],
  [4,0,3,1,2],[0,3,1,2,4],[3,1,2,4,0],[1,2,4,0,3],[2,4,0,3,1],
  [4,1,2,0,3],[1,2,0,3,4],[2,0,3,4,1],[0,3,4,1,2],[3,4,1,2,0],
  [0,1,4,2,3],[1,4,2,3,0],[4,2,3,0,1],[2,3,0,1,4],[3,0,1,4,2],
  [1,0,4,3,2],[0,4,3,2,1],[4,3,2,1,0],[3,2,1,0,4],[2,1,0,4,3],
]

function placeA5Elements(
  group: Group,
  coords: [number, number, number][],
  positions: Vec3[],
  radius: number
): void {
  const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
  for (let geIdx = 0; geIdx < 60; geIdx++) {
    const myValue = GE_VALUES_A5[geIdx].map(v => v + 1)
    const myId = myValue.join(',')
    const myIdx = idToIdx.get(myId)
    if (myIdx !== undefined) {
      const [x, y, z] = coords[geIdx]
      positions[myIdx] = [x * radius, y * radius, z * radius]
    }
  }
}

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
 * 3D 圆环的元素排序（推广 2D cayleyCircleLayout 的排序策略）：
 * pipe 直积按因子 ringOrder 字典序（生成元边相邻）；S₃ 置换集 → 六边形序
 * （detectS3PermSet 在 powerRingOrder 内处理）；表群 gN 等 → 生成元幂序
 * powerRingOrder（BFS，生成元边相邻），失败回退 ringOrder。
 */
function circularOrder3D(group: Group): string[] {
  const n = group.order
  if (n === 0) return []
  if (group.elements[0]?.id.includes('|')) {
    const numFactors = group.elements[0].id.split('|').length
    const factorOrders: Map<string, number>[] = []
    for (let col = 0; col < numFactors; col++) {
      const colKeys = Array.from(new Set(group.elements.map(el => el.id.split('|')[col] ?? '')))
      const ordered = ringOrder(colKeys)
      factorOrders[col] = new Map(ordered.map((k, i) => [k, i]))
    }
    return [...group.elements]
      .sort((a, b) => {
        const pa = a.id.split('|')
        const pb = b.id.split('|')
        for (let col = 0; col < numFactors; col++) {
          const ai = factorOrders[col].get(pa[col] ?? '') ?? 0
          const bi = factorOrders[col].get(pb[col] ?? '') ?? 0
          if (ai !== bi) return ai - bi
        }
        return 0
      })
      .map(el => el.id)
  }
  return powerRingOrder(group)
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

export function compute3DPositions(group: Group, layout: Layout3D): Vec3[] {
  const n = group.order
  const radius = 5
  const positions: Vec3[] = new Array(n)

  switch (layout) {
    case 'lattice': {
      const vals = group.elements.map(el => el.value || [])
      const isPipeProduct = group.elements.length > 0 && group.elements[0].id.includes('|')
      if (n === 0) break

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
          break
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
        break
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
        break
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
      break
    }

    case 'semidirectCylinder': {
      if (n === 0) break
      const sd = getSemidirectProductMeta(group)
      const factorMap = sd ? semidirectFactorMap(group, sd) : null
      if (!sd || !factorMap) {
        // Q₁₆（广义四元数群，GE 记为 Q₈）：⟨b⟩-陪集圆柱（见 quaternionCylinder3D）
        const q16 = quaternionCylinder3D(group, radius)
        if (q16) {
          for (let i = 0; i < n; i++) positions[i] = q16[i]
          break
        }
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }
      const hOrder = powerRingOrder(sd.acting)
      // N 盘内环序：二面体蛇形（rotations 幂序正排 + reflections 配对角反排，
      // 生成元边外环相邻、反射边径向），无二面体结构回退生成元幂序
      const nOrder = dihedralSnakeOrder(sd.normal) ?? powerRingOrder(sd.normal)
      const sizeC = Math.max(1, sd.acting.order)
      const sizeS = Math.max(1, sd.normal.order)
      const ringRadius = Math.max(radius * 0.55, (sizeS * 0.9) / (2 * Math.PI))
      const verticalGap = Math.max(0.9, (radius * 1.8) / sizeC)
      const halfH = ((sizeC - 1) * verticalGap) / 2
      for (let i = 0; i < n; i++) {
        const fm = factorMap.get(group.elements[i].id)
        if (!fm) {
          positions[i] = fibonacciSphere(n, radius)[i]
          continue
        }
        const hIdx = hOrder.indexOf(fm.h.id)
        const nIdx = nOrder.indexOf(fm.n.id)
        // Layer-stagger the ring so the points spread uniformly around the
        // cylinder surface (not an aligned triangular prism). The acting
        // subgroup H = {e, y, y², y³} then forms a visible helical 4-cycle
        // instead of collapsing onto a single vertical column.
        const stagger = (2 * Math.PI) / (sizeS * sizeC)
        const angle = (Math.max(0, nIdx) * 2 * Math.PI) / sizeS + Math.max(0, hIdx) * stagger
        positions[i] = [
          Math.cos(angle) * ringRadius,
          Math.max(0, hIdx) * verticalGap - halfH,
          Math.sin(angle) * ringRadius
        ]
      }
      break
    }

    case 'cylinder': {
      if (n === 0) break
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
                break
              }
            }
          }
          for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
          break
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
          break
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
      break
    }

    case 'cone': {
      if (n === 0) break
      // 圆锥兜底：恒等元（1 阶）在顶点，其余元素按阶 k=2..maxOrder
      // 沿母线分圈向下摆（无 k 阶元素则空圈跳过），每圈按共轭类分扇区
      const { orderOf, maxK, slots, totalSlots } = computeConeRingOrder(group)
      for (let i = 0; i < n; i++) {
        const el = group.elements[i]
        const k = orderOf.get(el.id) ?? 1
        if (k <= 1) {
          positions[i] = [0, radius, 0]
          continue
        }
        let slot: number
        if (slots) {
          slot = slots.get(el.id) ?? 0
        } else {
          let s = 0
          for (let j = 0; j < i; j++) {
            if ((orderOf.get(group.elements[j].id) ?? 1) === k) s++
          }
          slot = s
        }
        const total = totalSlots.get(k) ?? 1
        const t = k / maxK
        const angle = -Math.PI / 2 + (slot * 2 * Math.PI) / total
        positions[i] = [Math.cos(angle) * radius * t, radius - 2 * radius * t, Math.sin(angle) * radius * t]
      }
      break
    }

    case 'circular': {
      if (n === 0) break
      // 二面体结构：单环无法免交叉 → 双环（旋转外环 + 反射内环，径向配对），
      // 与 2D cayleyCircleLayout 对 Dₙ 的处理一致（需符号守卫，循环群
      // C₂ₘ 含阶 m 元素会被 splitDihedralElements 误配，2D 同样用 isGroupDihedral 守卫）
      if (isGroupDihedral(group)) {
        const split = splitDihedralElements(group)
        if (split) {
          const cnt = split.rotations.length
          const rRadius = radius * 0.85
          const rotIdx = new Map(split.rotations.map((e, i) => [e.id, i]))
          const refIdx = split.reflectPair
          for (let i = 0; i < n; i++) {
            const id = group.elements[i].id
            const rot = rotIdx.get(id)
            if (rot !== undefined) {
              const angle = (rot * 2 * Math.PI) / cnt
              positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
            } else {
              const angle = ((refIdx.get(id) ?? 0) * 2 * Math.PI) / cnt
              positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
            }
          }
          break
        }
      }
      const order = circularOrder3D(group)
      const idxOf = new Map(order.map((k, i) => [k, i]))
      for (let i = 0; i < n; i++) {
        const idx = idxOf.get(group.elements[i].id)
        const angle = (idx ?? i) * 2 * Math.PI / n
        positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
      }
      break
    }

    case 'torus': {
      if (n === 0) break
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
        break
      }
      const placed = placeTorusRings(group, unitRings, perElKeys, radius)
      if (!placed) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }
      for (let i = 0; i < n; i++) positions[i] = placed[i]
      break
    }

    case 'hexagon': {
      if (n === 0) break
      // S₃ 置换集 → 六边形序（circularOrder3D 经 powerRingOrder 的 detectS3PermSet）；
      // 其他群退化为通用圆环排序
      const order = circularOrder3D(group)
      const idxOf = new Map(order.map((k, i) => [k, i]))
      for (let i = 0; i < n; i++) {
        const idx = idxOf.get(group.elements[i].id)
        const angle = (idx ?? i) * 2 * Math.PI / n
        positions[i] = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
      }
      break
    }

    case 'dihedral': {
      const halfN = Math.floor(n / 2)
      const rRadius = radius * 0.85
      // 注册表二面体群（value=[k]）等：按元素阶分类旋转/反射并径向配对
      const split = isGroupDihedral(group) ? splitDihedralElements(group) : null
      if (split && split.rotations.length === halfN) {
        const cnt = split.rotations.length
        const rotIdx = new Map(split.rotations.map((e, i) => [e.id, i]))
        const refIdx = split.reflectPair
        for (let i = 0; i < n; i++) {
          const id = group.elements[i].id
          const rot = rotIdx.get(id)
          if (rot !== undefined) {
            const angle = (rot * 2 * Math.PI) / cnt
            positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
          } else {
            const angle = ((refIdx.get(id) ?? 0) * 2 * Math.PI) / cnt
            positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
          }
        }
        break
      }
      for (let i = 0; i < halfN; i++) {
        const angle = (i * 2 * Math.PI) / halfN
        positions[i] = [Math.cos(angle) * rRadius, -radius * 0.25, Math.sin(angle) * rRadius]
      }
      for (let i = halfN; i < n; i++) {
        const angle = ((i - halfN) * 2 * Math.PI) / (n - halfN)
        positions[i] = [Math.cos(angle) * rRadius, radius * 0.25, Math.sin(angle) * rRadius]
      }
      break
    }

    case 'tetrahedron': {
      const verts = getTetrahedronVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.2)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'cube': {
      const verts = getCubeVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.3)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'hypercube': {
      // C₂⁴ 超立方体：外立方体（w=0，边长 radius）× 内立方体（w=1，边长 radius*0.55）同心投影
      if (n !== 16 || !isC2Tesseract(group)) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }
      const id = group.identity
      const subIds = new Set<string>([id.id])
      const bits: string[] = []
      for (const el of group.elements) {
        if (subIds.size >= n) break
        if (el.id === id.id || subIds.has(el.id)) continue
        const next = new Set(subIds)
        let ok = true
        for (const a of subIds) {
          const elA = group.elements.find(e => e.id === a)
          if (!elA) { ok = false; break }
          const prod = group.multiply(elA, el).id
          if (next.has(prod)) { ok = false; break }
          next.add(prod)
        }
        if (ok) {
          bits.push(el.id)
          for (const x of next) subIds.add(x)
        }
      }
      if (subIds.size !== n) {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
        break
      }
      const maskOf = new Map<string, number>()
      for (let m = 0; m < n; m++) {
        let acc = group.identity
        for (let b = 0; b < bits.length; b++) {
          if (m & (1 << b)) {
            const elB = group.elements.find(e => e.id === bits[b])
            if (elB) acc = group.multiply(acc, elB)
          }
        }
        maskOf.set(acc.id, m)
      }
      for (let i = 0; i < n; i++) {
        const mask = maskOf.get(group.elements[i].id) ?? i
        const s = (mask & 8) ? radius * 0.55 : radius
        positions[i] = [(mask & 1 ? s : -s), (mask & 2 ? s : -s), (mask & 4 ? s : -s)]
      }
      break
    }

    case 'cuboctahedron': {
      const verts = getCuboctahedronVerts(radius)
      for (let i = 0; i < Math.min(n, verts.length); i++) {
        positions[i] = verts[i]
      }
      for (let i = verts.length; i < n; i++) {
        const extra = fibonacciSphere(n - verts.length, radius * 1.1)
        positions[i] = extra[i - verts.length]
      }
      break
    }

    case 'truncatedTetrahedron': {
      if (n === 12) {
        const idToIdx = new Map(group.elements.map((e, i) => [e.id, i]))
        const faceIds: string[][] = [
          ['1,3,4,2', '1,4,2,3', '1,2,3,4'],
          ['2,4,3,1', '2,3,1,4', '2,1,4,3'],
          ['4,2,1,3', '4,1,3,2', '4,3,2,1'],
          ['3,1,2,4', '3,2,4,1', '3,4,1,2'],
        ]
        const verts = truncatedTetrahedron(radius)
        for (let f = 0; f < 4; f++) {
          for (let v = 0; v < 3; v++) {
            const idx = idToIdx.get(faceIds[f][v])
            if (idx !== undefined) {
              const [x, y, z] = verts[f * 3 + v]
              positions[idx] = [x, y, z]
            }
          }
        }
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'truncatedCube': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [0.6, -1.0, 1.0], [1.0, -0.6, 1.0], [1.0, -1.0, 0.6],
          [-0.6, -1.0, 1.0], [-1.0, -1.0, 0.6], [-1.0, -0.6, 1.0],
          [1.0, 0.6, 1.0], [0.6, 1.0, 1.0], [1.0, 1.0, 0.6],
          [-1.0, -1.0, -0.6], [-0.6, -1.0, -1.0], [-1.0, -0.6, -1.0],
          [1.0, -1.0, -0.6], [1.0, -0.6, -1.0], [0.6, -1.0, -1.0],
          [-1.0, 0.6, 1.0], [-1.0, 1.0, 0.6], [-0.6, 1.0, 1.0],
          [1.0, 0.6, -1.0], [1.0, 1.0, -0.6], [0.6, 1.0, -1.0],
          [-1.0, 1.0, -0.6], [-1.0, 0.6, -1.0], [-0.6, 1.0, -1.0],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'rhombicuboctahedron': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [-0.5, 0.5, 1.0], [-1.0, -0.5, -0.5], [0.5, -1.0, 0.5],
          [0.5, -1.0, -0.5], [1.0, 0.5, 0.5], [-0.5, -0.5, 1.0],
          [0.5, 0.5, 1.0], [-0.5, 1.0, -0.5], [-1.0, -0.5, 0.5],
          [-0.5, -1.0, -0.5], [0.5, 0.5, -1.0], [1.0, -0.5, 0.5],
          [-1.0, 0.5, -0.5], [0.5, -0.5, -1.0], [-0.5, -1.0, 0.5],
          [1.0, 0.5, -0.5], [-0.5, 1.0, 0.5], [0.5, -0.5, 1.0],
          [-1.0, 0.5, 0.5], [0.5, 1.0, -0.5], [-0.5, -0.5, -1.0],
          [1.0, -0.5, -0.5], [-0.5, 0.5, -1.0], [0.5, 1.0, 0.5],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'truncatedOctahedron2': {
      if (n === 24) {
        const coords: [number, number, number][] = [
          [0.3, -1.0, 0.0], [0.0, -0.3, 1.0], [1.0, 0.0, 0.3],
          [1.0, -0.3, 0.0], [0.3, 0.0, -1.0], [0.0, -1.0, -0.3],
          [0.0, -1.0, 0.3], [-1.0, -0.3, 0.0], [-0.3, 0.0, 1.0],
          [1.0, 0.0, -0.3], [0.3, 1.0, 0.0], [0.0, 0.3, -1.0],
          [0.3, 0.0, 1.0], [0.0, 1.0, 0.3], [1.0, 0.3, 0.0],
          [0.0, -0.3, -1.0], [-1.0, 0.0, -0.3], [-0.3, -1.0, 0.0],
          [0.0, 0.3, 1.0], [-1.0, 0.0, 0.3], [-0.3, 1.0, 0.0],
          [-0.3, 0.0, -1.0], [0.0, 1.0, -0.3], [-1.0, 0.3, 0.0],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'truncatedOctahedron3': {
      if (n === 24) {
        // 三换位生成元 ((12),(23),(34)) 的 S4 凯莱图 = 截角八面体 24 顶点 36 棱。
        // 坐标取截角八面体 (0,±1,±2) 全排列的 1/3 缩放，旋转后与截角八面体同构。
        const coords: [number, number, number][] = [
          [0.333, -0.667, 0], [0, -0.333, -0.667], [0.667, 0, -0.333],
          [0, -0.667, 0.333], [-0.667, -0.333, 0], [-0.333, 0, 0.667],
          [-0.333, 0, -0.667], [0, 0.667, -0.333], [-0.667, 0.333, 0],
          [-0.667, 0, -0.333], [-0.333, 0.667, 0], [0, 0.333, -0.667],
          [0.667, 0.333, 0], [0.333, 0, 0.667], [0, 0.667, 0.333],
          [0, 0.333, 0.667], [0.667, 0, 0.333], [0.333, 0.667, 0],
          [0, -0.333, 0.667], [-0.667, 0, 0.333], [-0.333, -0.667, 0],
          [0.667, -0.333, 0], [0.333, 0, -0.667], [0, -0.667, -0.333],
        ]
        placeS4Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'truncatedIcosahedron': {
      if (n === 60) {
        const coords: [number, number, number][] = [
          [0.0, 1.2135, 0.25], [0.4045, 1.059, 0.5], [0.25, 0.809, 0.9045],
          [-0.25, 0.809, 0.9045], [-0.4045, 1.059, 0.5], [0.0, 1.2135, -0.25],
          [-0.4045, 1.059, -0.5], [-0.25, 0.809, -0.9045], [0.25, 0.809, -0.9045],
          [0.4045, 1.059, -0.5], [0.809, 0.9045, 0.25], [0.809, 0.9045, -0.25],
          [1.059, 0.5, -0.4045], [1.2135, 0.25, 0.0], [1.059, 0.5, 0.4045],
          [-0.809, 0.9045, -0.25], [-0.809, 0.9045, 0.25], [-1.059, 0.5, 0.4045],
          [-1.2135, 0.25, 0.0], [-1.059, 0.5, -0.4045], [0.5, 0.4045, 1.059],
          [0.9045, 0.25, 0.809], [0.9045, -0.25, 0.809], [0.5, -0.4045, 1.059],
          [0.25, 0.0, 1.2135], [-0.5, 0.4045, -1.059], [-0.9045, 0.25, -0.809],
          [-0.9045, -0.25, -0.809], [-0.5, -0.4045, -1.059], [-0.25, 0.0, -1.2135],
          [-0.5, 0.4045, 1.059], [-0.25, 0.0, 1.2135], [-0.5, -0.4045, 1.059],
          [-0.9045, -0.25, 0.809], [-0.9045, 0.25, 0.809], [0.5, 0.4045, -1.059],
          [0.25, 0.0, -1.2135], [0.5, -0.4045, -1.059], [0.9045, -0.25, -0.809],
          [0.9045, 0.25, -0.809], [1.059, -0.5, 0.4045], [1.2135, -0.25, 0.0],
          [1.059, -0.5, -0.4045], [0.809, -0.9045, -0.25], [0.809, -0.9045, 0.25],
          [-1.059, -0.5, -0.4045], [-1.2135, -0.25, 0.0], [-1.059, -0.5, 0.4045],
          [-0.809, -0.9045, 0.25], [-0.809, -0.9045, -0.25], [-0.25, -0.809, 0.9045],
          [0.25, -0.809, 0.9045], [0.4045, -1.059, 0.5], [0.0, -1.2135, 0.25],
          [-0.4045, -1.059, 0.5], [0.25, -0.809, -0.9045], [-0.25, -0.809, -0.9045],
          [-0.4045, -1.059, -0.5], [0.0, -1.2135, -0.25], [0.4045, -1.059, -0.5],
        ]
        placeA5Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    case 'truncatedDodecahedron': {
      if (n === 60) {
        const coords: [number, number, number][] = [
          [0.6505, 1.2322, -0.2909], [1.2322, -0.2909, -0.6505], [0.1798, -1.412, 0.0],
          [-1.0525, -0.5818, 0.7616], [-0.7616, 1.0525, 0.5818], [0.5818, -0.7616, 1.0525],
          [-0.2909, 0.6505, 1.2322], [-0.6505, 1.2322, -0.2909], [0.0, 0.1798, -1.412],
          [0.7616, -1.0525, -0.5818], [0.0, -0.1798, 1.412], [0.7616, 1.0525, 0.5818],
          [0.5818, 0.7616, -1.0525], [-0.2909, -0.6505, -1.2322], [-0.6505, -1.2322, 0.2909],
          [1.0525, 0.5818, -0.7616], [1.2322, -0.2909, 0.6505], [-0.2909, -0.6505, 1.2322],
          [-1.412, 0.0, 0.1798], [-0.5818, 0.7616, -1.0525], [0.2909, 0.6505, 1.2322],
          [1.412, 0.0, 0.1798], [0.5818, -0.7616, -1.0525], [-1.0525, -0.5818, -0.7616],
          [-1.2322, 0.2909, 0.6505], [1.412, 0.0, -0.1798], [0.5818, 0.7616, 1.0525],
          [-1.0525, 0.5818, 0.7616], [-1.2322, -0.2909, -0.6505], [0.2909, -0.6505, -1.2322],
          [1.0525, 0.5818, 0.7616], [0.7616, -1.0525, 0.5818], [-0.6505, -1.2322, -0.2909],
          [-1.2322, 0.2909, -0.6505], [-0.1798, 1.412, 0.0], [1.2322, 0.2909, 0.6505],
          [0.1798, 1.412, 0.0], [-1.0525, 0.5818, -0.7616], [-0.7616, -1.0525, -0.5818],
          [0.6505, -1.2322, 0.2909], [-0.5818, -0.7616, 1.0525], [1.0525, -0.5818, 0.7616],
          [1.2322, 0.2909, -0.6505], [-0.2909, 0.6505, -1.2322], [-1.412, 0.0, -0.1798],
          [0.2909, 0.6505, -1.2322], [0.6505, 1.2322, 0.2909], [0.0, 0.1798, 1.412],
          [-0.7616, -1.0525, 0.5818], [-0.5818, -0.7616, -1.0525], [-0.5818, 0.7616, 1.0525],
          [0.2909, -0.6505, 1.2322], [0.6505, -1.2322, -0.2909], [0.0, -0.1798, -1.412],
          [-0.7616, 1.0525, -0.5818], [1.0525, -0.5818, -0.7616], [0.7616, 1.0525, -0.5818],
          [-0.6505, 1.2322, 0.2909], [-1.2322, -0.2909, 0.6505], [-0.1798, -1.412, 0.0],
        ]
        placeA5Elements(group, coords, positions, radius)
      } else {
        for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      }
      break
    }

    default: {
      for (let i = 0; i < n; i++) positions[i] = fibonacciSphere(n, radius)[i]
      break
    }
  }

  // Specialized placements (S4/A5/...) only fill positions whose element ids
  // match the canonical permutation format; fill any leftovers so downstream
  // destructuring never hits undefined.
  for (let i = 0; i < n; i++) {
    if (!positions[i]) positions[i] = fibonacciSphere(n, radius)[i]
  }

  return positions
}



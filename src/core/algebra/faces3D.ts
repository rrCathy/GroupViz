import type { Group } from '../types'
import { findAllSubgroups } from './subgroups/enumerate'
import { subgroupStructureSymbol } from './subgroups/detection'
import { closeUnderMultiply } from './subgroups/shared'

/**
 * 3D 凯莱图「子群陪集面」几何检测。
 *
 * 语义（与用户确认）：一个可填色的「面」= 在 3D 布局几何中，顶点恰好被某个真子群 H 的
 * 单个陪集（右乘轨道）占满、且构成一个平面凸多边形（凸包）、边界由当前作用边闭合的多边形。
 * 例：A₄ 截角四面体选 H=C₃=⟨(234)⟩ → 4 个陪集 = 4 个截角三角面；
 *     D₅ 棱柱选 H=C₅=⟨r⟩ → 2 个陪集 = 顶/底五边形；C₂³ 立方体选 V₄ → 2 个方形面。
 * 非陪集几何面（A₄ 的六边形、D₅ 的侧长方形）因跨多个陪集、不满足边界边约束而天然不可选。
 */

type P3 = readonly [number, number, number]

/** 面默认配色（自动分配，作者可逐面覆盖）。Scene 渲染与 ⚙ 面板共用，保证所见即所得 */
export const FACE_COLOR_PALETTE: string[] = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4',
  '#f032e6', '#9a6324', '#469990', '#ffe119', '#bcf60c', '#e6beff',
]

export interface FacePolygon {
  /** 陪集元素 id 升序 join(',')——持久化/换群匹配的稳定键 */
  key: string
  /** 凸包环序的元素 id（渲染顶点顺序，首元素 = 陪集代表） */
  hullElementIds: string[]
  /** 陪集大小（= |H|） */
  size: number
}

export interface FaceSubgroupResult {
  /** H 元素 id（升序）；viewParams 持久化用 */
  elementIds: string[]
  /** 结构符号（如 'C_{3}'、'Z_{2}^{2}'）；由 subgroupStructureSymbol 计算 */
  structure: string | null
  /** 最小生成元标签串（TeX 片段，供 ⚙ 下拉显示） */
  genLabel: string
  order: number
  index: number
  faces: FacePolygon[]
}

/** 把 Cayley 边（元素下标对）转成无向边键集合（供边界闭合校验） */
export function buildUndirectedEdgeKeys(edgeIndexPairs: readonly (readonly [number, number])[]): Set<string> {
  const s = new Set<string>()
  for (const [a, b] of edgeIndexPairs) {
    if (a === b) continue
    s.add(`${Math.min(a, b)}|${Math.max(a, b)}`)
  }
  return s
}

function vecSub(a: P3, b: P3): P3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function vecCross(a: P3, b: P3): P3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function vecLen(a: P3): number {
  return Math.hypot(a[0], a[1], a[2])
}

/** 2D 凸包（Andrew monotone chain），返回凸包顶点序（逆时针）。退化（<3 点 / 共线）返回 null。 */
function convexHull2D(pts: [number, number][]): number[] | null {
  const n = pts.length
  if (n < 3) return null
  const order = pts.map((_, i) => i).sort((i, j) => pts[i][0] - pts[j][0] || pts[i][1] - pts[j][1])
  const cross = (o: number, a: number, b: number) => {
    return (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0])
  }
  const lower: number[] = []
  for (const i of order) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 1e-12) lower.pop()
    lower.push(i)
  }
  const upper: number[] = []
  for (let k = n - 1; k >= 0; k--) {
    const i = order[k]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 1e-12) upper.pop()
    upper.push(i)
  }
  lower.pop()
  upper.pop()
  const hull = [...lower, ...upper]
  if (hull.length < 3) return null
  return hull
}

/**
 * 单子群的面检测：
 * - H 非真子群 / 元素不在群中 → null（非法入参）
 * - 每个右陪集（右乘 H 的轨道）：|S|≥3 → 平面度校验 → 平面凸包 → 边界边闭合校验（edgeKeys 提供时）
 */
export function subgroupFaces(
  group: Group,
  subgroupElementIds: readonly string[],
  positions: readonly P3[],
  edgeKeys?: ReadonlySet<string>,
): FacePolygon[] | null {
  const byId = new Map(group.elements.map((e, i) => [e.id, i]))
  const idSet = new Set<string>()
  const seed: (typeof group.elements) = []
  for (const id of subgroupElementIds) {
    const idx = byId.get(id)
    const el = idx === undefined ? undefined : group.elements[idx]
    if (!el || idSet.has(id)) return null
    idSet.add(id)
    seed.push(el)
  }
  if (seed.length < 3) return null
  const closure = closeUnderMultiply(group, seed)
  if (closure.length !== seed.length || closure.some(e => !idSet.has(e.id))) return null
  // 真子群（含 H=G 视为无效：不存在陪集划分）
  if (closure.length >= group.order) return null

  const idxOfH = closure.map(e => byId.get(e.id) as number)
  const visited = new Set<string>()
  const faces: FacePolygon[] = []

  for (const el of group.elements) {
    if (visited.has(el.id)) continue
    // 右陪集 g·H（凯莱图右乘约定与 computeCayleyActionEdges 一致）
    const cosetIds: string[] = []
    for (const hIdx of idxOfH) {
      const gid = group.multiply(el, group.elements[hIdx]).id
      if (!visited.has(gid)) cosetIds.push(gid)
    }
    if (cosetIds.length === seed.length) {
      // 完整陪集：构建有序（按群元素序）顶点列表
      const ordered: { id: string; p: P3 }[] = cosetIds
        .map(id => ({ id, p: positions[byId.get(id) as number] }))
        .sort((a, b) => (byId.get(a.id) as number) - (byId.get(b.id) as number))
      for (const c of ordered) visited.add(c.id)
      if (ordered.length >= 3) {
        // 共面 + 凸 + 边界由作用边闭合（edgeKeys 提供时）
        const ringEdgeKeys = planarHullPolygon(ordered.map(o => o.p))
        if (!ringEdgeKeys) continue
        const hullOrder = convexHullOrderOf(ordered.map(o => o.p))
        if (edgeKeys) {
          // planarHullPolygon 的键是 ordered 内相对下标；转成全局元素下标键再比对
          let closed = true
          for (let t = 0; t < hullOrder.length && closed; t++) {
            const a = byId.get(ordered[hullOrder[t]].id) as number
            const b = byId.get(ordered[hullOrder[(t + 1) % hullOrder.length]].id) as number
            const k = a < b ? `${a}|${b}` : `${b}|${a}`
            if (!edgeKeys.has(k)) closed = false
          }
          if (!closed) continue
        }
        faces.push({
          key: ordered.map(o => o.id).sort().join(','),
          hullElementIds: hullOrder.map(i => ordered[i].id),
          size: ordered.length,
        })
      }
    }
  }

  faces.sort((a, b) => {
    const aFirst = Math.min(...a.hullElementIds.map(id => byId.get(id) as number))
    const bFirst = Math.min(...b.hullElementIds.map(id => byId.get(id) as number))
    return aFirst - bFirst
  })
  return faces
}

/** 平面凸包：返回共面凸多边形的相邻「无向边键」列表；非平面/退化返回 null。 */
function planarHullPolygon(pts: readonly P3[]): string[] | null {
  const n = pts.length
  if (n < 3) return null
  // 选面积最大的三点定平面（退化集合天然筛掉）
  let best = { i: 0, j: 1, k: 2, area: -1 }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const area = vecLen(vecCross(vecSub(pts[j], pts[i]), vecSub(pts[k], pts[i])))
        if (area > best.area) best = { i, j, k, area }
      }
    }
  }
  if (best.area < 1e-9) return null
  const o = pts[best.i]
  const u = vecSub(pts[best.j], o)
  const v = vecSub(pts[best.k], o)
  const norm = vecCross(u, v)
  const nLen = vecLen(norm)
  const nhat: P3 = [norm[0] / nLen, norm[1] / nLen, norm[2] / nLen]
  // 平面度：所有点到平面距离 ≤ diag*1e-3（布局生成的多面体面/环面共面度远好于此）
  const diag = Math.max(...pts.map(p => vecLen(vecSub(p, o))))
  const d0 = nhat[0] * o[0] + nhat[1] * o[1] + nhat[2] * o[2]
  for (const p of pts) {
    const dist = Math.abs(nhat[0] * p[0] + nhat[1] * p[1] + nhat[2] * p[2] - d0)
    if (dist > Math.max(1e-4, diag * 1e-3)) return null
  }
  // 平面正交基 (uhat, vhat)
  const ul = vecLen(u)
  const uhat: P3 = [u[0] / ul, u[1] / ul, u[2] / ul]
  const vhat = vecCross(nhat, uhat) // 与 nhat,uhat 正交
  const proj: [number, number][] = pts.map(p => {
    const d = vecSub(p, o)
    return [d[0] * uhat[0] + d[1] * uhat[1] + d[2] * uhat[2], d[0] * vhat[0] + d[1] * vhat[1] + d[2] * vhat[2]]
  })
  const hull = convexHull2D(proj)
  if (!hull) return null
  const edgeKeys: string[] = []
  for (let t = 0; t < hull.length; t++) {
    const a = hull[t]
    const b = hull[(t + 1) % hull.length]
    edgeKeys.push(a < b ? `${a}|${b}` : `${b}|${a}`)
  }
  return edgeKeys
}

/** 凸包顶点下标（环序），供渲染多边形。退化返回 [0..n-1]。 */
function convexHullOrderOf(pts: readonly P3[]): number[] {
  // 面已在 subgroupFaces 内经 planarHullPolygon 验证为平面凸多边形且面积>0，
  // 因此质心在多边形内部，「绕质心极角序」即凸包环序。
  const o: [number, number, number] = [0, 0, 0]
  for (const p of pts) {
    o[0] += p[0]; o[1] += p[1]; o[2] += p[2]
  }
  o[0] /= pts.length; o[1] /= pts.length; o[2] /= pts.length
  const u = vecSub(pts[1], pts[0])
  const v = vecSub(pts[2], pts[0])
  const idx = pts.map((_, i) => i)
  idx.sort((a, b) => {
    const da = vecSub(pts[a], o)
    const db = vecSub(pts[b], o)
    const angA = Math.atan2(da[0] * v[0] + da[1] * v[1] + da[2] * v[2], da[0] * u[0] + da[1] * u[1] + da[2] * u[2])
    const angB = Math.atan2(db[0] * v[0] + db[1] * v[1] + db[2] * v[2], db[0] * u[0] + db[1] * u[1] + db[2] * u[2])
    return angA - angB
  })
  return idx
}

/**
 * 列出几何上有面可用的子群候选（供 ⚙ 下拉）：
 * 真子群 |H|≥3，且 H 至少有一个陪集在给定布局/边约束下成面。
 * 大群（order>60，本地子群枚举超限）→ null，调用方提示不可用。
 */
export function listFaceSubgroups(
  group: Group,
  positions: readonly P3[],
  edgeKeys?: ReadonlySet<string>,
): FaceSubgroupResult[] | null {
  const all = findAllSubgroups(group)
  if (all.length === 0 && group.order > 60) return null
  const out: FaceSubgroupResult[] = []
  for (const sub of all) {
    if (sub.order < 3) continue
    const elementIds = sub.elements.map(e => e.id).sort()
    const faces = subgroupFaces(group, elementIds, positions, edgeKeys)
    if (!faces || faces.length === 0) continue
    out.push({
      elementIds,
      structure: subgroupStructureSymbol(group, elementIds),
      genLabel: sub.generators.map(g => g.label).join('·'),
      order: sub.order,
      index: sub.index,
      faces,
    })
  }
  out.sort((a, b) => a.order - b.order || a.genLabel.localeCompare(b.genLabel))
  return out
}

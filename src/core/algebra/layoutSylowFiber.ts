import type { Group, GroupElement } from '../types'
import { findSylowSubgroups } from './sylow'

/**
 * 三维点。项目 layouts3D 内部用 tuple（Vec3），此处按对象存——本布局的消费端
 * （R3F 场景与层导轨）按字段访问，比下标更可读。
 */
export interface FiberPoint {
  x: number
  y: number
  z: number
}

export type SylowFiberMode = 'auto' | 'cylinder' | 'torus'
export type SylowFiberResolvedMode = Exclude<SylowFiberMode, 'auto'>

export interface SylowFiberNode {
  /** `${layer}:${slot}` */
  key: string
  layer: number
  slot: number
  element: GroupElement
  position: FiberPoint
}

export interface SylowFiberEdge {
  key: string
  a: string
  b: string
  /** inner = 子群自身凯莱边；conj = 共轭映射（层间） */
  kind: 'inner' | 'conj'
  /** inner 边的生成元 id */
  actionId?: string
  /** 仅 conj 边：该元素同时属于相邻两层（Pᵢ ∩ Pᵢ₊₁），连线加粗以标示共享 */
  common?: boolean
}

export interface SylowFiberLayer {
  index: number
  /** 截面圆心（已居中） */
  center: FiberPoint
  /** 截面圆半径 */
  radius: number
  /** 该层在路径上的角度 */
  theta: number
  generatorIds: string[]
}

export interface SylowFiberLayout {
  mode: SylowFiberResolvedMode
  prime: number
  /** Sylow p-子群个数 n_p（= 层数） */
  nP: number
  /** Sylow p-子群阶 |P|（= 每层节点数） */
  pOrder: number
  nodes: SylowFiberNode[]
  edges: SylowFiberEdge[]
  layers: SylowFiberLayer[]
  /** 以原点为中心的包围球半径（相机自适应用） */
  boundsRadius: number
  /** 绕一圈共轭是否回到同一 slot；false 表示存在和乐扭转（端点缝线会错位） */
  closesCleanly: boolean
}

const DEFAULT_NODE_SPACING = 1.6
/** 层内相邻节点的最小弦长（防球相穿） */
const MIN_NODE_CHORD = 0.95
/** n_p 达到该值时默认走闭合环面，否则走弧状柱面 */
const DEFAULT_TORUS_THRESHOLD = 4

function findConjugator(
  group: Group,
  from: GroupElement[],
  to: GroupElement[],
): GroupElement | null {
  const target = new Set(to.map(e => e.id))
  for (const g of group.elements) {
    const inv = group.inverse(g)
    let ok = true
    for (const x of from) {
      const y = group.multiply(group.multiply(g, x), inv)
      if (!target.has(y.id)) {
        ok = false
        break
      }
    }
    if (ok) return g
  }
  return null
}

/**
 * 把全部 Sylow p-子群铺成一条共轭纤维化：
 *
 * - 每层 = 一个 Sylow p-子群，铺成垂直于路径的**截面圆**（|P| 个节点）；
 * - 层内边 = 该子群自身的凯莱边（按子群最小生成元）；
 * - 层间边 = 共轭映射 x ↦ gxg⁻¹ 的**逐点**连线（沿用同 slot 对齐，因此恒等元绕行时天然平行等长）。
 *
 * 路径为弧线时得柱面（n_p 少），为闭合大圆时得圆环面（n_p 多）。
 * n_p < 2（Sylow 子群唯一、正规）时无共轭轨道可铺，返回 null。
 */
export function layoutSylowFiber(
  group: Group,
  prime: number,
  opts: {
    mode?: SylowFiberMode
    nodeSpacing?: number
    torusThreshold?: number
  } = {},
): SylowFiberLayout | null {
  const {
    mode = 'auto',
    nodeSpacing = DEFAULT_NODE_SPACING,
    torusThreshold = DEFAULT_TORUS_THRESHOLD,
  } = opts

  const subs = findSylowSubgroups(group, prime)
  const k = subs.length
  if (k < 2) return null
  const m = subs[0].order
  if (m < 2) return null

  // ── slot 传播：第 i 层 slot j 的元素 = g·(第 i-1 层 slot j)·g⁻¹
  // 这样层间连线天然同 slot 对齐；绕行一圈的残余错位即共轭纤维化的和乐。
  const layerElements: GroupElement[][] = [subs[0].elements.slice()]
  const conjLinks: { fromLayer: number; fromSlot: number; toLayer: number; toSlot: number }[] = []
  for (let i = 0; i < k; i++) {
    const cur = layerElements[i]
    const targetIdx = (i + 1) % k
    const g = findConjugator(group, cur, subs[targetIdx].elements)
    if (!g) return null
    const inv = group.inverse(g)
    const next = cur.map(x => group.multiply(group.multiply(g, x), inv))
    if (i + 1 < k) {
      layerElements.push(next)
      for (let j = 0; j < m; j++) {
        conjLinks.push({ fromLayer: i, fromSlot: j, toLayer: i + 1, toSlot: j })
      }
    } else {
      const slotOfBase = new Map(layerElements[0].map((e, j) => [e.id, j]))
      for (let j = 0; j < m; j++) {
        const toSlot = slotOfBase.get(next[j].id)
        if (toSlot === undefined) return null
        conjLinks.push({ fromLayer: k - 1, fromSlot: j, toLayer: 0, toSlot })
      }
    }
  }
  const closesCleanly = conjLinks.every(l => l.fromSlot === l.toSlot)

  // ── 几何：截面圆半径由层内节点间距定；路径半径保证环有洞且不与自身相交
  const resolved: SylowFiberResolvedMode =
    mode === 'auto' ? (k >= torusThreshold ? 'torus' : 'cylinder') : mode
  // 截面圆半径：按层内相邻节点「弧长」定基调；m 很小时弧长≫弦长（m=2 时弦长只有弧长的
  // 0.64 倍），再补一条弦长下限，否则球会相切甚至相穿。
  const ringRadius = Math.max(
    (m * nodeSpacing) / (2 * Math.PI),
    MIN_NODE_CHORD / (2 * Math.sin(Math.PI / m)),
  )
  // 环内侧（半径 R-r）是整条纤维化最密的地方：相邻层的内侧点间距 = 2(R-r)·sin(δ/2)。
  // R 太小时内侧点会向轴心塌陷到几乎重合（截面圆互穿），故对 R 取「内侧不挤」硬约束。
  const minInnerGap = Math.max(0.9, nodeSpacing * 0.6)
  let pathRadius: number
  let delta: number
  if (resolved === 'torus') {
    delta = (2 * Math.PI) / k
    const sinHalf = Math.sin(Math.PI / k)
    pathRadius = Math.max(
      nodeSpacing / (2 * sinHalf),
      ringRadius + minInnerGap / (2 * sinHalf),
      1.05 * ringRadius,
    )
  } else {
    pathRadius = 3.4 * ringRadius
    // 层间距取 max(节点间距, 截面半径)：截面圆交叠约一半，有「密绕弹簧」的管感，
    // 又不至于三层几乎共面（m 大时截面圆很大，纯按节点间距排会让层完全嵌套）。
    const gap = Math.max(nodeSpacing, ringRadius)
    delta = 2 * Math.asin(Math.min(0.95, gap / (2 * pathRadius)))
  }
  const thetaOf = (i: number) =>
    resolved === 'torus' ? (2 * Math.PI * i) / k : (i - (k - 1) / 2) * delta

  const nodes: SylowFiberNode[] = []
  const layers: SylowFiberLayer[] = []
  for (let i = 0; i < k; i++) {
    const theta = thetaOf(i)
    const cx = pathRadius * Math.cos(theta)
    const cz = pathRadius * Math.sin(theta)
    const rx = Math.cos(theta)
    const rz = Math.sin(theta)
    layers.push({
      index: i,
      center: { x: cx, y: 0, z: cz },
      radius: ringRadius,
      theta,
      generatorIds: subs[i].generators.map(g => g.id),
    })
    for (let j = 0; j < m; j++) {
      const phi = (2 * Math.PI * j) / m
      nodes.push({
        key: `${i}:${j}`,
        layer: i,
        slot: j,
        element: layerElements[i][j],
        position: {
          x: cx + ringRadius * Math.cos(phi) * rx,
          y: ringRadius * Math.sin(phi),
          z: cz + ringRadius * Math.cos(phi) * rz,
        },
      })
    }
  }

  // ── 居中到原点，并给出包围球半径
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x)
    maxX = Math.max(maxX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxY = Math.max(maxY, n.position.y)
    minZ = Math.min(minZ, n.position.z)
    maxZ = Math.max(maxZ, n.position.z)
  }
  const ox = (minX + maxX) / 2
  const oy = (minY + maxY) / 2
  const oz = (minZ + maxZ) / 2
  let boundsRadius = 0
  for (const n of nodes) {
    n.position.x -= ox
    n.position.y -= oy
    n.position.z -= oz
    boundsRadius = Math.max(boundsRadius, Math.hypot(n.position.x, n.position.y, n.position.z))
  }
  for (const l of layers) {
    l.center.x -= ox
    l.center.y -= oy
    l.center.z -= oz
  }
  boundsRadius += nodeSpacing * 0.5

  // ── 边：层内凯莱边（同层）+ 层间共轭连线（跨层），按无向去重
  const edges: SylowFiberEdge[] = []
  const seen = new Set<string>()
  const pushEdge = (
    a: string,
    b: string,
    kind: 'inner' | 'conj',
    actionId?: string,
    common?: boolean,
  ) => {
    const [lo, hi] = a < b ? [a, b] : [b, a]
    const sig = `${kind}|${lo}|${hi}`
    if (seen.has(sig)) return
    seen.add(sig)
    edges.push({ key: sig, a, b, kind, actionId, common })
  }
  for (let i = 0; i < k; i++) {
    const slotOf = new Map(layerElements[i].map((e, j) => [e.id, j]))
    for (const gen of subs[i].generators) {
      for (let j = 0; j < m; j++) {
        const y = group.multiply(layerElements[i][j], gen)
        const jj = slotOf.get(y.id)
        if (jj === undefined || jj === j) continue
        pushEdge(`${i}:${j}`, `${i}:${jj}`, 'inner', gen.id)
      }
    }
  }
  const layerIdSets = subs.map(s => new Set(s.elements.map(e => e.id)))
  for (const l of conjLinks) {
    const x = layerElements[l.fromLayer][l.fromSlot]
    pushEdge(
      `${l.fromLayer}:${l.fromSlot}`,
      `${l.toLayer}:${l.toSlot}`,
      'conj',
      undefined,
      layerIdSets[l.toLayer].has(x.id),
    )
  }

  return {
    mode: resolved,
    prime,
    nP: k,
    pOrder: m,
    nodes,
    edges,
    layers,
    boundsRadius,
    closesCleanly,
  }
}

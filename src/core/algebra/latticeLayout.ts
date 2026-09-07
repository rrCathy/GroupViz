/**
 * 子群格布局（纯函数、零 React）：分层排布 + 同层重心排序 + 紧凑包围盒 + LOD 档位。
 *
 * 由 SubgroupLatticeView.tsx 的布局 useMemo 迁移而来，两处关键改动：
 *  1. 去掉 1000×600 的世界坐标下限——它让 6 节点的 S₃ 格也被撑到 1000 宽，
 *     塞进 520px 窗口时整体缩放 ~0.5、名片文字掉到 7px。改为"内容包围盒 +
 *     每层居中分槽"，缩放由宿主可用像素决定（latticeFitScale，钳 ≤ 1）。
 *  2. 同层顺序不再等于枚举序，改走 barycenter 扫描降交叉。
 */
import type { SubgroupLatticeNode, SubgroupLatticeEdge } from './subgroups'
import type { LatticeLodTier } from '../types'

/** 名片半宽/半高（世界单位，nodeScale = 1 时） */
export const LATTICE_CARD_RX = 80
export const LATTICE_CARD_RY = 36
/** 槽位屏幕宽/高同时达标 → full（完整名片，文字按世界单位随缩放走） */
export const LATTICE_LOD_FULL = 150
export const LATTICE_ROW_FULL = 66
/** 槽位屏幕宽/高达到胶囊底线 → compact（屏幕恒定胶囊，只留一行）；否则 dots */
export const LATTICE_LOD_COMPACT = 56
export const LATTICE_ROW_COMPACT = 26

export interface LatticeLayoutOptions {
  /** 名片与层距的世界单位乘子，缺省 1 */
  nodeScale?: number
  gapX?: number
  gapY?: number
  minWorldW?: number
  minWorldH?: number
  /** barycenter 扫描轮数，缺省 3（0 = 保持枚举序） */
  barycenterPasses?: number
}

export interface LatticeLayout {
  /** 下标 = 节点在 nodes 中的下标 */
  positions: { x: number; y: number }[]
  /** 同层排序后的节点下标（按 level 升序分组） */
  levelOrder: number[][]
  viewW: number
  viewH: number
  nodeRx: number
  nodeRy: number
  /** 同层节点槽位宽 / 层间行高（世界单位），LOD 与紧凑绘制据此封顶 */
  slotW: number
  rowH: number
  maxLevel: number
}

/** 按 level 分组的节点下标（保持组内传入序） */
function groupByLevel(nodes: Array<Pick<SubgroupLatticeNode, 'level'>>): number[][] {
  let maxLevel = 0
  nodes.forEach(nd => { if (nd.level > maxLevel) maxLevel = nd.level })
  const groups: number[][] = Array.from({ length: maxLevel + 1 }, () => [])
  nodes.forEach((nd, i) => { groups[nd.level].push(i) })
  return groups
}

/**
 * 同层重心排序（de Fraysseix/Purchase 式 barycenter）：交替自顶向下/自底向上
 * 扫描，把每层节点按其邻居在相邻层中的平均槽位重排。无邻居的节点保持原位
 * （以自身当前槽位为键），单节点层不变序。
 */
export function orderLevelsByBarycenter(
  levelOrder: number[][],
  edges: SubgroupLatticeEdge[],
  passes = 3
): number[][] {
  const order = levelOrder.map(g => [...g])
  const maxLevel = order.length - 1
  if (maxLevel <= 0 || passes <= 0) return order

  // 邻接表（无向；格边 from = 下层（阶小）、to = 上层（阶大））
  const nodeCount = order.reduce((s, g) => s + g.length, 0)
  const nbrs: number[][] = Array.from({ length: nodeCount }, () => [])
  for (const e of edges) {
    if (nbrs[e.from]) nbrs[e.from].push(e.to)
    if (nbrs[e.to]) nbrs[e.to].push(e.from)
  }

  const levelOf = new Array<number>(nodeCount).fill(0)
  order.forEach((group, level) => {
    for (const nodeIdx of group) levelOf[nodeIdx] = level
  })
  // slot[i] = 节点 i 在其所在层内的当前槽位
  const slot = new Array<number>(nodeCount).fill(0)
  const reindex = () => {
    for (const group of order) group.forEach((nodeIdx, s) => { slot[nodeIdx] = s })
  }
  reindex()

  for (let pass = 0; pass < passes; pass++) {
    const down = pass % 2 === 0
    const levels = down
      ? Array.from({ length: maxLevel + 1 }, (_, i) => i)
      : Array.from({ length: maxLevel + 1 }, (_, i) => maxLevel - i)
    for (const level of levels) {
      if (down ? level === 0 : level === maxLevel) continue // 锚定层不动
      const group = order[level]
      if (group.length <= 1) continue
      const referenceLevel = down ? level - 1 : level + 1
      const bary = new Map<number, number>()
      for (const nodeIdx of group) {
        let sum = 0
        let count = 0
        for (const nb of nbrs[nodeIdx] ?? []) {
          if (levelOf[nb] !== referenceLevel) continue
          sum += slot[nb]
          count++
        }
        // 无参考层邻居 → 用自身槽位作键，保持稳定
        bary.set(nodeIdx, count > 0 ? sum / count : slot[nodeIdx])
      }
      group.sort((a, b) => (bary.get(a) ?? 0) - (bary.get(b) ?? 0) || slot[a] - slot[b])
      reindex()
    }
  }
  return order
}

/** 同一对相邻层之间的两把边，端点槽位顺序相反即为交叉 */
export function countLatticeCrossings(
  levelOrder: number[][],
  edges: SubgroupLatticeEdge[]
): number {
  const levelOf = new Map<number, number>()
  const slotOf = new Map<number, number>()
  levelOrder.forEach((group, level) => {
    group.forEach((nodeIdx, slot) => {
      levelOf.set(nodeIdx, level)
      slotOf.set(nodeIdx, slot)
    })
  })
  const byPair = new Map<string, Array<[number, number]>>()
  for (const e of edges) {
    const la = levelOf.get(e.from)
    const lb = levelOf.get(e.to)
    if (la === undefined || lb === undefined || la === lb) continue
    const lo = Math.min(la, lb)
    const hi = Math.max(la, lb)
    // 只统计相邻层的边（跨层边在分层布局里必然穿过中间层，不计交叉）
    if (hi - lo !== 1) continue
    const bottom = la > lb ? e.from : e.to
    const top = la > lb ? e.to : e.from
    const key = `${lo}-${hi}`
    const arr = byPair.get(key) ?? []
    arr.push([slotOf.get(bottom) ?? 0, slotOf.get(top) ?? 0])
    byPair.set(key, arr)
  }
  let crossings = 0
  for (const arr of byPair.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [b1, t1] = arr[i]
        const [b2, t2] = arr[j]
        if (b1 === b2 || t1 === t2) continue
        if ((b1 - b2) * (t1 - t2) < 0) crossings++
      }
    }
  }
  return crossings
}

/**
 * 子群格布局：每层按 slotW 均分槽位并整体居中，层与层之间 rowH。
 * 世界坐标紧贴内容（无人为下限），故宿主可用像素直接决定可读性。
 */
export function computeLatticeLayout(
  nodes: Array<Pick<SubgroupLatticeNode, 'level'>>,
  edges: SubgroupLatticeEdge[],
  opts: LatticeLayoutOptions = {}
): LatticeLayout {
  const nodeScale = opts.nodeScale ?? 1
  const gapX = opts.gapX ?? 40
  const gapY = opts.gapY ?? 60
  const minWorldW = opts.minWorldW ?? 400
  const minWorldH = opts.minWorldH ?? 300
  const passes = opts.barycenterPasses ?? 3

  const nodeRx = LATTICE_CARD_RX * nodeScale
  const nodeRy = LATTICE_CARD_RY * nodeScale
  const slotW = nodeRx * 2 + gapX * nodeScale
  const rowH = nodeRy * 2 + gapY * nodeScale
  const pad = 40 * nodeScale

  const groups = groupByLevel(nodes)
  const levelOrder = orderLevelsByBarycenter(groups, edges, passes)
  const maxLevel = Math.max(levelOrder.length - 1, 0)
  const maxPerLevel = levelOrder.reduce((m, g) => Math.max(m, g.length), 0)

  const viewW = Math.max(maxPerLevel * slotW, minWorldW * nodeScale) + pad * 2
  const viewH = Math.max((maxLevel + 1) * rowH, minWorldH * nodeScale) + pad * 2

  const positions = new Array<{ x: number; y: number }>(nodes.length)
  levelOrder.forEach((group, level) => {
    const count = group.length
    group.forEach((nodeIdx, slot) => {
      if (nodeIdx < 0 || nodeIdx >= nodes.length) return
      positions[nodeIdx] = {
        x: viewW / 2 + (slot - (count - 1) / 2) * slotW,
        // level 0 = 阶最大（G）在顶，level 递增向下
        y: pad + rowH / 2 + level * rowH,
      }
    })
  })

  return { positions, levelOrder, viewW, viewH, nodeRx, nodeRy, slotW, rowH, maxLevel }
}

/**
 * 世界 → 屏幕的适配缩放：只缩小、不放大（钳 ≤ 1 保证名片不会在小窗里被撑大、
 * 主画布观感不突变）。宿主尺寸未知（首帧/测试环境测得 0）时返回 1。
 */
export function latticeFitScale(
  availW: number,
  availH: number,
  viewW: number,
  viewH: number
): number {
  if (!(availW > 0) || !(availH > 0) || !(viewW > 0) || !(viewH > 0)) return 1
  return Math.min(1, Math.min(availW / viewW, availH / viewH))
}

/** 槽位在当前缩放下占用的屏幕尺寸（px），LOD 判定的唯一依据 */
export function latticeSlotScreenSize(
  slotW: number,
  rowH: number,
  fitScale: number,
  zoomScale: number
): { slotScreenWidth: number; rowScreenHeight: number } {
  const k = fitScale * zoomScale
  return { slotScreenWidth: slotW * k, rowScreenHeight: rowH * k }
}

/**
 * 按槽位屏幕尺寸选档：宽和高都要达标（窄高的轨道格靠高度也能放下胶囊，
 * 单看宽度会误降级）。full 需要完整名片的 160×72 世界尺寸在屏幕上成立。
 */
export function latticeLodTier(slotScreenWidth: number, rowScreenHeight: number): LatticeLodTier {
  if (slotScreenWidth >= LATTICE_LOD_FULL && rowScreenHeight >= LATTICE_ROW_FULL) return 'full'
  if (slotScreenWidth >= LATTICE_LOD_COMPACT && rowScreenHeight >= LATTICE_ROW_COMPACT) return 'compact'
  return 'dots'
}

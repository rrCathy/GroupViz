import type { CayleyAction, Group, MultiplyType } from '../types'
import { resolveElement } from './elementRef'

/**
 * 凯莱图路径高亮解析（VCL）。
 *
 * 支持两种输入（二选一，`elements` 优先）：
 *  - `elements`：元素引用序列，相邻两项须由某条已启用作用边相连 → 高亮该顶点序列与连边；
 *  - `word`：生成元单词（元素引用序列，视为连续作用），从 `start`（缺省单位元）出发累乘
 *    → 自动算出 walk 顶点序列与每一步对应的作用边。
 *
 * 纯函数、零 UI 依赖，供渲染层与参数面板共用（二者对「路径长什么样」的判定必须一致）。
 *
 * 引用解析失败不抛错：记入 `unresolved`，对应项被忽略（与 `resolveElement` 的告警口径一致）。
 */
export interface ResolvedPathEdge {
  fromId: string
  toId: string
  /** 承载该步的作用元素 id；空串 = 该相邻对之间没有直接作用边（仅高亮节点，不画连边） */
  actionElementId: string
}

export interface ResolvedCayleyPath {
  /** 依次经过的节点 id */
  nodeIds: string[]
  /** 与相邻节点对一一对应的连边信息（长度 = nodeIds.length - 1，闭合时含收尾那条） */
  edges: ResolvedPathEdge[]
  /** 未能解析的引用（诊断用） */
  unresolved: string[]
}

export interface CayleyPathInput {
  elements?: string[]
  word?: string[]
  start?: string
  closed?: boolean
}

/** 构建「有序节点对 → 作用元素 id」查找表（已启用作用，缺省取首个命中）。
 *  **尊重边的方向**：自逆生成元的正反两条边会自然各自成键，无需额外兜底；
 *  非自逆生成元只在其真实方向连通（避免把 e0→e3 这类"反着走"的相邻对误判为有边）。 */
function buildOrderPairMap(
  group: Group,
  actions: CayleyAction[],
  multiplyType: MultiplyType,
): Map<string, string> {
  const idToEl = new Map(group.elements.map(el => [el.id, el]))
  const map = new Map<string, string>()
  for (const fromEl of group.elements) {
    for (const action of actions) {
      if (!action.enabled) continue
      const actionEl = idToEl.get(action.elementId)
      if (!actionEl) continue
      const toEl =
        multiplyType === 'right'
          ? group.multiply(fromEl, actionEl)
          : group.multiply(actionEl, fromEl)
      if (!toEl) continue
      const key = `${fromEl.id}|${toEl.id}`
      if (!map.has(key)) map.set(key, action.elementId)
    }
  }
  return map
}

export function resolveCayleyPath(
  group: Group | null | undefined,
  actions: CayleyAction[],
  multiplyType: MultiplyType,
  input: CayleyPathInput | null | undefined,
): ResolvedCayleyPath | null {
  if (!group || !input) return null

  const elements = input.elements?.filter(s => s != null && String(s).trim() !== '') ?? []
  const word = input.word?.filter(s => s != null && String(s).trim() !== '') ?? []

  if (elements.length > 0) {
    const unresolved: string[] = []
    const nodeIds: string[] = []
    for (const ref of elements) {
      const el = resolveElement(group, ref)
      if (!el) {
        unresolved.push(ref)
        continue
      }
      nodeIds.push(el.id)
    }
    if (nodeIds.length === 0) return { nodeIds, edges: [], unresolved }

    const pairMap = buildOrderPairMap(group, actions, multiplyType)
    const edges: ResolvedPathEdge[] = []
    for (let i = 0; i + 1 < nodeIds.length; i++) {
      const fromId = nodeIds[i]
      const toId = nodeIds[i + 1]
      edges.push({ fromId, toId, actionElementId: pairMap.get(`${fromId}|${toId}`) ?? '' })
    }
    return { nodeIds, edges, unresolved }
  }

  if (word.length > 0) {
    const unresolved: string[] = []
    const startEl = input.start ? resolveElement(group, input.start) : group.identity
    const start = startEl ?? group.identity

    const nodeIds: string[] = [start.id]
    const edges: ResolvedPathEdge[] = []
    let cur = start

    for (const ref of word) {
      const gen = resolveElement(group, ref)
      if (!gen) {
        unresolved.push(ref)
        continue
      }
      const next =
        multiplyType === 'right' ? group.multiply(cur, gen) : group.multiply(gen, cur)
      if (!next) {
        unresolved.push(ref)
        continue
      }
      nodeIds.push(next.id)
      edges.push({ fromId: cur.id, toId: next.id, actionElementId: gen.id })
      cur = next
    }

    // 闭合：末元素 != 起点时补一条回起点的收尾边（用于展示关系式，如 a²=e 之外的闭环）
    if (input.closed && nodeIds.length > 1 && cur.id !== start.id) {
      const pairMap = buildOrderPairMap(group, actions, multiplyType)
      nodeIds.push(start.id)
      edges.push({ fromId: cur.id, toId: start.id, actionElementId: pairMap.get(`${cur.id}|${start.id}`) ?? '' })
    }

    return { nodeIds, edges, unresolved }
  }

  return null
}

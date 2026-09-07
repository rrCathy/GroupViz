import type { Group } from '../types'
import { findAllSubgroups } from './subgroups'
import { subgroupConjugacyOrbits, subgroupSetKey } from './subgroups/conjugacy'
import { subgroupStructureSymbol } from './subgroups/detection'
import { computeCosets } from './subgroups/quotient'

/**
 * 陪集条带视图（FGVE 受控 ViewWindow）的子群候选选项。
 *
 * 主画布的 CosetStripView 由用户先在界面选一个子集（subset）再生成陪集数据；
 * 受控窗口是自包含的（group + viewParams 驱动），因此需要"从 group 直接列出
 * 可作 H 的真子群"的纯函数层。
 */
export interface CosetStripSubgroupOption {
  /** 规范键：H 元素 id 升序 join（与 series/子群格同约定，可做持久化恢复比对） */
  key: string
  /** H 的全部元素 id（升序） */
  elementIds: string[]
  /** 结构符号（TeX，如 `C_{2}\\times C_{2}` / `D_{4}`）；无法识别为 null */
  structure: string | null
  /** |H| */
  order: number
  /** [G:H] = 陪集条带数 */
  index: number
  /** 正规 ⇔ 共轭轨道长 1 */
  isNormal: boolean
  /** 共轭轨道长（非正规子群的同类数） */
  orbitSize: number
}

/**
 * 列出可作陪集条带 H 的非平凡真子群候选（按共轭轨道合并，一个轨道一个代表）。
 *
 * - 群阶 >60 本地枚举超限 → 返回 []（与 sublattice / findAllSubgroups 同守卫）；
 * - 共轭子群的陪集划分结构相同，合并为一个选项避免列表冗长（A₄: 6 个 C₂ + 4 个
 *   C₃ → 各一项），选项标注 orbitSize；
 * - 确定性排序：index 升序（条带少者在前）→ 轨道长降序 → 键字典序。
 */
export function listCosetStripSubgroups(group: Group): CosetStripSubgroupOption[] {
  const all = findAllSubgroups(group)
  const nonTrivial = all.filter(s => s.order > 1)
  if (nonTrivial.length === 0) return []

  const orbits = subgroupConjugacyOrbits(
    group,
    nonTrivial.map(s => ({ elementIds: s.elements.map(e => e.id) }))
  )

  const options: CosetStripSubgroupOption[] = orbits.map(ob => {
    const rep = nonTrivial[ob.repIndex]
    const elementIds = rep.elements.map(e => e.id).sort()
    return {
      key: subgroupSetKey(elementIds),
      elementIds,
      structure: subgroupStructureSymbol(group, elementIds),
      order: rep.order,
      index: rep.index,
      isNormal: ob.size === 1,
      orbitSize: ob.size,
    }
  })

  options.sort((a, b) => a.index - b.index || b.orbitSize - a.orbitSize || a.key.localeCompare(b.key))
  return options
}

/**
 * 持久化恢复：按候选键匹配 H 的元素 id 数组。
 * 换群后失效（不是 G 的真子群 / 本地不可枚举）→ 返回 null，调用方回退默认首候选。
 */
export function findCosetStripSubgroup(
  group: Group,
  elementIds: string[]
): CosetStripSubgroupOption | null {
  if (!elementIds || elementIds.length === 0) return null
  const key = subgroupSetKey(elementIds)
  return listCosetStripSubgroups(group).find(o => o.key === key) ?? null
}

/**
 * 由 H 的元素 id 计算陪集族（供窗口引擎自包含派生数据）。
 * 与 context/cosetActions.computeCosetData 等价但无 subsets 依赖，供 core 层直接调用。
 */
export function cosetDataForSubgroup(
  group: Group,
  subgroupElementIds: string[]
): ReturnType<typeof computeCosets> | null {
  if (!subgroupElementIds || subgroupElementIds.length === 0) return null
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const elements = subgroupElementIds
    .map(id => byId.get(id))
    .filter((el): el is NonNullable<typeof el> => el !== undefined)
  if (elements.length === 0) return null
  return computeCosets(group, {
    elements,
    order: elements.length,
    index: group.order / elements.length,
    generators: [],
    isNormal: false,
  })
}

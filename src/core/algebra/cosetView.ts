import type { Group } from '../types'
import { COSET_COLORS } from '../types'
import { type Subgroup, closeUnderMultiply, findMinimalGenerators } from './subgroups/shared'
import { computeCosets, type CosetInfo } from './subgroups/quotient'
import { resolveElementRefs, resolveElement } from './elementRef'

/**
 * 陪集视图数据的一键构建 —— 把「给定子群 H → 陪集条带 Scene 所需的一整套 props」
 * 从宿主手写胶水里收回到 core。
 *
 * 背景：`CosetStripScene` 吃 `cosetElementMap` / `cosetColors` / `cosetHighlightSet`
 * 三件套，但 core 门面只导出 `computeCosets`（原始陪集划分），三件套的派生逻辑此前
 * 只存在于主应用 `src/context/cosetActions.ts`，包消费端拿不到——于是只能整个跳过
 * 陪集视图。本模块把该派生逻辑下沉为纯函数并公开。
 *
 * 全部入参接受**元素引用**（`id` 或 `label`，见 `elementRef.ts`），不再是清一色 id。
 */

export type CosetSide = 'left' | 'right'

export interface CosetViewOptions extends SubgroupFromElementsOptions {
  /** 左陪集 / 右陪集族；缺省 `'left'`（与主应用一致） */
  side?: CosetSide
  /** `true` → 高亮全部陪集（主画布「显示全部陪集」）；缺省 `false`（只高亮含选中元素的陪集） */
  highlightAll?: boolean
  /** 参与高亮的已选元素（id 或 label 皆可）；缺省空 */
  selected?: Iterable<string>
}

export interface CosetViewData {
  /** H 的元素 id（升序，与 `subgroupSetKey` 同约定，可做持久化比对） */
  subgroupElementIds: string[]
  /** 原始陪集划分（含左右两侧与正规性判定） */
  cosets: CosetInfo
  /** 元素 id → 陪集下标（喂 `CosetStripScene.cosetElementMap`） */
  cosetElementMap: Map<string, number>
  /** 每陪集一色（喂 `cosetColors`） */
  cosetColors: string[]
  /** 需高亮的陪集下标（喂 `cosetHighlightSet`） */
  cosetHighlightSet: Set<number>
  /** 实际采用的左右侧 */
  side: CosetSide
}

/**
 * 给定元素引用集合是否构成子群：单位元在内 + 乘法封闭（闭包规模不变）。
 * 用于在装配陪集数据前**显式**判定，避免拿非子群去算陪集得到无意义结果。
 */
export function isSubgroupElementSet(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
): boolean {
  if (!group || !refs || refs.length === 0) return false
  const { elements } = resolveElementRefs(group, refs)
  if (elements.length === 0) return false
  if (!elements.some(el => el.id === group.identity.id)) return false
  return closeUnderMultiply(group, elements).length === elements.length
}

export interface SubgroupFromElementsOptions {
  /** 正规性标注初值（实际正规性由左右陪集比对给出） */
  isNormal?: boolean
  /** 是否校验乘法封闭（缺省 `true`）；主应用热路径确信入参已是子群，可传 `false` 省一轮闭包 */
  validate?: boolean
  /** 是否计算极小生成集（缺省 `true`）；不消费 `subgroup.generators` 时可传 `false` */
  computeGenerators?: boolean
}

/**
 * 由元素引用集合装配 `Subgroup`（默认含乘法封闭校验 + 极小生成集）。
 * 引用可混用 `id` / `label`；未命中项被忽略；集合非法（空 / 不含单位元 / 非子群）时返回 `null`。
 */
export function subgroupFromElementIds(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
  options: SubgroupFromElementsOptions = {},
): Subgroup | null {
  if (!group || !refs || refs.length === 0) return null
  const { elements } = resolveElementRefs(group, refs)
  if (elements.length === 0) return null
  if (options.validate !== false) {
    if (!elements.some(el => el.id === group.identity.id)) return null
    if (closeUnderMultiply(group, elements).length !== elements.length) return null
  }
  return {
    elements,
    order: elements.length,
    index: group.order / elements.length,
    generators: options.computeGenerators === false ? [] : findMinimalGenerators(elements, group),
    isNormal: options.isNormal ?? false,
  }
}

/** 元素 id → 陪集下标。 */
export function computeCosetElementMap(
  cosets: CosetInfo | null,
  side: CosetSide,
): Map<string, number> {
  const map = new Map<string, number>()
  if (!cosets) return map
  const list = side === 'left' ? cosets.leftCosets : cosets.rightCosets
  list.forEach((coset, idx) => {
    coset.forEach(el => map.set(el.id, idx))
  })
  return map
}

/** 每陪集一色（循环取 `COSET_COLORS`）。 */
export function computeCosetColors(cosets: CosetInfo | null, side: CosetSide): string[] {
  if (!cosets) return []
  const count = side === 'left' ? cosets.leftCosets.length : cosets.rightCosets.length
  return Array.from({ length: count }, (_, i) => COSET_COLORS[i % COSET_COLORS.length])
}

/**
 * 需高亮的陪集下标集合。`highlightAll` 时全部；否则只取含已选元素的陪集。
 *
 * `selectedElements` 必须是**规范元素 id**（label 请在 `buildCosetViewData` 里
 * 先经 `resolveElement` 归一，或自行调用 `resolveElementIds`）。
 */
export function computeCosetHighlightSet(
  cosets: CosetInfo | null,
  side: CosetSide,
  highlightAll: boolean,
  selectedElements: Iterable<string>,
  cosetElementMap: Map<string, number>,
): Set<number> {
  const set = new Set<number>()
  if (!cosets) return set
  if (highlightAll) {
    const count = side === 'left' ? cosets.leftCosets.length : cosets.rightCosets.length
    for (let i = 0; i < count; i++) set.add(i)
    return set
  }
  for (const id of selectedElements) {
    const idx = cosetElementMap.get(id)
    if (idx !== undefined) set.add(idx)
  }
  return set
}

/**
 * 一键装配陪集视图数据。
 *
 * @param subgroupRefs H 的元素引用（`id` 或 `label` 混合皆可）
 * @returns H 非法（空集 / 不含单位元 / 非子群）时返回 `null`，调用方据此显示空态文案
 */
export function buildCosetViewData(
  group: Group | null | undefined,
  subgroupRefs: readonly string[] | null | undefined,
  options: CosetViewOptions = {},
): CosetViewData | null {
  if (!group) return null
  const subgroup = subgroupFromElementIds(group, subgroupRefs, {
    isNormal: options.isNormal,
    validate: options.validate,
    computeGenerators: options.computeGenerators,
  })
  if (!subgroup) return null
  const side: CosetSide = options.side ?? 'left'
  const cosets = computeCosets(group, subgroup)
  const cosetElementMap = computeCosetElementMap(cosets, side)
  const selected = [...(options.selected ?? [])].map(ref => {
    const el = resolveElement(group, ref)
    return el ? el.id : ref
  })
  const cosetHighlightSet = computeCosetHighlightSet(
    cosets,
    side,
    options.highlightAll ?? false,
    selected,
    cosetElementMap,
  )
  return {
    subgroupElementIds: subgroup.elements.map(el => el.id).sort(),
    cosets,
    cosetElementMap,
    cosetColors: computeCosetColors(cosets, side),
    cosetHighlightSet,
    side,
  }
}

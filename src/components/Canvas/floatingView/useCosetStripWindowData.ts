// ── cosetstrip 窗口数据派生（B2 自 ViewWindow.tsx 抽出，逻辑未动）──
import { useMemo } from 'react'
import type { Group, ViewMode } from '../../../core/types'
import type { CosetStripViewParams } from '../../../core/types/viewConfig'
import { listCosetStripSubgroups, cosetDataForSubgroup, type CosetStripSubgroupOption } from '../../../core/algebra/cosetStrip'
import { computeCosetElementMap, computeCosetColors, computeCosetHighlightSet } from '../../../context/cosetActions'
import type { ViewParams } from './types'

export function useCosetStripWindowData({
  view, group, viewParams, sel,
}: {
  view: ViewMode
  group?: Group | null
  viewParams: ViewParams
  sel: Set<string>
}) {

  // ── cosetstrip 窗口数据派生（自包含，不依赖主应用 subsets 状态） ──────
  // 候选子群 = listCosetStripSubgroups（共轭轨道合并、index 升序）；viewParams.subgroup
  // 失效（换群/手改坏值/非真子群）→ 回退默认首候选。H 确定后经 cosetDataForSubgroup
  // → elementMap/colors/highlight 喂给 CosetStripScene（与主画布同一渲染内核）。
  const cosetStripVp = viewParams as CosetStripViewParams
  const csOpts = useMemo<CosetStripSubgroupOption[]>(
    () => (view === 'cosetstrip' && group ? listCosetStripSubgroups(group) : []),
    [view, group],
  )
  const csSubgroup = useMemo<CosetStripSubgroupOption | null>(() => {
    if (view !== 'cosetstrip' || !group || csOpts.length === 0) return null
    const want = cosetStripVp.subgroup ? [...cosetStripVp.subgroup].sort().join(',') : null
    const match = want ? csOpts.find(o => o.key === want) : undefined
    return match ?? csOpts[0]
  }, [view, group, csOpts, cosetStripVp.subgroup])
  const csType = cosetStripVp.cosetType ?? 'left'
  const csCosetData = useMemo(() => {
    if (view !== 'cosetstrip' || !group || !csSubgroup) return null
    return cosetDataForSubgroup(group, csSubgroup.elementIds)
  }, [view, group, csSubgroup])
  const csElementMap = useMemo(
    () => (csCosetData ? computeCosetElementMap(csCosetData, csType) : null),
    [csCosetData, csType],
  )
  const csColors = useMemo(
    () => (csCosetData ? computeCosetColors(csCosetData, csType) : []),
    [csCosetData, csType],
  )
  const csHighlight = useMemo(
    () => (csCosetData && csElementMap
      ? computeCosetHighlightSet(csCosetData, csType, false, sel, csElementMap)
      : new Set<number>()),
    [csCosetData, csType, sel, csElementMap],
  )

  return { cosetStripVp, csOpts, csSubgroup, csType, csElementMap, csColors, csHighlight }
}

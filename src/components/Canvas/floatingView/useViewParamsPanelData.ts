// ── 参数面板数据派生（sublattice / cayley / cayley3d / 面填充）（B2 抽自 ViewWindow.tsx）──
import { useMemo, useCallback } from 'react'
import type { Group, ViewMode, CayleyShape2D, Layout3D } from '../../../core/types'
import type { SetViewParams, CayleyViewParams, Cayley3DViewParams, CycleViewParams, TableViewParams, SublatticeViewParams, HomomorphismViewParams, Cayley3DFaceFillParams } from '../../../core/types/viewConfig'
import { getDefaultShape2D, getAvailableShapesForView, getDefaultLayout3D, getAvailableShapes3D } from '../../../core/types'
import { compute3DPositions } from '../../../core/algebra/layout3D'
import { listFaceSubgroups, buildUndirectedEdgeKeys, type FaceSubgroupResult } from '../../../core/algebra/faces3D'
import { computeCayleyActionEdges } from '../../../core/algebra/forceLayout'
import { normalizeCayleyActions } from '../../../context/cayleyActions'
import type { ViewParams, ViewParamsPatch } from './types'

export function useViewParamsPanelData({
  view, group, viewParams, updateViewParams,
}: {
  view: ViewMode
  group?: Group | null
  viewParams: ViewParams
  updateViewParams: (p: ViewParamsPatch) => void
}) {

  // ── sublattice 视图参数面板数据 ──
  const sublatticeParams = viewParams as SublatticeViewParams
  // table 参数面板数据（tableMinSize 侧的同名量在 useTableMinSize 内）
  const tableVp = viewParams as TableViewParams

  // ── cayley 视图参数面板数据（与 CayleyView 渲染层同一套缺省/归一化规则） ──
  const cayleyShapes = useMemo<CayleyShape2D[]>(
    () => (view === 'cayley' && group ? getAvailableShapesForView(group, 'cayley') : []),
    [view, group],
  )
  const cayleyVp = viewParams as CayleyViewParams
  const setVp = viewParams as SetViewParams
  const cycleVp = viewParams as CycleViewParams
  const homoVp = viewParams as HomomorphismViewParams
  const cayleyDefaultShape = useMemo<CayleyShape2D>(
    () => (group ? getDefaultShape2D(group) : 'circular'),
    [group],
  )
  const cayleyShapeValue: CayleyShape2D =
    view === 'cayley' && cayleyVp.shape2D && cayleyShapes.includes(cayleyVp.shape2D)
      ? cayleyVp.shape2D
      : cayleyDefaultShape
  const cayleyActionsList = useMemo(
    () => (view === 'cayley' && group ? normalizeCayleyActions(group, cayleyVp.actions) : []),
    [view, group, cayleyVp.actions],
  )
  const cayleyEnabledCount = useMemo(
    () => cayleyActionsList.filter(a => a.enabled).length,
    [cayleyActionsList],
  )

  // 逐生成元边长：写回 actions[].lengthScale（未启用项忽略）
  const setCayleyActionLength = useCallback((elementId: string, lengthScale: number) => {
    const next = cayleyActionsList.map(a => (a.elementId === elementId ? { ...a, lengthScale } : a))
    updateViewParams({ actions: next })
  }, [cayleyActionsList, updateViewParams])

  // ── cayley3d 视图参数面板数据（与 Cayley3DScene 渲染层同一套缺省/归一化规则） ──
  const shapes3d = useMemo<Layout3D[]>(
    () => (view === '3d' && group ? getAvailableShapes3D(group) : []),
    [view, group],
  )
  const p3d = viewParams as Cayley3DViewParams
  const layout3dDefault = useMemo<Layout3D>(
    () => (group ? getDefaultLayout3D(group) : 'cone'),
    [group],
  )
  const layout3dValue: Layout3D =
    view === '3d' && p3d.layout3D && shapes3d.includes(p3d.layout3D)
      ? p3d.layout3D
      : layout3dDefault
  const cayley3dActionsList = useMemo(
    () => (view === '3d' && group ? normalizeCayleyActions(group, p3d.actions) : []),
    [view, group, p3d.actions],
  )
  const cayley3dEnabledCount = useMemo(
    () => cayley3dActionsList.filter(a => a.enabled).length,
    [cayley3dActionsList],
  )

  // 3D 逐生成元边长：写回 actions[].lengthScale（与 2D 同一套语义，未启用项忽略）
  const setCayley3DActionLength = useCallback((elementId: string, lengthScale: number) => {
    const next = cayley3dActionsList.map(a => (a.elementId === elementId ? { ...a, lengthScale } : a))
    updateViewParams({ actions: next })
  }, [cayley3dActionsList, updateViewParams])

  // ── 3D 面填充：几何上有陪集面可用的子群候选（作者在此选择 H） ──
  const faceSubgroupCands = useMemo<FaceSubgroupResult[]>(() => {
    if (view !== '3d' || !group) return []
    const actions = cayley3dActionsList.filter(a => a.enabled)
    const positions = compute3DPositions(group, layout3dValue)
    const edges = computeCayleyActionEdges(group, actions, p3d.multiplyType ?? 'right')
    const edgeKeys = buildUndirectedEdgeKeys(edges.map(e => [e.fromIdx, e.toIdx] as [number, number]))
    return (
      listFaceSubgroups(
        group,
        positions.map(v => [v[0], v[1], v[2]] as [number, number, number]),
        edgeKeys,
      ) ?? []
    )
  }, [view, group, cayley3dActionsList, layout3dValue, p3d.multiplyType])
  // 当前选中的 H（与候选匹配 → 其分面渲染在面板上）；换群/换布局后失效则回到未选
  const faceSelSubgroup = useMemo<FaceSubgroupResult | null>(() => {
    const ff = p3d.faceFill
    if (!ff?.subgroup || ff.subgroup.length === 0) return null
    const key = ff.subgroup.join(',')
    return faceSubgroupCands.find(c => c.elementIds.join(',') === key) ?? null
  }, [faceSubgroupCands, p3d.faceFill])
  const faceOn = p3d.faceFill?.enabled !== false && !!faceSelSubgroup
  const patchFaceFill = useCallback(
    (patch: Partial<Cayley3DFaceFillParams>) => {
      updateViewParams({ faceFill: { ...(p3d.faceFill ?? {}), ...patch } } as Partial<Cayley3DViewParams>)
    },
    [updateViewParams, p3d.faceFill],
  )

  return {
    sublatticeParams, tableVp, cayleyShapes, cayleyVp, setVp, cycleVp, homoVp, cayleyShapeValue,
    cayleyActionsList, cayleyEnabledCount, setCayleyActionLength,
    shapes3d, p3d, layout3dValue, cayley3dActionsList, cayley3dEnabledCount, setCayley3DActionLength,
    faceSubgroupCands, faceSelSubgroup, faceOn, patchFaceFill,
  }
}

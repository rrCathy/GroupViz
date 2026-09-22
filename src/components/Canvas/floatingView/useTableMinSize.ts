// ── 乘法表窗口最小尺寸（TableView 上报尺寸 + 小群推导，渲染期撑窗）（B2 抽自 ViewWindow.tsx）──
import { useState, useMemo } from 'react'
import type { Group, ViewMode } from '../../../core/types'
import type { TableViewParams } from '../../../core/types/viewConfig'
import { TABLE_PAD_W, TABLE_PAD_H } from '../TableView'
import { MIN_W, MIN_H, TBAR_H } from './geometry'
import type { VwGeometry } from './geometry'
import type { ViewParams } from './types'

export function useTableMinSize({
  view, group, viewParams, geometry, setGeometry,
}: {
  view: ViewMode
  group?: Group | null
  viewParams: ViewParams
  geometry: VwGeometry
  setGeometry: React.Dispatch<React.SetStateAction<VwGeometry>>
}) {

  // 乘法表实际渲染内容尺寸（TableView 经 onLayoutSize 上报），用于设定最小窗口尺寸
  const [tableLayoutSize, setTableLayoutSize] = useState<{ width: number; height: number } | null>(null)
  // ── 乘法表窗口最小尺寸 ──────────────────────────────────────
  // 最小尺寸 = 完整表格内容（行数×cellSize + 表头/页脚）+ 标题栏，保证整张表可见。
  // 优先用 TableView 上报的精确尺寸（覆盖大群抽样/随机策略）；小群（≤16 阶）回调未
  // 到前可直接推导 k=n，避免首帧跳动。仅普通乘法表（含文字）设置最小尺寸；热力图不设。
  const tableVp = viewParams as TableViewParams
  const tableMinSize = useMemo<{ width: number; height: number } | null>(() => {
    if (view !== 'table' || !group) return null
    if (tableLayoutSize) {
      return {
        width: Math.max(MIN_W, tableLayoutSize.width),
        height: Math.max(MIN_H, tableLayoutSize.height + TBAR_H),
      }
    }
    if (group.order <= 16) {
      const cell = tableVp.cellSize ?? 50
      const k = group.order
      return {
        width: Math.max(MIN_W, k * cell + TABLE_PAD_W),
        height: Math.max(MIN_H, k * cell + TABLE_PAD_H + TBAR_H),
      }
    }
    return null
  }, [view, group, tableLayoutSize, tableVp.cellSize])

  // 渲染期调整：表格尺寸变大（换群/改策略/改单元格尺寸）时把窗口撑到最小所需尺寸
  if (tableMinSize && (geometry.size.width < tableMinSize.width || geometry.size.height < tableMinSize.height)) {
    setGeometry(g =>
      g.size.width < tableMinSize.width || g.size.height < tableMinSize.height
        ? { ...g, size: { width: Math.max(g.size.width, tableMinSize.width), height: Math.max(g.size.height, tableMinSize.height) } }
        : g,
    )
  }

  return { tableLayoutSize, setTableLayoutSize, tableMinSize }
}

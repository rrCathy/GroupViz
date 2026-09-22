// ── 窗口内容区 pan/zoom（Ctrl+滚轮缩放 / 拖拽平移 / 双击复位）（B2 抽自 ViewWindow.tsx）──
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ViewMode, CanvasTransform } from '../../../core/types'
import type { ViewWindowConfig } from '../../../core/types/viewConfig'
import type { VwGeometry } from './geometry'
import { TBAR_H } from './geometry'
import type { ActionEditState } from './types'

export function useWindowViewport({
  view, config, actionEdit, geometry,
}: {
  view: ViewMode
  config: ViewWindowConfig
  actionEdit: ActionEditState | null
  geometry: VwGeometry
}) {

  // Content area pan/zoom
  const viewportRef = useRef<HTMLDivElement>(null)
  const [ct, setCt] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const ctDragRef = useRef({ sx: 0, sy: 0, tx: 0, ty: 0, active: false })

  const contentH = geometry.size.height - TBAR_H
  const contentW = geometry.size.width
  const vbSize = { width: contentW, height: contentH }

  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 8

  // 原生非 passive wheel 监听 —— React 合成 wheel 是 passive，preventDefault 失效且会报错。
  // 仅 Ctrl/Cmd+滚轮 缩放；普通滚轮放行给页面滚动，避免与长页滚动冲突。
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (view === '3d' || view === 'symmetry') return
      // action custom 编辑模式：滚轮缩放会缩走编辑器（主画布编辑态同样不吃 transform），禁用
      if (view === 'action' && actionEdit) return
      if (!e.ctrlKey && !e.metaKey) return
      if (config.zoomLocked) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vw = contentW; const vh = contentH
      const scale = Math.min(rect.width / vw, rect.height / vh)
      const offX = (rect.width - vw * scale) / 2
      const offY = (rect.height - vh * scale) / 2
      const mx = (e.clientX - rect.left - offX) / scale
      const my = (e.clientY - rect.top - offY) / scale
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, ct.scale * factor))
      const sc = ns / ct.scale
      setCt({ x: mx - (mx - ct.x) * sc, y: my - (my - ct.y) * sc, scale: ns })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ct, config.zoomLocked, contentW, contentH, view, actionEdit])

  const onCtMDown = useCallback((e: React.MouseEvent) => {
    if (view === '3d' || view === 'symmetry') return
    // action custom 编辑模式：拖拽平移与画箭头手势冲突，禁用
    if (view === 'action' && actionEdit) return
    if (config.locked || config.zoomLocked) return
    if ((e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('foreignObject')) return
    ctDragRef.current = { sx: e.clientX, sy: e.clientY, tx: ct.x, ty: ct.y, active: true }
  }, [ct, config.locked, config.zoomLocked, view, actionEdit])

  // 缩放围绕视图中心而非原点：避免凯莱图（默认居中）被"推"向左上并被裁剪
  const setZoomScale = useCallback((v: number) => {
    const cx = vbSize.width / 2
    const cy = vbSize.height / 2
    setCt(prev => {
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v))
      const sc = ns / prev.scale
      return { x: cx - (cx - prev.x) * sc, y: cy - (cy - prev.y) * sc, scale: ns }
    })
  }, [vbSize.width, vbSize.height])

  const zoomBy = useCallback((f: number) => {
    const cx = vbSize.width / 2
    const cy = vbSize.height / 2
    setCt(prev => {
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.scale * f))
      const sc = ns / prev.scale
      return { x: cx - (cx - prev.x) * sc, y: cy - (cy - prev.y) * sc, scale: ns }
    })
  }, [vbSize.width, vbSize.height])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ctDragRef.current.active) return
      const dx = e.clientX - ctDragRef.current.sx
      const dy = e.clientY - ctDragRef.current.sy
      setCt(prev => ({ ...prev, x: ctDragRef.current.tx + dx, y: ctDragRef.current.ty + dy }))
    }
    const onUp = () => { ctDragRef.current.active = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const resetCt = useCallback(() => setCt({ x: 0, y: 0, scale: 1 }), [])

  return {
    viewportRef, ct, contentW, contentH, vbSize, ZOOM_MIN, ZOOM_MAX,
    onCtMDown, setZoomScale, zoomBy, resetCt,
  }
}

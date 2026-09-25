// ── ViewWindow 窗口拖拽 / 8 向 resize（rAF 节流）与置顶 z 序（B2 自 ViewWindow.tsx 抽出）──
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ViewWindowConfig } from '../../../core/types/viewConfig'
import type { VwGeometry, ResizeDir } from './geometry'
import { clampResize } from './geometry'

let _vwZ = 5000

export function useWindowDragResize({
  geometry, setGeometry, config, tableMinSize,
}: {
  geometry: VwGeometry
  setGeometry: React.Dispatch<React.SetStateAction<VwGeometry>>
  config: ViewWindowConfig
  tableMinSize: { width: number; height: number } | null
}) {

  const [z, setZ] = useState(() => ++_vwZ)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeDir | null>(null)
  // resizable=false：宿主禁止用户调整窗口尺寸（隐藏 resize 手柄，移动不受影响）
  const resizable = config.resizable !== false

  const dragRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 })
  const resizeRef = useRef({ sx: 0, sy: 0, geo: geometry })

  const bringFront = useCallback(() => setZ(++_vwZ), [])

  // Update resizeRef when geometry changes (but NOT during active drag/resize —
  // resize needs the original start geometry as its baseline).
  useEffect(() => {
    if (!dragging && !resizing) resizeRef.current.geo = geometry
  }, [geometry, dragging, resizing])
  // Drag
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (config.locked) return
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: geometry.position.x, py: geometry.position.y }
  }, [geometry.position, config.locked])

  // Resize
  const onResizeStart = useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    if (config.locked || !resizable) return
    e.stopPropagation()
    bringFront()
    setResizing(dir)
    resizeRef.current = { sx: e.clientX, sy: e.clientY, geo: geometry }
  }, [bringFront, geometry, config.locked, resizable])

  // Window drag/resize — rAF-throttled so it stays smooth even on slow frames.
  const windowMoveRaf = useRef<number>(0)
  // 最近一次鼠标位置：松手时用它补上被节流吞掉的那一帧（见 onUp）
  const lastMove = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const applyMove = (clientX: number, clientY: number) => {
      const dx = clientX - dragRef.current.sx
      const dy = clientY - dragRef.current.sy
      if (resizing) {
        const rdx = clientX - resizeRef.current.sx
        const rdy = clientY - resizeRef.current.sy
        setGeometry(clampResize(resizing, resizeRef.current.geo, rdx, rdy, tableMinSize ?? undefined))
      } else if (dragging) {
        setGeometry(prev => ({
          ...prev,
          position: {
            x: Math.max(0, dragRef.current.px + dx),
            y: Math.max(0, dragRef.current.py + dy),
          }
        }))
      }
    }

    const onMove = (e: MouseEvent) => {
      if (!dragging && !resizing) return
      lastMove.current = { x: e.clientX, y: e.clientY }
      if (windowMoveRaf.current) return
      windowMoveRaf.current = requestAnimationFrame(() => {
        windowMoveRaf.current = 0
        const p = lastMove.current
        if (p) applyMove(p.x, p.y)
      })
    }
    const onUp = () => {
      // 松手前先把挂起的那一帧补上：mousemove 与 mouseup 可能落在**同一帧**
      //（快速拖拽 / 脚本化拖拽），直接清状态会让 cleanup 取消 rAF,
      // 窗口停在上一次渲染的位置——用户看到"松手没到位"。
      if (windowMoveRaf.current) {
        cancelAnimationFrame(windowMoveRaf.current)
        windowMoveRaf.current = 0
        const p = lastMove.current
        if (p) applyMove(p.x, p.y)
      }
      lastMove.current = null
      setDragging(false)
      setResizing(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (windowMoveRaf.current) { cancelAnimationFrame(windowMoveRaf.current); windowMoveRaf.current = 0 }
    }
    // setGeometry 为 hook 参数透出的 useState setter（引用稳定）
  }, [dragging, resizing, tableMinSize, setGeometry])

  return { z, bringFront, dragging, resizing, resizable, onDragStart, onResizeStart }
}

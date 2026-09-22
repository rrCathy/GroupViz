// ── 老式悬浮窗外壳（context 壳，自 FloatingViewWindow.tsx 拆出，纯搬家）──
// 独立 canvasTransform/nodePositions/localZCounter，经 GroupContext.Provider
// 覆盖后注入；内容分发走 renderViewContent（见 lazyViews.tsx）。
// 新式受控窗口见 ViewWindow.tsx（FGVE 引擎路径）。
import { useState, useCallback, useRef } from 'react'
import { GroupContext } from '../../../context/GroupContext'
import type { GroupContextType } from '../../../context/GroupContext'
import { useGroup } from '../../../context/useGroup'
import { useTheme } from '../../../theme/useTheme'
import type { ViewMode, CanvasTransform } from '../../../core/types'
import { getViewBoxSize } from '../../../core/viewBox'
import { renderViewContent } from './lazyViews'

let globalZCounter = 1000

export function FloatingViewWindow({ id, view, title }: { id: string; view: ViewMode; title: string }) {
  const globalCtx = useGroup()
  const { viewWindowTheme } = useTheme()
  
  const [position, setPosition] = useState({ x: 100 + globalCtx.floatingViews.length * 40, y: 80 + globalCtx.floatingViews.length * 30 })
  // 乘法表窗口最小尺寸：含文字需看清，最小 = viewBox + 标题栏
  const legacyTableMin = (() => {
    if (view !== 'table') return null
    const g = globalCtx.currentGroup
    if (!g || g.order > 100) return null
    const vb = getViewBoxSize(g.order, 'table')
    return {
      width: Math.min(900, vb.width),
      height: Math.min(900, vb.height + 40),
    }
  })()
  const [size, setSize] = useState(() => {
    if (legacyTableMin) return { width: Math.max(500, legacyTableMin.width), height: Math.max(400, legacyTableMin.height) }
    return { width: 500, height: 400 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [zIndex, setZIndex] = useState(() => ++globalZCounter)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const bringToFront = useCallback(() => {
    setZIndex(++globalZCounter)
  }, [])

  const [localTransform, setLocalTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 })
  const [localNodePositions, setLocalNodePositions] = useState<Map<string, Map<string, { x: number; y: number }>>>(new Map())

  const setCanvasTransformLocal = useCallback((t: Partial<CanvasTransform>) => {
    setLocalTransform(prev => ({ ...prev, ...t }))
  }, [])

  const resetCanvasTransformLocal = useCallback(() => {
    setLocalTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  const getNodePositionLocal = useCallback((elementId: string) => {
    return localNodePositions.get(view)?.get(elementId)
  }, [localNodePositions, view])

  const setNodePositionLocal = useCallback((elementId: string, x: number, y: number) => {
    setLocalNodePositions(prev => {
      const next = new Map(prev)
      const viewPositions = next.get(view) || new Map()
      const updated = new Map(viewPositions)
      updated.set(elementId, { x, y })
      next.set(view, updated)
      return next
    })
  }, [view])

  const batchSetNodePositionsLocal = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setLocalNodePositions(prev => {
      const next = new Map(prev)
      next.set(view, positions)
      return next
    })
  }, [view])

  const localOverrides = {
    ...globalCtx,
    currentView: view,
    canvasTransform: localTransform,
    setCanvasTransform: setCanvasTransformLocal,
    resetCanvasTransform: resetCanvasTransformLocal,
    getNodePosition: getNodePositionLocal,
    setNodePosition: setNodePositionLocal,
    batchSetNodePositions: batchSetNodePositionsLocal,
    nodePositions: localNodePositions,
    // 悬浮窗用自身视图计算 viewBox（尤其 table 的紧凑 400~1800 尺寸，避免误用主画布的 2000×2000 导致表格被缩得很小）
    viewBoxSize: globalCtx.currentGroup
      ? getViewBoxSize(globalCtx.currentGroup.order, view, globalCtx.forceShowLargeGroupViews.has(view))
      : globalCtx.viewBoxSize,
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y }
  }, [position])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    bringToFront()
    setIsResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
  }, [size, bringToFront])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: Math.max(0, dragStart.current.px + dx),
        y: Math.max(0, dragStart.current.py + dy)
      })
    }
    if (isResizing) {
      const dw = e.clientX - resizeStart.current.x
      const dh = e.clientY - resizeStart.current.y
      setSize({
        width: Math.max(legacyTableMin?.width ?? 280, resizeStart.current.w + dw),
        height: Math.max(legacyTableMin?.height ?? 200, resizeStart.current.h + dh)
      })
    }
  }, [isDragging, isResizing, legacyTableMin])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  return (
    <GroupContext.Provider value={localOverrides as GroupContextType}>
      <div
        className="floating-view-window"
        data-theme={viewWindowTheme}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: zIndex,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          background: 'var(--bg-primary)',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={bringToFront}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="floating-view-titlebar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            background: 'var(--bg-interactive)',
            borderBottom: '1px solid var(--border-primary)',
            cursor: 'grab',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            userSelect: 'none',
            flexShrink: 0,
          }}
          onMouseDown={handleDragStart}
        >
          <span style={{ fontWeight: 500 }}>{title}</span>
          <button
            onClick={() => globalCtx.closeFloatingView(id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = '#f44')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-dim)')}
          >
            ×
          </button>
        </div>
        
        <div
          className="floating-view-content"
          onMouseDownCapture={bringToFront}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {renderViewContent(view)}
        </div>
        
        <div
          className="floating-view-resizer"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 28,
            height: 28,
            cursor: 'nwse-resize',
            zIndex: 9999,
            borderRadius: '0 0 8px 0',
          }}
          onMouseDown={handleResizeStart}
        >
          <svg width={28} height={28} style={{ display: 'block', opacity: 0.5 }}>
            <path d="M26 26 L26 14 L14 26 Z M26 26 L26 20 L20 26 Z" fill="#555" />
          </svg>
        </div>
      </div>
    </GroupContext.Provider>
  )
}

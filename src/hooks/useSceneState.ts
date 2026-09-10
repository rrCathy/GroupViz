import { createElement, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CanvasTransform, Group, GroupElement, NodePosition } from '../core/types'
import { SceneHoverBubble } from '../components/Canvas/SceneHoverBubble'

/**
 * useSceneState —— 受控 Scene 的「四件套」便利层。
 *
 * 背景：`SetView` / `CycleView` / `CayleyView` / `CosetStripScene` 都是纯受控内核，
 * 宿主必须自备 `selectedElements` + `canvasTransform` + `viewBoxSize`，再自己接
 * `onSelect` / `onHover` 并渲染 hover 气泡。一个「嵌一张图」的最小用例要写 ~80 行胶水
 * （ResizeObserver 量尺寸、滚轮缩放贴光标、拖拽平移、⊕/Ctrl 多选、悬停锚点气泡）。
 *
 * 本 hook 把这一层收进包里：返回 `hostProps` + `sceneProps` + `hoverBubble`，
 * 宿主只需
 *
 * ```tsx
 * const group = createGroupFromSymbol('S_{4}')
 * const s = useSceneState(group)
 * return (
 *   <div {...s.hostProps}>
 *     <SetView group={group} {...s.sceneProps} />
 *     {s.hoverBubble}
 *   </div>
 * )
 * ```
 *
 * 设计要点：
 * - **ref 只以 `hostProps.ref` 嵌套形式出现，绝不作为顶层返回字段**。React Compiler
 *   的 `react-hooks/refs` 规则会把「顶层返回了写 ref 的回调 / 含 RefObject」的 hook
 *   整体判为 ref 载体，此后宿主每一次 `s.xxx` 读取都会报「渲染期访问 ref」
 *   （实测：`s.hostProps`、`s.viewBoxSize` 一并中招）。嵌套形式不触发该判定。
 *   代价是宿主**不要自己在 spread 之后再写 `ref`**（会顶掉内建 ref）；
 *   需要 DOM 节点时用 `getHostElement()`；
 * - `hostProps` 用 **React 合成事件**（非原生监听）做拖拽平移 —— 与 Scene 内节点的
 *   `stopPropagation()` 处于同一套合成冒泡序，拖节点时不会把画布一起拖走；
 * - 滚轮缩放走**原生 non-passive 监听**（React 的 root 级 wheel 是 passive，
 *   `preventDefault` 无效），缩放锚定光标下的 viewBox 坐标；
 * - `selectedElements` 可受控（传 `options.selectedElements` + `onSelectionChange`）
 *   或非受控（内部自持）；
 * - 节点位置可选共享：把 `getNodePosition` / `onNodePositionChange` 传给 `CycleView`
 *   即可多视图共用一套坐标（不传则 Scene 用自身局部态）。
 */

const DEFAULT_TRANSFORM: CanvasTransform = { x: 0, y: 0, scale: 1 }
const DEFAULT_VIEWBOX = { width: 800, height: 600 }
const DEFAULT_MIN_SCALE = 0.25
const DEFAULT_MAX_SCALE = 8
const NOOP = () => {}

export interface SceneStateOptions {
  /** 初始平移 / 缩放；缺省 `{ x:0, y:0, scale:1 }` */
  initialTransform?: CanvasTransform
  /** 锁定交互（透传给 Scene 的 `locked`；同时禁用本 hook 的平移缩放） */
  locked?: boolean
  /** 滚轮缩放开关；缺省 `true` */
  enableZoom?: boolean
  /** 拖拽平移开关；缺省 `true` */
  enablePan?: boolean
  /** 缩放下限；缺省 `0.25`（与主画布一致） */
  minScale?: number
  /** 缩放上限；缺省 `8` */
  maxScale?: number
  /** 受控选中集合（传入即受控，配合 `onSelectionChange`） */
  selectedElements?: Set<string>
  /** 选中集合变更回调（受控 / 非受控都会触发，便于宿主记录） */
  onSelectionChange?: (next: Set<string>) => void
  /** ResizeObserver 首帧前的兜底尺寸；缺省 `{ width:800, height:600 }` */
  fallbackViewBoxSize?: { width: number; height: number }
  /** 宿主容器附加样式（与内建样式合并，内建优先保证定位/尺寸） */
  hostStyle?: CSSProperties
  /** hover 气泡主题；缺省 `'dark'` */
  theme?: 'dark' | 'light'
  /** hover 气泡自定义渲染；返回 `null` 表示禁用内建气泡 */
  renderHoverBubble?: (el: GroupElement, anchor: { x: number; y: number } | null) => ReactNode
}

/** 可直接 spread 到四类 2D Scene 的公共受控 props。 */
export interface SceneStateProps {
  selectedElements: Set<string>
  canvasTransform: CanvasTransform
  viewBoxSize: { width: number; height: number }
  onSelect: (elId: string, additive: boolean) => void
  onHover: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
}

export interface SceneState {
  /** 容器实测尺寸（ResizeObserver；首帧为兜底值） */
  viewBoxSize: { width: number; height: number }
  /**
   * 宿主容器的 props —— **一次 spread 即可**：
   *
   * ```tsx
   * const s = useSceneState(group)
   * <div {...s.hostProps}><SetView group={group} {...s.sceneProps} />{s.hoverBubble}</div>
   * ```
   *
   * 内含 `ref`（回调 ref）、内建样式（定位/尺寸/`touchAction`/光标）与拖拽平移事件。
   *
   * ⚠️ 别在 spread 之后再写 `ref`：那会顶掉内建 ref，尺寸测量与悬浮气泡换算会静默失效。
   * 需要 DOM 节点请用 `getHostElement()`。
   *
   * 设计说明：ref 只以**嵌套**形式出现在 `hostProps` 里，绝不作为顶层字段暴露。
   * React Compiler 的 `react-hooks/refs` 规则会把「顶层返回了写 ref 的回调」的 hook
   * 整体判为 ref 载体，此后宿主每次 `s.xxx` 读取都会报「渲染期访问 ref」；
   * 嵌套形式不触发该判定（实测）。
   */
  hostProps: {
    ref: (el: HTMLDivElement | null) => void
    style: CSSProperties
    onMouseDown: (e: React.MouseEvent) => void
    onMouseMove: (e: React.MouseEvent) => void
    onMouseUp: () => void
    onMouseLeave: () => void
  }
  /** 需要 DOM 节点时用（如导出 SVG）：取宿主容器元素 */
  getHostElement: () => HTMLDivElement | null
  canvasTransform: CanvasTransform
  setCanvasTransform: (t: CanvasTransform) => void
  selectedElements: Set<string>
  setSelectedElements: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  /** 选中语义：`additive`（⊕/Ctrl/⌘）→ 切换成员；否则 → 单选替换 */
  select: (elId: string, additive?: boolean) => void
  clearSelection: () => void
  /** 当前悬停元素（`onHover` 自动维护） */
  hovered: GroupElement | null
  /** 悬停锚点（viewBox 坐标系下映射到容器内的屏幕坐标） */
  hoverAnchor: { x: number; y: number } | null
  /** 内建 hover 气泡节点（可直接 `{s.hoverBubble}`；想自己画就用 `renderHoverBubble`） */
  hoverBubble: ReactNode
  /** 直接 spread 给 SetView / CycleView / CayleyView / CosetStripScene */
  sceneProps: SceneStateProps
  /** 复位平移缩放 */
  resetTransform: () => void
  /** 以容器中心为锚缩放（按钮用，`factor > 1` 放大） */
  zoomBy: (factor: number) => void
  /** 是否锁定（= `options.locked`） */
  locked: boolean
  /** 共享节点位置：接 `CycleView.getNodePosition` */
  getNodePosition: (elId: string) => NodePosition | undefined
  /** 共享节点位置：接 `CycleView.onNodePositionChange` */
  onNodePositionChange: (elId: string, x: number, y: number) => void
  /** 清空共享节点位置 */
  resetNodePositions: () => void
}

export function useSceneState(group?: Group | null, options: SceneStateOptions = {}): SceneState {
  const {
    initialTransform,
    locked = false,
    enableZoom = true,
    enablePan = true,
    minScale = DEFAULT_MIN_SCALE,
    maxScale = DEFAULT_MAX_SCALE,
    selectedElements: controlledSelection,
    onSelectionChange,
    fallbackViewBoxSize,
    hostStyle,
    theme = 'dark',
    renderHoverBubble,
  } = options

  const hostRef = useRef<HTMLDivElement | null>(null)
  /** 对外暴露回调 ref：不在渲染期写 ref，也不把 RefObject 塞进返回体 */
  const setHostRef = useCallback((el: HTMLDivElement | null) => { hostRef.current = el }, [])
  const getHostElement = useCallback(() => hostRef.current, [])

  // ── 尺寸：ResizeObserver 实测容器 ──
  const [viewBoxSize, setViewBoxSize] = useState(fallbackViewBoxSize ?? DEFAULT_VIEWBOX)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      setViewBoxSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      globalThis.addEventListener('resize', measure)
      return () => globalThis.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── 平移 / 缩放 ──
  const [canvasTransform, setCanvasTransformState] = useState<CanvasTransform>(initialTransform ?? DEFAULT_TRANSFORM)
  // transformRef 是「权威值」：只在事件回调里同步写（渲染期写 ref 会触发
  // react-hooks/refs）。这样滚轮/拖拽读到的永远是最后一次已应用的值，无陈旧窗口。
  const transformRef = useRef(canvasTransform)

  const setCanvasTransform = useCallback((t: CanvasTransform) => {
    transformRef.current = t
    setCanvasTransformState(t)
  }, [])

  const resetTransform = useCallback(
    () => setCanvasTransform(initialTransform ?? DEFAULT_TRANSFORM),
    [setCanvasTransform, initialTransform],
  )

  // 光标处的 viewBox 坐标（反向映射，缩放锚点用）
  const cursorToViewBox = useCallback((clientX: number, clientY: number) => {
    const el = hostRef.current
    const rect = el?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    // 指针坐标缺失 / 非有限（合成事件未带 clientX 等）→ 退回容器中心，
    // 免得 NaN 顺着 anchor 污染 canvasTransform（一旦变 NaN 整张图消失且无法自愈）。
    const cx = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? clientX
      : rect.left + rect.width / 2
    const cy = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? clientY
      : rect.top + rect.height / 2
    const svg = el?.querySelector('svg')
    const vb = svg?.viewBox?.baseVal
    const vw = vb && vb.width > 0 ? vb.width : viewBoxSize.width
    const vh = vb && vb.height > 0 ? vb.height : viewBoxSize.height
    const s = Math.min(rect.width / vw, rect.height / vh) || 1
    const offX = (rect.width - vw * s) / 2
    const offY = (rect.height - vh * s) / 2
    const t = transformRef.current
    const px = (cx - rect.left - offX) / s
    const py = (cy - rect.top - offY) / s
    return { x: (px - t.x) / t.scale, y: (py - t.y) / t.scale }
  }, [viewBoxSize])

  const zoomAt = useCallback((factor: number, anchor: { x: number; y: number }) => {
    const t = transformRef.current
    // 锚点非有限 → 放弃本次缩放（宁可不动，也不要把 transform 写成 NaN）
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return
    const next = Math.min(maxScale, Math.max(minScale, t.scale * factor))
    if (next === t.scale) return
    const k = next / t.scale
    setCanvasTransform({
      x: anchor.x - (anchor.x - t.x) * k,
      y: anchor.y - (anchor.y - t.y) * k,
      scale: next,
    })
  }, [setCanvasTransform, minScale, maxScale])

  // 滚轮：原生 non-passive（React root 级 wheel 为 passive，preventDefault 无效）
  useEffect(() => {
    const el = hostRef.current
    if (!el || locked || !enableZoom) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.deltaY > 0 ? 0.9 : 1.1, cursorToViewBox(e.clientX, e.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [locked, enableZoom, zoomAt, cursorToViewBox])

  const zoomBy = useCallback((factor: number) => {
    zoomAt(factor, {
      x: (viewBoxSize.width / 2 - transformRef.current.x) / transformRef.current.scale,
      y: (viewBoxSize.height / 2 - transformRef.current.y) / transformRef.current.scale,
    })
  }, [zoomAt, viewBoxSize])

  // 拖拽平移（React 合成事件：Scene 内节点 stopPropagation 时不会触发此处）
  const panRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number }>({
    active: false, startX: 0, startY: 0, ox: 0, oy: 0,
  })
  const [panning, setPanning] = useState(false)
  const panEnabled = enablePan && !locked

  const endPan = useCallback(() => {
    if (!panRef.current.active) return
    panRef.current.active = false
    setPanning(false)
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panEnabled || e.button !== 0) return
    panRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      ox: transformRef.current.x, oy: transformRef.current.y,
    }
    setPanning(true)
  }, [panEnabled])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current.active) return
    const p = panRef.current
    setCanvasTransform({
      x: p.ox + (e.clientX - p.startX),
      y: p.oy + (e.clientY - p.startY),
      scale: transformRef.current.scale,
    })
  }, [setCanvasTransform])

  useEffect(() => {
    if (!panning) return
    globalThis.addEventListener('mouseup', endPan)
    return () => globalThis.removeEventListener('mouseup', endPan)
  }, [panning, endPan])

  const hostProps = useMemo(() => ({
    ref: setHostRef,
    style: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      touchAction: 'none' as const,
      cursor: panEnabled ? (panning ? 'grabbing' : 'grab') : 'default',
      ...hostStyle,
    },
    onMouseDown,
    onMouseMove,
    onMouseUp: endPan,
    onMouseLeave: endPan,
  }), [setHostRef, hostStyle, panEnabled, panning, onMouseDown, onMouseMove, endPan])

  // ── 选中 ──
  const [internalSelection, setInternalSelection] = useState<Set<string>>(() => new Set<string>())
  const selectedElements = controlledSelection ?? internalSelection

  const commitSelection = useCallback((next: Set<string>) => {
    if (!controlledSelection) setInternalSelection(next)
    onSelectionChange?.(next)
  }, [controlledSelection, onSelectionChange])

  const setSelectedElements = useCallback((next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const resolved = typeof next === 'function'
      ? next(controlledSelection ?? internalSelection)
      : next
    commitSelection(resolved)
  }, [controlledSelection, internalSelection, commitSelection])

  const select = useCallback((elId: string, additive = false) => {
    const current = controlledSelection ?? internalSelection
    if (additive) {
      const next = new Set(current)
      if (next.has(elId)) next.delete(elId)
      else next.add(elId)
      commitSelection(next)
    } else {
      commitSelection(new Set([elId]))
    }
  }, [controlledSelection, internalSelection, commitSelection])

  const clearSelection = useCallback(() => commitSelection(new Set<string>()), [commitSelection])

  // ── 悬停 ──
  const [hovered, setHovered] = useState<GroupElement | null>(null)
  const [hoverAnchor, setHoverAnchor] = useState<{ x: number; y: number } | null>(null)

  const onHover = useCallback((el: GroupElement | null, anchor?: { x: number; y: number } | null) => {
    setHovered(el)
    if (!el || !anchor) {
      setHoverAnchor(null)
      return
    }
    // Scene 给的 anchor 已是 viewport 内屏幕坐标则直接用；否则按 viewBox 坐标换算。
    // 约定：Scene 传的是屏幕坐标（见 CayleyView 文档），此处直接透传。
    setHoverAnchor(anchor)
  }, [])

  const hoverBubble = useMemo<ReactNode>(() => {
    if (!hovered) return null
    if (renderHoverBubble) return renderHoverBubble(hovered, hoverAnchor)
    return createElement(SceneHoverBubble, {
      element: hovered,
      anchor: hoverAnchor,
      theme,
      group: group ?? null,
    })
  }, [hovered, hoverAnchor, renderHoverBubble, theme, group])

  // ── 共享节点位置 ──
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(() => new Map())
  const getNodePosition = useCallback((elId: string) => nodePositions.get(elId), [nodePositions])
  const onNodePositionChange = useCallback((elId: string, x: number, y: number) => {
    setNodePositions(prev => {
      const next = new Map(prev)
      next.set(elId, { x, y })
      return next
    })
  }, [])
  const resetNodePositions = useCallback(() => setNodePositions(new Map()), [])

  // 换群 → 清掉上一群的会话态（悬停 / 选中 / 节点位置），避免残留 id 命中新群。
  // 用 React 官方的「渲染期校正 state」模式（Storing information from previous renders）
  // 而非 effect：effect 版本要多提交一次渲染，且那一帧仍带着旧群的残留 id。
  const [sessionGroup, setSessionGroup] = useState(group)
  if (sessionGroup !== group) {
    setSessionGroup(group)
    setHovered(null)
    setHoverAnchor(null)
    setNodePositions(new Map())
    if (!controlledSelection) setInternalSelection(new Set<string>())
  }

  const sceneProps = useMemo<SceneStateProps>(() => ({
    selectedElements,
    canvasTransform,
    viewBoxSize,
    onSelect: select,
    onHover,
  }), [selectedElements, canvasTransform, viewBoxSize, select, onHover])

  return {
    hostProps,
    viewBoxSize,
    getHostElement,
    canvasTransform,
    setCanvasTransform,
    selectedElements,
    setSelectedElements,
    select,
    clearSelection,
    hovered,
    hoverAnchor,
    hoverBubble,
    sceneProps,
    resetTransform,
    zoomBy,
    locked,
    getNodePosition,
    onNodePositionChange,
    resetNodePositions,
  }
}

/** 无群 / 无操作时的稳定引用（供宿主做默认值，避免每次新建对象触发重渲染）。 */
export const SCENE_STATE_NOOP = NOOP

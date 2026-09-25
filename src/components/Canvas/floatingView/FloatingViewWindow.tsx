// ── 老式悬浮窗外壳（应用浮窗）──
// 独立 canvasTransform/nodePositions，经 GroupContext.Provider 覆盖后注入。
// 新式受控窗口见 ViewWindow.tsx（FGVE 引擎路径）。
//
// W-1（窗口框架融合）：窗口几何（拖动 / 8 向 resize / 最小尺寸钳制 / z 序）改用**共享** hook
// `useWindowDragResize` + `geometry.clampResize`——与 `ViewWindow` 同一份实现、同一个 z 计数器。
// W-2：几何接入共享持久化（`gv-vw-fv-<view>`）。
// W-3：内容与面板对齐内核——`KERNEL_VIEWS`（先 set/cayley 两支）改走 `ViewContent` 内核算子
//   并挂上 `ViewParamsPanel`；其余视图仍走 `lazyViews.renderViewContent` 自绘件（W-4 逐个迁）。
//   **只挂面板不算完成**：面板控件写的是 `viewParams`，而自绘件不消费 viewParams ⇒ 必须内容先迁。
//   与内核的差异仍然保留：选中与生成元**共享主画布**（内核是窗口本地），transform/nodes 本窗独立。
import { useState, useCallback, useMemo, useEffect } from 'react'
import { GroupContext } from '../../../context/GroupContext'
import type { GroupContextType } from '../../../context/GroupContext'
import { useGroup } from '../../../context/useGroup'
import { useHover } from '../../../context/core/HoverContext'
import { useTheme } from '../../../theme/useTheme'
import type { ViewMode, CanvasTransform, GroupElement } from '../../../core/types'
import type { SymmetryViewParams, ViewWindowConfig } from '../../../core/types/viewConfig'
import { getViewBoxSize } from '../../../core/viewBox'
import { getSymmetryType } from '../../../core/symmetryType'
import { removeStoredKey } from '../../../utils/persistence'
import { VIEWWINDOW_RESET_EVENT } from '../../../utils/resetViewWindows'
import { emptyDecorations } from '../../../core/types/decorations'
import { renderViewContent } from './lazyViews'
import { ViewContent } from './ViewContent'
import { ViewParamsPanel } from './ViewParamsPanel'
import { useWindowDragResize } from './useWindowDragResize'
import { useViewWindowPersist } from './useViewWindowPersist'
import { useCosetStripWindowData } from './useCosetStripWindowData'
import { useActionWindowData } from './useActionWindowData'
import { useViewParamsPanelData } from './useViewParamsPanelData'
import { RESIZE_DIRS, resizeHandleStyle, PARAMS_W, PARAMS_GAP } from './geometry'
import type { ActionEditState } from './types'

/**
 * 已迁到内核内容分发（`ViewContent`）的视图 —— 这些视图在应用浮窗里**消费 viewParams**，因此给 ⚙ 入口。
 * W-3：set / cayley；W-4：cycle / table / 3d / symmetry / sublattice / cosetstrip。
 * 仍留在 `lazyViews` 自绘件的：`sylow`（`ViewContent` 尚无该分支）、`tree` / `prestable`（无限群方向
 * 视图，交拓展包轨道）、`action` / `homomorphism`（应用多视图入口打不开，且老式壳没有同态源）。
 */
const KERNEL_VIEWS: ViewMode[] = [
  'set', 'cayley', 'cycle', 'table', '3d', 'symmetry', 'sublattice', 'cosetstrip',
]

export function FloatingViewWindow({ id, view, title }: { id: string; view: ViewMode; title: string }) {
  const globalCtx = useGroup()
  const { setHoverElement, hoverElement } = useHover()
  const { viewWindowTheme } = useTheme()
  const [paramsOpen, setParamsOpen] = useState(false)
  const [actionHoverId, setActionHoverId] = useState<string | null>(null)
  const [actionSel, setActionSel] = useState<number | null>(null)
  const [actionEdit, setActionEdit] = useState<ActionEditState | null>(null)
  // 对称性视图：重放信号 + 提示浮条文案（非迁移视图用 lazyViews 自带机制，这里只做面板 prop 兜底）
  const [symReplay, setSymReplay] = useState(0)
  const [symHintText, setSymHintText] = useState<string | null>(null)
  // 表格窗口按内容撑尺寸（内核用 useTableMinSize；老式壳走 legacyTableMin，W-4 迁 table 时对齐）
  const setTableLayoutSize = useCallback(() => { /* noop：未迁视图用 legacyTableMin */ }, [])

  const group = globalCtx.currentGroup
  // 选中与生成元**共享主画布**（内核是窗口本地）——融合时确认保留的行为，见 PLAN_WINDOW_FRAMEWORK §4.1
  const sel = globalCtx.selectedElements
  const handleSelect = useCallback((elId: string, add: boolean) => {
    globalCtx.selectElement(elId, add)
  }, [globalCtx])
  const handleHover = useCallback((el: GroupElement | null) => {
    setHoverElement(el)
  }, [setHoverElement])

  // 乘法表窗口最小尺寸：含文字需看清，最小 = viewBox + 标题栏
  const legacyTableMin = useMemo(() => {
    if (view !== 'table') return null
    const g = globalCtx.currentGroup
    if (!g || g.order > 100) return null
    const vb = getViewBoxSize(g.order, 'table')
    return {
      width: Math.min(900, vb.width),
      height: Math.min(900, vb.height + 40),
    }
  }, [view, globalCtx.currentGroup])

  // 落点级联：按已开窗数量错开。只取**挂载时快照**——窗口一旦落到某处，不该因为又开了别的窗而自己挪位。
  const defaultPosition = useMemo(
    () => ({
      x: 100 + globalCtx.floatingViews.length * 40,
      y: 80 + globalCtx.floatingViews.length * 30,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const defaultSize = useMemo(
    () => (legacyTableMin
      ? { width: Math.max(500, legacyTableMin.width), height: Math.max(400, legacyTableMin.height) }
      : { width: 500, height: 400 }),
    [legacyTableMin],
  )

  // W-2：窗口几何接入**共享持久化**（`gv-vw-*`，与 ViewWindow 同一键空间与信封）。
  // 键由 `view` 派生：应用浮窗是"跟着主画布走"的（换群时内容跟着变），所以不按群分键；
  // 也不能用窗口 `id`——它是 `fv-${Date.now()}`，每次开窗都变，存了等于没存。
  const {
    geometry, setGeometry, config, viewParams, updateViewParams,
    decorations, updateDecorations, setDecorations, persistKey,
    setConfigState, setViewParamsState,
  } = useViewWindowPersist({
    view,
    group: globalCtx.currentGroup,
    storageKey: `fv-${view}`,
    defaultPosition,
    defaultSize,
  })

  // 老式壳没有受控宿主 ⇒ config 直接写本地 state（与 hook 的受控判定一致：只传初值 = 非受控）
  const updateConfig = useCallback((patch: Partial<ViewWindowConfig>) => {
    setConfigState(prev => ({ ...prev, ...patch }))
  }, [setConfigState])

  // 共享窗口几何：拖动 / 8 向 resize（rAF 节流 + window 级监听）/ 最小尺寸钳制 / z 序
  // tableMinSize 走 legacyTableMin（与迁移前同口径）
  const { z, bringFront, dragging, onDragStart, onResizeStart } = useWindowDragResize({
    geometry, setGeometry, config, tableMinSize: legacyTableMin,
  })

  // 全局「重置所有视图窗口」广播（`resetAllViewWindows()`）：清本窗存档 + 回到默认几何。
  // 与 ViewWindow 的 resetAll 同口径——那条广播会同时清掉 `gv-vw-*` 全部键。
  useEffect(() => {
    const onReset = () => {
      removeStoredKey(`gv-vw-fv-${view}`)
      setGeometry({ position: defaultPosition, size: defaultSize })
    }
    window.addEventListener(VIEWWINDOW_RESET_EVENT, onReset)
    return () => window.removeEventListener(VIEWWINDOW_RESET_EVENT, onReset)
  }, [view, defaultPosition, defaultSize, setGeometry])

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

  // 本窗自己的 viewBox（table 的紧凑尺寸、大群 forceShow 都要按本视图算，不能用主画布的 2000×2000）
  const localViewBoxSize = useMemo(
    () => (group
      ? getViewBoxSize(group.order, view, globalCtx.forceShowLargeGroupViews.has(view))
      : globalCtx.viewBoxSize),
    [group, view, globalCtx.forceShowLargeGroupViews, globalCtx.viewBoxSize],
  )

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
    viewBoxSize: localViewBoxSize,
  }

  // ── 面板 / 内容数据（与内核共用同一批 hook；各自按 view 早退，非目标视图零开销）──
  const { cosetStripVp, csOpts, csSubgroup, csType, csElementMap, csColors, csHighlight } = useCosetStripWindowData({
    view, group, viewParams, sel,
  })
  const { actionVp, actionKind, actionComputation, startOrEditCustom, verifyAndSaveCustom } = useActionWindowData({
    view, group, viewParams, updateViewParams, actionEdit, setActionEdit, setActionSel,
  })
  const {
    sublatticeParams, tableVp, cayleyShapes, cayleyVp, setVp, cycleVp, homoVp, cayleyShapeValue,
    cayleyActionsList, cayleyEnabledCount, setCayleyActionLength,
    shapes3d, p3d, layout3dValue, cayley3dActionsList, cayley3dEnabledCount, setCayley3DActionLength,
    faceSubgroupCands, faceSelSubgroup, faceOn, patchFaceFill,
  } = useViewParamsPanelData({ view, group, viewParams, updateViewParams })

  const symVp = viewParams as SymmetryViewParams
  const symType = view === 'symmetry' && group ? getSymmetryType(group) : null
  const symCanDual = symType === 'cube' || symType === 'icosahedron'
  const symShowAction = !!symVp.showAction
  const symActiveId = symVp.actionElementId ?? null

  // 参数面板「↺ Reset to defaults」：清本窗存档 + 几何/配置/参数/注释一起回默认（与内核 resetAll 同口径）
  const resetAll = useCallback(() => {
    if (persistKey) removeStoredKey(`gv-vw-${persistKey}`)
    setGeometry({ position: defaultPosition, size: defaultSize })
    setConfigState({})
    setViewParamsState({})
    setDecorations(emptyDecorations())
    resetCanvasTransformLocal()
  }, [persistKey, defaultPosition, defaultSize, setGeometry, setConfigState, setViewParamsState, setDecorations, resetCanvasTransformLocal])

  // 面板贴在窗口右缘（右缘放不下则翻到左侧）；与内核同一套 PARAMS_W / PARAMS_GAP
  const placeLeft = geometry.position.x + geometry.size.width + PARAMS_GAP + PARAMS_W > window.innerWidth
  const paramsLeft = placeLeft
    ? Math.max(0, geometry.position.x - PARAMS_GAP - PARAMS_W)
    : geometry.position.x + geometry.size.width + PARAMS_GAP

  const handleDragStart = onDragStart
  const kernelContent = KERNEL_VIEWS.includes(view)
  // 面板只在**已迁内容**的视图出现：自绘件不消费 viewParams，挂了就是一排死控件（方案 §2 的坑）
  const showParamsToggle = kernelContent

  return (
    <GroupContext.Provider value={localOverrides as GroupContextType}>
      <div
        className="floating-view-window"
        data-theme={viewWindowTheme}
        style={{
          position: 'fixed',
          left: geometry.position.x,
          top: geometry.position.y,
          width: geometry.size.width,
          height: geometry.size.height,
          zIndex: z,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          background: 'var(--bg-primary)',
          cursor: dragging ? 'grabbing' : 'default',
        }}
        onMouseDown={bringFront}
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
          {/* zIndex 11 > resize 手柄的 10：否则 ne/nw 角手柄会压住标题栏按钮，把 ×/⚙ 的点击吃掉
              （W-4 真机扫场抓到的交互 bug：点关闭按钮被 <div data-resize-dir="ne"> 拦截） */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 11 }}>
            {/* W-3：参数面板入口（与内核同一个 ViewParamsPanel）。**未迁视图不给入口**——
                自绘件不消费 viewParams，点了也不会有任何变化（W-4 逐个迁完再开）。 */}
            {showParamsToggle && (
              <button
                title="Parameters"
                data-testid="float-params-toggle"
                onClick={() => setParamsOpen(o => !o)}
                style={{
                  background: paramsOpen ? '#a78bfa22' : 'none',
                  border: 'none',
                  color: paramsOpen ? '#a78bfa' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >⚙</button>
            )}
            <button
              title="Close"
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
          </span>
        </div>
        
        <div
          className="floating-view-content"
          onMouseDownCapture={bringFront}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 已迁视图走内核内容分发（消费 viewParams），其余仍走 lazyViews 自绘件 */}
          {kernelContent && group ? (
            <ViewContent
              view={view}
              group={group}
              homomorphism={null}
              viewParams={viewParams}
              config={config}
              sel={sel}
              ct={localTransform}
              vbSize={localViewBoxSize}
              viewWindowTheme={viewWindowTheme}
              symReplay={symReplay}
              hoverEl={hoverElement}
              csElementMap={csElementMap}
              csColors={csColors}
              csHighlight={csHighlight}
              csSubgroup={csSubgroup}
              csOpts={csOpts}
              cosetStripVp={cosetStripVp}
              actionComputation={actionComputation}
              actionKind={actionKind}
              actionVp={actionVp}
              actionEdit={actionEdit}
              actionSel={actionSel}
              actionHoverId={actionHoverId}
              handleSelect={handleSelect}
              handleHover={handleHover}
              setSymHintText={setSymHintText}
              setTableLayoutSize={setTableLayoutSize}
              setActionEdit={setActionEdit}
              setActionSel={setActionSel}
              setActionHoverId={setActionHoverId}
              updateViewParams={updateViewParams}
              decorations={decorations}
              appWindowLabels
            />
          ) : renderViewContent(view)}
        </div>

        {/* 视图内提示浮条（未迁视图用 lazyViews 自带机制；这里给内核内容留同一条通道） */}
        {symHintText && (
          <div
            data-testid="float-hint"
            style={{
              position: 'absolute', left: 8, bottom: 8, maxWidth: '70%', fontSize: 11,
              color: 'var(--text-secondary)', background: 'var(--bg-interactive)',
              border: '1px solid var(--border-primary)', borderRadius: 6, padding: '3px 6px',
              pointerEvents: 'none',
            }}
          >{symHintText}</div>
        )}
        
        {/* W-1：8 向 resize 手柄（与 ViewWindow 同一份 resizeHandleStyle / clampResize）。
            右下角保留原有装饰性三角作为抓取提示。 */}
        {RESIZE_DIRS.map(dir => (
          <div
            key={dir}
            data-resize-dir={dir}
            className={dir === 'se' ? 'floating-view-resizer' : undefined}
            style={resizeHandleStyle(dir)}
            onMouseDown={onResizeStart(dir)}
          >
            {dir === 'se' && (
              <svg width={28} height={28} style={{ display: 'block', opacity: 0.5, pointerEvents: 'none' }}>
                <path d="M26 26 L26 14 L14 26 Z M26 26 L26 20 L20 26 Z" fill="#555" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* 参数面板：窗口**外**的兄弟节点（放窗内会被 overflow:hidden 裁掉），与内核同一分量与放置规则 */}
      {paramsOpen && kernelContent && (
        <ViewParamsPanel
          viewWindowTheme={viewWindowTheme} view={view} group={group} homomorphism={null}
          config={config} updateConfig={updateConfig} updateViewParams={updateViewParams} resetAll={resetAll}
          z={z} bringFront={bringFront} paramsLeft={paramsLeft} geometry={geometry}
          setVp={setVp} cycleVp={cycleVp} homoVp={homoVp} actionVp={actionVp} actionKind={actionKind}
          actionEdit={actionEdit} setActionEdit={setActionEdit}
          startOrEditCustom={startOrEditCustom} verifyAndSaveCustom={verifyAndSaveCustom}
          cayleyVp={cayleyVp} cayleyShapeValue={cayleyShapeValue} cayleyShapes={cayleyShapes}
          cayleyActionsList={cayleyActionsList} cayleyEnabledCount={cayleyEnabledCount}
          setCayleyActionLength={setCayleyActionLength}
          p3d={p3d} shapes3d={shapes3d} layout3dValue={layout3dValue}
          cayley3dActionsList={cayley3dActionsList} cayley3dEnabledCount={cayley3dEnabledCount}
          setCayley3DActionLength={setCayley3DActionLength}
          decorations={decorations} onDecorationsChange={updateDecorations} selectedIds={sel}
          faceSubgroupCands={faceSubgroupCands} faceSelSubgroup={faceSelSubgroup}
          faceOn={faceOn} patchFaceFill={patchFaceFill}
          tableVp={tableVp} sublatticeParams={sublatticeParams}
          csOpts={csOpts} csSubgroup={csSubgroup} csType={csType} cosetStripVp={cosetStripVp}
          symType={symType} symCanDual={symCanDual} symVp={symVp} symShowAction={symShowAction}
          symActiveId={symActiveId} setSymReplay={setSymReplay}
        />
      )}
    </GroupContext.Provider>
  )
}

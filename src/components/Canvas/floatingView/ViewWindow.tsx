// ── 受控 ViewWindow（FGVE 引擎窗口内核）——
// B1 拆出几何/持久化/样式/路径编辑器；B2 再抽七个 hook（persist / tableMinSize /
// dragResize / viewport / cosetstrip 数据 / action 数据 / 参数面板数据，见同目录
// use*.ts）与共享类型（types.ts）。本文件现在是「hook 编排 + 窗口 chrome JSX」，
// 逻辑未动。
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTheme } from '../../../theme/useTheme'
import type { GroupElement } from '../../../core/types'
import type { SymmetryViewParams } from '../../../core/types/viewConfig'
import { getSymmetryType } from '../../../core/symmetryType'
import { removeStoredKey } from '../../../utils/persistence'
import { VIEWWINDOW_RESET_EVENT } from '../../../utils/resetViewWindows'
import { texify, renderTex } from '../../../utils/texify'
import { PARAMS_W, PARAMS_GAP, RESIZE_DIRS, resizeHandleStyle } from './geometry'
import { TBAR_STYLE, BTN_STYLE, tglBtn } from './styles'
import { useViewWindowPersist } from './useViewWindowPersist'
import { useTableMinSize } from './useTableMinSize'
import { useWindowDragResize } from './useWindowDragResize'
import { useWindowViewport } from './useWindowViewport'
import { useCosetStripWindowData } from './useCosetStripWindowData'
import { useActionWindowData } from './useActionWindowData'
import { useViewParamsPanelData } from './useViewParamsPanelData'
import { ViewContent } from './ViewContent'
import { ViewParamsPanel } from './ViewParamsPanel'
import type { ActionEditState, ViewWindowProps } from './types'

// ViewParams / ViewWindowProps 已移至 ./types.ts（shim 与 hook 共用）；
// 此处保持向后兼容的再导出，外部 import 路径不变。
export type { ViewParams, ViewWindowProps } from './types'


export function ViewWindow({
  view,
  group,
  homomorphism,
  title,
  storageKey,
  config: configProp,
  onConfigChange,
  viewParams: viewParamsProp,
  onViewParamsChange,
  defaultPosition = { x: 120, y: 80 },
  defaultSize = { width: 520, height: 420 },
  onClose,
}: ViewWindowProps) {

  // 视图窗口独立深浅色（与主界面 theme 解耦），通过 data-theme 覆盖子树
  const { viewWindowTheme } = useTheme()


  // ── action 视图窗口本地态（viewport hook 依赖 actionEdit 判定滚轮/拖拽禁用）──
  // 金色箭头联动的悬停群元素 id / 选中集合元素索引（OST 交互）/
  // custom 编辑态（不持久化——viewParams 只存已验证结果，编辑中断刷新回已验证态）
  const [actionHoverId, setActionHoverId] = useState<string | null>(null)
  const [actionSel, setActionSel] = useState<number | null>(null)
  const [actionEdit, setActionEdit] = useState<ActionEditState | null>(null)
  const [paramsOpen, setParamsOpen] = useState(false)

  // ── 窗口状态（B2 抽出至 use* hook，逻辑未动）──
  const {
    persistKey, geometry, setGeometry, config, viewParams,
    setConfigState, setViewParamsState, updateConfig, updateViewParams,
  } = useViewWindowPersist({
    view, group, homomorphism, storageKey, configProp, onConfigChange,
    viewParamsProp, onViewParamsChange, defaultPosition, defaultSize,
  })

  const { setTableLayoutSize, tableMinSize } = useTableMinSize({
    view, group, viewParams, geometry, setGeometry,
  })

  const { z, bringFront, dragging, resizable, onDragStart, onResizeStart } = useWindowDragResize({
    geometry, setGeometry, config, tableMinSize,
  })

  const {
    viewportRef, ct, vbSize, ZOOM_MIN, ZOOM_MAX,
    onCtMDown, setZoomScale, zoomBy, resetCt,
  } = useWindowViewport({ view, config, actionEdit, geometry })


  // Reset to factory defaults: clear persisted state, restore default position/size,
  // default config, default view params and reset the viewport transform.
  const resetAll = useCallback(() => {
    if (persistKey) removeStoredKey(`gv-vw-${persistKey}`)
    // 重置尺寸也受表格最小尺寸约束，避免 reset 后表格被裁切
    const resetSize = tableMinSize
      ? { width: Math.max(defaultSize.width, tableMinSize.width), height: Math.max(defaultSize.height, tableMinSize.height) }
      : defaultSize
    setGeometry({ position: defaultPosition, size: resetSize })
    if (onConfigChange) onConfigChange({})
    else setConfigState({})
    if (onViewParamsChange) onViewParamsChange({})
    else setViewParamsState({})
    resetCt()
    // setGeometry/setConfigState/setViewParamsState 为 hook 透出的 useState setter（引用稳定），
    // eslint 无法识别稳定性故显式列入依赖，不改变重跑时机
  }, [persistKey, defaultPosition, defaultSize, tableMinSize, onConfigChange, onViewParamsChange, resetCt, setGeometry, setConfigState, setViewParamsState])

  // Global "reset all windows" broadcast: every ViewWindow resets itself.
  useEffect(() => {
    const onResetAll = () => resetAll()
    window.addEventListener(VIEWWINDOW_RESET_EVENT, onResetAll)
    return () => window.removeEventListener(VIEWWINDOW_RESET_EVENT, onResetAll)
  }, [resetAll])

  // selection for set/cayley views（窗口本地会话态，独立于主应用选中）
  const [sel, setSel] = useState<Set<string>>(new Set())
  const handleSelect = useCallback((id: string, add: boolean) => {
    setSel(s => {
      const n = new Set(s)
      if (add) { if (n.has(id)) n.delete(id); else n.add(id) }
      else { n.clear(); n.add(id) }
      return n
    })
  }, [])

  // 悬停就地气泡（C 方案）：标签随 LOD 隐藏时，悬停节点在节点旁浮出元素名与阶。
  // 切换展示群/视图时清空悬停：渲染期状态调整（React 官方 pattern，避免 effect 内 setState）
  const [hoverEl, setHoverEl] = useState<GroupElement | null>(null)
  const [hoverAnchor, setHoverAnchor] = useState<{ x: number; y: number } | null>(null)
  // 对称性视图演示状态浮条文本（scene onHint 上抛）
  const [symHintText, setSymHintText] = useState<string | null>(null)
  // 对称性视图重放信号：自增即让 SymmetryViewScene 对当前演示元素重播一次（同元素可反复观看）
  const [symReplay, setSymReplay] = useState(0)
  const displayKey = view + (group ? `|${group.symbol}|${group.order}` : (view === 'homomorphism' && homomorphism ? `|${homomorphism.source.symbol}|${homomorphism.target.symbol}` : ''))
  const [curDisplayKey, setCurDisplayKey] = useState(displayKey)
  if (curDisplayKey !== displayKey) {
    setCurDisplayKey(displayKey)
    setHoverEl(null)
    setHoverAnchor(null)
    setSymHintText(null)
    setActionHoverId(null)
    setActionSel(null)
    setActionEdit(null)
  }
  const handleHover = useCallback(
    (el: GroupElement | null, anchor?: { x: number; y: number } | null) => {
      setHoverEl(el)
      setHoverAnchor(anchor ?? null)
    },
    [],
  )
  const hoverOrder = useMemo(() => {
    if (!hoverEl) return 0
    // homomorphism 窗口无 group：hover 元素可能属 source 或 target，按 id 归属判定其群
    const g = group
      ?? (homomorphism && homomorphism.source.elements.some(e => e.id === hoverEl.id) ? homomorphism.source : null)
      ?? (homomorphism?.target ?? null)
    if (!g) return 0
    let cur = hoverEl
    for (let i = 1; i <= g.order; i++) {
      if (cur.id === g.identity.id) return i
      cur = g.multiply(cur, hoverEl)
    }
    return 0
  }, [group, homomorphism, hoverEl])
  const showControls = config.showControls !== false
  const showZoomSlider = config.showZoomSlider !== false

  // ── symmetry 窗口派生（unsupported 群 → SymmetryViewScene 内部提示 overlay，无演示/状态浮条） ──
  const symVp = viewParams as SymmetryViewParams
  const symType = view === 'symmetry' && group ? getSymmetryType(group) : null
  const symSupported = !!symType && symType !== 'unsupported'
  const symCanDual = symType === 'cube' || symType === 'icosahedron'
  const symShowAction = !!symVp.showAction
  const symActiveId = symVp.actionElementId ?? null

  const infoText = useMemo(() => {
    if (!config.showInfo) return ''
    if (group) return `${group.symbol} · ${group.order} ord`
    if (view === 'homomorphism' && homomorphism) return `|G|=${homomorphism.source.order} → |H|=${homomorphism.target.order}`
    return ''
  }, [group, config.showInfo, view, homomorphism])

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

  // Params panel floats OUTSIDE the window frame as a sibling overlay (a child would be
  // clipped by the window's overflow:hidden): docked to the window's right edge, flipping
  // to its left side when that would overflow the viewport. Follows drag/resize because
  // it derives from the same geometry state.
  const placeLeft = geometry.position.x + geometry.size.width + PARAMS_GAP + PARAMS_W > window.innerWidth
  const paramsLeft = placeLeft
    ? Math.max(0, geometry.position.x - PARAMS_GAP - PARAMS_W)
    : geometry.position.x + geometry.size.width + PARAMS_GAP

  return (
    <>
      <div
        data-theme={viewWindowTheme}
        style={{
          position: config.viewportFixed ? 'fixed' : 'absolute', left: geometry.position.x, top: geometry.position.y,
          width: geometry.size.width, height: geometry.size.height, zIndex: z,
          display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          background: 'var(--bg-primary)',
          cursor: dragging ? 'grabbing' : 'default',
        }}
        onMouseDown={bringFront}
      >
        {/* titlebar */}
        <div style={TBAR_STYLE} onMouseDown={onDragStart}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title ?? (group ? group.symbol : (view === 'homomorphism' && homomorphism ? (homomorphism.name || `${homomorphism.source.symbol} → ${homomorphism.target.symbol}`) : 'View'))}
            {infoText && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{infoText}</span>}
          </span>
          {/* 博客插图等专注阅读场景可 config.showControls=false 整组隐藏 */}
          {showControls && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button title="Lock move" style={tglBtn(!!config.locked, '#f97316')}
                onClick={() => updateConfig({ locked: !config.locked })}>{config.locked ? '📌' : '📍'}</button>
              <button title="Lock zoom" style={tglBtn(!!config.zoomLocked, '#38bdf8')}
                onClick={() => updateConfig({ zoomLocked: !config.zoomLocked })}>{config.zoomLocked ? '🔒' : '🔍'}</button>
              <button title="Toggle info" style={tglBtn(!!config.showInfo, '#84cc16')}
                onClick={() => updateConfig({ showInfo: !config.showInfo })}>i</button>
              <button title="Parameters" style={tglBtn(paramsOpen, '#a78bfa')}
                onClick={() => {
                  const next = !paramsOpen
                  setParamsOpen(next)
                  // 打开面板时窗口置顶，避免外置面板被更高层的相邻窗口盖住
                  if (next) bringFront()
                }}>⚙</button>
              <button title="Close" style={BTN_STYLE}
                onClick={onClose}
                onMouseEnter={e => (e.currentTarget.style.color = '#f44')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>×</button>
            </div>
          )}
        </div>

        {/* content */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* main viewport */}
          <div
            ref={viewportRef}
            style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}
            onMouseDown={onCtMDown}
            onDoubleClick={(e) => {
              if (!(e.target instanceof SVGElement && e.target.tagName === 'svg')) return
              resetCt()
            }}
          >
            {/* 视图组件自含 canvasTransform（SetView/CayleyView 在自身 <g> 上应用），
                直接渲染，不再包外层 <svg>（避免嵌套 svg 冗余 viewport） */}
            <ViewContent
              view={view} group={group ?? null} homomorphism={homomorphism ?? null}
              viewParams={viewParams} config={config} sel={sel} ct={ct} vbSize={vbSize}
              viewWindowTheme={viewWindowTheme} symReplay={symReplay} hoverEl={hoverEl}
              csElementMap={csElementMap} csColors={csColors} csHighlight={csHighlight}
              csSubgroup={csSubgroup} csOpts={csOpts} cosetStripVp={cosetStripVp}
              actionComputation={actionComputation} actionKind={actionKind} actionVp={actionVp}
              actionEdit={actionEdit} actionSel={actionSel} actionHoverId={actionHoverId}
              handleSelect={handleSelect} handleHover={handleHover}
              setSymHintText={setSymHintText} setTableLayoutSize={setTableLayoutSize}
              setActionEdit={setActionEdit} setActionSel={setActionSel} setActionHoverId={setActionHoverId}
              updateViewParams={updateViewParams}
            />

            {/* zoom slider overlay (avoids wheel/page-scroll conflict)；
                3D 相机自带滚轮缩放，窗口滑杆/ct 不参与 */}
            {showZoomSlider && view !== '3d' && view !== 'symmetry' && view !== 'homomorphism' && !(view === 'action' && actionEdit) && (
              <div style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-interactive)', borderRadius: 6, padding: '2px 6px',
                border: '1px solid var(--border-primary)', zIndex: 5, fontSize: 12,
                color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                opacity: config.zoomLocked ? 0.4 : 0.85, pointerEvents: config.zoomLocked ? 'none' : 'auto',
              }}>
                <button title="Zoom out" style={BTN_STYLE} onClick={() => zoomBy(0.8)}>−</button>
                <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.05}
                  value={ct.scale}
                  onChange={e => setZoomScale(Number(e.target.value))}
                  style={{ width: 120 }} />
                <button title="Zoom in" style={BTN_STYLE} onClick={() => zoomBy(1.25)}>+</button>
                <button title="Reset view" style={BTN_STYLE} onClick={resetCt}>⟲</button>
              </div>
            )}

            {/* 概览引导：未悬停时显示底部居中提示，让"悬停可读元素"主动被发现（标签隐藏态下唯一的信息取回方式）。
                对称性视图无节点可悬停，不显示（其演示说明只走底部状态浮条） */}
            {!hoverEl && view !== 'symmetry' && !(view === 'action' && actionEdit) && (
              <div
                data-testid="figure-hint"
                style={{
                  position: 'absolute',
                  bottom: showZoomSlider && view !== '3d' ? 48 : 12, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(78,205,196,0.4)',
                  borderRadius: 8, padding: '5px 14px', zIndex: 6, fontSize: 12,
                  color: '#94a3b8', pointerEvents: 'none', backdropFilter: 'blur(4px)',
                }}
              >
                <span style={{ color: '#4ecdc4' }}>💡</span>
                悬停节点查看元素名与阶
              </div>
            )}

            {/* 就地气泡：悬停节点旁浮出元素名+阶（HTML 层、字号不随图缩放），带指向节点的小三角，
                节点靠近顶部时翻转到节点下方，配合节点青色高亮环形成"环+就近气泡"双重反馈 */}
            {hoverEl && hoverAnchor && (
              <div
                data-testid="hover-hud"
                style={{
                  position: 'absolute', left: hoverAnchor.x, top: hoverAnchor.y,
                  zIndex: 8, pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0,
                    transform: hoverAnchor.y < 72 ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(15,23,42,0.95)', border: '1px solid #4ecdc4',
                    borderRadius: 9, padding: '6px 14px', fontSize: 16,
                    color: '#f1f5f9', whiteSpace: 'nowrap',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.45), 0 0 0 2px rgba(78,205,196,0.15)',
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(hoverEl.label)) }} />
                  <span style={{ color: '#64748b', fontSize: 12 }}>·</span>
                  <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>order {hoverOrder}</span>
                  {/* 指向节点的小三角 */}
                  <span
                    style={{
                      position: 'absolute',
                      ...(hoverAnchor.y < 72
                        ? { top: -7, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '7px solid #4ecdc4' }
                        : { bottom: -7, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid #4ecdc4' }),
                      left: '50%', transform: 'translateX(-50%)',
                      width: 0, height: 0,
                    }}
                  />
                </div>
              </div>
            )}
            {/* 对称性视图：演示状态浮条 —— 演示说明的唯一展示位置（场景内不再浮动状态行）。
                仅当选定元素且确有几何旋转（真实状态）时显示；元素选择与引导文案在 ⚙ 面板内。
                浮条自带 ⟳ 重放（同元素可反复观看）与 ✕ 复位（回恒等姿态），是窗口内的演示操作区 */}
            {view === 'symmetry' && group && symSupported && symActiveId && symHintText && (
              <div
                data-testid="sym-demo-hint"
                style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6, maxWidth: '94%',
                  background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(78,205,196,0.45)',
                  borderRadius: 8, padding: '4px 6px 4px 12px', zIndex: 6, fontSize: 12,
                  color: '#cbd5e1', pointerEvents: 'auto', backdropFilter: 'blur(4px)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: '#4ecdc4', flexShrink: 0 }}>⟳</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
                  dangerouslySetInnerHTML={{ __html: symHintText }} />
                <span style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
                  <button
                    title="Replay this action"
                    data-testid="sym-demo-replay"
                    onClick={() => setSymReplay(n => n + 1)}
                    style={{
                      background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.5)',
                      color: '#4ecdc4', borderRadius: 4, padding: '2px 8px', fontSize: 11,
                      cursor: 'pointer', lineHeight: 1.5, userSelect: 'none',
                    }}
                  >
                    ⟳ Replay
                  </button>
                  {!config.actionLocked && (
                    <button
                      title="Reset pose (identity)"
                      data-testid="sym-demo-reset"
                      onClick={() => updateViewParams({ actionElementId: null })}
                      style={{
                        background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.4)',
                        color: '#cbd5e1', borderRadius: 4, padding: '2px 8px', fontSize: 11,
                        cursor: 'pointer', lineHeight: 1.5, userSelect: 'none',
                      }}
                    >
                      ✕ Reset
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        {resizable && RESIZE_DIRS.map(dir => (
          <div key={dir} style={resizeHandleStyle(dir)}
            onMouseDown={onResizeStart(dir)}
          />
        ))}
      </div>

      {/* params panel — outside the window so it never covers the view */}
      {paramsOpen && (
        <ViewParamsPanel
          viewWindowTheme={viewWindowTheme} view={view} group={group ?? null} homomorphism={homomorphism ?? null}
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
          faceSubgroupCands={faceSubgroupCands} faceSelSubgroup={faceSelSubgroup}
          faceOn={faceOn} patchFaceFill={patchFaceFill}
          tableVp={tableVp} sublatticeParams={sublatticeParams}
          csOpts={csOpts} csSubgroup={csSubgroup} csType={csType} cosetStripVp={cosetStripVp}
          symType={symType} symCanDual={symCanDual} symVp={symVp} symShowAction={symShowAction}
          symActiveId={symActiveId} setSymReplay={setSymReplay}
        />
      )}
    </>
  )
}

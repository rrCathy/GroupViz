// ── ViewWindow 参数面板（B2 自 ViewWindow.tsx 抽出，JSX 逐字保留只调缩进）──
// 外置面板（窗口 overflow:hidden 会裁掉子元素故挂成兄弟节点），定位参数由宿主传入。
import type { Group, Homomorphism, ViewMode, CayleyShape2D, Layout3D, LatticeLabelDetail } from '../../../core/types'
import type { ViewWindowConfig, SetViewParams, CayleyViewParams, Cayley3DViewParams, CycleViewParams, TableViewParams, TableStrategy, SublatticeViewParams, CosetStripViewParams, SymmetryViewParams, HomomorphismViewParams, ActionViewParams } from '../../../core/types/viewConfig'
import type { FaceSubgroupResult } from '../../../core/algebra/faces3D'
import { FACE_COLOR_PALETTE } from '../../../core/algebra/faces3D'
import type { CosetStripSubgroupOption } from '../../../core/algebra/cosetStrip'
import { getSymmetryType } from '../../../core/symmetryType'
import { toggleCayleyActionReducer, addAllCayleyActionsHelper } from '../../../context/cayleyActions'
import { texify, renderTex } from '../../../utils/texify'
import { PARAMS_W } from './geometry'
import type { VwGeometry } from './geometry'
import { BTN_STYLE, segBtn, MINI_BTN } from './styles'
import { CayleyPathEditor } from './CayleyPathEditor'
import { COSETSTRIP_NO_LOCAL_SUBGROUPS, csOptionLabel } from './lazyViews'
import type { ActionEditState, ViewParamsPatch } from './types'

export interface ViewParamsPanelProps {
  viewWindowTheme: string
  view: ViewMode
  group: Group | null
  homomorphism: Homomorphism | null
  config: ViewWindowConfig
  updateConfig: (p: Partial<ViewWindowConfig>) => void
  updateViewParams: (p: ViewParamsPatch) => void
  resetAll: () => void
  z: number
  bringFront: () => void
  paramsLeft: number
  geometry: VwGeometry
  setVp: SetViewParams
  cycleVp: CycleViewParams
  homoVp: HomomorphismViewParams
  actionVp: ActionViewParams
  actionKind: string
  actionEdit: ActionEditState | null
  setActionEdit: React.Dispatch<React.SetStateAction<ActionEditState | null>>
  startOrEditCustom: () => void
  verifyAndSaveCustom: () => void
  cayleyVp: CayleyViewParams
  cayleyShapeValue: CayleyShape2D
  cayleyShapes: CayleyShape2D[]
  cayleyActionsList: ReturnType<typeof addAllCayleyActionsHelper>
  cayleyEnabledCount: number
  setCayleyActionLength: (elementId: string, lengthScale: number) => void
  p3d: Cayley3DViewParams
  shapes3d: Layout3D[]
  layout3dValue: Layout3D
  cayley3dActionsList: ReturnType<typeof addAllCayleyActionsHelper>
  cayley3dEnabledCount: number
  setCayley3DActionLength: (elementId: string, lengthScale: number) => void
  faceSubgroupCands: FaceSubgroupResult[]
  faceSelSubgroup: FaceSubgroupResult | null
  faceOn: boolean
  patchFaceFill: (patch: Partial<Cayley3DViewParams['faceFill'] & object>) => void
  tableVp: TableViewParams
  sublatticeParams: SublatticeViewParams
  csOpts: CosetStripSubgroupOption[]
  csSubgroup: CosetStripSubgroupOption | null
  csType: string
  cosetStripVp: CosetStripViewParams
  symType: ReturnType<typeof getSymmetryType> | null
  symCanDual: boolean
  symVp: SymmetryViewParams
  symShowAction: boolean
  symActiveId: string | null
  setSymReplay: React.Dispatch<React.SetStateAction<number>>
}

export function ViewParamsPanel({
  viewWindowTheme, view, group, homomorphism, config, updateConfig, updateViewParams, resetAll,
  z, bringFront, paramsLeft, geometry,
  setVp, cycleVp, homoVp, actionVp, actionKind, actionEdit, setActionEdit, startOrEditCustom, verifyAndSaveCustom,
  cayleyVp, cayleyShapeValue, cayleyShapes, cayleyActionsList, cayleyEnabledCount, setCayleyActionLength,
  p3d, shapes3d, layout3dValue, cayley3dActionsList, cayley3dEnabledCount, setCayley3DActionLength,
  faceSubgroupCands, faceSelSubgroup, faceOn, patchFaceFill,
  tableVp, sublatticeParams, csOpts, csSubgroup, csType, cosetStripVp,
  symType, symCanDual, symVp, symShowAction, symActiveId, setSymReplay,
}: ViewParamsPanelProps) {
  return (
    <div
      data-theme={viewWindowTheme}
      style={{
        position: config.viewportFixed ? 'fixed' : 'absolute',
        left: paramsLeft, top: geometry.position.y, width: PARAMS_W,
        maxHeight: geometry.size.height, overflowY: 'auto', zIndex: z,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)',
      }}
      onMouseDown={bringFront}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>View Config</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={!!config.locked} onChange={e => updateConfig({ locked: e.target.checked })} />
        Lock move
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={!!config.zoomLocked} onChange={e => updateConfig({ zoomLocked: e.target.checked })} />
        Lock zoom
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={!!config.showInfo} onChange={e => updateConfig({ showInfo: e.target.checked })} />
        Show info
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <input type="checkbox" checked={!!config.viewportFixed} onChange={e => updateConfig({ viewportFixed: e.target.checked })} />
        Fixed to viewport
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={config.showControls !== false} onChange={e => updateConfig({ showControls: e.target.checked })} />
        Show controls
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <input type="checkbox" checked={config.showZoomSlider !== false} onChange={e => updateConfig({ showZoomSlider: e.target.checked })} />
        Show zoom slider
      </label>

      {view === 'set' && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Set View</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Node radius</div>
            <input type="range" min={8} max={60} value={setVp.nodeRadius ?? 26}
              onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.nodeRadius ?? 26}px</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Gap</div>
            <input type="range" min={0} max={40} value={setVp.gap ?? 8}
              onChange={e => updateViewParams({ gap: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.gap ?? 8}px</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Columns (0=auto)</div>
            <input type="range" min={0} max={20} value={setVp.columns ?? 0}
              onChange={e => updateViewParams({ columns: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{setVp.columns ?? 0}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={setVp.showLabels !== false}
              onChange={e => updateViewParams({ showLabels: e.target.checked })} />
            Show labels
          </label>
        </>
      )}

      {view === 'homomorphism' && homomorphism && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Homomorphism View</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={homoVp.showLabels === true}
              onChange={e => updateViewParams({ showLabels: e.target.checked })} />
            Show labels
          </label>
        </>
      )}

      {view === 'action' && group && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Action View</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Action kind</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button data-testid="action-kind-conjugation" style={segBtn(actionKind === 'conjugation')}
                onClick={() => { setActionEdit(null); updateViewParams({ actionKind: 'conjugation' }) }}>Conjugation</button>
              <button data-testid="action-kind-regular" style={segBtn(actionKind === 'regular')}
                onClick={() => { setActionEdit(null); updateViewParams({ actionKind: 'regular' }) }}>Translation</button>
              <button data-testid="action-kind-custom" style={segBtn(actionKind === 'custom')}
                onClick={startOrEditCustom}>Custom</button>
            </div>
          </div>
          {actionKind === 'custom' && (
            <>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>|X| (1–20)</div>
                <input data-testid="action-set-size" type="number" min={1} max={20}
                  value={actionEdit ? actionEdit.setSize : (actionVp.setSize ?? 6)}
                  onChange={e => {
                    const v = Math.max(1, Math.min(20, Math.round(Number(e.target.value)) || 1))
                    if (actionEdit) setActionEdit({ ...actionEdit, setSize: v })
                    else updateViewParams({ setSize: v, arrows: undefined })
                  }}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                  }} />
              </div>
              {actionEdit ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <button data-testid="action-edit-complete" style={MINI_BTN}
                    onClick={verifyAndSaveCustom}>Complete &amp; verify</button>
                  <button style={MINI_BTN}
                    onClick={() => setActionEdit(p => p ? { ...p, arrows: [], error: null } : p)}>Clear arrows</button>
                  <button data-testid="action-edit-cancel" style={MINI_BTN}
                    onClick={() => setActionEdit(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ marginBottom: 6 }}>
                  <button data-testid="action-edit-start" style={MINI_BTN}
                    onClick={startOrEditCustom}>Edit arrows</button>
                </div>
              )}
            </>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={actionVp.showLabels === true}
              onChange={e => updateViewParams({ showLabels: e.target.checked })} />
            Show labels
          </label>
        </>
      )}

      {view === 'cayley' && group && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cayley View</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Shape</div>
            <select
              value={cayleyShapeValue}
              onChange={e => updateViewParams({ shape2D: e.target.value as CayleyShape2D })}
              style={{
                width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
              }}
            >
              {cayleyShapes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Multiply</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button title="Right multiply a·c" style={segBtn(cayleyVp.multiplyType !== 'left')}
                onClick={() => updateViewParams({ multiplyType: 'right' })}>a·c</button>
              <button title="Left multiply c·a" style={segBtn(cayleyVp.multiplyType === 'left')}
                onClick={() => updateViewParams({ multiplyType: 'left' })}>c·a</button>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Node radius</div>
            <input type="range" min={8} max={60} value={cayleyVp.nodeRadius ?? 28}
              onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.nodeRadius ?? 28}px</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span>Edge curvature</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {(cayleyVp.edgeCurvature ?? 1) === 0 ? 'straight' : `${cayleyVp.edgeCurvature ?? 1}×`}
              </span>
            </div>
            <input type="range" min={0} max={2} step={0.1} value={cayleyVp.edgeCurvature ?? 1}
              onChange={e => updateViewParams({ edgeCurvature: Number(e.target.value) })} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button style={segBtn((cayleyVp.edgeCurvature ?? 1) === 0)}
                onClick={() => updateViewParams({ edgeCurvature: 0 })}>Straight</button>
              <button style={segBtn((cayleyVp.edgeCurvature ?? 1) === 1)}
                onClick={() => updateViewParams({ edgeCurvature: 1 })}>Curved</button>
            </div>
          </div>
          <CayleyPathEditor
            value={cayleyVp.pathHighlight ?? null}
            onChange={next => updateViewParams({ pathHighlight: next })}
            resetKey={group.symbol}
          />
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={!!cayleyVp.forceDirected}
                onChange={e => updateViewParams({ forceDirected: e.target.checked })} />
              Live force-directed
            </label>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 19, marginTop: 2 }}>
              On top of the chosen shape — drag any node to feel the springs
            </div>
            {cayleyVp.forceDirected && (
              <div style={{ marginLeft: 19, marginTop: 6 }}>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span title="边的理想长度倍率（连线距离）：越大相邻节点越远、整图越舒展">Link length</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.force?.linkScale ?? 1}×</span>
                  </div>
                  <input type="range" min={0.3} max={3} step={0.1} value={cayleyVp.force?.linkScale ?? 1}
                    onChange={e => updateViewParams({ force: { ...(cayleyVp.force ?? {}), linkScale: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span title="节点间排斥力：越大越散开、越不易纠缠（远距离自动淡出，不产生全局耦合）">Repulsion</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.force?.repulsion ?? 1}×</span>
                  </div>
                  <input type="range" min={0.2} max={3} step={0.1} value={cayleyVp.force?.repulsion ?? 1}
                    onChange={e => updateViewParams({ force: { ...(cayleyVp.force ?? {}), repulsion: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span title="向心力：越大整图越向中心收拢。已按群阶归一，大群不会被压塌">Gravity</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.force?.gravity ?? 1}×</span>
                  </div>
                  <input type="range" min={0} max={3} step={0.1} value={cayleyVp.force?.gravity ?? 1}
                    onChange={e => updateViewParams({ force: { ...(cayleyVp.force ?? {}), gravity: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span title="连线刚度：越大越硬——拖拽时局部形状越不易走样（拖拽中自动加强、松手恢复）；也影响均衡密度与 Re-settle 结果">Rigidity</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyVp.force?.stiffness ?? 1}×</span>
                  </div>
                  <input type="range" min={0.4} max={3} step={0.1} value={cayleyVp.force?.stiffness ?? 1}
                    onChange={e => updateViewParams({ force: { ...(cayleyVp.force ?? {}), stiffness: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <button style={MINI_BTN}
                  title="回到给定形状：清除拖拽塑性记忆（探索出的新形状被丢弃）并重新投影到力平衡态"
                  onClick={() => updateViewParams({ force: { ...(cayleyVp.force ?? {}), settleSignal: (cayleyVp.force?.settleSignal ?? 0) + 1 } })}>
                  ⟳ Re-settle
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>Edge actions</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayleyEnabledCount}/{cayleyActionsList.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <button title="Add every element as an action" style={MINI_BTN}
                onClick={() => updateViewParams({ actions: addAllCayleyActionsHelper(group, 'cayley', 'cone', cayleyActionsList) })}>All</button>
              <button title="Clear all actions (no edges)" style={MINI_BTN}
                onClick={() => updateViewParams({ actions: [] })}>None</button>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {cayleyActionsList.map(a => {
                const el = group.elements.find(e => e.id === a.elementId)
                const scale = a.lengthScale ?? 1
                return (
                  <div key={a.elementId} style={{ marginBottom: 4 }}>
                    <label title={a.elementId} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={a.enabled}
                        onChange={() => updateViewParams({ actions: toggleCayleyActionReducer(cayleyActionsList, a.elementId) })} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                      <span
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label ?? a.elementId)) }}
                      />
                    </label>
                    {a.enabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 19 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>len</span>
                        <input type="range" min={0.3} max={3} step={0.1} value={scale}
                          onChange={e => setCayleyActionLength(a.elementId, Number(e.target.value))}
                          style={{ flex: 1, minWidth: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{scale}×</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {view === '3d' && group && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cayley 3D View</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Layout</div>
            <select
              value={layout3dValue}
              onChange={e => updateViewParams({ layout3D: e.target.value as Layout3D })}
              style={{
                width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
              }}
            >
              {shapes3d.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Multiply</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button title="Right multiply a·c" style={segBtn(p3d.multiplyType !== 'left')}
                onClick={() => updateViewParams({ multiplyType: 'right' })}>a·c</button>
              <button title="Left multiply c·a" style={segBtn(p3d.multiplyType === 'left')}
                onClick={() => updateViewParams({ multiplyType: 'left' })}>c·a</button>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Node size</div>
            <input type="range" min={0.5} max={2} step={0.1} value={p3d.nodeScale ?? 1}
              onChange={e => updateViewParams({ nodeScale: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(p3d.nodeScale ?? 1).toFixed(1)}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={!!p3d.autoRotate}
              onChange={e => updateViewParams({ autoRotate: e.target.checked })} />
            Auto rotate
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={p3d.showLabels !== false}
              onChange={e => updateViewParams({ showLabels: e.target.checked })} />
            Show labels
          </label>
          <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 6 }}>
            <CayleyPathEditor
              value={p3d.pathHighlight ?? null}
              onChange={next => updateViewParams({ pathHighlight: next })}
              resetKey={group.symbol}
            />
          </div>
          <div style={{ marginBottom: 6, borderTop: '1px solid var(--border-secondary)', paddingTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <input type="checkbox" checked={p3d.faceFill?.enabled !== false}
                onChange={e => patchFaceFill({ enabled: e.target.checked })} />
              Face fills (subgroup cosets)
            </label>
            <select
              value={faceSelSubgroup ? faceSelSubgroup.elementIds.join(',') : ''}
              onChange={e => {
                const cand = faceSubgroupCands.find(c => c.elementIds.join(',') === e.target.value)
                patchFaceFill({ enabled: true, subgroup: cand ? cand.elementIds : undefined })
              }}
              disabled={faceSubgroupCands.length === 0}
              style={{
                width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
              }}
            >
              <option value="">
                {faceSubgroupCands.length === 0
                  ? 'No selectable subgroup (order ≤ 60, coset faces must match geometry)'
                  : '— select subgroup —'}
              </option>
              {faceSubgroupCands.map(c => (
                <option key={c.elementIds.join(',')} value={c.elementIds.join(',')} title={c.elementIds.join(',')}>
                  {c.structure ?? `order ${c.order}`} ⟨{c.genLabel}⟩ · {c.faces.length} face{c.faces.length > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            {faceOn && faceSelSubgroup && (
              <>
                <div style={{ marginTop: 4 }}>
                  <div style={{ marginBottom: 2 }}>Opacity</div>
                  <input type="range" min={0.15} max={0.9} step={0.05} value={p3d.faceFill?.opacity ?? 0.45}
                    onChange={e => patchFaceFill({ opacity: Number(e.target.value) })}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 2px' }}>
                  {faceSelSubgroup.faces.length} coset face{faceSelSubgroup.faces.length > 1 ? 's' : ''} — colour each:
                </div>
                <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                  {faceSelSubgroup.faces.map((f, i) => (
                    <label key={f.key} title={f.hullElementIds.join(' · ')}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, cursor: 'pointer' }}>
                      <input type="color"
                        value={p3d.faceFill?.faceColors?.[f.key] ?? FACE_COLOR_PALETTE[i % FACE_COLOR_PALETTE.length]}
                        onChange={e => patchFaceFill({ faceColors: { ...(p3d.faceFill?.faceColors ?? {}), [f.key]: e.target.value } })}
                        style={{ width: 26, height: 18, border: 'none', background: 'none', padding: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        dangerouslySetInnerHTML={{
                          __html: renderTex(texify(
                            faceSelSubgroup.faces[i].hullElementIds[0]
                              ? group.elements.find(el => el.id === faceSelSubgroup.faces[i].hullElementIds[0])?.label ?? ''
                              : '',
                          )),
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{f.size}·H</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>Edge actions</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cayley3dEnabledCount}/{cayley3dActionsList.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <button title="Add every element as an action" style={MINI_BTN}
                onClick={() => updateViewParams({ actions: addAllCayleyActionsHelper(group, '3d', layout3dValue, cayley3dActionsList) })}>All</button>
              <button title="Clear all actions (no edges)" style={MINI_BTN}
                onClick={() => updateViewParams({ actions: [] })}>None</button>
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {cayley3dActionsList.map(a => {
                const el = group.elements.find(e => e.id === a.elementId)
                const scale = a.lengthScale ?? 1
                return (
                  <div key={a.elementId} style={{ marginBottom: 4 }}>
                    <label title={a.elementId} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={a.enabled}
                        onChange={() => updateViewParams({ actions: toggleCayleyActionReducer(cayley3dActionsList, a.elementId) })} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                      <span
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label ?? a.elementId)) }}
                      />
                    </label>
                    {a.enabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 19 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>len</span>
                        <input type="range" min={0.3} max={3} step={0.1} value={scale}
                          onChange={e => setCayley3DActionLength(a.elementId, Number(e.target.value))}
                          style={{ flex: 1, minWidth: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{scale}×</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {view === 'cycle' && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Cycle View</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={!!cycleVp.showMaximalCycles}
              onChange={e => updateViewParams({ showMaximalCycles: e.target.checked })} />
            Maximal cycles only
          </label>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Node radius</div>
            <input type="range" min={8} max={60} value={cycleVp.nodeRadius ?? 24}
              onChange={e => updateViewParams({ nodeRadius: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cycleVp.nodeRadius ?? 24}px</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cycleVp.showCycleLabels !== false}
              onChange={e => updateViewParams({ showCycleLabels: e.target.checked })} />
            Show ⟨g⟩ ≅ Zₙ captions
          </label>
        </>
      )}

      {(view === 'table' || view === 'heatmap') && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>{view === 'table' ? 'Table View' : 'Heatmap View'}</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Strategy</div>
            <select
              value={tableVp.strategy ?? 'subgroup'}
              onChange={e => updateViewParams({ strategy: e.target.value as TableStrategy })}
              style={{
                width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
              }}
            >
              <option value="subgroup">subgroup</option>
              <option value="random">random</option>
              <option value="full">full</option>
            </select>
          </div>
          {view === 'table' && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>Cell size</div>
              <input type="range" min={20} max={120} value={tableVp.cellSize ?? 50}
                onChange={e => updateViewParams({ cellSize: Number(e.target.value) })} style={{ width: '100%' }} />
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tableVp.cellSize ?? 50}px</span>
            </div>
          )}
        </>
      )}

      {view === 'sublattice' && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Lattice View</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Label detail</div>
            <select
              value={sublatticeParams.labelDetail ?? 'auto'}
              onChange={e => updateViewParams({ labelDetail: e.target.value as LatticeLabelDetail })}
              style={{
                width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
              }}
            >
              <option value="auto">auto</option>
              <option value="full">full cards</option>
              <option value="compact">pills</option>
              <option value="dots">dots</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <input
              type="checkbox"
              checked={sublatticeParams.mergeConjugates ?? false}
              onChange={e => updateViewParams({ mergeConjugates: e.target.checked })}
            />
            Merge conjugates
          </label>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            One node per conjugacy orbit; ×n badge is |G : N<sub>G</sub>(H)|
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ marginBottom: 2 }}>Card size</div>
            <input type="range" min={0.6} max={1.6} step={0.1} value={sublatticeParams.nodeScale ?? 1}
              onChange={e => updateViewParams({ nodeScale: Number(e.target.value) })} style={{ width: '100%' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(sublatticeParams.nodeScale ?? 1).toFixed(1)}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={sublatticeParams.showSeriesPanel ?? false}
              onChange={e => updateViewParams({ showSeriesPanel: e.target.checked })}
            />
            Series panel
          </label>
        </>
      )}

      {view === 'cosetstrip' && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Coset Strip View</div>
          {csOpts.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
              No non-trivial subgroup available here. {COSETSTRIP_NO_LOCAL_SUBGROUPS}.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Subgroup H</div>
                <select
                  value={csSubgroup?.key ?? ''}
                  onChange={e => {
                    const opt = csOpts.find(o => o.key === e.target.value)
                    if (opt) updateViewParams({ subgroup: opt.elementIds })
                  }}
                  title={csSubgroup ? `${csSubgroup.key} · orbit ${csSubgroup.orbitSize}` : undefined}
                  style={{
                    width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px',
                    fontSize: 11,
                  }}
                >
                  {csOpts.map(o => (
                    <option key={o.key} value={o.key}>{csOptionLabel(o)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Coset type</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button title="Left cosets gH (row element · H)" style={segBtn(csType !== 'right')}
                    onClick={() => updateViewParams({ cosetType: 'left' })}>gH</button>
                  <button title="Right cosets Hg (H · row element)" style={segBtn(csType === 'right')}
                    onClick={() => updateViewParams({ cosetType: 'right' })}>Hg</button>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <input type="checkbox" checked={cosetStripVp.showLabels ?? false}
                  onChange={e => updateViewParams({ showLabels: e.target.checked })} />
                Show node labels
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={cosetStripVp.showSubgroupCayley ?? false}
                  onChange={e => updateViewParams({ showSubgroupCayley: e.target.checked })} />
                Subgroup Cayley ring
              </label>
            </>
          )}
        </>
      )}

      {view === 'symmetry' && group && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 4 }}>Symmetry View</div>
          {symType === 'unsupported' ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
              This group type does not support the symmetry view (supported: cyclic Cₙ · dihedral Dₙ · A₄ · S₄ · A₅ · V₄).
            </div>
          ) : (
            <>
              {symCanDual && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ marginBottom: 2, fontSize: 11, color: 'var(--text-secondary)' }}>Solid shape</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button title="Primary solid" style={segBtn(!symVp.variant)}
                      onClick={() => updateViewParams({ variant: false })}>
                      {symType === 'cube' ? 'Cube' : 'Icosahedron'}
                    </button>
                    <button title="Dual solid" style={segBtn(!!symVp.variant)}
                      onClick={() => updateViewParams({ variant: true })}>
                      {symType === 'cube' ? 'Octahedron' : 'Dodecahedron'}
                    </button>
                  </div>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <input type="checkbox" checked={symShowAction}
                  onChange={e => updateViewParams({ showAction: e.target.checked, actionElementId: e.target.checked ? symActiveId : null })} />
                Show element actions
              </label>
              {symShowAction && (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ marginBottom: 2 }}>Speed</div>
                    <input type="range" min={0.2} max={5} step={0.1} value={symVp.rotateSpeed ?? 1}
                      onChange={e => updateViewParams({ rotateSpeed: Number(e.target.value) })} style={{ width: '100%' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{(symVp.rotateSpeed ?? 1).toFixed(1)}</span>
                  </div>
                  <div style={{ marginBottom: 3, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Action element</span>
                    {!config.actionLocked && symActiveId && (
                      <button
                        title="Reset pose (identity)"
                        data-testid="sym-panel-reset"
                        onClick={() => updateViewParams({ actionElementId: null })}
                        style={{
                          background: 'transparent', border: '1px solid var(--border-primary)',
                          color: 'var(--text-dim)', borderRadius: 4, padding: '1px 6px',
                          fontSize: 10, cursor: 'pointer',
                        }}
                      >
                        ✕ Reset pose
                      </button>
                    )}
                  </div>
                  {config.actionLocked ? (
                    /* 固定模式（actionLocked）：演示元素由宿主动作参数决定且不可切换 ——
                       Action element 列表与 Reset 隐藏，只读显示当前固定元素；
                       反复重看走窗口底部浮条 ⟳ Replay（重放不改变演示元素） */
                    <div
                      data-testid="sym-action-fixed"
                      style={{
                        border: '1px solid var(--border-primary)', borderRadius: 6, marginBottom: 6,
                        padding: '5px 8px', background: 'var(--bg-interactive)',
                      }}
                    >
                      {(() => {
                        const fixed = group.elements.find(el => el.id === symActiveId)
                        if (!fixed) return (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            No fixed element — set viewParams.actionElementId
                          </span>
                        )
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                              dangerouslySetInnerHTML={{ __html: renderTex(texify(fixed.label)) }} />
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                              fixed · ⟳ replay only
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div
                      data-testid="sym-action-list"
                      style={{
                        maxHeight: 150, overflowY: 'auto',
                        border: '1px solid var(--border-primary)', borderRadius: 6, marginBottom: 6,
                      }}
                    >
                      {group.elements.map(el => {
                        const active = el.id === symActiveId
                        return (
                          <button
                            key={el.id}
                            data-testid="sym-action-row"
                            title={active ? 'Replay this action' : el.id}
                            onClick={() => { if (active) setSymReplay(n => n + 1); else updateViewParams({ actionElementId: el.id }) }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', gap: 8, padding: '3px 8px',
                              border: 'none', borderBottom: '1px solid var(--border-primary)',
                              background: active ? 'var(--accent-teal)' : 'transparent',
                              color: active ? '#04222a' : 'var(--text-secondary)',
                              fontSize: 12, cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                            {active && <span style={{ fontSize: 10, fontWeight: 700 }}>▶</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={symVp.showFigureTitle === true}
                  onChange={e => updateViewParams({ showFigureTitle: e.target.checked })} />
                Figure caption (group name + geometry, in-scene)
              </label>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 12, borderTop: '1px solid var(--border-primary)', paddingTop: 8 }}>
        <button
          title="Reset to default parameters"
          style={{
            ...BTN_STYLE, fontSize: 11, padding: '4px 8px', width: '100%',
            border: '1px solid var(--border-primary)', borderRadius: 4,
            background: 'var(--bg-interactive)', color: 'var(--text-secondary)',
          }}
          onClick={resetAll}
        >↺ Reset to defaults</button>
      </div>
    </div>
  )
}

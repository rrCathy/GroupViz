import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { buildViewModes } from './constants'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import type { Layout3D, CayleyShape2D } from '../../core/types'

export function ViewPanel() {
  const {
    currentGroup,
    currentView,
    setCurrentView,
    multiViewMode,
    toggleMultiViewMode,
    openFloatingView,
    showMaximalCycles,
    setShowMaximalCycles,
    symmetryShowAction,
    symmetryRotateSpeed,
    setSymmetryShowAction,
    setSymmetryRotateSpeed,
    cayleyMultiplyType,
    cayleyShape3D,
    cayleyAvailableShapes3D,
    cayleyShape2D,
    cayleyAvailableShapes2D,
    cayleyActions,
    setCayleyMultiplyType,
    toggleCayleyAction,
    addAllCayleyActions,
    clearCayleyActions,
    setCayleyShape3D,
    setCayleyShape2D,
    runForceLayout,
  } = useGroup()
  const { t } = useTranslation()
  const VIEW_MODES = useMemo(() => buildViewModes(t), [t])

  const canonical3DEdgeIds = ((): string[] => {
    if (!currentGroup || currentView !== '3d') return []
    const sym = currentGroup.symbol
    if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') {
      if (cayleyShape3D === 'rhombicuboctahedron') return ['4,1,2,3', '3,1,2,4']
      if (cayleyShape3D === 'truncatedOctahedron2') return ['2,3,4,1', '2,1,3,4']
      if (cayleyShape3D === 'truncatedOctahedron3') return ['2,1,3,4', '1,3,2,4', '1,2,4,3']
      if (cayleyShape3D === 'truncatedCube') return ['1,4,2,3', '2,1,3,4']
    }
    if (sym === 'A_{5}' || sym === 'A5' || sym === 'A₅') {
      if (cayleyShape3D === 'truncatedIcosahedron') return ['2,3,4,5,1', '2,1,4,3,5']
      if (cayleyShape3D === 'truncatedDodecahedron') return ['2,3,1,4,5', '1,5,4,3,2']
    }
    return []
  })()

  return (
    <AccordionSection
      title={t('panel.viewMode')}
      icon="⊞"
      defaultOpen={true}
      badge={currentGroup ? VIEW_MODES.find(m => m.value === currentView)?.label : undefined}
    >
      {/* View mode cards */}
      <div className="view-modes-grid">
        {VIEW_MODES.map(mode => (
          <button
            key={mode.value}
            className={`view-mode-card ${currentView === mode.value ? 'active' : ''}`}
            onClick={() => setCurrentView(mode.value)}
            disabled={!currentGroup}
            title={mode.desc}
          >
            <span className="view-mode-icon">{mode.icon}</span>
            <span className="view-mode-label">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Multi-view toggle */}
      <label className="panel-checkbox" style={{ marginTop: '6px' }}>
        <input type="checkbox" checked={multiViewMode} onChange={toggleMultiViewMode} disabled={!currentGroup} />
        <span>{t('panel.multiView')}</span>
      </label>
      {multiViewMode && (
        <div className="multi-view-list">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.value}
              className="panel-btn"
              onClick={() => openFloatingView(mode.value)}
              disabled={!currentGroup}
              style={{ fontSize: '12px', padding: '3px 8px' }}
            >
              {t('panel.floatView', { label: mode.label })}
            </button>
          ))}
        </div>
      )}

      {/* Contextual settings based on current view */}
      {currentView === 'cayley' && currentGroup && (
        <div className="view-context-settings" style={{ marginTop: '8px' }}>
          <div className="cayley-multiply">
            <span className="settings-label">{t('panel.multiplyType')}</span>
            <div className="toggle-group">
              <button className={`toggle-btn ${cayleyMultiplyType === 'right' ? 'active' : ''}`} onClick={() => setCayleyMultiplyType('right')}>{t('panel.multiplyRight')}</button>
              <button className={`toggle-btn ${cayleyMultiplyType === 'left' ? 'active' : ''}`} onClick={() => setCayleyMultiplyType('left')}>{t('panel.multiplyLeft')}</button>
            </div>
          </div>
          {cayleyAvailableShapes2D.length > 0 && (
            <div className="cayley-shape">
              <span className="settings-label">{t('panel.shape')}</span>
              <select value={cayleyShape2D} onChange={(e) => setCayleyShape2D(e.target.value as CayleyShape2D)} className="shape-select">
                {cayleyAvailableShapes2D.map(shape => (<option key={shape} value={shape}>{t(`panel.shape.${shape}`)}</option>))}
              </select>
            </div>
          )}
          {!(cayleyShape2D === 'concentric' || cayleyShape2D === 'dualRing' || cayleyShape2D === 'projection3D' || cayleyShape2D === 'rewiring') && (
            <button className="panel-btn" onClick={runForceLayout} disabled={!currentGroup} style={{ width: '100%', marginTop: '4px' }}>{t('panel.forceLayout')}</button>
          )}
          <div className="cayley-actions-compact">
            <div className="cayley-actions-header">
              <span className="settings-label">{t('panel.elementActions', { n: cayleyActionsFilter(cayleyActions).length, m: cayleyActions.length })}</span>
              <div className="cayley-actions-buttons">
                <button className="panel-btn" onClick={addAllCayleyActions} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px' }}>{t('panel.selectAll')}</button>
                <button className="panel-btn" onClick={clearCayleyActions} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px' }}>{t('panel.clear')}</button>
              </div>
            </div>
            <div className="cayley-actions-list scrollable-list">
              {cayleyActions.map(action => {
                const el = currentGroup?.elements.find(e => e.id === action.elementId)
                const isListedGenerator = currentGroup?.generators.some(g => g.apply(currentGroup.identity).id === action.elementId)
                return (
                  <div key={action.elementId} className={`cayley-action-item ${action.enabled ? '' : 'disabled'}`}>
                    <input type="checkbox" checked={action.enabled} onChange={() => toggleCayleyAction(action.elementId)} />
                    <span className="action-color" style={{ background: action.color }} />
                    <span className="action-label" dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label || action.elementId)) }} />
                    {!isListedGenerator && <span className="action-hint" style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: '11px' }}>({t('cayley.action.byElement')})</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {currentView === '3d' && currentGroup && (
        <div className="view-context-settings" style={{ marginTop: '8px' }}>
          <div className="cayley-multiply">
            <span className="settings-label">{t('panel.multiplyType')}</span>
            <div className="toggle-group">
              <button className={`toggle-btn ${cayleyMultiplyType === 'right' ? 'active' : ''}`} onClick={() => setCayleyMultiplyType('right')}>{t('panel.multiplyRight')}</button>
              <button className={`toggle-btn ${cayleyMultiplyType === 'left' ? 'active' : ''}`} onClick={() => setCayleyMultiplyType('left')}>{t('panel.multiplyLeft')}</button>
            </div>
          </div>
          <div className="cayley-shape">
            <span className="settings-label">{t('panel.shape')}</span>
            <select value={cayleyShape3D} onChange={(e) => setCayleyShape3D(e.target.value as Layout3D)} className="shape-select">
              {cayleyAvailableShapes3D.map(shape => (<option key={shape} value={shape}>{shape}</option>))}
            </select>
          </div>
          <div className="cayley-actions-compact">
            <div className="cayley-actions-header">
              <span className="settings-label">{t('panel.elementActions', { n: cayleyActionsFilter(cayleyActions).length, m: cayleyActions.length })}</span>
              <div className="cayley-actions-buttons">
                <button className="panel-btn" onClick={addAllCayleyActions} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px' }}>{t('panel.selectAll')}</button>
                <button className="panel-btn" onClick={clearCayleyActions} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px' }}>{t('panel.clear')}</button>
              </div>
            </div>
            <div className="cayley-actions-list scrollable-list">
              {cayleyActions.map(action => {
                const el = currentGroup?.elements.find(e => e.id === action.elementId)
                const isCanonical = canonical3DEdgeIds.includes(action.elementId)
                return (
                  <div key={action.elementId} className={`cayley-action-item ${action.enabled ? '' : 'disabled'}`}>
                    <input type="checkbox" checked={action.enabled} onChange={() => toggleCayleyAction(action.elementId)} />
                    <span className="action-color" style={{ background: action.color }} />
                    <span className="action-label" dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label || action.elementId)) }} />
                    {!isCanonical && <span className="action-hint" style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: '11px' }}>({t('cayley.action.byElement')})</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {currentView === 'cycle' && (
        <label className="panel-checkbox" style={{ marginTop: '6px' }}>
          <input type="checkbox" checked={showMaximalCycles} onChange={(e) => setShowMaximalCycles(e.target.checked)} disabled={!currentGroup} />
          <span>{t('panel.showMaximalCycles')}</span>
        </label>
      )}

      {currentView === 'symmetry' && (
        <div className="symmetry-settings" style={{ marginTop: '6px' }}>
          <label className="panel-checkbox">
            <input type="checkbox" checked={symmetryShowAction} onChange={(e) => setSymmetryShowAction(e.target.checked)} disabled={!currentGroup} />
            <span>{t('panel.showAction')}</span>
          </label>
          {symmetryShowAction && (
            <div className="symmetry-speed">
              <div className="param-row">
                <span className="param-label">{t('panel.speed')}</span>
                <span className="param-value">{symmetryRotateSpeed.toFixed(1)}x</span>
                <input type="range" min={0.2} max={5} step={0.1} value={symmetryRotateSpeed} onChange={(e) => setSymmetryRotateSpeed(parseFloat(e.target.value))} className="param-slider" />
              </div>
            </div>
          )}
        </div>
      )}
    </AccordionSection>
  )
}

// helper to avoid referencing undefined cayleyActions in the filter expression
function cayleyActionsFilter(actions: { enabled: boolean }[]) {
  return actions.filter(a => a.enabled)
}

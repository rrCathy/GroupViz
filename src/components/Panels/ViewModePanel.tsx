import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { buildViewModes } from './constants'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'

export function ViewModePanel() {
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
  } = useGroup()
  const { t } = useTranslation()
  const VIEW_MODES = useMemo(() => buildViewModes(t), [t])

  return (
    <AccordionSection
      title={t('panel.viewMode')}
      icon="⊞"
      defaultOpen={true}
      badge={currentGroup ? VIEW_MODES.find(m => m.value === currentView)?.label : undefined}
    >
      {/* View mode grid */}
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
      <label className="panel-checkbox" style={{ marginTop: '4px' }}>
        <input
          type="checkbox"
          checked={multiViewMode}
          onChange={toggleMultiViewMode}
          disabled={!currentGroup}
        />
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

      {/* Cycle view option */}
      {currentView === 'cycle' && (
        <label className="panel-checkbox" style={{ marginTop: '6px' }}>
          <input
            type="checkbox"
            checked={showMaximalCycles}
            onChange={(e) => setShowMaximalCycles(e.target.checked)}
            disabled={!currentGroup}
          />
          <span>{t('panel.showMaximalCycles')}</span>
        </label>
      )}

      {/* Symmetry view options */}
      {currentView === 'symmetry' && (
        <div className="symmetry-settings">
          <label className="panel-checkbox">
            <input
              type="checkbox"
              checked={symmetryShowAction}
              onChange={(e) => setSymmetryShowAction(e.target.checked)}
              disabled={!currentGroup}
            />
            <span>{t('panel.showAction')}</span>
          </label>
          {symmetryShowAction && (
            <div className="symmetry-speed">
              <div className="param-row">
                <span className="param-label">{t('panel.speed')}</span>
                <span className="param-value">{symmetryRotateSpeed.toFixed(1)}x</span>
                <input
                  type="range"
                  min={0.2}
                  max={5}
                  step={0.1}
                  value={symmetryRotateSpeed}
                  onChange={(e) => setSymmetryRotateSpeed(parseFloat(e.target.value))}
                  className="param-slider"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AccordionSection>
  )
}

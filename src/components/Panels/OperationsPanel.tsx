import { useGroup } from '../../context/useGroup'
import { exportView, exportSymmetryAsGif } from '../../utils/export'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'

export function OperationsPanel() {
  const {
    currentGroup,
    currentView,
    selectedElements,
    subsets,
    cosetSubsetId,
    cosetType,
    showAllCosets,
    cosetData,
    symmetryShowAction,
    symmetryActionElementId,
    cayleyShape2D,
    computeInverse,
    clearCanvas,
    resetNodePositions,
    runForceLayout,
    saveSubset,
    removeSubset,
    clearAllSubsets,
    showCosetsForSubset,
    hideCosets,
    setCosetType,
    toggleShowAllCosets,
    setSymmetryActionElementId,
  } = useGroup()
  const { t } = useTranslation()

  return (
    <AccordionSection
      title={t('panel.operations')}
      icon="⚙"
      defaultOpen={false}
    >
      {/* Group operations */}
      <div className="operations-grid">
        <button
          className="panel-btn"
          onClick={computeInverse}
          disabled={!currentGroup}
        >
          {t('panel.inverse')}
        </button>
        <button
          className="panel-btn"
          onClick={clearCanvas}
          disabled={!currentGroup}
        >
          {t('panel.clearCanvas')}
        </button>
        <button
          className="panel-btn"
          onClick={() => resetNodePositions()}
          disabled={!currentGroup}
        >
          {t('panel.resetPositions')}
        </button>
        <button
          className="panel-btn"
          onClick={runForceLayout}
          disabled={!currentGroup || (currentView !== 'cayley' && currentView !== 'cycle') || cayleyShape2D === 'cosetStrip' || cayleyShape2D === 'concentric' || cayleyShape2D === 'dualRing' || cayleyShape2D === 'projection3D'}
        >
          {t('panel.forceLayout')}
        </button>
      </div>

      {/* Export */}
      <div className="export-section" style={{ marginTop: '8px' }}>
        <div className="subset-section-header">{t('panel.exportView')}</div>
        <button
          className="panel-btn"
          onClick={() => {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const viewName = currentView === '3d' ? '3d_cayley' : currentView
            const is3d = currentView === '3d' || currentView === 'symmetry'
            const ext = is3d ? 'png' : 'svg'
            exportView(currentView, `groupviz_${viewName}_${ts}.${ext}`)
          }}
          disabled={!currentGroup}
          style={{ width: '100%' }}
        >
          {currentView === '3d' || currentView === 'symmetry' ? t('panel.exportPng') : t('panel.exportSvg')}
        </button>
        {currentView === 'symmetry' && (
          <button
            className="panel-btn"
            onClick={() => {
              const elId = symmetryActionElementId
              if (!currentGroup || !elId) {
                alert(t('panel.selectElementFirst'))
                return
              }
              const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
              setSymmetryActionElementId(null)
              setTimeout(() => {
                setSymmetryActionElementId(elId)
                setTimeout(() => {
                  exportSymmetryAsGif(`groupviz_symmetry_${ts}.gif`, 1700, 20, () => {
                    setSymmetryActionElementId(null)
                    setTimeout(() => setSymmetryActionElementId(elId), 40)
                  })
                }, 80)
              }, 120)
            }}
            disabled={!currentGroup || !symmetryShowAction || !symmetryActionElementId}
            style={{ width: '100%', marginTop: '4px' }}
          >
            {t('panel.exportGif')}
          </button>
        )}
      </div>

      {/* Subset management */}
      <div className="subset-section">
        <div className="subset-section-header">{t('panel.subsetManagement')}</div>

        <button
          className="panel-btn"
          onClick={saveSubset}
          disabled={!currentGroup || selectedElements.size === 0}
          style={{
            width: '100%',
            backgroundColor: selectedElements.size > 0 ? 'var(--accent-teal)' : undefined,
            color: selectedElements.size > 0 ? '#0f0f1a' : undefined,
            borderColor: selectedElements.size > 0 ? 'var(--accent-teal)' : undefined
          }}
        >
          {t('panel.saveAsSubset', { n: selectedElements.size })}
        </button>

        {subsets.length > 0 && (
          <>
            <button
              className="panel-btn"
              onClick={clearAllSubsets}
              style={{ width: '100%', fontSize: '11px', marginTop: '-4px' }}
            >
              {t('panel.clearAllSubsets')}
            </button>
            <div className="subsets-list">
              {subsets.map(subset => (
                <div key={subset.id} className="subset-item">
                  <span className="subset-color" style={{ background: subset.color }} />
                  <span className="subset-name">{subset.label}</span>
                  <span className="subset-size">({subset.elementIds.length})</span>
                  {subset.isNormalSubgroup && (
                    <span className="subset-badge normal">{t('badge.normal')}</span>
                  )}
                  {subset.isSubgroup && !subset.isNormalSubgroup && (
                    <span className="subset-badge subgroup">{t('badge.subgroup')}</span>
                  )}
                  <button
                    onClick={() => removeSubset(subset.id)}
                    className="subset-remove"
                  >
                    ×
                  </button>
                  {subset.isSubgroup && (
                    <button
                      className={`panel-btn ${cosetSubsetId === subset.id ? 'active-coset' : ''}`}
                      onClick={() => showCosetsForSubset(subset.id)}
                      style={{
                        width: '100%',
                        fontSize: '10px',
                        padding: '2px 6px',
                        marginTop: '4px',
                        backgroundColor: cosetSubsetId === subset.id ? 'var(--accent-teal)' : undefined,
                        color: cosetSubsetId === subset.id ? '#0f0f1a' : undefined,
                        borderColor: cosetSubsetId === subset.id ? 'var(--accent-teal)' : undefined
                      }}
                    >
                      {cosetSubsetId === subset.id ? t('panel.hideCosets') : t('panel.showCosets')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Coset controls */}
        {cosetSubsetId && cosetData && (
          <div className="coset-controls" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="settings-label">{t('panel.cosetType')}</span>
              <button
                onClick={hideCosets}
                className="subset-remove"
                style={{ fontSize: '14px', lineHeight: '14px' }}
                title={t('panel.hideCosets')}
              >
                ×
              </button>
            </div>
            <div className="coset-type-toggle" style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                className={`toggle-btn ${cosetType === 'left' ? 'active' : ''}`}
                onClick={() => setCosetType('left')}
                style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}
              >
                {t('coset.left')}
              </button>
              <button
                className={`toggle-btn ${cosetType === 'right' ? 'active' : ''}`}
                onClick={() => setCosetType('right')}
                style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}
              >
                {t('coset.right')}
              </button>
            </div>
            <button
              className={`panel-btn ${showAllCosets ? 'active-coset' : ''}`}
              onClick={toggleShowAllCosets}
              style={{
                width: '100%',
                fontSize: '11px',
                padding: '4px 8px',
                backgroundColor: showAllCosets ? 'var(--accent-teal)' : undefined,
                color: showAllCosets ? '#0f0f1a' : undefined,
                borderColor: showAllCosets ? 'var(--accent-teal)' : undefined
              }}
            >
              {showAllCosets ? t('panel.showSelected') : t('panel.showAllCosets')}
            </button>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
              {t('panel.indices', { index: cosetData.subgroup.index })} · {t('panel.cosetCount', { count: cosetType === 'left' ? cosetData.leftCosets.length : cosetData.rightCosets.length })}
            </div>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}

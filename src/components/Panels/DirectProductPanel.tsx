import { useGroup } from '../../context/useGroup'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'

export function DirectProductPanel() {
  const { directProductGroups } = useGroup()
  const { t } = useTranslation()
  return (
    <AccordionSection title={t('dp.title')} icon="⊗" defaultOpen={false} badge={directProductGroups.length > 0 ? <span>{directProductGroups.length}</span> : undefined}>
      <DirectProductInner />
    </AccordionSection>
  )
}

function DirectProductInner() {
  const {
    currentGroup, setCurrentGroup, setCurrentView,
    isDirectProductMode, directProductSource, directProductTarget, directProductCreationMode, directProductGroups,
    toggleDirectProductMode, setDirectProductSource, setDirectProductTarget, setDirectProductCreationMode,
    executeDirectProduct, storeDirectProductGroup, removeDirectProductGroup, loadDirectProductGroup,
  } = useGroup()
  const { t } = useTranslation()

  return (
    <div>
      <button className={`panel-btn ${isDirectProductMode ? 'dp-active' : ''}`} onClick={toggleDirectProductMode} style={{ width: '100%', backgroundColor: isDirectProductMode ? 'var(--accent-teal)' : undefined, color: isDirectProductMode ? '#0f0f1a' : undefined, borderColor: isDirectProductMode ? 'var(--accent-teal)' : undefined }}>
        {isDirectProductMode ? t('dp.exitMode') : t('dp.enterMode')}
      </button>

      {isDirectProductMode && (
        <>
          <div className="dp-mode-section">
            <span className="settings-label">{t('dp.mode')}</span>
            <div className="toggle-group" style={{ marginTop: '4px' }}>
              <button className={`toggle-btn ${directProductCreationMode === 'cayley' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('cayley')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.cayley')}</button>
              <button className={`toggle-btn ${directProductCreationMode === 'table' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('table')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.table')}</button>
              <button className={`toggle-btn ${directProductCreationMode === 'direct' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('direct')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.direct')}</button>
            </div>
          </div>

          <div className="dp-group-select">
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('dp.sourceGroup')}: {directProductSource ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(directProductSource.symbol)) }} /> : <span className="text-muted">{t('dp.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setDirectProductSource(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('dp.importGroup')} G</button>
          </div>

          <div className="dp-group-select" style={{ marginBottom: '6px' }}>
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('dp.targetGroup')}: {directProductTarget ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(directProductTarget.symbol)) }} /> : <span className="text-muted">{t('dp.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setDirectProductTarget(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('dp.importGroup')} H</button>
          </div>

          <button className="panel-btn dp-create-btn" onClick={() => { const product = executeDirectProduct(); if (product) { storeDirectProductGroup(product); setCurrentGroup(product); setCurrentView('cayley') } }} disabled={!directProductSource || !directProductTarget} style={{ width: '100%', backgroundColor: directProductSource && directProductTarget ? 'var(--accent-teal)' : undefined, color: directProductSource && directProductTarget ? '#0f0f1a' : undefined, borderColor: directProductSource && directProductTarget ? 'var(--accent-teal)' : undefined }}>
            {t('dp.createDirectProduct')}
          </button>
        </>
      )}

      <div className="dp-group-list">
        <div className="subset-section-header">{t('dp.groupList')}</div>
        {directProductGroups.length === 0 ? (
          <div className="text-muted" style={{ fontSize: '11px', padding: '4px 0' }}>{t('dp.noGroups')}</div>
        ) : (
          <div className="subsets-list scrollable-list">
            {directProductGroups.map(group => (
              <div key={group.symbol} className="subset-item" style={{ flexWrap: 'wrap' }}>
                <span className="subset-name" style={{ cursor: 'pointer', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }} onClick={() => loadDirectProductGroup(group.symbol)} />
                <span className="subset-size">(|G|={group.order})</span>
                <button onClick={() => removeDirectProductGroup(group.symbol)} className="subset-remove" style={{ fontSize: '16px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentGroup && <button className="panel-btn" onClick={() => storeDirectProductGroup(currentGroup)} style={{ width: '100%', fontSize: '11px', marginTop: '6px' }}>{t('dp.storeGroup')}</button>}
    </div>
  )
}

import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { TabBar, type TabDef } from './TabBar'

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
    quotientGroups,
    automorphismGroups,
    computeInverse,
    clearCanvas,
    resetNodePositions,
    saveSubset,
    removeSubset,
    clearAllSubsets,
    showCosetsForSubset,
    hideCosets,
    setCosetType,
    toggleShowAllCosets,
    createQuotientGroupWithHomomorphism,
    removeQuotientGroup,
    computeAutomorphismGroup,
    removeAutomorphismGroup,
    setCurrentGroup,
  } = useGroup()
  const { t } = useTranslation()

  const inCosetStripMode = currentView === 'cosetstrip'

  const generalTab: TabDef = {
    key: 'general',
    label: t('panel.operations'),
    icon: '⚙',
    content: (
      <div className="operations-grid">
        <button className="panel-btn" onClick={computeInverse} disabled={!currentGroup}>{t('panel.inverse')}</button>
        <button className="panel-btn" onClick={clearCanvas} disabled={!currentGroup}>{t('panel.clearCanvas')}</button>
        <button className="panel-btn" onClick={() => resetNodePositions()} disabled={!currentGroup}>{t('panel.resetPositions')}</button>
      </div>
    ),
  }

  const subsetTab: TabDef = {
    key: 'subsets',
    label: t('panel.subsetManagement'),
    icon: '⊂',
    content: inCosetStripMode ? (
      <div>
        {cosetSubsetId && cosetData ? (
          <div className="coset-controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="settings-label">{t('panel.cosetType')}</span>
              <button onClick={hideCosets} className="subset-remove" style={{ fontSize: '14px', lineHeight: '14px' }} title={t('panel.hideCosets')}>×</button>
            </div>
            <div className="coset-type-toggle" style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button className={`toggle-btn ${cosetType === 'left' ? 'active' : ''}`} onClick={() => setCosetType('left')} style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}>{t('coset.left')}</button>
              <button className={`toggle-btn ${cosetType === 'right' ? 'active' : ''}`} onClick={() => setCosetType('right')} style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}>{t('coset.right')}</button>
            </div>
            <button
              className={`panel-btn ${showAllCosets ? 'active-coset' : ''}`}
              onClick={toggleShowAllCosets}
              style={{
                width: '100%', fontSize: '11px', padding: '4px 8px',
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
        ) : (
          <p className="info-placeholder" style={{ fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
            点击右侧面板中的子群以查看陪集
          </p>
        )}
      </div>
    ) : (
      <div>
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
            <button className="panel-btn" onClick={clearAllSubsets} style={{ width: '100%', fontSize: '11px', marginTop: '4px' }}>
              {t('panel.clearAllSubsets')}
            </button>
            <div className="subsets-list scrollable-list">
              {subsets.map(subset => (
                <div key={subset.id} className="subset-item">
                  <span className="subset-color" style={{ background: subset.color }} />
                  <span className="subset-name">{subset.label}</span>
                  <span className="subset-size">({subset.elementIds.length})</span>
                  {subset.isNormalSubgroup && (<span className="subset-badge normal">{t('badge.normal')}</span>)}
                  {subset.isSubgroup && !subset.isNormalSubgroup && (<span className="subset-badge subgroup">{t('badge.subgroup')}</span>)}
                  <button onClick={() => removeSubset(subset.id)} className="subset-remove">×</button>
                  {subset.isSubgroup && (
                    <button
                      className={`panel-btn ${cosetSubsetId === subset.id ? 'active-coset' : ''}`}
                      onClick={() => showCosetsForSubset(subset.id)}
                      style={{
                        width: '100%', fontSize: '10px', padding: '2px 6px', marginTop: '4px',
                        backgroundColor: cosetSubsetId === subset.id ? 'var(--accent-teal)' : undefined,
                        color: cosetSubsetId === subset.id ? '#0f0f1a' : undefined,
                        borderColor: cosetSubsetId === subset.id ? 'var(--accent-teal)' : undefined
                      }}
                    >
                      {cosetSubsetId === subset.id ? t('panel.hideCosets') : t('panel.showCosets')}
                    </button>
                  )}
                  {subset.isNormalSubgroup && (
                    <button
                      className="panel-btn"
                      onClick={() => {
                        createQuotientGroupWithHomomorphism(subset.id)
                      }}
                      style={{
                        width: '100%', fontSize: '10px', padding: '2px 6px', marginTop: '4px',
                        backgroundColor: 'var(--accent-purple)',
                        color: '#0f0f1a',
                        borderColor: 'var(--accent-purple)'
                      }}
                    >
                      {t('quotient.create')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {cosetSubsetId && cosetData && (
          <div className="coset-controls" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="settings-label">{t('panel.cosetType')}</span>
              <button onClick={hideCosets} className="subset-remove" style={{ fontSize: '14px', lineHeight: '14px' }} title={t('panel.hideCosets')}>×</button>
            </div>
            <div className="coset-type-toggle" style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button className={`toggle-btn ${cosetType === 'left' ? 'active' : ''}`} onClick={() => setCosetType('left')} style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}>{t('coset.left')}</button>
              <button className={`toggle-btn ${cosetType === 'right' ? 'active' : ''}`} onClick={() => setCosetType('right')} style={{ flex: 1, fontSize: '11px', padding: '3px 6px' }}>{t('coset.right')}</button>
            </div>
            <button
              className={`panel-btn ${showAllCosets ? 'active-coset' : ''}`}
              onClick={toggleShowAllCosets}
              style={{
                width: '100%', fontSize: '11px', padding: '4px 8px',
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
    ),
  }

  const quotientTab: TabDef = {
    key: 'quotient',
    label: t('quotient.title'),
    icon: 'G/N',
    content: (
      <div>
        <p className="info-placeholder" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
          {t('quotient.boundHint')}
        </p>
        {quotientGroups.length === 0 ? (
          <p className="info-placeholder" style={{ fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
            {t('quotient.noQuotient')}
          </p>
        ) : (
          <div className="subsets-list scrollable-list">
            {quotientGroups.map(entry => (
              <div key={entry.id} className="subset-item">
                <span className="subset-color" style={{ background: '#a78bfa' }} />
                <span className="subset-name">{entry.group.symbol}</span>
                <span className="subset-size">({entry.order})</span>
                <span className="subset-badge" style={{ fontSize: '9px' }}>
                  {entry.parentSymbol}/N
                </span>
                {entry.isoSymbol && (
                  <span className="subset-badge" style={{
                    fontSize: '9px',
                    background: 'rgba(167, 139, 250, 0.2)',
                    color: 'var(--accent-purple)',
                  }}>
                    ≅ {entry.isoSymbol}
                  </span>
                )}
                <button
                  className="panel-btn"
                  onClick={() => setCurrentGroup(entry.group)}
                  style={{
                    width: '100%', fontSize: '10px', padding: '2px 6px', marginTop: '4px',
                  }}
                >
                  {t('quotient.load')}
                </button>
                <button
                  onClick={() => removeQuotientGroup(entry.id)}
                  className="subset-remove"
                  style={{ marginTop: '2px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  }

  const automorphismTab: TabDef = {
    key: 'automorphism',
    label: t('automorphism.title'),
    icon: 'Aut',
    content: (
      <div>
        <p className="info-placeholder" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
          {t('automorphism.boundHint')}
        </p>
        <button
          className="panel-btn"
          onClick={() => computeAutomorphismGroup()}
          disabled={!currentGroup}
          style={{ width: '100%', marginBottom: '8px' }}
        >
          {t('automorphism.compute')}
        </button>
        {automorphismGroups.length === 0 ? (
          <p className="info-placeholder" style={{ fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
            {t('automorphism.noAutomorphism')}
          </p>
        ) : (
          <div className="subsets-list scrollable-list">
            {automorphismGroups.map(entry => (
              <div key={entry.id} className="subset-item">
                <span className="subset-color" style={{ background: '#f97316' }} />
                <span className="subset-name">Aut({entry.parentSymbol})</span>
                <span className="subset-size">({entry.order})</span>
                {entry.isoSymbol && (
                  <span className="subset-badge" style={{
                    fontSize: '9px',
                    background: 'rgba(249, 115, 22, 0.2)',
                    color: 'var(--accent-orange)',
                  }}>
                    ≅ {entry.isoSymbol}
                  </span>
                )}
                <button
                  className="panel-btn"
                  onClick={() => setCurrentGroup(entry.group)}
                  style={{
                    width: '100%', fontSize: '10px', padding: '2px 6px', marginTop: '4px',
                  }}
                >
                  {t('automorphism.load')}
                </button>
                <button
                  onClick={() => removeAutomorphismGroup(entry.id)}
                  className="subset-remove"
                  style={{ marginTop: '2px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  }

  const tabs = [generalTab, subsetTab, quotientTab, automorphismTab]

  return (
    <AccordionSection
      title={t('panel.operations')}
      icon="⚙"
      defaultOpen={false}
    >
      <TabBar tabs={tabs} compact />
    </AccordionSection>
  )
}

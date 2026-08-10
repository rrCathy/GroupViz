import { useGroup } from '../../context/useGroup'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { getGeneratorElements } from '../../core/algebra/homomorphisms'

export function SemidirectProductPanel() {
  const { t } = useTranslation()
  const { sdPanelOpen, setSDPanelOpen } = useGroup()
  return (
    <AccordionSection title={t('sd.title')} icon="⋉" defaultOpen={false} open={sdPanelOpen} onToggle={() => setSDPanelOpen(!sdPanelOpen)}>
      <SemidirectProductInner />
    </AccordionSection>
  )
}

function SemidirectProductInner() {
  const {
    currentGroup, setCurrentGroup, setCurrentView,
    isSemidirectProductMode, sdNormalSubgroup, sdActingGroup,
    sdAutNGroup, sdAutNList, sdPhiGenMapping, sdPhiValid,
    sdSemidirectProductGroups, sdDecompositions, sdActiveDecomposition,
    toggleSemidirectProductMode, setSDNormalSubgroup, setSDActingGroup,
    computeAutN, setPhiGenMapping, expandPhiFull, executeSemidirectProduct,
    storeSemidirectProductGroup, removeSemidirectProductGroup, loadSemidirectProductGroup,
    selectSemidirectDecomposition,
  } = useGroup()
  const { t } = useTranslation()

  return (
    <div>
      <button className={`panel-btn ${isSemidirectProductMode ? 'dp-active' : ''}`} onClick={toggleSemidirectProductMode} style={{ width: '100%', backgroundColor: isSemidirectProductMode ? 'var(--accent-orange)' : undefined, color: isSemidirectProductMode ? '#0f0f1a' : undefined, borderColor: isSemidirectProductMode ? 'var(--accent-orange)' : undefined }}>
        {isSemidirectProductMode ? t('sd.exitMode') : t('sd.enterMode')}
      </button>

      {isSemidirectProductMode && (
        <>
          <div className="dp-group-select" style={{ marginTop: '8px' }}>
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('sd.normalSubgroup')}: {sdNormalSubgroup ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(sdNormalSubgroup.symbol)) }} /> : <span className="text-muted">{t('sd.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setSDNormalSubgroup(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('sd.importAsN')}</button>
          </div>

          <div className="dp-group-select" style={{ marginBottom: '6px' }}>
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('sd.actingGroup')}: {sdActingGroup ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(sdActingGroup.symbol)) }} /> : <span className="text-muted">{t('sd.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setSDActingGroup(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('sd.importAsH')}</button>
          </div>

          {sdNormalSubgroup && (
            <button className="panel-btn" onClick={computeAutN} style={{ width: '100%', marginBottom: '6px', backgroundColor: 'var(--accent-teal)', color: '#0f0f1a', borderColor: 'var(--accent-teal)' }}>
              {t('sd.computeAut')}
            </button>
          )}

          {sdAutNGroup && sdAutNList.length > 0 && sdActingGroup && (
            <>
              <div className="subset-section-header">{t('sd.phiMapping')}</div>
              <div className="subsets-list scrollable-list" style={{ maxHeight: '160px' }}>
                {getGeneratorElements(sdActingGroup).map(({ el: genEl }) => {
                  const curAutoId = sdPhiGenMapping.get(genEl.id) || sdAutNList[0].id
                  return (
                    <div key={genEl.id} className="subset-item" style={{ flexWrap: 'wrap', gap: '4px' }}>
                      <span className="subset-name" style={{ fontSize: '11px' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(genEl.label)) }} />
                      <select
                        value={curAutoId}
                        onChange={(e) => setPhiGenMapping(genEl.id, e.target.value)}
                        style={{ fontSize: '10px', flex: 1, minWidth: '80px' }}
                      >
                        {sdAutNList.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
              <button className="panel-btn" onClick={expandPhiFull} style={{ width: '100%', fontSize: '11px', marginTop: '4px' }}>
                {t('sd.expandPhi')}
              </button>
              {sdPhiValid !== null && (
                <div style={{ fontSize: '11px', marginTop: '4px', color: sdPhiValid ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {sdPhiValid ? '✓ ' + t('sd.phiValid') : '✗ ' + t('sd.phiInvalid')}
                </div>
              )}
            </>
          )}

          <button className="panel-btn dp-create-btn" onClick={() => { const group = executeSemidirectProduct(); if (group) { storeSemidirectProductGroup(group); setCurrentGroup(group); setCurrentView('cayley') } }} disabled={!sdNormalSubgroup || !sdActingGroup} style={{ width: '100%', marginTop: '8px', backgroundColor: sdNormalSubgroup && sdActingGroup ? 'var(--accent-orange)' : undefined, color: sdNormalSubgroup && sdActingGroup ? '#0f0f1a' : undefined, borderColor: sdNormalSubgroup && sdActingGroup ? 'var(--accent-orange)' : undefined }}>
            {t('sd.create')}
          </button>
        </>
      )}

      {sdDecompositions.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div className="subset-section-header">{t('sd.decomposeTitle')}</div>
          <div className="subsets-list scrollable-list" style={{ maxHeight: '150px' }}>
            {sdDecompositions.map((cand, i) => (
              <div
                key={i}
                className="subset-item"
                style={{
                  flexWrap: 'wrap',
                  cursor: 'pointer',
                  border: i === sdActiveDecomposition ? '1px solid var(--accent-orange)' : undefined,
                  backgroundColor: i === sdActiveDecomposition ? 'rgba(255, 165, 0, 0.12)' : undefined,
                }}
                title={t('sd.decomposeSelect')}
                onClick={() => selectSemidirectDecomposition(i)}
              >
                <span className="subset-name" style={{ fontSize: '11px', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(`${cand.normal.symbol} \\rtimes_{\\phi} ${cand.acting.symbol}`)) }} />
                <span className="subset-size" title={cand.verified ? t('sd.decomposeVerified') : t('sd.decomposeUnverified')}>
                  |N|={cand.normal.order} |H|={cand.acting.order}&nbsp;
                  <span style={{ color: cand.verified ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {cand.verified ? '✓' : '✗'}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {sdActiveDecomposition >= 0 && sdActiveDecomposition < sdDecompositions.length && currentGroup && (
            <div style={{ fontSize: '11px', marginTop: '5px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '10px', marginBottom: '2px' }}>{t('sd.decomposeSES')}</div>
              <span dangerouslySetInnerHTML={{ __html: renderTex(texify(`1 \\to ${sdDecompositions[sdActiveDecomposition].normal.symbol} \\to ${currentGroup.symbol} \\to ${sdDecompositions[sdActiveDecomposition].acting.symbol} \\to 1`)) }} />
            </div>
          )}
        </div>
      )}

      <div className="dp-group-list">
        <div className="subset-section-header">{t('sd.groupList')}</div>
        {sdSemidirectProductGroups.length === 0 ? (
          <div className="text-muted" style={{ fontSize: '11px', padding: '4px 0' }}>{t('sd.noGroups')}</div>
        ) : (
          <div className="subsets-list scrollable-list">
            {sdSemidirectProductGroups.map((group, i) => (
              <div key={`${group.symbol}-${i}`} className="subset-item" style={{ flexWrap: 'wrap' }}>
                <span className="subset-name" style={{ cursor: 'pointer', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }} onClick={() => loadSemidirectProductGroup(group.symbol)} />
                <span className="subset-size">(|G|={group.order})</span>
                <button onClick={() => removeSemidirectProductGroup(group.symbol)} className="subset-remove" style={{ fontSize: '16px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentGroup && <button className="panel-btn" onClick={() => storeSemidirectProductGroup(currentGroup)} style={{ width: '100%', fontSize: '11px', marginTop: '6px' }}>{t('sd.storeGroup')}</button>}
    </div>
  )
}

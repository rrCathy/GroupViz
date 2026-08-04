import { useState, useCallback } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { renderTex } from '../../utils/texify'
import { AccordionSection } from './AccordionSection'
import { getGeneratorElements, getHomomorphismProperties } from '../../core/algebra/homomorphisms'
import type { Group } from '../../core/types'

function isDPGroup(group: Group): boolean {
  return group.elements.length > 0 && group.elements[0].id.includes('|')
}

export function HomomorphismPanel() {
  const {
    currentGroup,
    editingSource,
    editingTarget,
    editingMapping,
    editingGeneratorMapping,
    isFullExtended,
    kernelLabel,
    homomorphisms,
    activeHomomorphismId,
    setEditingSource,
    setEditingTarget,
    setGeneratorMapping,
    removeGeneratorMapping,
    clearMapping,
    verifyCurrentMapping,
    createHomomorphism,
    deleteHomomorphism,
    activateHomomorphism,
    applyTrivialMapping,
    applyProjectionMapping,
    applyDPProjectionMapping,
    setCurrentView,
    setTheoremMode,
  } = useGroup()
  const { t } = useTranslation()
  const [autoMenuOpen, setAutoMenuOpen] = useState(false)
  const [lastResult, setLastResult] = useState<ReturnType<typeof verifyCurrentMapping>>(null)
  const [showFullPreview, setShowFullPreview] = useState(false)

  const genElements = editingSource ? getGeneratorElements(editingSource) : []

  const firstValid = homomorphisms.find(h => h.result?.isHomomorphism)

  const openHomomorphismView = useCallback(() => {
    if (firstValid && !activeHomomorphismId) activateHomomorphism(firstValid.id)
    setCurrentView('homomorphism')
  }, [firstValid, activeHomomorphismId, activateHomomorphism, setCurrentView])

  const openFirstIsoAnimation = useCallback(() => {
    if (firstValid) activateHomomorphism(firstValid.id)
    setCurrentView('homomorphism')
    setTheoremMode(true)
  }, [firstValid, activateHomomorphism, setCurrentView, setTheoremMode])

  const handleVerify = useCallback(() => {
    const result = verifyCurrentMapping()
    if (result) setLastResult(result)
  }, [verifyCurrentMapping])

  const properties = lastResult && editingSource && editingTarget
    ? getHomomorphismProperties(editingSource, editingTarget, lastResult)
    : null

  const isDP = editingSource && isDPGroup(editingSource)

  return (
    <AccordionSection title={t('homo.title')} icon="⟷" defaultOpen={false}>
      <div className="homo-panel">
        <div className="homo-view-section">
          <div className="subset-section-header">{t('homo.viewSection')}</div>
          <div className="homo-row">
            <button className="panel-btn" onClick={openHomomorphismView} disabled={!firstValid} style={{ flex: 1, fontSize: '11px' }}>{t('homo.openView')}</button>
            <button className="panel-btn" onClick={openFirstIsoAnimation} disabled={!firstValid} style={{ flex: 1, fontSize: '11px' }}>{t('homo.firstIso')} →</button>
          </div>
        </div>
        {/* Source/Target Row */}
        <div className="homo-row">
          <button className="homo-group-btn" onClick={() => currentGroup && currentGroup !== editingTarget && setEditingSource(currentGroup)} disabled={!currentGroup}>
            {editingSource ? <span dangerouslySetInnerHTML={{ __html: renderTex(editingSource.symbol) }} /> : t('homo.source')}
          </button>
          <span className="homo-arrow">→</span>
          <button className="homo-group-btn" onClick={() => currentGroup && currentGroup !== editingSource && setEditingTarget(currentGroup)} disabled={!currentGroup || currentGroup === editingSource}>
            {editingTarget ? <span dangerouslySetInnerHTML={{ __html: renderTex(editingTarget.symbol) }} /> : t('homo.target')}
          </button>
        </div>

        {/* Auto Map + Generator Mapping */}
        {editingSource && editingTarget && (
          <>
            <div className="homo-row homo-auto-row">
              <button className="panel-btn" onClick={() => setAutoMenuOpen(!autoMenuOpen)} style={{ flex: 1, fontSize: '11px' }}>
                {t('homo.autoMap')} {autoMenuOpen ? '▲' : '▼'}
              </button>
              {autoMenuOpen && (
                <div className="homo-auto-menu">
                  <button className="panel-btn" onClick={() => { applyTrivialMapping(); setAutoMenuOpen(false); setLastResult(null) }}>{t('homo.trivial')}</button>
                  <button className="panel-btn" onClick={() => { applyProjectionMapping(); setAutoMenuOpen(false); setLastResult(null) }}>{t('homo.projection')}</button>
                  {isDP && <>
                    <button className="panel-btn" onClick={() => { applyDPProjectionMapping(0); setAutoMenuOpen(false); setLastResult(null) }}>{t('homo.dpProjection', { factor: 'G' })}</button>
                    <button className="panel-btn" onClick={() => { applyDPProjectionMapping(1); setAutoMenuOpen(false); setLastResult(null) }}>{t('homo.dpProjection', { factor: 'H' })}</button>
                  </>}
                </div>
              )}
            </div>

            {genElements.length > 0 && (
              <div className="homo-gen-mapping">
                <div className="homo-gen-header">
                  <span>{t('homo.generatorHint')}</span>
                  <span className="homo-gen-count">({genElements.length})</span>
                </div>
                {genElements.map(({ gen, el }) => {
                  const mappedId = editingGeneratorMapping.get(el.id)
                  return (
                    <div key={el.id} className="homo-gen-row">
                      <span className="homo-gen-dot" style={{ backgroundColor: gen.color }} />
                      <span className="homo-gen-src" dangerouslySetInnerHTML={{ __html: renderTex(gen.symbol) }} />
                      <span className="homo-gen-arrow">→</span>
                      <select
                        value={mappedId || ''}
                        onChange={(e) => { if (e.target.value) { setGeneratorMapping(el.id, e.target.value) } else { removeGeneratorMapping(el.id) }; setLastResult(null) }}
                        className="homo-gen-select"
                      >
                        <option value="">--</option>
                        {editingTarget.elements.map(te => (<option key={te.id} value={te.id}>{te.label}</option>))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Full mapping preview */}
            {isFullExtended && editingMapping.size > 0 && (
              <button className="homo-preview-toggle" onClick={() => setShowFullPreview(!showFullPreview)}>
                {showFullPreview ? '▾' : '▸'} {t('homo.fullPreview')} ({editingMapping.size}/{editingSource.order})
              </button>
            )}
            {showFullPreview && isFullExtended && editingMapping.size > 0 && (
              <div className="homo-full-preview scrollable-list">
                {editingSource.elements.map(el => {
                  const mappedId = editingMapping.get(el.id)
                  return (
                    <div key={el.id} className="homo-preview-row">
                      <span dangerouslySetInnerHTML={{ __html: renderTex(el.label) }} />
                      <span>{mappedId !== undefined ? editingTarget.elements.find(e => e.id === mappedId)?.label ?? mappedId : '?'}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Verify & Clear */}
            <div className="homo-row">
              <button className="panel-btn" onClick={handleVerify} disabled={editingMapping.size === 0} style={{ flex: 1 }}>{t('homo.verify')}</button>
              <button className="panel-btn" onClick={() => { clearMapping(); setLastResult(null) }}>{t('homo.clear')}</button>
            </div>
          </>
        )}

        {/* Result */}
        {lastResult !== null && editingSource && editingTarget && (
          <div className={`homo-result ${lastResult.isHomomorphism ? 'valid' : 'invalid'}`}>
            <div className="homo-result-title">
              {lastResult.isHomomorphism ? '✓ ' + t('homo.valid') : '✗ ' + t('homo.invalid')}
            </div>
            {lastResult.isHomomorphism && lastResult.kernel.length > 0 && (
              <>
                <div><strong>{t('homo.kernel')}:</strong> <span dangerouslySetInnerHTML={{ __html: renderTex(kernelLabel) }} /> (|Ker|={lastResult.kernel.length})</div>
                <div><strong>{t('homo.image')}:</strong> |Im|={lastResult.image.length}</div>
                {properties && (
                  <div className="homo-badges">
                    <span className={`homo-badge ${properties.isInjective ? 'valid' : 'invalid'}`}>{properties.isInjective ? t('homo.injective') : t('homo.notInjective')}</span>
                    <span className={`homo-badge ${properties.isSurjective ? 'valid' : 'invalid'}`}>{properties.isSurjective ? t('homo.surjective') : t('homo.notSurjective')}</span>
                    {properties.isIsomorphism && <span className="homo-badge valid">{t('homo.isomorphism')}</span>}
                  </div>
                )}
                <button className="panel-btn" onClick={() => { createHomomorphism(editingSource, editingTarget); setLastResult(null) }}>{t('homo.create')}</button>
                <button className="panel-btn homo-iso-btn" onClick={() => { setCurrentView('homomorphism'); setTheoremMode(true) }}>{t('homo.firstIso')} →</button>
              </>
            )}
          </div>
        )}

        {/* Saved Homomorphisms */}
        {homomorphisms.length > 0 && (
          <div className="homo-saved">
            <div className="homo-saved-header">{t('homo.savedList')} ({homomorphisms.length})</div>
            <div className="homo-saved-list scrollable-list">
              {homomorphisms.map(h => (
                <div key={h.id} className="homo-saved-item">
                  <span className="homo-saved-name">
                    {h.name} {h.result?.isHomomorphism ? '✓' : ''}
                    <span className="homo-saved-order">(|G|={h.source.order}, |H|={h.target.order})</span>
                  </span>
                  <div className="homo-saved-actions">
                    {h.result?.isHomomorphism && (
                      <button className="panel-btn homo-iso-sm" onClick={() => { activateHomomorphism(h.id); setCurrentView('homomorphism'); setTheoremMode(true) }}>ISO</button>
                    )}
                    <button className="panel-btn" onClick={() => activateHomomorphism(h.id)}>{t('homo.activate')}</button>
                    <button onClick={() => deleteHomomorphism(h.id)} className="subset-remove">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}

import { useState, useCallback, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { renderTex } from '../../utils/texify'
import { findAllSubgroups } from '../../core/algebra/subgroups'
import { factorizeOrder } from '../../core/algebra/sylow'
import { AccordionSection } from './AccordionSection'

export function GroupActionPanel() {
  const {
    currentGroup,
    actionKind,
    actionSetSize,
    actionArrows,
    actionEditing,
    actionComputation,
    actionError,
    createConjugationAction,
    createRegularAction,
    createCosetAction,
    createSylowAction,
    startCustomAction,
    completeCustomAction,
    clearArrows,
    clearAction,
    savedActions,
    activateSavedAction,
    deleteSavedAction,
    setCurrentView,
  } = useGroup()
  const { t } = useTranslation()
  const [sizeInput, setSizeInput] = useState('6')
  const [subgroupIdx, setSubgroupIdx] = useState(-1)
  const [primeIdx, setPrimeIdx] = useState(0)

  const subgroups = useMemo(() => {
    if (!currentGroup) return []
    if (currentGroup.order > 60) return []
    return findAllSubgroups(currentGroup)
  }, [currentGroup])

  const primes = useMemo(() => {
    if (!currentGroup) return []
    return factorizeOrder(currentGroup.order).map(f => f.prime)
  }, [currentGroup])

  const goActionView = useCallback(() => {
    setCurrentView('action')
  }, [setCurrentView])

  const handleConjugation = useCallback(() => {
    if (!currentGroup) return
    createConjugationAction(currentGroup)
    goActionView()
  }, [currentGroup, createConjugationAction, goActionView])

  const handleRegular = useCallback(() => {
    if (!currentGroup) return
    createRegularAction(currentGroup)
    goActionView()
  }, [currentGroup, createRegularAction, goActionView])

  const handleCoset = useCallback(() => {
    if (!currentGroup || subgroupIdx < 0) return
    const sg = subgroups[subgroupIdx]
    if (!sg) return
    createCosetAction(currentGroup, sg.elements)
    goActionView()
  }, [currentGroup, subgroupIdx, subgroups, createCosetAction, goActionView])

  const handleSylow = useCallback(() => {
    if (!currentGroup || primes.length === 0) return
    const p = primes[Math.max(0, Math.min(primeIdx, primes.length - 1))]
    createSylowAction(currentGroup, p)
    goActionView()
  }, [currentGroup, primes, primeIdx, createSylowAction, goActionView])

  const handleStartCustom = useCallback(() => {
    if (!currentGroup) return
    const n = Math.max(1, Math.min(20, parseInt(sizeInput, 10) || 1))
    startCustomAction(currentGroup, n)
    goActionView()
  }, [currentGroup, startCustomAction, sizeInput, goActionView])

  const handleFinish = useCallback(() => {
    if (!currentGroup) return
    completeCustomAction(currentGroup)
  }, [currentGroup, completeCustomAction])

  const genColor = (symbol: string | null) => {
    if (!currentGroup || symbol === null) return 'var(--text-secondary)'
    const gen = currentGroup.generators.find(g => g.symbol === symbol)
    return gen?.color || 'var(--text-secondary)'
  }

  return (
    <AccordionSection title={t('action.title')} icon="➤" defaultOpen={false}>
      <div className="homo-panel">
        {actionEditing ? (
          <>
            <div className="subset-section-header">{t('action.kind.custom')} |X| = {actionSetSize ?? 1}</div>
            <div className="homo-gen-header">
              <span>{t('action.editHint')}</span>
              <span className="homo-gen-count">({actionArrows.length})</span>
            </div>
            {actionArrows.length === 0 && (
              <div className="info-placeholder">{t('action.genSelectHint')}</div>
            )}
            {actionArrows.map((a, i) => (
              <div key={`${a.from}-${i}`} className="homo-gen-row">
                <span className="homo-gen-dot" style={{ backgroundColor: genColor(a.generatorId) }} />
                <span className="homo-gen-label">
                  {a.generatorId ?? '?'}：{a.from + 1} → {a.to + 1}
                </span>
              </div>
            ))}
            {actionError && (
              <div className="action-error">
                {actionError.type === 'homomorphism'
                  ? t('action.error.homomorphism', {
                      g: actionError.g ?? '',
                      gen: actionError.generatorId ?? '',
                      x: String(actionError.from + 1),
                    })
                  : t(`action.error.${actionError.type}`, {
                      gen: actionError.generatorId ?? '',
                      from: String(actionError.from + 1),
                      to: String(actionError.to + 1),
                    })}
              </div>
            )}
            <div className="homo-row">
              <button className="panel-btn" onClick={handleFinish} style={{ flex: 1, fontSize: '11px' }}>{t('action.finish')} ✓</button>
              <button className="panel-btn" onClick={clearArrows} style={{ flex: 1, fontSize: '11px' }}>{t('action.clear')}</button>
              <button className="panel-btn" onClick={clearAction} style={{ flex: 1, fontSize: '11px' }}>{t('action.exit')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="subset-section-header">{t('right.actionInfo')}</div>
            <div className="homo-row">
              <button className="panel-btn" onClick={handleConjugation} disabled={!currentGroup} style={{ flex: 1, fontSize: '11px' }}>{t('action.create.conjugation')}</button>
              <button className="panel-btn" onClick={handleRegular} disabled={!currentGroup} style={{ flex: 1, fontSize: '11px' }}>{t('action.create.regular')}</button>
            </div>
            <div className="homo-row">
              <button className="panel-btn" onClick={handleCoset} disabled={!currentGroup || subgroupIdx < 0} style={{ flex: 1, fontSize: '11px' }}>{t('action.create.coset')}</button>
              <button className="panel-btn" onClick={handleStartCustom} disabled={!currentGroup} style={{ flex: 1, fontSize: '11px' }}>{t('action.create.custom')}</button>
            </div>
            <select
              className="panel-input"
              value={subgroupIdx}
              onChange={e => setSubgroupIdx(parseInt(e.target.value, 10))}
              disabled={!currentGroup || subgroups.length === 0}
              style={{ width: '100%', marginTop: 6 }}
            >
              <option value={-1}>
                {subgroups.length === 0 ? t('action.coset.noSubgroups') : t('action.coset.selectSubgroup')}
              </option>
              {subgroups.map((sg, i) => (
                <option key={i} value={i}>
                  ⟨{sg.generators.map(g => g.label).join(', ')}⟩ |H| = {sg.order}  [G:H] = {sg.index}
                </option>
              ))}
            </select>

            <div className="homo-row" style={{ marginTop: 6 }}>
              <select
                className="panel-input"
                value={primeIdx}
                onChange={e => setPrimeIdx(parseInt(e.target.value, 10))}
                disabled={!currentGroup || primes.length === 0}
                style={{ width: 84 }}
              >
                {primes.length === 0 && <option value={0}>p</option>}
                {primes.map((p, i) => (
                  <option key={i} value={i}>p = {p}</option>
                ))}
              </select>
              <button className="panel-btn" onClick={handleSylow} disabled={!currentGroup || primes.length === 0} style={{ flex: 1, fontSize: '11px' }}>{t('action.create.sylow')}</button>
            </div>

            {actionKind === 'conjugation' && actionComputation?.isHomomorphism && (
              <div className="info-row" style={{ marginTop: 6 }}>
                <span className="info-label">{t('action.kind.conjugation')}</span>
                <span className="info-value" style={{ color: '#22c55e' }}>✓</span>
              </div>
            )}

            <div className="homo-row" style={{ marginTop: 8 }}>
              <input
                className="panel-input"
                type="number"
                min={1}
                max={20}
                value={sizeInput}
                onChange={e => setSizeInput(e.target.value)}
                disabled={!currentGroup}
                style={{ width: 56 }}
              />
              <span className="info-label">{t('action.setSize')}</span>
            </div>

            <div className="homo-row" style={{ marginTop: 8 }}>
              <button className="panel-btn" onClick={goActionView} disabled={!currentGroup} style={{ flex: 1, fontSize: '11px' }}>{t('view.action')} →</button>
              {actionComputation && (
                <button className="panel-btn" onClick={clearAction} style={{ flex: 1, fontSize: '11px' }}>{t('action.clear')}</button>
              )}
            </div>

            {savedActions.length > 0 && (
              <div className="homo-saved">
                <div className="homo-saved-header">
                  {t('action.savedList')} ({savedActions.length})
                </div>
                <div className="homo-saved-list scrollable-list">
                  {savedActions.map(a => (
                    <div key={a.id} className="homo-saved-item">
                      <span className="homo-saved-name">
                        <span dangerouslySetInnerHTML={{ __html: renderTex(a.symbol) }} />
                        {' '}✓ |X| = {a.setSize}
                        <span className="homo-saved-order">({a.arrows.length} arrows)</span>
                      </span>
                      <div className="homo-saved-actions">
                        <button className="panel-btn" onClick={() => { activateSavedAction(a.id); setCurrentView('action') }}>{t('action.activate')}</button>
                        <button onClick={() => deleteSavedAction(a.id)} className="subset-remove">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AccordionSection>
  )
}

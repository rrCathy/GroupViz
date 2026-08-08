import { useCallback, useMemo, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { renderTex, texify } from '../../utils/texify'
import { parsePresentation, buildGroupFromPresentation, parseRelationEquation } from '../../core/algebra/presentations'

const TEMPLATE_NAMES = ['a', 'a, b', 'a, b, c']

export function PresentationPanel() {
  const { t } = useTranslation()
  return (
    <AccordionSection title={t('pres.title')} icon="⟨⟩" defaultOpen={false}>
      <PresentationInner />
    </AccordionSection>
  )
}

function PresentationInner() {
  const {
    presentationDraft, presentationError,
    setPresentationDraft, createPresentationGroupFromText,
    presentationGroups, removePresentationGroup, loadPresentationGroup,
    currentGroup, activePresentationGroup, setCurrentView, clearCurrentGroup, clearActivePresentationGroup,
    setTemplateGenCount, setVisualDraft,
  } = useGroup()
  const { t } = useTranslation()

  const [mode, setMode] = useState<'direct' | 'visual'>('direct')
  const [template, setTemplate] = useState(2)
  const [relDraft, setRelDraft] = useState('')
  const [relError, setRelError] = useState<string | null>(null)
  const [relators, setRelators] = useState<string[]>([])

  const visualGroup = useMemo(() => {
    if (relators.length === 0) return null
    const gens = TEMPLATE_NAMES[template - 1]
    const pres = parsePresentation(`${gens} | ${relators.join(', ')}`)
    const res = buildGroupFromPresentation(pres)
    return res.ok && res.group ? res.group : null
  }, [relators, template])

  const refreshVisualDraft = useCallback((rels: string[]) => {
    const gens = TEMPLATE_NAMES[template - 1].split(',').map(s => s.trim())
    if (rels.length === 0) {
      setVisualDraft(null)
      return
    }
    const pres = parsePresentation(`${gens.join(', ')} | ${rels.join(', ')}`)
    const res = buildGroupFromPresentation(pres)
    setVisualDraft({ gens, relators: rels, group: res.ok && res.group ? res.group : null })
  }, [template, setVisualDraft])

  const handleAddRelation = () => {
    const genNames = TEMPLATE_NAMES[template - 1].split(',').map(s => s.trim())
    const res = parseRelationEquation(relDraft, genNames)
    if (!res.ok) {
      setRelError(t('pres.visual.invalid'))
      return
    }
    const next = [...relators, res.relation]
    setRelators(next)
    setRelDraft('')
    setRelError(null)
    refreshVisualDraft(next)
  }

  const handleRemoveRelation = (i: number) => {
    const next = relators.filter((_, j) => j !== i)
    setRelators(next)
    refreshVisualDraft(next)
  }

  const handleFinish = () => {
    if (relators.length === 0) return
    const gens = TEMPLATE_NAMES[template - 1]
    const ok = createPresentationGroupFromText(`${gens} | ${relators.join(', ')}`)
    if (ok) {
      setVisualDraft(null)
      setCurrentView('tree')
    }
  }

  const returnToTemplateTree = () => {
    clearActivePresentationGroup()
    clearCurrentGroup()
    setVisualDraft(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <button className={`panel-btn${mode === 'direct' ? ' active-coset' : ''}`} onClick={() => setMode('direct')} style={{ flex: 1, fontSize: '11px' }}>
          {t('pres.create.tabDirect')}
        </button>
        <button className={`panel-btn${mode === 'visual' ? ' active-coset' : ''}`} onClick={() => setMode('visual')} style={{ flex: 1, fontSize: '11px' }}>
          {t('pres.create.tabVisual')}
        </button>
      </div>

      {(currentGroup || activePresentationGroup) && (
        <button className="panel-btn" onClick={returnToTemplateTree} style={{ width: '100%', fontSize: '11px', color: 'var(--accent-red)', marginBottom: '6px' }}>
          ✕ {t('pres.clearGroup')}
        </button>
      )}

      {mode === 'direct' ? (
        <>
          <textarea
            value={presentationDraft}
            onChange={(e) => setPresentationDraft(e.target.value)}
            placeholder={t('pres.placeholder')}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', fontFamily: 'inherit', resize: 'vertical', minHeight: '52px' }}
          />

          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            <button className="panel-btn dp-create-btn" onClick={() => createPresentationGroupFromText(presentationDraft)} disabled={!presentationDraft.trim()} style={{ flex: 1, backgroundColor: presentationDraft.trim() ? 'var(--accent-orange)' : undefined, color: presentationDraft.trim() ? '#0f0f1a' : undefined, borderColor: presentationDraft.trim() ? 'var(--accent-orange)' : undefined }}>
              {t('pres.create')}
            </button>
            <button className="panel-btn" onClick={() => setPresentationDraft('')} disabled={!presentationDraft} style={{ fontSize: '11px' }}>
              {t('pres.clear')}
            </button>
          </div>

          {presentationError && (
            <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--accent-red)' }}>{presentationError}</div>
          )}
        </>
      ) : (
        <>
          <div className="subset-section-header">{t('pres.visual.template')}</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            {[1, 2, 3].map(n => (
              <button key={n} className={`panel-btn${template === n ? ' active-coset' : ''}`} onClick={() => { setTemplate(n); setTemplateGenCount(n); setRelators([]); setRelDraft(''); setRelError(null); setVisualDraft(null) }} style={{ flex: 1, fontSize: '11px' }}>
                ⟨{['a', 'a, b', 'a, b, c'][n - 1]} | ⟩
              </button>
            ))}
          </div>

          <div className="subset-section-header" style={{ marginTop: '8px' }}>{t('pres.visual.relation')}</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <input
              value={relDraft}
              onChange={(e) => { setRelDraft(e.target.value); setRelError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddRelation() }}
              placeholder={t('pres.visual.relationPlaceholder')}
              style={{ flex: 1, minWidth: 0, fontSize: '11px', padding: '3px 6px', background: 'var(--bg-elevated, var(--panel-bg))', color: 'var(--text)', border: '1px solid var(--panel-border)', borderRadius: '6px', outline: 'none' }}
            />
            <button className="panel-btn dp-create-btn" onClick={handleAddRelation} disabled={!relDraft.trim()} style={{ backgroundColor: relDraft.trim() ? 'var(--accent-orange)' : undefined, color: relDraft.trim() ? '#0f0f1a' : undefined, borderColor: relDraft.trim() ? 'var(--accent-orange)' : undefined, fontSize: '11px' }}>
              {t('pres.visual.add')}
            </button>
          </div>
          {relError && <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--accent-red)' }}>{relError}</div>}

          {relators.length > 0 && (
            <div className="dp-group-list" style={{ marginTop: '8px' }}>
              <div className="subset-section-header">{t('pres.visual.list')}</div>
              {relators.map((r, i) => (
                <div key={i} className="subset-item" style={{ flexWrap: 'wrap' }}>
                  <span className="subset-name" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(r)) }} />
                  <button onClick={() => handleRemoveRelation(i)} className="subset-remove" style={{ fontSize: '16px' }}>×</button>
                </div>
              ))}
              <div style={{ fontSize: '11px', marginTop: '4px', color: visualGroup ? 'var(--text-secondary)' : 'var(--accent-red)' }}>
                {visualGroup ? `${t('pres.visual.order', { n: visualGroup.order })}${visualGroup.isoSymbol ? ` ≅ ${visualGroup.isoSymbol}` : ''}` : t('pres.visual.infinite')}
              </div>
              <button className="panel-btn dp-create-btn" onClick={handleFinish} disabled={!visualGroup} style={{ width: '100%', marginTop: '6px', backgroundColor: visualGroup ? 'var(--accent-orange)' : undefined, color: visualGroup ? '#0f0f1a' : undefined, borderColor: visualGroup ? 'var(--accent-orange)' : undefined }}>
                {t('pres.visual.finish')}
              </button>
            </div>
          )}
        </>
      )}

      <div className="dp-group-list" style={{ marginTop: '8px' }}>
        <div className="subset-section-header">{t('pres.groups')}</div>
        {presentationGroups.length === 0 ? (
          <div className="text-muted" style={{ fontSize: '11px', padding: '4px 0' }}>{t('pres.noGroups')}</div>
        ) : (
          <div className="subsets-list scrollable-list" style={{ maxHeight: '180px' }}>
            {presentationGroups.map(group => (
              <div key={group.symbol} className="subset-item" style={{ flexWrap: 'wrap' }}>
                <span className="subset-name" style={{ cursor: 'pointer', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }} onClick={() => loadPresentationGroup(group.symbol)} />
                <span className="subset-size">(|G|={group.order})</span>
                <button onClick={() => removePresentationGroup(group.symbol)} className="subset-remove" style={{ fontSize: '16px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="subset-section-header" style={{ marginTop: '8px' }}>{t('pres.views')}</div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <button className="panel-btn" onClick={() => setCurrentView('tree')} style={{ flex: 1, fontSize: '11px' }}>
          ⌁ {t('view.tree')}
        </button>
        <button className="panel-btn" onClick={() => setCurrentView('prestable')} disabled={!currentGroup && !activePresentationGroup} style={{ flex: 1, fontSize: '11px' }}>
          ◧ {t('view.prestable')}
        </button>
      </div>
    </div>
  )
}

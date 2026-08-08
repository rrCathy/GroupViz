import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { renderTex, texify } from '../../utils/texify'
import { parsePresentation, buildGroupFromPresentation, formatPresentation, parseRelationEquation } from '../../core/algebra/presentations'
import { COLOR_PALETTE, type Group, type GroupPresentation } from '../../core/types'

interface PresentationPreset {
  key: string
  label: string
  text: string
}

const PRESENTATION_PRESETS: PresentationPreset[] = [
  { key: 'C4', label: '\\langle a \\mid a^{4} \\rangle', text: '⟨a | a^4⟩' },
  { key: 'C6', label: '\\langle a \\mid a^{6} \\rangle', text: '⟨a | a^6⟩' },
  { key: 'D4', label: '\\langle r, s \\mid r^{4}, s^{2}, srsr \\rangle', text: '⟨r, s | r^4, s^2, srsr⟩' },
  { key: 'V4', label: '\\langle a, b \\mid a^{2}, b^{2}, abab \\rangle', text: '⟨a, b | a^2, b^2, abab⟩' },
  { key: 'S3', label: '\\langle a, b \\mid a^{2}, b^{2}, (ab)^{3} \\rangle', text: '⟨a, b | a^2, b^2, (ab)^3⟩' },
  { key: 'Q8', label: '\\langle i, j \\mid i^{4}, i^{2}j^{2}, jij^{-1}i \\rangle', text: '⟨i, j | i^4, i^2 j^2, j i j^{-1} i⟩' },
  { key: 'A5', label: '\\langle a, b \\mid a^{2}, b^{3}, (ab)^{5} \\rangle', text: '⟨a, b | a^2, b^3, (ab)^5⟩' },
  { key: 'C3xC2', label: '\\langle a, b \\mid a^{3}, b^{2}, aba^{-1}b^{-1} \\rangle', text: '⟨a, b | a^3, b^2, a b a^{-1} b^{-1}⟩' },
]

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
    currentGroup, setCurrentView, clearCurrentGroup, setTemplateGenCount, setVisualDraft,
  } = useGroup()
  const { t } = useTranslation()

  const [mode, setMode] = useState<'direct' | 'visual'>('direct')
  const [template, setTemplate] = useState(2)
  const [relDraft, setRelDraft] = useState('')
  const [relError, setRelError] = useState<string | null>(null)
  const [relators, setRelators] = useState<string[]>([])
  const [preview, setPreview] = useState<{ group: Group; pres: GroupPresentation; order: number } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!presentationDraft.trim()) {
        setPreview(null)
        return
      }
      try {
        const pres = parsePresentation(presentationDraft)
        if (pres.generators.length === 0) {
          setPreview(null)
          return
        }
        const res = buildGroupFromPresentation(pres)
        if (res.ok && res.group) {
          setPreview({ group: res.group, pres, order: res.order ?? res.group.order })
        } else {
          setPreview(null)
        }
      } catch {
        setPreview(null)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [presentationDraft])

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

  const shown = preview ?? (currentGroup?.presentation ? { group: currentGroup, pres: currentGroup.presentation, order: currentGroup.order } : null)

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

      {currentGroup && (
        <button className="panel-btn" onClick={() => { clearCurrentGroup(); setVisualDraft(null) }} style={{ width: '100%', fontSize: '11px', color: 'var(--accent-red)', marginBottom: '6px' }}>
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

          <div className="subset-section-header" style={{ marginTop: '8px' }}>{t('pres.presets')}</div>
          <div className="sd-presets-grid">
            {PRESENTATION_PRESETS.map(p => (
              <button key={p.key} className="sd-preset-btn" title={p.text} onClick={() => setPresentationDraft(p.text)}>
                <span dangerouslySetInnerHTML={{ __html: renderTex(p.label) }} />
              </button>
            ))}
          </div>

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

          {shown && (
            <div className="dp-group-list" style={{ marginTop: '8px' }}>
              <div className="subset-section-header">{t('pres.preview')}</div>
              <div style={{ fontSize: '11px', marginBottom: '4px', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: renderTex(formatPresentation(shown.pres.generators, shown.pres.relators)) }} />
              <PresentationMiniView group={shown.group} />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                |G| = {shown.order}
                {shown.group.isoSymbol && <span style={{ color: 'var(--accent-purple)' }}> ≅ <span dangerouslySetInnerHTML={{ __html: renderTex(texify(shown.group.isoSymbol)) }} /></span>}
              </div>
            </div>
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
        <button className="panel-btn" onClick={() => setCurrentView('prestable')} disabled={!currentGroup} style={{ flex: 1, fontSize: '11px' }}>
          ◧ {t('view.prestable')}
        </button>
      </div>
    </div>
  )
}

const MINI_W = 300
const MINI_H = 220

function PresentationMiniView({ group }: { group: Group }) {
  const cx = MINI_W / 2
  const cy = MINI_H / 2
  const R = Math.min(cx, cy) - 28

  const idToIdx = useMemo(() => new Map(group.elements.map((e, i) => [e.id, i])), [group])
  const genElements = useMemo(() => group.generators.map(gen => gen.apply(group.identity)), [group])
  const idIdx = useMemo(() => idToIdx.get(group.identity.id) ?? 0, [idToIdx, group])

  const positions = useMemo(() => {
    const n = group.order
    return group.elements.map((_, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2
      return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }
    })
  }, [group, cx, cy, R])

  const edges = useMemo(() => {
    const out: { from: number; to: number; color: string }[] = []
    for (const el of group.elements) {
      const fi = idToIdx.get(el.id) ?? 0
      genElements.forEach((gen, gi) => {
        const target = group.multiply(el, gen)
        const ti = idToIdx.get(target.id)
        if (ti === undefined) return
        out.push({ from: fi, to: ti, color: COLOR_PALETTE[gi % COLOR_PALETTE.length] })
      })
    }
    return out
  }, [group, idToIdx, genElements])

  return (
    <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} style={{ width: '100%', height: 'auto' }}>
      {edges.map((ed, i) => (
        <line key={i} x1={positions[ed.from].x} y1={positions[ed.from].y} x2={positions[ed.to].x} y2={positions[ed.to].y} stroke={ed.color} strokeWidth={1} opacity={0.5} />
      ))}
      {group.elements.map((el, i) => (
        <g key={el.id}>
          <circle cx={positions[i].x} cy={positions[i].y} r={i === idIdx ? 7 : 5} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
          <title>{el.label}</title>
        </g>
      ))}
    </svg>
  )
}

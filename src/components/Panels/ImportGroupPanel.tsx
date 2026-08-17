import { useState, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { renderTex } from '../../utils/texify'
import { parseNotation, type NotationParseResult } from '../../core/algebra/notationParser'
import { createGroupFromImport } from '../../core/groups/importGroup'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { fetchImportGroup } from '../../utils/api'

const SAMPLES = [
  'S_5',
  'A_4',
  'C_12',
  'D_6',
  'Q_8',
  'V_4',
  'GL(2,3)',
  'SL(2,3)',
  'PGL(2,7)',
  'PSL(2,7)',
  'C_3×D_4',
  'C_4^2',
  'SmallGroup(16,13)',
  'Aut(S_4)',
  'C_8:C_2',
]

export function ImportGroupPanel() {
  const { setCurrentGroup } = useGroup()
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<NotationParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedMemo = useMemo(() => (input.trim() ? parseNotation(input) : null), [input])
  const current = parsedMemo ?? parsed

  async function handleImport() {
    if (!current || !current.ok || loading) return
    setLoading(true)
    setError(null)
    try {
      if (current.localSymbol) {
        const g = createGroupFromSymbol(current.localSymbol)
        if (g) {
          setCurrentGroup(g)
          return
        }
      }
      if (!current.gapExpr) {
        setError(t('importGroup.error.noRoute'))
        return
      }
      const imp = await fetchImportGroup(current.gapExpr)
      setCurrentGroup(createGroupFromImport(imp))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/fetch|Failed|Network|backend/i.test(msg)) {
        setError(t('importGroup.error.backend'))
      } else {
        setError(t('importGroup.error.fetch', { msg }))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AccordionSection title={t('panel.importGroup')} icon="⇥" defaultOpen={false}>
      <div>
        <div className="param-row">
          <input
            className="import-input"
            value={input}
            placeholder={t('importGroup.placeholder')}
            onChange={(e) => { setInput(e.target.value); setParsed(null); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleImport() }}
          />
        </div>
        <div className="param-row import-sample-row">
          <span className="param-label">{t('importGroup.samples')}</span>
          <select
            className="import-sample-select"
            value=""
            onChange={(e) => { if (e.target.value) { setInput(e.target.value); setParsed(null); setError(null) } }}
          >
            <option value="">—</option>
            {SAMPLES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {current && (
          <div className="import-preview">
            {current.ok ? (
              <>
                <div className="import-preview-tex" dangerouslySetInnerHTML={{ __html: renderTex(current.tex) }} />
                <div className="import-preview-meta">
                  {current.order !== null ? (
                    <span className="import-preview-order">{t('importGroup.order')}: {current.order}</span>
                  ) : (
                    <span className="import-preview-order">{t('importGroup.orderUnknown')}</span>
                  )}
                  {current.localSymbol ? (
                    <span className="import-preview-path local">{t('importGroup.pathLocal')}</span>
                  ) : current.gapExpr ? (
                    <span className="import-preview-path backend">{t('importGroup.pathBackend')}</span>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="import-preview-error">
                {current.error === 'semidirect'
                  ? t('importGroup.error.semidirect')
                  : current.error === 'empty'
                    ? t('importGroup.error.empty')
                    : t('importGroup.error.unknown')}
              </div>
            )}
          </div>
        )}

        {error && <div className="import-preview-error">{error}</div>}

        <button
          className="panel-btn create-btn"
          disabled={!current?.ok || loading}
          onClick={handleImport}
        >
          {loading ? t('importGroup.loading') : t('importGroup.import')}
        </button>
      </div>
    </AccordionSection>
  )
}
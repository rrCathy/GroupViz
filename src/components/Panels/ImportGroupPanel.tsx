import { useState, useMemo, type CSSProperties } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { renderTex, texify } from '../../utils/texify'
import { parseNotation, getGroupAliases, type NotationParseResult } from '../../core/algebra/notationParser'
import { createGroupFromImport } from '../../core/groups/importGroup'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { fetchImportGroup } from '../../utils/api'

/**
 * 样例分两组：规范 TeX 写法，与**同一批群的别名写法**（后者用来演示记号系统的
 * 宽容度——`S3xS3`/`F21`/`Klein`/`c4` 都等价于上面某个规范记号）。
 */
const SAMPLES_TEX = [
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

const SAMPLES_ALIAS = [
  'S3xS3',
  'S_3^2',
  'F21',
  'C7:C3',
  'C7⋊C3',
  'QD16',
  'Klein',
  'Sym(3)',
  'c4',
  'Z4',
  'Z/4Z',
]

/** 预览区次要信息行（规范符号 / 别名识别 / 反向别名）：就地内联，不依赖主题变量 */
const SUB_LINE: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.5,
  opacity: 0.75,
  wordBreak: 'break-all',
}

const CODE_CHIP: CSSProperties = {
  fontSize: 11,
  padding: '1px 4px',
  borderRadius: 3,
  background: 'rgba(127,127,127,0.14)',
}

export function ImportGroupPanel() {
  const { setCurrentGroup } = useGroup()
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<NotationParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedMemo = useMemo(() => (input.trim() ? parseNotation(input) : null), [input])
  const current = parsedMemo ?? parsed

  /**
   * 反向别名：本地能建时，顺便告诉用户「这个群还叫什么」。
   * getGroupAliases 内部按 symbol 缓存同阶同构判定，重复输入不会反复付出成本。
   */
  const aliases = useMemo(() => {
    if (!current?.ok || !current.localSymbol) return []
    try {
      const g = createGroupFromSymbol(current.localSymbol)
      if (!g) return []
      return getGroupAliases(g).filter((a) => a !== current.localSymbol)
    } catch {
      return []
    }
  }, [current])

  /** 把 core 的结构化 issue 翻成当前语言的提示（core 只给 kind + 参数）。 */
  const hintText = useMemo(() => {
    const issue = current?.issue
    if (!issue) return null
    switch (issue.kind) {
      case 'empty':
        return t('importGroup.error.empty')
      case 'unicode':
        return t('importGroup.hint.unicode', { suggestion: issue.suggestion ?? '' })
      case 'ambiguous':
        return t('importGroup.hint.ambiguous', {
          count: issue.candidates?.length ?? 0,
          list: (issue.candidates ?? []).join(' / '),
        })
      case 'no-ring':
        return t('importGroup.hint.noRing', { order: issue.order ?? 0 })
      case 'semidirect':
        return t('importGroup.hint.semidirect', { symbol: issue.suggestion ?? '' })
      case 'family':
        return t('importGroup.hint.family', { symbol: issue.suggestion ?? '' })
      default:
        return t('importGroup.hint.unknown')
    }
  }, [current, t])

  const pathLabel = current?.source === 'named'
    ? t('importGroup.pathNamed')
    : current?.source === 'backend'
      ? t('importGroup.pathBackend')
      : t('importGroup.pathLocal')

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

  const reset = () => { setParsed(null); setError(null) }

  return (
    <AccordionSection title={t('panel.importGroup')} icon="⇥" defaultOpen={false}>
      <div>
        <div className="param-row">
          <input
            className="import-input"
            value={input}
            placeholder={t('importGroup.placeholder')}
            onChange={(e) => { setInput(e.target.value); reset() }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleImport() }}
          />
        </div>
        <div className="param-row import-sample-row">
          <span className="param-label">{t('importGroup.samples')}</span>
          <select
            className="import-sample-select"
            value=""
            onChange={(e) => { if (e.target.value) { setInput(e.target.value); reset() } }}
          >
            <option value="">—</option>
            <optgroup label={t('importGroup.samplesTex')}>
              {SAMPLES_TEX.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <optgroup label={t('importGroup.samplesAlias')}>
              {SAMPLES_ALIAS.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          </select>
        </div>

        {current && (
          <div className="import-preview">
            {current.ok ? (
              <>
                <div
                  className="import-preview-tex"
                  dangerouslySetInnerHTML={{ __html: renderTex(current.tex || texify(current.normalized)) }}
                />
                <div className="import-preview-meta">
                  {current.order !== null ? (
                    <span className="import-preview-order">{t('importGroup.order')}: {current.order}</span>
                  ) : (
                    <span className="import-preview-order">{t('importGroup.orderUnknown')}</span>
                  )}
                  <span className={`import-preview-path ${current.source === 'backend' ? 'backend' : 'local'}`}>
                    {pathLabel}
                  </span>
                </div>
                {current.localSymbol && (
                  <div style={SUB_LINE}>
                    {t('importGroup.canonical')}: <code style={CODE_CHIP}>{current.localSymbol}</code>
                  </div>
                )}
                {current.via && (
                  <div style={SUB_LINE}>{t('importGroup.recognized', { via: current.via })}</div>
                )}
                {aliases.length > 0 && (
                  <div style={SUB_LINE}>
                    {t('importGroup.aliases')}: {aliases.join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <div className="import-preview-error">{hintText}</div>
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

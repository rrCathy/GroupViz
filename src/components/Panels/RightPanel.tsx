import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { findAllSubgroups, getConjugacyClasses, isSimpleGroup, getGroupCenter } from '../../core/algebra/subgroups'
import { getPrecomputed } from '../../core/groups/SmallGroups'
import { texify, renderTex } from '../../utils/texify'
import { verifyHomomorphism, getHomomorphismProperties, formatKernelLabel } from '../../core/algebra/homomorphisms'
import { createGroupFromSymbol } from '../../utils/groupFactory'
import { isAutomorphismGroup } from '../../core/algebra/automorphisms'
import { computeGroupProperties } from '../../utils/hybridCompute'
import { computeBurnsideCount } from '../../core/algebra/actions'
import { presentationOf, formatPresentation } from '../../core/algebra/presentations'
import { AccordionSection } from './AccordionSection'

function AutomorphismMappingPanel({ currentGroup, selectedElementId }: { currentGroup: { _automorphismById?: Map<string, { map: Map<string, string>; label: string }>; automorphismParentSymbol?: string }, selectedElementId: string }) {
  const { t } = useTranslation()

  const autoById = currentGroup._automorphismById
  const automorphism = autoById?.get(selectedElementId) ?? null

  const parentSymbol = currentGroup.automorphismParentSymbol ?? null

  const parentGroup = useMemo(() => {
    if (!parentSymbol) return null
    try {
      return createGroupFromSymbol(parentSymbol)
    } catch {
      return null
    }
  }, [parentSymbol])

  const elLabelById = useMemo(() => {
    if (!parentGroup) return null
    return new Map(parentGroup.elements.map(e => [e.id, e.label]))
  }, [parentGroup])

  const entries = useMemo(() => {
    if (!automorphism) return { nonFixed: [], fixedCount: 0 }
    const automap = automorphism.map
    const e: { srcId: string; tgtId: string }[] = []
    for (const [src, tgt] of automap) {
      if (src !== tgt) e.push({ srcId: src, tgtId: tgt })
    }
    const fixed = automap.size - e.length
    return { nonFixed: e, fixedCount: fixed }
  }, [automorphism])

  if (!autoById || !automorphism || !parentGroup || !elLabelById) return null

  return (
    <div className="panel-section" style={{
      borderTop: '2px solid var(--accent-teal)',
      paddingTop: '10px',
      marginTop: '2px',
    }}>
      <h3 style={{ color: 'var(--accent-teal)' }}>{t('right.automorphismMapping')}</h3>
      <div className="info-row" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
        <span dangerouslySetInnerHTML={{ __html: renderTex(texify(automorphism.label)) }} />
      </div>
      <div style={{
        maxHeight: '180px',
        overflowY: 'auto',
        fontSize: '11px',
      }}>
        {entries.nonFixed.slice(0, 40).map(({ srcId, tgtId }) => (
          <div key={srcId} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
          }}>
            <span
              style={{
                flex: 1,
                textAlign: 'right',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(elLabelById.get(srcId) || srcId)) }}
            />
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↦</span>
            <span
              style={{
                flex: 1,
                textAlign: 'left',
                color: 'var(--accent-teal)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              dangerouslySetInnerHTML={{ __html: renderTex(texify(elLabelById.get(tgtId) || tgtId)) }}
            />
          </div>
        ))}
        {entries.fixedCount > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
            + {entries.fixedCount} {t('right.automorphismFixed')}
          </div>
        )}
      </div>
    </div>
  )
}

export function RightPanel() {
  const { 
    currentGroup: coreCurrentGroup, 
    activePresentationGroup,
    selectedElements,
    selectElement,
    clearSelection,
    backendCache,
    editingSource,
    editingTarget,
    editingMapping,
    activeHomomorphismId,
    homomorphisms,
    theoremMode,
    theoremPhase,
    setTheoremMode,
    createQuotientGroupWithHomomorphism,
    subsets,
    showCosetsFromElements,
    cosetSubsetId,
    cosetSubgroupElementIds,
    currentView,
    setCurrentGroup,
    setCurrentView,
    actionKind,
    actionComputation,
    actionSelectedElement,
  } = useGroup()
  const { t } = useTranslation()
  
  const currentGroup = activePresentationGroup ?? coreCurrentGroup
  const largeGroup = (currentGroup?.order ?? 0) > 60
  
  const selectedElement = selectedElements.size === 1 && currentGroup
    ? currentGroup.elements.find(e => e.id === Array.from(selectedElements)[0]) 
    : null
  
  const precomputed = useMemo(() => {
    if (!currentGroup) return null
    return getPrecomputed(currentGroup)
  }, [currentGroup])

  const subgroups = useMemo(() => {
    if (!currentGroup) return []
    if (precomputed) return precomputed.subgroups
    if (largeGroup) return backendCache.subgroups ?? []
    return findAllSubgroups(currentGroup)
  }, [currentGroup, precomputed, largeGroup, backendCache.subgroups])

  const centerElements = useMemo(() => {
    if (!currentGroup) return null
    return backendCache.center ?? getGroupCenter(currentGroup, largeGroup)
  }, [currentGroup, backendCache.center, largeGroup])

  const centerIdSet = centerElements ? new Set(centerElements.map(e => e.id)) : null
  
  const conjugacyClasses = useMemo(() => {
    if (!currentGroup) return []
    if (precomputed) return precomputed.conjugacyClasses
    if (largeGroup) return backendCache.conjugacyClasses ?? []
    return getConjugacyClasses(currentGroup)
  }, [currentGroup, precomputed, largeGroup, backendCache.conjugacyClasses])
  
  const simpleGroup = useMemo(() => {
    if (!currentGroup) return false
    if (precomputed) return precomputed.isSimple
    if (largeGroup) return backendCache.isSimple ?? false
    return isSimpleGroup(currentGroup)
  }, [currentGroup, precomputed, largeGroup, backendCache.isSimple])

  const groupProps = useMemo(() => {
    if (!currentGroup) return null
    return computeGroupProperties(currentGroup, largeGroup ? backendCache : undefined)
  }, [currentGroup, largeGroup, backendCache])

  const currentPresentation = useMemo(() => {
    if (!currentGroup) return null
    try {
      return presentationOf(currentGroup)
    } catch {
      return null
    }
  }, [currentGroup])

  const subsetByElements = useMemo(() => {
    const map = new Map<string, typeof subsets[0]>()
    for (const subset of subsets) {
      const key = [...subset.elementIds].sort().join(',')
      map.set(key, subset)
    }
    return map
  }, [subsets])

  const activeHomo = homomorphisms.find(h => h.id === activeHomomorphismId)
  const homoSource = activeHomo?.source || editingSource
  const homoFilter = activeHomo?.target || editingTarget
  const homoMapping = activeHomo?.mapping || editingMapping

  const homoResult = useMemo(() => {
    if (!homoSource || !homoFilter || homoMapping.size === 0) return null
    return activeHomo?.result || verifyHomomorphism(homoSource, homoFilter, homoMapping)
  }, [homoSource, homoFilter, homoMapping, activeHomo])

  const homoProperties = useMemo(() => {
    if (!homoSource || !homoFilter || !homoResult?.isHomomorphism) return null
    return getHomomorphismProperties(homoSource, homoFilter, homoResult)
  }, [homoSource, homoFilter, homoResult])

  const inHomoMode = currentView === 'homomorphism' && !!(homoSource && homoFilter)

  // ── Homomorphism mode: show only homomorphism info + both groups ──
  if (inHomoMode) {
    return (
      <div className="right-panel">
        {/* Source Group */}
        <div className="panel-section">
          <h3 style={{ color: 'var(--accent-teal)' }}>{t('homo.source')}</h3>
          {homoSource && (
            <>
              <div className="info-row">
                <span className="info-label">{t('right.groupName')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoSource.name)) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.symbol')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoSource.symbol)) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.order')}</span>
                <span className="info-value">{homoSource.order}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.generators')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoSource.generators.map(g => g.symbol).join(', '))) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.abelian')}</span>
                <span className="info-value">
                  {homoSource.isAbelian ? t('right.yes') : t('right.no')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Target Group */}
        <div className="panel-section">
          <h3 style={{ color: 'var(--accent-teal)' }}>{t('homo.target')}</h3>
          {homoFilter && (
            <>
              <div className="info-row">
                <span className="info-label">{t('right.groupName')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoFilter.name)) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.symbol')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoFilter.symbol)) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.order')}</span>
                <span className="info-value">{homoFilter.order}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.generators')}</span>
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(homoFilter.generators.map(g => g.symbol).join(', '))) }} />
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.abelian')}</span>
                <span className="info-value">
                  {homoFilter.isAbelian ? t('right.yes') : t('right.no')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Homomorphism Info */}
        <div className="panel-section">
          <h3>{t('right.homomorphism')}</h3>
          {homoResult?.isHomomorphism ? (
            <>
              <div className="info-row" style={{ marginBottom: '6px' }}>
                <span className="info-label" style={{ fontSize: '13px', fontWeight: 700 }}>
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(homoSource.symbol)) }} />
                  {' → '}
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(homoFilter.symbol)) }} />
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.homo.kernel')}</span>
                <span className="info-value" style={{ color: '#ff6b6b' }}>
                  <span dangerouslySetInnerHTML={{ __html: renderTex(formatKernelLabel(homoSource, homoResult.kernel)) }} />
                  {' '}(|Ker|={homoResult.kernel.length})
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('right.homo.image')}</span>
                <span className="info-value" style={{ color: 'var(--accent-teal)' }}>|Im|={homoResult.image.length}</span>
              </div>
              {homoProperties && (
                <>
                  <div className="info-row">
                    <span className="info-label">{t('right.homo.quotient')}</span>
                    <span className="info-value">
                      {homoSource.order}/{homoResult.kernel.length} = {homoResult.kernel.length > 0 ? Math.round(homoSource.order / homoResult.kernel.length) : '∞'}
                      {' '}= |Im f|
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: homoProperties.isInjective ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 107, 0.15)',
                      color: homoProperties.isInjective ? 'var(--accent-teal)' : '#ff6b6b',
                    }}>
                      {homoProperties.isInjective ? t('homo.injective') : t('homo.notInjective')}
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: homoProperties.isSurjective ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 107, 0.15)',
                      color: homoProperties.isSurjective ? 'var(--accent-teal)' : '#ff6b6b',
                    }}>
                      {homoProperties.isSurjective ? t('homo.surjective') : t('homo.notSurjective')}
                    </span>
                    {homoProperties.isIsomorphism && (
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(78, 205, 196, 0.25)',
                        color: 'var(--accent-teal)',
                      }}>
                        {t('homo.isomorphism')}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          ) : homoResult ? (
            <p className="info-placeholder" style={{ color: '#ff6b6b' }}>✗ {t('homo.invalid')}</p>
          ) : (
            <p className="info-placeholder">{t('right.homo.noActive')}</p>
          )}
          {homoResult?.isHomomorphism && !theoremMode && (
            <button
              className="panel-btn"
              onClick={() => setTheoremMode(true)}
              style={{ marginTop: '10px', width: '100%', fontSize: '11px', padding: '5px 8px' }}
            >
              {t('homo.theoremMode')} →
            </button>
          )}
        </div>

        {/* First Isomorphism Theorem (only in theorem mode) */}
        {theoremMode && (
          <div className="panel-section" style={{
            background: 'rgba(56, 189, 248, 0.06)',
            border: '1px solid var(--accent-teal)',
            borderRadius: '8px',
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-teal)' }}>
                {t('homo.firstIso')}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--panel-bg)', padding: '1px 6px', borderRadius: 3 }}>
                {theoremPhase + 1}/4
              </span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-accent, var(--accent-teal))', marginBottom: 4 }}
              dangerouslySetInnerHTML={{ __html: renderTex(t(`homo.firstIso.phase${theoremPhase}`)) }} />
            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {t(`homo.firstIso.phase${theoremPhase}Desc`)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Normal mode: show current group info ──
  return (
    <div className="right-panel">
      <div className="panel-section">
        <h3>{t('right.elementProps')}</h3>
        {selectedElement ? (
          <>
            <div className="info-row">
              <span className="info-label">{t('right.currentElement')}</span>
              <span className="info-value highlight" dangerouslySetInnerHTML={{ __html: renderTex(texify(selectedElement.label)) }} />
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.inverse')}</span>
              <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup?.inverse(selectedElement)?.label || '')) }} />
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.id')}</span>
              <span className="info-value">{selectedElement.id}</span>
            </div>
          </>
        ) : (
          <p className="info-placeholder">{t('right.selectHint')}</p>
        )}
      </div>
      
      {currentGroup && isAutomorphismGroup(currentGroup) && selectedElement && (
        <AutomorphismMappingPanel
          currentGroup={currentGroup}
          selectedElementId={selectedElement.id}
        />
      )}
      
      <div className="panel-section">
        <h3>{t('right.groupInfo')}</h3>
        {currentGroup ? (
          <>
            <div className="info-row">
              <span className="info-label">{t('right.groupName')}</span>
              <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.name)) }} />
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.symbol')}</span>
              <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.symbol)) }} />
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.order')}</span>
              <span className="info-value">{currentGroup.order}</span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.generators')}</span>
              <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.generators.map(g => g.symbol).join(', '))) }} />
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.abelian')}</span>
              <span className="info-value">
                {currentGroup.isAbelian ? t('right.yes') : t('right.no')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('right.center')}</span>
              <span
                className="info-value"
                style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}
                dangerouslySetInnerHTML={{
                  __html: renderTex(texify((centerElements ?? []).map(e => e.label).join(', '))),
                }}
              />
            </div>
            {groupProps ? (
              <>
                <div className="property-chips">
                  <span
                    className={`property-chip${groupProps.solvable ? ' on' : ''}`}
                    title={groupProps.solvable ? t('right.propertyTrue') : t('right.propertyFalse')}
                  >
                    {t('right.solvable')}
                  </span>
                  <span
                    className={`property-chip${groupProps.nilpotent ? ' on' : ''}`}
                    title={groupProps.nilpotent ? t('right.propertyTrue') : t('right.propertyFalse')}
                  >
                    {t('right.nilpotent')}
                  </span>
                  <span
                    className={`property-chip${groupProps.perfect ? ' on' : ''}`}
                    title={groupProps.perfect ? t('right.propertyTrue') : t('right.propertyFalse')}
                  >
                    {t('right.perfect')}
                  </span>
                </div>
                {groupProps.derivedSeriesOrders.length > 1 && (
                  <div className="info-row">
                    <span className="info-label">{t('right.derivedSeries')}</span>
                    <span
                      className="info-value"
                      dangerouslySetInnerHTML={{
                        __html: renderTex(texify(groupProps.derivedSeriesOrders.join(' \\supseteq '))),
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="info-row">
                <span className="info-label">{t('right.properties')}</span>
                <span className="info-value">{t('right.propertyUnavailable')}</span>
              </div>
            )}
            {currentGroup.isoSymbol && (
              <div className="info-row">
                <span className="info-label">{t('right.isomorphic')}</span>
                <span
                  className="info-value"
                  style={{ color: 'var(--accent-purple)', cursor: 'pointer', textDecoration: 'underline' }}
                  title={t('right.isomorphicClick')}
                  onClick={() => {
                    const isoGroup = createGroupFromSymbol(currentGroup.isoSymbol!)
                    if (isoGroup) setCurrentGroup(isoGroup)
                  }}
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.isoSymbol!)) }}
                />
              </div>
            )}
            {currentPresentation && (
              <div className="info-row">
                <span className="info-label">{t('right.presentation')}</span>
                <span
                  className="info-value"
                  style={{ color: 'var(--accent-teal)', fontSize: '10px' }}
                  dangerouslySetInnerHTML={{ __html: renderTex(formatPresentation(currentPresentation.generators, currentPresentation.relators)) }}
                />
              </div>
            )}
          </>
        ) : (
          <p className="info-placeholder">{t('right.noGroup')}</p>
        )}
      </div>
      
      {simpleGroup && currentGroup && (
        <div className="simple-group-badge">
          <span>{t('right.simpleGroup')}</span>
        </div>
      )}

      {theoremMode && homoResult?.isHomomorphism && (
        <div className="panel-section" style={{
          background: 'var(--accent-teal-bg, rgba(56, 189, 248, 0.06))',
          border: '1px solid var(--accent-teal)',
          borderRadius: '8px',
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-teal)' }}>
              {t('homo.firstIso')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--panel-bg)', padding: '1px 6px', borderRadius: 3 }}>
              {theoremPhase + 1}/4
            </span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-accent, var(--accent-teal))', marginBottom: 3 }}
            dangerouslySetInnerHTML={{ __html: renderTex(t(`homo.firstIso.phase${theoremPhase}`)) }} />
          <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {t(`homo.firstIso.phase${theoremPhase}Desc`)}
          </div>
        </div>
      )}

      {currentView === 'action' && actionComputation && currentGroup && (() => {
        const comp = actionComputation
        const sumOk = comp.orbits.reduce((s, o) => s + o.elements.length, 0) === comp.n
        const fixedCount = comp.orbits.filter(o => o.elements.length === 1).length
        const selected = actionSelectedElement
        const selOrbit = selected !== null ? comp.orbits[comp.orbitOf[selected]] : null
        const selStab = selected !== null ? comp.stabilizers.get(selected) ?? [] : []
        const selEl = selected !== null && (actionKind === 'conjugation' || actionKind === 'regular') ? currentGroup.elements[selected] : null
        const selLabel = selEl
          ? texify(selEl.label)
          : selected !== null && actionKind === 'coset'
            ? texify(comp.setLabels?.[selected] ?? String(selected + 1))
            : String(selected !== null ? selected + 1 : 0)
        const kindLabel = actionKind ? t(`action.kind.${actionKind}`) : ''
        return (
          <div className="panel-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-teal)' }}>
                {t('right.actionInfo')}
              </span>
              {kindLabel && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--panel-bg)', padding: '1px 6px', borderRadius: 3 }}>
                  {kindLabel}
                </span>
              )}
            </div>
            <div className="info-row">
              <span className="info-label">{t('homo.verify')}</span>
              <span className="info-value" style={{ color: comp.isHomomorphism ? '#22c55e' : '#f43f5e', fontWeight: 700 }}>
                {comp.isHomomorphism ? `✓ ${t('action.valid')}` : `✗ ${t('action.invalid')}`}
              </span>
            </div>
            {comp.violation && (
              <div style={{ fontSize: 10, color: '#f43f5e', lineHeight: 1.5, marginBottom: 4 }}>
                {t('action.violation', {
                  g: comp.violation.g,
                  a: comp.violation.a,
                  x: String(comp.violation.x + 1),
                })}
              </div>
            )}
            <div className="info-row">
              <span className="info-label">|X|</span>
              <span className="info-value">{comp.n}</span>
            </div>
            {actionKind === 'regular' && (
              <div className="info-row">
                <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.regular')) }} />
                <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.regularNote')) }} />
              </div>
            )}
            {actionKind === 'coset' && (
              <>
                <div className="info-row">
                  <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.cosetStab')) }} />
                  <span className="info-value" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.cosetStabNote')) }} />
                </div>
                <div className="info-row">
                  <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.cosetTransitive')) }} />
                  <span className="info-value" style={{ color: comp.orbits.length === 1 ? '#22c55e' : '#f43f5e' }}>
                    {comp.orbits.length === 1 ? '✓' : '✗'}
                  </span>
                </div>
              </>
            )}
            {actionKind === 'conjugation' && (
              <div className="info-row">
                <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.fixedCenter')) }} />
                <span className="info-value" style={{ color: fixedCount === getGroupCenter(currentGroup).length ? '#22c55e' : '#f43f5e' }}>
                  {fixedCount} = |Z(G)| = {getGroupCenter(currentGroup).length}
                </span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">{t('action.orbitCount', { n: comp.orbits.length })}</span>
              <span className="info-value">
                {comp.orbits.map(o => o.elements.length).join(', ')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('action.sumCheck', { sum: comp.orbits.reduce((s, o) => s + o.elements.length, 0), n: comp.n })}</span>
              <span className="info-value" style={{ color: sumOk ? '#22c55e' : '#f43f5e' }}>{sumOk ? '✓' : '✗'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('action.fixedPoints', { n: fixedCount })}</span>
              <span className="info-value">★ ×{fixedCount}</span>
            </div>
            {comp.isHomomorphism && (() => {
              const burnside = computeBurnsideCount(comp.perms, comp.n)
              const burnsideOk = Math.abs(burnside - comp.orbits.length) < 1e-9
              return (
                <div className="info-row">
                  <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.math.burnside')) }} />
                  <span className="info-value" style={{ color: burnsideOk ? '#22c55e' : '#f43f5e' }}>
                    {comp.orbits.length} = {burnside} {burnsideOk ? '✓' : '✗'}
                  </span>
                </div>
              )
            })()}
            {selected !== null && selOrbit && (
              <div style={{ marginTop: 6, borderTop: '1px dashed var(--border-color, rgba(128,128,128,0.3))', paddingTop: 6 }}>
                <div className="info-row">
                  <span className="info-label">
                    <span dangerouslySetInnerHTML={{ __html: renderTex(`x = ${selLabel}`) }} />
                  </span>
                  <span className="info-value" dangerouslySetInnerHTML={{
                    __html: renderTex(t('action.orbitStab', {
                      x: selLabel,
                      orbit: String(selOrbit.elements.length),
                      stab: String(selStab.length),
                    })),
                  }} />
                </div>
                <div className="info-row">
                  <span className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.ost', {
                    orbit: String(selOrbit.elements.length),
                    stab: String(selStab.length),
                    product: String(selOrbit.elements.length * selStab.length),
                  })) }} />
                  <span className="info-value" style={{ color: selOrbit.elements.length * selStab.length === currentGroup.order ? '#22c55e' : '#f43f5e' }}>
                    {selOrbit.elements.length * selStab.length === currentGroup.order ? '✓' : '✗'}
                  </span>
                </div>
                {selStab.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div className="info-label" dangerouslySetInnerHTML={{ __html: renderTex(t('action.stabilizer', { x: selLabel })) }} />
                    <div className="elements-grid" style={{ marginTop: 4 }}>
                      {selStab.map((gid) => {
                        const el = currentGroup.elements.find(e => e.id === gid)
                        return el ? (
                          <span key={gid} className="element-chip" dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }} />
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      <AccordionSection title={t('right.subgroups', { n: subgroups.length })} defaultOpen={false}>
        {backendCache.loading && largeGroup ? (
          <p className="info-placeholder">{t('right.loadingBackend')}</p>
        ) : subgroups.length > 0 ? (
          <div className="subgroup-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {subgroups.map((sg) => {
              const key = sg.elements.map(e => e.id).sort().join(',')
              const matchingSubset = subsetByElements.get(key)
              const isCosetActive = (matchingSubset && cosetSubsetId === matchingSubset.id) ||
                (cosetSubgroupElementIds !== null && [...cosetSubgroupElementIds].sort().join(',') === key)
              const subgroupLabel = sg.elements.map(e => e.label).join(', ')
              const inCosetStripMode = currentView === 'cosetstrip'
              const isCenter = centerIdSet !== null &&
                sg.elements.length === centerIdSet.size &&
                sg.elements.every(e => centerIdSet.has(e.id))
              return (
                <div
                  key={key}
                  className={`subgroup-item ${sg.isNormal ? 'normal' : ''} ${isCenter ? 'center' : ''} ${inCosetStripMode && isCosetActive ? 'coset-active' : ''}`}
                  onClick={() => {
                    const ids = sg.elements.map(el => el.id)
                    clearSelection()
                    ids.forEach(id => selectElement(id, true))
                    showCosetsFromElements([...ids], subgroupLabel, sg.isNormal)
                    setCurrentView('cosetstrip')
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span className="sg-order">{sg.order}</span>
                    <span className="sg-info" dangerouslySetInnerHTML={{ __html: renderTex(texify(subgroupLabel)) }} />
                    {sg.isNormal && <span className="sg-badge">{t('badge.normal')}</span>}
                    {isCenter && <span className="sg-badge center">{t('badge.center')}</span>}
                  </div>
                  {!inCosetStripMode && (
                    <div className="sg-actions" style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                      {sg.isNormal && (
                        <button
                          className="panel-btn"
                          onClick={() => {
                            const normalSubgroupElIds = sg.elements.map(e => e.id)
                            const mSubset = subsets.find(s =>
                              [...s.elementIds].sort().join(',') === normalSubgroupElIds.sort().join(',')
                            )
                            if (mSubset) {
                              createQuotientGroupWithHomomorphism(mSubset.id)
                            }
                          }}
                          style={{
                            minWidth: '54px', fontSize: '9px', padding: '2px 4px',
                            backgroundColor: 'var(--accent-purple)',
                            color: '#0f0f1a',
                          }}
                        >
                          {t('quotient.create')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="info-placeholder">{t('right.noSubgroups')}</p>
        )}
      </AccordionSection>
      
      <AccordionSection title={t('right.conjugacyClasses', { n: conjugacyClasses.length })} defaultOpen={false}>
        {backendCache.loading && largeGroup ? (
          <p className="info-placeholder">{t('right.loadingBackend')}</p>
        ) : conjugacyClasses.length > 0 ? (
          <div className="class-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {conjugacyClasses.map((cls) => {
              const ccKey = cls.map(e => e.id).sort().join(',')
              return (
              <div
                key={ccKey}
                className="class-item"
                onClick={() => {
                  clearSelection()
                  cls.forEach(e => selectElement(e.id, true))
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className="class-size">|{cls.length}|</span>
                <span className="class-elements" dangerouslySetInnerHTML={{ __html: renderTex(texify(cls.map(e => e.label).join(', '))) }} />
              </div>
              )
            })}
          </div>
        ) : (
          <p className="info-placeholder">{t('right.noClasses')}</p>
        )}
      </AccordionSection>
      
      <div className="panel-section elements-list">
        <h3>{t('right.elementList', { n: currentGroup?.elements.length || 0 })}</h3>
        <div className="elements-grid">
          {currentGroup?.elements?.map(el => (
              <button
                key={el.id}
                className={`element-chip ${selectedElements.has(el.id) ? 'selected' : ''}`}
                onClick={() => selectElement(el.id, true)}
                dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
              />
          ))}
        </div>
      </div>
    </div>
  )
}
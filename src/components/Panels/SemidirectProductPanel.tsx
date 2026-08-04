import { useRef } from 'react'
import { useGroup } from '../../context/useGroup'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createKleinFour } from '../../core/groups/SpecialGroup'
import { createSemidirectProduct } from '../../core/groups/SemidirectProduct'
import { findAllAutomorphisms, createAutomorphismGroup } from '../../core/algebra/automorphisms'
import { getGeneratorElements, extendFromGenerators } from '../../core/algebra/homomorphisms'
import {
  type StoredSemidirectProduct,
} from '../../context/semidirectProduct/semidirectProductStorage'

const SEMIDIRECT_PRESETS = [
  { key: 'Z3sZ2', label: 'Z_{3} \\rtimes_{\\phi} Z_{2} \\cong S_{3}', N: () => createCyclicGroup(3), H: () => createCyclicGroup(2), desc: 'C_3 ⋊_φ C_2 (inversion)' },
  { key: 'Z4sZ2', label: 'Z_{4} \\rtimes_{\\phi} Z_{2} \\cong D_{4}', N: () => createCyclicGroup(4), H: () => createCyclicGroup(2), desc: 'C_4 ⋊_φ C_2 (inversion)' },
  { key: 'Z5sZ2', label: 'Z_{5} \\rtimes_{\\phi} Z_{2} \\cong D_{5}', N: () => createCyclicGroup(5), H: () => createCyclicGroup(2), desc: 'C_5 ⋊_φ C_2 (inversion)' },
  { key: 'Z7sZ3', label: 'Z_{7} \\rtimes_{\\phi} Z_{3}', N: () => createCyclicGroup(7), H: () => createCyclicGroup(3), desc: 'C_7 ⋊_φ C_3 (Frobenius, x→2x)' },
  { key: 'V4sZ3', label: 'V_{4} \\rtimes_{\\phi} Z_{3} \\cong A_{4}', N: () => createKleinFour(), H: () => createCyclicGroup(3), desc: 'V₄ ⋊_φ C₃ (3-cycle on non-identity)' },
]

export function SemidirectProductPanel() {
  const { t } = useTranslation()
  return (
    <AccordionSection title={t('sd.title')} icon="⋉" defaultOpen={false}>
      <SemidirectProductInner />
    </AccordionSection>
  )
}

function SemidirectProductInner() {
  const {
    currentGroup, setCurrentGroup, setCurrentView,
    isSemidirectProductMode, sdNormalSubgroup, sdActingGroup,
    sdAutNGroup, sdAutNList, sdPhiGenMapping, sdPhiValid,
    sdSemidirectProductGroups,
    toggleSemidirectProductMode, setSDNormalSubgroup, setSDActingGroup,
    computeAutN, setPhiGenMapping, expandPhiFull, executeSemidirectProduct,
    storeSemidirectProductGroup, removeSemidirectProductGroup, loadSemidirectProductGroup,
  } = useGroup()
  const { t } = useTranslation()
  const presetsIdCounter = useRef(0)

  function createPresetSD(key: string) {
    const preset = SEMIDIRECT_PRESETS.find(p => p.key === key)
    if (!preset) return
    const N = preset.N()
    const H = preset.H()
    setSDNormalSubgroup(N)
    setSDActingGroup(H)
    const autos = findAllAutomorphisms(N)
    if (autos.length === 0) return
    const autGroup = createAutomorphismGroup(N, autos)
    if (!autGroup) return
    const idAutoId = autGroup.identity.id

    const hGens = getGeneratorElements(H)
    const genMap = new Map<string, string>()

    if (key === 'Z3sZ2' || key === 'Z4sZ2' || key === 'Z5sZ2') {
      if (N.generators.length > 0 && hGens.length > 0) {
        const nGen = N.generators[0].apply(N.identity)
        const nInv = N.inverse(nGen)
        for (const auto of autos) {
          if (auto.apply(nGen).id === nInv.id) {
            genMap.set(hGens[0].el.id, auto.id)
            break
          }
        }
        if (!genMap.has(hGens[0].el.id)) genMap.set(hGens[0].el.id, idAutoId)
      }
    } else if (key === 'Z7sZ3') {
      if (N.generators.length > 0 && hGens.length > 0) {
        const nGen = N.generators[0].apply(N.identity)
        const doubleGen = N.multiply(nGen, nGen)
        for (const auto of autos) {
          if (auto.apply(nGen).id === doubleGen.id) {
            genMap.set(hGens[0].el.id, auto.id)
            break
          }
        }
        if (!genMap.has(hGens[0].el.id)) genMap.set(hGens[0].el.id, idAutoId)
      }
    } else if (key === 'V4sZ3') {
      if (hGens.length > 0) {
        const nonId = N.elements.filter(e => e.id !== N.identity.id)
        for (const auto of autos) {
          if (auto.id === idAutoId) continue
          let is3Cycle = true
          for (const n of nonId) {
            const n1 = auto.apply(n)
            if (n1.id === n.id) { is3Cycle = false; break }
            const n3 = auto.apply(auto.apply(n1))
            if (n3.id !== n.id) { is3Cycle = false; break }
          }
          if (is3Cycle) {
            genMap.set(hGens[0].el.id, auto.id)
            break
          }
        }
        if (!genMap.has(hGens[0].el.id)) genMap.set(hGens[0].el.id, idAutoId)
      }
    }

    if (genMap.size > 0) {
      const fullMap = extendFromGenerators(H, autGroup, genMap)
      if (fullMap) {
        const autoById = new Map(autos.map(a => [a.id, a]))
        const phiFull = new Map<string, import('../../core/algebra/automorphisms').Automorphism>()
        for (const [hId, autoId] of fullMap) {
          const a = autoById.get(autoId)
          if (a) phiFull.set(hId, a)
        }
        const group = createSemidirectProduct(N, H, phiFull)

        const genMapping: Record<string, string> = {}
        genMap.forEach((v, k) => { genMapping[k] = v })
        const spec: StoredSemidirectProduct = {
          id: `sd-preset-${key}-${++presetsIdCounter.current}`,
          symbol: group.symbol,
          normalSymbol: N.symbol,
          actingSymbol: H.symbol,
          phiGenMapping: genMapping,
        }
        storeSemidirectProductGroup(group, spec)
        setCurrentGroup(group)
        setCurrentView('cayley')
      }
    }
  }

  return (
    <div>
      <button className={`panel-btn ${isSemidirectProductMode ? 'dp-active' : ''}`} onClick={toggleSemidirectProductMode} style={{ width: '100%', backgroundColor: isSemidirectProductMode ? 'var(--accent-orange)' : undefined, color: isSemidirectProductMode ? '#0f0f1a' : undefined, borderColor: isSemidirectProductMode ? 'var(--accent-orange)' : undefined }}>
        {isSemidirectProductMode ? t('sd.exitMode') : t('sd.enterMode')}
      </button>

      <div className="dp-group-list" style={{ marginTop: '8px' }}>
        <div className="subset-section-header">{t('sd.presets')}</div>
        <div className="special-groups-grid">
          {SEMIDIRECT_PRESETS.map(p => (
            <button key={p.key} className="special-group-item" style={{ minWidth: '100%' }} onClick={() => createPresetSD(p.key)}>
              <span className="special-group-symbol" dangerouslySetInnerHTML={{ __html: renderTex(p.label) }} />
              <span className="special-group-desc">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

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

import { useState, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { findAllSubgroups, getConjugacyClasses, isSimpleGroup } from '../../core/algebra/subgroups'
import { getPrecomputed } from '../../core/groups/SmallGroups'
import { texify, renderTex } from '../../utils/texify'

function AccordionSection({ title, defaultOpen = false, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="panel-section">
      <button 
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          padding: '0 0 12px 0',
          cursor: 'pointer'
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '10px', color: '#888' }}>{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  )
}

export function RightPanel() {
  const { 
    currentGroup, 
    selectedElements,
    selectElement,
    clearSelection
  } = useGroup()
  const { t } = useTranslation()
  
  const selectedElement = selectedElements.size === 1 
    ? currentGroup?.elements.find(e => e.id === Array.from(selectedElements)[0]) 
    : null
  
  const precomputed = useMemo(() => {
    if (!currentGroup) return null
    return getPrecomputed(currentGroup)
  }, [currentGroup])

  const subgroups = useMemo(() => {
    if (!currentGroup) return []
    if (precomputed) return precomputed.subgroups
    return findAllSubgroups(currentGroup)
  }, [currentGroup, precomputed])
  
  const conjugacyClasses = useMemo(() => {
    if (!currentGroup) return []
    if (precomputed) return precomputed.conjugacyClasses
    return getConjugacyClasses(currentGroup)
  }, [currentGroup, precomputed])
  
  const simpleGroup = useMemo(() => {
    if (!currentGroup) return false
    if (precomputed) return precomputed.isSimple
    return isSimpleGroup(currentGroup)
  }, [currentGroup, precomputed])

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
      
      <AccordionSection title={t('right.subgroups', { n: subgroups.length })} defaultOpen={false}>
        {subgroups.length > 0 ? (
          <div className="subgroup-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {subgroups.map((sg, i) => (
              <div 
                key={i} 
                className={`subgroup-item ${sg.isNormal ? 'normal' : ''}`}
                onClick={() => {
                  const ids = sg.elements.map(el => el.id)
                  clearSelection()
                  ids.forEach(id => selectElement(id, true))
                }}
              >
                <span className="sg-order">{sg.order}</span>
                <span className="sg-info" dangerouslySetInnerHTML={{ __html: renderTex(texify(sg.elements.map(e => e.label).join(', '))) }} />
                {sg.isNormal && <span className="sg-badge">{t('badge.normal')}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="info-placeholder">{t('right.noSubgroups')}</p>
        )}
      </AccordionSection>
      
      <AccordionSection title={t('right.conjugacyClasses', { n: conjugacyClasses.length })} defaultOpen={false}>
        {conjugacyClasses.length > 0 ? (
          <div className="class-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {conjugacyClasses.map((cls, i) => (
              <div
                key={i}
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
            ))}
          </div>
        ) : (
          <p className="info-placeholder">{t('right.noClasses')}</p>
        )}
      </AccordionSection>
      
      <div className="panel-section elements-list">
        <h3>{t('right.elementList', { n: currentGroup?.elements.length || 0 })}</h3>
        <div className="elements-grid">
          {currentGroup?.elements.map(el => (
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
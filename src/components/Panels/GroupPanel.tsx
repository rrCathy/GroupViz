import { useState, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { buildGroupTypeConfigs, buildSpecialGroups, buildOrderGroupsMap, typeTabLabel } from './constants'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'
import { TabBar, type TabDef } from './TabBar'
import { createZ6xZ2, createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3 } from '../../core/groups/SmallGroups'
import { createKleinFour } from '../../core/groups/SpecialGroup'



export function GroupPanel() {
  const { currentGroup } = useGroup()
  const { t } = useTranslation()
  return (
    <AccordionSection title={t('panel.createGroup')} icon="⊕" defaultOpen={false} badge={currentGroup ? <span dangerouslySetInnerHTML={{ __html: renderTex(currentGroup.symbol) }} /> : undefined}>
      <TabBar tabs={[createTab(t), dpTab(t)]} compact />
    </AccordionSection>
  )
}

function createTab(t: (key: string) => string): TabDef {
  return {
    key: 'create',
    label: t('panel.createGroup'),
    icon: '⊕',
    content: <GroupCreationInner />,
  }
}

function dpTab(t: (key: string) => string): TabDef {
  return {
    key: 'dp',
    label: t('dp.title'),
    icon: '⊗',
    content: <DirectProductInner />,
  }
}

function GroupCreationInner() {
  const { setCurrentGroup } = useGroup()
  const { t } = useTranslation()
  const [creationMode, setCreationMode] = useState<'type' | 'order'>('type')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [paramN, setParamN] = useState(6)
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null)

  const GROUP_TYPES = useMemo(() => buildGroupTypeConfigs(t), [t])
  const SPECIAL_GROUPS = useMemo(() => buildSpecialGroups(t), [t])
  const orderGroupsMap = useMemo(() => buildOrderGroupsMap(t), [t])
  const availableOrders = useMemo(() => [...orderGroupsMap.keys()].sort((a, b) => a - b), [orderGroupsMap])
  const activeConfig = GROUP_TYPES.find(gt => gt.key === selectedType)

  function handleTypeSelect(key: string) {
    if (selectedType === key) return
    setSelectedType(key)
    const config = GROUP_TYPES.find(gt => gt.key === key)
    if (config) setParamN(config.defaultN)
  }

  return (
    <div>
      <div className="creation-mode-toggle">
        <button className={`toggle-btn ${creationMode === 'type' ? 'active' : ''}`} onClick={() => { setCreationMode('type'); setSelectedOrder(null) }}>{t('panel.createByType')}</button>
        <button className={`toggle-btn ${creationMode === 'order' ? 'active' : ''}`} onClick={() => setCreationMode('order')}>{t('panel.createByOrder')}</button>
      </div>

      {creationMode === 'type' && (
        <>
          <div className="group-type-tabs">
            {GROUP_TYPES.map(type => (
              <button key={type.key} className={`group-type-tab ${selectedType === type.key ? 'active' : ''}`} onClick={() => handleTypeSelect(type.key)}>{typeTabLabel(type.key, t)}</button>
            ))}
            <button className={`group-type-tab ${selectedType === 'special' ? 'active' : ''}`} onClick={() => setSelectedType(selectedType === 'special' ? null : 'special')}>{t('group.special')}</button>
          </div>
          {activeConfig && (
            <div className="create-params">
              <div className="param-row">
                <span className="param-label">n</span>
                <span className="param-value">{paramN}</span>
                <input type="range" min={activeConfig.minN} max={activeConfig.maxN} value={paramN} onChange={(e) => setParamN(parseInt(e.target.value))} className="param-slider" />
                <span className="param-range">{activeConfig.minN}-{activeConfig.maxN}</span>
              </div>
              <button className="panel-btn create-btn" onClick={() => setCurrentGroup(activeConfig.create(paramN))}>{t('panel.create', { label: activeConfig.label })}</button>
            </div>
          )}
          {selectedType === 'special' && (
            <div className="special-groups-grid">
              {SPECIAL_GROUPS.map(sg => (
                <button key={sg.label} className="special-group-item" onClick={() => setCurrentGroup(sg.create())}>
                  <span className="special-group-symbol" dangerouslySetInnerHTML={{ __html: renderTex(sg.label) }} />
                  <span className="special-group-desc">{sg.desc}</span>
                  <span className="special-group-order">|{sg.order}|</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {creationMode === 'order' && (
        <>
          <div className="order-list">
            {availableOrders.map(order => (
              <button key={order} className={`order-btn ${selectedOrder === order ? 'active' : ''}`} onClick={() => setSelectedOrder(selectedOrder === order ? null : order)}>{order}</button>
            ))}
          </div>
          {selectedOrder && (
            <div className="order-groups-grid">
              {orderGroupsMap.get(selectedOrder)!.map((entry, i) => (
                <button key={i} className="order-group-item" onClick={() => { setCurrentGroup(entry.create()); setSelectedOrder(null) }}>
                  <span className="order-group-symbol" dangerouslySetInnerHTML={{ __html: renderTex(entry.label) }} />
                  <span className="order-group-desc">{entry.desc}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DirectProductInner() {
  const {
    currentGroup, setCurrentGroup, setCurrentView,
    isDirectProductMode, directProductSource, directProductTarget, directProductCreationMode, directProductGroups,
    toggleDirectProductMode, setDirectProductSource, setDirectProductTarget, setDirectProductCreationMode,
    executeDirectProduct, storeDirectProductGroup, removeDirectProductGroup, loadDirectProductGroup,
  } = useGroup()
  const { t } = useTranslation()

  return (
    <div>
      <button className={`panel-btn ${isDirectProductMode ? 'dp-active' : ''}`} onClick={toggleDirectProductMode} style={{ width: '100%', backgroundColor: isDirectProductMode ? 'var(--accent-teal)' : undefined, color: isDirectProductMode ? '#0f0f1a' : undefined, borderColor: isDirectProductMode ? 'var(--accent-teal)' : undefined }}>
        {isDirectProductMode ? t('dp.exitMode') : t('dp.enterMode')}
      </button>

      {isDirectProductMode && (
        <>
          <div className="dp-mode-section">
            <span className="settings-label">{t('dp.mode')}</span>
            <div className="toggle-group" style={{ marginTop: '4px' }}>
              <button className={`toggle-btn ${directProductCreationMode === 'cayley' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('cayley')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.cayley')}</button>
              <button className={`toggle-btn ${directProductCreationMode === 'table' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('table')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.table')}</button>
              <button className={`toggle-btn ${directProductCreationMode === 'direct' ? 'active' : ''}`} onClick={() => setDirectProductCreationMode('direct')} style={{ fontSize: '11px', flex: 1 }}>{t('dp.mode.direct')}</button>
            </div>
          </div>

          <div className="dp-group-select">
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('dp.sourceGroup')}: {directProductSource ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(directProductSource.symbol)) }} /> : <span className="text-muted">{t('dp.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setDirectProductSource(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('dp.importGroup')} G</button>
          </div>

          <div className="dp-group-select" style={{ marginBottom: '6px' }}>
            <span className="settings-label" style={{ fontSize: '11px' }}>{t('dp.targetGroup')}: {directProductTarget ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(directProductTarget.symbol)) }} /> : <span className="text-muted">{t('dp.selectGroup')}</span>}</span>
            <button className="panel-btn" onClick={() => { if (currentGroup) setDirectProductTarget(currentGroup) }} disabled={!currentGroup} style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px', width: '100%' }}>{t('dp.importGroup')} H</button>
          </div>

          <button className="panel-btn dp-create-btn" onClick={() => { const product = executeDirectProduct(); if (product) { storeDirectProductGroup(product); setCurrentGroup(product); setCurrentView('cayley') } }} disabled={!directProductSource || !directProductTarget} style={{ width: '100%', backgroundColor: directProductSource && directProductTarget ? 'var(--accent-teal)' : undefined, color: directProductSource && directProductTarget ? '#0f0f1a' : undefined, borderColor: directProductSource && directProductTarget ? 'var(--accent-teal)' : undefined }}>
            {t('dp.createDirectProduct')}
          </button>
        </>
      )}

      <div className="dp-group-list">
        <div className="subset-section-header">{t('dp.groupList')}</div>
        {directProductGroups.length === 0 ? (
          <div className="text-muted" style={{ fontSize: '11px', padding: '4px 0' }}>{t('dp.noGroups')}</div>
        ) : (
          <div className="subsets-list scrollable-list">
            {directProductGroups.map(group => (
              <div key={group.symbol} className="subset-item" style={{ flexWrap: 'wrap' }}>
                <span className="subset-name" style={{ cursor: 'pointer', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }} onClick={() => loadDirectProductGroup(group.symbol)} />
                <span className="subset-size">(|G|={group.order})</span>
                <button onClick={() => removeDirectProductGroup(group.symbol)} className="subset-remove" style={{ fontSize: '16px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentGroup && <button className="panel-btn" onClick={() => storeDirectProductGroup(currentGroup)} style={{ width: '100%', fontSize: '11px', marginTop: '6px' }}>{t('dp.storeGroup')}</button>}
      <button className="panel-btn" onClick={() => { const groups = [createKleinFour(), createZ4xZ2(), createZ2xZ2xZ2(), createZ3xZ3(), createZ6xZ2()]; groups.forEach(g => storeDirectProductGroup(g)) }} style={{ width: '100%', fontSize: '11px', marginTop: '6px', backgroundColor: 'var(--accent-purple)', color: '#fff', borderColor: 'var(--accent-purple)' }}>{t('dp.importAll')}</button>
    </div>
  )
}


import { useState, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { buildGroupTypeConfigs, buildSpecialGroups, buildOrderGroupsMap, typeTabLabel } from './constants'
import { renderTex } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'

export function BasicGroupPanel() {
  const { currentGroup } = useGroup()
  const { t } = useTranslation()
  return (
    <AccordionSection title={t('panel.basicGroup')} icon="⊕" defaultOpen={false} badge={currentGroup ? <span dangerouslySetInnerHTML={{ __html: renderTex(currentGroup.symbol) }} /> : undefined}>
      <GroupCreationInner />
    </AccordionSection>
  )
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
          <div className="order-hint">{t('panel.order.semidirectHint')}</div>
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

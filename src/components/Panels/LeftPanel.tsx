import { useState } from 'react'
import { useGroup } from '../../context/useGroup'
import type { ViewMode, Layout3D } from '../../core/types'
import { texify, renderTex } from '../../utils/texify'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../../core/groups/SpecialGroup'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3 } from '../../core/groups/SmallGroups'
import { useTranslation } from '../../i18n/useTranslation'

interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}

function AccordionSection({ title, defaultOpen = false, badge, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="accordion-section">
      <button
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {badge && <span className="accordion-badge">{badge}</span>}
          <span className={`accordion-arrow ${isOpen ? 'open' : ''}`}>▶</span>
        </span>
      </button>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  )
}

interface GroupTypeConfig {
  key: string
  label: string
  minN: number
  maxN: number
  defaultN: number
  create: (n: number) => ReturnType<typeof createCyclicGroup>
}

export function LeftPanel() {
  const {
    currentGroup,
    setCurrentGroup,
    currentView,
    setCurrentView,
    computeInverse,
    clearCanvas,
    resetNodePositions,
    runForceLayout,
    showMaximalCycles,
    setShowMaximalCycles,
    cayleyActions,
    cayleyMultiplyType,
    cayleyShape3D,
    cayleyAvailableShapes3D,
    setCayleyMultiplyType,
    toggleCayleyAction,
    addAllCayleyActions,
    clearCayleyActions,
    setCayleyShape3D,
    selectedElements,
    subsets,
    saveSubset,
    removeSubset,
    clearAllSubsets,
    multiViewMode,
    toggleMultiViewMode,
    openFloatingView,
    symmetryShowAction,
    symmetryRotateSpeed,
    setSymmetryShowAction,
    setSymmetryRotateSpeed,
  } = useGroup()

  const { t } = useTranslation()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [paramN, setParamN] = useState(6)

  const GROUP_TYPES: GroupTypeConfig[] = [
    { key: 'cyclic', label: t('group.cyclic.full'), minN: 2, maxN: 20, defaultN: 6, create: (n) => createCyclicGroup(n) },
    { key: 'symmetric', label: t('group.symmetric.full'), minN: 2, maxN: 5, defaultN: 3, create: (n) => createSymmetricGroup(n) },
    { key: 'dihedral', label: t('group.dihedral.full'), minN: 3, maxN: 8, defaultN: 4, create: (n) => createDihedralGroup(n) },
    { key: 'alternating', label: t('group.alternating.full'), minN: 3, maxN: 5, defaultN: 4, create: (n) => createAlternatingGroup(n) }
  ]

  const SPECIAL_GROUPS = [
    { label: 'V₄', desc: t('group.klein'), order: 4, create: createKleinFour },
    { label: 'Q₈', desc: t('group.quaternion'), order: 8, create: createQuaternion },
    { label: 'Z₄×Z₂', desc: t('group.direct.z4z2'), order: 8, create: createZ4xZ2 },
    { label: 'Z₂³', desc: t('group.direct.z2cubed'), order: 8, create: createZ2xZ2xZ2 },
    { label: 'Z₃×Z₃', desc: t('group.direct.z3z3'), order: 9, create: createZ3xZ3 }
  ]

  const VIEW_MODES: { value: ViewMode; label: string; desc: string }[] = [
    { value: 'set', label: t('view.set'), desc: t('view.set.desc') },
    { value: 'cayley', label: t('view.cayley'), desc: t('view.cayley.desc') },
    { value: 'cycle', label: t('view.cycle'), desc: t('view.cycle.desc') },
    { value: 'table', label: t('view.table'), desc: t('view.table.desc') },
    { value: '3d', label: t('view.3d'), desc: t('view.3d.desc') },
    { value: 'symmetry', label: t('view.symmetry'), desc: t('view.symmetry.desc') },
    { value: 'sublattice', label: t('view.sublattice'), desc: t('view.sublattice.desc') }
  ]

  function handleTypeSelect(key: string) {
    if (selectedType === key) return
    setSelectedType(key)
    const config = GROUP_TYPES.find(t => t.key === key)
    if (config) setParamN(config.defaultN)
  }

  const activeConfig = GROUP_TYPES.find(t => t.key === selectedType)

  function tabLabel(key: string) {
    if (key === 'cyclic') return t('group.cyclic')
    if (key === 'symmetric') return t('group.symmetric')
    if (key === 'dihedral') return t('group.dihedral')
    return t('group.alternating')
  }

  return (
    <div className="left-panel">
      <AccordionSection
        title={t('panel.createGroup')}
        defaultOpen={false}
        badge={currentGroup ? <span dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.symbol)) }} /> : undefined}
      >
        {/* Group type tabs */}
        <div className="group-type-tabs">
          {GROUP_TYPES.map(type => (
            <button
              key={type.key}
              className={`group-type-tab ${selectedType === type.key ? 'active' : ''}`}
              onClick={() => handleTypeSelect(type.key)}
            >
              {tabLabel(type.key)}
            </button>
          ))}
          <button
            className={`group-type-tab ${selectedType === 'special' ? 'active' : ''}`}
            onClick={() => setSelectedType(selectedType === 'special' ? null : 'special')}
          >
            {t('group.special')}
          </button>
        </div>

        {/* Parameter and create */}
        {activeConfig && (
          <div className="create-params">
            <div className="param-row">
              <span className="param-label">n</span>
              <span className="param-value">{paramN}</span>
              <input
                type="range"
                min={activeConfig.minN}
                max={activeConfig.maxN}
                value={paramN}
                onChange={(e) => setParamN(parseInt(e.target.value))}
                className="param-slider"
              />
              <span className="param-range">{activeConfig.minN}-{activeConfig.maxN}</span>
            </div>
            <button
              className="panel-btn create-btn"
              onClick={() => setCurrentGroup(activeConfig.create(paramN))}
            >
              {t('panel.create', { label: activeConfig.label })}
            </button>
          </div>
        )}

        {/* Special groups */}
        {selectedType === 'special' && (
          <div className="special-groups-grid">
            {SPECIAL_GROUPS.map(sg => (
              <button
                key={sg.label}
                className="special-group-item"
                onClick={() => setCurrentGroup(sg.create())}
              >
                <span className="special-group-symbol">{sg.label}</span>
                <span className="special-group-desc">{sg.desc}</span>
                <span className="special-group-order">|{sg.order}|</span>
              </button>
            ))}
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        title={t('panel.viewMode')}
        defaultOpen={true}
        badge={currentGroup ? VIEW_MODES.find(m => m.value === currentView)?.label : undefined}
      >
        {/* View mode grid */}
        <div className="view-modes-grid">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.value}
              className={`view-mode-card ${currentView === mode.value ? 'active' : ''}`}
              onClick={() => setCurrentView(mode.value)}
              disabled={!currentGroup}
              title={mode.desc}
            >
              <span className="view-mode-icon">
                {mode.value === 'set' && '⊡'}
                {mode.value === 'cayley' && '⬡'}
                {mode.value === 'cycle' && '◎'}
                {mode.value === 'table' && '⊞'}
                {mode.value === '3d' && '◈'}
                {mode.value === 'symmetry' && '⬠'}
                {mode.value === 'sublattice' && '⫘'}
              </span>
              <span className="view-mode-label">{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Multi-view toggle */}
        <label className="panel-checkbox" style={{ marginTop: '4px' }}>
          <input
            type="checkbox"
            checked={multiViewMode}
            onChange={toggleMultiViewMode}
            disabled={!currentGroup}
          />
          <span>{t('panel.multiView')}</span>
        </label>
        {multiViewMode && (
          <div className="multi-view-list">
            {VIEW_MODES.map(mode => (
              <button
                key={mode.value}
                className="panel-btn"
                onClick={() => openFloatingView(mode.value)}
                disabled={!currentGroup}
                style={{ fontSize: '12px', padding: '3px 8px' }}
              >
                {t('panel.floatView', { label: mode.label })}
              </button>
            ))}
          </div>
        )}

        {/* Cycle view option */}
        {currentView === 'cycle' && (
          <label className="panel-checkbox" style={{ marginTop: '6px' }}>
            <input
              type="checkbox"
              checked={showMaximalCycles}
              onChange={(e) => setShowMaximalCycles(e.target.checked)}
              disabled={!currentGroup}
            />
            <span>{t('panel.showMaximalCycles')}</span>
          </label>
        )}

        {/* Symmetry view options */}
        {currentView === 'symmetry' && (
          <div className="symmetry-settings">
            <label className="panel-checkbox">
              <input
                type="checkbox"
                checked={symmetryShowAction}
                onChange={(e) => setSymmetryShowAction(e.target.checked)}
                disabled={!currentGroup}
              />
              <span>{t('panel.showAction')}</span>
            </label>
            {symmetryShowAction && (
              <div className="symmetry-speed">
                <div className="param-row">
                  <span className="param-label">{t('panel.speed')}</span>
                  <span className="param-value">{symmetryRotateSpeed.toFixed(1)}x</span>
                  <input
                    type="range"
                    min={0.2}
                    max={5}
                    step={0.1}
                    value={symmetryRotateSpeed}
                    onChange={(e) => setSymmetryRotateSpeed(parseFloat(e.target.value))}
                    className="param-slider"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </AccordionSection>

      {(currentView === 'cayley' || currentView === '3d') && (
        <AccordionSection title={t('panel.cayleySettings')} defaultOpen={true}>
          <div className="cayley-settings">
            {/* Multiply type */}
            <div className="cayley-multiply">
              <span className="settings-label">{t('panel.multiplyType')}</span>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${cayleyMultiplyType === 'right' ? 'active' : ''}`}
                  onClick={() => setCayleyMultiplyType('right')}
                >
                  {t('panel.multiplyRight')}
                </button>
                <button
                  className={`toggle-btn ${cayleyMultiplyType === 'left' ? 'active' : ''}`}
                  onClick={() => setCayleyMultiplyType('left')}
                >
                  {t('panel.multiplyLeft')}
                </button>
              </div>
            </div>

            {/* 3D shape */}
            {currentView === '3d' && (
              <div className="cayley-shape">
                <span className="settings-label">{t('panel.shape')}</span>
                <select
                  value={cayleyShape3D}
                  onChange={(e) => setCayleyShape3D(e.target.value as Layout3D)}
                  className="shape-select"
                >
                  {cayleyAvailableShapes3D.map(shape => (
                    <option key={shape} value={shape}>{shape}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Force layout (2D only) */}
            {currentView === 'cayley' && (
              <button
                className="panel-btn"
                onClick={runForceLayout}
                disabled={!currentGroup}
              >
                {t('panel.forceLayout')}
              </button>
            )}

            {/* Element actions header */}
            <div className="cayley-actions-header">
              <span className="settings-label">
                {t('panel.elementActions', { n: cayleyActions.filter(a => a.enabled).length, m: cayleyActions.length })}
              </span>
              <div className="cayley-actions-buttons">
                <button
                  className="panel-btn"
                  onClick={addAllCayleyActions}
                  disabled={!currentGroup}
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                >
                  {t('panel.selectAll')}
                </button>
                <button
                  className="panel-btn"
                  onClick={clearCayleyActions}
                  disabled={!currentGroup}
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                >
                  {t('panel.clear')}
                </button>
              </div>
            </div>

            {/* Element actions list */}
            <div className="cayley-actions-list">
              {cayleyActions.map((action) => {
                const el = currentGroup?.elements.find(e => e.id === action.elementId)
                return (
                  <div
                    key={action.elementId}
                    className={`cayley-action-item ${action.enabled ? '' : 'disabled'}`}
                  >
                    <input
                      type="checkbox"
                      checked={action.enabled}
                      onChange={() => toggleCayleyAction(action.elementId)}
                    />
                    <span className="action-color" style={{ background: action.color }} />
                    <span
                      className="action-label"
                      dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label || action.elementId)) }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </AccordionSection>
      )}

      <AccordionSection title={t('panel.operations')} defaultOpen={false}>
        {/* Group operations */}
        <div className="operations-grid">
          <button
            className="panel-btn"
            onClick={computeInverse}
            disabled={!currentGroup}
          >
            {t('panel.inverse')}
          </button>
          <button
            className="panel-btn"
            onClick={clearCanvas}
            disabled={!currentGroup}
          >
            {t('panel.clearCanvas')}
          </button>
          <button
            className="panel-btn"
            onClick={resetNodePositions}
            disabled={!currentGroup}
          >
            {t('panel.resetPositions')}
          </button>
          <button
            className="panel-btn"
            onClick={runForceLayout}
            disabled={!currentGroup || (currentView !== 'cayley' && currentView !== 'cycle')}
          >
            {t('panel.forceLayout')}
          </button>
        </div>

        {/* Subset management */}
        <div className="subset-section">
          <div className="subset-section-header">{t('panel.subsetManagement')}</div>

          <button
            className="panel-btn"
            onClick={saveSubset}
            disabled={!currentGroup || selectedElements.size === 0}
            style={{
              width: '100%',
              backgroundColor: selectedElements.size > 0 ? '#4ecdc4' : undefined,
              color: selectedElements.size > 0 ? '#0f0f1a' : undefined,
              borderColor: selectedElements.size > 0 ? '#4ecdc4' : undefined
            }}
          >
            {t('panel.saveAsSubset', { n: selectedElements.size })}
          </button>

          {subsets.length > 0 && (
            <>
              <button
                className="panel-btn"
                onClick={clearAllSubsets}
                style={{ width: '100%', fontSize: '11px', marginTop: '-4px' }}
              >
                {t('panel.clearAllSubsets')}
              </button>
              <div className="subsets-list">
                {subsets.map(subset => (
                  <div key={subset.id} className="subset-item">
                    <span className="subset-color" style={{ background: subset.color }} />
                    <span className="subset-name">{subset.label}</span>
                    <span className="subset-size">({subset.elementIds.length})</span>
                    {subset.isNormalSubgroup && (
                      <span className="subset-badge normal">{t('badge.normal')}</span>
                    )}
                    {subset.isSubgroup && !subset.isNormalSubgroup && (
                      <span className="subset-badge subgroup">{t('badge.subgroup')}</span>
                    )}
                    <button
                      onClick={() => removeSubset(subset.id)}
                      className="subset-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </AccordionSection>
    </div>
  )
}

import { useGroup } from '../../context/useGroup'
import type { Layout3D, CayleyShape2D } from '../../core/types'
import { renderTex, texify } from '../../utils/texify'
import { useTranslation } from '../../i18n/useTranslation'
import { AccordionSection } from './AccordionSection'

export function CayleySettingsPanel() {
  const {
    currentGroup,
    currentView,
    cayleyActions,
    cayleyMultiplyType,
    cayleyShape3D,
    cayleyAvailableShapes3D,
    cayleyShape2D,
    cayleyAvailableShapes2D,
    setCayleyMultiplyType,
    toggleCayleyAction,
    addAllCayleyActions,
    clearCayleyActions,
    setCayleyShape3D,
    setCayleyShape2D,
    runForceLayout,
  } = useGroup()
  const { t } = useTranslation()

  // Canonical 3D Cayley edges for specific groups/shapes (mirror GroupContext presets)
  const canonical3DEdgeIds = ((): string[] => {
    if (!currentGroup) return []
    const sym = currentGroup.symbol
    if (currentView !== '3d') return []
    if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') {
      if (cayleyShape3D === 'rhombicuboctahedron') return ['4,1,2,3', '3,1,2,4']
      if (cayleyShape3D === 'truncatedOctahedron2') return ['2,3,4,1', '2,1,3,4']
      if (cayleyShape3D === 'truncatedOctahedron3') return ['2,1,3,4', '1,3,2,4', '1,2,4,3']
      if (cayleyShape3D === 'truncatedCube') return ['1,4,2,3', '2,1,3,4']
    }
    if (sym === 'A_{5}' || sym === 'A5' || sym === 'A₅') {
      if (cayleyShape3D === 'truncatedIcosahedron') return ['2,3,4,5,1', '2,1,4,3,5']
      if (cayleyShape3D === 'truncatedDodecahedron') return ['2,3,1,4,5', '1,5,4,3,2']
    }
    return []
  })()

  return (
    <AccordionSection
      title={t('panel.cayleySettings')}
      icon="⬡"
      defaultOpen={true}
    >
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

        {/* 2D shape selector */}
        {currentView === 'cayley' && currentGroup && cayleyAvailableShapes2D && cayleyAvailableShapes2D.length > 0 && (
          <div className="cayley-shape">
            <span className="settings-label">{t('panel.shape')}</span>
            <select
              value={cayleyShape2D}
              onChange={(e) => setCayleyShape2D(e.target.value as CayleyShape2D)}
              className="shape-select"
            >
              {cayleyAvailableShapes2D.map(shape => (
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

        {/* Element actions */}
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
                  title={action.enabled ? t('cayley.action.enabled') : t('cayley.action.disabled')}
                />
                <span className="action-color" style={{ background: action.color }} />
                <span
                  className="action-label"
                  dangerouslySetInnerHTML={{ __html: renderTex(texify(el?.label || action.elementId)) }}
                />
                {currentGroup && (() => {
                  if (currentView === '3d') {
                    // 在3D视图下：如果作用元素属于当前形状的规范边集，则不标注 by element
                    const isCanonical3D = canonical3DEdgeIds.includes(action.elementId)
                    return !isCanonical3D
                  }
                  // 其它视图下：非生成元则标注 by element
                  const isListedGenerator = currentGroup.generators.some(g => g.apply(currentGroup.identity).id === action.elementId)
                  return !isListedGenerator
                })() && (
                  <span className="action-hint" title={t('hint.cayleyActionNonGenerator')} style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: '11px' }}>
                    ({t('cayley.action.byElement')})
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AccordionSection>
  )
}

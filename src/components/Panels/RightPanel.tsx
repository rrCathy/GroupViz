import { useState, useMemo } from 'react'
import { useGroup } from '../../context/GroupContext'
import { findAllSubgroups, getConjugacyClasses, isSimpleGroup } from '../../core/algebra/subgroups'

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
  
  const selectedElement = selectedElements.size === 1 
    ? currentGroup?.elements.find(e => e.id === Array.from(selectedElements)[0]) 
    : null
  
  const subgroups = useMemo(() => {
    if (!currentGroup) return []
    return findAllSubgroups(currentGroup)
  }, [currentGroup])
  
  const conjugacyClasses = useMemo(() => {
    if (!currentGroup) return []
    return getConjugacyClasses(currentGroup)
  }, [currentGroup])
  
  const simpleGroup = useMemo(() => {
    if (!currentGroup) return false
    return isSimpleGroup(currentGroup)
  }, [currentGroup])

  return (
    <div className="right-panel">
      <div className="panel-section">
        <h3>元素属性</h3>
        {selectedElement ? (
          <>
            <div className="info-row">
              <span className="info-label">当前元素</span>
              <span className="info-value highlight">{selectedElement.label}</span>
            </div>
            <div className="info-row">
              <span className="info-label">逆元</span>
              <span className="info-value">
                {currentGroup?.inverse(selectedElement)?.label}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">ID</span>
              <span className="info-value">{selectedElement.id}</span>
            </div>
          </>
        ) : (
          <p className="info-placeholder">在画布上选择元素查看属性</p>
        )}
      </div>
      
      <div className="panel-section">
        <h3>群信息</h3>
        {currentGroup ? (
          <>
            <div className="info-row">
              <span className="info-label">群名</span>
              <span className="info-value">{currentGroup.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">符号</span>
              <span className="info-value">{currentGroup.symbol}</span>
            </div>
            <div className="info-row">
              <span className="info-label">阶</span>
              <span className="info-value">{currentGroup.order}</span>
            </div>
            <div className="info-row">
              <span className="info-label">生成元</span>
              <span className="info-value">
                {currentGroup.generators.map(g => g.symbol).join(', ')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">阿贝尔</span>
              <span className="info-value">
                {currentGroup.isAbelian ? '是' : '否'}
              </span>
            </div>
          </>
        ) : (
          <p className="info-placeholder">请先选择一个群</p>
        )}
      </div>
      
      {simpleGroup && currentGroup && (
        <div className="simple-group-badge">
          <span>单群 Simple Group</span>
        </div>
      )}
      
      <AccordionSection title={`子群 (${subgroups.length})`} defaultOpen={false}>
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
                <span className="sg-info">
                  {sg.elements.map(e => e.label).join(', ')}
                </span>
                {sg.isNormal && <span className="sg-badge">正规</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="info-placeholder">无子群</p>
        )}
      </AccordionSection>
      
      <AccordionSection title={`共轭类 (${conjugacyClasses.length})`} defaultOpen={false}>
        {conjugacyClasses.length > 0 ? (
          <div className="class-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {conjugacyClasses.map((cls, i) => (
              <div key={i} className="class-item">
                <span className="class-size">|{cls.length}|</span>
                <span className="class-elements">
                  {cls.map(e => e.label).join(', ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="info-placeholder">无共轭类</p>
        )}
      </AccordionSection>
      
      <div className="panel-section elements-list">
        <h3>元素列表 ({currentGroup?.elements.length || 0})</h3>
        <div className="elements-grid">
          {currentGroup?.elements.map(el => (
            <button
              key={el.id}
              className={`element-chip ${selectedElements.has(el.id) ? 'selected' : ''}`}
              onClick={() => selectElement(el.id, true)}
            >
              {el.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
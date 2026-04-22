import { useState } from 'react'
import { useGroup } from '../../context/GroupContext'
import type { ViewMode } from '../../core/types'
import { createS3 } from '../../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'

interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function AccordionSection({ title, defaultOpen = false, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="accordion-section">
      <button 
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <span className={`accordion-arrow ${isOpen ? 'open' : ''}`}>▶</span>
      </button>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  )
}

export function LeftPanel() {
  const { 
    currentGroup, 
    setCurrentGroup,
    currentView, 
    setCurrentView,
    lassoMode,
    setLassoMode,
    lassoShape,
    setLassoShape,
    computeInverse,
    clearCanvas,
    resetNodePositions,
    showMaximalCycles,
    setShowMaximalCycles
  } = useGroup()
  
  const viewModes: { value: ViewMode; label: string }[] = [
    { value: 'set', label: '集合视图' },
    { value: 'cayley', label: '凯莱图' },
    { value: 'cycle', label: '圆圈图' },
    { value: 'table', label: '乘法表' },
    { value: '3d', label: '3D对称' }
  ]
  
  
  
  return (
    <div className="left-panel">
      <AccordionSection title="生成群" defaultOpen={true}>
        <div className="group-selector">
          <select 
            className="panel-select"
            value={currentGroup?.symbol || ''}
            onChange={(e) => {
              const value = e.target.value
              if (value === 'S3') {
                setCurrentGroup(createS3())
              } else if (value.startsWith('Z')) {
                const order = parseInt(value.replace('Z', ''))
                setCurrentGroup(createCyclicGroup(order))
              } else if (value.startsWith('D')) {
                const order = parseInt(value.replace('D', ''))
                setCurrentGroup(createDihedralGroup(order))
              }
            }}
          >
            <option value="">选择群...</option>
            <optgroup label="对称群">
              <option value="S3">S₃ (阶=6)</option>
            </optgroup>
            <optgroup label="循环群">
              <option value="Z2">Z₂ (阶=2)</option>
              <option value="Z3">Z₃ (阶=3)</option>
              <option value="Z4">Z₄ (阶=4)</option>
              <option value="Z5">Z₅ (阶=5)</option>
              <option value="Z6">Z₆ (阶=6)</option>
              <option value="Z8">Z₈ (阶=8)</option>
            </optgroup>
            <optgroup label="二面��">
              <option value="D3">D₃ (阶=6)</option>
              <option value="D4">D₄ (阶=8)</option>
              <option value="D5">D₅ (阶=10)</option>
              <option value="D6">D₆ (阶=12)</option>
            </optgroup>
          </select>
        </div>
      </AccordionSection>
      
      <AccordionSection title="群操作" defaultOpen={true}>
        <div className="panel-buttons">
          <button 
            className="panel-btn"
            onClick={() => {
              clearCanvas()
            }}
            disabled={!currentGroup}
          >
            清空画布
          </button>
          <button 
            className="panel-btn"
            onClick={computeInverse}
            disabled={!currentGroup}
          >
            求逆元
          </button>
          <button 
            className="panel-btn"
            onClick={resetNodePositions}
            disabled={!currentGroup}
          >
            重置位置
          </button>
          
        </div>
      </AccordionSection>
      
      <AccordionSection title="视图切换" defaultOpen={true}>
        <div className="panel-buttons view-buttons">
          {viewModes.map(mode => (
            <button
              key={mode.value}
              className={`panel-btn ${currentView === mode.value ? 'active' : ''}`}
              onClick={() => setCurrentView(mode.value)}
              disabled={!currentGroup}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {currentView === 'cycle' && (
          <label className="panel-checkbox" style={{ marginTop: '8px' }}>
            <input 
              type="checkbox"
              checked={showMaximalCycles}
              onChange={(e) => setShowMaximalCycles(e.target.checked)}
              disabled={!currentGroup}
            />
            <span>仅显示极大循环</span>
          </label>
        )}
        <label className="panel-checkbox">
          <input 
            type="checkbox"
            checked={lassoMode}
            onChange={(e) => setLassoMode(e.target.checked)}
            disabled={!currentGroup}
          />
          <span>套选模式</span>
        </label>
        {lassoMode && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className={`panel-btn ${lassoShape === 'circle' ? 'active' : ''}`}
              onClick={() => setLassoShape('circle')}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              圆形
            </button>
            <button 
              className={`panel-btn ${lassoShape === 'rect' ? 'active' : ''}`}
              onClick={() => setLassoShape('rect')}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              矩形
            </button>
          </div>
        )}
      </AccordionSection>
      
      <div className="panel-tip">
        <p>快捷键：</p>
        <ul>
          <li>← → 切换元素</li>
          <li>滚轮缩放</li>
          <li>拖动平移</li>
          <li>Ctrl+点击多选</li>
        </ul>
      </div>
    </div>
  )
}
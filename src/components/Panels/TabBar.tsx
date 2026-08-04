import { useState, type ReactNode } from 'react'

export interface TabDef {
  key: string
  label: string
  icon?: string
  content: ReactNode
}

interface TabBarProps {
  tabs: TabDef[]
  defaultTab?: string
  compact?: boolean
}

export function TabBar({ tabs, defaultTab, compact = false }: TabBarProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? '')

  return (
    <div className="tab-bar">
      <div className={`tab-bar-header${compact ? ' compact' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={tab.label}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            {!compact && <span>{tab.label}</span>}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tabs.find(t => t.key === activeTab)?.content}
      </div>
    </div>
  )
}

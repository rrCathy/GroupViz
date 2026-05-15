import { useState } from 'react'

interface AccordionSectionProps {
  title: string
  icon?: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}

export function AccordionSection({ title, icon, defaultOpen = false, badge, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="accordion-section">
      <button
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="accordion-header-left">
          {icon && <span className="accordion-icon">{icon}</span>}
          <span>{title}</span>
        </span>
        <span className="accordion-header-right">
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

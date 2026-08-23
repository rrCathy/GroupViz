import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar, type TabDef } from '../components/Panels/TabBar'

const tabs: TabDef[] = [
  { key: 'general', label: '通用', icon: '⚙', content: <div>general-content</div> },
  { key: 'subsets', label: '子集', icon: '▦', content: <div>subsets-content</div> },
  { key: 'cosets', label: '陪集', content: <div>cosets-content</div> },
]

describe('TabBar', () => {
  it('renders all tab buttons with first active by default', () => {
    render(<TabBar tabs={tabs} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].className).toContain('active')
    expect(buttons[1].className).not.toContain('active')
  })

  it('shows only the active tab content', () => {
    render(<TabBar tabs={tabs} />)
    expect(screen.getByText('general-content')).toBeInTheDocument()
    expect(screen.queryByText('subsets-content')).toBeNull()
  })

  it('switches active tab on click', () => {
    render(<TabBar tabs={tabs} />)
    fireEvent.click(screen.getByRole('button', { name: /子集/ }))
    expect(screen.getByText('subsets-content')).toBeInTheDocument()
    expect(screen.queryByText('general-content')).toBeNull()
    expect(screen.getByRole('button', { name: /子集/ }).className).toContain('active')
  })

  it('honors defaultTab prop', () => {
    render(<TabBar tabs={tabs} defaultTab="cosets" />)
    expect(screen.getByText('cosets-content')).toBeInTheDocument()
  })

  it('compact mode hides labels but keeps title attribute', () => {
    render(<TabBar tabs={tabs} compact />)
    expect(screen.queryByText('通用')).toBeNull()
    const btn = screen.getByTitle('通用')
    expect(btn.querySelector('.tab-icon')).toHaveTextContent('⚙')
  })

  it('non-compact mode renders label and icon spans', () => {
    render(<TabBar tabs={tabs} />)
    expect(screen.getByText('通用')).toBeInTheDocument()
    expect(screen.getByText('⚙')).toBeInTheDocument()
    expect(screen.getByText('陪集')).toBeInTheDocument()
  })

  it('has tab-bar structure classes', () => {
    const { container } = render(<TabBar tabs={tabs} />)
    expect(container.querySelector('.tab-bar')).toBeInTheDocument()
    expect(container.querySelector('.tab-bar-header')).toBeInTheDocument()
    expect(container.querySelector('.tab-content')).toBeInTheDocument()
  })

  it('handles empty tabs array without crashing', () => {
    const { container } = render(<TabBar tabs={[]} />)
    expect(container.querySelectorAll('.tab-btn')).toHaveLength(0)
    expect(container.querySelector('.tab-content')?.childElementCount).toBe(0)
  })
})

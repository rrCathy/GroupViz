import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from '../components/Panels/AccordionSection'

describe('AccordionSection', () => {
  it('is closed by default', () => {
    render(
      <AccordionSection title="视图">
        <div>panel-body</div>
      </AccordionSection>,
    )
    expect(screen.getByRole('button', { name: /视图/ })).toBeInTheDocument()
    expect(screen.queryByText('panel-body')).toBeNull()
  })

  it('shows content when defaultOpen', () => {
    render(
      <AccordionSection title="视图" defaultOpen>
        <div>panel-body</div>
      </AccordionSection>,
    )
    expect(screen.getByText('panel-body')).toBeInTheDocument()
  })

  it('toggles internal state on header click', () => {
    render(
      <AccordionSection title="操作">
        <div>panel-body</div>
      </AccordionSection>,
    )
    const header = screen.getByRole('button')
    expect(header.querySelector('.accordion-arrow.open')).toBeNull()
    fireEvent.click(header)
    expect(screen.getByText('panel-body')).toBeInTheDocument()
    expect(header.querySelector('.accordion-arrow.open')).not.toBeNull()
    fireEvent.click(header)
    expect(screen.queryByText('panel-body')).toBeNull()
  })

  it('respects controlled open prop over clicks', () => {
    render(
      <AccordionSection title="受控" open={false}>
        <div>panel-body</div>
      </AccordionSection>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('panel-body')).toBeNull()
  })

  it('controlled open=true always shows content', () => {
    render(
      <AccordionSection title="受控" open>
        <div>panel-body</div>
      </AccordionSection>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('panel-body')).toBeInTheDocument()
  })

  it('calls onToggle when provided', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="回调" onToggle={onToggle}>
        <div>body</div>
      </AccordionSection>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders icon and badge when provided', () => {
    render(
      <AccordionSection
        title="带徽标"
        icon="▦"
        badge={<span data-testid="badge">S₃</span>}
        defaultOpen
      >
        <div>body</div>
      </AccordionSection>,
    )
    expect(screen.getByText('▦')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('S₃')
  })

  it('has accordion-section wrapper class', () => {
    const { container } = render(
      <AccordionSection title="结构">
        <div />
      </AccordionSection>,
    )
    expect(container.querySelector('.accordion-section')).toBeInTheDocument()
    expect(container.querySelector('.accordion-header-left')).toBeInTheDocument()
    expect(container.querySelector('.accordion-header-right')).toBeInTheDocument()
  })
})

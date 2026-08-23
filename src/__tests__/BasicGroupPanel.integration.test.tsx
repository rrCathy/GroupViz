import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nContext'
import { GroupProvider, GroupContext } from '../context/GroupContext'
import { useContext } from 'react'
import { BasicGroupPanel } from '../components/Panels/BasicGroupPanel'

function GroupProbe() {
  const ctx = useContext(GroupContext)
  const currentGroup = ctx?.currentGroup
  return <div data-testid="probe">{currentGroup ? currentGroup.symbol : 'none'}</div>
}

function renderPanel() {
  return render(
    <I18nProvider>
      <GroupProvider>
        <GroupProbe />
        <BasicGroupPanel />
      </GroupProvider>
    </I18nProvider>,
  )
}

describe('BasicGroupPanel integration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts without a group', () => {
    renderPanel()
    expect(screen.getByTestId('probe')).toHaveTextContent('none')
  })

  it('creates a dihedral group from the type tabs', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /基本群/ }))
    fireEvent.click(screen.getByRole('button', { name: /二面体群/ }))
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).not.toBeNull()
    fireEvent.change(slider, { target: { value: '4' } })
    const createBtn = container.querySelector('.create-btn') as HTMLButtonElement
    expect(createBtn).not.toBeNull()
    fireEvent.click(createBtn)
    expect(screen.getByTestId('probe')).toHaveTextContent('D_{4}')
  })

  it('creates a cyclic group with a custom order', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /基本群/ }))
    fireEvent.click(screen.getByRole('button', { name: /循环群/ }))
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '12' } })
    fireEvent.click(container.querySelector('.create-btn') as HTMLButtonElement)
    expect(screen.getByTestId('probe')).toHaveTextContent('C_{12}')
  })

  it('creates special groups from the grid', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /基本群/ }))
    fireEvent.click(screen.getByRole('button', { name: /特殊群/ }))
    const grid = container.querySelector('.special-groups-grid')
    expect(grid).not.toBeNull()
    const buttons = grid!.querySelectorAll('button')
    expect(buttons.length).toBe(4)
    fireEvent.click(buttons[1])
    expect(screen.getByTestId('probe')).toHaveTextContent('Q_{8}')
  })

  it('shows the created group symbol as the panel badge', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /基本群/ }))
    fireEvent.click(screen.getByRole('button', { name: /对称群/ }))
    fireEvent.click(container.querySelector('.create-btn') as HTMLButtonElement)
    const badge = container.querySelector('.accordion-badge')
    expect(badge?.textContent).toContain('S')
  })
})

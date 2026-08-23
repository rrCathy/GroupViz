import { test, expect } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'

test.describe('session persistence', () => {
  test('view choice survives a page reload', async ({ page }) => {
    await enterWorkspace(page)
    await waitForBridge(page)
    await page.evaluate(() => {
      const bridge = (window as unknown as {
        __groupVizExport__: { _setView(v: string): void }
      }).__groupVizExport__
      bridge._setView('table')
    })
    const tableCard = page.locator('button.view-mode-card', { hasText: '乘法表' })
    await expect(tableCard).toHaveClass(/active/, { timeout: 10_000 })
    await page.reload()
    await enterWorkspace(page)
    await expect(page.locator('button.view-mode-card', { hasText: '乘法表' })).toHaveClass(/active/)
  })

  test('theme toggle persists across reloads', async ({ page }) => {
    await enterWorkspace(page)
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? '')
    await page.locator('button.theme-toggle').click()
    const stored = await page.evaluate(() => localStorage.getItem('groupviz-theme'))
    expect(stored).not.toBeNull()
    await page.reload()
    await enterWorkspace(page)
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? '')
    if (before) expect(after).not.toBe(before)
    expect(after).toBe(stored)
  })
})

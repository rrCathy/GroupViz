import { test, expect } from '@playwright/test'
import { enterWorkspace } from './helpers'

test.describe('workspace shell', () => {
  test('shows default S3 set view with all six element nodes', async ({ page }) => {
    await enterWorkspace(page)
    const circles = page.locator('main.main-canvas svg.view-svg circle')
    await expect(circles).toHaveCount(6, { timeout: 15_000 })
    const session = await page.evaluate(() => localStorage.getItem('groupviz-session'))
    expect(session).not.toBeNull()
    const envelope = JSON.parse(session!)
    expect(envelope.data.symbol).toBe('S_{3}')
    expect(envelope.data.view).toBe('set')
  })

  test('renders three-column layout with no page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    await enterWorkspace(page)
    await expect(page.locator('.left-sidebar')).toBeVisible()
    await expect(page.locator('.right-sidebar')).toBeAttached()
    await expect(page.locator('main.main-canvas')).toBeVisible()
    const cards = page.locator('button.view-mode-card')
    await expect(cards).toHaveCount(9)
    expect(errors).toEqual([])
  })
})

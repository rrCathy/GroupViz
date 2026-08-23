import { test, expect } from '@playwright/test'
import { enterWorkspace } from './helpers'

test.describe('welcome page', () => {
  test('renders the welcome screen with an enter button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
    const enterBtn = page.getByRole('button', { name: /进入应用|enter/i })
    await expect(enterBtn).toBeVisible()
  })

  test('enter button navigates to the workspace', async ({ page }) => {
    await enterWorkspace(page)
    await expect(page.locator('.left-sidebar')).toBeVisible()
    await expect(page.locator('main.main-canvas svg.view-svg')).toBeVisible()
  })
})

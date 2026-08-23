import { test, expect } from '@playwright/test'
import { enterWorkspace } from './helpers'

test.describe('group creation', () => {
  test('creating D4 from the basic panel yields eight element nodes', async ({ page }) => {
    await enterWorkspace(page)
    await page.locator('.left-sidebar button.accordion-header', { hasText: '基本群' }).click()
    const dihedralTab = page.getByRole('button', { name: '二面体群' })
    await expect(dihedralTab).toBeVisible()
    await dihedralTab.click()
    const slider = page.locator('.left-sidebar input[type="range"]')
    await slider.fill('4')
    await page.locator('.left-sidebar .create-btn').first().click()
    await expect(page.locator('main.main-canvas svg.view-svg circle')).toHaveCount(8)
    const symbol = await page.evaluate(() => {
      const raw = localStorage.getItem('groupviz-session')
      return raw ? (JSON.parse(raw).data as { symbol: string }).symbol : ''
    })
    expect(symbol).toBe('D_{4}')
  })

  test('direct product mode can be entered and exited', async ({ page }) => {
    await enterWorkspace(page)
    const dpHeader = page
      .locator('.left-sidebar button.accordion-header .accordion-header-left > span:last-child')
      .filter({ hasText: /^直积$/ })
    await dpHeader.click()
    const modeBtn = page.getByRole('button', { name: /进入直积视图|退出直积视图/ }).first()
    await expect(modeBtn).toBeVisible()
    await modeBtn.click()
    await expect(page.getByRole('button', { name: /退出直积视图/ })).toBeVisible()
    await page.getByRole('button', { name: /退出直积视图/ }).click()
    await expect(page.getByRole('button', { name: /进入直积视图/ })).toBeVisible()
  })
})

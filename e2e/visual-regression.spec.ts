import { test, expect, type Page } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'

async function setGroupAndView(page: Page, symbol: string, view: string): Promise<void> {
  await waitForBridge(page)
  await page.evaluate(([sym, v]) => {
    const bridge = (window as unknown as {
      __groupVizExport__: {
        createGroupFromSymbol(s: string): unknown
        _setGroup(g: unknown): void
        _setView(v: string): void
      }
    }).__groupVizExport__
    const g = bridge.createGroupFromSymbol(sym)
    bridge._setGroup(g)
    bridge._setView(v)
  }, [symbol, view])
}

test.describe('visual regression', () => {
  test('set view of C6 matches baseline', async ({ page }) => {
    await enterWorkspace(page)
    await setGroupAndView(page, 'C_{6}', 'set')
    await expect(page.locator('main.main-canvas svg.view-svg circle')).toHaveCount(6)
    await page.waitForTimeout(500)
    const canvas = page.locator('.main-canvas')
    await expect(canvas).toHaveScreenshot('set-C6.png')
  })

  test('table view of S3 matches baseline', async ({ page }) => {
    await enterWorkspace(page)
    await setGroupAndView(page, 'S_{3}', 'table')
    await expect(page.locator('button.view-mode-card', { hasText: '乘法表' })).toHaveClass(/active/)
    await page.waitForTimeout(800)
    const canvas = page.locator('.main-canvas')
    await expect(canvas).toHaveScreenshot('table-S3.png')
  })

  test('sublattice view of S3 matches baseline', async ({ page }) => {
    await enterWorkspace(page)
    await setGroupAndView(page, 'S_{3}', 'sublattice')
    await expect(page.locator('button.view-mode-card', { hasText: '子群格' })).toHaveClass(/active/)
    await page.waitForTimeout(1500)
    const canvas = page.locator('.main-canvas')
    await expect(canvas).toHaveScreenshot('sublattice-S3.png')
  })
})

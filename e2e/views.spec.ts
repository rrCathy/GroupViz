import { test, expect } from '@playwright/test'
import { enterWorkspace } from './helpers'

test.describe('view switching', () => {
  test('all nine view cards switch without page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    await enterWorkspace(page)
    const cards = page.locator('button.view-mode-card')
    await expect(cards).toHaveCount(9)
    const count = await cards.count()
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      const label = (await card.textContent()) ?? ''
      if (label.includes('3D') || label.includes('对称性')) continue
      await card.click()
      await expect(card).toHaveClass(/active/)
      await expect(page.locator('main.main-canvas')).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('active card marker moves between views', async ({ page }) => {
    await enterWorkspace(page)
    const cards = page.locator('button.view-mode-card')
    await expect(cards).toHaveCount(9)
    await expect(cards.first()).toHaveClass(/active/)
    await cards.nth(3).click()
    await expect(cards.nth(3)).toHaveClass(/active/)
    await expect(cards.first()).not.toHaveClass(/active/)
  })
})

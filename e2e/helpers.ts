import type { Page } from '@playwright/test'

export async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/')
  const enterBtn = page.getByRole('button', { name: /进入应用|enter/i })
  if (await enterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await enterBtn.click()
  }
  await page.locator('main.main-canvas').waitFor({ state: 'visible', timeout: 15_000 })
}

export async function waitForBridge(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const bridge = (window as unknown as { __groupVizExport__: { waitReady(): Promise<void> } }).__groupVizExport__
    if (!bridge) throw new Error('export bridge missing')
    await bridge.waitReady()
  })
}

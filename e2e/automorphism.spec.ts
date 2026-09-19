import { test, expect, type Page } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'

/**
 * 自同构预览（props 化后 = SceneWindow 嵌套预览窗 + AutomorphismScene 内核）。
 *
 * 走真实用户路径：左栏「操作与子集」→ 自同构群 tab → 计算 Aut(G) → 加载，
 * 然后键盘选元素触发预览窗。断言点在「窗口内渲染的内核内容」上，
 * 因此这套用例同时守着 SceneWindow 嵌套形态与内核的受控刷新。
 */

/** 算出 Aut(S₃)（父群 = 默认的 S₃）并加载为当前群 */
async function loadAutS3(page: Page): Promise<void> {
  await enterWorkspace(page)
  await waitForBridge(page)
  await page.getByText('操作与子集').first().click()
  // TabBar 在 compact 模式下只渲染 icon，标签文本落在 title 属性上
  await page.locator('.tab-btn[title="自同构群"]').first().click()
  await page.getByRole('button', { name: /计算 Aut\(G\)/ }).first().click()
  const load = page.getByRole('button', { name: '加载' }).first()
  await load.waitFor({ state: 'visible', timeout: 15_000 })
  await load.click()
  // 等 currentGroup 真的切到 Aut(G)：构造 + 画布重算有延迟
  await page.waitForFunction(
    () => {
      const b = (window as unknown as {
        __groupVizExport__?: { _getGroup?: () => { automorphismParentSymbol?: string } | null }
      }).__groupVizExport__
      return !!b?._getGroup?.()?.automorphismParentSymbol
    },
    null,
    { timeout: 20_000 },
  )
}

const win = (page: Page) => page.locator('[data-testid="sw-chrome"]')

test.describe('automorphism preview (SceneWindow-nested)', () => {
  test('选一个自同构 → 预览窗出现，父群节点与不动点正确', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadAutS3(page)
    await page.keyboard.press('ArrowDown') // 选中恒等自同构
    await expect(win(page)).toBeVisible()
    await expect(win(page).locator('[data-testid="automorphism-scene"]')).toHaveCount(1)
    await expect(win(page).locator('circle[data-el-id]')).toHaveCount(6)
    await expect(win(page).locator('circle[data-fixed="1"]')).toHaveCount(6) // 恒等 → 全不动
    await expect(win(page).locator('[data-testid="automorphism-mapping"]')).toBeVisible()
    await expect(win(page).locator('[data-testid="automorphism-counts"]')).toContainText('不动')
    expect(errors).toEqual([])
  })

  test('换自同构 → 高亮跟着变；关闭后消失、重选再现', async ({ page }) => {
    await loadAutS3(page)
    await page.keyboard.press('ArrowDown')
    await expect(win(page).locator('circle[data-el-id]')).toHaveCount(6)

    await page.keyboard.press('ArrowDown') // 换成非恒等自同构
    await expect(win(page).locator('circle[data-fixed="1"]')).not.toHaveCount(6)

    await win(page).locator('button[title="Close"]').click()
    await expect(win(page)).toHaveCount(0)

    await page.keyboard.press('ArrowDown') // 清空后重选 → 再现
    await expect(win(page)).toBeVisible()
  })

  test('预览窗可拖（嵌套窗行为）', async ({ page }) => {
    await loadAutS3(page)
    await page.keyboard.press('ArrowDown')
    await expect(win(page)).toBeVisible()

    const before = (await win(page).boundingBox())!
    await page.mouse.move(before.x + 80, before.y + 16)
    await page.mouse.down()
    await page.mouse.move(before.x + 80 - 140, before.y + 16 - 70, { steps: 8 })
    await page.mouse.up()

    const after = (await win(page).boundingBox())!
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(20)
    expect(Math.abs(after.y - before.y)).toBeGreaterThan(20)
  })
})

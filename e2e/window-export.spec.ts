import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { enterWorkspace, waitForBridge } from './helpers'

// 窗口内导出（VCL「编排 → 出图」闭环）的**真机**判据。
//
// 单元测试只能钉到「点了按钮会调 exportViewHost」；「下载文件里到底有没有图、样式内联没内联、
// 注释掉不掉」只有真机能验 —— 尤其注释层是 KaTeX HTML（foreignObject），排版靠 `collectStyleText`
// 把 document.styleSheets 全量内联，线上表现与 jsdom/happy-dom 完全不同。
//
// W-0 只给 FGVE 内核壳（`ViewWindow`，仓内只在 `?test=2` 与包消费端可见）加了 ⤓；
// W-0b（2026-09-28）把同一入口接到**应用浮窗**（老式壳）—— 本 spec 验的就是后者：
// 应用里能编排（W-3/W-4 起可改参数、可加注释）却导不出来，是当时最后一段缺口。
//
// 三套壳共用 `utils/exportSvg.exportViewHost` 一份口径：2D → 自包含 SVG，3D/对称性 → canvas PNG。

/** 经导出桥载群（与 scripts/batch-export.mjs 同路，避开按阶创建面板的 C_n≤30 限制） */
async function loadGroup(page: Page, symbol: string) {
  const firstLabel = await page.evaluate((sym) => {
    const api = (window as unknown as {
      __groupVizExport__: { createGroupFromSymbol(s: string): { elements: { label: string }[] } | null; _setGroup(g: unknown): void }
    }).__groupVizExport__
    const g = api.createGroupFromSymbol(sym)
    api._setGroup(g)
    return g!.elements[1].label
  }, symbol)
  await page.waitForTimeout(500)
  return firstLabel
}

/** 开多视图模式后按 buildViewModes 次序开第 nth 个视图窗（1 = 凯莱图，4 = 3D 凯莱图） */
async function openWindow(page: Page, nth: number) {
  await page.locator('label.panel-checkbox', { hasText: /多视图|Multi-View/i }).locator('input').check()
  await page.waitForTimeout(300)
  const btn = page.locator('.multi-view-list .panel-btn').nth(nth)
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  await page.waitForTimeout(nth === 4 ? 2600 : 900)
  return page.locator('.floating-view-window').last()
}

test('应用浮窗 ⤓ 导出 2D 自包含 SVG（含内联样式与本窗注释层）', async ({ page }) => {
  await enterWorkspace(page)
  await waitForBridge(page)
  const anchor = await loadGroup(page, 'A_{4}')
  const win = await openWindow(page, 1)
  await expect(win.locator('[data-testid="float-export"]')).toHaveCount(1)
  await expect(win.locator('[data-testid="float-export"]')).toHaveAttribute('title', 'Export SVG')

  // 先经 ⚙ 面板挂一条注释 —— 要验的是「导出的是**编排后**的图」，不是裸图
  await win.locator('[data-testid="float-params-toggle"]').click()
  await page.locator('[data-testid="annotation-ref"]').fill(anchor)
  await page.locator('[data-testid="annotation-text"]').fill('g^{2}=e')
  await page.locator('[data-testid="annotation-add"]').click()
  await expect(win.locator('[data-testid="cayley-annotations"] foreignObject')).toHaveCount(1)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    win.locator('[data-testid="float-export"]').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.svg$/)
  const path = await download.path()
  const svg = readFileSync(path, 'utf8')

  // 自包含：全量样式内联 + KaTeX 字体改 CDN（否则外部打开掉排版）
  expect(svg).toContain('<style')
  expect(svg).toMatch(/katex/i)
  // 导出的是本窗的图：带 viewBox，且注释层在里面
  expect(svg).toMatch(/<svg[^>]*viewBox="/)
  expect(svg).toContain('cayley-annotations')
})

test('应用浮窗 3D 视图导 PNG（canvas 栅格），且按钮文案随之切换', async ({ page }) => {
  await enterWorkspace(page)
  await waitForBridge(page)
  await loadGroup(page, 'A_{4}')
  const win = await openWindow(page, 4)

  const btn = win.locator('[data-testid="float-export"]')
  await expect(btn).toHaveAttribute('title', 'Export PNG')
  await expect(win.locator('.floating-view-content canvas')).toHaveCount(1, { timeout: 20_000 })

  const [download] = await Promise.all([page.waitForEvent('download'), btn.click()])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  const path = await download.path()
  // 栅格真的画出来了（空 canvas 的 PNG 只有几百字节）
  expect(readFileSync(path).byteLength).toBeGreaterThan(5000)
})

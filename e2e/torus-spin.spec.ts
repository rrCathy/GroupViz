import { test, expect, type Page } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'

// 环面（torusHex）两个自转的**真机**判据。单位测试只钉住「开关 → useFrame → tubePhase → 布局」的接线
// 与 core 的相位数学；画面是否真的在按环面自身的两个方向转，只有真机能验。
//
// 环面 = S¹×S¹：绕大圆（纬向）= 内容绕环面回转轴刚体旋转；绕管子（经向）= 内容沿每根管的截面绕行。
// 判据：
// ① 打开后画面持续变化、关掉后重新静止（相位冻结在停下的位置，不回零）；
// ② 变化集中在**环体带**上：背景与中心孔洞全程静止 —— 相机在两个自转里完全不动，所以
//    「背景静止 + 环上内容流动」本身就是「转的是图、不是相机」的直接证据（外带 diff ≫ 内盘 diff）；
// ③ 每帧成本：与关掉时对比（headless 走 SwiftShader 软渲染，绝对值不可比，只看相对比）。

const W = 96
const H = 60
// 缩略图（96×60）里的区域：外带 = 环体与图；四角 = 纯背景。
// 注意：初始机位是斜上方，环面前部管壁会盖住画面中心 —— 所以"孔洞在正中"不成立，
// 中心盘不能当静止区用；能钉住「转的是图不是相机」的是**四角背景全程静止**。
const C = { cx: 48, cy: 30, rOutA: 15, rOutB: 27 }
const CORNER = 10

/** 打开 S₄ 的环面全六边形镶嵌（3D 视图 + torusHex 形状） */
async function openTorus(page: Page) {
  await enterWorkspace(page)
  await waitForBridge(page)
  // 应用里的 S₄ = 一行记法置换群（id 形如 '2,1,3,4'）—— torusHex 只对这种结构成立
  const importPanel = page.locator('.accordion-section').filter({ hasText: /记号导入群|Import by Notation/ }).first()
  await importPanel.locator('.accordion-header').click()
  await importPanel.locator('.import-input').fill('S_4')
  await importPanel.locator('.create-btn').click()
  await page.evaluate(() => {
    const bridge = (window as unknown as { __groupVizExport__: { _setView(v: string): void } }).__groupVizExport__
    bridge._setView('3d')
  })
  const warn = page.locator('.large-group-warning .panel-btn')
  if (await warn.isVisible({ timeout: 800 }).catch(() => false)) await warn.click()
  const canvas = page.locator('.canvas-viewport canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  // 切成环面形状（切换会自动套用该形状的规范作用边 = 三个星形对换）
  await page.locator('.cayley-shape select.shape-select').selectOption('torusHex')
  await page.waitForTimeout(1500)
  // 页内采样器：WebGL canvas → W×H 灰度缩略图（同 cayley3d-rotation 手法，尺寸小以免 evaluate 抖动）
  await page.evaluate(([gw, gh]) => {
    const src = document.querySelector('.canvas-viewport canvas') as HTMLCanvasElement
    const tmp = document.createElement('canvas')
    tmp.width = gw
    tmp.height = gh
    const ctx = tmp.getContext('2d')!
    ;(window as unknown as { __grab: () => { t: number; g: number[] } }).__grab = () => {
      ctx.drawImage(src, 0, 0, gw, gh)
      const d = ctx.getImageData(0, 0, gw, gh).data
      const g: number[] = []
      for (let i = 0; i < gw * gh; i++) {
        g.push(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114)
      }
      return { t: performance.now(), g }
    }
    // 每帧间隔采样（毫秒）：给定窗口内的 rAF 间隔中位数
    ;(window as unknown as { __fps: (ms: number) => Promise<number[]> }).__fps = (ms: number) =>
      new Promise<number[]>(resolve => {
        const out: number[] = []
        let last = performance.now()
        const start = last
        const step = () => {
          const now = performance.now()
          out.push(now - last)
          last = now
          if (now - start < ms) requestAnimationFrame(step)
          else resolve(out)
        }
        requestAnimationFrame(step)
      })
  }, [W, H])
  return canvas
}

const grab = (page: Page) =>
  page.evaluate(() => (window as unknown as { __grab: () => { t: number; g: number[] } }).__grab())

const frameIntervals = (page: Page, ms: number) =>
  page.evaluate((windowMs) => (window as unknown as { __fps: (ms: number) => Promise<number[]> }).__fps(windowMs), ms)

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

const meanAbsDiff = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length

/** 按区域拆帧差：外带（环体与图） vs 四角（纯背景，相机不动则恒静止） */
function regionDiff(a: number[], b: number[]) {
  let so = 0
  let no = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - C.cx, y - C.cy)
      if (r >= C.rOutA && r <= C.rOutB) {
        so += Math.abs(a[y * W + x] - b[y * W + x])
        no++
      }
    }
  }
  let sc = 0
  let nc = 0
  for (const [x0, y0] of [[0, 0], [W - CORNER, 0], [0, H - CORNER], [W - CORNER, H - CORNER]]) {
    for (let y = y0; y < y0 + CORNER; y++) {
      for (let x = x0; x < x0 + CORNER; x++) {
        sc += Math.abs(a[y * W + x] - b[y * W + x])
        nc++
      }
    }
  }
  return { corners: sc / Math.max(1, nc), outer: so / Math.max(1, no), all: meanAbsDiff(a, b) }
}

const settle = (page: Page) => page.waitForTimeout(260)

test.describe('torusHex — 环面两个自转（绕大圆 / 绕管子）', () => {
  test('两个开关都在动、关掉后停住；变化只在环体带上（相机不动）', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    await openTorus(page)
    const ring = page.getByTestId('cayley3d-spin-ring')
    const tube = page.getByTestId('cayley3d-spin-tube')
    await expect(ring).toBeVisible()
    await expect(tube).toBeVisible()

    // ① 都关着：画面静止（指标基线）
    const b1 = await grab(page)
    await page.waitForTimeout(500)
    const b2 = await grab(page)
    const base = meanAbsDiff(b1.g, b2.g)
    console.log('[torus-spin] 基线静止 diff = %s', base.toFixed(3))
    expect(base).toBeLessThan(0.5)

    // ② 绕大圆：画面在动，且四角背景全程静止（相机不动 ⇒ 转的是图不是相机）
    await ring.click()
    const r1 = await grab(page)
    await page.waitForTimeout(700)
    const r2 = await grab(page)
    const dRing = regionDiff(r1.g, r2.g)
    console.log('[torus-spin] 大圆: all=%s outer=%s corners=%s',
      dRing.all.toFixed(2), dRing.outer.toFixed(2), dRing.corners.toFixed(3))
    expect(dRing.all).toBeGreaterThan(2)
    expect(dRing.outer).toBeGreaterThan(2)
    expect(dRing.corners).toBeLessThan(0.5)
    await page.screenshot({ path: '.tmp-spin/ring-on.png' })

    // ③ 关掉：相位冻结 ⇒ 画面重新静止（回到基线量级）
    await ring.click()
    await settle(page)
    const f1 = await grab(page)
    await page.waitForTimeout(500)
    const f2 = await grab(page)
    const offRing = meanAbsDiff(f1.g, f2.g)
    console.log('[torus-spin] 大圆关掉后 diff = %s', offRing.toFixed(3))
    expect(offRing).toBeLessThan(0.5)

    // ④ 绕管子：同样在动、同样只动环体（四角静止）
    await tube.click()
    const t1 = await grab(page)
    await page.waitForTimeout(700)
    const t2 = await grab(page)
    const dTube = regionDiff(t1.g, t2.g)
    console.log('[torus-spin] 管子: all=%s outer=%s corners=%s',
      dTube.all.toFixed(2), dTube.outer.toFixed(2), dTube.corners.toFixed(3))
    expect(dTube.all).toBeGreaterThan(2)
    expect(dTube.outer).toBeGreaterThan(2)
    expect(dTube.corners).toBeLessThan(0.5)
    await page.screenshot({ path: '.tmp-spin/tube-on.png' })

    await tube.click()
    await settle(page)
    const g1 = await grab(page)
    await page.waitForTimeout(500)
    const g2 = await grab(page)
    const offTube = meanAbsDiff(g1.g, g2.g)
    console.log('[torus-spin] 管子关掉后 diff = %s', offTube.toFixed(3))
    expect(offTube).toBeLessThan(0.5)

    expect(errors).toEqual([])
  })

  test('两个自转的每帧成本（相对基线；headless 软渲染只看比值）', async ({ page }) => {
    await openTorus(page)
    const ring = page.getByTestId('cayley3d-spin-ring')
    const tube = page.getByTestId('cayley3d-spin-tube')

    const off = median(await frameIntervals(page, 1500))
    await ring.click()
    const ringMs = median(await frameIntervals(page, 1500))
    await ring.click()
    await tube.click()
    const tubeMs = median(await frameIntervals(page, 1500))
    await tube.click()
    await settle(page)
    const backOff = median(await frameIntervals(page, 1000))

    // eslint-disable-next-line no-console
    console.log('[torus-spin] 帧间隔中位数 ms：关=%s 大圆=%s 管子=%s 再关=%s',
      off.toFixed(1), ringMs.toFixed(1), tubeMs.toFixed(1), backOff.toFixed(1))
    // 大圆自转走命令式转 group（零重渲染）；管子自转每帧重算曲面点。两者都不该把帧间隔拉爆
    expect(ringMs).toBeLessThan(off * 1.8)
    expect(tubeMs).toBeLessThan(off * 2.5)
  })
})

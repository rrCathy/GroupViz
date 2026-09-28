import { test, expect, type Page } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'

// 3D 凯莱图的两条**真机**判据（单位测试锁不住组件接线与真手势）：
//
// ① 甩手惯性必须是**绕固定轴的单轴旋转**。旧实现把甩手向量拆成 θ̇（世界 Y）+ φ̇（相机右轴）两个恒定速率
//    分别积分，合成不是单轴旋转：竖直分量让俯仰角无界漂移、相机反复翻越极点、可见旋向来回翻转
//    （按旧公式逐帧积分实测：拖 (240,60) 后 6 秒内极点跨越 3 次、旋向反转 2 次、6 整圈后姿态未复位）。
//    单轴恒速旋转 ⇒ 画面以旋转周期严格自我重复（ω = 2π rad/s ⇒ 1 圈/秒）：按真实时间做 lag 扫描，
//    τ = 1s 处画面差应显著低于其它 τ（旧实现任何 τ 都对不上：全部 3.9~4.2，修复后 τ=1s 仅 0.9）。
//
// ② 拖拽必须**一直跟手**。旧实现水平分量钉在**世界 Y** 上 ⇒ 相机一滚转/翻到下半球，手的左右就被映射成
//    世界反方向（真机实测：物体翻成上下颠倒后向右拖 40px，画面内容**左移** 63px）。判据 = 画面中心区域的
//    内容位移（灰度互相关最优平移）与指针方向同向，翻转前后都要成立（修复后：正立 24.5px / 翻转 49px，
//    每拖拽像素位移量两态一致 ≈1.2）。

const W = 240
const H = 240

/** 打开 3D 视图并注入页内采样器（w×h 灰度缩略图；lag 扫描用小尺寸以免 evaluate 抖动） */
async function open3D(page: Page, w = W, h = H) {
  await enterWorkspace(page)
  await waitForBridge(page)
  await page.evaluate(() => {
    const bridge = (window as unknown as { __groupVizExport__: { _setView(v: string): void } }).__groupVizExport__
    bridge._setView('3d')
  })
  const canvas = page.locator('.canvas-viewport canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  // 页内采样器：WebGL canvas → w×h 灰度缩略图（含页内时间戳，避免跨进程时间误差）
  await page.evaluate(([gw, gh]) => {
    const src = document.querySelector('.canvas-viewport canvas') as HTMLCanvasElement
    const tmp = document.createElement('canvas')
    tmp.width = gw
    tmp.height = gh
    const ctx = tmp.getContext('2d')!
    const grabFrame = () => {
      ctx.drawImage(src, 0, 0, gw, gh)
      const d = ctx.getImageData(0, 0, gw, gh).data
      const g: number[] = []
      for (let i = 0; i < gw * gh; i++) {
        g.push(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114)
      }
      return { t: performance.now(), g }
    }
    ;(window as unknown as { __grab: typeof grabFrame }).__grab = grabFrame
  }, [w, h])
  return canvas
}

const grab = (page: Page) =>
  page.evaluate(() => (window as unknown as { __grab: () => { t: number; g: number[] } }).__grab())

const meanAbsDiff = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length

/** 互相关求内容位移（中心 80×80 窗口、搜索 ±26 缩略图像素）；返回缩略图像素位移 */
function shiftBetween(before: number[], after: number[]) {
  const c = 120
  const half = 40
  const R = 26
  let bestSx = 0
  let bestSy = 0
  let bestSad = Infinity
  for (let sy = -R; sy <= R; sy++) {
    for (let sx = -R; sx <= R; sx++) {
      let sad = 0
      let n = 0
      for (let y = c - half; y <= c + half; y += 2) {
        for (let x = c - half; x <= c + half; x += 2) {
          const ax = x + sx
          const ay = y + sy
          if (ax < 0 || ax >= W || ay < 0 || ay >= H) continue
          sad += Math.abs(before[ay * W + ax] - after[y * W + x])
          n++
        }
      }
      const m = sad / n
      if (m < bestSad) { bestSad = m; bestSx = sx; bestSy = sy }
    }
  }
  return { x: -bestSx, y: -bestSy } // 最优匹配位移取负 = 内容位移
}

/** 真指针拖拽后测内容位移（缩略图像素） */
async function dragAndMeasure(page: Page, dx: number, dy: number) {
  const canvas = page.locator('.canvas-viewport canvas').first()
  const box = (await canvas.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const before = await grab(page)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await page.waitForTimeout(150)
  const after = await grab(page)
  return shiftBetween(before.g, after.g)
}

test.describe('3D Cayley graph drag & inertia', () => {
  test('flick inertia spins about a single fixed axis (frame repeats every turn)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    const canvas = await open3D(page, 96, 60)
    const box = (await canvas.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    // 基线：画面静止时相邻采样必须完全相同（证明下面的画面差指标有效）
    const a = await grab(page)
    await page.waitForTimeout(400)
    const b = await grab(page)
    expect(meanAbsDiff(a.g, b.g)).toBeLessThan(0.5)

    // 真指针甩手：向右 240px、向下 60px（轻微带竖直分量 —— 旧实现正是在这种输入下开始"来回转"）
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(cx + (240 * i) / 12, cy + (60 * i) / 12)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()

    // ▶ 自动旋转（ω = displayAngVel() = 2π rad/s）
    await page.locator('button[aria-label*="旋转"], button[title*="旋转"]').first().click()

    const samples: { t: number; g: number[] }[] = []
    const until = Date.now() + 3200
    while (Date.now() < until) samples.push(await grab(page))
    expect(samples.length).toBeGreaterThan(20)

    // 逐帧在动
    let adj = 0
    for (let i = 1; i < samples.length; i++) adj += meanAbsDiff(samples[i - 1].g, samples[i].g)
    expect(adj / (samples.length - 1)).toBeGreaterThan(1)

    // lag 扫描（按真实时间配对，容差 25ms）
    const diffAt = (tau: number) => {
      const out: number[] = []
      for (let i = 0; i < samples.length; i++) {
        let best = -1
        let bestDt = Infinity
        for (let j = 0; j < i; j++) {
          const dt = samples[i].t - samples[j].t
          if (Math.abs(dt - tau) < Math.abs(bestDt - tau)) { bestDt = dt; best = j }
        }
        if (best >= 0 && Math.abs(bestDt - tau) <= 25) out.push(meanAbsDiff(samples[best].g, samples[i].g))
      }
      return out.length ? out.reduce((s, x) => s + x, 0) / out.length : NaN
    }
    const oneTurn = diffAt(1000)
    const otherTurns = [diffAt(250), diffAt(500), diffAt(750), diffAt(1250)].filter(Number.isFinite)
    const otherAvg = otherTurns.reduce((s, x) => s + x, 0) / otherTurns.length

    // 整圈重合（单轴旋转的可观测判据）；半圈/四分之一圈必然不同
    expect(oneTurn).toBeLessThan(2)
    expect(otherAvg).toBeGreaterThan(oneTurn * 2)
    expect(errors).toEqual([])
  })

  test('drag follows the hand even after the object is flipped upside down', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    await open3D(page)

    // 正立：向右拖 20px ⇒ 内容右移（实测 +24.5px，约拖拽量的 1.2 倍）
    const upright = await dragAndMeasure(page, 20, 0)
    expect(upright.x).toBeGreaterThan(4)

    // 翻成上下颠倒：竖直拖两段、每段 260px（0.006 rad/px ⇒ 合计 ~180°）
    await dragAndMeasure(page, 0, 260)
    await dragAndMeasure(page, 0, 260)
    await page.waitForTimeout(150)

    // 仍向右拖 ⇒ 内容必须**仍右移**（旧实现水平绕世界 Y ⇒ 此处左移，实测 −63px）
    const flipped = await dragAndMeasure(page, 20, 0)
    expect(flipped.x).toBeGreaterThan(4)
    // 竖直方向同理（竖直分量一直是相机局部轴，两态都跟手）
    const flippedDown = await dragAndMeasure(page, 0, 20)
    expect(flippedDown.y).toBeGreaterThan(4)
    expect(errors).toEqual([])
  })
})

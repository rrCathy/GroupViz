// 字长球布局截图脚本：S₄ / S₅ 3D 视图 wordLengthSphere 形状 PNG 导出
// 用法: node scripts/wordlength-screenshot.mjs   （需 dev server 运行于 5173）
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.GV_BASE_URL || 'http://localhost:5173'
const OUT_DIR = resolve(process.cwd(), 'test-results')

const TARGETS = [
  { symbol: 'S_{4}', label: 'S4-wordLengthSphere', shape: 'wordLengthSphere' },
  { symbol: 'S_{5}', label: 'S5-wordLengthSphere', shape: 'wordLengthSphere' },
  { symbol: 'S_{4}', label: 'S4-default-truncatedOctahedron2', shape: 'truncatedOctahedron2' },
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })
  console.log('Navigating...')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  const enterBtn = page.getByRole('button', { name: /进入应用|enter|Enter/i })
  if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enterBtn.click()
    await sleep(1000)
  }

  await page.evaluate(async () => {
    const api = window.__groupVizExport__
    if (!api) throw new Error('Export bridge not found')
    await api.waitReady()
  })
  console.log('Bridge ready.')

  mkdirSync(OUT_DIR, { recursive: true })

  for (const t of TARGETS) {
    const info = await page.evaluate(({ symbol, shape }) => {
      const api = window.__groupVizExport__
      const g = api.createGroupFromSymbol(symbol)
      if (!g) return null
      api._setGroup(g)
      return { symbol: g.symbol, order: g.order }
    }, { symbol: t.symbol, shape: t.shape })

    if (!info) { console.log(`${t.label}: FAIL (group not created)`); continue }
    // 等切群重置 effect（queueMicrotask 重置 shape3D → default）跑完，再设形状，
    // 否则 _setCayleyShape3D 会被覆盖
    await sleep(700)

    await page.evaluate((v) => window.__groupVizExport__._setView(v), '3d')
    await sleep(500)

    await page.evaluate((s) => window.__groupVizExport__._setCayleyShape3D(s), t.shape)
    await sleep(800)

    // S₅=120 阶超过 3d 视图 100 阶门槛 → 点击「仍要显示」强制渲染
    // （React 重渲染会重建按钮 DOM，带重试点击）
    for (let i = 0; i < 6; i++) {
      const warnBtn = page.locator('.large-group-warning .panel-btn')
      if (!(await warnBtn.isVisible().catch(() => false))) {
        if (i > 0) break // 第一轮不可见 = 无门槛；后续轮不可见 = 已点掉
        await sleep(400)
        continue
      }
      await warnBtn.click({ timeout: 1500 }).catch(() => {})
      await sleep(400)
      if (!(await page.locator('.large-group-warning').isVisible().catch(() => false))) {
        console.log(`${t.label}: clicked force-show for large group`)
        break
      }
    }

    // 大群（S₅=120）节点/标签初始化慢，等待渲染完全稳定
    await sleep(t.symbol === 'S_{5}' ? 4000 : 1500)
    await page.evaluate(() => window.__groupVizExport__.hideOverlays())
    await sleep(1200)

    // 诊断：读取 UI 实际生效的形状与 actions 勾选
    const diag = await page.evaluate(() => {
      const sel = document.querySelector('.shape-select')
      const checked = [...document.querySelectorAll('.action-item input[type="checkbox"]:checked, .cayley-action input[type="checkbox"]:checked')]
        .map(c => c.closest('label, .action-item, .cayley-action')?.textContent?.trim().slice(0, 20))
      return { shape: sel ? sel.value : '(no select)', enabledActions: checked }
    })
    console.log(`${t.label}: DIAG ${JSON.stringify(diag)}`)

    await sleep(200)
    let dataUrl = await page.evaluate(() => window.__groupVizExport__.exportCanvasDataUrl())
    if (!dataUrl) {
      await sleep(2500)
      dataUrl = await page.evaluate(() => window.__groupVizExport__.exportCanvasDataUrl())
    }
    if (dataUrl) {
      const file = resolve(OUT_DIR, `${t.label}.png`)
      writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
      console.log(`${t.label}: OK (|G|=${info.order}) -> ${file}`)
    } else {
      console.log(`${t.label}: FAIL (no canvas)`)
    }

    // 俯视截图：canvas 上向下拖拽减小 phi（极角）→ 近极点俯视同心球壳
    const canvas = page.locator('.canvas-viewport canvas').first()
    const box = await canvas.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      // 单次大距离拖拽（~520px → Δphi≈3.1rad）翻到极点上方正俯视
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      for (let i = 1; i <= 10; i++) await page.mouse.move(cx, cy + i * 52, { steps: 2 })
      await page.mouse.up()
      await sleep(700)
      const topDataUrl = await page.evaluate(() => window.__groupVizExport__.exportCanvasDataUrl())
      if (topDataUrl) {
        const file = resolve(OUT_DIR, `${t.label}-top.png`)
        writeFileSync(file, Buffer.from(topDataUrl.split(',')[1], 'base64'))
        console.log(`${t.label}: TOP -> ${file}`)
      }
      // 双击复位默认视角
      await canvas.dblclick()
      await sleep(500)
    }
    await page.evaluate(() => window.__groupVizExport__.showOverlays())
  }

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })

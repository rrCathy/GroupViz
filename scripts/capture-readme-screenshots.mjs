// Temporary scratch script — replaces docs/images/* with clean canvas-only shots + GIFs
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.GV_BASE_URL || 'http://localhost:5173'
const OUT = resolve(process.cwd(), 'docs/images')

const SHOTS = [
  { group: 'D_{4}', view: 'cayley', file: 'hero-cayley-2d-D4.png', note: 'cayley' },
  { group: 'A_{5}', view: '3d', file: 'cayley-3d-A5.png', note: '3d' },
  { group: 'S_{4}', view: 'sublattice', file: 'lattice-S4.png', note: 'sublattice' },
  { group: 'S_{4}', view: 'symmetry', file: 'symmetry-S4.png', note: 'symmetry' },
  { group: 'S_{3}', view: 'table', file: 'table-S3.png', note: 'table' },
  { group: 'C_{12}', view: 'cycle', file: 'cycle-C12.png', note: 'cycle' },
  { group: 'C_{20}', view: 'set', file: 'set-C20.png', note: 'set' },
]

const GIFS = [
  { group: 'S_{4}', view: 'symmetry', element: '2,3,4,1', file: 'symmetry-S4.gif' },
  { group: 'A_{5}', view: '3d', file: 'cayley-3d-A5.gif' },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function pickView(views, label) {
  const exact = views.find((v) => v === label)
  if (exact) return exact
  const ci = views.find((v) => v.toLowerCase() === label.toLowerCase())
  if (ci) return ci
  return views.find((v) => v.toLowerCase().includes(label.toLowerCase()))
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  const page = await context.newPage()

  await page.addInitScript(() => {
    try {
      localStorage.setItem('groupviz-theme', 'dark')
    } catch {}
  })

  console.log('Navigating...')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  const enter = page.getByRole('button', { name: /进入应用|enter|Enter/i })
  if (await enter.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enter.click()
    await sleep(1000)
  }
  await page.evaluate(async () => {
    const api = window.__groupVizExport__
    if (!api) throw new Error('Export bridge not found')
    await api.waitReady()
  })

  const viewport = page.locator('.canvas-viewport')

  let ok = 0
  for (const shot of SHOTS) {
    const made = await page.evaluate((sym) => {
      const b = window.__groupVizExport__
      const g = b.createGroupFromSymbol(sym)
      if (!g) return false
      b._setGroup(g)
      return true
    }, shot.group)
    if (!made) {
      console.log(`[shot] ${shot.file}: FAIL (group not created)`)
      continue
    }
    await sleep(1200)
    const views = await page.evaluate(() => window.__groupVizExport__.getAvailableViewsForExport())
    const key = pickView(views, shot.view)
    if (!key) {
      console.log(`[shot] ${shot.file}: FAIL (view ${shot.view} not available from ${JSON.stringify(views)})`)
      continue
    }
    await page.evaluate((v) => window.__groupVizExport__._setView(v), key)
    await sleep(key === '3d' ? 3500 : 1800)
    await page.evaluate(() => window.__groupVizExport__.hideOverlays())
    await sleep(150)
    await viewport.screenshot({ path: resolve(OUT, shot.file) })
    await page.evaluate(() => window.__groupVizExport__.showOverlays())
    console.log(`[shot] ${shot.file}: OK (${key})`)
    ok++
  }

  for (const gif of GIFS) {
    const made = await page.evaluate((sym) => {
      const b = window.__groupVizExport__
      const g = b.createGroupFromSymbol(sym)
      if (!g) return false
      b._setGroup(g)
      return true
    }, gif.group)
    if (!made) {
      console.log(`[gif] ${gif.file}: FAIL (group not created)`)
      continue
    }
    await sleep(1200)
    const views = await page.evaluate(() => window.__groupVizExport__.getAvailableViewsForExport())
    const key = pickView(views, gif.view)
    if (!key) {
      console.log(`[gif] ${gif.file}: FAIL (view ${gif.view} not available)`)
      continue
    }
    await page.evaluate((v) => window.__groupVizExport__._setView(v), key)
    await sleep(gif.view === '3d' ? 3500 : 1800)

    if (gif.view === 'symmetry' && gif.element) {
      const base64 = await page.evaluate(async ({ el }) => {
        return await window.__groupVizExport__.recordGIF(el, 3000)
      }, { el: gif.element })
      if (!base64) {
        console.log(`[gif] ${gif.file}: FAIL (recordGIF)`)
        continue
      }
      writeFileSync(resolve(OUT, gif.file), Buffer.from(base64, 'base64'))
      console.log(`[gif] ${gif.file}: OK (recordGIF elemid=${gif.element})`)
    } else if (gif.view === '3d') {
      const dlPromise = page.waitForEvent('download', { timeout: 30000 })
      const btn = page.getByRole('button', { name: /导出 GIF|Export GIF/i })
      await btn.click()
      const dl = await dlPromise
      await dl.saveAs(resolve(OUT, gif.file))
      console.log(`[gif] ${gif.file}: OK (view-panel GIF button)`)
    } else {
      console.log(`[gif] ${gif.file}: FAIL (no strategy)`)
      continue
    }
    ok++
  }

  await browser.close()
  console.log(`\nDone. OK: ${ok}/${SHOTS.length + GIFS.length}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
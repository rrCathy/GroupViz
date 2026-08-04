import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.GV_BASE_URL || 'http://localhost:5173'
const OUTPUT_DIR = resolve(process.cwd(), 'exports', `batch-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)

const GROUPS = [
  { symbol: 'C_{20}', label: 'C20' },
  { symbol: 'D_{4}', label: 'D4' },
  { symbol: 'S_{3}', label: 'S3' },
  { symbol: 'S_{4}', label: 'S4' },
  { symbol: 'A_{4}', label: 'A4' },
  { symbol: 'A_{5}', label: 'A5' },
  { symbol: 'Z_{3}\\times Z_{4}', label: 'Z3xZ4' },
  { symbol: 'Z_{3}\\times S_{3}', label: 'Z3xS3' },
  { symbol: 'S_{3}\\times S_{3}', label: 'S3xS3' },
]

const SYMMETRY_ELEMENTS = {
  'C20': ['1', '3'],
  'D4':  ['0', '1', '4'],
  'S3':  ['0', '1', '4'],
  'S4':  ['0', '1', '5'],
  'A4':  ['0', '2', '4'],
  'A5':  ['0', '3', '5'],
}

const VIEW_LABEL = { set: 'Set', cayley: 'Cayley2D', cycle: 'Cycle', table: 'Table', '3d': 'Cayley3D', symmetry: 'Symmetry', sublattice: 'Lattice' }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function safePath(text) {
  return text.replace(/[<>:"/\\|?*]/g, '_')
}

async function bootstrapApp(page) {
  console.log('Navigating to app...')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  const enterBtn = page.getByRole('button', { name: /进入应用|enter|Enter/i })
  if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enterBtn.click()
    await sleep(1000)
  }

  // Wait until the export bridge is registered by React
  console.log('Waiting for export bridge...')
  await page.evaluate(async () => {
    const api = window.__groupVizExport__
    if (!api) throw new Error('Export bridge not found on window')
    await api.waitReady()
  })
  console.log('App loaded.\n')
}

async function listMode(page) {
  console.log('GroupViz Export Inventory')
  console.log('='.repeat(60))
  console.log()

  for (const group of GROUPS) {
    const result = await page.evaluate((sym) => {
      const api = window.__groupVizExport__
      if (!api) return null
      const g = api.createGroupFromSymbol(sym)
      if (!g) return null
      api._setGroup(g)
      // Read group info directly from the created object (avoids React state timing issues)
      return { symbol: g.symbol, order: g.order }
    }, group.symbol)

    if (!result) {
      console.log(`${group.label}: FAIL (could not create)`)
      continue
    }

    await sleep(400)

    const { order, symbol } = result

    console.log(`┌─ ${group.label}  (${symbol}, |G| = ${order})`)

    const applicableViews = await page.evaluate(() =>
      window.__groupVizExport__.getAvailableViewsForExport()
    )

    const maxViewLen = Math.max(...applicableViews.map(v => VIEW_LABEL[v]?.length || v.length))

    for (const view of applicableViews) {
      await page.evaluate((v) => window.__groupVizExport__._setView(v), view)
      await sleep(300)

      const vLabel = VIEW_LABEL[view] || view

      if (view === 'cayley') {
        const shapes = await page.evaluate(() =>
          window.__groupVizExport__.getAvailableShapes2D()
        )
        const shapeList = shapes.join(', ')
        console.log(`│  ${vLabel.padEnd(maxViewLen)}  (${shapes.length})  ${shapeList}`)
      } else if (view === '3d') {
        const shapes = await page.evaluate(() =>
          window.__groupVizExport__.getAvailableShapes3D()
        )
        const shapeList = shapes.join(', ')
        console.log(`│  ${vLabel.padEnd(maxViewLen)}  (${shapes.length})  ${shapeList}`)
      } else if (view === 'symmetry') {
        const info = await page.evaluate(() =>
          window.__groupVizExport__.getSymmetryInfo()
        )
        if (info) {
          const shapeList = info.shapes.join(', ')
          console.log(`│  ${vLabel.padEnd(maxViewLen)}  (${info.shapes.length})  ${shapeList}`)
        } else {
          console.log(`│  ${vLabel.padEnd(maxViewLen)}  —`)
        }
      } else {
        console.log(`│  ${vLabel.padEnd(maxViewLen)}  (1)  default`)
      }
    }
    console.log()
  }

  console.log('Legend:')
  console.log('  Number in (...) = count of exportable shapes')
  console.log('  default = view has only one layout option')
}

async function exportMode(page) {
  console.log('GroupViz Batch Export')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Output:   ${OUTPUT_DIR}`)
  console.log(`  Groups:   ${GROUPS.length} (${GROUPS.map(g => g.label).join(', ')})`)
  console.log()

  mkdirSync(OUTPUT_DIR, { recursive: true })

  let total = 0, ok = 0, fail = 0

  for (const group of GROUPS) {
    const gDir = resolve(OUTPUT_DIR, safePath(group.label))
    mkdirSync(gDir, { recursive: true })

    process.stdout.write(`[${group.label}] Creating...`)

    const result = await page.evaluate((sym) => {
      const api = window.__groupVizExport__
      if (!api) return null
      const g = api.createGroupFromSymbol(sym)
      if (!g) return null
      api._setGroup(g)
      const views = api.getAvailableViewsForExport()
      return { symbol: g.symbol, order: g.order, views }
    }, group.symbol)

    if (!result) {
      console.log(` FAIL`)
      continue
    }

    await sleep(400)

    const { order, symbol, views: applicableViews } = result
    console.log(` OK (|G|=${order}), ${applicableViews.length} views`)

    for (const view of applicableViews) {
      let shapes = [null]
      let is3D = false
      let isSym = false

      if (view === 'cayley') {
        await page.evaluate((v) => window.__groupVizExport__._setView(v), view)
        await sleep(400)
        const availShapes = await page.evaluate(() =>
          window.__groupVizExport__.getAvailableShapes2D()
        )
        shapes = availShapes
      } else if (view === '3d') {
        is3D = true
        await page.evaluate((v) => window.__groupVizExport__._setView(v), view)
        await sleep(400)
        const availShapes = await page.evaluate(() =>
          window.__groupVizExport__.getAvailableShapes3D()
        )
        shapes = availShapes
      } else if (view === 'symmetry') {
        isSym = true
      }

      for (const shape of shapes) {
        total++

        await page.evaluate((v) => window.__groupVizExport__._setView(v), view)
        await sleep(300)

        if (shape) {
          if (is3D) {
            await page.evaluate((s) => {
              const api = window.__groupVizExport__
              if (api._setCayleyShape3D) api._setCayleyShape3D(s)
            }, shape)
          } else {
            await page.evaluate((s) => {
              const api = window.__groupVizExport__
              if (api._setCayleyShape2D) api._setCayleyShape2D(s)
            }, shape)
          }
          await sleep(400)
        }

        const viewLabel = shape ? `${view}_${shape}` : view
        process.stdout.write(`  ${viewLabel}...`)

        try {
          await page.evaluate(() => window.__groupVizExport__.hideOverlays())
          await sleep(100)

          if (is3D) {
            await sleep(800)
            const dataUrl = await page.evaluate(() =>
              window.__groupVizExport__.exportCanvasDataUrl()
            )
            if (dataUrl) {
              const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
              writeFileSync(resolve(gDir, `${viewLabel}.png`), buf)
              console.log(` PNG`)
            } else {
              console.log(` FAIL (no canvas)`)
              fail++
            }
          } else if (!isSym) {
            const svgContent = await page.evaluate(() =>
              window.__groupVizExport__.exportSVGContent()
            )
            if (svgContent) {
              writeFileSync(resolve(gDir, `${viewLabel}.svg`), svgContent)
              console.log(` SVG`)
            } else {
              console.log(` FAIL (no SVG)`)
              fail++
            }
          }

          await page.evaluate(() => window.__groupVizExport__.showOverlays())
          if (!is3D && !isSym) ok++

        } catch (err) {
          await page.evaluate(() => window.__groupVizExport__.showOverlays())
          console.log(` FAIL (${err.message?.slice(0, 40) || err})`)
          fail++
        }
      }

      if (isSym && SYMMETRY_ELEMENTS[group.label]) {
        const symViewDir = resolve(gDir, 'symmetry_gif')
        mkdirSync(symViewDir, { recursive: true })

        await page.evaluate((v) => window.__groupVizExport__._setView(v), 'symmetry')
        await sleep(800)

        const elements = SYMMETRY_ELEMENTS[group.label]
        for (const elemId of elements) {
          total++
          process.stdout.write(`  symmetry_gif/elem${elemId}...`)

          try {
            await page.evaluate(() => window.__groupVizExport__.hideOverlays())
            await sleep(100)

            const base64Data = await page.evaluate(async ([id]) => {
              return await window.__groupVizExport__.recordGIF(id, 3000)
            }, [elemId])

            await page.evaluate(() => window.__groupVizExport__.showOverlays())

            if (base64Data) {
              const buf = Buffer.from(base64Data, 'base64')
              writeFileSync(resolve(symViewDir, `elem${elemId}.gif`), buf)
              console.log(` GIF`)
              ok++
            } else {
              console.log(` FAIL`)
              fail++
            }
          } catch (err) {
            await page.evaluate(() => window.__groupVizExport__.showOverlays())
            console.log(` FAIL (${err.message?.slice(0, 40) || err})`)
            fail++
          }
        }
      }
    }
  }

  console.log(`\n---`)
  console.log(`Done.  OK: ${ok}  FAIL: ${fail}  TOTAL: ${total}`)
  console.log(`Output: ${OUTPUT_DIR}`)

  if (fail > 0) process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const isList = args.includes('--list')
  const headless = !args.includes('--no-headless')

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await bootstrapApp(page)

  if (isList) {
    await listMode(page)
  } else {
    await exportMode(page)
  }

  await browser.close()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

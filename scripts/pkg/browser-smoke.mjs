/**
 * 线上包浏览器实测 —— 真实 Chromium 里打开 /?test=1（VCL 控件消费矩阵），
 * 验证 SSR/组件测试覆盖不到的真渲染：共轭类着色的节点 fill、F4 标记环、
 * F3 ⟨g⟩ 高亮、E3 单色边、E4 箭头开关、E2 图例、3D 画布。
 *
 * 前置：npm run dev（5173）。用 playwright-core + 本机 ms-playwright Chromium。
 * 用法：node scripts/pkg/browser-smoke.mjs
 */
import { chromium } from 'playwright-core'
import { writeFileSync, existsSync } from 'node:fs'

/** agent-browser 的 Chromium 下载被网络白名单挡住（storage.googleapis.com）；
 *  包内自带 playwright-core，直接复用本机 ms-playwright 缓存里的 Chromium。 */
function findChromium() {
  const la = process.env.LOCALAPPDATA || ''
  const cands = [
    process.env.GV_CHROME,
    `${la}\\ms-playwright\\chromium-1124\\chrome-win\\chrome.exe`,
    `${la}\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe`,
    `${la}\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe`,
    `${la}\\Google\\Chrome\\Application\\chrome.exe`,
  ].filter(Boolean)
  return cands.find(p => existsSync(p))
}

const URL = 'http://localhost:5173/?test=1'
const log = []
const say = (s) => { console.log(s); log.push(s) }
let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) say(`  ok  ${label}${detail ? ' — ' + detail : ''}`)
  else { failures++; say(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`) }
}

/** 卡片里真正的视图 svg（带 viewBox 的那个） */
const viewSvg = (card) => card.locator('svg[viewBox]').first()

/** 节点圆 fill 列表（只取靠 circle 半径 ≥15 过滤出的节点组，避免把标记环/角标当节点） */
async function nodeFills(card) {
  return viewSvg(card).evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    const out = []
    for (const g of root?.children ?? []) {
      if (g.tagName !== 'g') continue
      const c = g.querySelector('circle')
      if (!c) continue
      if (parseFloat(c.getAttribute('r') ?? '0') < 15) continue
      out.push(c.getAttribute('fill'))
    }
    return out
  })
}

/** 带 stroke-dasharray 的圆数（F4 正规子群虚线环） */
async function dashedRingCount(card) {
  return viewSvg(card).evaluate(svg => svg.querySelectorAll('circle[stroke-dasharray]').length)
}

/** 指定描边色的圆数（F3 ⟨g⟩ 环 = #4ecdc4 → rgb(78, 205, 196)） */
async function ringCount(card, color) {
  return viewSvg(card).evaluate((svg, col) => {
    const norm = (v) => (v || '').replace(/\s+/g, '')
    return [...svg.querySelectorAll('circle')].filter(c => norm(c.getAttribute('stroke')) === norm(col)).length
  }, color)
}

/** 边 path（含 Q 的曲线）的 stroke + 是否有箭头 */
async function edgeInfo(card) {
  return viewSvg(card).evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    const paths = [...(root?.children ?? [])].filter(el => el.tagName === 'path')
      .filter(p => (p.getAttribute('d') || '').includes('Q'))
    return paths.map(p => ({ stroke: p.getAttribute('stroke'), marker: p.hasAttribute('marker-end') }))
  })
}

async function hasLegend(card) {
  return viewSvg(card).evaluate(svg =>
    [...svg.querySelectorAll('text')].some(t => (t.textContent || '').trim() === 'Generators'))
}

/** 读 CayleyView 节点位置（用于点选 F3） */
async function readCayleyLayout(card) {
  return viewSvg(card).evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    const tm = (root?.getAttribute('transform') || '').match(
      /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\)\s*scale\(\s*(-?[\d.]+)/)
    const transform = tm ? { x: +tm[1], y: +tm[2], scale: +tm[3] } : { x: 0, y: 0, scale: 1 }
    const pos = [...(root?.children ?? [])]
      .filter(el => el.tagName === 'g')
      .map(g => {
        const c = g.querySelector('circle')
        if (!c || parseFloat(c.getAttribute('r') ?? '0') < 15) return null
        const m = (g.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/)
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
      })
      .filter(Boolean)
    const vbAttr = svg.getAttribute('viewBox') || '0 0 860 520'
    const [, , vbw, vbh] = vbAttr.split(/\s+/).map(Number)
    return { pos, transform, viewBox: { w: vbw, h: vbh } }
  })
}

function userToScreen(svgBox, viewBox, transform, p) {
  const scale = Math.min(svgBox.width / viewBox.w, svgBox.height / viewBox.h)
  const padX = (svgBox.width - viewBox.w * scale) / 2
  const padY = (svgBox.height - viewBox.h * scale) / 2
  return {
    x: svgBox.x + padX + (transform.x + p.x * transform.scale) * scale,
    y: svgBox.y + padY + (transform.y + p.y * transform.scale) * scale,
  }
}

const exe = findChromium()
if (!exe) {
  console.error('找不到本机 Chromium（设 GV_CHROME 指向 chrome.exe）')
  process.exit(1)
}
const browser = await chromium.launch({ executablePath: exe })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // ---------- 0. 页头 + 三卡存在 ----------
  const groupLabel = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('群已载入（默认 S₄）', !groupLabel.includes('未载入') && /24/.test(groupLabel), groupLabel.trim())
  for (const id of ['pkg-cayley-f', 'pkg-cayley-e', 'pkg-cayley3d-f']) {
    check(`卡片存在 ${id}`, await page.locator(`[data-testid="${id}"]`).count() === 1)
  }

  // ---------- 1. F1 共轭类着色 ----------
  const cardF = page.locator('[data-testid="pkg-cayley-f"]')
  const fills = await nodeFills(cardF)
  const hsl = new Set(fills.filter(f => /^hsl\(/.test(f || '')))
  check('F1 共轭类着色：节点 fill 为 hsl 且 ≥3 种（S₄ 有 5 类）', hsl.size >= 3,
    `${fills.length} 节点 / ${hsl.size} 种 hsl 色`)

  // 切回 Theme 应恢复主题填充
  await page.locator('[data-testid="pkg-cf-color"] button', { hasText: 'Theme' }).click()
  await page.waitForTimeout(300)
  const themeFills = new Set((await nodeFills(cardF)).filter(f => /^hsl\(/.test(f || '')))
  check('F1 关闭后无 hsl 填充', themeFills.size === 0, `${themeFills.size} 种 hsl`)
  await page.locator('[data-testid="pkg-cf-color"] button', { hasText: 'Conjugacy' }).click()
  await page.waitForTimeout(200)

  // ---------- 2. F4 正规子群虚线环 ----------
  const dash0 = await dashedRingCount(cardF)
  await page.locator('[data-testid="pkg-cf-normal"] input').click()
  await page.waitForTimeout(300)
  const dash1 = await dashedRingCount(cardF)
  check('F4 markNormalSubgroup：S₄ 最小正规子群 V₄ → +4 虚线环', dash1 - dash0 === 4,
    `${dash0} → ${dash1}（+${dash1 - dash0}）`)

  // F4 中心：S₄ 中心 = {e} → +2 圆（双环）
  const circlesBefore = await viewSvg(cardF).evaluate(svg => svg.querySelectorAll('circle').length)
  await page.locator('[data-testid="pkg-cf-center"] input').click()
  await page.waitForTimeout(300)
  const circlesAfter = await viewSvg(cardF).evaluate(svg => svg.querySelectorAll('circle').length)
  check('F4 markCenter：S₄ 中心 {e} → +2 圆', circlesAfter - circlesBefore === 2,
    `${circlesBefore} → ${circlesAfter}（+${circlesAfter - circlesBefore}）`)

  // ---------- 3. F3 ⟨g⟩ 高亮（点节点选中） ----------
  const layout = await readCayleyLayout(cardF)
  if (layout.pos.length > 0) {
    const svgBox = await viewSvg(cardF).boundingBox()
    const center = { x: layout.viewBox.w / 2, y: layout.viewBox.h / 2 }
    const t = layout.pos.reduce((best, p) =>
      Math.hypot(p.x - center.x, p.y - center.y) > Math.hypot(best.x - center.x, best.y - center.y) ? p : best, layout.pos[0])
    const s = userToScreen(svgBox, layout.viewBox, layout.transform, t)
    await page.mouse.click(s.x, s.y)
    // 移开鼠标消除 hover 环，只留 ⟨g⟩ 环
    await page.mouse.move(svgBox.x + 5, svgBox.y + 5)
    await page.waitForTimeout(400)
    // SVG 表现属性不归一化：getAttribute('stroke') 返回字面量（#4ecdc4 / #ffd93d）
    const selected = await ringCount(cardF, '#ffd93d')
    const gen = await ringCount(cardF, '#4ecdc4')
    check('F3 highlightGenerated：点选节点（金环）+ ⟨g⟩ 青环', selected >= 1 && gen >= 1,
      `选中金环 ${selected} / ⟨g⟩ 青环 ${gen}`)
  } else {
    check('F3 highlightGenerated：找到节点', false, '无节点可点')
  }

  // ---------- 4. E3 printPalette 单色边 ----------
  const cardE = page.locator('[data-testid="pkg-cayley-e"]')
  const e0 = await edgeInfo(cardE)
  const distinct0 = new Set(e0.map(e => e.stroke))
  await page.locator('[data-testid="pkg-ce-print"] input').click()
  await page.waitForTimeout(300)
  const e1 = await edgeInfo(cardE)
  const distinct1 = new Set(e1.map(e => e.stroke))
  check('E3 printPalette：边由多色收敛为单色', e0.length > 0 && distinct0.size > 1 && distinct1.size === 1,
    `${e0.length} 边 · ${distinct0.size} 色 → ${distinct1.size} 色（${[...distinct1][0]}）`)

  // E2 图例默认开
  check('E2 showLegend：图例 overlay 存在（text=Generators）', await hasLegend(cardE))

  // E4 箭头开关
  const arrowsOn = e1.some(e => e.marker)
  await page.locator('[data-testid="pkg-ce-arrows"] input').click()
  await page.waitForTimeout(250)
  const e2 = await edgeInfo(cardE)
  const arrowsOff = e2.every(e => !e.marker)
  check('E4 showArrows：默认有箭头、关掉后无 marker-end', arrowsOn && arrowsOff,
    `on=${arrowsOn} / off=${arrowsOff}`)

  await page.screenshot({ path: 'browser-vcl-2d.png' })

  // ---------- 5. 3D（B 组 + F 组） ----------
  const card3d = page.locator('[data-testid="pkg-cayley3d-f"]')
  const canvases = await card3d.locator('canvas').count()
  check('3D 画布存在', canvases > 0, `${canvases} 个 canvas`)
  // B1 shell / B2 rings / B3 relayout：切换不报错（几何在 WebGL，不做像素断言）
  await page.locator('[data-testid="pkg-c3-shell"] input').click()
  await page.locator('[data-testid="pkg-c3-rings"] input').click()
  await page.locator('[data-testid="pkg-c3-relayout"]').click()
  await page.locator('[data-testid="pkg-c3-color"] button', { hasText: 'Theme' }).click()
  await page.waitForTimeout(1200)
  check('B1/B2/B3 与 F1 控件切换后无 error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean')

  // S₄ 多面体形状：必须套用「形状专属」生成元集（否则边横跨整个多面体 → 乱）
  for (const shp of ['truncatedCube', 'torusHex']) {
    await page.locator('[data-testid="pkg-c3-layout"]').selectOption(shp)
    await page.waitForTimeout(800)
    const t = await card3d.innerText()
    check(`S₄ ${shp} 套用形状专属作用边`, /形状专属/.test(t),
      (t.match(/作用边 = [^：\n]+/) || [''])[0].trim().slice(0, 40))
  }
  await page.screenshot({ path: 'browser-vcl-3d.png' })

  // ---------- 6. 页面自检 ----------
  const errPanel = await page.locator('[data-testid="pkg-errors"]').innerText()
  check('页面 runtime error 面板 ✓', /无未捕获/.test(errPanel), errPanel.trim().slice(0, 60))
  check('全程无 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean')
} catch (e) {
  failures++
  say(`  FAIL  脚本异常：${e.message}`)
} finally {
  await browser.close()
  writeFileSync('browser-smoke-log.txt', log.join('\n'), 'utf8')
  say(failures === 0 ? '\n✅ 浏览器实测全部通过' : `\n✗ ${failures} 项失败`)
  process.exitCode = failures > 0 ? 1 : 0
}

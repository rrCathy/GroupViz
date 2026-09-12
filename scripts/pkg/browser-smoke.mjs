/**
 * 线上包浏览器实测 —— 真实 Chromium 里点 TestPage 的四个 VCL 示例，验证
 * SSR 证明不了的交互（力导向拖拽、路径高亮、3D 字长球、直边）。
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
    `${la}\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe`,
    `${la}\\ms-playwright\\chromium-1124\\chrome-win\\chrome.exe`,
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

/**
 * 读 CayleyView 里「节点组」的位置：节点是 <g transform="translate(x, y)"><circle r=..></g>。
 * 返回 { pos, transform } —— transform 为包裹组的 CT（translate(40,40) scale(1)）。
 * 注意：节点组本身也是 <g transform^="translate">，靠 circle 半径 + 只取**直接子节点**
 * 过滤，避免把节点组当成包裹组。
 */
async function readCayleyLayout(card) {
  // 卡片里可能有多个 svg（控件区的图标等），真正的视图 svg 是带 viewBox 的那个
  return card.locator('svg[viewBox]').first().evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    const tm = (root?.getAttribute('transform') || '').match(
      /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\)\s*scale\(\s*(-?[\d.]+)/)
    const transform = tm ? { x: +tm[1], y: +tm[2], scale: +tm[3] } : { x: 0, y: 0, scale: 1 }
    const pos = [...(root?.children ?? [])]
      .filter(el => el.tagName === 'g')
      .map(g => {
        const c = g.querySelector('circle')
        if (!c) return null
        if (parseFloat(c.getAttribute('r') ?? '0') < 15) return null
        const m = (g.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/)
        if (!m) return null
        return { x: parseFloat(m[1]), y: parseFloat(m[2]) }
      })
      .filter(Boolean)
    const vbAttr = svg.getAttribute('viewBox') || '0 0 860 520'
    const [, , vbw, vbh] = vbAttr.split(/\s+/).map(Number)
    return { pos, transform, viewBox: { w: vbw, h: vbh } }
  })
}

/**
 * viewBox 用户单位 → 浏览器视口坐标。svg 默认 preserveAspectRatio="xMidYMid meet"：
 * 等比缩放 + 居中，两侧留白。算错会让鼠标落在空处（拖拽测不到）。
 */
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // ---------- 0 ----------
  const demoBtns = await page.locator('[data-testid="pkg-vcl-demos"] button').count()
  check('VCL 示例按钮组', demoBtns === 4, `${demoBtns} 个`)
  const groupLabel0 = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('群已载入', !groupLabel0.includes('未载入'), groupLabel0.trim())

  // ---------- 1. D7 力导向：拖拽跟手 ----------
  await page.locator('[data-testid="pkg-demo-d7-force"]').click()
  await page.waitForTimeout(2500)
  const d7Label = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('D7 力导向示例已切群', /D/.test(d7Label), d7Label.trim())

  const card = page.locator('[data-testid="pkg-cayley"]')
  const layout0 = await readCayleyLayout(card)
  const pos0 = layout0.pos
  check('D7 画布渲染节点', pos0.length > 0, `${pos0.length} 个节点`)

  if (pos0.length > 0) {
    const svgBox = await card.locator('svg[viewBox]').first().boundingBox()
    const { viewBox, transform } = layout0
    // 选「离画布中心最远」的节点拖：中心节点容易被邻居压住，命中率低
    const center = { x: viewBox.w / 2, y: viewBox.h / 2 }
    const t = pos0.reduce((best, p) =>
      Math.hypot(p.x - center.x, p.y - center.y) > Math.hypot(best.x - center.x, best.y - center.y) ? p : best,
      pos0[0])
    const tIdx = pos0.indexOf(t)
    const s = userToScreen(svgBox, viewBox, transform, t)

    const DX = 120, DY = 60
    await page.mouse.move(s.x, s.y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(s.x + (DX * i) / 12, s.y + (DY * i) / 12)
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(150)
    const during = (await readCayleyLayout(card)).pos
    await page.mouse.up()
    await page.waitForTimeout(1500)
    const after = (await readCayleyLayout(card)).pos

    const gotX = during[tIdx].x - t.x
    const gotY = during[tIdx].y - t.y
    // 量纲换算：鼠标位移是 CSS px，节点位移是 viewBox 用户单位。
    // viewBox 860×520 装进 488×295 的 svg 时 fit=0.568（1 用户单位 = 0.568 px），
    // 反过来 1 px = 1/fit = 1.76 用户单位。引擎内部 scaleX = vb/rect 已是这个方向，
    // 所以期望位移 = 鼠标 px / fit（不是 × fit —— 之前写反了，才会算出 3.10 的假比例）。
    const fit = Math.min(svgBox.width / viewBox.w, svgBox.height / viewBox.h)
    const expect = Math.hypot(DX, DY) / fit
    const ratio = Math.hypot(gotX, gotY) / expect
    say(`       [drag] svgBox=${svgBox.width.toFixed(1)}x${svgBox.height.toFixed(1)} vb=${viewBox.w}x${viewBox.h} fit=${fit.toFixed(3)} scale=${transform.scale}`)
    check('拖拽跟手（位移比 0.6–1.4）', ratio > 0.6 && ratio < 1.4,
      `鼠标 ${DX},${DY}px(→${expect.toFixed(0)} 用户单位) → 节点 ${gotX.toFixed(0)},${gotY.toFixed(0)}（比 ${ratio.toFixed(2)}）`)

    // 漂移阈值统一换算成用户单位（30px 屏幕 ≈ 30/fit 用户单位）
    const drift = Math.hypot(after[tIdx].x - during[tIdx].x, after[tIdx].y - during[tIdx].y)
    check('松手后基本停住（漂移 < 30px）', drift < 30 / fit,
      `漂移 ${drift.toFixed(1)} 用户单位（≈${(drift * fit).toFixed(1)}px）`)

    // 局部性：远端节点不应被大幅拖动（< 40% 拖拽量）
    const farIdx = pos0.map((p, i) => ({ i, d: Math.hypot(p.x - t.x, p.y - t.y) }))
      .sort((a, b) => b.d - a.d)[0].i
    const farDisp = Math.hypot(after[farIdx].x - pos0[farIdx].x, after[farIdx].y - pos0[farIdx].y)
    check('局部性：最远节点位移 < 40% 拖拽量', farDisp < expect * 0.4,
      `最远节点 ${farDisp.toFixed(1)} 用户单位 / 拖拽 ${expect.toFixed(0)} 用户单位`)
  }
  await page.screenshot({ path: 'browser-d7-force.png' })

  // ---------- 2. S4 字长球 + 哈密顿路径 ----------
  await page.locator('[data-testid="pkg-demo-s4-ham"]').click()
  await page.waitForTimeout(4000)
  const s4Label = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('S4 字长球示例已切群', /S/.test(s4Label) && /24/.test(s4Label), s4Label.trim())
  const canvases = await page.locator('canvas').count()
  check('3D 画布存在', canvases > 0, `${canvases} 个 canvas`)
  const hamTitle = await page.locator('[data-testid="pkg-3d-hamiltonian"]').getAttribute('title').catch(() => '')
  check('哈密顿路径按钮已算出路', /覆盖全部 24/.test(hamTitle || ''), hamTitle || '(无 title)')
  const pathVal = await page.locator('[data-testid="pkg-3d-path"]').inputValue().catch(() => '')
  check('哈密顿 word 已填入路径框', pathVal.trim().length > 0, pathVal.slice(0, 50))
  await page.screenshot({ path: 'browser-s4-wordlength.png' })

  // ---------- 3. S3 直边 ----------
  await page.locator('[data-testid="pkg-demo-s3-curve"]').click()
  await page.waitForTimeout(2000)
  const s3Label = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('S3 示例已切群', /S/.test(s3Label) && /6/.test(s3Label), s3Label.trim())
  const curv = await page.locator('[data-testid="pkg-cayley-curvature"]').inputValue()
  check('曲率滑杆为 0（Straight）', Number(curv) === 0, `curvature=${curv}`)
  // 边恒为 <path>（引擎不产出 <line>）；笔直 = Q 控制点落在弦中点（共线）。
  // 注意排除 <defs> 里的箭头 marker 子路径（d="M0,0 L0,6 L9,3 z"）。
  const cardS3 = page.locator('[data-testid="pkg-cayley"]')
  const edgeGeom = await cardS3.locator('svg[viewBox]').first().evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    const paths = [...(root?.children ?? [])].filter(el => el.tagName === 'path')
    return paths.map(p => p.getAttribute('d') || '').filter(d => d.includes('Q'))
  })
  let maxDev = 0
  for (const d of edgeGeom) {
    const m = d.match(/^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+Q\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/)
    if (!m) continue
    const [, x0, y0, cx1, cy1, x1, y1] = m.map(Number)
    maxDev = Math.max(maxDev, Math.hypot(cx1 - (x0 + x1) / 2, cy1 - (y0 + y1) / 2))
  }
  check('S3 笔直模式边共线（控制点在中点，偏差 < 0.5）', edgeGeom.length > 0 && maxDev < 0.5,
    `${edgeGeom.length} 条 Q 边 / 最大控制点偏差 ${maxDev.toFixed(3)}`)
  await page.screenshot({ path: 'browser-s3-straight.png' })

  // ---------- 4. A4 逐生成元边长 ----------
  await page.locator('[data-testid="pkg-demo-a4-len"]').click()
  await page.waitForTimeout(4000)
  const a4Label = await page.locator('[data-testid="pkg-group-label"]').innerText()
  check('A4 示例已切群', /A/.test(a4Label) && /12/.test(a4Label), a4Label.trim())
  const len0 = await page.locator('[data-testid="pkg-3d-len-0"]').inputValue().catch(() => '')
  check('逐生成元 len 滑杆已设非 1', Number(len0) !== 1, `len0=${len0}`)
  await page.screenshot({ path: 'browser-a4-len.png' })

  // ---------- 5. 页面自检 ----------
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

/**
 * 线上包浏览器实测 —— 真实 Chromium 里打开 /?test=1（VCL 全量消费矩阵），
 * 验证 SSR/组件测试覆盖不到的真渲染：
 *   批次一 边几何（edgeCurvature 笔直/弧、lengthScale 重排）· 路径高亮 · 动态力导向
 *   批次二 共轭类着色节点 fill、F4 标记环、F3 ⟨g⟩ 高亮、E3 单色边、E4 箭头、E2 图例、3D 画布
 *   批次三 Decorations 注释（三锚点渲染 / 开关 / 失效引用静默 / 拖拽跟随）
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
  for (const id of ['pkg-cayley-f', 'pkg-cayley-e', 'pkg-cayley3d-f',
                    'pkg-cayley-geo', 'pkg-cayley-path', 'pkg-cayley-force', 'pkg-cayley-dec']) {
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
    // 页面扩到 7 卡后 F 卡会落到视口下方，而 mouse.click 用的是**视口坐标** ⇒ 必须先滚动到可见，
    // 否则点击落在视口外、什么都选不中（2026-09-28 实测踩到：金环/青环均为 0）。
    await viewSvg(cardF).scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
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

  // ---------- 5.5 批次一（09-11 / 09-12）：边几何 · 路径高亮 · 动态力导向 ----------
  /**
   * 边弧「控制点相对弦中点的最大偏差」（px）。
   * 注意：`edgeCurvature === 0` 时边**仍然是 Q 弧**，只是控制点落在弦上（偏差 0）——
   * 所以判「是否笔直」必须量偏差，不能看 d 里有没有 'Q'（2026-09-28 实测踩到）。
   */
  const ctlDeviation = (card) => viewSvg(card).evaluate(svg => {
    const root = svg.querySelector(':scope > g[transform]')
    let max = 0
    for (const p of [...(root?.children ?? [])]) {
      if (p.tagName !== 'path') continue
      const m = (p.getAttribute('d') || '').match(
        /M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*Q\s*(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)/)
      if (!m) continue
      const [, x1, y1, cx, cy, x2, y2] = m.map(Number)
      max = Math.max(max, Math.hypot(cx - (x1 + x2) / 2, cy - (y1 + y2) / 2))
    }
    return max
  })
  /** 金色高亮线段数 —— 路径高亮渲染成 `<line>`（不是 path），缺省色 #ffd93d */
  const goldLineCount = (card) => viewSvg(card).evaluate(svg => {
    const norm = (v) => (v || '').toLowerCase().replace(/\s+/g, '')
    return [...svg.querySelectorAll('line')].filter(l => norm(l.getAttribute('stroke')).includes('ffd93d')).length
  })

  // ---- 边几何：edgeCurvature 0 = 笔直（控制点落弦上） ----
  const cardGeo = page.locator('[data-testid="pkg-cayley-geo"]')
  const geoDev0 = await ctlDeviation(cardGeo)
  await page.locator('[data-testid="pkg-cg-curv"]').press('Home')   // → 0
  await page.waitForTimeout(300)
  const geoDevFlat = await ctlDeviation(cardGeo)
  await page.locator('[data-testid="pkg-cg-curv"]').press('End')    // → 2
  await page.waitForTimeout(300)
  const geoDev2 = await ctlDeviation(cardGeo)
  check('edgeCurvature：缺省有弧 → 0 控制点落弦上（真笔直）→ 2 偏差变大',
    geoDev0 > 1 && geoDevFlat < 0.5 && geoDev2 > geoDev0,
    `控制点偏差 缺省 ${geoDev0.toFixed(2)} → 0 时 ${geoDevFlat.toFixed(2)} → 2 时 ${geoDev2.toFixed(2)}`)

  // ---- 边几何：逐生成元 lengthScale 触发几何重排（节点位置改变） ----
  await page.locator('[data-testid="pkg-cg-curv"]').press('Home')   // 笔直，消除弧带来的坐标噪声
  await page.waitForTimeout(200)
  const geoPosA = (await readCayleyLayout(cardGeo)).pos
  await page.locator('[data-testid^="pkg-cg-len-"]').first().press('End')  // → 3×
  await page.waitForTimeout(500)
  const geoPosB = (await readCayleyLayout(cardGeo)).pos
  const geoMoved = geoPosA.filter((p, i) => geoPosB[i] && Math.hypot(p.x - geoPosB[i].x, p.y - geoPosB[i].y) > 1).length
  check('lengthScale：单一生成元拉到 3× 后节点重排', geoMoved > 0, `${geoMoved}/${geoPosA.length} 节点位移 > 1px`)
  await page.locator('[data-testid="pkg-cg-reset"]').click()
  await page.waitForTimeout(300)

  // ---- 路径高亮：金色线段存在且随步数增加 ----
  const cardPath = page.locator('[data-testid="pkg-cayley-path"]')
  const path4 = await goldLineCount(cardPath)
  await page.locator('[data-testid="pkg-cp-steps"]').press('End')   // → 10 步
  await page.waitForTimeout(500)
  const path10 = await goldLineCount(cardPath)
  check('pathHighlight：金色高亮线段存在且随步数增加', path4 > 0 && path10 > path4,
    `4 步 ${path4} 段 → 10 步 ${path10} 段`)

  // ---- 动态力导向：开启 + 调参后布局真的在动 ----
  // 注意：缺省参数下 per-edge rest 的力平衡态 ≈ 静态布局本身 ⇒ settle 后位移为 0（设计如此，
  // 不是失效）。因此必须先调一个参数再量位移。
  const cardForce = page.locator('[data-testid="pkg-cayley-force"]')
  const forceA = (await readCayleyLayout(cardForce)).pos
  await page.locator('[data-testid="pkg-cf2-on"] input').click()
  await page.waitForTimeout(400)
  await page.locator('[data-testid="pkg-cf2-rep"]').press('End')   // repulsion → 3
  await page.waitForTimeout(1000)
  const forceB = (await readCayleyLayout(cardForce)).pos
  const forceShift = Math.max(...forceA.map((p, i) => forceB[i] ? Math.hypot(p.x - forceB[i].x, p.y - forceB[i].y) : 0))
  check('forceDirected：开启 + repulsion=3 后节点重排', forceShift > 1, `最大位移 ${forceShift.toFixed(1)}px`)
  await page.locator('[data-testid="pkg-cf2-settle"]').click()
  await page.waitForTimeout(1200)
  check('force ⟳ Re-settle 后无 error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean')

  // ---------- 5.6 批次三（09-24）：Decorations 注释 ----------
  /**
   * 按节点标签定位节点的**屏幕坐标**（用于精确点击/拖拽某个已知元素）。
   * 节点 `<g>` 的 translate 是相对内容层 origin 的坐标（origin 在容器 `<g>` 的 translate 里），
   * 故两者要一起算；标签取 `g.textContent`——KaTeX 会把同一标签重复渲染多次（单位元 'e' 读出 'eee'），
   * 所以用正则匹配而非全等。
   */
  const nodeScreenPos = async (card, labelRe) => {
    const svgEl = viewSvg(card)
    const info = await svgEl.evaluate((s, src) => {
      const re = new RegExp(src)
      const rootG = s.querySelector(':scope > g')
      const rm = (rootG?.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\)/)
      const vb = (s.getAttribute('viewBox') || '0 0 860 520').split(/\s+/).map(Number)
      for (const g of [...(rootG?.children ?? [])]) {
        const c = g.querySelector?.('circle')
        if (!c || parseFloat(c.getAttribute('r') ?? '0') < 15) continue
        if (!re.test((g.textContent || '').trim())) continue
        const m = (g.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/)
        if (!m) continue
        return { x: +m[1], y: +m[2], rootX: rm ? +rm[1] : 0, rootY: rm ? +rm[2] : 0, vbw: vb[2], vbh: vb[3] }
      }
      return null
    }, labelRe.source)
    if (!info) return null
    const box = await svgEl.boundingBox()
    const sc = Math.min(box.width / info.vbw, box.height / info.vbh)
    return {
      x: box.x + (box.width - info.vbw * sc) / 2 + (info.rootX + info.x) * sc,
      y: box.y + (box.height - info.vbh * sc) / 2 + (info.rootY + info.y) * sc,
    }
  }
  /** 从某点分步拖拽（每步隔一帧，避开 rAF 节流合并） */
  const dragFrom = async (x, y, dx, dy, steps = 8) => {
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps)
      await page.waitForTimeout(30)
    }
    await page.mouse.up()
    await page.waitForTimeout(500)
  }

  const cardDec = page.locator('[data-testid="pkg-cayley-dec"]')
  const annCount = () => cardDec.locator('[data-testid^="annotation-"]').count()
  const decAll = await annCount()
  check('DEC 三种锚点各一条（node / edge / figure）', decAll === 3, `${decAll} 条注释`)

  await page.locator('[data-testid="pkg-cd-node"] input').click()
  await page.waitForTimeout(250)
  const decNoNode = await annCount()
  check('关掉 node 锚点 → 少一条', decNoNode === decAll - 1, `${decAll} → ${decNoNode}`)

  await page.locator('[data-testid="pkg-cd-broken"] input').click()
  await page.waitForTimeout(250)
  const decBroken = await annCount()
  check('注入失效引用 → 静默跳过（不新增、不报错）', decBroken === decNoNode && errors.length === 0,
    `${decNoNode} → ${decBroken} · errors=${errors.length}`)
  await page.locator('[data-testid="pkg-cd-broken"] input').click()   // 关掉注入
  await page.locator('[data-testid="pkg-cd-node"] input').click()     // 恢复 node 锚点
  await page.waitForTimeout(250)

  // ---- 拖节点 → 注释跟随（DEC-2 核心验收点）----
  // 用「预设 node 锚点注释挂在单位元上」这条来验：按标签精确定位单位元再拖它。
  // 【顺序坑】这一段必须放在「+ 添加」之前——点那个按钮会让浏览器滚动页面，
  // 先算好的屏幕坐标随即作废，mouse.down 落到别处（2026-09-28 实测踩到）。
  await viewSvg(cardDec).scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  const identPos = await nodeScreenPos(cardDec, /^e+$/)
  if (identPos) {
    const y0 = await cardDec.locator('[data-testid="annotation-dec-node"] foreignObject').getAttribute('y')
    await dragFrom(identPos.x, identPos.y, -64, -40)
    const y1 = await cardDec.locator('[data-testid="annotation-dec-node"] foreignObject').getAttribute('y')
    check('拖拽节点 → 该节点上的注释跟随位移', Math.abs(parseFloat(y1) - parseFloat(y0)) > 20,
      `注释 y ${y0} → ${y1}（节点拖 -64/-40 屏幕 px）`)
  } else {
    check('DEC 拖拽跟随：定位单位元节点', false, '未找到 label 形如 e 的节点')
  }

  // ---- 选中节点 →「+ 添加」把注释挂到选中元素（放最后：按钮点击会滚动页面）----
  const decLayout = await readCayleyLayout(cardDec)
  if (decLayout.pos.length > 0) {
    const decBox = await viewSvg(cardDec).boundingBox()
    const c = { x: decLayout.viewBox.w / 2, y: decLayout.viewBox.h / 2 }
    const far = decLayout.pos.reduce((best, p) =>
      Math.hypot(p.x - c.x, p.y - c.y) > Math.hypot(best.x - c.x, best.y - c.y) ? p : best, decLayout.pos[0])
    const s = userToScreen(decBox, decLayout.viewBox, decLayout.transform, far)
    await page.mouse.click(s.x, s.y)
    await page.waitForTimeout(300)
    await page.locator('[data-testid="pkg-cd-add"]').click()
    await page.waitForTimeout(400)
    const decAdded = await annCount()
    check('「+ 添加」把注释挂到选中元素', decAdded === decAll + 1, `${decAll} → ${decAdded}`)
  }
  await page.screenshot({ path: 'browser-vcl-decorations.png' })

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

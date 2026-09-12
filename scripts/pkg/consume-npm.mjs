/**
 * 线上 npm 包消费测试 —— 从 registry 真实安装 @groupviz/core + @groupviz/react@2.2.0。
 *
 * 与 publish-smoke.mjs 的区别：那个测本地 dist-pkg 的 tarball（发布前），
 * 本脚本测 registry 上的实际发布产物（发布后），即消费者 `npm i` 拿到的东西。
 *
 * 三段：
 *   a. core  —— 字长球 API（wordLengthSphereActions / wordLengthSphereLayout3D /
 *              wordLengthOf / wordLengthColor）+ 6 群 round-trip + relaxEdgeLengths3D
 *   b. react —— SSR renderToStaticMarkup <I18nProvider><CayleyView/></I18nProvider>
 *              （含 900×360 宽扁 viewBox 节点不出画布的回归）
 *   c. types —— 消费端 tsc --noEmit 验证 exports types 解析（含新 props）
 *
 * 用法：npm run consume:registry [-- 2.2.0] [--keep]
 *   需**非沙箱**运行（npm install 子进程在沙箱内会静默 exit 1）。
 *   --keep 保留临时目录便于手工排查。
 */
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VERSION = process.argv[2] ?? '2.2.0'
const KEEP = process.argv.includes('--keep')

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts })

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

const tmp = mkdtempSync(path.join(os.tmpdir(), 'gv-npm-consume-'))
console.log(`[npm-consume] 临时目录 ${tmp}`)

let failures = 0
const check = (label, fn) => {
  try {
    fn()
    console.log(green(`  ok  ${label}`))
  } catch (e) {
    failures++
    console.error(red(`  FAIL  ${label}\n        ${e.message.split('\n')[0]}`))
  }
}

try {
  // ---- 1. 建 consumer 工程并安装线上包 ----
  // peer 钉死宿主已解析版本，避免 npm 浮动到 react@19.3 触发 ERESOLVE
  const hostPeer = (name) => {
    try {
      const p = path.join(process.cwd(), 'node_modules', name, 'package.json')
      return JSON.parse(readFileSync(p, 'utf8')).version
    } catch { return undefined }
  }
  const deps = {
    '@groupviz/core': VERSION,
    '@groupviz/react': VERSION,
  }
  for (const name of ['react', 'react-dom', 'three']) {
    const v = hostPeer(name)
    if (v) deps[name] = v
  }

  writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    name: 'gv-npm-consumer', private: true, type: 'module', version: '0.0.0',
    dependencies: deps,
  }, null, 2))

  console.log(`[npm-consume] npm install（registry 真实下载 @${VERSION}）…`)
  run('npm install --no-audit --no-fund --loglevel=error', { cwd: tmp, timeout: 900000 })
  console.log(green('[npm-consume] ✓ install 成功'))

  // 确认拿到的是 registry 版本（非本地链接）
  for (const name of ['@groupviz/core', '@groupviz/react']) {
    const p = JSON.parse(readFileSync(path.join(tmp, 'node_modules', name, 'package.json'), 'utf8'))
    console.log(`[npm-consume] · ${name}@${p.version}${p.version === VERSION ? '' : red('  ← 版本不符!')}`)
    if (p.version !== VERSION) failures++
  }

  // ---- 2a. core 冒烟 ----
  console.log('[npm-consume] · core 冒烟')
  const coreSmoke = `
import { createGroupFromSymbol, serializeDescriptor, deserializeDescriptor,
  wordLengthSphereActions, wordLengthSphereLayout3D, wordLengthOf, wordLengthColor,
  relaxEdgeLengths3D, computeCayleyActionEdges } from '@groupviz/core'

const roundTrip = (sym) => {
  const g = createGroupFromSymbol(sym)
  const d = deserializeDescriptor(JSON.parse(JSON.stringify(serializeDescriptor(g))))
  if (d.order !== g.order) throw new Error(sym + ' round-trip ' + d.order + ' != ' + g.order)
  return g.order
}
for (const sym of ['C_{4}', 'S_{3}', 'D_{4}', 'A_{4}', 'Q_{8}', 'S_{4}']) {
  console.log('  core ok  ' + sym + '  order=' + roundTrip(sym))
}

// 字长球：S4 3 条 / S5 4 条相邻对换
const S4 = createGroupFromSymbol('S_{4}')
if (!S4) throw new Error("createGroupFromSymbol('S_{4}') 返回 null")
const a4 = wordLengthSphereActions(S4)
if (!a4 || a4.length !== 3) throw new Error('S4 actions 应为 3 条，实得 ' + (a4 && a4.length))
const S5 = createGroupFromSymbol('S_{5}')
if (!S5) throw new Error("createGroupFromSymbol('S_{5}') 返回 null")
const a5 = wordLengthSphereActions(S5)
if (!a5 || a5.length !== 4) throw new Error('S5 actions 应为 4 条，实得 ' + (a5 && a5.length))
const C4 = createGroupFromSymbol('C_{4}')
if (!C4) throw new Error("createGroupFromSymbol('C_{4}') 返回 null")
if (wordLengthSphereActions(C4) !== null) throw new Error('C4 应返回 null')
console.log('  core ok  字长球 actions：S4=3 / S5=4 / C4=null')

// 布局：120 点且无一节点出球（返回 Vec3 元组 [x,y,z]）
// 注意：第二参数是「层高单位」radius，实际球半径 = radius × 3（与 publish-smoke 一致）
const R5 = 5 * 3
const pts = wordLengthSphereLayout3D(S5, 5)
if (!pts || pts.length !== 120) throw new Error('S5 布局应为 120 点，实得 ' + (pts && pts.length))
if (!Array.isArray(pts[0]) || pts[0].length !== 3) throw new Error('布局应返回 Vec3 元组，实得 ' + JSON.stringify(pts[0]))
const out = pts.filter(p => Math.hypot(p[0], p[1], p[2]) > R5 + 1e-6)
if (out.length) throw new Error('有 ' + out.length + ' 个节点出球（球半径 ' + R5 + '）')
console.log('  core ok  字长球布局 S5：120 点（Vec3 元组）、0 出球（R=' + R5 + '）')

// 字长工具：wordLengthOf(el) → 逆序数；wordLengthColor(group, el) → 色阶
const id = S5.elements[0].id
if (wordLengthOf(S5.elements[0]) !== 0) throw new Error('单位元字长应为 0')
const cE = wordLengthColor(S5, S5.elements[0])
if (typeof cE !== 'string') throw new Error('wordLengthColor(单位元) 应返回颜色串，实得 ' + cE)
// 最长元 w0（字长 = 10，S5 逆序数最大）
const w0 = S5.elements.find(e => wordLengthOf(e) === 10)
if (!w0) throw new Error('S5 应有字长 10 的最长元')
const cW0 = wordLengthColor(S5, w0)
if (typeof cW0 !== 'string') throw new Error('wordLengthColor(最长元) 应返回颜色串')
if (cE === cW0) throw new Error('冷/暖两端颜色应不同')
// 非目标群 → null
if (wordLengthColor(C4, C4.elements[0]) !== null) throw new Error('C4 配色应为 null')
console.log('  core ok  wordLengthOf=' + wordLengthOf(S5.elements[0]) +
  ' / 最长元字长=' + wordLengthOf(w0) + ' / wordLengthColor 冷暖两端不同')

// 3D 逐生成元边长松弛：全 1 倍率 → 原样返回（同一引用，零配置安全）
const baseMap = new Map(pts.map((p, i) => [S5.elements[i].id, [p[0], p[1], p[2]]]))
const same = relaxEdgeLengths3D(baseMap, [], { lengthScales: new Map() })
if (same !== baseMap) throw new Error('relaxEdgeLengths3D 全 1 倍率应原样返回同一引用')
console.log('  core ok  relaxEdgeLengths3D 全 1 原样返回（同一引用）')

// 2× 倍率应真的拉长（S5 相邻对换边）
const edges = computeCayleyActionEdges(S5, a5, 'right')
console.log('  core note  S5 边数=' + edges.length + ' 首边=' +
  (edges[0] ? edges[0].fromId + '→' + edges[0].toId + ' @' + edges[0].actionElementId : 'none'))
if (edges.length === 0) throw new Error('S5 相邻对换未产生任何边（actions=' + a5.length + ' 条）')
const allIds = edges.flatMap(e => [e.fromId, e.toId])
const missing = allIds.filter(id => !baseMap.has(id))
console.log('  core note  baseMap size=' + baseMap.size + ' 边端点缺失=' + missing.length +
  (missing.length ? ' 例：' + JSON.stringify(missing.slice(0, 3)) : ''))
if (missing.length) throw new Error('布局 map 缺 ' + missing.length + ' 个边端点 id')
const scaled = relaxEdgeLengths3D(baseMap, edges,
  { lengthScales: new Map(a5.map(a => [a.elementId, 2])) })
const meanOf = (m, eList) => {
  let s = 0, c = 0
  for (const e of eList) {
    const p = m.get(e.fromId), q = m.get(e.toId)
    if (p && q) { s += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); c++ }
  }
  return c > 0 ? s / c : NaN
}
const m0 = meanOf(baseMap, edges), m1 = meanOf(scaled, edges)
console.log('  core ok  relaxEdgeLengths3D 2× 倍率：mean ' + m0.toFixed(2) + ' → ' + m1.toFixed(2))
if (!(m1 > m0 * 1.2)) throw new Error('2× 倍率未拉长边长（' + m0.toFixed(2) + ' → ' + m1.toFixed(2) + '）')
`
  writeFileSync(path.join(tmp, 'core-smoke.mjs'), coreSmoke)
  if (KEEP) console.log(`[npm-consume] · 落盘 ${path.join(tmp, 'core-smoke.mjs')}`)
  const coreOut = run('node core-smoke.mjs', { cwd: tmp, timeout: 120000 })
  for (const line of coreOut.trim().split('\n')) {
    if (line.includes('FAIL') || line.includes('Error')) throw new Error(line)
    console.log(line)
  }
  check('core SSR-free 直跑', () => {})

  // ---- 2b. react SSR 冒烟 ----
  console.log('[npm-consume] · react SSR 冒烟')
  const reactSmoke = `
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, SetView, CayleyView } from '@groupviz/react'
import { createGroupFromSymbol } from '@groupviz/core'

const g = createGroupFromSymbol('S_{3}')
const noop = () => {}
const xform = { x: 0, y: 0, scale: 1 }

const a = renderToStaticMarkup(
  React.createElement(I18nProvider, { locale: 'zh-CN' },
    React.createElement(SetView, {
      group: g, selectedElements: new Set(), canvasTransform: xform,
      viewBoxSize: { width: 600, height: 400 }, onSelect: noop, onHover: noop,
    })))
const svgA = (a.match(/<svg/g) || []).length
console.log('  react ok  SetView SSR → ' + a.length + ' bytes, svg=' + svgA)
if (!svgA) throw new Error('SetView 未产出 SVG')

// 900×360 宽扁 viewBox 回归：S3 全节点不出画布
const b = renderToStaticMarkup(
  React.createElement(I18nProvider, { locale: 'zh-CN' },
    React.createElement(CayleyView, {
      group: g, selectedElements: new Set(), canvasTransform: xform,
      viewBoxSize: { width: 900, height: 360 }, shape2D: 'circular',
      onSelect: noop, onHover: noop,
    })))
// 节点位置：外层画布 transform translate(0, 0) scale(1) + 每个节点 translate(x, y)
const pairs = [...b.matchAll(/translate\\((-?[\\d.]+),\\s*(-?[\\d.]+)\\)/g)]
  .map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }))
  .filter(p => !(p.x === 0 && p.y === 0)) // 去掉画布根 transform
console.log('  react ok  CayleyView 900x360 SSR → svg=' + (b.match(/<svg/g) || []).length +
  ', 节点=' + pairs.length + (pairs.length
    ? ', y=[' + Math.min(...pairs.map(p => p.y)).toFixed(1) + ', ' + Math.max(...pairs.map(p => p.y)).toFixed(1) + ']'
    : ''))
if (pairs.length === 0) throw new Error('CayleyView 未渲染出节点（translate 正则未命中）')
for (const p of pairs) {
  if (p.y < 0 || p.y > 360) throw new Error('节点 y=' + p.y.toFixed(1) + ' 出画布（900x360）')
  if (p.x < 0 || p.x > 900) throw new Error('节点 x=' + p.x.toFixed(1) + ' 出画布（900x360）')
}
`
  writeFileSync(path.join(tmp, 'react-smoke.mjs'), reactSmoke)
  const reactOut = run('node react-smoke.mjs', { cwd: tmp, timeout: 180000 })
  for (const line of reactOut.trim().split('\n')) {
    if (line.includes('Error')) throw new Error(line)
    console.log(line)
  }
  check('react SSR', () => {})

  // ---- 2c. 类型解析冒烟 ----
  console.log('[npm-consume] · 类型解析冒烟')
  mkdirSync(path.join(tmp, 'types'), { recursive: true })
  writeFileSync(path.join(tmp, 'types', 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022',
      lib: ['es2022', 'dom'], jsx: 'react-jsx', strict: true, noEmit: true,
      skipLibCheck: true, types: [],
    },
    include: ['main.tsx'],
  }, null, 2))
  writeFileSync(path.join(tmp, 'types', 'main.tsx'), `
import React from 'react'
import type { SetViewProps, CayleyViewProps, Cayley3DSceneProps, I18nProviderProps } from '@groupviz/react'
import type { Group, Layout3D } from '@groupviz/core'

const g = {} as Group
const noop = () => {}

// VCL 新 props 的结构化赋值（消费端无需 import 具体类型，靠 props 自身签名约束）
export const p2: CayleyViewProps = {
  group: g, selectedElements: new Set<string>(), canvasTransform: { x: 0, y: 0, scale: 1 },
  viewBoxSize: { width: 900, height: 360 },
  edgeCurvature: 0,
  forceDirected: true,
  force: { repulsion: 1, linkScale: 1, gravity: 1, stiffness: 1 },
  pathHighlight: { word: ['12', '23', '12'], start: '1,2,3', color: '#ffd93d', width: 6, dimOthers: true, showOrder: true },
  actions: [{ elementId: 'x', enabled: true, color: '#fff', lengthScale: 2 }],
  onSelect: noop,
}

export const p3: Cayley3DSceneProps = {
  group: g,
  pathHighlight: { word: ['12', '23'], animate: true },
  actions: [{ elementId: 'x', enabled: true, color: '#fff', lengthScale: 2 }],
} as Cayley3DSceneProps

export const p4: SetViewProps = { group: null } as SetViewProps
export const p5: I18nProviderProps = { locale: 'zh-CN', children: null } as I18nProviderProps

// 新枚举值可达
export const shapes: Layout3D[] = ['circular', 'wordLengthSphere']
`)
  try {
    run('npx --no-install tsc -p types/tsconfig.json', { cwd: tmp, timeout: 300000 })
    console.log(green('  types ok  NodeNext 解析通过（含 edgeCurvature/force/pathHighlight/lengthScale）'))
  } catch (e) {
    // 回退：用宿主 tsc
    const hostTsc = path.join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
    run(`node "${hostTsc}" -p types/tsconfig.json`, { cwd: tmp, timeout: 300000 })
    console.log(green('  types ok  解析通过（宿主 tsc）'))
  }
  check('types', () => {})

  console.log(failures === 0
    ? green(`[npm-consume] ✅ 全部通过 —— @groupviz/{core,react}@${VERSION} registry 消费正常`)
    : red(`[npm-consume] ✗ ${failures} 项失败`))
  if (failures > 0) process.exitCode = 1

  if (!KEEP && failures === 0) rmSync(tmp, { recursive: true, force: true })
} catch (e) {
  console.error(red(`[npm-consume] ✗ 中断：${e.message}`))
  console.error(`临时目录保留在 ${tmp}（排查用；--keep 可强制保留）`)
  process.exitCode = 1
}

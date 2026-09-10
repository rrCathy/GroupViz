/**
 * FGVE 双包发布门禁 —— 真实 npm 安装冒烟。
 *
 * 为什么需要：TestPage / host-minimal 全走 Vite alias 指 dist-pkg/，绕开了 npm 的
 * exports/types 解析与 peer 自动安装——这三层恰是发布后消费端踩坑高发区。
 *
 * 流程：
 *   1. npm pack 两包 → tarball
 *   2. 干净临时目录建 consumer：dependencies 指 file: tarball（peer 由 npm 自动安装，
 *      模拟真实消费者安装路径）
 *   3. 冒烟三段：
 *      a. core   —— node 直跑 createGroupFromSymbol + serialize/deserialize round-trip
 *      b. react  —— node + react-dom/server renderToStaticMarkup 渲染 <I18nProvider><SetView/></I18nProvider>
 *      c. types  —— 消费端 tsc --noEmit 验证 exports["."].types 类型解析（SetViewProps 可构造）
 *   4. 成功清临时目录；失败保留并打印路径供排查
 *
 * 用法：npm run publish:smoke（先 npm run build:pkg 保证产物最新）
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CORE_OUT = path.join(ROOT, 'dist-pkg', '@groupviz', 'core')
const REACT_OUT = path.join(ROOT, 'dist-pkg', '@groupviz', 'react')

// 消费端必须复用宿主“已解析”的 react/three 版本：冒烟目录无 lockfile，若只给范围
// （如 "react": "^19.2.5"）npm 会浮动到更高版本 —— react@19.3 与 @react-three/fiber@9.7
// 收紧后的 peer（">=19 <19.3"）冲突 → ERESOLVE 假失败。钉死精确版本 = 复现宿主真实配置。
const HOST_RESOLVED_PEERS = ['react', 'react-dom', 'three']
const PINNED_PEERS = HOST_RESOLVED_PEERS.reduce((acc, name) => {
  try {
    const v = JSON.parse(readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version
    acc[name] = v // 精确版本，不加 ^ / ~
  } catch { /* 宿主没装则交给 npm 自动解析 */ }
  return acc
}, {})

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts })

const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`

function fail(msg) {
  console.error(red(`[publish-smoke] ✗ ${msg}`))
  process.exitCode = 1
  throw new Error(msg)
}

try {
  // ---- 0. 产物在位检查 ----
  for (const [name, dir] of [['@groupviz/core', CORE_OUT], ['@groupviz/react', REACT_OUT]]) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
    for (const f of ['index.js', 'package.json', 'README.md', 'LICENSE', 'API.md']) {
      const p = path.join(dir, f)
      try { readFileSync(p) } catch { fail(`${name} 缺产物文件 ${f} —— 先跑 npm run build:pkg`) }
    }
    console.log(`[publish-smoke] · ${name} v${pkg.version} 产物在位`)
  }

  // ---- 0.5 接口一致性：react 产物 import 的每个 core 符号，core 必须真实导出 ----
  // 为什么：vite pkg 构建把 core 设为 external，rollup 无法校验 @groupviz/core 的具名导出，
  // 漏导出（如历史上 faces3D 的 FACE_COLOR_PALETTE）会静默打进 react 产物，
  // 直到消费端 import 时才抛 "does not provide an export named"，纯运行期才暴露。
  {
    const coreExports = new Set(
      Object.keys(await import(pathToFileURL(path.join(CORE_OUT, 'index.js')).href))
    )
    const reactSrc = readFileSync(path.join(REACT_OUT, 'index.js'), 'utf8')
    const coreImportRe = /import\s*\{([^}]*)\}\s*from\s*["']@groupviz\/core["']/g
    const missing = new Set()
    for (const m of reactSrc.matchAll(coreImportRe)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim() // 取原始导出名（忽略 as 别名）
        if (name && !coreExports.has(name)) missing.add(name)
      }
    }
    if (missing.size) {
      fail(`@groupviz/react 引用了 core 未导出的符号：${[...missing].join(', ')} —— 在 src/core/index.ts 补 export`)
    }
    console.log(`[publish-smoke] · react→core 具名导出一致（core 共 ${coreExports.size} 个导出）`)
  }

  // ---- 0.6 包 README 链接完整性 ----
  // 为什么：npm 页面把包 README 里的**相对链接**按仓库根解析为 blob/HEAD/<path>，
  // 而文档都在 docs/ 下 —— 相对写法（如 `./API.md`）会生成
  // https://github.com/<repo>/blob/HEAD/API.md（404）。此处 fail-closed：
  //   a. README 内不得出现非绝对链接（http/https 之外一律拒绝）；
  //   b. 指向本仓库 blob/tree 的链接，其仓内路径必须真实存在（防错路径）。
  {
    const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
    for (const [name, dir] of [['@groupviz/core', CORE_OUT], ['@groupviz/react', REACT_OUT]]) {
      const readme = readFileSync(path.join(dir, 'README.md'), 'utf8')
      for (const m of readme.matchAll(linkRe)) {
        const url = m[1]
        if (!/^https?:\/\//.test(url)) {
          fail(`${name} README 含非绝对链接 "${url}" —— npm 会按仓库根 blob/HEAD/ 解析成 404；请改用绝对 URL（见 finalize-pkg.mjs 的 doc()/dir()）`)
        }
        const repo = url.match(/^https:\/\/github\.com\/rrCathy\/GroupViz\/(?:blob|tree)\/main\/([^?#]+)/)
        if (repo && !existsSync(path.join(ROOT, repo[1]))) {
          fail(`${name} README 链接指向仓库内不存在的路径：${url}（仓内缺 ${repo[1]}）`)
        }
      }
    }
    console.log('[publish-smoke] · 包 README 链接完整（无相对链接，blob/tree 目标均存在）')
  }

  // ---- 1. pack ----
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'gv-pkg-smoke-'))
  const pack = (dir) => {
    const out = run(`npm pack --json --pack-destination "${tmp}"`, { cwd: dir })
    const [{ filename }] = JSON.parse(out.trim()) // --json 时 stdout 为纯 JSON 数组（notice 走 stderr）
    return filename
  }
  const coreTgz = pack(CORE_OUT)
  const reactTgz = pack(REACT_OUT)
  console.log(`[publish-smoke] · pack → ${coreTgz} / ${reactTgz}`)

  // ---- 2. consumer ----
  writeFileSync(
    path.join(tmp, 'package.json'),
    JSON.stringify(
      {
        name: 'groupviz-pkg-smoke',
        private: true,
        type: 'module',
        dependencies: {
          '@groupviz/core': `file:./${coreTgz}`,
          '@groupviz/react': `file:./${reactTgz}`,
        },
        // peers 由 npm 自动安装；但 react/react-dom/three 必须按宿主范围钉死，
        // 否则会拉到更新版本触发 r3f peer 冲突（见 PINNED_PEERS 注释）。typescript 供类型冒烟
        devDependencies: {
          ...PINNED_PEERS,
          typescript: 'latest',
          '@types/react': 'latest',
          '@types/react-dom': 'latest',
        },
      },
      null,
      2
    ) + '\n'
  )

  // core 冒烟：node 直跑（纯算法，无 DOM）
  writeFileSync(
    path.join(tmp, 'smoke-core.mjs'),
    `import { createGroupFromSymbol, serializeDescriptor, deserializeDescriptor,
  resolveElement, findElement, parseCycleNotation, elementOrder, buildCosetViewData, isTooLarge, sizeLimitFor,
  listCosetStripSubgroups, cosetDataForSubgroup } from '@groupviz/core'
const cases = ['C_{4}', 'S_{3}', 'D_{4}', 'A_{4}', 'Q_{8}', 'GL(2,3)']
for (const sym of cases) {
  const g = createGroupFromSymbol(sym)
  if (!g || typeof g.order !== 'number') throw new Error('createGroupFromSymbol → null: ' + sym)
  const json = serializeDescriptor(g)
  const r = deserializeDescriptor(json)
  if (!r || r.order !== g.order || r.elements.length !== g.elements.length)
    throw new Error('round-trip 不一致: ' + sym + ' (' + g.order + ')')
  console.log('  core ok  ' + sym + '  order=' + g.order + '  round-trip=' + json.elements.length + ' elems')
}

// 元素引用解析：id 与 label 必须都能命中同一元素（本批次核心修复）
const s4 = createGroupFromSymbol('S_{4}')
const probe = s4.elements.find(e => e.label !== 'e')
if (!probe) throw new Error('S_4 找不到非恒等元素')
if (resolveElement(s4, probe.id)?.id !== probe.id) throw new Error('resolveElement 按 id 失败')
if (resolveElement(s4, probe.label)?.id !== probe.id) throw new Error('resolveElement 按 label 失败: ' + probe.label)
if (findElement(s4, probe.value.join(','))?.id !== probe.id) throw new Error('findElement 按 value 失败')
if (resolveElement(s4, '(nope)') !== null) throw new Error('未命中应返回 null')
if (elementOrder(s4, probe) < 1) throw new Error('elementOrder 异常')

// 第四档：循环记号语义匹配（v2.1.1）——手写标准记号必须命中，且跨群互写
const el234 = s4.elements.find(e => e.value.join(',') === '1,3,4,2')
const elDbl = s4.elements.find(e => e.value.join(',') === '2,1,4,3')
if (!el234 || !elDbl) throw new Error('S_4 缺少 (234) / (12)(34) 样本元素')
if (resolveElement(s4, '(234)')?.id !== el234.id) throw new Error('S_4 循环记号 (234) 未命中（带括号写法）')
if (resolveElement(s4, '(2 3 4)')?.id !== el234.id) throw new Error('S_4 循环记号 (2 3 4) 未命中（含空格）')
if (resolveElement(s4, '234')?.id !== el234.id) throw new Error('S_4 无括号 234 未命中（既有 label 记号）')
if (resolveElement(s4, '(12)(34)')?.id !== elDbl.id) throw new Error('S_4 多环 (12)(34) 未命中')
if (resolveElement(s4, '12)(34')?.id !== elDbl.id) throw new Error('S_4 旧畸形 label 12)(34 未命中')
const a4x = createGroupFromSymbol('A_{4}')
if (resolveElement(a4x, '234')?.id !== el234.id) throw new Error('A_4 接受无括号 234 失败（跨群互写）')
if (parseCycleNotation('(12)(34)', 4).join(',') === parseCycleNotation('(1234)', 4).join(','))
  throw new Error('循环记号歧义防护失效：(12)(34) 与 (1234) 不应等价')
if (parseCycleNotation('234', 4).join(',') !== '1,3,4,2') throw new Error('parseCycleNotation 逐位拆点失败')
if (resolveElement(s4, '1') !== null) throw new Error('全不动点引用不应命中恒等元')
console.log('  core ok  元素引用解析 id/label/value/循环记号 四档 + elementOrder')

// 陪集一键装配 + 阈值覆盖
const c6 = createGroupFromSymbol('C_{6}')
const h = c6.elements.filter(e => e.label === '0' || e.label === '3').map(e => e.id)
const coset = buildCosetViewData(c6, h, { side: 'left' })
if (!coset || coset.cosetElementMap.size !== 6 || coset.cosetColors.length !== 3)
  throw new Error('buildCosetViewData 结果异常')
if (listCosetStripSubgroups(c6).length === 0) throw new Error('listCosetStripSubgroups 为空')
if (!cosetDataForSubgroup(c6, h)) throw new Error('cosetDataForSubgroup 为空')
if (isTooLarge(150, 'table') !== true) throw new Error('isTooLarge 默认阈值异常')
if (isTooLarge(150, 'table', 200) !== false) throw new Error('isTooLarge 阈值覆盖无效')
if (sizeLimitFor('heatmap') !== 240) throw new Error('sizeLimitFor 异常')
console.log('  core ok  buildCosetViewData + listCosetStripSubgroups + isTooLarge 覆盖')
console.log('CORE SMOKE PASS')
`
  )

  // react 冒烟：node + react-dom/server SSR 渲染 SetView（不经浏览器，验证产物可被真实 import/渲染）
  writeFileSync(
    path.join(tmp, 'smoke-react.mjs'),
    `import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, SetView, SceneWindow, SceneThemeRoot, SceneHoverBubble, useSceneState } from '@groupviz/react'
import { createGroupFromSymbol } from '@groupviz/core'

const group = createGroupFromSymbol('S_{3}')
const el = React.createElement(I18nProvider, null,
  React.createElement(SceneThemeRoot, { theme: 'light' },
    React.createElement(SetView, {
      group,
      selectedElements: new Set(),
      canvasTransform: { x: 0, y: 0, scale: 1 },
      viewBoxSize: { width: 480, height: 360 },
      theme: 'light',
    })
  )
)
const html = renderToStaticMarkup(el)
if (!html.includes('<svg')) throw new Error('SSR 输出未含 <svg>，实际前缀: ' + html.slice(0, 120))
if (!html.includes('data-theme="light"')) throw new Error('theme 作用域未注入，实际前缀: ' + html.slice(0, 200))
console.log('  react ok  SetView+theme SSR → ' + html.length + ' bytes, svg=' + (html.match(/<svg/g) || []).length)

// 便利层可被 import / 是函数（SSR 不挂载，仅验证产物导出面完整）
for (const [name, fn] of [['useSceneState', useSceneState], ['SceneWindow', SceneWindow], ['SceneHoverBubble', SceneHoverBubble]]) {
  if (typeof fn !== 'function') throw new Error(name + ' 未从产物导出为函数')
}

// 无 I18nProvider 时文案必须是真实中文（不再回落 key）
const bare = renderToStaticMarkup(React.createElement(SetView, {
  group: null,
  selectedElements: new Set(),
  canvasTransform: { x: 0, y: 0, scale: 1 },
  viewBoxSize: { width: 100, height: 100 },
  noGroupText: '请先选择一个群',
}))
if (!bare.includes('请先选择一个群')) throw new Error('noGroupText 未渲染')
console.log('REACT SMOKE PASS')
`
  )

  // 类型冒烟：消费端 tsc 必须能从 exports types 解析并构造 SetViewProps（JSX → 必须 .tsx）
  writeFileSync(
    path.join(tmp, 'smoke-ts.tsx'),
    `import { createGroupFromSymbol, resolveElement, buildCosetViewData } from '@groupviz/core'
import { I18nProvider, SetView, CayleyView, CosetStripScene, SymmetryViewScene,
  SceneWindow, SceneThemeRoot, SceneHoverBubble, useSceneState } from '@groupviz/react'
import type {
  SetViewProps, CayleyViewProps, CosetStripSceneProps, SymmetryViewSceneProps,
  SceneStateOptions, SceneState, SceneTheme, SceneWindowConfig,
} from '@groupviz/react'

const group = createGroupFromSymbol('C_{6}')! // 冒烟常量群，非空断言

const props: SetViewProps = {
  group,
  selectedElements: new Set<string>(),
  canvasTransform: { x: 0, y: 0, scale: 1 },
  viewBoxSize: { width: 480, height: 360 },
  theme: 'light',
  largeGroupThreshold: 80,
}

const cayley: CayleyViewProps = {
  group,
  selectedElements: new Set<string>(),
  canvasTransform: { x: 0, y: 0, scale: 1 },
  viewBoxSize: { width: 480, height: 360 },
  // label 记号（新能力）：类型上仍是 string
  actions: [{ elementId: group.elements[1].label, color: '#fff' }],
  theme: 'dark',
}

const coset: CosetStripSceneProps = { group, viewBoxSize: { width: 480, height: 360 }, subgroup: ['0', '3'], cosetType: 'left' }
const sym: SymmetryViewSceneProps = { group, theme: 'light', actionElementId: group.elements[1].label, lockCameraOnAction: false, onAnimationEnd: () => {} }

const opts: SceneStateOptions = { theme: 'dark', selectedElements: new Set<string>() }
const theme: SceneTheme = 'light'
const win: SceneWindowConfig = { locked: true }
const cosetData = buildCosetViewData(group, ['e0'], { side: 'right' })
const el0 = resolveElement(group, 'e1')

export const Smoke = () => {
  const s: SceneState = useSceneState(group, opts)
  return (
    <I18nProvider>
      <SceneWindow theme={theme} config={win} shell="none">
        <SceneThemeRoot theme={theme}>
          <SetView {...props} />
        </SceneThemeRoot>
      </SceneWindow>
      <div {...s.hostProps}>
        <CayleyView {...cayley} {...s.sceneProps} />
        {s.hoverBubble}
      </div>
      <SceneHoverBubble element={el0} anchor={{ x: 1, y: 1 }} theme={theme} />
      <CosetStripScene {...coset} {...s.sceneProps} />
      <SymmetryViewScene {...sym} />
      <span>{String(cosetData?.cosetColors.length ?? 0)}</span>
    </I18nProvider>
  )
}
`
  )
  const tsconfigBase = {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      jsx: 'react-jsx',
      lib: ['ES2022', 'DOM'],
      skipLibCheck: true,
      types: ['react', 'react-dom'],
    },
    include: ['smoke-ts.tsx'],
  }
  writeFileSync(
    path.join(tmp, 'tsconfig.nodenext.json'),
    JSON.stringify(
      {
        ...tsconfigBase,
        compilerOptions: {
          ...tsconfigBase.compilerOptions,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
      },
      null,
      2
    ) + '\n'
  )
  writeFileSync(
    path.join(tmp, 'tsconfig.bundler.json'),
    JSON.stringify(
      {
        ...tsconfigBase,
        compilerOptions: {
          ...tsconfigBase.compilerOptions,
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
      },
      null,
      2
    ) + '\n'
  )

  // ---- 3. install（真实解析 exports + peer 自动安装）----
  console.log('[publish-smoke] · npm install（真实 tarball + peers，可能耗时 ~1-3min）…')
  run('npm install --no-audit --no-fund --loglevel=error', { cwd: tmp, timeout: 600000 })
  console.log('[publish-smoke] · npm install 成功（exports/peer 解析通过）')

  // ---- 4. 三段冒烟 ----
  console.log('[publish-smoke] · core 冒烟…')
  console.log(run('node smoke-core.mjs', { cwd: tmp }))
  console.log('[publish-smoke] · react SSR 冒烟…')
  console.log(run('node smoke-react.mjs', { cwd: tmp }))
  console.log('[publish-smoke] · 类型解析冒烟（NodeNext + bundler 双 resolution）…')
  run('node node_modules/typescript/bin/tsc -p tsconfig.nodenext.json', { cwd: tmp })
  console.log('[publish-smoke] ·   NodeNext 通过')
  run('node node_modules/typescript/bin/tsc -p tsconfig.bundler.json', { cwd: tmp })
  console.log('[publish-smoke] ·   bundler 通过（SetViewProps 均可从 @groupviz/react 解析）')

  // ---- 5. 收尾 ----
  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 沙箱/占用，忽略 */ }
  console.log(green('[publish-smoke] ✓ 全部通过 —— 双包可经真实 npm 安装消费'))
} catch (e) {
  console.error(red(`[publish-smoke] ✗ ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`))
  console.error(red('[publish-smoke] 临时目录保留在 os.tmpdir()/gv-pkg-smoke-*（脚本打印路径在错误上方）—— 手动排查后删除'))
  process.exit(1)
}

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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CORE_OUT = path.join(ROOT, 'dist-pkg', '@groupviz', 'core')
const REACT_OUT = path.join(ROOT, 'dist-pkg', '@groupviz', 'react')

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
    for (const f of ['index.js', 'package.json', 'README.md', 'LICENSE']) {
      const p = path.join(dir, f)
      try { readFileSync(p) } catch { fail(`${name} 缺产物文件 ${f} —— 先跑 npm run build:pkg`) }
    }
    console.log(`[publish-smoke] · ${name} v${pkg.version} 产物在位`)
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
        // peers（react/three/r3f/drei/katex）由 npm 自动安装；typescript 供类型冒烟
        devDependencies: {
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
    `import { createGroupFromSymbol, serializeDescriptor, deserializeDescriptor } from '@groupviz/core'
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
console.log('CORE SMOKE PASS')
`
  )

  // react 冒烟：node + react-dom/server SSR 渲染 SetView（不经浏览器，验证产物可被真实 import/渲染）
  writeFileSync(
    path.join(tmp, 'smoke-react.mjs'),
    `import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider, SetView } from '@groupviz/react'
import { createGroupFromSymbol } from '@groupviz/core'

const group = createGroupFromSymbol('S_{3}')
const el = React.createElement(I18nProvider, null,
  React.createElement(SetView, {
    group,
    selectedElements: new Set(),
    canvasTransform: { x: 0, y: 0, scale: 1 },
    viewBoxSize: { width: 480, height: 360 },
  })
)
const html = renderToStaticMarkup(el)
if (!html.includes('<svg')) throw new Error('SSR 输出未含 <svg>，实际前缀: ' + html.slice(0, 120))
console.log('  react ok  SetView SSR → ' + html.length + ' bytes, svg=' + (html.match(/<svg/g) || []).length)
console.log('REACT SMOKE PASS')
`
  )

  // 类型冒烟：消费端 tsc 必须能从 exports types 解析并构造 SetViewProps（JSX → 必须 .tsx）
  writeFileSync(
    path.join(tmp, 'smoke-ts.tsx'),
    `import { createGroupFromSymbol } from '@groupviz/core'
import { I18nProvider, SetView } from '@groupviz/react'
import type { SetViewProps } from '@groupviz/react'

const group = createGroupFromSymbol('C_{6}')

const props: SetViewProps = {
  group,
  selectedElements: new Set<string>(),
  canvasTransform: { x: 0, y: 0, scale: 1 },
  viewBoxSize: { width: 480, height: 360 },
}

export const Smoke = () => (
  <I18nProvider>
    <SetView {...props} />
  </I18nProvider>
)
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

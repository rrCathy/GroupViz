/**
 * 复现消费端类型缺口：@groupviz/react 的 .d.ts 里自己就从 '@groupviz/core'
 * import type { CayleyForceParams, CayleyPathHighlight, CayleyActionParam }，
 * 但 core 的门面没有导出 types/viewConfig —— 消费端想显式标注这三个类型会报错。
 *
 * 用法：node scripts/pkg/_repro-viewconfig-gap.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, appendFileSync, cpSync, writeFileSync as wf } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'

const REPORT = path.resolve('gap-report.txt')
wf(REPORT, '')
const say = (...a) => appendFileSync(REPORT, a.join(' ') + '\n')

const root = 'C:\\newproject\\GroupViz'

const dir = mkdtempSync(path.join(tmpdir(), 'gv-vc-gap-'))
writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: 'gv-vc-gap', private: true, type: 'module',
}, null, 2))
writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: false,
    types: [], lib: ['ES2022', 'DOM'],
  },
  include: ['main.tsx'],
}, null, 2))
writeFileSync(path.join(dir, 'main.tsx'), `
import { CayleyView } from '@groupviz/react'
// ↓ 这三个由 @groupviz/react 的公开 props 直接引用，消费端理应能标注
import type { CayleyForceParams, CayleyPathHighlight, CayleyActionParam } from '@groupviz/core'

const force: CayleyForceParams = { stiffness: 1.4 }
const hl: CayleyPathHighlight = { word: ['12', '23'], showOrder: true }
const acts: CayleyActionParam[] = [{ elementId: 'x' }]
export const Demo = () => (
  <CayleyView group={null} selectedElements={new Set()} viewBoxSize={{ width: 1, height: 1 }}
    canvasTransform={{ x: 0, y: 0, scale: 1 }} force={force} pathHighlight={hl} actions={acts} />
)
`)
mkdirSync(path.join(dir, 'node_modules'), { recursive: true })

say('临时消费端：', dir)
say('安装（把 dist-pkg 目录**拷贝**进 node_modules，模拟真实 registry 布局）…')
const nm = path.join(dir, 'node_modules', '@groupviz')
mkdirSync(path.join(nm, 'core'), { recursive: true })
mkdirSync(path.join(nm, 'react'), { recursive: true })
cpSync(path.join(root, 'dist-pkg', '@groupviz', 'core'), path.join(nm, 'core'), { recursive: true })
cpSync(path.join(root, 'dist-pkg', '@groupviz', 'react'), path.join(nm, 'react'), { recursive: true })
// react 依赖 peer core：补一个扁平副本供解析
say('copied → node_modules/@groupviz/{core,react}')

say('\n--- tsc --noEmit ---')
// 直接用宿主 tsc 二进制（避免 npx → wsl.exe 被沙箱拦）
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
say('tsc =', tsc)
try {
  const out = execSync(`"${process.execPath}" "${tsc}" --noEmit`, { cwd: dir, stdio: 'pipe' })
  say('✅ 类型检查通过 —— 缺口不存在？')
  say(out.toString().slice(0, 1500))
} catch (e) {
  const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
  say('❌ 类型检查失败（预期）：')
  const errs = out.split('\n').filter(l => /error TS/.test(l)).slice(0, 10)
  say(errs.length ? errs.join('\n') : `(raw)\n${out.slice(0, 2000)}`)
}
say('\nREPORT =', REPORT)

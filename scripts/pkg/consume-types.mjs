/**
 * 消费端类型面验收（专项门禁）—— 从 registry 真实安装双包，验证「react 公开 props 引用的
 * core 类型，消费端都能从 @groupviz/core 顶层解析」。
 *
 * 为什么单独一关：publish-smoke 的第 4e 道 strict 关卡查的是**本地 dist-pkg**；
 * 本脚本查的是**线上 registry 包**（真实 npm 安装后的 .d.ts 布局），二者互补。
 * 覆盖反馈 BUGREPORT-groupviz-2.2.0-core-viewconfig-not-exported.md 那一类缺口
 * （core 门面漏导出 → react 的 .d.ts 内部 import 坏掉 → 消费端 skipLibCheck:false 满屏红）。
 *
 * 用法：npm run consume:types [-- 2.2.1]
 *   需**非沙箱**运行（npm install 走网络）。默认取 package.json 的 version。
 *   报告写入项目根的 viewconfig-verify.txt。
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const REPORT = path.join(ROOT, 'viewconfig-verify.txt')
writeFileSync(REPORT, '')
const say = (...a) => appendFileSync(REPORT, a.join(' ') + '\n')

// 版本号：显式参数优先（npm run consume:types -- 2.2.1），否则读 package.json
const VERSION = process.argv.slice(2).find((a) => /^\d+\.\d+\.\d+/.test(a))
  ?? JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
const tmp = mkdtempSync(path.join(os.tmpdir(), 'gv-vcver-'))
say('版本:', VERSION)
say('临时消费端:', tmp)

// peer 钉死宿主已解析版本，避免 npm 浮动到 react@19.3 触发 ERESOLVE（同 consume-npm 做法）
const hostPeer = (name) => {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version
  } catch { return undefined }
}
const deps = { '@groupviz/core': VERSION, '@groupviz/react': VERSION }
for (const name of ['react', 'react-dom', 'three']) {
  const v = hostPeer(name)
  if (v) deps[name] = v
}

writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
  name: 'gv-vcver', private: true, type: 'module', version: '0.0.0',
  dependencies: deps,
}, null, 2))
say('pinned peers:', JSON.stringify(deps))

say('\n--- npm install（registry 真实下载）---')
try {
  const out = execSync('npm install --no-audit --no-fund --loglevel=error', { cwd: tmp, encoding: 'utf8', timeout: 600000 })
  say('install ok')
} catch (e) {
  say('install FAILED:', (e.stdout || '') + (e.stderr || ''))
  process.exit(1)
}

// 纯类型引用（无 JSX）→ 不触碰 react/jsx-runtime，隔离 viewConfig 缺口
writeFileSync(path.join(tmp, 'main.ts'), `
import type {
  CayleyActionParam, CayleyPathHighlight, CayleyForceParams, Cayley3DFaceFillParams, TableStrategy,
  CayleyViewParams, Cayley3DViewParams, TableViewParams, SetViewParams, CycleViewParams,
  SymmetryViewParams, ActionViewParams, CosetStripViewParams, SublatticeViewParams, ViewWindowConfig,
} from '@groupviz/core'

const force: CayleyForceParams = { stiffness: 1.4 }
const hl: CayleyPathHighlight = { word: ['12', '23'], showOrder: true }
const acts: CayleyActionParam[] = [{ elementId: 'x' }]
const ff: Cayley3DFaceFillParams = { opacity: 0.5 }
const strat: TableStrategy = 'subgroup'
const cvp: CayleyViewParams = { force, pathHighlight: hl, actions: acts }
const c3p: Cayley3DViewParams = { pathHighlight: hl, faceFill: ff }
const tvp: TableViewParams = { strategy: strat }
const svp: SetViewParams = { nodeRadius: 24 }
const cyp: CycleViewParams = { showMaximalCycles: true }
const sym: SymmetryViewParams = { showAction: true }
const avp: ActionViewParams = { actionKind: 'regular' }
const csp: CosetStripViewParams = { cosetType: 'left' }
const slp: SublatticeViewParams = { mergeConjugates: true }
const cfg: ViewWindowConfig = { locked: true }

export const all = { cvp, c3p, tvp, svp, cyp, sym, avp, csp, slp, cfg }
`)
writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    strict: true, noEmit: true, skipLibCheck: false, types: [], lib: ['ES2022', 'DOM'],
  },
  include: ['main.ts'],
}, null, 2))

say('\n--- tsc --noEmit（skipLibCheck:false）---')
let ok = false
let raw = ''
try {
  raw = execSync(`"${process.execPath}" "${path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')}" --noEmit`, {
    cwd: tmp, encoding: 'utf8', stdio: 'pipe',
  })
  ok = true
} catch (e) {
  raw = (e.stdout || '') + (e.stderr || '')
}
const errs = raw.split('\n').filter((l) => /error TS/.test(l))
const vcErrs = errs.filter((l) => /Cayley|Table|viewConfig|SetViewParams|CycleView|Symmetry|ActionView|CosetStrip|Sublattice|ViewWindowConfig/.test(l))

say('tsc ok =', ok, '| 总 error 数 =', errs.length)
say('')
if (errs.length) say('全部 error:\n' + errs.join('\n'))
say('')
say('viewConfig 相关 error（应为 0）:', vcErrs.length)
if (vcErrs.length) say(vcErrs.join('\n'))
else say('✅ 0 条 —— 15 个 viewConfig 类型在 skipLibCheck:false 下全部可从 @groupviz/core 解析')

// 附带确认 react 的 .d.ts 内部 import 也干净（同一次 tsc 已覆盖，因为 skipLibCheck:false）
say('')
say('（skipLibCheck:false 已连带检查 @groupviz/react 全部 .d.ts 的 import 解析）')

try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 忽略 */ }

// fail-closed：任何 TS error 都算失败（本关卡的语义就是「零 error」）
const passed = errs.length === 0
say('')
say(passed
  ? `✅ consume:types 通过 —— @groupviz/{core,react}@${VERSION} 类型面对消费端完全可解析`
  : `❌ consume:types 失败 —— ${errs.length} 条 TS error（详见 ${REPORT}）`)
process.stdout.write(readFileSync(REPORT, 'utf8'))
process.exit(passed ? 0 : 1)

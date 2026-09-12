/**
 * 对比线上包与本地 dist-pkg：curl 抓 registry tarball 解包，逐字节比对 index.js。
 *
 * 目的：证明「上传的就是测过的产物」——若 sha256 一致，则本地跑过的所有门禁
 * （单测 / publish:smoke / consume:registry / consume:browser）对线上包同样成立。
 *
 * 用法：npm run consume:compare [-- 2.2.0]
 *   需**非沙箱**运行（curl 走网络）。默认取 package.json 的 version。
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const VERSION = process.argv[2] ?? pkg.version

const tmp = mkdtempSync(path.join(os.tmpdir(), 'gv-cmp-'))
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts })

let failures = 0

for (const [name, file] of [['@groupviz/core', 'core'], ['@groupviz/react', 'react']]) {
  const dir = path.join(tmp, file)
  mkdirSync(dir, { recursive: true })
  const tgz = path.join(dir, `${file}.tgz`)
  const url = `https://registry.npmjs.org/${name}/-/${file}-${VERSION}.tgz`
  sh(`curl -sSL --max-time 120 -o "${tgz}" "${url}"`)
  execSync(`tar -xzf "${tgz}" -C "${dir}"`, { stdio: 'ignore' })
  const pkgDir = path.join(dir, 'package')
  const idx = path.join(pkgDir, 'index.js')
  const buf = readFileSync(idx)
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)

  const localPath = path.join('dist-pkg', name, 'index.js')
  const lb = readFileSync(localPath)
  const localHash = createHash('sha256').update(lb).digest('hex').slice(0, 16)

  console.log(`\n=== ${name} ===`)
  console.log(`  registry index.js sha=${hash} size=${buf.length}`)
  console.log(`  local    index.js sha=${localHash} size=${lb.length}`)
  const same = hash === localHash
  console.log(`  一致: ${same ? 'YES' : 'NO ← 线上与本地不同'}`)
  if (!same) { failures++; console.log(`  ✗ ${name} 线上产物与本地 dist-pkg 不一致`) }
  const pj = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  console.log(`  version=${pj.version}  main=${pj.main}  types=${pj.types}  exports=${JSON.stringify(Object.keys(pj.exports || {}))}`)
  if (pj.version !== VERSION) { failures++; console.log(`  ✗ 线上版本 ${pj.version} ≠ 期望 ${VERSION}`) }
}
console.log(`\ntmp=${tmp}`)
console.log(failures === 0 ? '\n✅ 线上包与本地 dist-pkg 逐字节一致' : `\n✗ ${failures} 项不一致`)
process.exitCode = failures > 0 ? 1 : 0

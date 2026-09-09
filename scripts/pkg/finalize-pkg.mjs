/**
 * FGVE 阶段 3 — pkg 产物收尾脚本。
 *
 * 职责（在 vite lib build + tsc dts emit 之后运行）：
 *  1. dist-pkg/.dts（tsc --emitDeclarationOnly 输出，rootDir=src）分发：
 *     - core 子树   → dist-pkg/@groupviz/core/   （保留内部相对引用）
 *     - 其余子树    → dist-pkg/@groupviz/react/  并把相对 '../../core/...'
 *       引用改写为 '@groupviz/core'（宿主由 @groupviz/core 包供给类型）
 *  2. 从 src/index.css 自动提取 [data-theme] 变量块 → react/theme.css
 *  3. 生成两包 package.json（version 跟随根 package.json，zod/react 等依赖
 *     版本取自根 dependencies/devDependencies）
 */
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PKG_ROOT = path.join(ROOT, 'dist-pkg')
const DTS_ROOT = path.join(PKG_ROOT, '.dts')
const CORE_OUT = path.join(PKG_ROOT, '@groupviz', 'core')
const REACT_OUT = path.join(PKG_ROOT, '@groupviz', 'react')

const rootPkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
// 双包发布版本独立于主应用迭代版本：读根 package.json 的 pkgVersion（如 "2.0.0"），
// 缺省回落主版本（历史行为）。react peer 锁 @groupviz/core ^<pkgVersion>，两包必须成对同版发布。
const VERSION = rootPkg.pkgVersion ?? rootPkg.version
const REPO_URL = 'https://github.com/rrCathy/GroupViz'
const dep = (n) => rootPkg.dependencies?.[n] ?? rootPkg.devDependencies?.[n]
// peerDependencies 独立范围表（不跟主应用 deps）：以「消费端 registry 可达 + 主应用验证窗口」为准。
// 注意 ^ 对 0.x 语义锁 <0.(x+1) —— three/katex 的 0.x 生态需显式给区间。
const PEER_SCOPE = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  three: '>=0.184.0 <0.186.0',
  '@react-three/fiber': '^9.0.0',
  '@react-three/drei': '^10.0.0',
  katex: '^0.16.0',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.d.ts')) out.push(p)
  }
  return out
}

// ---------- 1. d.ts 分发 ----------
// 注意：不能 rm CORE_OUT/REACT_OUT —— vite lib build（emptyOutDir）已产出
// index.js/map 并清空过目标目录。tsc 的 .dts 产物此刻已在 DTS_ROOT，直接合并拷贝。
mkdirSync(CORE_OUT, { recursive: true })
mkdirSync(REACT_OUT, { recursive: true })

// 相对导入补 .js 扩展：NodeNext 消费端对 ESM 声明文件强制显式扩展名（否则 export *
// 链解析失败 → "no exported member"）；bundler 端同样兼容（TS 对 './x.js' 做声明
// 文件映射到 x.d.ts）。已带扩展（.css/.js/.json 等）的路径不动。
const REL_IMPORT_RE = /(\bfrom\s*)(['"])((?:\.{1,2}\/)[^'"]*)\2/g
const hasExt = (p) => /\.[A-Za-z0-9]+$/.test(p)
const addJsExt = (code) =>
  code.replace(REL_IMPORT_RE, (m, pre, q, p) => (hasExt(p) ? m : `${pre}${q}${p}.js${q}`))

const CORE_DTS = path.join(DTS_ROOT, 'core')
// core 子树整体平移（内部相对引用补扩展）——relative 基线与旧 cpSync 平铺语义一致（相对 CORE_DTS）
for (const f of walk(CORE_DTS)) {
  const rel = path.relative(CORE_DTS, f)
  const dest = path.join(CORE_OUT, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, addJsExt(readFileSync(f, 'utf8')))
}

// react 子树：复制、重写相对 core 引用为包名，再补扩展
for (const f of walk(DTS_ROOT).filter((x) => !x.startsWith(CORE_DTS + path.sep))) {
  const rel = path.relative(DTS_ROOT, f)
  const dest = path.join(REACT_OUT, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  let code = readFileSync(f, 'utf8')
  code = code.replace(/(from\s+['"])((?:\.\.\/)+)core(?:\/[^'"]*)?(['"])/g, "$1@groupviz/core$3")
  writeFileSync(dest, addJsExt(code))
}

// ---------- 2. theme.css 提取 ----------
const indexCss = readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf8')
const darkStart = indexCss.indexOf(':root,')
const lightStart = indexCss.indexOf('[data-theme="light"] {')
const themeCss = `/**
 * @groupviz/react 主题 CSS — 由 scripts/pkg/finalize-pkg.mjs 自动提取自 src/index.css。
 * 消费者入口：import '@groupviz/react/theme.css'
 */
/* ===== 深色（默认）===== */
${indexCss.slice(darkStart, lightStart)}
/* ===== 浅色 ===== */
${indexCss.slice(lightStart)}

/* ===== 视图基础类 ===== */
.view-svg {
  width: 100%;
  height: 100%;
}
.view-svg text {
  user-select: none;
  -webkit-user-select: none;
}
.view-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-subtle);
}
`
writeFileSync(path.join(REACT_OUT, 'theme.css'), themeCss)

// ---------- 3. package.json + LICENSE + README ----------
const CORE_KEYWORDS = ['group-theory', 'abstract-algebra', 'mathematics', 'visualization', 'cayley-graph', 'finite-groups', 'engine']
const REACT_KEYWORDS = ['group-theory', 'abstract-algebra', 'mathematics', 'visualization', 'cayley-graph', 'react', 'svg', 'threejs']

writeFileSync(
  path.join(CORE_OUT, 'package.json'),
  JSON.stringify(
    {
      name: '@groupviz/core',
      version: VERSION,
      description: 'GroupViz 群论可视化引擎 —— 纯算法层（群构造 / 布局 / 序列化），零 React/DOM 依赖',
      license: 'MIT',
      repository: { type: 'git', url: `git+${REPO_URL}.git` },
      keywords: CORE_KEYWORDS,
      type: 'module',
      main: './index.js',
      types: './index.d.ts',
      exports: {
        '.': { types: './index.d.ts', import: './index.js' },
      },
      dependencies: { zod: dep('zod') },
      sideEffects: false,
    },
    null,
    2
  ) + '\n'
)
writeFileSync(
  path.join(REACT_OUT, 'package.json'),
  JSON.stringify(
    {
      name: '@groupviz/react',
      version: VERSION,
      description: 'GroupViz 群论可视化 React 视图组件',
      license: 'MIT',
      repository: { type: 'git', url: `git+${REPO_URL}.git` },
      keywords: REACT_KEYWORDS,
      type: 'module',
      main: './index.js',
      types: './package/react.d.ts',
      exports: {
        '.': { types: './package/react.d.ts', import: './index.js' },
        './theme.css': './theme.css',
      },
      peerDependencies: {
        '@groupviz/core': `^${VERSION}`,
        ...PEER_SCOPE,
      },
      sideEffects: ['**/*.css'],
    },
    null,
    2
  ) + '\n'
)

// LICENSE（根 MIT）随包分发
cpSync(path.join(ROOT, 'LICENSE'), path.join(CORE_OUT, 'LICENSE'))
cpSync(path.join(ROOT, 'LICENSE'), path.join(REACT_OUT, 'LICENSE'))

// 简短包 README（npm 页面用；详细文档在主仓库 README + docs/）
writeFileSync(
  path.join(CORE_OUT, 'README.md'),
  `# @groupviz/core

GroupViz 群论可视化引擎的**纯算法层** —— 群构造 / 群性质 / 布局算法 / \`GroupDescriptor v1\` 序列化。
零 React/DOM 依赖（仅 \`zod\` 用于序列化校验），可在 Node / 浏览器 / 任意宿主中直接运行。

**能力**：群族（Sₙ / Cₙ / Dₙ / Aₙ / V₄ / Q₈ / GL(2,3)、直积 / 半直积 / 自同构 / 商群、SmallGroup(n,i) 注册表）、
子群与陪集枚举、共轭类、同态验证、Cayley / 循环图布局、轨道-稳定子、Sylow 定理、Todd–Coxeter。

**快速开始**

\`\`\`js
import { createGroupFromSymbol, serializeDescriptor, deserializeDescriptor } from '@groupviz/core'

const g = createGroupFromSymbol('S_{3}')
console.log(g.order) // 6

const json = serializeDescriptor(g)          // 序列化为跨应用交换的 JSON 契约
const restored = deserializeDescriptor(json) // 还原为可计算的群对象
\`\`\`

**配套**：React 视图组件见 [@groupviz/react](../react)。

完整文档：[GroupViz 主仓库](https://github.com/rrCathy/GroupViz)（docs/GROUPS.md · docs/CAYLEY.md · docs/VIEWS.md）。
MIT License。
`
)
writeFileSync(
  path.join(REACT_OUT, 'README.md'),
  `# @groupviz/react

GroupViz 群论可视化的 **React 视图组件**。与 [@groupviz/core](../core) 配套：core 出数据，react 出图。

**包含**：10 个视图 Scene（\`SetView\` / \`CycleView\` / \`CayleyView\` / \`TableView\` / \`CosetStripScene\` /
\`ActionScene\` / \`HomomorphismScene\` / \`SublatticeScene\` / \`Cayley3DScene\` / \`SymmetryViewScene\`）、
窗口容器壳 \`SceneWindow\`、\`I18nProvider\`（内置中 / 英文语言包）、\`theme.css\`（深 / 浅色主题变量）。

**安装**（npm 自动解析 peer：react 19 / three / @react-three/fiber / @react-three/drei / katex）

\`\`\`
npm i @groupviz/core @groupviz/react
\`\`\`

**快速开始**

\`\`\`tsx
import { I18nProvider, SetView } from '@groupviz/react'
import '@groupviz/react/theme.css'
import { createGroupFromSymbol } from '@groupviz/core'

const group = createGroupFromSymbol('C_{6}')

export function App() {
  return (
    <I18nProvider>
      <div style={{ width: 480, height: 360, background: '#0f1115' }}>
        <SetView
          group={group}
          selectedElements={new Set()}
          canvasTransform={{ x: 0, y: 0, scale: 1 }}
          viewBoxSize={{ width: 480, height: 360 }}
        />
      </div>
    </I18nProvider>
  )
}
\`\`\`

\`\`\`ts
import '@groupviz/react/theme.css' // 主题样式（模块化工程可 import 到全局）
\`\`\`

**交互约定**：Scene 是纯受控内核——标签显隐 / hover 气泡 / 选中高亮等由宿主通过 props
（\`showLabels\` / \`onHover\` / \`onSelect\`）注入；更多组合示例见仓库 \`examples/host-minimal/\`。

完整文档：[GroupViz 主仓库](https://github.com/rrCathy/GroupViz)（docs/VIEWS.md · docs/PRESENTATION.md）。
MIT License。
`
)

// 清理临时 dts。注意：本地沙箱可能拦截大批量删除（rmSync 递归删除 >50 文件 fail-closed），
// 这里容错处理——产物已生成完毕，.dts 残留不影响 dist-pkg/@groupviz/* 消费；无沙箱环境照常删净。
try {
  rmSync(DTS_ROOT, { recursive: true, force: true })
} catch (e) {
  console.warn(`[finalize-pkg] 清理 .dts 临时目录失败（可忽略，产物已就绪）: ${e instanceof Error ? e.message : String(e)}`)
}
console.log(`[finalize-pkg] @groupviz/core + @groupviz/react v${VERSION} 产物已生成`)

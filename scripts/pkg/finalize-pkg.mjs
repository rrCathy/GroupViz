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
const VERSION = rootPkg.version
const dep = (n) => rootPkg.dependencies?.[n] ?? rootPkg.devDependencies?.[n]

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

// core 子树整体平移（内部相对引用原样保留）
cpSync(path.join(DTS_ROOT, 'core'), CORE_OUT, { recursive: true })

// react 子树：复制并重写相对 core 引用
const reactDtsFiles = walk(DTS_ROOT).filter((f) => !f.startsWith(path.join(DTS_ROOT, 'core') + path.sep))
for (const f of reactDtsFiles) {
  const rel = path.relative(DTS_ROOT, f)
  const dest = path.join(REACT_OUT, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  let code = readFileSync(f, 'utf8')
  code = code.replace(/(from\s+['"])((?:\.\.\/)+)core(?:\/[^'"]*)?(['"])/g, "$1@groupviz/core$3")
  writeFileSync(dest, code)
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

// ---------- 3. package.json ----------
writeFileSync(
  path.join(CORE_OUT, 'package.json'),
  JSON.stringify(
    {
      name: '@groupviz/core',
      version: VERSION,
      description: 'GroupViz 群论可视化引擎 —— 纯算法层（群构造 / 布局 / 序列化），零 React/DOM 依赖',
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
      type: 'module',
      main: './index.js',
      types: './package/react.d.ts',
      exports: {
        '.': { types: './package/react.d.ts', import: './index.js' },
        './theme.css': './theme.css',
      },
      peerDependencies: {
        '@groupviz/core': `^${VERSION}`,
        react: dep('react'),
        'react-dom': dep('react-dom'),
        three: dep('three'),
        '@react-three/fiber': dep('@react-three/fiber'),
        '@react-three/drei': dep('@react-three/drei'),
        katex: dep('katex'),
        zod: dep('zod'),
      },
      sideEffects: ['**/*.css'],
    },
    null,
    2
  ) + '\n'
)

// 清理临时 dts。注意：本地沙箱可能拦截大批量删除（rmSync 递归删除 >50 文件 fail-closed），
// 这里容错处理——产物已生成完毕，.dts 残留不影响 dist-pkg/@groupviz/* 消费；无沙箱环境照常删净。
try {
  rmSync(DTS_ROOT, { recursive: true, force: true })
} catch (e) {
  console.warn(`[finalize-pkg] 清理 .dts 临时目录失败（可忽略，产物已就绪）: ${e instanceof Error ? e.message : String(e)}`)
}
console.log(`[finalize-pkg] @groupviz/core + @groupviz/react v${VERSION} 产物已生成`)

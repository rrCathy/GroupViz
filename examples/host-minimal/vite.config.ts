import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * host-minimal：消费仓库根 dist-pkg/@groupviz/{core,react} 本地产物，
 * 模拟真实 npm 消费者（vite alias 指向产物目录，等价于 node_modules 安装）。
 * dev 直接跑；build 时 react 系 peer 由根 node_modules 提供。
 */
const root = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // 正则完整匹配，避免 '@groupviz/react' 前缀吞掉子路径导入
      { find: /^@groupviz\/react\/theme\.css$/, replacement: path.join(root, 'dist-pkg/@groupviz/react/theme.css') },
      { find: /^@groupviz\/core$/, replacement: path.join(root, 'dist-pkg/@groupviz/core/index.js') },
      { find: /^@groupviz\/react$/, replacement: path.join(root, 'dist-pkg/@groupviz/react/index.js') },
    ],
  },
  server: {
    port: 5199,
    // host-minimal 在 examples/ 下,node_modules(KaTeX 字体)在仓库根 ——
    // 默认 fs.allow 只放工作区,需显式放行仓库根才能加载 KaTeX woff2。
    fs: { allow: [root] },
  },
  build: { outDir: 'dist' },
})

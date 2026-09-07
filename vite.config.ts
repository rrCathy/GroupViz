import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: [
      // FGVE 双包消费：TestPage 懒加载区块从 dist-pkg 产物 import，
      // 验证「主应用宿主消费 @groupviz/core + @groupviz/react」链路。
      // 正则完整匹配防 '@groupviz/react' 前缀吞掉 theme.css 子路径。
      {
        find: /^@groupviz\/react\/theme\.css$/,
        replacement: fileURLToPath(new URL('./dist-pkg/@groupviz/react/theme.css', import.meta.url)),
      },
      {
        find: /^@groupviz\/core$/,
        replacement: fileURLToPath(new URL('./dist-pkg/@groupviz/core/index.js', import.meta.url)),
      },
      {
        find: /^@groupviz\/react$/,
        replacement: fileURLToPath(new URL('./dist-pkg/@groupviz/react/index.js', import.meta.url)),
      },
    ],
  },
  build: {
    rolldownOptions: {
      output: {
        hoistTransitiveImports: false,
      },
    },
  },
})

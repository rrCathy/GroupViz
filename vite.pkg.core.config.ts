import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { pkgDir } from './scripts/pkg/config-common'

/** @groupviz/core — 纯算法包（src/core/index.ts 门面，zod external） */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: pkgDir('core'),
    lib: {
      entry: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['zod'],
      output: { exports: 'named' },
    },
    sourcemap: true,
    emptyOutDir: true,
    copyPublicDir: false, // lib 构建不消费 public（favicon 等）——防混入包产物
  },
})

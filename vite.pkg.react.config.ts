import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { coreToPackage, pkgDir } from './scripts/pkg/config-common'

/** @groupviz/react — 视图组件包（peer 依赖 external，core 引用重写为 @groupviz/core） */
export default defineConfig({
  plugins: [react(), coreToPackage()],
  build: {
    outDir: pkgDir('react'),
    lib: {
      entry: fileURLToPath(new URL('./src/package/react.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'katex',
        'zod',
        '@groupviz/core',
        /^three($|\/)/,
        /^@react-three\//,
      ],
      output: { exports: 'named' },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})

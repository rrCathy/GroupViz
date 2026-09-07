import type { Plugin } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const __root = fileURLToPath(new URL('../..', import.meta.url))

export function pkgDir(id: string) {
  return path.join(__root, 'dist-pkg', '@groupviz', id)
}

// Windows 下 path.resolve 输出反斜杠、vite importer 用正斜杠——统一规范化比较
const norm = (p: string) => p.replace(/\\/g, '/')
const coreRootNorm = norm(path.resolve(__root, 'src/core')) + '/'

/**
 * 把源码中相对 '../../core/...' 的导入改写为 '@groupviz/core'（external 包名）。
 *
 * 为什么不用 resolveId 插件：vite 8（rolldown）对相对路径走自带 resolver，
 * 自定义 resolveId 不会被 consult。transform 阶段直接改写 import 文本最可靠：
 * 模块文本变成 `from '@groupviz/core'` 后即被 rollupOptions.external 捕获。
 *
 * 仅处理 src 下非 core 文件（core 自身与测试不在构建图内；测试不经此构建）。
 */
const CORE_IMPORT_RE = /(['"])((?:\.\.\/)+core)(?:\/[^'"]*)?\1/g

export function coreToPackage(): Plugin {
  return {
    name: 'core-to-package',
    buildStart() {
      if (process.env.PKG_DEBUG) console.log('[coreToPackage] plugin active (buildStart)')
    },
    transform(code, id) {
      if (!id) return null
      const nid = norm(id)
      const srcRootNorm = norm(path.resolve(__root, 'src')) + '/'
      // 仅处理 src 下的文件（排除 core 自身、node_modules、dist）
      if (!nid.startsWith(srcRootNorm)) return null
      if (nid.startsWith(coreRootNorm)) return null
      CORE_IMPORT_RE.lastIndex = 0
      if (!CORE_IMPORT_RE.test(code)) return null
      CORE_IMPORT_RE.lastIndex = 0
      const out = code.replace(CORE_IMPORT_RE, "'@groupviz/core'")
      if (process.env.PKG_DEBUG) console.log(`[coreToPackage] rewrote ${id.slice(-60)}`)
      return { code: out, map: null }
    },
  }
}

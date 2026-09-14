import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/utils/**'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 85,
        lines: 85,
      },
    },
    projects: [
      {
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['src/__tests__/**/*.test.ts'],
          // 保守的 30s（默认 5s）：阶界限重定到 ENUMERATION_LIMIT=144 后，
          // S₅(120) / D₆₀ 这类群从「守卫短路返回空」变成「真跑子群枚举」——
          // 本机约 1–2s，CI 慢机器 2–3 倍，5s 默认值必然误报超时（实测 CI 挂过
          // semidirectDecompositions / detectStructureType 两条）。真卡死仍会被
          // 兜住；个别测试另有更紧的显式超时。
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'dom',
          globals: true,
          environment: 'happy-dom',
          include: [
            'src/__tests__/**/*.component.test.tsx',
            'src/__tests__/**/*.integration.test.tsx',
          ],
          setupFiles: ['src/test/setup.ts'],
          // 同上：dom 侧有 SublatticeScene(S₅) 这类「真算 + 渲染」测试
          testTimeout: 30_000,
        },
      },
    ],
  },
})

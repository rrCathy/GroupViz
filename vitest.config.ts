import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // 全量四层纳入统计。阈值按 2026-09-22 实测基线分层（per-glob 口径含子目录，
      // 比 text 报告的顶层目录行更严）：
      //   core ~96 / utils ~87 / context ~36 / components ~2（% stmts，全目录）
      // context/components 的低阈值是「防倒退线」——不代表质量达标，
      // 作用是任何人删测试或新代码完全裸奔时 coverage 直接红；
      // 后续补测试后应同步上调。
      include: ['src/core/**', 'src/utils/**', 'src/context/**', 'src/components/**'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/core/**': { statements: 85, branches: 70, functions: 85, lines: 85 },
        'src/utils/**': { statements: 85, branches: 70, functions: 85, lines: 85 },
        'src/context/**': { statements: 34, branches: 22, functions: 29, lines: 36 },
        'src/components/**': { statements: 2, branches: 0, functions: 3, lines: 2 },
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

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
        },
      },
    ],
  },
})

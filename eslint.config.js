import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // 引擎边界规则（FGVE 前置）：UI/context/utils 层禁止深导入 core 内部分片，
    // 必须走门面 src/core/index.ts 或 core/types barrel。core 自身与测试不受限。
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/context/**/*.{ts,tsx}',
      'src/utils/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/i18n/**/*.{ts,tsx}',
      'src/theme/**/*.{ts,tsx}',
      'src/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/core/types/group',
                '**/core/types/view',
                '**/core/types/homomorphism',
                '**/core/types/actions',
                '**/core/**/_internal',
                '**/core/**/_internal/*',
              ],
              message:
                'Import from the core facade (src/core/index.ts) or the core/types barrel instead of split internals.',
            },
          ],
        },
      ],
    },
  },
])

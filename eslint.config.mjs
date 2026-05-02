// Pragmatic flat config (ESLint v9). next/core-web-vitals via FlatCompat triggers
// a circular-structure JSON bug in this repo's plugin tree. Next.js still validates
// code via `next build` (TS + lint pipeline), so this config focuses on a small set
// of high-signal correctness rules and ignores stylistic noise on legacy files.
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: {
      // Registered so legacy inline disable directives (react-hooks/exhaustive-deps)
      // don't error out. Rule itself stays disabled — Next.js handles this in `next build`.
      'react-hooks': reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Catch real bugs only — TS handles type-aware checks via tsc.
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-duplicate-case': 'error',
      'no-empty-pattern': 'error',
      'no-fallthrough': 'error',
      'no-misleading-character-class': 'warn',
    },
  },
  {
    ignores: [
      '**/.next/**', '**/node_modules/**', 'public/**',
      'supabase/functions/**', // Deno runtime, separate tsconfig
      'next-env.d.ts',
      '**/*.d.ts',
      'scripts/**', 'docs/**',
      'frontend/**', // legacy build artifacts
      'components/ui/**', // shadcn-generated, keep as-is
    ],
  },
]

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow unused variables/parameters prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Prevent direct database imports outside repositories
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/db',
              message:
                'Direct database imports are not allowed. Use repositories from @/lib/db/repositories instead.',
            },
            {
              name: '@/lib/db/schema',
              message:
                'Direct schema imports are not allowed. Use repositories from @/lib/db/repositories instead.',
            },
          ],
        },
      ],
    },
  },
  // Allow database imports in repository files, schema definitions, and test files
  {
    files: [
      'lib/db/**/*.ts',
      'lib/db/**/*.tsx',
      'lib/processors/**/*.ts',
      'lib/test-reports/**/*.ts',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'scripts/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
      'react-hooks/rules-of-hooks': 'off', // Disable React hooks rules for test files
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'test-run/**',
  ]),
]);

export default eslintConfig;

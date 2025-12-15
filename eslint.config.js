/**
 * ESLint Configuration (Flat Config Format)
 *
 * This project uses ESLint 9.x with the new flat config format.
 *
 * Plugins:
 * - @eslint/js: Core ESLint recommended rules
 * - typescript-eslint: TypeScript-aware linting
 * - eslint-plugin-react-hooks: Enforces React hooks rules
 * - eslint-plugin-react-refresh: Warns about HMR compatibility
 * - eslint-config-prettier: Disables ESLint rules that conflict with Prettier
 *
 * Rule Documentation:
 * - ESLint rules: https://eslint.org/docs/rules/
 * - TypeScript rules: https://typescript-eslint.io/rules/
 * - React Hooks rules: https://react.dev/reference/rules/rules-of-hooks
 * - React Refresh: https://github.com/ArnaudBarre/eslint-plugin-react-refresh
 *
 * To modify rules, add them to the `rules` object in the second config block.
 * Use 'error', 'warn', or 'off' as severity levels.
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // First config block: Global ignores
  {
    ignores: [
      // Build output
      'dist',
      'dist-ssr',
      // AI tooling folders (not project code)
      '.bmad',
      '.claude',
      '.agent',
      '.cursor',
      '.serena',
      // Dependencies
      'node_modules',
      // Generated/config files
      '*.config.js',
      '*.config.ts',
      // Backend (Supabase has its own tooling)
      'supabase',
      // Scripts (separate tooling)
      'scripts',
      // Test coverage reports
      'coverage',
    ],
  },
  // Second config block: TypeScript/React linting rules
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React hooks rules (from eslint-plugin-react-hooks)
      ...reactHooks.configs.recommended.rules,
      // HMR compatibility warning (allowConstantExport for barrel files)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Warn about console statements (should be removed before production)
      'no-console': 'warn',
    },
  },
  // Third config block: Prettier compatibility (must be last to override conflicting rules)
  eslintConfigPrettier
);

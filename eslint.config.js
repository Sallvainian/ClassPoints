import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
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
      // Generated/config
      '*.config.js',
      '*.config.ts',
      // Supabase
      'supabase',
      // Scripts
      'scripts',
      // Coverage
      'coverage',
    ],
  },
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
      ...reactHooks.configs.recommended.rules,
      // react-hooks 7's recommended preset enables the React Compiler ruleset as
      // errors. The compiler is not enabled here (see vite.config.ts), and
      // set-state-in-effect fires on idiomatic, correct patterns (prop-reset
      // effects, timer-driven toasts) plus fetch-in-effect hooks slated for the
      // TanStack Query migration. Track as warnings rather than churn working code.
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  }
);

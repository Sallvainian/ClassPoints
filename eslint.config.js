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
      // react-hooks 7's recommended preset enables the React Compiler ruleset.
      // The compiler is not enabled here (see vite.config.ts), so set-state-in-effect
      // also fires on correct, idiomatic patterns (prop-reset effects, timer-driven
      // toasts, external-system init). Keep it at 'error' (the recommended default)
      // and disable per-site with a justification: permanent escape hatches where the
      // effect is genuinely correct, or TEMP notes where a refactor is still pending
      // (e.g. the TanStack migration of the fetch-in-effect hooks).
      'react-hooks/set-state-in-effect': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  }
);

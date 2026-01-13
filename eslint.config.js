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
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // Allow React Context pattern exports (context objects and consumer hooks)
          // These are standard React patterns that co-locate context, provider, and hook
          allowExportNames: [
            // Context objects
            'AuthContext',
            'HybridAppContext',
            'SoundContext',
            'SupabaseAppContext',
            // Consumer hooks (re-exports for backwards compatibility)
            'useAuth',
            'useApp',
            'useHybridApp',
            'useSoundContext',
            'useSupabaseApp',
          ],
        },
      ],
    },
  }
);

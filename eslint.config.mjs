import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/api/drizzle/**',
      'graphify-out/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': 'error',
    },
  },
  // Next's preset re-registers @typescript-eslint, which is already registered above.
  ...nextVitals.map(({ plugins, ...c }) => {
    const { '@typescript-eslint': _dup, ...rest } = plugins ?? {};
    return { ...c, plugins: rest, files: ['apps/web/**/*.{ts,tsx,js,jsx}'] };
  }),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: 'apps/web' } },
  },
);

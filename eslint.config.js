import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Bewusst schlank.
 *
 * Formatierung prueft dieser Satz Regeln nicht, dafuer gibt es keinen Streit zu
 * schlichten. Geprueft wird, was stillschweigend kaputtgeht: ungenutzte
 * Bezeichner, lose Vergleiche, vergessene Rueckgaben, verwaiste Promises.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test/fixtures/**', 'test/golden/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);

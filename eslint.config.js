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
    files: ['src/**/*.ts', 'test/**/*.ts', 'scripts/**/*.ts', 'vite.config.ts'],
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
  {
    // Apps Script kennt keine Module. Funktionen auf oberster Ebene sind global
    // und werden ueber /* exported */ als bewusst ungenutzt markiert.
    files: ['apps-script/**/*.js'],
    languageOptions: { ecmaVersion: 2019, sourceType: 'script', globals: {} },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'error',
    },
  },
  {
    // Die Preis Skripte laufen in der Konsole, dort ist console.log die Ausgabe.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);

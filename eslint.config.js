import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },

  js.configs.recommended,

  // Le lint typé ne s'applique qu'aux fichiers du projet TypeScript.
  // eslint.config.js lui-même n'en fait pas partie.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  /*
   * Le garde-fou. C'est la seule règle non négociable du projet : `sim/` et
   * `data/` ne connaissent ni Pixi, ni le rendu, ni l'UI, ni le DOM.
   *
   * Sans elle, la règle s'érode en trois semaines et on perd d'un coup les
   * tests headless, la sauvegarde par sérialisation et la possibilité de
   * déplacer la simulation dans un Web Worker.
   */
  {
    files: ['src/sim/**', 'src/data/**'],
    rules: {
      /*
       * Variante typescript-eslint plutôt que la règle de base : elle voit
       * aussi les `import type`, que la règle ESLint native laisse passer.
       */
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: ['pixi.js', '**/render/*', '**/ui/*'] },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'sim/ ne connaît pas le DOM.' },
        { name: 'document', message: 'sim/ ne connaît pas le DOM.' },
      ],
    },
  },

  // Tests et outillage tournent en Node, pas dans le navigateur.
  {
    files: ['**/*.test.ts', 'src/tools/**'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['*.config.ts', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
);

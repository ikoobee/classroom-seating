import js from '@eslint/js';
import globals from 'globals';

export default [
  // Vendored third-party library, not our code
  { ignores: ['assets/vendor/**'] },

  js.configs.recommended,

  {
    rules: {
      // CJK full-width spaces (U+3000) are legitimate separators inside
      // Chinese UI strings; only flag irregular whitespace in actual code.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
    },
  },

  {
    files: ['js/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },

  {
    files: ['tests/_node.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // scripts drive a browser from node (page.waitForFunction callbacks run in DOM context)
      globals: { ...globals.node, ...globals.browser },
    },
  },
];

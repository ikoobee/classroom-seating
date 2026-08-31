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
    files: ['tests/_node.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];

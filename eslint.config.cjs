module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backend/**',
      'playwright-report/**',
      'test-results/**',
      '.cursor/**'
    ]
  },
  {
    files: ['src/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'e2e/**/*.js', '*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-debugger': 'error'
    }
  }
];

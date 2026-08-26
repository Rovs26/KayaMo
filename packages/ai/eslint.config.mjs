import packageConfig from '@kayamo/config/eslint/package';

export default [
  ...packageConfig,
  {
    files: ['src/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];

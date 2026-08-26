import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import {
  RESTRICTED_AI_DYNAMIC_IMPORTS,
  RESTRICTED_AI_PROVIDER_PATTERNS,
  RESTRICTED_AI_PROVIDER_PATHS,
} from './restricted-ai.mjs';

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  globalIgnores(['dist/**', 'node_modules/**', '.turbo/**', 'coverage/**']),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-imports': [
        'error',
        { paths: RESTRICTED_AI_PROVIDER_PATHS, patterns: RESTRICTED_AI_PROVIDER_PATTERNS },
      ],
      'no-restricted-syntax': ['error', ...RESTRICTED_AI_DYNAMIC_IMPORTS],
    },
  },
]);

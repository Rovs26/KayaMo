import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import {
  RESTRICTED_AI_DYNAMIC_IMPORTS,
  RESTRICTED_AI_PROVIDER_PATTERNS,
  RESTRICTED_AI_PROVIDER_PATHS,
} from './restricted-ai.mjs';

const SERVICE_ROLE_IMPORT = {
  name: '@kayamo/db/service',
  message:
    'Service-role client is server-only. Never import it into a Client Component or any .tsx file.',
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'playwright-report/**']),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: RESTRICTED_AI_PROVIDER_PATHS, patterns: RESTRICTED_AI_PROVIDER_PATTERNS },
      ],
      'no-restricted-syntax': ['error', ...RESTRICTED_AI_DYNAMIC_IMPORTS],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...RESTRICTED_AI_PROVIDER_PATHS, SERVICE_ROLE_IMPORT],
          patterns: RESTRICTED_AI_PROVIDER_PATTERNS,
        },
      ],
      'no-restricted-syntax': ['error', ...RESTRICTED_AI_DYNAMIC_IMPORTS],
    },
  },
]);

import packageConfig from '@kayamo/config/eslint/package';
import {
  RESTRICTED_AI_DYNAMIC_IMPORTS,
  RESTRICTED_AI_PROVIDER_PATTERNS,
  RESTRICTED_AI_PROVIDER_PATHS,
} from '@kayamo/config/eslint/restricted-ai';

const FEATURES_BANNED = [
  {
    name: '@kayamo/db/service',
    message:
      'Service-role access stays in apps/admin. Features use the anon client under RLS, or a port injected by the app.',
  },
  {
    name: '@kayamo/mobile',
    message: 'Native plugins stay in apps. Inject NativePorts from the PWA shell.',
  },
  {
    name: '@kayamo/mobile/native',
    message: 'Native plugins stay in apps. Inject NativePorts from the PWA shell.',
  },
  {
    name: 'next/headers',
    message: 'Next request APIs stay in apps. Pass cookies and headers in from the route.',
  },
  {
    name: 'next/server',
    message: 'Next server APIs stay in apps. Features must not import next/server.',
  },
];

export default [
  ...packageConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...RESTRICTED_AI_PROVIDER_PATHS, ...FEATURES_BANNED],
          patterns: RESTRICTED_AI_PROVIDER_PATTERNS,
        },
      ],
      'no-restricted-syntax': ['error', ...RESTRICTED_AI_DYNAMIC_IMPORTS],
    },
  },
];

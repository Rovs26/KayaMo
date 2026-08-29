import config from '@kayamo/config/vitest/node';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

const liveDatabaseTests = ['src/rls.test.ts', 'src/*.integration.test.ts'];

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ['./src/vitest-setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
      exclude:
        process.env.RUN_DB_TESTS === '1'
          ? configDefaults.exclude
          : [...configDefaults.exclude, ...liveDatabaseTests],
    },
  }),
);

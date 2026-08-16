import config from '@kayamo/config/vitest/node';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  config,
  defineConfig({
    test: {
      setupFiles: ['./src/vitest-setup.ts'],
    },
  }),
);

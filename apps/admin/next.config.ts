import type { NextConfig } from 'next';
import { loadRootEnv } from '../../packages/db/src/load-root-env';

loadRootEnv();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@kayamo/db', '@kayamo/food', '@kayamo/ui'],
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@kayamo/ai',
    '@kayamo/core',
    '@kayamo/db',
    '@kayamo/food',
    '@kayamo/offline',
    '@kayamo/ui',
  ],
};

export default nextConfig;

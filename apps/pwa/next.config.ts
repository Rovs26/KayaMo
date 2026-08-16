import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

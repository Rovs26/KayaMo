import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kayamo/db', '@kayamo/ui'],
};

export default nextConfig;

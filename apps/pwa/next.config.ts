import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';
import { loadRootEnv } from '../../packages/db/src/load-root-env';

loadRootEnv();

/** Phone testing hits the LAN address, which Next 16 blocks unless listed. */
function allowedDevHosts(): string[] {
  const hosts = new Set(['127.0.0.1', 'localhost']);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) hosts.add(addr.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevHosts(),
  transpilePackages: [
    '@kayamo/ai',
    '@kayamo/core',
    '@kayamo/db',
    '@kayamo/features',
    '@kayamo/food',
    '@kayamo/offline',
    '@kayamo/ui',
    '@kayamo/mobile',
  ],
  ...(process.env.CAPACITOR_BUILD === '1'
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
      }
    : {}),
  async headers() {
    if (process.env.CAPACITOR_BUILD === '1') return [];
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;

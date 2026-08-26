import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KayaMo',
    short_name: 'KayaMo',
    id: 'ph.kayamo.app',
    description: 'Personal Growth OS. Mus is the companion — mustard seed, not a coach.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#1F3D2B',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: 'Quick log',
        short_name: 'Log food',
        description: 'Open search and barcode logging',
        url: '/app?action=quick-log',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Log weight',
        short_name: 'Weight',
        description: 'Log today’s weight',
        url: '/app?action=log-weight',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}

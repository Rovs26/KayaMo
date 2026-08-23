import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KayaMo — Coco AI Companion',
    short_name: 'KayaMo',
    description: 'A supportive AI companion for daily consistency, health, and goals.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f8ff',
    theme_color: '#2f67d8',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}

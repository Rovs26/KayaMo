import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';

const sourceSans = localFont({
  src: './fonts/source-sans-3-latin.woff2',
  weight: '400 600',
  variable: '--font-source-sans',
  display: 'swap',
});

const barlow = localFont({
  src: [
    { path: './fonts/barlow-condensed-500-latin.woff2', weight: '500' },
    { path: './fonts/barlow-condensed-600-latin.woff2', weight: '600' },
    { path: './fonts/barlow-condensed-700-latin.woff2', weight: '700' },
  ],
  variable: '--font-barlow',
  display: 'swap',
});

const plex = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400-latin.woff2', weight: '400' },
    { path: './fonts/ibm-plex-mono-500-latin.woff2', weight: '500' },
  ],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KayaMo',
  description: 'Personal Growth OS. Mus is the companion — mustard seed, not a coach.',
  applicationName: 'KayaMo',
  appleWebApp: { capable: true, title: 'KayaMo', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1F3D2B',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${barlow.variable} ${plex.variable} h-full`}
    >
      <body className="min-h-full font-body antialiased">{children}</body>
    </html>
  );
}

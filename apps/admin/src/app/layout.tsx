import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'KayaMo admin',
  description: 'Internal tools — never public',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-bg font-body text-text antialiased">{children}</body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CommandPalette } from './command-palette';
import { SignOutButton } from './sign-out-button';
import styles from './shell.module.css';

const LINKS = [
  { href: '/app/food', label: 'Food history' },
  { href: '/app/home', label: 'Home' },
  { href: '/app/goals', label: 'Goals' },
  { href: '/app/life', label: 'Life' },
  { href: '/app/grove', label: 'Grove' },
  { href: '/app/mus', label: 'Mus' },
  { href: '/app/settings', label: 'Settings' },
] as const;

export function DesktopShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>KayaMo</p>
        <nav className={styles.nav} aria-label="Desktop">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className={styles.hint}>
          {email}
          <br />
          Command palette <span className={styles.k}>⌘K</span>
        </p>
        <SignOutButton />
      </aside>
      <div className={styles.main}>
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}

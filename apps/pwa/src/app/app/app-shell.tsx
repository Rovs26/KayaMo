'use client';

import dynamic from 'next/dynamic';
import styles from './kayamo-app.module.css';

const KayaMoApp = dynamic(() => import('./kayamo-app').then((mod) => ({ default: mod.KayaMoApp })), {
  ssr: false,
  loading: () => (
    <div className={styles.viewport}>
      <div className={styles.shell} />
    </div>
  ),
});

export function AppShell({ userId, email }: { userId: string; email: string }) {
  return <KayaMoApp userId={userId} email={email} />;
}

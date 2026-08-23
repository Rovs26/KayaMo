import type { ReactNode } from 'react';
import { OfflineRoot } from './offline-root';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return <OfflineRoot>{children}</OfflineRoot>;
}

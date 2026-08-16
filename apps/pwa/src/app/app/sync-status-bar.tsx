'use client';

import { useSyncStatus } from '@kayamo/offline';

function label(status: ReturnType<typeof useSyncStatus>): string {
  switch (status.kind) {
    case 'offline':
      return 'Offline';
    case 'pending':
      return `Pending ${status.count}`;
    case 'paused':
      return 'Sync paused';
    case 'synced':
      return 'Synced';
  }
}

export function SyncStatusBar() {
  const status = useSyncStatus();
  return (
    <p
      data-testid="sync-status"
      data-sync-kind={status.kind}
      className="mb-3 font-data text-caption uppercase tracking-[0.14em] text-muted"
    >
      {label(status)}
    </p>
  );
}

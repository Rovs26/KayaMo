import { liveQuery } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LocalFoodEntry } from './db';
import { bindStatusStore, getSyncStatusSnapshot, type SyncStatus } from './sync';
import { listLocalFoodEntries } from './writes';

const SSR_STATUS: SyncStatus = { kind: 'synced' };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(bindStatusStore, getSyncStatusSnapshot, () => SSR_STATUS);
}

export function useLiveFoodEntries(userId: string | null, logicalDate: string): LocalFoodEntry[] {
  const [rows, setRows] = useState<LocalFoodEntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    const subscription = liveQuery(() => listLocalFoodEntries(userId, logicalDate)).subscribe({
      next: setRows,
      error: () => setRows([]),
    });
    return () => subscription.unsubscribe();
  }, [userId, logicalDate]);

  return rows;
}

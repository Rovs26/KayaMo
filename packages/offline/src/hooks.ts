import { liveQuery } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LocalFoodEntry, LocalMealTemplate } from './db';
import { bindStatusStore, getSyncStatusSnapshot, type SyncStatus } from './sync';
import { listLocalFoodEntries, listLocalFoodHistory, listLocalMealTemplates } from './writes';

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

export function useLiveFoodHistory(userId: string | null): LocalFoodEntry[] {
  const [rows, setRows] = useState<LocalFoodEntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    const subscription = liveQuery(() => listLocalFoodHistory(userId)).subscribe({
      next: setRows,
      error: () => setRows([]),
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  return rows;
}

export function useLiveMealTemplates(userId: string | null): LocalMealTemplate[] {
  const [rows, setRows] = useState<LocalMealTemplate[]>([]);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    const subscription = liveQuery(() => listLocalMealTemplates(userId)).subscribe({
      next: setRows,
      error: () => setRows([]),
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  return rows;
}

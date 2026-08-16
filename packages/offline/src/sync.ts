import type { DbClient, FoodEntryWrite, UpsertResult } from '@kayamo/db';
import {
  DbQueryError,
  insertWeightLog,
  insertWorkout,
  isUnauthorizedError,
  upsertFoodEntry,
} from '@kayamo/db';
import { backoffMs } from './backoff';
import { getOfflineDb, type SyncQueueItem, type SyncableTable } from './db';
import { dueQueueItems, markQueueFailure, pendingCount, removeQueueItem } from './queue';
import { notifySyncStatus, subscribeSyncStatus } from './status';

export type SyncDeps = {
  getClient: () => DbClient;
};

export type SyncStatus =
  | { kind: 'offline' }
  | { kind: 'pending'; count: number }
  | { kind: 'synced' }
  | { kind: 'paused' };

const state = {
  paused: false,
  draining: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  deps: null as SyncDeps | null,
};

let snapshot: SyncStatus = { kind: 'synced' };

export function getSyncStatusSnapshot(): SyncStatus {
  return snapshot;
}

function setOnlineFlag(online: boolean): void {
  state.online = online;
  refreshSnapshot();
  notifySyncStatus();
}

function refreshSnapshot(): void {
  if (!state.online) {
    snapshot = { kind: 'offline' };
    return;
  }
  if (state.paused) {
    snapshot = { kind: 'paused' };
    return;
  }
  if (state.pending > 0) {
    snapshot = { kind: 'pending', count: state.pending };
    return;
  }
  snapshot = { kind: 'synced' };
}

async function refreshPending(): Promise<void> {
  try {
    state.pending = await pendingCount();
  } catch {
    state.pending = 0;
  }
  refreshSnapshot();
  notifySyncStatus();
}

export function resumeSync(): void {
  state.paused = false;
  refreshSnapshot();
  notifySyncStatus();
  void drainQueue();
}

export async function drainQueue(): Promise<void> {
  if (state.paused || state.draining) return;
  if (!state.online) {
    await refreshPending();
    return;
  }
  const deps = state.deps;
  if (!deps) return;

  const client = deps.getClient();
  const { data } = await client.auth.getSession();
  if (!data.session) {
    state.paused = true;
    await refreshPending();
    return;
  }

  state.draining = true;
  try {
    const due = await dueQueueItems();
    for (const item of due) {
      if (state.paused) break;
      try {
        await applyItem(client, item);
        await removeQueueItem(item.id);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          state.paused = true;
          break;
        }
        const delay = backoffMs(item.attempt);
        await markQueueFailure(item, Date.now() + delay, errorCode(error));
        scheduleDrain(delay);
      }
    }
  } finally {
    state.draining = false;
    await refreshPending();
  }
}

function scheduleDrain(delayMs: number): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = 0;
    void drainQueue();
  }, delayMs);
}

async function insertIgnoringDuplicate(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof DbQueryError && error.code === '23505') return;
    throw error;
  }
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('failed to fetch') || error.name === 'TypeError') {
      return 'network';
    }
    return 'error';
  }
  return 'error';
}

async function applyItem(client: DbClient, item: SyncQueueItem): Promise<void> {
  switch (item.table) {
    case 'food_entries': {
      const result: UpsertResult = await upsertFoodEntry(client, item.payload as FoodEntryWrite);
      if (result.applied) {
        await getOfflineDb().food_entries.put(result.row);
      }
      return;
    }
    case 'weight_logs': {
      await insertIgnoringDuplicate(async () => {
        await insertWeightLog(client, item.payload as Parameters<typeof insertWeightLog>[1]);
      });
      return;
    }
    case 'workouts': {
      await insertIgnoringDuplicate(async () => {
        await insertWorkout(client, item.payload as Parameters<typeof insertWorkout>[1]);
      });
      return;
    }
    case 'workout_sets': {
      const { error } = await client
        .from('workout_sets')
        .upsert(item.payload as never, { onConflict: 'id' });
      if (error) throw error;
    }
  }
}

function drainSoon(): void {
  void drainQueue();
}

export function startSync(deps: SyncDeps): () => void {
  state.deps = deps;
  if (typeof window === 'undefined') {
    return () => {};
  }

  setOnlineFlag(navigator.onLine);
  void refreshPending();
  drainSoon();

  const onOnline = () => {
    setOnlineFlag(true);
    drainSoon();
  };
  const onOffline = () => setOnlineFlag(false);
  const onVisible = () => {
    if (document.visibilityState === 'visible') drainSoon();
  };
  const onFocus = () => drainSoon();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onFocus);

  const unsubAuth = deps.getClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      resumeSync();
    }
    if (event === 'SIGNED_OUT') {
      state.paused = true;
      refreshSnapshot();
      notifySyncStatus();
    }
  });

  void refreshPending();

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    unsubAuth.data.subscription.unsubscribe();
    if (state.timer) clearTimeout(state.timer);
    state.deps = null;
  };
}

export function bindStatusStore(onChange: () => void): () => void {
  return subscribeSyncStatus(onChange);
}

export function isSyncableTable(value: string): value is SyncableTable {
  return (
    value === 'food_entries' ||
    value === 'weight_logs' ||
    value === 'workouts' ||
    value === 'workout_sets'
  );
}

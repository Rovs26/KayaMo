type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeSyncStatus(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function notifySyncStatus(): void {
  for (const listener of listeners) {
    listener();
  }
}

import { loadRootEnv } from './load-root-env';

loadRootEnv();

/**
 * supabase-js always constructs a realtime client. Node 20 has no global
 * WebSocket; tests only use Auth + REST, so a closed stub is enough.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  class TestWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 3;
    url = '';
    protocol = '';
    onopen: ((this: TestWebSocket, ev: Event) => unknown) | null = null;
    onmessage: ((this: TestWebSocket, ev: MessageEvent) => unknown) | null = null;
    onclose: ((this: TestWebSocket, ev: CloseEvent) => unknown) | null = null;
    onerror: ((this: TestWebSocket, ev: Event) => unknown) | null = null;
    close(): void {}
    send(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
  }
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
}

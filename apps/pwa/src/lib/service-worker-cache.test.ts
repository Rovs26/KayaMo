import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type WorkerEvent = {
  request?: RequestLike;
  respondWith?: (response: Promise<Response> | Response) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

type RequestLike = {
  method: string;
  url: string;
  mode?: string;
  destination?: string;
};

type WorkerListener = (event: WorkerEvent) => void;

const workerSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

function requestKey(request: RequestLike | string): string {
  return typeof request === 'string' ? request : request.url;
}

function createWorkerHarness() {
  const listeners = new Map<string, WorkerListener>();
  const stores = new Map<string, Map<string, Response>>();
  const cacheMatch = vi.fn(async (request: RequestLike | string) => {
    const key = requestKey(request);
    for (const store of stores.values()) {
      const response = store.get(key);
      if (response) return response.clone();
    }
    return undefined;
  });
  const cachePut = vi.fn(async (cacheName: string, request: RequestLike | string, response: Response) => {
    const store = stores.get(cacheName) ?? new Map<string, Response>();
    store.set(requestKey(request), response.clone());
    stores.set(cacheName, store);
  });
  const caches = {
    open: vi.fn(async (cacheName: string) => ({
      match: (request: RequestLike | string) => {
        const response = stores.get(cacheName)?.get(requestKey(request));
        return Promise.resolve(response?.clone());
      },
      put: (request: RequestLike | string, response: Response) =>
        cachePut(cacheName, request, response),
      add: vi.fn(async () => undefined),
    })),
    match: cacheMatch,
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (cacheName: string) => stores.delete(cacheName)),
  };
  const fetchMock = vi.fn(async () => new Response('network response', { status: 200 }));
  const workerSelf = {
    location: { origin: 'https://kayamo.test' },
    addEventListener: (type: string, listener: WorkerListener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), openWindow: vi.fn() },
    registration: { showNotification: vi.fn() },
  };

  runInNewContext(workerSource, {
    self: workerSelf,
    caches,
    fetch: fetchMock,
    URL,
    Response,
    Request,
    Promise,
    Set,
    Error,
  });

  function seed(cacheName: string, url: string, body: string) {
    const store = stores.get(cacheName) ?? new Map<string, Response>();
    store.set(url, new Response(body, { status: 200 }));
    stores.set(cacheName, store);
  }

  async function dispatchFetch(request: RequestLike) {
    let response: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    listeners.get('fetch')?.({
      request,
      respondWith: (value) => { response = Promise.resolve(value); },
      waitUntil: (work) => waits.push(work),
    });
    return { response: response ? await response : undefined, waits };
  }

  async function activate() {
    const waits: Promise<unknown>[] = [];
    listeners.get('activate')?.({ waitUntil: (work) => waits.push(work) });
    await Promise.all(waits);
  }

  return { activate, caches, cacheMatch, cachePut, dispatchFetch, fetchMock, seed, stores };
}

describe('KayaMo service-worker cache privacy', () => {
  it('serves authenticated API GETs from the network without reading or writing Cache Storage', async () => {
    const worker = createWorkerHarness();
    const url = 'https://kayamo.test/api/mus/respond';
    worker.seed('kayamo-api-v1', url, 'account A private response');

    const { response } = await worker.dispatchFetch({ method: 'GET', url });

    expect(await response?.text()).toBe('network response');
    expect(worker.fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ url }),
      { cache: 'no-store' },
    );
    expect(worker.cacheMatch).not.toHaveBeenCalled();
    expect(worker.cachePut).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it('keeps food API GETs network-only', async () => {
    const worker = createWorkerHarness();
    const url = 'https://kayamo.test/api/foods/search?q=adobo';
    worker.seed('kayamo-food-swr-v1', url, 'account A food response');

    const { response } = await worker.dispatchFetch({ method: 'GET', url });

    expect(await response?.text()).toBe('network response');
    expect(worker.cacheMatch).not.toHaveBeenCalled();
    expect(worker.cachePut).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it('continues to serve safe static resources from the public cache', async () => {
    const worker = createWorkerHarness();
    const url = 'https://kayamo.test/_next/static/app.js';
    worker.seed('kayamo-public-v3', url, 'cached static asset');

    const { response, waits } = await worker.dispatchFetch({
      method: 'GET', url, destination: 'script',
    });
    await Promise.all(waits);

    expect(await response?.text()).toBe('cached static asset');
    expect(worker.cacheMatch).toHaveBeenCalledOnce();
    expect(worker.fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps authenticated app documents network-only', async () => {
    const worker = createWorkerHarness();
    const url = 'https://kayamo.test/app';

    const { response } = await worker.dispatchFetch({
      method: 'GET', url, mode: 'navigate', destination: 'document',
    });

    expect(await response?.text()).toBe('network response');
    expect(worker.cacheMatch).not.toHaveBeenCalled();
    expect(worker.cachePut).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it('removes superseded KayaMo cache versions on activation without touching other apps', async () => {
    const worker = createWorkerHarness();
    worker.seed('kayamo-public-v2', '/offline', 'old public cache');
    worker.seed('kayamo-food-swr-v1', '/api/foods/search', 'old food cache');
    worker.seed('kayamo-api-v1', '/api/profile', 'old API cache');
    worker.seed('kayamo-public-v3', '/offline', 'current public cache');
    worker.seed('another-app-cache', '/asset.js', 'unrelated cache');

    await worker.activate();

    expect([...worker.stores.keys()].sort()).toEqual([
      'another-app-cache',
      'kayamo-public-v3',
    ]);
  });

  it('does not intercept or cache non-GET requests', async () => {
    const worker = createWorkerHarness();

    const { response } = await worker.dispatchFetch({
      method: 'POST', url: 'https://kayamo.test/api/mus/respond',
    });

    expect(response).toBeUndefined();
    expect(worker.fetchMock).not.toHaveBeenCalled();
    expect(worker.cacheMatch).not.toHaveBeenCalled();
    expect(worker.cachePut).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
  });
});

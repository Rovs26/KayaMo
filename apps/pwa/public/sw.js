/**
 * Service worker — Workbox recipes, inlined because /sw.js CSP is script-src 'self'.
 *
 * - App shell: precache offline fallbacks on install
 * - Food lookups (/api/foods/* GET): stale-while-revalidate
 * - Other API GET: network-first
 * - Navigations: network-only (user data lives in IndexedDB), offline fallback
 */
const CACHE = 'kayamo-public-v2';
const FOOD_CACHE = 'kayamo-food-swr-v1';
const API_CACHE = 'kayamo-api-v1';
const OFFLINE_URL = '/offline';
const OFFLINE_APP_URL = '/offline/app';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const pages = await Promise.all([OFFLINE_URL, OFFLINE_APP_URL].map((url) => fetch(url)));
    const assets = new Set(['/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png']);
    for (const response of pages) {
      await cache.put(new URL(response.url).pathname, response.clone());
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        const url = new URL(match[1], self.location.origin);
        if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
          assets.add(url.pathname + url.search);
        }
      }
    }
    await Promise.all([...assets].map((url) => cache.add(url).catch(() => undefined)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE, FOOD_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('kayamo-') && !keep.has(key)).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) {
      void cache.put(request, response.clone());
    }
    return response;
  });
  if (cached) {
    void network.catch(() => undefined);
    return cached;
  }
  return network;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/auth/')) return;

  if (url.pathname.startsWith('/api/foods')) {
    event.respondWith(staleWhileRevalidate(request, FOOD_CACHE));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (request.mode === 'navigate') {
    // Never cache authenticated HTML; user data lives in IndexedDB instead.
    if (url.pathname.startsWith('/app')) {
      event.respondWith(fetch(request).catch(() => Response.redirect(OFFLINE_APP_URL, 302)));
    } else {
      const fallback = url.pathname === OFFLINE_APP_URL ? OFFLINE_APP_URL : OFFLINE_URL;
      event.respondWith(fetch(request).catch(() => caches.match(fallback)));
    }
    return;
  }

  if (!['style', 'script', 'image', 'font', 'manifest'].includes(request.destination)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      if (cached) {
        event.waitUntil(network.catch(() => undefined));
        return cached;
      }
      return network;
    }),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'A gentle nudge from Mus';
  const body = typeof data.body === 'string' ? data.body.slice(0, 240) : 'Your next small action is waiting when you are ready.';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/app';
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'kayamo-nudge',
    data: { url }, renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url || '/app';
  event.waitUntil(self.clients.openWindow(url));
});

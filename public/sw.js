const CACHE_NAME = 'pachas-offline-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/manifest.json',
  '/icon.svg',
  '/dashboard',
  '/profile',
  '/legal',
  '/terms',
  '/privacy',
  '/cookies',
];

// 1. Install event: Precache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Pre-caching partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate event: Clean up old caches & take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate & Cache-First Strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET, cross-origin or chrome-extension requests
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Bypass API routes so SyncQueue and client fetch handlers manage data synchronization
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Strategy A: Static Chunks & Media (Cache-First with Background Update)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Strategy B: HTML Pages & Navigation (Network-First with Offline Cache Fallback)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fallback to dashboard or root offline shell
        const dashCached = await caches.match('/dashboard');
        if (dashCached) return dashCached;

        const rootCached = await caches.match('/');
        if (rootCached) return rootCached;

        return new Response('<h1>Sin conexión</h1><p>Estás en modo sin conexión.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })
  );
});

// 4. WebPush Event: Handle background push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Pachas 💸',
    body: 'Hay una nueva actividad en tu grupo de viaje.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    url: '/dashboard',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
      ...data.data,
    },
    tag: data.tag || 'pachas-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Ver' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Notification Click Event: Focus or open target page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

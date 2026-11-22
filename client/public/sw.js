const APP_BASE = '__APP_BASE__';
const CACHE_PREFIX = `bookkeeping:${encodeURIComponent(APP_BASE)}:`;
const CACHE = `${CACHE_PREFIX}__BUILD_ID__`;
const PRECACHE = '__PRECACHE__';
self.addEventListener('install', (event) => {
  if (Array.isArray(PRECACHE))
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE &&
                (key.startsWith(CACHE_PREFIX) ||
                  (APP_BASE === '/' && key.startsWith('bookkeeping-'))),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(APP_BASE)
  )
    return;
  // Only the application shell is cached. API and unrelated repositories bypass this worker.
  if (
    !Array.isArray(PRECACHE) ||
    (!PRECACHE.includes(url.pathname) && event.request.mode !== 'navigate')
  )
    return;
  event.respondWith(
    (async () => {
      if (event.request.mode === 'navigate') {
        try {
          return await fetch(event.request);
        } catch {
          return (
            (await caches.match(`${APP_BASE}index.html`, {
              cacheName: CACHE,
            })) || Response.error()
          );
        }
      }
      return (
        (await caches.match(event.request, { cacheName: CACHE })) ||
        fetch(event.request)
      );
    })(),
  );
});
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const payload = event.data?.json();
        if (!payload?.localDate || !payload.timeZone) return;
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: payload.timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date());
        const get = (type) => parts.find((p) => p.type === type).value;
        const today = `${get('year')}-${get('month')}-${get('day')}`;
        if (today !== payload.localDate) return;
        await self.registration.showNotification('今天記帳了嗎？', {
          body: '花一分鐘，記下今天的生活。',
          tag: `bookkeeping-${APP_BASE}-${payload.localDate}`,
          icon: `${APP_BASE}icon-192.png`,
          data: { url: APP_BASE },
        });
      } catch {
        /* Expired or invalid notifications are never displayed. */
      }
    })(),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        const client = clients.find((c) => {
          const url = new URL(c.url);
          return (
            url.origin === self.location.origin &&
            url.pathname.startsWith(APP_BASE)
          );
        });
        if (client) return client.focus();
        return self.clients.openWindow(APP_BASE);
      }),
  );
});

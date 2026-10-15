const CACHE = 'mj-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Sin conexión: la app y los últimos datos se sirven desde la caché.
// - /assets/* (nombres con hash, no cambian): caché primero.
// - Página y GET /api/data: red primero; si falla, lo último guardado.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  const isPage = req.mode === 'navigate';
  if (isPage || url.pathname === '/api/data') {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(isPage ? '/' : req, copy)); }
      return res;
    }).catch(async () => (await caches.match(isPage ? '/' : req)) || Response.error()));
  }
});

let unread = 0;

self.addEventListener('push', (event) => {
  let data = { title: 'M&J 🦄', body: 'Hay novedades en vuestro presupuesto.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Avisamos a las pestañas abiertas para que recarguen los datos al instante
      clientList.forEach((c) => c.postMessage({ type: 'mj-data-changed' }));

      // Contador en el icono de la app (como WhatsApp), donde el sistema lo permita
      unread += 1;
      try { await self.navigator.setAppBadge?.(unread); } catch { /* no soportado */ }

      // Tag único: cada aviso se apila en vez de sustituir al anterior
      await self.registration.showNotification(data.title || 'M&J 🦄', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: `mj-${data.ts || Date.now()}`,
        vibrate: [120, 60, 120],
        timestamp: data.ts || Date.now(),
        data: { url: '/' }
      });
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'mj-clear-badge') {
    unread = 0;
    try { self.navigator.clearAppBadge?.(); } catch { /* no soportado */ }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'M&J 🦄', body: 'Hay novedades en vuestro presupuesto.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      // Avisamos a las pestañas abiertas para que recarguen los datos al instante
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((c) => c.postMessage({ type: 'mj-data-changed' }));

      await self.registration.showNotification(data.title || 'M&J 🦄', {
        body: data.body || '',
        icon: '/favicon.svg',
        tag: 'mj-push',
        renotify: true,
        vibrate: [80, 40, 80],
        data: { url: '/' }
      });
    })()
  );
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

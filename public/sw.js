self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'M&J 🦄', body: 'Hay novedades en vuestro presupuesto.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // si no viene como JSON, usamos el mensaje por defecto
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'M&J 🦄', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mj-push',
      renotify: true,
      vibrate: [80, 40, 80]
    })
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

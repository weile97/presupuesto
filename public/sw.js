// public/sw.js

// Escucha del evento push proveniente del servidor WebPush
self.addEventListener('push', (event) => {
  let data = {
    title: 'M&J 🦄',
    body: 'Se ha realizado una actualización en las finanzas.'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Redireccionar o enfocar la app al hacer clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Instalación inmediata del Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activación y toma de control inmediata
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
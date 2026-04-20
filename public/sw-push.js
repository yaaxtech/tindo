/* Service worker dedicado para Web Push — evita conflito com next-pwa (sw.js). */

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.titulo || 'TinDo';
  const options = {
    body: data.corpo || '',
    icon: '/icon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/cards' },
    tag: data.tag || 'tindo-notif',
    renotify: !!data.renotify,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/cards';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

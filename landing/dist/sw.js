// Retire the former application's service worker on the marketing origin.
// The application on its new origin has its own independent service worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('nivel-shell-')).map(key => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(client => client.navigate(client.url)));
  })());
});

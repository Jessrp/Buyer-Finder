// BuyrFindr Service Worker v1
const CACHE = 'buyrfindr-v1';

const STATIC = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/auth.js',
  '/posts.js',
  '/matching.js',
  '/matches.js',
  '/messages.js',
  '/notifications.js',
  '/conversations.js',
  '/map.js',
  '/boot_alerts.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fall back to cache
self.addEventListener('fetch', e => {
  const { request } = e;

  // Skip non-GET and Supabase API calls (always need fresh data)
  if (request.method !== 'GET') return;
  if (request.url.includes('supabase.co')) return;
  if (request.url.includes('googleapis.com')) return;

  e.respondWith(
    fetch(request)
      .then(res => {
        // Cache successful responses
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'BuyrFindr', {
      body: data.body || 'You have a new match or message.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click — open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data.url || '/');
    })
  );
});

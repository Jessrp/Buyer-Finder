// public/sw.js  ← put this file in your repo ROOT (same level as index.html)
// Service worker: handles incoming push notifications and notification clicks

self.addEventListener("push", (event) => {
  let data = { title: "BuyrFindr", body: "You have a new notification", url: "/" };
  try {
    data = event.data.json();
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",   // add your app icon here if you have one
      badge: "/icons/badge-72.png",  // small monochrome icon for Android
      data: { url: data.url },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});

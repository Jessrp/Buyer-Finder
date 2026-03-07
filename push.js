// push.js  ← add to your repo and include in index.html before app.js
// Registers the service worker and asks for push notification permission
// after the user signs in.

(function () {
  // Called from auth.js after a user successfully signs in
  async function initPush(userId) {
    if (!userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push notifications not supported on this browser.");
      return;
    }

    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("✅ Service worker registered");

      // Check existing permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Push permission denied.");
        return;
      }

      // Get existing subscription or create a new one
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
        });
      }

      // Save subscription to Supabase via our API
      await fetch("/api/save-push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subscription: sub.toJSON() }),
      });

      console.log("✅ Push subscription saved");
    } catch (err) {
      console.error("Push init error:", err);
    }
  }

  // Helper: convert VAPID key from base64 to Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  window.PushNotifications = { initPush };
})();

// push.js — client-side push subscription management for BuyrFindr
(function () {
  const VAPID_PUBLIC_KEY = "BE7zGWx-1yRinlo-8Yii_saNVPSpMz3yyrn7d7vUTzBMwxSG_w-gGolkx6lMN6sQoqlLw_tpgeXCQ5Mbb6hFHWk";

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push not supported on this browser.");
      return null;
    }
    if (!window.currentUser) {
      console.warn("Must be signed in to enable push.");
      return null;
    }

    // Ask permission (only prompts if not already decided)
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      console.log("Push permission not granted:", permission);
      return null;
    }

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Save subscription to the user's profile
    const { error } = await window.supa
      .from("profiles")
      .update({ push_subscriptions: [sub.toJSON()] })
      .eq("id", window.currentUser.id);

    if (error) {
      console.error("Failed to save push subscription:", error.message);
      return null;
    }

    console.log("✓ Push subscription saved");
    return sub;
  }

  async function unsubscribeFromPush() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
    }
    if (window.currentUser) {
      await window.supa
        .from("profiles")
        .update({ push_subscriptions: [] })
        .eq("id", window.currentUser.id);
    }
    console.log("Push unsubscribed");
  }

  window.Push = { subscribeToPush, unsubscribeFromPush };
})();

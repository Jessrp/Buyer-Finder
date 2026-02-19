// boot.alerts.js — waits for auth + supabase then starts Alerts realtime + loads alerts
(function () {
  console.error("🧩 BOOT.ALERTS.JS LOADED");

  function start() {
    try {
      window.Notifications?.init?.();
      window.Notifications?.initRealtime?.();
      window.Notifications?.load?.();
      console.log("BOOT: Notifications realtime started");
      return true;
    } catch (e) {
      console.warn("BOOT: Notifications start failed", e);
      return false;
    }
  }

  // Poll for readiness (auth may finish after DOMContentLoaded)
  let tries = 0;
  const maxTries = 40; // ~10s
  const timer = setInterval(() => {
    tries++;
    const ready = !!window.supa && !!window.currentUser && !!window.Notifications;
    if (ready) {
      clearInterval(timer);
      start();
      return;
    }
    if (tries >= maxTries) {
      clearInterval(timer);
      console.warn("BOOT: Notifications not started (missing supa/currentUser/Notifications).");
    }
  }, 250);
})();

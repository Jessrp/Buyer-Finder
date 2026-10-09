// boot.alerts.js — waits for auth + supabase then starts Alerts realtime + loads alerts
(function () {
  console.log("🧩 BOOT.ALERTS.JS LOADED");

  let started = false;

  function start() {
    if (started) return true;
    try {
      window.Notifications?.init?.();
      window.Notifications?.initRealtime?.();
      window.Notifications?.load?.();
      window.Notifications?.refreshBadge?.();
      started = true;
      console.log("BOOT: Notifications realtime started");
      return true;
    } catch (e) {
      console.warn("BOOT: Notifications start failed, will retry", e);
      return false;
    }
  }

  // Poll until ready — no more 10s give-up. Handles late sign-in,
  // slow auth, and script load order. Stops polling once started.
  const timer = setInterval(() => {
    if (started) { clearInterval(timer); return; }
    const ready = !!window.supa && !!window.currentUser && !!window.Notifications;
    if (ready) {
      if (start()) clearInterval(timer);
    }
  }, 500);

  // Also start immediately on sign-in if supabase auth fires
  const hookAuth = setInterval(() => {
    if (started) { clearInterval(hookAuth); return; }
    if (window.supa?.auth?.onAuthStateChange) {
      clearInterval(hookAuth);
      window.supa.auth.onAuthStateChange((_event, session) => {
        if (session?.user && !started) {
          // small delay so auth.js can set window.currentUser first
          setTimeout(start, 300);
        }
      });
    }
  }, 500);
})();

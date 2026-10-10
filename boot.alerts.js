// boot.alerts.js — starts Alerts for the signed-in user, and cleans up on sign-out / account switch
(function () {
  console.log("BOOT.ALERTS.JS LOADED");
  let lastUid = null;

  function clearUserViews() {
    try { window.Notifications?.stop?.(); } catch (e) {}
    const hint = "<p class='hint'>Sign in to see this.</p>";
    ["conversations-list", "inbox-list", "matches-list"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = hint;
    });
    // close any open chat thread
    const overlay = document.getElementById("bf-chat-overlay");
    if (overlay) overlay.style.display = "none";
    const wrap = document.getElementById("bf-chat-wrap");
    if (wrap) wrap.style.display = "none";
    const inbox = document.getElementById("inbox-list");
    if (inbox) inbox.style.display = "block";
    // leave "My Posts" / "Favorites" modes and go Home
    window.activeMineOnly = false;
    window.activeFavoritesOnly = false;
    window.setActiveView?.("posts");
    window.Posts?.loadPosts?.();
  }

  function startForUser() {
    try {
      window.Notifications?.init?.();
      window.Notifications?.initRealtime?.();
      window.Notifications?.load?.();
      window.Notifications?.refreshBadge?.();
      console.log("BOOT: Notifications started");
    } catch (e) {
      console.warn("BOOT: Notifications start failed", e);
    }
  }

  // Runs on a timer so it also catches late sign-in, slow auth, sign-out and account switches
  function tick() {
    if (!window.supa || !window.Notifications) return;
    const uid = window.currentUser ? window.currentUser.id : null;
    if (uid === lastUid) return;
    const hadUser = !!lastUid;
    lastUid = uid;
    if (uid) startForUser();
    else if (hadUser) clearUserViews();
  }

  setInterval(tick, 500);

  const hookAuth = setInterval(() => {
    if (window.supa?.auth?.onAuthStateChange) {
      clearInterval(hookAuth);
      window.supa.auth.onAuthStateChange(() => setTimeout(tick, 350));
    }
  }, 500);
})();

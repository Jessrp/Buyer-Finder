// app.js — HARDENED UI WIRING (nav + search + BF+ prompt + on-screen errors)
// Does NOT create UI. Does NOT change layout. Only wires existing IDs.

(() => {
  const debugBar = document.querySelector(".debug-bar");

  function debug(msg) {
    if (debugBar) debugBar.textContent = "DEBUG: " + msg;
  }

  // Show real JS errors on-screen (since you can't rely on DevTools)
  window.addEventListener("error", (e) => {
    debug("JS ERROR: " + (e?.message || "unknown"));
  });

  window.addEventListener("unhandledrejection", (e) => {
    debug("PROMISE ERROR: " + (e?.reason?.message || e?.reason || "unknown"));
  });

  // ----- DOM
  const views = {
    posts: document.getElementById("view-posts"),
    map: document.getElementById("view-map"),
    matches: document.getElementById("view-matches"),
    notifications: document.getElementById("view-notifications"),
    settings: document.getElementById("view-settings"),
  };

  const nav = {
    selling: document.getElementById("nav-selling"),
    requests: document.getElementById("nav-requests"),
    matches: document.getElementById("nav-matches"),
    notifications: document.getElementById("nav-notifications"),
    map: document.getElementById("nav-map"),
    settings: document.getElementById("nav-settings"),
  };

  const fabAdd = document.getElementById("fab-add");

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  const bfPlusPrompt = document.getElementById("bfPlusPrompt");
  const upgradeBtn = document.getElementById("upgradeBtn");

  const mapMsg = document.getElementById("map-message");

  // ----- Global app state (single source of truth)
  window.viewMode = window.viewMode || "all"; // 'all' | 'mine' (future)
  window.activePostType = window.activePostType || "selling"; // 'selling' | 'request'

  function isPremium() {
    return !!window.currentProfile?.premium;
  }

  function setActiveNav(activeEl) {
    Object.values(nav).forEach((el) => el?.classList.remove("active"));
    activeEl?.classList.add("active");
  }

  function showView(which) {
    Object.values(views).forEach((v) => v?.classList.remove("active"));
    views[which]?.classList.add("active");

    // FAB only on posts view
    if (fabAdd) fabAdd.style.display = which === "posts" ? "flex" : "none";
  }

  function refreshBfPlusPrompt() {
    if (!bfPlusPrompt) return;
    if (isPremium()) bfPlusPrompt.classList.add("hidden");
    else bfPlusPrompt.classList.remove("hidden");
  }

  function runSearch() {
    const q = (searchInput?.value || "").trim();
    window.Posts?.loadPosts?.(q);
    window.Posts?.recordSearchQuery?.(q);
  }

  // ----- NAV HANDLERS
  nav.selling?.addEventListener("click", () => {
    window.activePostType = "selling";
    setActiveNav(nav.selling);
    showView("posts");
    runSearch(); // refresh list
    debug("nav: selling");
  });

  nav.requests?.addEventListener("click", () => {
    window.activePostType = "request";
    setActiveNav(nav.requests);
    showView("posts");
    runSearch();
    debug("nav: requests");
  });

  nav.matches?.addEventListener("click", () => {
    setActiveNav(nav.matches);
    showView("matches");
    window.Posts?.loadMatches?.();
    debug("nav: matches");
  });

  nav.notifications?.addEventListener("click", () => {
    setActiveNav(nav.notifications);
    showView("notifications");
    window.Posts?.loadNotifications?.();
    debug("nav: notifications");
  });

  nav.settings?.addEventListener("click", () => {
    setActiveNav(nav.settings);
    showView("settings");
    refreshBfPlusPrompt();
    debug("nav: settings");
  });

  nav.map?.addEventListener("click", () => {
    setActiveNav(nav.map);

    if (!isPremium()) {
      showView("settings");
      refreshBfPlusPrompt();
      debug("map blocked: BF+ required");
      if (mapMsg) mapMsg.textContent = "Map requires BF+. Upgrade to unlock.";
      return;
    }

    showView("map");
    refreshBfPlusPrompt();
    debug("nav: map");
  });

  // ----- SEARCH HANDLERS
  searchBtn?.addEventListener("click", runSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // ----- BF+ prompt button (hands off to auth.js handler)
  upgradeBtn?.addEventListener("click", () => {
    debug("BF+ clicked");
    // auth.js already handles upgrading in dev-mode
  });

  // ----- INITIAL BOOT
  document.addEventListener("DOMContentLoaded", () => {
    // default to selling tab
    setActiveNav(nav.selling);
    showView("posts");
    refreshBfPlusPrompt();

    // give other scripts a moment to attach
    setTimeout(() => {
      runSearch();
      debug("boot ok");
    }, 300);
  });

  // Also refresh when auth state changes (auth.js sets these globals)
  setInterval(() => {
    refreshBfPlusPrompt();
  }, 800);
})();

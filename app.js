// app.js — HARDENED UI WIRING (nav + search + BF+ prompt + on-screen errors)
// Does NOT create UI. Does NOT change layout. Only wires existing IDs.

(() => {
  // -------------------------------
  // SUPABASE CLIENT (FIXED)
  // -------------------------------
  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

  if (!window.supa) {
    window.supa = supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }

  // -------------------------------
  // DEBUG BAR
  // -------------------------------
  const debugBar = document.querySelector(".debug-bar");

  function debug(msg) {
    if (debugBar) debugBar.textContent = "DEBUG: " + msg;
  }

  window.addEventListener("error", (e) => {
    debug("JS ERROR: " + (e?.message || "unknown"));
  });

  window.addEventListener("unhandledrejection", (e) => {
    debug("PROMISE ERROR: " + (e?.reason?.message || e?.reason || "unknown"));
  });

  // -------------------------------
  // DOM
  // -------------------------------
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

  // -------------------------------
  // GLOBAL STATE
  // -------------------------------
  window.viewMode = window.viewMode || "all";
  window.activePostType = window.activePostType || "selling";

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

  // -------------------------------
  // NAV HANDLERS
  // -------------------------------
  nav.selling?.addEventListener("click", () => {
    window.activePostType = "selling";
    setActiveNav(nav.selling);
    showView("posts");
    runSearch();
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

  // -------------------------------
  // SEARCH
  // -------------------------------
  searchBtn?.addEventListener("click", runSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  upgradeBtn?.addEventListener("click", () => {
    debug("BF+ clicked");
  });

  // -------------------------------
  // BOOT
  // -------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav(nav.selling);
    showView("posts");
    refreshBfPlusPrompt();
    setTimeout(() => {
      runSearch();
      debug("boot ok");
    }, 300);
  });

  setInterval(refreshBfPlusPrompt, 800);
})();

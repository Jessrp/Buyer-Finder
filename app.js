// app.js – nav, views, search, theme, BF+ gating + Stripe upgrade
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling";

  // ─── FREE TIER LIMITS ───────────────────────────────────────────
  window.BF_LIMITS = {
    MAX_POSTS:    3,   // free users can only have 3 posts
    MAX_MESSAGES: 10,  // free users can only send 10 messages
  };

  // ─── BF+ HELPER ─────────────────────────────────────────────────
  function isBFPlus(profile) {
    if (!profile) return false;
    if (profile.premium === true) return true;
    const exp = profile.bfplus_expires_at || profile.bfPlus_expires_at || profile.bfplusExpiresAt;
    if (!exp) return false;
    const t = new Date(exp).getTime();
    return Number.isFinite(t) && t > Date.now();
  }
  window.isBFPlus = isBFPlus;

  // ─── STRIPE CHECKOUT ────────────────────────────────────────────
  async function startUpgrade() {
    const user    = window.currentUser;
    const profile = window.currentProfile;

    if (!user) {
      alert("Please sign in first to upgrade to BF+.");
      return;
    }

    if (isBFPlus(profile)) {
      alert("You're already BF+! Enjoy the perks 🎉");
      return;
    }

    const btn = document.getElementById("btn-upgrade-premium");
    if (btn) { btn.disabled = true; btn.textContent = "Loading..."; }

    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email:  profile?.email || user.email || "",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.url) {
        throw new Error(json.error || "Could not start checkout.");
      }

      // Redirect to Stripe checkout page
      window.location.href = json.url;

    } catch (err) {
      console.error("Upgrade error:", err);
      alert("Upgrade failed: " + (err.message || "unknown error"));
      if (btn) { btn.disabled = false; btn.textContent = "Upgrade to BF+"; }
    }
  }
  window.startUpgrade = startUpgrade;

  // ─── HANDLE RETURN FROM STRIPE ──────────────────────────────────
  // Stripe redirects back with ?upgraded=1 or ?cancelled=1
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("upgraded") === "1") {
    window.history.replaceState({}, "", "/");
    // Wait a moment for webhook to update Supabase, then reload profile
    setTimeout(async () => {
      if (window.Auth && typeof window.Auth.checkUser === "function") {
        await window.Auth.checkUser();
      }
      alert("🎉 Welcome to BF+! Your map and unlimited posts are now unlocked.");
    }, 2000);
  }
  if (urlParams.get("cancelled") === "1") {
    window.history.replaceState({}, "", "/");
    alert("Upgrade cancelled. You can upgrade any time from Settings.");
  }

  // ─── NAV ELEMENTS ───────────────────────────────────────────────
  window.setActiveView = setActiveView;

  const navSelling       = document.getElementById("nav-selling");
  const navRequests      = document.getElementById("nav-requests");
  const navMap           = document.getElementById("nav-map");
  const navSettings      = document.getElementById("nav-settings");
  const navMatches       = document.getElementById("nav-matches");
  const navNotifications = document.getElementById("nav-notifications");

  const searchInput =
    document.getElementById("search-input") ||
    document.getElementById("searchinput");
  const searchBtn =
    document.getElementById("search-btn") ||
    document.getElementById("searchgo");

  function setActiveView(view) {
    activeView = view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const section = document.getElementById("view-" + view);
    if (section) section.classList.add("active");

    if (navSelling)       navSelling.classList.toggle("active",       view === "posts" && window.activePostType === "selling");
    if (navRequests)      navRequests.classList.toggle("active",      view === "posts" && window.activePostType === "requesting");
    if (navMap)           navMap.classList.toggle("active",           view === "map");
    if (navSettings)      navSettings.classList.toggle("active",      view === "settings");
    if (navMatches)       navMatches.classList.toggle("active",       view === "matches");
    if (navNotifications) navNotifications.classList.toggle("active", view === "notifications");
  }

  function getSearchQuery() {
    return searchInput ? searchInput.value.trim() : "";
  }

  function refreshPosts() {
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts(getSearchQuery());
    }
  }

  // ─── SEARCH ─────────────────────────────────────────────────────
  function runSearch() { refreshPosts(); }

  if (searchBtn && !searchBtn.dataset.bound) {
    searchBtn.dataset.bound = "true";
    searchBtn.addEventListener("click", runSearch);
  }
  if (searchInput && !searchInput.dataset.enterBound) {
    searchInput.dataset.enterBound = "true";
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  }
  if (searchInput && !searchInput.dataset.liveBound) {
    searchInput.dataset.liveBound = "true";
    searchInput.addEventListener("input", runSearch);
  }

  // ─── POST TYPE ──────────────────────────────────────────────────
  function setActivePostType(type) {
    window.activePostType = (type === "request") ? "requesting" : type;
    setActiveView("posts");
    refreshPosts();
  }

  if (navSelling)  navSelling.addEventListener("click",  () => setActivePostType("selling"));
  if (navRequests) navRequests.addEventListener("click", () => setActivePostType("requesting"));

  // ─── MATCHES ────────────────────────────────────────────────────
  if (navMatches) {
    navMatches.addEventListener("click", () => {
      setActiveView("matches");
      if (window.Matches && typeof window.Matches.loadMatches === "function") {
        window.Matches.loadMatches();
      }
    });
  }

  // ─── ALERTS ─────────────────────────────────────────────────────
  if (navNotifications) {
    navNotifications.addEventListener("click", () => {
      setActiveView("notifications");
      if (window.Notifications && typeof window.Notifications.load === "function") {
        window.Notifications.load();
      }
    });
  }

  // ─── MAP (BF+ only) ─────────────────────────────────────────────
  if (navMap) {
    navMap.addEventListener("click", () => {
      const profile = window.currentProfile;
      if (!window.currentUser) {
        alert("Sign in to use the map.");
        return;
      }
      if (!isBFPlus(profile)) {
        const go = confirm("🗺 The map is a BF+ feature ($4.99/mo).\n\nWant to upgrade now?");
        if (go) startUpgrade();
        return;
      }
      if (window.BFMap && typeof window.BFMap.initMap === "function") {
        window.BFMap.initMap();
      }
      setActiveView("map");
    });
  }

  // ─── SETTINGS ───────────────────────────────────────────────────
  if (navSettings) navSettings.addEventListener("click", () => setActiveView("settings"));

  // Upgrade button in settings
  const btnUpgrade = document.getElementById("btn-upgrade-premium");
  if (btnUpgrade) {
    btnUpgrade.addEventListener("click", startUpgrade);
  }

  // Theme toggle
  const btnTheme = document.getElementById("btn-toggle-theme");
  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
    });
  }

  // Delete account
  const btnDelete = document.getElementById("btn-delete-account");
  if (btnDelete) {
    btnDelete.addEventListener("click", async () => {
      const confirmed = confirm("Are you sure? This permanently deletes your account and all your posts. There is no undo.");
      if (!confirmed) return;
      alert("Account deletion requires contacting support for now. Email us at support@buyerfinder.app");
    });
  }

  // ─── DEFAULT LOAD ───────────────────────────────────────────────
  setActiveView("posts");
  refreshPosts();

  // Note: Notifications/Alerts init is handled by boot.alerts.js
});
      

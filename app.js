// app.js – nav, views, search, theme, BF+ gating
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling"; // "selling" | "requesting"

  // BF+ helper: true if profile.premium OR bfplus_expires_at is in the future
  function isBFPlus(profile) {
    if (!profile) return false;
    if (profile.premium === true) return true;
    const exp = profile.bfplus_expires_at || profile.bfPlus_expires_at || profile.bfplusExpiresAt;
    if (!exp) return false;
    const t = new Date(exp).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  // Expose for other modules (notifications click, etc.)
  window.setActiveView = setActiveView;

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");
  const navMatches = document.getElementById("nav-matches");
  const navNotifications = document.getElementById("nav-notifications");

  // Search input can be either id (older HTML uses searchinput)
  const searchInput = document.getElementById("search-input") || document.getElementById("searchinput");
  const searchBtn = document.getElementById("search-btn") || document.getElementById("searchgo");

  function setActiveView(view) {
    activeView = view;

    // views use ids: view-posts, view-map, view-settings, view-matches, view-notifications, view-chat
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const section = document.getElementById("view-" + view);
    if (section) section.classList.add("active");

    // nav active states
    if (navSelling) navSelling.classList.toggle("active", view === "posts" && window.activePostType === "selling");
    if (navRequests) navRequests.classList.toggle("active", view === "posts" && window.activePostType === "requesting");
    if (navMap) navMap.classList.toggle("active", view === "map");
    if (navSettings) navSettings.classList.toggle("active", view === "settings");
    if (navMatches) navMatches.classList.toggle("active", view === "matches");
    if (navNotifications) navNotifications.classList.toggle("active", view === "notifications");
  }

  function getSearchQuery() {
    return searchInput ? searchInput.value.trim() : "";
  }

  function refreshPosts() {
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      // posts.js now supports a query param
      window.Posts.loadPosts(getSearchQuery());
    }
  }

  function setActivePostType(type) {
    // normalize legacy "request" -> "requesting"
    window.activePostType = (type === "request") ? "requesting" : type;
    setActiveView("posts");
    refreshPosts();
  }

  // Search: button + Enter + live input filter
  function runSearch() { refreshPosts(); }

  if (searchBtn && !searchBtn.dataset.bound) {
    searchBtn.dataset.bound = "true";
    searchBtn.addEventListener("click", runSearch);
  }
  if (searchInput) {
    if (!searchInput.dataset.enterBound) {
      searchInput.dataset.enterBound = "true";
      searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
    }
    if (!searchInput.dataset.liveBound) {
      searchInput.dataset.liveBound = "true";
      searchInput.addEventListener("input", runSearch);
    }
  }

  // Selling / requests
  if (navSelling) navSelling.addEventListener("click", () => setActivePostType("selling"));
  if (navRequests) navRequests.addEventListener("click", () => setActivePostType("requesting"));

  // Matches
  if (navMatches) {
    navMatches.addEventListener("click", () => {
      setActiveView("matches");
      if (window.Matches && typeof window.Matches.loadMatches === "function") {
        window.Matches.loadMatches();
      }
    });
  }

  // Notifications / Alerts
  if (navNotifications) {
    navNotifications.addEventListener("click", () => {
      setActiveView("notifications");
      if (window.Notifications && typeof window.Notifications.load === "function") {
        window.Notifications.load();
      }
    });
  }

  // Map (BF+ gated)
  if (navMap) {
    navMap.addEventListener("click", () => {
      const profile = window.currentProfile;
      if (!window.currentUser) {
        alert("Map is for signed-in BF+ users.");
        return;
      }
      if (!isBFPlus(profile)) {
        alert("Map is a BF+ feature. Upgrade to BF+ to use the map.");
        return;
      }
      if (window.BFMap && typeof window.BFMap.initMap === "function") {
        window.BFMap.initMap();
      }
      setActiveView("map");
    });
  }

  // Settings
  if (navSettings) navSettings.addEventListener("click", () => setActiveView("settings"));

  // Default load
  setActiveView("posts");
  refreshPosts();

  // Init notifications realtime once logged in (auth.js should set currentUser)
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.currentUser && window.Notifications && typeof window.Notifications.initRealtime === "function") {
      window.Notifications.initRealtime();
      clearInterval(t);
    }
    if (tries > 20) clearInterval(t);
  }, 500);
});

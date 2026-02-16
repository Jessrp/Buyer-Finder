// app.js – nav, views, search, theme, BF+ gating (patched for matching)
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";

  // Use the real DB post types everywhere
  window.activePostType = window.activePostType || "selling"; // "selling" | "requesting"

  function showBrowserNotification(message) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const body = message?.body || message?.text || "You have a new alert";
    new Notification(message?.title || "BuyerFinder", { body, icon: "/icon.png" });
  }
  window.showBrowserNotification = showBrowserNotification;

  // Views
  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");
  const viewMatches = document.getElementById("view-matches");
  const viewNotifications = document.getElementById("view-notifications");

  // Nav
  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");
  const navMatches = document.getElementById("nav-matches");
  const navNotifications = document.getElementById("nav-notifications");

  // Search (support both ids)
  const searchInput = document.getElementById("search-input") || document.getElementById("searchinput");
  const searchBtn = document.getElementById("search-btn") || document.getElementById("searchgo");

  // Settings buttons
  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const btnUpgradePremium = document.getElementById("btn-upgrade-premium");
  const btnDeleteAccount = document.getElementById("btn-delete-account");

  // BF+ floating prompt
  const upgradeBtn = document.getElementById("upgradeBtn");

  function setActiveView(view) {
    activeView = view;

    if (viewPosts) viewPosts.classList.toggle("active", view === "posts");
    if (viewMap) viewMap.classList.toggle("active", view === "map");
    if (viewSettings) viewSettings.classList.toggle("active", view === "settings");
    if (viewMatches) viewMatches.classList.toggle("active", view === "matches");
    if (viewNotifications) viewNotifications.classList.toggle("active", view === "notifications");

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
      window.Posts.loadPosts(getSearchQuery());
    }
  }

  function setActivePostType(type) {
    window.activePostType = (type === "request") ? "requesting" : type;
    refreshPosts();
    setActiveView("posts");
  }

  // Selling / requests
  if (navSelling) navSelling.addEventListener("click", () => setActivePostType("selling"));
  if (navRequests) navRequests.addEventListener("click", () => setActivePostType("requesting"));

  // Matches (FIX: call window.Matches)
  if (navMatches) navMatches.addEventListener("click", () => {
    setActiveView("matches");
    if (window.Matches && typeof window.Matches.loadMatches === "function") {
      window.Matches.loadMatches();
    }
  });

  // Notifications (prefer window.Notifications)
  if (navNotifications) navNotifications.addEventListener("click", () => {
    setActiveView("notifications");
    if (window.Notifications && typeof window.Notifications.load === "function") {
      window.Notifications.load();
    } else if (window.Posts && typeof window.Posts.loadNotifications === "function") {
      window.Posts.loadNotifications();
    }
  });

  // Map (BF+ gated)
  if (navMap) navMap.addEventListener("click", () => {
    const profile = window.currentProfile;
    if (!window.currentUser) {
      alert("Map is for signed-in BF+ users.");
      return;
    }
    if (!profile || !profile.premium) {
      alert("Map is a BF+ feature. Use the BF+ prompt to upgrade.");
      return;
    }
    if (window.BFMap && typeof window.BFMap.initMap === "function") {
      window.BFMap.initMap();
    }
    setActiveView("map");
  });

  // Settings
  if (navSettings) navSettings.addEventListener("click", () => setActiveView("settings"));

  // Search
  function handleSearch() {
    refreshPosts();
    if (window.Posts && typeof window.Posts.recordSearchQuery === "function") {
      window.Posts.recordSearchQuery(getSearchQuery());
    }
  }
  if (searchBtn) searchBtn.addEventListener("click", handleSearch);
  if (searchInput) searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSearch(); });

  // Theme
  function applyTheme() {
    const theme = localStorage.getItem("buyerfinder-theme") || "dark";
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  applyTheme();

  if (btnToggleTheme) btnToggleTheme.addEventListener("click", () => {
    const cur = localStorage.getItem("buyerfinder-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    localStorage.setItem("buyerfinder-theme", next);
    applyTheme();
  });

  if (btnDeleteAccount) btnDeleteAccount.addEventListener("click", () => {
    alert("Real account deletion must be done on a secure backend using the service role key. This button does not delete anything.");
  });

  async function buyBFPlus() {
    try {
      const supa = window.supa;
      if (!supa) { alert("Supabase client not ready."); return; }
      const { data } = await supa.auth.getUser();
      const user = data?.user;
      if (!user) { alert("Please sign in to upgrade."); return; }

      const res = await fetch("https://hcgwldsslzkppzgfhwws.supabase.co/functions/v1/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) { alert("Unable to start checkout. Try again."); return; }
      window.location.href = body.url;
    } catch (e) {
      console.error("buyBFPlus error:", e);
      alert("Unexpected error while starting BF+ checkout.");
    }
  }

  if (upgradeBtn) upgradeBtn.addEventListener("click", buyBFPlus);
  if (btnUpgradePremium) btnUpgradePremium.addEventListener("click", buyBFPlus);

  // Initial load
  refreshPosts();
  if (window.Auth && typeof window.Auth.checkUser === "function") window.Auth.checkUser();
  setActivePostType("selling");

  // Start realtime listener (safe if not signed in yet)
  setTimeout(() => window.Matches?.initMatchListener?.(), 1000);
});

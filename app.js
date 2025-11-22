// app.js
// Glue code: views, nav, theme, search, map entry.

document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling";

  const viewPosts = document.getElementById("view-posts");
  const viewMatches = document.getElementById("view-matches");
  const viewNotifications = document.getElementById("view-notifications");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMatches = document.getElementById("nav-matches");
  const navNotifications = document.getElementById("nav-notifications");
  const navSettings = document.getElementById("nav-settings");

  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const btnUpgradePremium = document.getElementById("btn-upgrade-premium");
  const btnDeleteAccount = document.getElementById("btn-delete-account");
  const btnOpenMap = document.getElementById("btn-open-map");

  const matchesDot = document.getElementById("matches-dot");
  const notificationsDot = document.getElementById("notifications-dot");

  const searchInput = document.getElementById("search-input");

  function getSearchQuery() {
    return searchInput ? searchInput.value.trim() : "";
  }

  function setActiveView(view) {
    activeView = view;

    if (viewPosts)
      viewPosts.classList.toggle("active", view === "posts");
    if (viewMatches)
      viewMatches.classList.toggle("active", view === "matches");
    if (viewNotifications)
      viewNotifications.classList.toggle("active", view === "notifications");
    if (viewMap)
      viewMap.classList.toggle("active", view === "map");
    if (viewSettings)
      viewSettings.classList.toggle("active", view === "settings");

    if (navSelling)
      navSelling.classList.toggle(
        "active",
        view === "posts" && window.activePostType === "selling"
      );
    if (navRequests)
      navRequests.classList.toggle(
        "active",
        view === "posts" && window.activePostType === "request"
      );
    if (navMatches)
      navMatches.classList.toggle("active", view === "matches");
    if (navNotifications)
      navNotifications.classList.toggle("active", view === "notifications");
    if (navSettings)
      navSettings.classList.toggle("active", view === "settings");
  }

  function reloadPostsForCurrentTab() {
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts(getSearchQuery());
    }
  }

  function setActivePostType(type) {
    window.activePostType = type;
    reloadPostsForCurrentTab();
    setActiveView("posts");
  }

  // NAV EVENTS
  if (navSelling) {
    navSelling.addEventListener("click", () => {
      setActivePostType("selling");
    });
  }

  if (navRequests) {
    navRequests.addEventListener("click", () => {
      setActivePostType("request");
    });
  }

  if (navMatches) {
    navMatches.addEventListener("click", () => {
      setActiveView("matches");
      // TODO: load matches from Supabase when backend matching is finalized
      if (matchesDot) matchesDot.style.display = "none";
    });
  }

  if (navNotifications) {
    navNotifications.addEventListener("click", () => {
      setActiveView("notifications");
      // TODO: load notifications when messaging + matching events are wired
      if (notificationsDot) notificationsDot.style.display = "none";
    });
  }

  if (navSettings) {
    navSettings.addEventListener("click", () => {
      setActiveView("settings");
    });
  }

  // SEARCH
  function triggerSearch() {
    reloadPostsForCurrentTab();
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        triggerSearch();
      }
    });

    searchInput.addEventListener("blur", () => {
      // Light-weight requery
      triggerSearch();
    });
  }

  // MAP ENTRY FROM SETTINGS
  if (btnOpenMap) {
    btnOpenMap.addEventListener("click", () => {
      const profile = window.currentProfile;
      if (!window.currentUser) {
        alert("Map is for signed-in premium users.");
        return;
      }
      if (!profile || !profile.premium) {
        alert(
          "Map is a premium feature.\nUse the Upgrade button in Settings (dev-mode) to mark your account premium for now."
        );
        return;
      }

      if (window.BFMap && typeof window.BFMap.initMap === "function") {
        window.BFMap.initMap();
      }
      setActiveView("map");
    });
  }

  // THEME
  function applyTheme() {
    const theme = localStorage.getItem("buyerfinder-theme") || "dark";
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  applyTheme();

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", () => {
      const cur = localStorage.getItem("buyerfinder-theme") || "dark";
      const next = cur === "dark" ? "light" : "dark";
      localStorage.setItem("buyerfinder-theme", next);
      applyTheme();
    });
  }

  // PREMIUM UPGRADE DEV-MODE
  if (btnUpgradePremium) {
    btnUpgradePremium.addEventListener("click", async () => {
      if (!window.currentUser) {
        alert("Sign in first to upgrade.");
        return;
      }

      const ok = confirm(
        "In a real app this would open Stripe Checkout.\nFor now, press OK to mark your account as PREMIUM for testing."
      );
      if (!ok) return;

      const { error } = await window.supa
        .from("profiles")
        .update({ premium: true })
        .eq("id", window.currentUser.id);

      if (error) {
        alert("Failed to upgrade: " + error.message);
        return;
      }

      if (window.currentProfile) {
        window.currentProfile.premium = true;
      }

      alert("You are now PREMIUM. Map & unlimited posts unlocked.");
    });
  }

  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener("click", () => {
      alert(
        "Real account deletion must be done on a secure backend using the service role key.\nThis button just explains that; nothing is deleted."
      );
    });
  }

  // INITIAL LOAD
  setActiveView("posts");
  reloadPostsForCurrentTab();
});

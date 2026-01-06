// app.js – nav, views, search, theme, premium gating
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";

  // SINGLE source of truth
  window.activePostType = window.activePostType || "selling";

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

  // Search
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  function setActiveView(view) {
    activeView = view;

    viewPosts?.classList.toggle("active", view === "posts");
    viewMap?.classList.toggle("active", view === "map");
    viewSettings?.classList.toggle("active", view === "settings");
    viewMatches?.classList.toggle("active", view === "matches");
    viewNotifications?.classList.toggle("active", view === "notifications");

    navSelling?.classList.toggle(
      "active",
      view === "posts" && window.activePostType === "selling"
    );
    navRequests?.classList.toggle(
      "active",
      view === "posts" && window.activePostType === "requesting"
    );
    navMap?.classList.toggle("active", view === "map");
    navSettings?.classList.toggle("active", view === "settings");
    navMatches?.classList.toggle("active", view === "matches");
    navNotifications?.classList.toggle("active", view === "notifications");
  }

  function refreshPosts() {
    if (window.Posts?.loadPosts) {
      window.Posts.loadPosts(searchInput?.value.trim() || "");
    }
  }

  function setActivePostType(type) {
    if (type !== "selling" && type !== "requesting") return;
    window.activePostType = type;
    setActiveView("posts");
    refreshPosts();
  }

  // SELLING / REQUESTS (FIXED)
  navSelling?.addEventListener("click", () => setActivePostType("selling"));
  navRequests?.addEventListener("click", () => setActivePostType("requesting"));

  // Matches
  navMatches?.addEventListener("click", () => {
    setActiveView("matches");
    window.Posts?.loadMatches?.();
  });

  // Notifications
  navNotifications?.addEventListener("click", () => {
    setActiveView("notifications");
    window.Posts?.loadNotifications?.();
  });

  // Map (premium gated)
  navMap?.addEventListener("click", () => {
    const profile = window.currentProfile;
    if (!window.currentUser) {
      alert("Map is for signed-in premium users.");
      return;
    }
    if (!profile?.premium) {
      alert("Map is a BF+ feature.");
      return;
    }
    window.BFMap?.initMap?.();
    setActiveView("map");
  });

  // Settings
  navSettings?.addEventListener("click", () => setActiveView("settings"));

  // Search
  function handleSearch() {
    refreshPosts();
  }

  searchBtn?.addEventListener("click", handleSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  // Theme
  function applyTheme() {
    const theme = localStorage.getItem("buyerfinder-theme") || "dark";
    document.body.classList.toggle("light", theme === "light");
  }
  applyTheme();

  document
    .getElementById("btn-toggle-theme")
    ?.addEventListener("click", () => {
      const cur = localStorage.getItem("buyerfinder-theme") || "dark";
      localStorage.setItem("buyerfinder-theme", cur === "dark" ? "light" : "dark");
      applyTheme();
    });

  // Initial boot
  window.Posts?.loadPosts?.("");
  window.Auth?.checkUser?.();
  setActivePostType("selling");
});

// app.js
// Handles: tabs, nav bar, search, map overlay, boot logic.

(function () {
  const supa = window.supa;

  // ===== DOM HOOKS =====
  const tabSelling = document.getElementById("tab-selling");
  const tabRequests = document.getElementById("tab-requests");

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  const mapOverlay = document.getElementById("map-overlay");
  const closeMapBtn = document.getElementById("close-map-btn");
  const mapSearchBox = document.getElementById("map-search-query");

  window.activePostType = window.activePostType || "selling";

  // ==========================
  // TAB HANDLING
  // ==========================
  function setActiveTab(type) {
    window.activePostType = type;

    // Top tabs
    if (type === "selling") {
      tabSelling?.classList.add("active");
      tabRequests?.classList.remove("active");
    } else {
      tabRequests?.classList.add("active");
      tabSelling?.classList.remove("active");
    }

    // Bottom nav
    if (type === "selling") {
      navSelling?.classList.add("active");
      navRequests?.classList.remove("active");
    } else {
      navRequests?.classList.add("active");
      navSelling?.classList.remove("active");
    }

    triggerSearchOrReload();
  }

  tabSelling?.addEventListener("click", () => setActiveTab("selling"));
  tabRequests?.addEventListener("click", () => setActiveTab("request"));

  navSelling?.addEventListener("click", () => setActiveTab("selling"));
  navRequests?.addEventListener("click", () => setActiveTab("request"));

  // ==========================
  // SEARCH
  // ==========================
  function triggerSearchOrReload() {
    const q = searchInput?.value.trim() || "";
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts(q);
    }
  }

  searchBtn?.addEventListener("click", triggerSearchOrReload);

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") triggerSearchOrReload();
  });

  // ==========================
  // MAP OVERLAY
  // ==========================
  function openMap() {
    if (!mapOverlay) return;
    mapOverlay.classList.add("active");

    // Sync search into map search box
    if (mapSearchBox && searchInput) {
      mapSearchBox.value = searchInput.value.trim();
    }

    // Initialize map
    if (window.BFMap && typeof window.BFMap.initMap === "function") {
      window.BFMap.initMap();
    }
  }

  function closeMap() {
    if (!mapOverlay) return;
    mapOverlay.classList.remove("active");
  }

  navMap?.addEventListener("click", openMap);
  closeMapBtn?.addEventListener("click", closeMap);

  // ==========================
  // SETTINGS (placeholder)
  // ==========================
  navSettings?.addEventListener("click", () => {
    alert("Settings is not fully implemented yet.");
  });

  // ==========================
  // BOOTSTRAP
  // ==========================
  function boot() {
    // Initialize Auth
    if (window.AuthUI && typeof window.AuthUI.init === "function") {
      window.AuthUI.init();
    }

    // Set initial tab
    setActiveTab(window.activePostType || "selling");
  }

  // Run when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

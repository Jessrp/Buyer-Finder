// app.js
// Glue code: tabs, nav, search, map overlay, initial load.

(function () {
  const supa = window.supa;

  // Elements
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
  const mapSearchInput = document.getElementById("map-search-query");

  const postsContainer = document.getElementById("posts-container");

  // Default tab
  window.activePostType = window.activePostType || "selling";

  // -------- TAB HANDLING --------

  function setActiveTab(type) {
    window.activePostType = type;

    if (tabSelling && tabRequests) {
      if (type === "selling") {
        tabSelling.classList.add("active");
        tabRequests.classList.remove("active");
      } else {
        tabRequests.classList.add("active");
        tabSelling.classList.remove("active");
      }
    }

    if (navSelling && navRequests) {
      if (type === "selling") {
        navSelling.classList.add("active");
        navRequests.classList.remove("active");
      } else {
        navRequests.classList.add("active");
        navSelling.classList.remove("active");
      }
    }

    if (postsContainer) {
      postsContainer.scrollTop = 0;
    }

    triggerSearchOrReload();
  }

  if (tabSelling) {
    tabSelling.addEventListener("click", () => setActiveTab("selling"));
  }
  if (tabRequests) {
    tabRequests.addEventListener("click", () => setActiveTab("requests")); // FIXED
  }

  if (navSelling) {
    navSelling.addEventListener("click", () => setActiveTab("selling"));
  }
  if (navRequests) {
    navRequests.addEventListener("click", () => setActiveTab("requests")); // FIXED
  }

  // -------- SEARCH --------

  function triggerSearchOrReload() {
    const q = searchInput ? searchInput.value.trim() : "";
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts(q);
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      triggerSearchOrReload();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        triggerSearchOrReload();
      }
    });
  }

  // -------- MAP OVERLAY --------

  function openMapOverlay() {
    if (!mapOverlay) return;
    mapOverlay.classList.add("active");

    if (mapSearchInput && searchInput) {
      mapSearchInput.value = searchInput.value.trim();
    }

    if (window.BFMap && typeof window.BFMap.initMap === "function") {
      window.BFMap.initMap();
    }
  }

  function closeMapOverlay() {
    if (!mapOverlay) return;
    mapOverlay.classList.remove("active");
  }

  if (navMap) {
    navMap.addEventListener("click", openMapOverlay);
  }
  if (closeMapBtn) {
    closeMapBtn.addEventListener("click", closeMapOverlay);
  }

  // -------- SETTINGS --------

  if (navSettings) {
    navSettings.addEventListener("click", () => {
      alert(
        "Settings screen isn't wired up yet. It will control things like mini-map vs location text, notifications, etc."
      );
    });
  }

  // -------- INITIAL BOOTSTRAP --------

  function boot() {
    if (window.AuthUI && typeof window.AuthUI.init === "function") {
      window.AuthUI.init();
    }

    setActiveTab(window.activePostType || "selling");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

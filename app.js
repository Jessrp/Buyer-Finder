document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling";

  // View elements
  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");
  const viewAlerts = document.getElementById("view-alerts");

  // Nav buttons
  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navAlerts = document.getElementById("nav-alerts");
  const navSettings = document.getElementById("nav-settings");

  // Close buttons
  const btnCloseMap = document.getElementById("map-close-btn");
  const btnCloseSettings = document.getElementById("settings-close-btn");

  // Alerts / matches
  const btnOpenMatches = document.getElementById("btn-open-matches");
  const matchesOverlay = document.getElementById("matches-overlay");
  const matchesCloseBtn = document.getElementById("matches-close-btn");

  // Global search
  const globalSearchInput = document.getElementById("global-search-input");
  const globalSearchBtn = document.getElementById("global-search-btn");

  // ----------------------------------------------------
  //           VIEW SWITCHING / NAVIGATION
  // ----------------------------------------------------

  function setActiveView(view) {
    activeView = view;

    if (viewPosts) viewPosts.classList.toggle("active", view === "posts");
    if (viewMap) viewMap.classList.toggle("active", view === "map");
    if (viewSettings)
      viewSettings.classList.toggle("active", view === "settings");
    if (viewAlerts) viewAlerts.classList.toggle("active", view === "alerts");

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
    if (navMap) navMap.classList.toggle("active", view === "map");
    if (navAlerts) navAlerts.classList.toggle("active", view === "alerts");
    if (navSettings) navSettings.classList.toggle("active", view === "settings");

    // On entering Alerts view → load alerts/matches
    if (view === "alerts" && window.Posts) {
      if (typeof window.Posts.loadMatches === "function") {
        window.Posts.loadMatches();
      }
      if (typeof window.Posts.loadNotifications === "function") {
        window.Posts.loadNotifications();
      }
    }

    // On entering Map → initialize map
    if (view === "map" && window.BFMap) {
      if (typeof window.BFMap.initMap === "function") {
        window.BFMap.initMap();
      }
    }
  }

  // ----------------------------------------------------
  //              POST TYPE SWITCHING
  // ----------------------------------------------------

  function setActivePostType(type) {
    window.activePostType = type;

    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      const q = globalSearchInput ? globalSearchInput.value : "";
      window.Posts.loadPosts(q);
    }

    setActiveView("posts");
  }

  if (navSelling) {
    navSelling.addEventListener("click", () =>
      setActivePostType("selling")
    );
  }
  if (navRequests) {
    navRequests.addEventListener("click", () =>
      setActivePostType("request")
    );
  }

  // ----------------------------------------------------
  //                   MAP (PREMIUM ONLY)
  // ----------------------------------------------------

  if (navMap) {
    navMap.addEventListener("click", () => {
      const profile = window.currentProfile;
      const isPremium = !!(profile && profile.premium);

      if (!isPremium) {
        alert(
          "Map is a premium feature. Open Settings and upgrade to unlock it."
        );
        setActiveView("settings");
        return;
      }

      setActiveView("map");
    });
  }

  // ----------------------------------------------------
  //                    ALERTS VIEW
  // ----------------------------------------------------

  if (navAlerts) {
    navAlerts.addEventListener("click", () => {
      setActiveView("alerts");
    });
  }

  // ----------------------------------------------------
  //                    SETTINGS VIEW
  // ----------------------------------------------------

  if (navSettings) {
    navSettings.addEventListener("click", () => {
      setActiveView("settings");
    });
  }

  // ----------------------------------------------------
  //                   CLOSE BUTTONS
  // ----------------------------------------------------

  if (btnCloseMap) {
    btnCloseMap.addEventListener("click", () => {
      setActiveView("posts");
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener("click", () => {
      setActiveView("posts");
    });
  }

  // ----------------------------------------------------
  //                    GLOBAL SEARCH
  // ----------------------------------------------------

  if (globalSearchBtn && globalSearchInput) {
    globalSearchBtn.addEventListener("click", () => {
      const term = globalSearchInput.value || "";
      if (window.Posts && typeof window.Posts.loadPosts === "function") {
        window.Posts.loadPosts(term);
      }
      if (
        window.Posts &&
        typeof window.Posts.recordSearchQuery === "function"
      ) {
        window.Posts.recordSearchQuery(term);
      }
    });
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && globalSearchBtn) {
        globalSearchBtn.click();
      }
    });
  }

  // ----------------------------------------------------
  //                 MATCHES OVERLAY (PREMIUM)
  // ----------------------------------------------------

  function openMatchesOverlay() {
    const profile = window.currentProfile;
    const isPremium = !!(profile && profile.premium);

    if (!isPremium) {
      alert(
        "My Matches is a premium feature. Upgrade in Settings to unlock automatic matches."
      );
      return;
    }

    if (matchesOverlay) matchesOverlay.classList.add("active");

    if (window.Posts && typeof window.Posts.loadMatches === "function") {
      window.Posts.loadMatches();
    }
  }

  function closeMatchesOverlay() {
    if (matchesOverlay) matchesOverlay.classList.remove("active");
  }

  if (btnOpenMatches) {
    btnOpenMatches.addEventListener("click", openMatchesOverlay);
  }
  if (matchesCloseBtn) {
    matchesCloseBtn.addEventListener("click", closeMatchesOverlay);
  }
  if (matchesOverlay) {
    matchesOverlay.addEventListener("click", (e) => {
      if (e.target === matchesOverlay) {
        closeMatchesOverlay();
      }
    });
  }

  // ----------------------------------------------------
  //                    INITIAL PAGE LOAD
  // ----------------------------------------------------

  if (window.Posts && typeof window.Posts.loadPosts === "function") {
    window.Posts.loadPosts();
  }
});
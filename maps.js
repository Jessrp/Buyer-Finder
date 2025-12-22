// maps.js — BF+ gated maps + minimap (safe init via Google callback)
// Keeps UI/layout intact. Only makes the existing map elements actually work.

(() => {
  let mainMap = null;
  let miniMap = null;
  let miniMarker = null;

  const mainEl = () => document.getElementById("map-canvas");
  const miniWrap = () => document.getElementById("detail-minimap-container");
  const miniEl = () => document.getElementById("detail-minimap");

  function isPremium() {
    return !!window.currentProfile?.premium;
  }

  function googleReady() {
    return !!(window.google && window.google.maps);
  }

  function destroyMainMap() {
    const el = mainEl();
    if (el) el.innerHTML = "";
    mainMap = null;
  }

  function destroyMiniMap() {
    const wrap = miniWrap();
    const el = miniEl();
    if (el) el.innerHTML = "";
    if (wrap) wrap.style.display = "none";
    miniMap = null;
    miniMarker = null;
  }

  function ensureMainMap() {
    if (!googleReady()) return;
    const el = mainEl();
    if (!el || mainMap) return;

    mainMap = new google.maps.Map(el, {
      center: { lat: 39.5, lng: -98.35 },
      zoom: 4,
      disableDefaultUI: true,
    });
  }

  function ensureMiniMap(lat, lng) {
    if (!googleReady()) return;
    const wrap = miniWrap();
    const el = miniEl();
    if (!wrap || !el) return;

    wrap.style.display = "block";
    el.innerHTML = "";

    miniMap = new google.maps.Map(el, {
      center: { lat, lng },
      zoom: 13,
      disableDefaultUI: true,
      gestureHandling: "none",
    });

    miniMarker = new google.maps.Marker({
      position: { lat, lng },
      map: miniMap,
    });
  }

  function refresh() {
    // If Google hasn't loaded yet, callback will call refresh again.
    if (!googleReady()) return;

    const premium = isPremium();

    // Main map (tab)
    const el = mainEl();
    if (!premium) {
      destroyMainMap();
      if (el) el.style.display = "none";
    } else {
      if (el) el.style.display = "block";
      ensureMainMap();
      // Make sure it draws correctly when switching views
      setTimeout(() => {
        try {
          if (mainMap) google.maps.event.trigger(mainMap, "resize");
        } catch (_) {}
      }, 150);
    }

    // Minimap (detail panel)
    if (!premium) destroyMiniMap();
  }

  function renderMiniMap(lat, lng) {
    if (!googleReady()) return;
    if (!isPremium()) return;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    ensureMiniMap(lat, lng);
  }

  // Public API used by posts.js
  window.BFMap = { refresh, renderMiniMap };

  // Google Maps API callback (set in index.html as &callback=initMap)
  window.initMap = function () {
    refresh();
  };

  // Close-map button (keeps existing UX; just makes it functional)
  const closeBtn = document.getElementById("map-close-btn");
  closeBtn?.addEventListener("click", () => {
    // Return user to posts view by simulating a tap on the active tab
    document.getElementById("nav-selling")?.click();
  });

  // When profile becomes available/changes, refresh map gating
  const waitForProfile = setInterval(() => {
    if (window.currentProfile !== undefined) {
      clearInterval(waitForProfile);
      refresh();
    }
  }, 100);
})();

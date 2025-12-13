// maps.js — BF+ gated maps + minimap (safe, single-init)

(() => {
  if (!window.google || !window.google.maps) {
    console.warn("Maps API not loaded");
    return;
  }

  let mainMap = null;
  let miniMap = null;
  let miniMarker = null;
  let initialized = false;

  const mapContainer = document.getElementById("map-container");
  const miniContainer = document.getElementById("detail-minimap-container");

  function isPremium() {
    return !!window.currentProfile?.premium;
  }

  function destroyMainMap() {
    if (mapContainer) mapContainer.innerHTML = "";
    mainMap = null;
  }

  function destroyMiniMap() {
    if (miniContainer) miniContainer.innerHTML = "";
    miniMap = null;
    miniMarker = null;
  }

  function initMainMap() {
    if (!mapContainer || mainMap) return;

    mainMap = new google.maps.Map(mapContainer, {
      center: { lat: 39.5, lng: -98.35 }, // US center
      zoom: 4,
      disableDefaultUI: true,
    });
  }

  function initMiniMap(lat, lng) {
    if (!miniContainer) return;

    miniContainer.innerHTML = "";

    miniMap = new google.maps.Map(miniContainer, {
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
    const premium = isPremium();

    // Main map (tab)
    if (!premium) {
      destroyMainMap();
      if (mapContainer) mapContainer.style.display = "none";
    } else {
      if (mapContainer) mapContainer.style.display = "block";
      initMainMap();
    }

    // Minimap (detail panel)
    if (!premium) {
      destroyMiniMap();
      if (miniContainer) miniContainer.style.display = "none";
    }
  }

  function renderMiniMap(lat, lng) {
    if (!isPremium()) return;
    if (typeof lat !== "number" || typeof lng !== "number") return;

    if (miniContainer) miniContainer.style.display = "block";
    initMiniMap(lat, lng);
  }

  // Public API
  window.BFMap = {
    refresh,
    renderMiniMap,
  };

  // Run once auth/profile is ready
  const waitForProfile = setInterval(() => {
    if (window.currentProfile !== undefined) {
      clearInterval(waitForProfile);
      refresh();
      initialized = true;
    }
  }, 100);
})();

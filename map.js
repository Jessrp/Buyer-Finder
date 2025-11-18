// map.js
// Handles main map overlay AND mini-map inside the detail panel.

(function () {
  const supa = window.supa;

  let map = null;
  let markers = [];
  let mapReady = false;
  let mapInitTimer = null;

  // DOM
  const mapOverlay = document.getElementById("map-overlay");
  const mapCanvas = document.getElementById("map-canvas");
  const mapMessage = document.getElementById("map-message");
  const mapSearchInput = document.getElementById("map-search-query");
  const mapSearchBtn = document.getElementById("map-search-btn");

  // ============================
  // Helpers
  // ============================

  function clearMarkers() {
    markers.forEach((m) => m.setMap(null));
    markers = [];
  }

  function ensureMap() {
    if (!mapCanvas) return null;

    if (!window.google || !google.maps) {
      mapMessage.textContent = "Google Maps failed to load.";
      return null;
    }

    if (!map) {
      map = new google.maps.Map(mapCanvas, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        disableDefaultUI: false,
      });
    }

    return map;
  }

  // ============================
  // Load posts onto map
  // ============================

  async function loadPosts(query = "") {
    const m = ensureMap();
    if (!m) return;

    mapMessage.textContent = "Loading posts…";

    let req = supa
      .from("posts")
      .select("id,title,description,price,type,lat,lng,category,location_text")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (query.trim()) {
      const q = query.trim();
      req = req.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    const { data, error } = await req;

    if (error) {
      mapMessage.textContent = "Error loading map posts.";
      console.log(error.message);
      return;
    }

    clearMarkers();
    if (!data.length) {
      mapMessage.textContent = "No posts match this search.";
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    data.forEach((p) => {
      const pos = { lat: p.lat, lng: p.lng };
      const isReq = (p.type || "").toLowerCase() === "request";

      const marker = new google.maps.Marker({
        position: pos,
        map: m,
        icon: isReq
          ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          : "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: p.title || "",
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="font-size:13px;max-width:220px;">
            <strong>${p.title || ""}</strong><br>
            ${p.description || ""}
            ${p.price ? `<br><span style="color:#22c55e;">$${p.price}</span>` : ""}
            ${p.category ? `<br><small>${p.category}</small>` : ""}
            ${
              p.location_text
                ? `<br><small>${p.location_text}</small>`
                : ""
            }
          </div>
        `,
      });

      marker.addListener("click", () => info.open(m, marker));

      markers.push(marker);
      bounds.extend(pos);
    });

    m.fitBounds(bounds);
    mapMessage.textContent = "Blue = selling • Red = requests";
  }

  // ============================
  // MAIN MAP INIT
  // ============================

  function initMap() {
    if (mapReady) return;
    mapReady = true;

    mapInitTimer = setTimeout(() => {
      if (!window.google || !google.maps) {
        mapMessage.textContent = "Google Maps did not load.";
        return;
      }
      loadPosts(mapSearchInput.value.trim());
    }, 300);
  }

  // ============================
  // MINI-MAP (DETAIL PANEL)
  // ============================

  function renderMiniMap(lat, lng) {
    const container = document.getElementById("detail-minimap");
    if (!container) return;

    if (!window.google || !google.maps) {
      console.log("Mini map failed to load – Google Maps missing.");
      return;
    }

    const center = { lat, lng };

    const mini = new google.maps.Map(container, {
      center,
      zoom: 12,
      disableDefaultUI: true,
    });

    new google.maps.Marker({
      position: center,
      map: mini,
    });
  }

  // ============================
  // EVENTS
  // ============================

  mapSearchBtn?.addEventListener("click", () => {
    loadPosts(mapSearchInput.value.trim());
  });

  // Attempt search on Enter
  mapSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadPosts(mapSearchInput.value.trim());
  });

  // Expose API
  window.BFMap = {
    initMap,
    renderMiniMap,
  };
})();

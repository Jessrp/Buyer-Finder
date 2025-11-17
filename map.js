(function () {
  const supa = window.supa;

  let map;
  let markers = [];

  const mapCanvas = document.getElementById("map-canvas");
  const mapMessage = document.getElementById("map-message");
  const mapSearchInput = document.getElementById("map-search-query");
  const mapSearchBtn = document.getElementById("map-search-btn");

  function clearMarkers() {
    markers.forEach((m) => m.setMap(null));
    markers = [];
  }

  function ensureMainMap() {
    if (!mapCanvas) return null;

    if (!window.google || !google.maps) {
      mapMessage.textContent = "Google Maps API not loaded.";
      return null;
    }

    if (!map) {
      map = new google.maps.Map(mapCanvas, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
      });
    }

    return map;
  }

  async function loadPostsForMap(query) {
    const m = ensureMainMap();
    if (!m) return;

    mapMessage.textContent = "Loading posts...";

    let req = supa
      .from("posts")
      .select("*")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (query) {
      req = req.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await req;

    if (error) {
      mapMessage.textContent = "Map error.";
      return;
    }

    clearMarkers();

    if (!data.length) {
      mapMessage.textContent = "No posts match the search.";
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    data.forEach((p) => {
      const pos = { lat: p.lat, lng: p.lng };

      const marker = new google.maps.Marker({
        position: pos,
        map: m,
        icon:
          p.type === "request"
            ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
            : "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });

      const info = new google.maps.InfoWindow({
        content: `<strong>${p.title}</strong>`,
      });

      marker.addListener("click", () => info.open(m, marker));

      markers.push(marker);
      bounds.extend(pos);
    });

    m.fitBounds(bounds);
    mapMessage.textContent = "Blue = Selling, Red = Requests";
  }

  if (mapSearchBtn) {
    mapSearchBtn.addEventListener("click", () => {
      loadPostsForMap(mapSearchInput.value);
    });
  }

  function renderMiniMap(lat, lng) {
    const container = document.getElementById("detail-minimap");
    if (!container) return;

    const m = new google.maps.Map(container, {
      center: { lat, lng },
      zoom: 12,
      disableDefaultUI: true,
    });

    new google.maps.Marker({
      position: { lat, lng },
      map: m,
    });
  }

  window.BFMap = {
    initMap() {
      loadPostsForMap(mapSearchInput.value);
    },
    renderMiniMap,
  };
})();

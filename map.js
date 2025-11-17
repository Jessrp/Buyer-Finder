// map.js
(function () {
  const supa = window.supa;
  const mapCanvas = document.getElementById("map-canvas");
  const mapMessage = document.getElementById("map-message");
  const mapSearchInput = document.getElementById("map-search-query");
  const mapSearchBtn = document.getElementById("map-search-btn");

  let map;
  let markers = [];

  function clearMarkers() {
    markers.forEach((m) => m.setMap && m.setMap(null));
    markers = [];
  }

  function ensureMap() {
    if (!mapCanvas) return null;
    if (!window.google || !google.maps) {
      if (mapMessage)
        mapMessage.textContent =
          "Map not available (API key not set or Google Maps not loaded).";
      return null;
    }
    if (!map) {
      map = new google.maps.Map(mapCanvas, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        disableDefaultUI: false
      });
    }
    return map;
  }

  async function loadPostsForMap(query) {
    const m = ensureMap();
    if (!m) return;

    if (mapMessage) mapMessage.textContent = "Loading posts for map...";

    let req = supa
      .from("posts")
      .select("id,title,description,price,type,lat,lng,category,location_text")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    const { data, error } = await req;
    if (error) {
      console.log("map posts error:", error.message);
      if (mapMessage) mapMessage.textContent = "Error loading map posts.";
      return;
    }

    clearMarkers();

    if (!data || !data.length) {
      if (mapMessage)
        mapMessage.textContent = "No posts match this search on the map.";
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    data.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;

      const pos = { lat: p.lat, lng: p.lng };
      const isRequest =
        (p.type || "").toString().toLowerCase() === "request";

      const marker = new google.maps.Marker({
        position: pos,
        map: m,
        title: p.title || "",
        icon: isRequest
          ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          : "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="font-size:13px;max-width:220px;">
            <strong>${p.title || "Untitled"}</strong><br/>
            ${p.description ? `<span>${p.description}</span><br/>` : ""}
            ${
              p.price
                ? `<span style="color:#22c55e;">$${p.price}</span><br/>`
                : ""
            }
            ${
              p.category
                ? `<span class="hint">${p.category}</span><br/>`
                : ""
            }
            ${
              p.location_text
                ? `<span class="hint">${p.location_text}</span>`
                : ""
            }
          </div>
        `
      });

      marker.addListener("click", () => {
        info.open(m, marker);
      });

      markers.push(marker);
      bounds.extend(pos);
    });

    m.fitBounds(bounds);

    if (mapMessage) {
      mapMessage.textContent =
        "Blue = selling, Red = requests. Use search to filter.";
    }
  }

  if (mapSearchBtn && mapSearchInput) {
    mapSearchBtn.addEventListener("click", () => {
      const q = mapSearchInput.value;
      loadPostsForMap(q);
    });
  }

  function renderMiniMap(lat, lng) {
    const container = document.getElementById("detail-minimap");
    if (!container) return;
    if (!window.google || !google.maps) {
      console.log("Google Maps not loaded for mini map.");
      return;
    }
    const center = { lat, lng };
    const mini = new google.maps.Map(container, {
      center,
      zoom: 12,
      disableDefaultUI: true
    });
    new google.maps.Marker({
      position: center,
      map: mini
    });
  }

  window.BFMap = {
    initMap() {
      loadPostsForMap(mapSearchInput ? mapSearchInput.value : "");
    },
    renderMiniMap
  };
})();

// map.js
(function () {
  const supa = window.supa;

  let map;
  let allMarkers = [];
  let activeFilter = "both";

  const mapCanvas      = document.getElementById("map-canvas");
  const mapMessage     = document.getElementById("map-message");
  const mapSearchInput = document.getElementById("map-search-query");
  const mapSearchBtn   = document.getElementById("map-search-btn");
  const mapCloseBtn    = document.getElementById("map-close-btn");
  const mapExpandBtn   = document.getElementById("map-expand-btn");
  const mapCanvasEl    = document.getElementById("map-canvas");

  // ── EXPAND MAP BUTTON (custom in-DOM expand, not native fullscreen —
  // keeps the detail panel able to layer correctly on top when a marker
  // is tapped, which native browser fullscreen broke) ──────────────
  if (mapExpandBtn && mapCanvasEl) {
    mapExpandBtn.addEventListener("click", () => {
      const nowExpanded = mapCanvasEl.classList.toggle("map-expanded");
      mapExpandBtn.textContent = nowExpanded ? "⤡ Shrink Map" : "⤢ Expand Map";
      // Google Maps needs to be told its container resized, or it'll render
      // stale/blank at the new size until manually interacted with.
      if (window.google && window.google.maps && ensureMap) {
        const m = ensureMap();
        setTimeout(() => {
          google.maps.event.trigger(m, "resize");
        }, 260); // wait for the CSS height transition to finish
      }
    });
  }

  // ── CLOSE MAP BUTTON ──────────────────────────────────────
  if (mapCloseBtn) {
    mapCloseBtn.addEventListener("click", () => {
      if (typeof window.setActiveView === "function") {
        window.setActiveView("posts");
      } else {
        // fallback: click the home nav item directly
        const navHome = document.getElementById("nav-home");
        if (navHome) navHome.click();
      }
    });
  }

  function injectFilterBar() {
    if (document.getElementById("map-filter-bar")) return;
    const bar = document.createElement("div");
    bar.id = "map-filter-bar";
    bar.style.cssText = `display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;`;
    bar.innerHTML = `
      <button class="map-filter-btn active" data-filter="both"       style="${btnStyle(true)}">🔵🔴 Both</button>
      <button class="map-filter-btn"        data-filter="selling"    style="${btnStyle(false)}">🔴 Selling</button>
      <button class="map-filter-btn"        data-filter="requesting" style="${btnStyle(false)}">🔵 Requesting</button>
    `;
    mapCanvas.parentElement.insertBefore(bar, mapCanvas);

    bar.querySelectorAll(".map-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter;
        bar.querySelectorAll(".map-filter-btn").forEach(b => {
          b.style.cssText = btnStyle(false);
          b.classList.remove("active");
        });
        btn.style.cssText = btnStyle(true);
        btn.classList.add("active");
        applyFilter();
      });
    });
  }

  function btnStyle(active) {
    return `
      padding:8px 18px;border-radius:999px;
      border:1px solid ${active ? "var(--accent,#00dfa2)" : "rgba(255,255,255,0.15)"};
      background:${active ? "var(--accent,#00dfa2)" : "transparent"};
      color:${active ? "#000" : "var(--accent,#00dfa2)"};
      font-weight:${active ? "700" : "500"};
      font-size:13px;cursor:pointer;transition:all 0.2s;
    `;
  }

  function applyFilter() {
    allMarkers.forEach(({ marker, type }) => {
      const isRequesting = type === "requesting";
      let visible = false;
      if (activeFilter === "both")                        visible = true;
      if (activeFilter === "selling"    && !isRequesting) visible = true;
      if (activeFilter === "requesting" &&  isRequesting) visible = true;
      marker.setMap(visible ? map : null);
    });

    const labels = {
      both:       "🔵 Blue = Requests   🔴 Red = Selling   Tap a pin for details.",
      selling:    "🔴 Showing selling posts only. Tap a pin for details.",
      requesting: "🔵 Showing requests only. Tap a pin for details.",
    };
    if (mapMessage) mapMessage.textContent = labels[activeFilter];
  }

  function clearMarkers() {
    allMarkers.forEach(({ marker }) => marker.setMap(null));
    allMarkers = [];
  }

  function ensureMap() {
    if (!mapCanvas) return null;
    if (!window.google || !google.maps) {
      if (mapMessage) mapMessage.textContent = "Google Maps failed to load.";
      return null;
    }
    if (!map) {
      map = new google.maps.Map(mapCanvas, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        disableDefaultUI: false,
        fullscreenControl: false, // disabled: native browser fullscreen renders the map
                                   // above our detail panel's DOM layer, so tapping a
                                   // marker while fullscreened opened the post correctly
                                   // but the panel was invisible behind the map.
        styles: [
          { elementType: "geometry",           stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill",   stylers: [{ color: "#8ec3b9" }] },
          { featureType: "road",  elementType: "geometry", stylers: [{ color: "#2c2c54" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f3460" }] },
        ],
      });
    }
    return map;
  }

  // ── OPEN POST DETAIL ──────────────────────────────────────
  // Tries multiple pathways in order of preference, with a
  // fallback that switches to the posts view and queues the open.
  function openPostDetail(post) {
    // 1. posts.js exposes openDetailPanel on the Posts namespace
    if (typeof window.Posts?.openDetailPanel === "function") {
      window.Posts.openDetailPanel(post);
      return;
    }
    // 2. openDetailPanel exposed directly on window
    if (typeof window.openDetailPanel === "function") {
      window.openDetailPanel(post);
      return;
    }
    // 3. Posts not ready yet — switch to posts view first, then open
    // Store the full post object so app.js / posts.js can pick it up
    window.__bf_pending_open_post = post;
    window.__bf_pending_open_post_id = post.id;
    window.activePostType = (post.type || "").toLowerCase() === "requesting"
      ? "requesting"
      : "selling";

    if (typeof window.setActiveView === "function") {
      window.setActiveView("posts");
    } else {
      const navHome = document.getElementById("nav-home");
      if (navHome) navHome.click();
    }

    // After switching views give posts.js a moment to render, then open
    const attempts = [100, 400, 900];
    attempts.forEach(delay => {
      setTimeout(() => {
        if (typeof window.Posts?.openDetailPanel === "function") {
          window.Posts.openDetailPanel(post);
        } else if (typeof window.openDetailPanel === "function") {
          window.openDetailPanel(post);
        }
      }, delay);
    });
  }

  async function loadPostsForMap(query) {
    const m = ensureMap();
    if (!m) return;

    injectFilterBar();

    if (mapMessage) mapMessage.textContent = "Loading...";

    let req = supa
      .from("posts")
      .select("id,title,description,price,type,lat,lng,category,location_text,image_urls,user_id,created_at")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .or("sold.is.null,sold.eq.false")
      .or("frozen.is.null,frozen.eq.false");

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
    }

    const { data, error } = await req;

    if (error) {
      console.error("map posts error:", error.message);
      if (mapMessage) mapMessage.textContent = "Error loading map posts.";
      return;
    }

    clearMarkers();

    if (!data || !data.length) {
      if (mapMessage) mapMessage.textContent = "No posts found on the map.";
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    data.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;

      const isRequesting = (p.type || "").toLowerCase() === "requesting";
      const postType     = isRequesting ? "requesting" : "selling";
      const pos          = { lat: p.lat, lng: p.lng };

      const marker = new google.maps.Marker({
        position: pos,
        map: m,
        title: p.title || "",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor:   isRequesting ? "#3b82f6" : "#ef4444",
          fillOpacity: 1,
          strokeColor: isRequesting ? "#1d4ed8" : "#b91c1c",
          strokeWeight: 2,
        },
        animation: google.maps.Animation.DROP,
      });

      // Capture full post object in closure for reliable tap handling
      const postSnapshot = Object.assign({}, p);
      marker.addListener("click", () => openPostDetail(postSnapshot));

      allMarkers.push({ marker, post: postSnapshot, type: postType });
      bounds.extend(pos);
    });

    if (allMarkers.length > 0) m.fitBounds(bounds);

    applyFilter();
  }

  if (mapSearchBtn && mapSearchInput) {
    mapSearchBtn.addEventListener("click",     () => loadPostsForMap(mapSearchInput.value));
    mapSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadPostsForMap(mapSearchInput.value);
    });
  }

  window.BFMap = {
    initMap() {
      loadPostsForMap(mapSearchInput ? mapSearchInput.value : "");
    },
  };
})();

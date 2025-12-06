/* -----------------------------------------
   MAP.JS — BuyerFinder Radar
------------------------------------------ */

let mapInstance = null;
let mapMarkers = [];

window.mapFilterSelling = true;
window.mapFilterRequests = true;

/* -----------------------------------------
   INITIALIZE MAP
------------------------------------------ */

function initMap() {
  const mapBox = document.getElementById("map-canvas");

  // Simple fallback if real maps not enabled yet
  if (!window.L) {
    mapBox.innerHTML = `
      <p class="hint">
        Map not available in this environment.  
        (Enable Leaflet or Mapbox later)
      </p>`;
    return;
  }

  if (!mapInstance) {
    mapInstance = L.map("map-canvas").setView([37.0902, -95.7129], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(mapInstance);
  }

  loadPostsForMap("");
}

/* -----------------------------------------
   MAP SEARCH
------------------------------------------ */

document.getElementById("map-search-btn").onclick = () => {
  const q = document.getElementById("map-search-query").value.trim();
  loadPostsForMap(q);
};

/* -----------------------------------------
   FILTER UPDATE BUTTONS
------------------------------------------ */

function updateMapFilterButtons() {
  const s = document.getElementById("map-filter-selling");
  const r = document.getElementById("map-filter-requests");

  if (s) s.classList.toggle("chip-on", window.mapFilterSelling);
  if (r) r.classList.toggle("chip-on", window.mapFilterRequests);
}

document.getElementById("map-filter-selling").onclick = () => {
  window.mapFilterSelling = !window.mapFilterSelling;
  updateMapFilterButtons();
  const q = document.getElementById("map-search-query").value.trim();
  loadPostsForMap(q);
};

document.getElementById("map-filter-requests").onclick = () => {
  window.mapFilterRequests = !window.mapFilterRequests;
  updateMapFilterButtons();
  const q = document.getElementById("map-search-query").value.trim();
  loadPostsForMap(q);
};

/* -----------------------------------------
   LOAD POSTS ONTO MAP
------------------------------------------ */

async function loadPostsForMap(query = "") {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("MAP LOAD ERROR", error);
    return;
  }

  // Remove previous pins
  mapMarkers.forEach((m) => mapInstance.removeLayer(m));
  mapMarkers = [];

  let posts = data.filter((p) => p.status !== "sold" && p.status !== "found");

  if (!window.mapFilterSelling) {
    posts = posts.filter((p) => p.post_type !== "selling");
  }

  if (!window.mapFilterRequests) {
    posts = posts.filter((p) => p.post_type !== "request");
  }

  if (query.length > 0) {
    posts = posts.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  }

  posts.forEach((post) => {
    if (!post.lat || !post.lng) return;

    const color = post.post_type === "selling" ? "red" : "blue";

    const marker = L.circleMarker([post.lat, post.lng], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.7,
    })
      .addTo(mapInstance)
      .on("click", () => openPostDetail(post));

    mapMarkers.push(marker);
  });
}

/* -----------------------------------------
   MAP CLOSE BUTTON
------------------------------------------ */

document.getElementById("map-close-btn").onclick = () => {
  showView("view-posts");
};
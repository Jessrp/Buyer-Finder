/* -----------------------------------------
   MAP.JS — Map View + Marker Logic
------------------------------------------ */

let bfMap = null;
let bfMarkers = [];

window.mapShowSelling = true;
window.mapShowRequesting = true;

/* -----------------------------------------
   INIT MAP
------------------------------------------ */

function initMap() {
  const mapArea = document.getElementById("view-map");

  if (!window.L) {
    mapArea.innerHTML = `<p class="hint">Map engine not loaded. (Leaflet required)</p>`;
    return;
  }

  if (!bfMap) {
    bfMap = L.map("view-map", {
      center: [39.5, -98.35],
      zoom: 4,
      zoomControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(bfMap);
  }

  loadMapPosts("");
}

/* -----------------------------------------
   LOAD POSTS FOR MAP
------------------------------------------ */

async function loadMapPosts(query = "") {
  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("MAP LOAD ERROR:", error);
    return;
  }

  // Clear old markers
  bfMarkers.forEach((m) => bfMap.removeLayer(m));
  bfMarkers = [];

  let posts = data.filter(
    (p) => p.status !== "sold" && p.status !== "found"
  );

  if (!window.mapShowSelling) {
    posts = posts.filter((p) => p.post_type !== "selling");
  }

  if (!window.mapShowRequesting) {
    posts = posts.filter((p) => p.post_type !== "request");
  }

  if (query.trim().length > 0) {
    posts = posts.filter((p) =>
      p.title.toLowerCase().includes(query.toLowerCase())
    );
  }

  posts.forEach((post) => {
    if (!post.lat || !post.lng) return;

    const color =
      post.post_type === "selling" ? "red" : "blue";

    const marker = L.circleMarker([post.lat, post.lng], {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 0.7
    })
      .addTo(bfMap)
      .on("click", () => openPostDetail(post));

    bfMarkers.push(marker);
  });
}

/* -----------------------------------------
   FILTER BUTTONS
------------------------------------------ */

document.getElementById("btn-map").addEventListener("click", () => {
  // Ensure map re-renders when switching to map view
  setTimeout(() => {
    if (bfMap) bfMap.invalidateSize();
  }, 200);
});

/* You can add map filters later once you confirm the base map works */
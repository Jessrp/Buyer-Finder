/* ---------------------------------------------------------
   MAP.JS — Placeholder + BF+ Gated Access
   (Full interactive map will be wired after BF+ integration)
----------------------------------------------------------- */

let bfMap = null;

/* ---------------------------------------------------------
   INIT MAP (SAFE PLACEHOLDER VERSION)
----------------------------------------------------------- */
window.initMap = function () {
    console.log("Map initialization requested…");

    const container = document.getElementById("map-container");

    if (!container) {
        console.warn("Map container not found.");
        return;
    }

    // BF+ CHECK
    if (!window.currentUser) {
        container.innerHTML = `
            <div class="map-locked">
                <p>You must sign in to access the map.</p>
            </div>
        `;
        return;
    }

    if (!window.currentUser.is_bfplus) {
        container.innerHTML = `
            <div class="map-locked">
                <p>The map is a BF+ feature.</p>
                <button onclick="alert('BF+ upgrade flow coming soon')">Unlock BF+</button>
            </div>
        `;
        return;
    }

    // If BF+ user, load real map
    container.innerHTML = `<div id="map" style="width:100%;height:100%;"></div>`;

    try {
        bfMap = L.map("map").setView([37.7749, -122.4194], 10);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
        }).addTo(bfMap);

        console.log("Map loaded for BF+ user.");
    } catch (err) {
        console.error("Map error:", err);
    }
};

/* ---------------------------------------------------------
   SHOW MAP VIEW
----------------------------------------------------------- */
window.showMap = function () {
    const v = document.getElementById("view-map");
    if (!v) return;

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    v.classList.add("active");

    initMap();
};
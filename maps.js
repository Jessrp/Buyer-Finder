let map;

window.initMap = function () {
  const mapEl = document.getElementById("map-canvas");
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    center: { lat: 39.5, lng: -98.35 },
    zoom: 4,
    disableDefaultUI: true
  });
};

// PANEL TOGGLE
document.getElementById("nav-maps")?.addEventListener("click", () => {
  document.getElementById("map-panel").classList.remove("hidden");
  setTimeout(() => {
    if (map) google.maps.event.trigger(map, "resize");
  }, 300);
});

document.getElementById("close-map")?.addEventListener("click", () => {
  document.getElementById("map-panel").classList.add("hidden");
});

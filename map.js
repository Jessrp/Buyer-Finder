// map.js
(function () {
  const mapMessage = document.getElementById("map-message");
  const mapCanvas = document.getElementById("map-canvas");
  const mapCloseBtn = document.getElementById("map-close-btn");

  function initMap() {
    if (mapMessage)
      mapMessage.textContent =
        "Map would show premium nearby posts here. (Stub for now.)";
    if (mapCanvas)
      mapCanvas.innerHTML =
        "<div style='padding:15px;font-size:13px;color:#9ca3af;'>Map placeholder. In real version, this would be a real map with location pins.</div>";
  }

  function closeMap() {
    const viewPosts = document.getElementById("view-posts");
    const viewMap = document.getElementById("view-map");
    if (viewPosts) viewPosts.classList.add("active");
    if (viewMap) viewMap.classList.remove("active");
    const navMap = document.getElementById("nav-map");
    const navSelling = document.getElementById("nav-selling");
    if (navMap) navMap.classList.remove("active");
    if (navSelling) navSelling.classList.add("active");
  }

  if (mapCloseBtn) mapCloseBtn.addEventListener("click", closeMap);

  window.BFMap = {
    initMap,
  };
})();

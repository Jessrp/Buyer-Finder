// map.js
window.BF = window.BF || {};

(function (BF) {
  BF.map = BF.map || {};
  BF.map.initialized = false;

  BF.map.showMapView = function () {
    const profile = BF.state.currentProfile;
    const isPremium = !!(profile && profile.premium);
    const ui = BF.ui;

    if (!isPremium) {
      ui.mapMessage.textContent =
        "Map is a premium feature. Upgrade to see local buyer / seller hotspots.";
      ui.mapCanvas.innerHTML = "";
      ui.mapCanvas.style.opacity = "0.3";
      return;
    }

    ui.mapMessage.textContent =
      "Showing demo map dots. (Stub only, no real GPS yet.)";
    ui.mapCanvas.style.opacity = "1";

    if (!BF.map.initialized) {
      BF.map.initialized = true;
      BF.map.renderFakeDots();
    }
  };

  BF.map.renderFakeDots = function () {
    const canvas = BF.ui.mapCanvas;
    canvas.innerHTML = "";
    canvas.style.position = "relative";

    for (let i = 0; i < 10; i++) {
      const dot = document.createElement("div");
      dot.style.position = "absolute";
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "50%";
      dot.style.background = i % 2 === 0 ? "#00eaff" : "#ff4b6a";
      dot.style.left = Math.random() * 90 + "%";
      dot.style.top = Math.random() * 80 + "%";
      canvas.appendChild(dot);
    }
  };
})(window.BF);
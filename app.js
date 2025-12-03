// app.js

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadPosts(); // default home view
});

// Switch views
function setupNavigation() {
  const navButtons = document.querySelectorAll("[data-view]");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-view");
      showView(target);
    });
  });
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  const view = document.getElementById(viewId);
  if (view) view.classList.add("active");

  if (viewId === "view-home") loadPosts();
  if (viewId === "view-map") initMap();
}

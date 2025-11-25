document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling";

  // View elements
  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");

  // Nav buttons
  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");

  // Close buttons
  const btnCloseMap = document.getElementById("map-close-btn");
  const btnCloseSettings = document.getElementById("settings-close-btn");

  function setActiveView(view) {
    activeView = view;

    viewPosts.classList.toggle("active", view === "posts");
    viewMap.classList.toggle("active", view === "map");
    viewSettings.classList.toggle("active", view === "settings");

    navSelling.classList.toggle("active", view === "posts" && window.activePostType === "selling");
    navRequests.classList.toggle("active", view === "posts" && window.activePostType === "request");
    navMap.classList.toggle("active", view === "map");
    navSettings.classList.toggle("active", view === "settings");
  }

  function setActivePostType(type) {
    window.activePostType = type;
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts();
    }
    setActiveView("posts");
  }

  // Nav listeners
  navSelling.addEventListener("click", () => setActivePostType("selling"));
  navRequests.addEventListener("click", () => setActivePostType("request"));

  navMap.addEventListener("click", () => setActiveView("map"));
  navSettings.addEventListener("click", () => setActiveView("settings"));

  // Close Map
  if (btnCloseMap) {
    btnCloseMap.addEventListener("click", () => {
      setActiveView("posts");
    });
  }

  // Close Settings
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener("click", () => {
      setActiveView("posts");
    });
  }

  // Initial load
  if (window.Posts && typeof window.Posts.loadPosts === "function") {
    window.Posts.loadPosts();
  }
});

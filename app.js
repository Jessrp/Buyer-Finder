// app.js — UI state + filters ONLY (no UI injection, no layout changes)

(() => {
  // Shared state used by posts.js
  window.AppState = {
    viewMode: "all",          // 'all' | 'mine'
    activeType: "selling",    // 'selling' | 'requesting'
  };

  // -------- DOM (bind only if present)
  const btnAll = document.getElementById("btn-all-posts");
  const btnMine = document.getElementById("btn-my-posts");

  const btnSelling = document.getElementById("btn-selling");
  const btnRequesting = document.getElementById("btn-requesting");

  const searchInput =
    document.getElementById("search-input") ||
    document.getElementById("posts-search") ||
    document.querySelector('input[type="search"]');

  const searchBtn =
    document.getElementById("search-btn") ||
    document.querySelector('[data-action="search"]');

  // -------- helpers
  function setActive(el, on) {
    if (!el) return;
    el.classList.toggle("active", !!on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function refreshUiState() {
    // expose for posts.js
    window.viewMode = window.AppState.viewMode;
    window.activePostType = window.AppState.activeType;

    // highlight buttons (if they exist)
    setActive(btnAll, window.AppState.viewMode === "all");
    setActive(btnMine, window.AppState.viewMode === "mine");

    setActive(btnSelling, window.AppState.activeType === "selling");
    setActive(btnRequesting, window.AppState.activeType === "requesting");

    // reload posts
    window.Posts?.loadPosts?.(searchInput?.value || "");
  }

  // -------- bindings
  btnAll?.addEventListener("click", () => {
    window.AppState.viewMode = "all";
    refreshUiState();
  });

  btnMine?.addEventListener("click", () => {
    window.AppState.viewMode = "mine";
    refreshUiState();
  });

  btnSelling?.addEventListener("click", () => {
    window.AppState.activeType = "selling";
    refreshUiState();
  });

  btnRequesting?.addEventListener("click", () => {
    window.AppState.activeType = "requesting";
    refreshUiState();
  });

  const doSearch = () => {
    window.Posts?.loadPosts?.(searchInput?.value || "");
  };

  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // -------- initial sync
  document.addEventListener("DOMContentLoaded", () => {
    // sync globals used by posts.js
    window.viewMode = window.AppState.viewMode;
    window.activePostType = window.AppState.activeType;

    window.Posts?.loadPosts?.("");
  });
})();

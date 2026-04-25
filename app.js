// app.js
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = "requesting";
  window.BF_LIMITS = { MAX_POSTS: 5, MAX_MESSAGES: 10 };

  function isBFPlus(profile) {
    if (!profile) return false;
    if (profile.premium === true) return true;
    const exp = profile.bfplus_expires_at || profile.bfPlus_expires_at;
    if (!exp) return false;
    return new Date(exp).getTime() > Date.now();
  }
  window.isBFPlus = isBFPlus;

  window.setActiveView = setActiveView;

  const navHome          = document.getElementById("nav-home");
  const navMap           = document.getElementById("nav-map");
  const navSettings      = document.getElementById("nav-settings");
  const navMatches       = document.getElementById("nav-matches");
  const navNotifications = document.getElementById("nav-notifications");
  const navMessages      = document.getElementById("nav-messages");
  const segSelling       = document.getElementById("seg-selling");
  const segRequesting    = document.getElementById("seg-requesting");
  const segSlider        = document.getElementById("segment-slider");
  const searchInput      = document.getElementById("search-input");
  const searchBtn        = document.getElementById("search-btn");
  const logoHome         = document.getElementById("logo-home");

  function updateSegment(type) {
    const s = type === "selling";
    if (segSelling)    segSelling.classList.toggle("active", s);
    if (segRequesting) segRequesting.classList.toggle("active", !s);
    if (segSlider)     segSlider.classList.toggle("right", s);
  }

  function refreshPosts() {
    if (window.Posts && typeof window.Posts.loadPosts === "function")
      window.Posts.loadPosts(searchInput ? searchInput.value.trim() : "");
  }

  function switchPostType(type) {
    window.activePostType = type;
    updateSegment(type);
    setActiveView("posts");
    refreshPosts();
  }

  function setActiveView(view) {
    activeView = view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const s = document.getElementById("view-" + view);
    if (s) s.classList.add("active");
    if (navHome)          navHome.classList.toggle("active",          view === "posts");
    if (navMap)           navMap.classList.toggle("active",           view === "map");
    if (navSettings)      navSettings.classList.toggle("active",      view === "settings");
    if (navMatches)       navMatches.classList.toggle("active",       view === "matches");
    if (navNotifications) navNotifications.classList.toggle("active", view === "notifications");
    if (navMessages)      navMessages.classList.toggle("active",      view === "messages");
    const sw = document.querySelector(".segment-wrap");
    if (sw) sw.style.display = view === "posts" ? "" : "none";
  }

  const postsView = document.getElementById("view-posts");
  if (postsView) {
    let tx = 0, ty = 0;
    postsView.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    postsView.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0 && window.activePostType === "requesting") switchPostType("requesting");
      else if (dx > 0 && window.activePostType === "selling") switchPostType("selling");
    }, { passive: true });
  }

  if (segSelling)    segSelling.addEventListener("click",    () => switchPostType("selling"));
  if (segRequesting) segRequesting.addEventListener("click", () => switchPostType("requesting"));
  if (logoHome)      logoHome.addEventListener("click",      () => switchPostType(window.activePostType));
  if (navHome)       navHome.addEventListener("click",       () => switchPostType(window.activePostType));

  if (searchBtn) searchBtn.addEventListener("click", refreshPosts);
  if (searchInput) {
    searchInput.addEventListener("keydown", e => { if (e.key === "Enter") refreshPosts(); });
    searchInput.addEventListener("input", refreshPosts);
  }

  if (navMatches) navMatches.addEventListener("click", () => {
    setActiveView("matches");
    if (window.Matches && typeof window.Matches.loadMatches === "function") window.Matches.loadMatches();
  });

  if (navMessages) navMessages.addEventListener("click", () => {
    if (!window.currentUser) { alert("Sign in to view messages."); return; }
    setActiveView("messages");
    if (window.Conversations && typeof window.Conversations.load === "function") window.Conversations.load();
  });

  if (navNotifications) navNotifications.addEventListener("click", () => {
    setActiveView("notifications");
    if (window.Notifications && typeof window.Notifications.load === "function") window.Notifications.load();
  });

  if (navMap) navMap.addEventListener("click", () => {
    if (!window.currentUser) { alert("Sign in to use the map."); return; }
    if (!isBFPlus(window.currentProfile)) {
      const go = confirm("The map is a BF+ feature ($4.99/mo). Upgrade now?");
      if (go && typeof window.startUpgrade === "function") window.startUpgrade();
      return;
    }
    if (window.BFMap && typeof window.BFMap.initMap === "function") window.BFMap.initMap();
    setActiveView("map");
  });

  if (navSettings) navSettings.addEventListener("click", () => setActiveView("settings"));

  const btnUpgrade = document.getElementById("btn-upgrade-premium");
  if (btnUpgrade) btnUpgrade.addEventListener("click", () => { if (typeof window.startUpgrade === "function") window.startUpgrade(); });

  const btnTheme = document.getElementById("btn-toggle-theme");
  if (btnTheme) btnTheme.addEventListener("click", () => document.body.classList.toggle("light-theme"));

  const btnDelete = document.getElementById("btn-delete-account");
  if (btnDelete) btnDelete.addEventListener("click", () => {
    if (confirm("Permanently delete your account and all posts? No undo."))
      alert("Contact support@buyrfindr.com to delete your account.");
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("upgraded") === "1") {
    window.history.replaceState({}, "", "/");
    setTimeout(async () => {
      if (window.Auth) await window.Auth.checkUser();
      alert("Welcome to BF+! Map and unlimited posts unlocked.");
    }, 2000);
  }
  if (urlParams.get("cancelled") === "1") {
    window.history.replaceState({}, "", "/");
    alert("Upgrade cancelled. You can upgrade any time from Settings.");
  }

  updateSegment("requesting");
  setActiveView("posts");
  refreshPosts();
});

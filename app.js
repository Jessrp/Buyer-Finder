// app.js
document.addEventListener("DOMContentLoaded", () => {
  let activeView = "posts";
  window.activePostType = window.activePostType || "selling";

  const tabSelling = document.getElementById("tab-selling");
  const tabRequests = document.getElementById("tab-requests");

  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");

  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const btnUpgradePremium = document.getElementById("btn-upgrade-premium");
  const btnDeleteAccount = document.getElementById("btn-delete-account");

  function setActiveView(view) {
    activeView = view;
    if (viewPosts) viewPosts.classList.toggle("active", view === "posts");
    if (viewMap) viewMap.classList.toggle("active", view === "map");
    if (viewSettings)
      viewSettings.classList.toggle("active", view === "settings");

    if (navSelling)
      navSelling.classList.toggle(
        "active",
        view === "posts" && window.activePostType === "selling"
      );
    if (navRequests)
      navRequests.classList.toggle(
        "active",
        view === "posts" && window.activePostType === "request"
      );
    if (navMap) navMap.classList.toggle("active", view === "map");
    if (navSettings)
      navSettings.classList.toggle("active", view === "settings");
  }

  function setActivePostType(type) {
    window.activePostType = type;
    if (tabSelling) tabSelling.classList.toggle("active", type === "selling");
    if (tabRequests)
      tabRequests.classList.toggle("active", type === "request");
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts();
    }
    setActiveView("posts");
  }

  if (tabSelling)
    tabSelling.addEventListener("click", () => setActivePostType("selling"));
  if (tabRequests)
    tabRequests.addEventListener("click", () => setActivePostType("request"));

  if (navSelling)
    navSelling.addEventListener("click", () => setActivePostType("selling"));
  if (navRequests)
    navRequests.addEventListener("click", () => setActivePostType("request"));

  if (navMap)
    navMap.addEventListener("click", () => {
      const profile = window.currentProfile;
      if (!window.currentUser) {
        alert("Map is for signed-in premium users.");
        return;
      }
      if (!profile || !profile.premium) {
        alert(
          "Map is a premium feature.\nUse the Upgrade button in Settings (dev-mode) to mark your account premium for now."
        );
        return;
      }
      if (window.BFMap && typeof window.BFMap.initMap === "function") {
        window.BFMap.initMap();
      }
      setActiveView("map");
    });

  if (navSettings)
    navSettings.addEventListener("click", () => setActiveView("settings"));

  function applyTheme() {
    const theme = localStorage.getItem("buyerfinder-theme") || "dark";
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  applyTheme();

  if (btnToggleTheme)
    btnToggleTheme.addEventListener("click", () => {
      const cur = localStorage.getItem("buyerfinder-theme") || "dark";
      const next = cur === "dark" ? "light" : "dark";
      localStorage.setItem("buyerfinder-theme", next);
      applyTheme();
    });

  if (btnUpgradePremium)
    btnUpgradePremium.addEventListener("click", async () => {
      if (!window.currentUser) {
        alert("Sign in first to upgrade.");
        return;
      }

      const ok = confirm(
        "In a real app this would open Stripe Checkout.\nFor now, press OK to mark your account as PREMIUM for testing."
      );
      if (!ok) return;

      const { error } = await window.supa
        .from("profiles")
        .update({ premium: true })
        .eq("id", window.currentUser.id);

      if (error) {
        alert("Failed to upgrade: " + error.message);
        return;
      }

      if (window.currentProfile) {
        window.currentProfile.premium = true;
      }

      if (window.Auth && typeof window.Auth.checkUser === "function") {
        window.Auth.checkUser();
      }

      alert("You are now PREMIUM. Map & unlimited posts unlocked.");
    });

  if (btnDeleteAccount)
    btnDeleteAccount.addEventListener("click", () => {
      alert(
        "Real account deletion must be done on a secure backend using the service role key.\nThis button just explains that; nothing is deleted."
      );
    });

  if (window.Posts && typeof window.Posts.loadPosts === "function") {
    window.Posts.loadPosts();
  }
});
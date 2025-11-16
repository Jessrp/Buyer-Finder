// app.js
window.BF = window.BF || {};

(function (BF) {
  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.supabase) {
      alert("Supabase library failed to load.");
      return;
    }

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    BF.supa = supa;

    // global state
    BF.state = {
      currentUser: null,
      currentProfile: null,
      activePostType: "selling", // "selling" | "request"
      activeView: "posts", // "posts" | "map" | "settings"
    };

    // DOM references
    BF.ui = {
      loginBtn: document.getElementById("login-btn"),
      logoutBtn: document.getElementById("logout-btn"),
      userCardSignin: document.getElementById("user-signin-shortcut"),

      tabSelling: document.getElementById("tab-selling"),
      tabRequests: document.getElementById("tab-requests"),

      viewPosts: document.getElementById("view-posts"),
      viewMap: document.getElementById("view-map"),
      viewSettings: document.getElementById("view-settings"),

      postsGrid: document.getElementById("posts-grid"),
      postsStatus: document.getElementById("posts-status"),

      navSelling: document.getElementById("nav-selling"),
      navRequests: document.getElementById("nav-requests"),
      navMap: document.getElementById("nav-map"),
      navSettings: document.getElementById("nav-settings"),

      userNameEl: document.getElementById("user-name"),
      userEmailEl: document.getElementById("user-email"),
      userPlanEl: document.getElementById("user-plan"),
      userAvatarEl: document.getElementById("user-avatar"),

      profileEmail: document.getElementById("profile-email"),
      profileUsername: document.getElementById("profile-username"),
      profileAvatarInput: document.getElementById("profile-avatar-input"),
      btnSaveUsername: document.getElementById("btn-save-username"),
      btnUploadAvatar: document.getElementById("btn-upload-avatar"),
      btnToggleTheme: document.getElementById("btn-toggle-theme"),
      premiumStatusText: document.getElementById("premium-status-text"),
      btnUpgradePremium: document.getElementById("btn-upgrade-premium"),
      btnDeleteAccount: document.getElementById("btn-delete-account"),

      mapMessage: document.getElementById("map-message"),
      mapCanvas: document.getElementById("map-canvas"),

      fabAdd: document.getElementById("fab-add"),
      modalBackdrop: document.getElementById("modal-backdrop"),
      postTitle: document.getElementById("post-title"),
      postDescription: document.getElementById("post-description"),
      postPrice: document.getElementById("post-price"),
      postType: document.getElementById("post-type"),
      postImage: document.getElementById("post-image"),
      btnCancelPost: document.getElementById("btn-cancel-post"),
      btnSavePost: document.getElementById("btn-save-post"),
      postModalHint: document.getElementById("post-modal-hint"),
    };

    // Theme toggle
    function applyTheme() {
      const theme = localStorage.getItem("buyerfinder-theme") || "dark";
      if (theme === "light") document.body.classList.add("light");
      else document.body.classList.remove("light");
    }
    applyTheme();

    BF.ui.btnToggleTheme.addEventListener("click", () => {
      const current = localStorage.getItem("buyerfinder-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("buyerfinder-theme", next);
      applyTheme();
    });

    const A = BF.auth;
    const P = BF.posts;
    const M = BF.map;
    const ui = BF.ui;
    const state = BF.state;

    // Auth buttons
    ui.loginBtn.addEventListener("click", A.loginWithEmail);
    ui.logoutBtn.addEventListener("click", A.logout);
    ui.userCardSignin.addEventListener("click", A.loginWithEmail);

    ui.btnSaveUsername.addEventListener("click", A.saveUsername);
    ui.btnUploadAvatar.addEventListener("click", A.uploadAvatar);
    ui.btnUpgradePremium.addEventListener("click", A.fakeUpgradePremium);
    ui.btnDeleteAccount.addEventListener("click", A.fakeDeleteAccount);

    // Top tabs
    function setTopTab(type) {
      state.activePostType = type;
      ui.tabSelling.classList.toggle("active", type === "selling");
      ui.tabRequests.classList.toggle("active", type === "request");
      P.loadPosts();
    }

    ui.tabSelling.addEventListener("click", () => setTopTab("selling"));
    ui.tabRequests.addEventListener("click", () => setTopTab("request"));

    // Views
    function showView(view) {
      state.activeView = view;

      ui.viewPosts.classList.toggle("active", view === "posts");
      ui.viewMap.classList.toggle("active", view === "map");
      ui.viewSettings.classList.toggle("active", view === "settings");

      ui.navSelling.classList.toggle("active", view === "posts" && state.activePostType === "selling");
      ui.navRequests.classList.toggle("active", view === "posts" && state.activePostType === "request");
      ui.navMap.classList.toggle("active", view === "map");
      ui.navSettings.classList.toggle("active", view === "settings");

      if (view === "map") {
        M.showMapView();
      }
    }

    // Bottom nav wiring
    ui.navSelling.addEventListener("click", () => {
      setTopTab("selling");
      showView("posts");
    });

    ui.navRequests.addEventListener("click", () => {
      setTopTab("request");
      showView("posts");
    });

    ui.navMap.addEventListener("click", () => {
      showView("map");
    });

    ui.navSettings.addEventListener("click", () => {
      A.syncSettingsUI();
      showView("settings");
    });

    // FAB + modal
    ui.fabAdd.addEventListener("click", P.openModal);
    ui.btnCancelPost.addEventListener("click", P.closeModal);
    ui.btnSavePost.addEventListener("click", P.savePost);

    // Init
    (async function init() {
      await A.checkUser();
      await P.loadPosts();
      showView("posts");
    })();
  });
})(window.BF);
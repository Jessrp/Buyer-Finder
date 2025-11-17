// app.js
(function () {
  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_ANON = "YOUR_SUPABASE_ANON_KEY";

  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  window.supa = supa;

  let currentUser = null;
  let currentProfile = null;
  let activePostType = "selling";
  let currentSearch = "";

  window.currentUser = currentUser;
  window.currentProfile = currentProfile;
  window.activePostType = activePostType;

  document.addEventListener("DOMContentLoaded", () => {
    // DOM refs
    const headerLoginBtn = document.getElementById("btn-signin-header");
    const cardLoginBtn = document.getElementById("btn-signin-card");
    const btnLogout = document.getElementById("btn-logout");

    const tabSelling = document.getElementById("tab-selling");
    const tabRequests = document.getElementById("tab-requests");

    const navSelling = document.getElementById("nav-selling");
    const navRequests = document.getElementById("nav-requests");
    const navMap = document.getElementById("nav-map");
    const navSettings = document.getElementById("nav-settings");

    const viewPosts = document.getElementById("view-posts");
    const viewSettings = document.getElementById("view-settings");

    const userNameEl = document.getElementById("user-name");
    const userStatusEl = document.getElementById("user-status");
    const userPlanBadge = document.getElementById("user-plan-badge");

    const profileEmail = document.getElementById("profile-email");
    const profileUsername = document.getElementById("profile-username");
    const btnSaveUsername = document.getElementById("btn-save-username");
    const profileAvatarInput = document.getElementById("profile-avatar-input");
    const btnUploadAvatar = document.getElementById("btn-upload-avatar");
    const btnToggleTheme = document.getElementById("btn-toggle-theme");
    const premiumStatusText = document.getElementById("premium-status-text");
    const btnUpgradePremium = document.getElementById("btn-upgrade-premium");

    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");

    // Map panel
    const mapOverlay = document.getElementById("map-overlay");
    const mapPanel = document.getElementById("map-panel");
    const mapCloseBtn = document.getElementById("map-close-btn");

    // THEME
    function applyTheme() {
      const t = localStorage.getItem("bf-theme") || "dark";
      if (t === "light") {
        document.body.classList.add("light");
      } else {
        document.body.classList.remove("light");
      }
    }
    applyTheme();

    if (btnToggleTheme) {
      btnToggleTheme.addEventListener("click", () => {
        const t = localStorage.getItem("bf-theme") || "dark";
        const next = t === "dark" ? "light" : "dark";
        localStorage.setItem("bf-theme", next);
        applyTheme();
      });
    }

    // AUTH
    async function checkUser() {
      const { data } = await supa.auth.getUser();
      currentUser = data.user || null;
      window.currentUser = currentUser;

      if (currentUser) {
        await loadOrCreateProfile();
      } else {
        currentProfile = null;
        window.currentProfile = null;
        renderUserCard();
      }

      if (window.Posts && typeof window.Posts.loadPosts === "function") {
        window.Posts.loadPosts();
      }
    }

    async function loginWithEmail() {
      const email = prompt("Enter your email for a login link:");
      if (!email) return;
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) alert(error.message);
      else alert("Check your email for the login link.");
    }

    async function logout() {
      await supa.auth.signOut();
      alert("Signed out.");
      await checkUser();
    }

    if (headerLoginBtn) headerLoginBtn.addEventListener("click", loginWithEmail);
    if (cardLoginBtn) cardLoginBtn.addEventListener("click", loginWithEmail);
    if (btnLogout) btnLogout.addEventListener("click", logout);

    async function loadOrCreateProfile() {
      if (!currentUser) return;
      let { data, error } = await supa
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!data) {
        const username = (currentUser.email || "user").split("@")[0];
        const { data: inserted } = await supa
          .from("profiles")
          .insert({
            id: currentUser.id,
            email: currentUser.email,
            username,
            premium: false,
            created_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();
        data = inserted;
      }

      if (error) console.log("profile error:", error.message);

      currentProfile = data || null;
      window.currentProfile = currentProfile;
      renderUserCard();
      syncSettingsUI();
    }

    function renderUserCard() {
      if (!userNameEl || !userStatusEl || !userPlanBadge) return;

      if (!currentUser) {
        userNameEl.textContent = "Guest";
        userStatusEl.textContent = "Not signed in";
        userPlanBadge.textContent = "Free (guest)";
        userPlanBadge.className = "badge free";
      } else {
        userNameEl.textContent =
          (currentProfile && currentProfile.username) || "User";
        userStatusEl.textContent = currentUser.email || "";
        const isPremium = !!(currentProfile && currentProfile.premium);
        userPlanBadge.textContent = isPremium ? "Premium" : "Free";
        userPlanBadge.className = "badge " + (isPremium ? "premium" : "free");
      }
    }

    function syncSettingsUI() {
      if (!currentUser) {
        if (profileEmail) profileEmail.value = "";
        if (profileUsername) profileUsername.value = "";
        if (premiumStatusText)
          premiumStatusText.textContent = "Not signed in.";
        return;
      }
      if (profileEmail) profileEmail.value = currentUser.email || "";
      if (profileUsername)
        profileUsername.value =
          (currentProfile && currentProfile.username) || "";
      const isPremium = !!(currentProfile && currentProfile.premium);
      if (premiumStatusText)
        premiumStatusText.textContent = isPremium
          ? "You are a premium user."
          : "Free plan.";
    }

    if (btnSaveUsername) {
      btnSaveUsername.addEventListener("click", async () => {
        if (!currentUser) return alert("Sign in first.");
        const newName = profileUsername.value.trim();
        if (!newName) return;
        const { error } = await supa
          .from("profiles")
          .update({ username: newName })
          .eq("id", currentUser.id);
        if (error) alert(error.message);
        else {
          if (currentProfile) currentProfile.username = newName;
          renderUserCard();
          alert("Username updated.");
        }
      });
    }

    if (btnUploadAvatar) {
      btnUploadAvatar.addEventListener("click", async () => {
        if (!currentUser) return alert("Sign in first.");
        const file = profileAvatarInput.files[0];
        if (!file) return alert("Choose a file.");

        const ext = file.name.split(".").pop() || "jpg";
        const path = `avatars/${currentUser.id}.${ext}`;

        const { error: uploadError } = await supa.storage
          .from("post_images")
          .upload(path, file, { upsert: true });
        if (uploadError) {
          alert("Upload failed: " + uploadError.message);
          return;
        }

        const { data: urlData } = supa.storage
          .from("post_images")
          .getPublicUrl(path);

        const publicUrl = urlData.publicUrl;
        await supa
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", currentUser.id)
          .catch(() => {});
        if (currentProfile) currentProfile.avatar_url = publicUrl;
        alert("Avatar updated.");
      });
    }

    // NAV & TABS
    function setActiveNav(target) {
      [navSelling, navRequests, navMap, navSettings].forEach((btn) => {
        if (!btn) return;
        if (btn === target) btn.classList.add("active");
        else btn.classList.remove("active");
      });
    }

    function showView(view) {
      [viewPosts, viewSettings].forEach((v) => {
        if (!v) return;
        v.classList.remove("active");
      });
      if (view) view.classList.add("active");
    }

    if (tabSelling) {
      tabSelling.addEventListener("click", () => {
        activePostType = "selling";
        window.activePostType = "selling";
        tabSelling.classList.add("active");
        tabRequests.classList.remove("active");
        if (window.Posts) window.Posts.loadPosts();
      });
    }

    if (tabRequests) {
      tabRequests.addEventListener("click", () => {
        activePostType = "request";
        window.activePostType = "request";
        tabRequests.classList.add("active");
        tabSelling.classList.remove("active");
        if (window.Posts) window.Posts.loadPosts();
      });
    }

    if (navSelling) {
      navSelling.addEventListener("click", () => {
        activePostType = "selling";
        window.activePostType = "selling";
        tabSelling?.classList.add("active");
        tabRequests?.classList.remove("active");
        showView(viewPosts);
        setActiveNav(navSelling);
        if (window.Posts) window.Posts.loadPosts();
      });
    }

    if (navRequests) {
      navRequests.addEventListener("click", () => {
        activePostType = "request";
        window.activePostType = "request";
        tabRequests?.classList.add("active");
        tabSelling?.classList.remove("active");
        showView(viewPosts);
        setActiveNav(navRequests);
        if (window.Posts) window.Posts.loadPosts();
      });
    }

    if (navSettings) {
      navSettings.addEventListener("click", () => {
        showView(viewSettings);
        setActiveNav(navSettings);
      });
    }

    if (navMap) {
      navMap.addEventListener("click", () => {
        // open map slide-up
        if (mapOverlay) mapOverlay.classList.add("active");
        if (mapPanel) mapPanel.classList.add("active");
        setActiveNav(navMap);
        if (window.BFMap && typeof window.BFMap.initMap === "function") {
          window.BFMap.initMap();
        }
      });
    }

    if (mapCloseBtn) {
      mapCloseBtn.addEventListener("click", () => {
        if (mapOverlay) mapOverlay.classList.remove("active");
        if (mapPanel) mapPanel.classList.remove("active");
        // go back to posts
        showView(viewPosts);
        setActiveNav(
          activePostType === "request" ? navRequests : navSelling
        );
      });
    }

    // SEARCH
    function applySearch() {
      currentSearch = (searchInput?.value || "").trim();
      if (window.Posts && typeof window.Posts.setSearchQuery === "function") {
        window.Posts.setSearchQuery(currentSearch);
      }
      if (window.Posts && typeof window.Posts.loadPosts === "function") {
        window.Posts.loadPosts();
      }
    }

    if (searchBtn) searchBtn.addEventListener("click", applySearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applySearch();
      });
    }

    // initial
    checkUser();
  });
})();

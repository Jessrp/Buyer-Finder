(function () {
  const SUPA_URL = "YOUR_SUPABASE_URL";
  const SUPA_ANON = "YOUR_SUPABASE_ANON_KEY";

  const supa = window.supabase.createClient(SUPA_URL, SUPA_ANON);
  window.supa = supa;

  let currentUser = null;
  let currentProfile = null;

  window.currentUser = currentUser;
  window.currentProfile = currentProfile;

  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");

  const tabSelling = document.getElementById("tab-selling");
  const tabRequests = document.getElementById("tab-requests");

  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userCardSignin = document.getElementById("user-signin-shortcut");

  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  const userPlanEl = document.getElementById("user-plan");
  const userAvatarEl = document.getElementById("user-avatar");

  const profileEmail = document.getElementById("profile-email");
  const profileUsername = document.getElementById("profile-username");
  const profileAvatarInput = document.getElementById("profile-avatar-input");
  const btnSaveUsername = document.getElementById("btn-save-username");
  const btnUploadAvatar = document.getElementById("btn-upload-avatar");
  const btnToggleTheme = document.getElementById("btn-toggle-theme");

  const premiumStatusText = document.getElementById("premium-status-text");
  const btnUpgradePremium = document.getElementById("btn-upgrade-premium");
  const btnDeleteAccount = document.getElementById("btn-delete-account");

  const mapCloseBtn = document.getElementById("map-close-btn");

  window.activePostType = "selling";

  // THEME
  function applyTheme() {
    const theme = localStorage.getItem("bf-theme") || "dark";
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  applyTheme();

  btnToggleTheme.addEventListener("click", () => {
    const current = localStorage.getItem("bf-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("bf-theme", next);
    applyTheme();
  });

  // AUTH
  async function checkUser() {
    const { data } = await supa.auth.getUser();
    currentUser = data.user || null;
    window.currentUser = currentUser;

    loginBtn.style.display = currentUser ? "none" : "inline-block";
    logoutBtn.style.display = currentUser ? "inline-block" : "none";
    userCardSignin.style.display = currentUser ? "none" : "inline-block";

    if (currentUser) {
      await loadOrCreateProfile();
    } else {
      currentProfile = null;
      window.currentProfile = null;
      renderUserCard();
    }
  }

  async function login() {
    const email = prompt("Enter your email:");
    if (!email) return;

    await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    alert("Check your email for login link.");
  }

  async function logout() {
    await supa.auth.signOut();
    alert("Signed out.");
    checkUser();
  }

  loginBtn.addEventListener("click", login);
  logoutBtn.addEventListener("click", logout);
  userCardSignin.addEventListener("click", login);

  // PROFILE
  async function loadOrCreateProfile() {
    let { data } = await supa
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
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();
      data = inserted;
    }

    currentProfile = data;
    window.currentProfile = data;

    renderUserCard();
    syncSettingsUI();
  }

  function renderUserCard() {
    if (!currentUser) {
      userNameEl.textContent = "Guest";
      userEmailEl.textContent = "Not signed in";
      userPlanEl.textContent = "Free (guest)";
      userAvatarEl.innerHTML = "";
      return;
    }

    userNameEl.textContent = currentProfile.username;
    userEmailEl.textContent = currentUser.email;
    userPlanEl.textContent = currentProfile.premium ? "Premium" : "Free";
    userAvatarEl.innerHTML = "";

    const img = document.createElement("img");
    img.src =
      currentProfile.avatar_url ||
      "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#333"/><text x="50%" y="55%" fill="#ccc" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    userAvatarEl.appendChild(img);
  }

  function syncSettingsUI() {
    profileEmail.value = currentUser?.email || "";
    profileUsername.value = currentProfile?.username || "";
    premiumStatusText.textContent = currentProfile?.premium
      ? "Premium active"
      : "Free plan";
  }

  btnSaveUsername.addEventListener("click", async () => {
    const newName = profileUsername.value.trim();
    await supa
      .from("profiles")
      .update({ username: newName })
      .eq("id", currentUser.id);
    currentProfile.username = newName;
    renderUserCard();
  });

  btnUploadAvatar.addEventListener("click", async () => {
    const file = profileAvatarInput.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `avatars/${currentUser.id}.${ext}`;

    await supa.storage.from("post_images").upload(path, file, {
      upsert: true,
    });

    const { data } = supa.storage
      .from("post_images")
      .getPublicUrl(path);

    await supa
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", currentUser.id);

    currentProfile.avatar_url = data.publicUrl;
    renderUserCard();
  });

  btnUpgradePremium.addEventListener("click", () => {
    alert("Premium payment flow to be added later.");
  });

  btnDeleteAccount.addEventListener("click", () => {
    alert("Cannot delete account without admin backend.");
  });

  // NAVIGATION
  function hideAllViews() {
    viewPosts.classList.remove("active");
    viewMap.classList.remove("active");
    viewSettings.classList.remove("active");
  }

  navSelling.addEventListener("click", () => {
    window.activePostType = "selling";
    hideAllViews();
    viewPosts.classList.add("active");
    navSelling.classList.add("active");
    navRequests.classList.remove("active");
    navMap.classList.remove("active");
    navSettings.classList.remove("active");
    window.Posts.loadPosts();
  });

  navRequests.addEventListener("click", () => {
    window.activePostType = "request";
    hideAllViews();
    viewPosts.classList.add("active");
    navRequests.classList.add("active");
    navSelling.classList.remove("active");
    navMap.classList.remove("active");
    navSettings.classList.remove("active");
    window.Posts.loadPosts();
  });

  navMap.addEventListener("click", () => {
    hideAllViews();
    viewMap.classList.add("active");
    navMap.classList.add("active");
    navSelling.classList.remove("active");
    navRequests.classList.remove("active");
    navSettings.classList.remove("active");

    if (window.BFMap) window.BFMap.initMap();
  });

  navSettings.addEventListener("click", () => {
    hideAllViews();
    viewSettings.classList.add("active");
    navSettings.classList.add("active");
    navSelling.classList.remove("active");
    navRequests.classList.remove("active");
    navMap.classList.remove("active");
  });

  // MAP CLOSE BUTTON — FIXED
  function closeMapView() {
    viewMap.classList.remove("active");
    navMap.classList.remove("active");

    viewPosts.classList.add("active");
    if (window.activePostType === "selling") {
      navSelling.classList.add("active");
      navRequests.classList.remove("active");
    } else {
      navRequests.classList.add("active");
      navSelling.classList.remove("active");
    }
    window.Posts.loadPosts();
  }

  if (mapCloseBtn) {
    mapCloseBtn.addEventListener("click", closeMapView);
  }

  // Start-up
  checkUser();
})();

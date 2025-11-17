// app.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("app.js loaded");

  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

  window.supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // Global app state
  window.currentUser = null;
  window.currentProfile = null;
  window.activePostType = "selling";

  // DOM
  const loginGoogleBtn = document.getElementById("login-google-btn");
  const loginEmailBtn = document.getElementById("login-email-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userSigninShortcut = document.getElementById("user-signin-shortcut");

  const tabSelling = document.getElementById("tab-selling");
  const tabRequests = document.getElementById("tab-requests");

  const viewPosts = document.getElementById("view-posts");
  const viewMap = document.getElementById("view-map");
  const viewSettings = document.getElementById("view-settings");

  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");
  const navMap = document.getElementById("nav-map");
  const navSettings = document.getElementById("nav-settings");

  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  const userPlanEl = document.getElementById("user-plan");
  const userAvatarEl = document.getElementById("user-avatar");

  const profileEmail = document.getElementById("profile-email");
  const profileUsername = document.getElementById("profile-username");
  const profileAvatarInput = document.getElementById("profile-avatar-input");
  const profileLocationText = document.getElementById("profile-location-text");
  const btnSaveUsername = document.getElementById("btn-save-username");
  const btnUploadAvatar = document.getElementById("btn-upload-avatar");
  const btnSaveLocation = document.getElementById("btn-save-location");
  const btnUseGPS = document.getElementById("btn-use-gps");
  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const premiumStatusText = document.getElementById("premium-status-text");
  const btnUpgradePremium = document.getElementById("btn-upgrade-premium");

  const minimapToggle = document.getElementById("setting-minimap-toggle");

  // ------------------------------------------
  // THEME
  // ------------------------------------------
  function applyTheme() {
    const theme = localStorage.getItem("bf-theme") || "dark";
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  applyTheme();

  btnToggleTheme?.addEventListener("click", () => {
    const current = localStorage.getItem("bf-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("bf-theme", next);
    applyTheme();
  });

  // ------------------------------------------
  // MINIMAP SETTING (the one you requested)
  // ------------------------------------------
  if (minimapToggle) {
    const pref = localStorage.getItem("bf-show-minimap");
    minimapToggle.checked = pref !== "false";

    minimapToggle.addEventListener("change", () => {
      localStorage.setItem(
        "bf-show-minimap",
        minimapToggle.checked ? "true" : "false"
      );
    });
  }

  // ------------------------------------------
  // AUTH
  // ------------------------------------------
  loginGoogleBtn?.addEventListener("click", async () => {
    const { data, error } = await window.supa.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://buyerfinder.vercel.app"
      }
    });
    if (error) alert(error.message);
  });

  loginEmailBtn?.addEventListener("click", async () => {
    const email = prompt("Enter your email for a login link:");
    if (!email) return;
    const { error } = await window.supa.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://buyerfinder.vercel.app"
      }
    });
    if (error) alert(error.message);
    else alert("Check your email.");
  });

  userSigninShortcut?.addEventListener("click", () => {
    loginEmailBtn.click();
  });

  logoutBtn?.addEventListener("click", async () => {
    await window.supa.auth.signOut();
    alert("Signed out.");
    loadAuthState();
  });

  async function loadAuthState() {
    const { data } = await window.supa.auth.getUser();
    window.currentUser = data.user || null;

    if (!window.currentUser) {
      loginGoogleBtn.style.display = "inline-block";
      loginEmailBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      userSigninShortcut.style.display = "inline-block";
      window.currentProfile = null;
      renderUserCard();
      Posts.loadPosts();
      return;
    }

    loginGoogleBtn.style.display = "none";
    loginEmailBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userSigninShortcut.style.display = "none";

    await loadProfile();
    renderUserCard();
    Posts.loadPosts();
  }

  // ------------------------------------------
  // PROFILE
  // ------------------------------------------
  async function loadProfile() {
    const user = window.currentUser;
    if (!user) return;

    const { data: profile, error } = await window.supa
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) console.log("Profile fetch error:", error);

    if (!profile) {
      // create default
      const username = (user.email || "user")
        .split("@")[0]
        .slice(0, 20);

      const { data: newProfile } = await window.supa
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          username,
          premium: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      window.currentProfile = newProfile;
    } else {
      window.currentProfile = profile;
    }

    syncSettingsUI();
  }

  function syncSettingsUI() {
    const user = window.currentUser;
    const profile = window.currentProfile;

    if (!user) {
      profileEmail.value = "";
      profileUsername.value = "";
      premiumStatusText.textContent = "You’re not signed in.";
      return;
    }

    profileEmail.value = user.email || "";
    profileUsername.value = profile?.username || "";
    profileLocationText.value = profile?.location_text || "";

    premiumStatusText.textContent = profile?.premium
      ? "You are a premium user."
      : "Free plan: Premium features locked.";
  }

  function renderUserCard() {
    const user = window.currentUser;
    const profile = window.currentProfile;

    if (!user) {
      userNameEl.textContent = "Guest";
      userEmailEl.textContent = "Not signed in";
      userPlanEl.textContent = "Free (guest)";
      userPlanEl.className = "badge";
      userAvatarEl.innerHTML = "";
      userAvatarEl.style.background =
        "linear-gradient(135deg, #333, #555)";
      return;
    }

    userNameEl.textContent = profile?.username || "User";
    userEmailEl.textContent = user.email || "";

    if (profile?.premium) {
      userPlanEl.textContent = "Premium";
      userPlanEl.className = "badge premium";
    } else {
      userPlanEl.textContent = "Free";
      userPlanEl.className = "badge";
    }

    userAvatarEl.innerHTML = "";
    const img = document.createElement("img");
    img.src =
      profile?.avatar_url ||
      "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#333"/><text x="50%" y="55%" fill="#999" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    userAvatarEl.appendChild(img);
  }

  // Save username
  btnSaveUsername?.addEventListener("click", async () => {
    const user = window.currentUser;
    if (!user) return alert("Sign in first.");

    const newName = profileUsername.value.trim();
    if (!newName) return;

    await window.supa
      .from("profiles")
      .update({ username: newName })
      .eq("id", user.id);

    if (window.currentProfile)
      window.currentProfile.username = newName;

    renderUserCard();
    alert("Username updated.");
  });

  // Upload avatar
  btnUploadAvatar?.addEventListener("click", async () => {
    const user = window.currentUser;
    if (!user) return alert("Sign in first.");

    const file = profileAvatarInput.files[0];
    if (!file) return alert("Choose a file.");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await window.supa.storage
      .from("post_images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data: urlData } = window.supa.storage
      .from("post_images")
      .getPublicUrl(path);

    const publicUrl = urlData?.publicUrl;

    await window.supa
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (window.currentProfile)
      window.currentProfile.avatar_url = publicUrl;

    renderUserCard();
    alert("Avatar updated.");
  });

  // Save manual location text
  btnSaveLocation?.addEventListener("click", async () => {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user || !profile) return alert("Sign in first.");

    const text = profileLocationText.value.trim();
    await window.supa
      .from("profiles")
      .update({ location_text: text })
      .eq("id", user.id);

    window.currentProfile.location_text = text;
    alert("Location updated.");
  });

  // Use GPS
  btnUseGPS?.addEventListener("click", () => {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user || !profile) return alert("Sign in first.");

    if (!navigator.geolocation) {
      alert("GPS not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));

        await window.supa
          .from("profiles")
          .update({ lat, lng })
          .eq("id", user.id);

        window.currentProfile.lat = lat;
        window.currentProfile.lng = lng;

        alert("GPS location saved.");
      },
      () => {
        alert("Failed to get GPS location.");
      }
    );
  });

  // Fake premium upgrade
  btnUpgradePremium?.addEventListener("click", async () => {
    const user = window.currentUser;
    if (!user) return alert("Sign in first.");

    await window.supa
      .from("profiles")
      .update({ premium: true })
      .eq("id", user.id);

    window.currentProfile.premium = true;
    syncSettingsUI();
    renderUserCard();
    alert("Premium activated (dev mode).");
  });

  // ------------------------------------------
  // NAVIGATION
  // ------------------------------------------
  function switchView(target) {
    viewPosts.classList.remove("active");
    viewMap.classList.remove("active");
    viewSettings.classList.remove("active");

    navSelling.classList.remove("active");
    navRequests.classList.remove("active");
    navMap.classList.remove("active");
    navSettings.classList.remove("active");

    if (target === "posts") {
      viewPosts.classList.add("active");
      navSelling.classList.add("active");
      Posts.loadPosts();
    }

    if (target === "requests") {
      viewPosts.classList.add("active");
      navRequests.classList.add("active");
      window.activePostType = "request";
      Posts.loadPosts();
    }

    if (target === "map") {
      viewMap.classList.add("active");
      navMap.classList.add("active");
      if (window.BFMap && BFMap.initMap) BFMap.initMap();
    }

    if (target === "settings") {
      viewSettings.classList.add("active");
      navSettings.classList.add("active");
    }
  }

  navSelling?.addEventListener("click", () => {
    window.activePostType = "selling";
    switchView("posts");
  });

  navRequests?.addEventListener("click", () => {
    window.activePostType = "request";
    switchView("requests");
  });

  navMap?.addEventListener("click", () => {
    switchView("map");
  });

  navSettings?.addEventListener("click", () => {
    switchView("settings");
  });

  // Top tabs
  tabSelling?.addEventListener("click", () => {
    window.activePostType = "selling";
    tabSelling.classList.add("active");
    tabRequests.classList.remove("active");
    Posts.loadPosts();
  });

  tabRequests?.addEventListener("click", () => {
    window.activePostType = "request";
    tabRequests.classList.add("active");
    tabSelling.classList.remove("active");
    Posts.loadPosts();
  });

  // ------------------------------------------
  // INIT
  // ------------------------------------------
  loadAuthState();
});

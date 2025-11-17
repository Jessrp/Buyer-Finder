// auth.js
const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window.supa = supa;

window.currentUser = null;
window.currentProfile = null;

let loginGoogleBtn,
  loginEmailBtn,
  logoutBtn,
  userCardSignin,
  userNameEl,
  userEmailEl,
  userPlanEl,
  userAvatarEl,
  profileEmail,
  profileUsername,
  profileAvatarInput,
  profileLocationText,
  btnSaveUsername,
  btnUploadAvatar,
  btnSaveLocation,
  btnUseGps,
  premiumStatusText;

document.addEventListener("DOMContentLoaded", () => {
  loginGoogleBtn = document.getElementById("login-google-btn");
  loginEmailBtn = document.getElementById("login-email-btn");
  logoutBtn = document.getElementById("logout-btn");
  userCardSignin = document.getElementById("user-signin-shortcut");

  userNameEl = document.getElementById("user-name");
  userEmailEl = document.getElementById("user-email");
  userPlanEl = document.getElementById("user-plan");
  userAvatarEl = document.getElementById("user-avatar");

  profileEmail = document.getElementById("profile-email");
  profileUsername = document.getElementById("profile-username");
  profileAvatarInput = document.getElementById("profile-avatar-input");
  profileLocationText = document.getElementById("profile-location-text");

  btnSaveUsername = document.getElementById("btn-save-username");
  btnUploadAvatar = document.getElementById("btn-upload-avatar");
  btnSaveLocation = document.getElementById("btn-save-location");
  btnUseGps = document.getElementById("btn-use-gps");
  premiumStatusText = document.getElementById("premium-status-text");

  if (loginGoogleBtn) loginGoogleBtn.addEventListener("click", loginWithGoogle);
  if (loginEmailBtn) loginEmailBtn.addEventListener("click", loginWithEmail);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  if (userCardSignin) userCardSignin.addEventListener("click", loginWithEmail);

  if (btnSaveUsername) btnSaveUsername.addEventListener("click", saveUsername);
  if (btnUploadAvatar) btnUploadAvatar.addEventListener("click", uploadAvatar);
  if (btnSaveLocation) btnSaveLocation.addEventListener("click", saveLocation);
  if (btnUseGps) btnUseGps.addEventListener("click", useGpsLocation);

  checkUser();

  supa.auth.onAuthStateChange((_event, _session) => {
    checkUser();
  });
});

async function checkUser() {
  const { data, error } = await supa.auth.getUser();
  if (error) {
    console.log("getUser error", error.message);
  }
  const user = data?.user || null;
  window.currentUser = user;

  if (!user) {
    window.currentProfile = null;
    renderUserCard();
    syncSettingsUI();
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      window.Posts.loadPosts();
    }
    return;
  }

  await loadOrCreateProfile();
  renderUserCard();
  syncSettingsUI();
  if (window.Posts && typeof window.Posts.loadPosts === "function") {
    window.Posts.loadPosts();
  }
}

async function loginWithGoogle() {
  const { error } = await supa.auth.signInWithOAuth({
    provider: "google",
  });
  if (error) alert(error.message);
}

async function loginWithEmail() {
  const email = prompt("Enter your email for a magic link:");
  if (!email) return;
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "https://buyerfinder.vercel.app",
    },
  });
  if (error) alert(error.message);
  else alert("Check your email for the login link.");
}

async function logout() {
  await supa.auth.signOut();
  alert("Signed out.");
  window.currentUser = null;
  window.currentProfile = null;
  renderUserCard();
  syncSettingsUI();
  if (window.Posts && typeof window.Posts.loadPosts === "function") {
    window.Posts.loadPosts();
  }
}

async function loadOrCreateProfile() {
  const user = window.currentUser;
  if (!user) return;

  let { data, error } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.log("profile fetch error", error.message);
  }

  if (!data) {
    const username = (user.email || "user").split("@")[0].slice(0, 20);
    const { data: inserted, error: insertErr } = await supa
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        username,
        premium: false,
      })
      .select()
      .maybeSingle();
    if (!insertErr && inserted) window.currentProfile = inserted;
    else
      window.currentProfile = {
        id: user.id,
        email: user.email,
        username,
        premium: false,
      };
  } else {
    window.currentProfile = data;
  }
}

function renderUserCard() {
  const user = window.currentUser;
  const profile = window.currentProfile;

  if (!user) {
    if (userNameEl) userNameEl.textContent = "Guest";
    if (userEmailEl) userEmailEl.textContent = "Not signed in";
    if (userPlanEl) {
      userPlanEl.textContent = "Free (guest)";
      userPlanEl.className = "badge";
    }
    if (userAvatarEl) {
      userAvatarEl.innerHTML = "";
      const ph = document.createElement("div");
      ph.style.width = "100%";
      ph.style.height = "100%";
      ph.style.background = "linear-gradient(135deg,#333,#555)";
      userAvatarEl.appendChild(ph);
    }
    if (logoutBtn) logoutBtn.style.display = "none";
    if (loginGoogleBtn) loginGoogleBtn.style.display = "inline-block";
    if (loginEmailBtn) loginEmailBtn.style.display = "inline-block";
    if (userCardSignin) userCardSignin.style.display = "inline-block";
    return;
  }

  if (userNameEl) userNameEl.textContent = profile?.username || "User";
  if (userEmailEl) userEmailEl.textContent = user.email || "";
  const isPremium = !!profile?.premium;
  if (userPlanEl) {
    userPlanEl.textContent = isPremium ? "Premium" : "Free";
    userPlanEl.className = "badge" + (isPremium ? " premium" : "");
  }
  if (userAvatarEl) {
    userAvatarEl.innerHTML = "";
    const img = document.createElement("img");
    if (profile?.avatar_url) {
      img.src = profile.avatar_url;
    } else {
      img.src =
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    }
    userAvatarEl.appendChild(img);
  }
  if (logoutBtn) logoutBtn.style.display = "inline-block";
  if (loginGoogleBtn) loginGoogleBtn.style.display = "none";
  if (loginEmailBtn) loginEmailBtn.style.display = "none";
  if (userCardSignin) userCardSignin.style.display = "none";
}

function syncSettingsUI() {
  const user = window.currentUser;
  const profile = window.currentProfile;
  if (!user) {
    if (profileEmail) profileEmail.value = "";
    if (profileUsername) profileUsername.value = "";
    if (profileLocationText) profileLocationText.value = "";
    if (premiumStatusText)
      premiumStatusText.textContent = "You’re not signed in.";
    return;
  }
  if (profileEmail) profileEmail.value = user.email || "";
  if (profileUsername) profileUsername.value = profile?.username || "";
  if (profileLocationText)
    profileLocationText.value = profile?.location_text || "";
  const isPremium = !!profile?.premium;
  if (premiumStatusText)
    premiumStatusText.textContent = isPremium
      ? "You are premium. Map & unlimited posts unlocked."
      : "You are on the free plan. Map is locked, posts limited.";
}

async function saveUsername() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const newName = profileUsername.value.trim();
  if (!newName) return;
  const { error } = await supa
    .from("profiles")
    .update({ username: newName })
    .eq("id", user.id);
  if (error) alert(error.message);
  else {
    if (window.currentProfile)
      window.currentProfile.username = newName;
    renderUserCard();
    alert("Username updated.");
  }
}

async function uploadAvatar() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const file = profileAvatarInput.files[0];
  if (!file) return alert("Choose a file first.");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${user.id}-${Date.now()}.${ext}`;

  const { error } = await supa.storage
    .from("post_images")
    .upload(path, file, { upsert: true });
  if (error) {
    alert("Upload failed: " + error.message);
    return;
  }
  const { data: urlData } = supa.storage
    .from("post_images")
    .getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  await supa
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (window.currentProfile)
    window.currentProfile.avatar_url = publicUrl;
  renderUserCard();
  alert("Avatar updated.");
}

async function saveLocation() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const text = profileLocationText.value.trim();
  const { error } = await supa
    .from("profiles")
    .update({ location_text: text })
    .eq("id", user.id);
  if (error) alert("Failed to save location: " + error.message);
  else alert("Location saved.");
}

async function useGpsLocation() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  if (!navigator.geolocation) {
    alert("Geolocation not supported on this device.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const lat = Math.round(rawLat * 10) / 10;
      const lng = Math.round(rawLng * 10) / 10;

      const { error } = await supa
        .from("profiles")
        .update({
          lat,
          lng,
        })
        .eq("id", user.id);
      if (error) {
        alert("Failed to save GPS location: " + error.message);
        return;
      }
      if (!window.currentProfile) window.currentProfile = {};
      window.currentProfile.lat = lat;
      window.currentProfile.lng = lng;
      alert("Approximate GPS location saved for map.");
    },
    (err) => {
      alert("Could not get GPS location: " + err.message);
    }
  );
}

window.Auth = {
  checkUser,
};

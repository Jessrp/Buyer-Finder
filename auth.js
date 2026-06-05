// auth.js — Supabase auth + profile (Phone OTP default, Email OTP alternative, Google optional)
// BuyrFindr
const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window.supa = supa;

window.currentUser = null;
window.currentProfile = null;

function isBFPlus(profile) {
  if (!profile) return false;
  if (profile.premium === true) return true;
  const exp = profile.bfplus_expires_at || profile.bfPlus_expires_at || profile.bfplusExpiresAt;
  if (!exp) return false;
  const t = new Date(exp).getTime();
  return Number.isFinite(t) && t > Date.now();
}
function bfPlusLabel(profile) {
  return isBFPlus(profile) ? "BF+" : "Free";
}

let loginGoogleBtn, loginEmailBtn, logoutBtn, userCardSignin,
  userNameEl, userEmailEl, userPlanEl, userAvatarEl,
  profileEmail, profileUsername, profileAvatarInput,
  profileLocationText, btnSaveUsername, btnUploadAvatar,
  btnSaveLocation, btnUseGps, premiumStatusText;

let loginPhoneBtn, verifyOtpBtn, phoneInputEl, otpInputEl, phoneAuthWrap;

document.addEventListener("DOMContentLoaded", () => {
  loginGoogleBtn    = document.getElementById("login-google-btn");
  loginEmailBtn     = document.getElementById("login-email-btn");
  loginPhoneBtn     = document.getElementById("login-phone-btn");
  verifyOtpBtn      = document.getElementById("verify-otp-btn");
  phoneInputEl      = document.getElementById("login-phone");
  otpInputEl        = document.getElementById("login-otp");
  phoneAuthWrap     = document.getElementById("phone-auth-wrap");
  logoutBtn         = document.getElementById("logout-btn");
  userCardSignin    = document.getElementById("user-signin-shortcut");
  userNameEl        = document.getElementById("user-name");
  userEmailEl       = document.getElementById("user-email");
  userPlanEl        = document.getElementById("user-plan");
  userAvatarEl      = document.getElementById("user-avatar");
  profileEmail      = document.getElementById("profile-email");
  profileUsername   = document.getElementById("profile-username");
  profileAvatarInput = document.getElementById("profile-avatar-input");
  profileLocationText = document.getElementById("profile-location-text");
  btnSaveUsername   = document.getElementById("btn-save-username");
  btnUploadAvatar   = document.getElementById("btn-upload-avatar");
  btnSaveLocation   = document.getElementById("btn-save-location");
  btnUseGps         = document.getElementById("btn-use-gps");
  premiumStatusText = document.getElementById("premium-status-text");

  if (loginGoogleBtn)  loginGoogleBtn.addEventListener("click", loginWithGoogle);
  if (loginEmailBtn)   loginEmailBtn.addEventListener("click", loginWithEmailOtp);
  if (loginPhoneBtn)   loginPhoneBtn.addEventListener("click", loginWithPhoneOtp);
  if (verifyOtpBtn)    verifyOtpBtn.addEventListener("click", verifyPhoneOtp);
  if (userCardSignin)  userCardSignin.addEventListener("click", loginWithPhoneOtp);
  if (logoutBtn)       logoutBtn.addEventListener("click", logout);
  if (btnSaveUsername) btnSaveUsername.addEventListener("click", saveUsername);
  if (btnUploadAvatar) btnUploadAvatar.addEventListener("click", uploadAvatar);
  if (btnSaveLocation) btnSaveLocation.addEventListener("click", saveLocation);
  if (btnUseGps)       btnUseGps.addEventListener("click", useGpsLocation);

  bindAvatarTap();
  checkUser();

  supa.auth.onAuthStateChange((_event, _session) => {
    checkUser();
  });
});

async function checkUser() {
  const { data, error } = await supa.auth.getUser();
  if (error) console.log("getUser error", error.message);

  const user = data?.user || null;
  window.currentUser = user;

  if (!user) {
    window.currentProfile = null;
    renderUserCard();
    syncSettingsUI();
    if (window.updateSettingsUI) window.updateSettingsUI();
    if (window.Posts && typeof window.Posts.loadPosts === "function") window.Posts.loadPosts();
    return;
  }

  await loadOrCreateProfile();
  if (window.currentUser) trackReferral(window.currentUser.id);
  renderUserCard();
  syncSettingsUI();

  if (window.updateSettingsUI) window.updateSettingsUI();
  if (window.populateSettingsFields) window.populateSettingsFields();
  if (window.Posts && typeof window.Posts.loadPosts === "function") window.Posts.loadPosts();

  // Start alerts realtime after login
  window.Notifications?.initRealtime?.();
  window.Notifications?.refreshBadge?.();

  // Register push notifications now that we have a signed-in user
  if (window.PushNotifications?.initPush && window.currentUser?.id) {
    window.PushNotifications.initPush(window.currentUser.id);
  }
}

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      console.log("Notification permission:", permission);
    });
  }
}
window.requestNotificationPermission = requestNotificationPermission;

async function loginWithGoogle() {
  const { error } = await supa.auth.signInWithOAuth({ provider: "google" });
  if (error) alert(error.message);
}

async function loginWithPhoneOtp() {
  let phone = (phoneInputEl && phoneInputEl.value) ? phoneInputEl.value.trim() : "";
  if (!phone) phone = prompt("Enter your phone number (E.164 format like +15551234567):") || "";
  phone = phone.trim();
  if (!phone) return;
  if (!/^\+\d{7,15}$/.test(phone)) {
    alert("Phone must be in E.164 format, like +15551234567");
    return;
  }
  const { error } = await supa.auth.signInWithOtp({ phone });
  if (error) { alert(error.message); return; }
  alert("OTP sent via SMS. Enter the code to verify.");
  if (otpInputEl) otpInputEl.focus();
}

async function verifyPhoneOtp() {
  let phone = (phoneInputEl && phoneInputEl.value) ? phoneInputEl.value.trim() : "";
  if (!phone) phone = prompt("Re-enter your phone number (+15551234567):") || "";
  phone = phone.trim();
  let token = (otpInputEl && otpInputEl.value) ? otpInputEl.value.trim() : "";
  if (!token) token = prompt("Enter the OTP code you received:") || "";
  token = token.trim();
  if (!phone || !token) return;
  const { error } = await supa.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) { alert(error.message); return; }
  alert("Signed in.");
}

async function loginWithEmailOtp() {
  const email = prompt("Enter your email for a magic link:") || "";
  const clean = email.trim();
  if (!clean) return;
  const { error } = await supa.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: "https://buyrfindr.com" },
  });
  if (error) alert(error.message);
  else alert("Check your email for the login link.");
}

async function logout() {
  await supa.auth.signOut();
  alert("Signed out.");
  window.currentUser    = null;
  window.currentProfile = null;
  renderUserCard();
  syncSettingsUI();
  if (window.Posts && typeof window.Posts.loadPosts === "function") window.Posts.loadPosts();
}

// ── GEOCODE HELPER ───────────────────────────────────────────────────
async function geocodeLocation(locationText) {
  if (!locationText || !window.google || !google.maps) return { lat: null, lng: null };
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: locationText }, (results, status) => {
      if (status === "OK" && results[0]) {
        // Slightly randomize for privacy (~0.5 mile radius)
        const lat = results[0].geometry.location.lat() + (Math.random() - 0.5) * 0.01;
        const lng = results[0].geometry.location.lng() + (Math.random() - 0.5) * 0.01;
        resolve({ lat, lng });
      } else {
        resolve({ lat: null, lng: null });
      }
    });
  });
}

async function loadOrCreateProfile() {
  const user = window.currentUser;
  if (!user) return;

  const { data, error } = await supa.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) console.log("profile fetch error", error.message);

  if (!data) {
    // ── NEW USER ─────────────────────────────────────────────────
    const base =
      (user.email && user.email.includes("@") ? user.email.split("@")[0] : "") ||
      (user.phone ? ("user" + String(user.phone).replace(/\D/g, "").slice(-6)) : "user");
    const username = String(base).slice(0, 20);

    // Ask for location at signup
    const locationText = (prompt(
      "📍 Welcome to BuyrFindr!\n\nEnter your city or town so your posts can appear on the map.\n(e.g. Austin, TX — only your city is shown, never your exact address)"
    ) || "").trim();

    const { lat, lng } = await geocodeLocation(locationText);

    const insertPayload = {
      id:            user.id,
      email:         user.email  || null,
      phone:         user.phone  || null,
      username,
      premium:       false,
      location_text: locationText || null,
      lat,
      lng,
    };

    const { data: inserted, error: insertErr } = await supa
      .from("profiles").insert(insertPayload).select().maybeSingle();

    if (!insertErr && inserted) window.currentProfile = inserted;
    else window.currentProfile = insertPayload;

  } else {
    window.currentProfile = data;

    // ── EXISTING USER — nudge once if no location set ────────────
    if (!data.location_text) {
      const locationText = (prompt(
        "📍 Hey! You don't have a location set yet.\n\nEnter your city or town to appear on the map.\n(e.g. Chicago, IL — only your city is shown, never your exact address)\n\nLeave blank to skip."
      ) || "").trim();

      if (locationText) {
        const { lat, lng } = await geocodeLocation(locationText);

        await supa.from("profiles")
          .update({ location_text: locationText, lat, lng })
          .eq("id", user.id);

        window.currentProfile.location_text = locationText;
        window.currentProfile.lat           = lat;
        window.currentProfile.lng           = lng;
      }
    }
  }
}

function renderUserCard() {
  const user    = window.currentUser;
  const profile = window.currentProfile;

  if (!user) {
    if (userNameEl)  userNameEl.textContent  = "Guest";
    if (userEmailEl) userEmailEl.textContent = "Not signed in";
    if (userPlanEl)  { userPlanEl.textContent = "Free (guest)"; userPlanEl.className = "badge"; }
    if (userAvatarEl) {
      userAvatarEl.innerHTML = "";
      const ph = document.createElement("div");
      ph.style.cssText = "width:100%;height:100%;background:linear-gradient(135deg,#333,#555);";
      userAvatarEl.appendChild(ph);
    }
    if (logoutBtn)       logoutBtn.style.display       = "none";
    if (loginGoogleBtn)  loginGoogleBtn.style.display  = "inline-block";
    if (loginEmailBtn)   loginEmailBtn.style.display   = "inline-block";
    if (loginPhoneBtn)   loginPhoneBtn.style.display   = "inline-block";
    if (verifyOtpBtn)    verifyOtpBtn.style.display    = "inline-block";
    if (phoneAuthWrap)   phoneAuthWrap.style.display   = "inline-flex";
    if (userCardSignin)  userCardSignin.style.display  = "inline-block";

    // ── Update user strip (logged out) ──
    if (typeof window.updateUserStrip === "function") {
      window.updateUserStrip(null, null);
    }
    return;
  }

  if (userNameEl) userNameEl.textContent = profile?.username || "User";
  const label = user.email || maskPhone(user.phone) || "";
  if (userEmailEl) userEmailEl.textContent = label;
  const isPremium = isBFPlus(profile);
  if (userPlanEl) {
    userPlanEl.textContent = isPremium ? "BF+" : "Free";
    userPlanEl.className   = "badge" + (isPremium ? " premium" : "");
  }
  if (userAvatarEl) {
    userAvatarEl.innerHTML = "";
    const img = document.createElement("img");
    if (profile?.avatar_url) img.src = profile.avatar_url;
    else img.src = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>');
    userAvatarEl.appendChild(img);
  }
  if (logoutBtn)      logoutBtn.style.display      = "inline-block";
  if (loginGoogleBtn) loginGoogleBtn.style.display = "none";
  if (loginEmailBtn)  loginEmailBtn.style.display  = "none";
  if (loginPhoneBtn)  loginPhoneBtn.style.display  = "none";
  if (verifyOtpBtn)   verifyOtpBtn.style.display   = "none";
  if (phoneAuthWrap)  phoneAuthWrap.style.display  = "none";
  if (userCardSignin) userCardSignin.style.display = "none";

  // ── Update user strip (logged in) ──
  if (typeof window.updateUserStrip === "function") {
    window.updateUserStrip(
      {
        email: user.email || maskPhone(user.phone) || "",
        user_metadata: {
          username:   profile?.username   || null,
          avatar_url: profile?.avatar_url || null,
        },
      },
      isPremium ? "premium" : "free"
    );
  }

  bindAvatarTap();
}

function maskPhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return "••• ••• " + digits.slice(-4);
}

function syncSettingsUI() {
  const user    = window.currentUser;
  const profile = window.currentProfile;
  const bfPlusPrompt = document.getElementById("bfPlusPrompt");
  if (!user) {
    if (profileEmail)        profileEmail.value        = "";
    if (profileUsername)     profileUsername.value     = "";
    if (profileLocationText) profileLocationText.value = "";
    if (premiumStatusText)   premiumStatusText.textContent = "You're not signed in.";
    if (bfPlusPrompt)        bfPlusPrompt.classList.remove("hidden");
    return;
  }
  if (profileEmail)        profileEmail.value        = profile?.email || user.email || "";
  if (profileUsername)     profileUsername.value     = profile?.username || "";
  if (profileLocationText) profileLocationText.value = profile?.location_text || "";
  const isPremium = isBFPlus(profile);
  if (premiumStatusText) {
    premiumStatusText.textContent = isPremium
      ? "You are BF+. Map & unlimited posts unlocked."
      : "You are on the free plan. Map is locked, posts limited.";
  }
  if (bfPlusPrompt) {
    if (isPremium) bfPlusPrompt.classList.add("hidden");
    else bfPlusPrompt.classList.remove("hidden");
  }
}

async function saveUsername() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const newName = profileUsername?.value.trim();
  if (!newName) return;
  const { error } = await supa.from("profiles").update({ username: newName }).eq("id", user.id);
  if (error) alert(error.message);
  else {
    if (window.currentProfile) window.currentProfile.username = newName;
    renderUserCard();
    alert("Username updated.");
  }
}

async function saveProfileEmail() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const email = (profileEmail?.value || "").trim();
  if (!email) return alert("Enter an email.");
  const { error } = await supa.from("profiles").update({ email }).eq("id", user.id);
  if (error) alert(error.message);
  else {
    if (window.currentProfile) window.currentProfile.email = email;
    alert("Email saved for notifications.");
    renderUserCard();
  }
}
window.saveProfileEmail = saveProfileEmail;

async function uploadAvatar() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const file = profileAvatarInput?.files?.[0];
  if (!file) return alert("Choose a file first.");
  const ext  = file.name.split(".").pop() || "jpg";
  const path = `avatars/${user.id}-${Date.now()}.${ext}`;
  const { error } = await supa.storage.from("post_images").upload(path, file, { upsert: true });
  if (error) { alert("Upload failed: " + error.message); return; }
  const { data: urlData } = supa.storage.from("post_images").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  await supa.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
  if (window.currentProfile) window.currentProfile.avatar_url = publicUrl;
  renderUserCard();
  alert("Avatar updated.");
}

async function saveLocation() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  const text = profileLocationText?.value.trim();
  const { error } = await supa.from("profiles").update({ location_text: text }).eq("id", user.id);
  if (error) alert("Failed to save location: " + error.message);
  else alert("Location saved.");
}

async function useGpsLocation() {
  const user = window.currentUser;
  if (!user) return alert("Sign in first.");
  if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = Math.round(pos.coords.latitude  * 10) / 10;
      const lng = Math.round(pos.coords.longitude * 10) / 10;
      const { error } = await supa.from("profiles").update({ lat, lng }).eq("id", user.id);
      if (error) { alert("Failed to save GPS: " + error.message); return; }
      if (!window.currentProfile) window.currentProfile = {};
      window.currentProfile.lat = lat;
      window.currentProfile.lng = lng;
      alert("Approximate GPS location saved.");
    },
    (err) => alert("Could not get GPS: " + err.message)
  );
}

function ensureAvatarPickerInput() {
  let input = document.getElementById("profile-avatar-input");
  if (input) {
    const cs = window.getComputedStyle(input);
    if (cs && cs.display === "none") {
      input.style.cssText = "display:block;position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
    }
    input.accept = input.accept || "image/*";
    return input;
  }
  input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.id = "bf-avatar-picker";
  input.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
  document.body.appendChild(input);
  return input;
}

function bindAvatarTap() {
  if (document.body.dataset.avatarTapBound === "true") return;
  document.body.dataset.avatarTapBound = "true";
  const ua = document.getElementById("user-avatar");
  if (ua) ua.style.cursor = "pointer";
  const sa = document.getElementById("settings-avatar");
  if (sa) sa.style.cursor = "pointer";
  document.addEventListener("click", async (e) => {
    const target = e.target?.closest?.("#user-avatar, #user-avatar *, #settings-avatar, #settings-avatar *");
    if (!target) return;
    if (!window.currentUser) { alert("Sign in to set your avatar."); return; }
    const input    = ensureAvatarPickerInput();
    const isRealInput = input.id === "profile-avatar-input";
    const onChange = async () => {
      input.removeEventListener("change", onChange);
      const file = input.files?.[0];
      if (!file) return;
      if (!isRealInput) { try { profileAvatarInput = input; } catch {} }
      await uploadAvatar();
    };
    input.addEventListener("change", onChange);
    input.click();
  }, true);
}

window.Auth = { checkUser };

function updateSettingsUI() {
  const user    = window.currentUser;
  const profile = window.currentProfile;
  const nameEl  = document.getElementById("settings-name");
  const emailEl = document.getElementById("settings-email");
  const planEl  = document.getElementById("settings-plan");
  const avatarEl = document.getElementById("settings-avatar");
  if (!nameEl) return;
  if (!user) {
    nameEl.textContent = "Guest";
    if (emailEl)  emailEl.textContent  = "Not signed in";
    if (planEl)   planEl.textContent   = "Free";
    if (avatarEl) avatarEl.style.backgroundImage = "";
    return;
  }
  nameEl.textContent = profile?.full_name || profile?.username || "User";
  if (emailEl)  emailEl.textContent  = profile?.email || user.email || maskPhone(user.phone) || "";
  if (planEl)   planEl.textContent   = isBFPlus(profile) ? "BF+" : "Free";
  const manageBtn = document.getElementById("btn-manage-subscription");
  if (manageBtn) manageBtn.style.display = isBFPlus(profile) ? "inline-block" : "none";
  if (avatarEl && profile?.avatar_url) avatarEl.style.backgroundImage = `url(${profile.avatar_url})`;
}
window.updateSettingsUI = updateSettingsUI;

// ── REFERRAL TRACKING ────────────────────────────────────────────
async function trackReferral(newUserId) {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref") || localStorage.getItem("bf_ref");
  if (!ref) return;

  try {
    await fetch("/api/referral-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUserId, referralCode: ref }),
    });
    // Clear ref from storage after use
    localStorage.removeItem("bf_ref");
  } catch (err) {
    console.warn("Referral tracking failed:", err);
  }
}

// Store ref param in localStorage so it survives the OAuth redirect
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");
  if (ref) localStorage.setItem("bf_ref", ref);
})();

// ── REFERRAL LINK COPY BUTTON ────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("btn-copy-referral");
  const hint = document.getElementById("referral-hint");
  if (!btn) return;
  btn.addEventListener("click", async function() {
    const profile = window.currentProfile;
    if (!profile) { alert("Sign in first."); return; }
    if (!profile.referral_code) { alert("No referral code found."); return; }
    const link = "https://buyrfindr.com?ref=" + profile.referral_code;
    try {
      await navigator.clipboard.writeText(link);
      if (hint) hint.textContent = "✅ Copied! Share this link to earn BF+ for life.";
    } catch(e) {
      prompt("Copy this link:", link);
    }
  });
});

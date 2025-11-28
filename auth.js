(function () {
  const supa = window.supa;

  // UI elements
  let userCard,
    btnSignIn,
    btnSignOut,
    manualLocationInput,
    btnSaveLocation,
    btnUseGps,
    premiumStatusText,
    btnUpgradePremium;

  // ------------------------------------------------------------
  // DOM READY
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Grab elements
    userCard = document.getElementById("user-card");
    btnSignIn = document.getElementById("btn-sign-in");
    btnSignOut = document.getElementById("btn-sign-out");
    manualLocationInput = document.getElementById("manual-location-input");
    btnSaveLocation = document.getElementById("btn-save-location");
    btnUseGps = document.getElementById("btn-use-gps");
    premiumStatusText = document.getElementById("premium-status-text");

    // NEW: premium upgrade button
    btnUpgradePremium = document.getElementById("btn-upgrade-premium");

    // Wire events
    if (btnSignIn) btnSignIn.addEventListener("click", signIn);
    if (btnSignOut) btnSignOut.addEventListener("click", signOut);
    if (btnSaveLocation) btnSaveLocation.addEventListener("click", saveManualLocation);
    if (btnUseGps) btnUseGps.addEventListener("click", useGpsLocation);

    if (btnUpgradePremium)
      btnUpgradePremium.addEventListener("click", upgradeToPremiumDev);

    // Load session immediately
    initSession();
  });

  // ------------------------------------------------------------
  //               INITIAL SESSION CHECK
  // ------------------------------------------------------------

  async function initSession() {
    try {
      const { data: { session } } = await supa.auth.getSession();
      if (session?.user) {
        window.currentUser = session.user;
        await loadUserProfile();
      } else {
        window.currentUser = null;
        window.currentProfile = null;
      }
      renderUserCard();
      syncSettingsUI();
    } catch (err) {
      console.log("initSession error:", err.message || err);
    }
  }

  // ------------------------------------------------------------
  //                     SIGN-IN (popup)
  // ------------------------------------------------------------
  async function signIn() {
    try {
      const { data, error } = await supa.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) {
        alert("Sign in failed: " + error.message);
        return;
      }
    } catch (err) {
      alert("Sign in error: " + err.message);
    }
  }

  // ------------------------------------------------------------
  //                       SIGN-OUT
  // ------------------------------------------------------------
  async function signOut() {
    await supa.auth.signOut();
    window.currentUser = null;
    window.currentProfile = null;
    renderUserCard();
    syncSettingsUI();
    alert("Signed out.");
  }

  // ------------------------------------------------------------
  //                LOAD USER PROFILE FROM DB
  // ------------------------------------------------------------
  async function loadUserProfile() {
    if (!window.currentUser) return;

    try {
      const { data, error } = await supa
        .from("profiles")
        .select("*")
        .eq("id", window.currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        window.currentProfile = data;
      } else {
        // create profile row if missing
        const { data: created } = await supa
          .from("profiles")
          .insert({ id: window.currentUser.id })
          .select()
          .maybeSingle();
        window.currentProfile = created || null;
      }
    } catch (err) {
      console.log("load profile error:", err.message || err);
    }
  }

  // ------------------------------------------------------------
  //                     RENDER USER CARD
  // ------------------------------------------------------------
  function renderUserCard() {
    if (!userCard) return;

    const user = window.currentUser;
    const prof = window.currentProfile;

    if (!user) {
      userCard.innerHTML = `<p class="hint">Not signed in.</p>`;
      return;
    }

    userCard.innerHTML = `
      <p><strong>${prof?.username || "User"}</strong></p>
      <p class="hint">${user.email || ""}</p>
      <p class="hint">Premium: ${prof?.premium ? "Yes" : "No"}</p>
    `;
  }

  // ------------------------------------------------------------
  //                     SETTINGS UI SYNC
  // ------------------------------------------------------------
  function syncSettingsUI() {
    const prof = window.currentProfile;
    const isPremium = !!prof?.premium;

    if (premiumStatusText) {
      premiumStatusText.textContent = isPremium
        ? "You are premium. Map, My Matches & radar perks are unlocked. You can post without limits."
        : "You are on the free plan. Map & My Matches are locked. You can only create a small number of posts.";
    }
  }

  // ------------------------------------------------------------
  //                LOCATION: MANUAL SAVE
  // ------------------------------------------------------------
  async function saveManualLocation() {
    if (!window.currentUser) {
      alert("Sign in first.");
      return;
    }
    const txt = manualLocationInput.value.trim();
    if (!txt) {
      alert("Enter a location.");
      return;
    }

    try {
      const { error } = await supa
        .from("profiles")
        .update({ location_text: txt })
        .eq("id", window.currentUser.id);

      if (error) throw error;

      if (!window.currentProfile) window.currentProfile = {};
      window.currentProfile.location_text = txt;
      alert("Location updated.");
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  // ------------------------------------------------------------
  //                 LOCATION: GPS SAVE
  // ------------------------------------------------------------
  async function useGpsLocation() {
    if (!window.currentUser) {
      alert("Sign in first.");
      return;
    }
    if (!navigator.geolocation) {
      alert("GPS not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          const { error } = await supa
            .from("profiles")
            .update({ lat, lng })
            .eq("id", window.currentUser.id);
          if (error) throw error;

          if (!window.currentProfile) window.currentProfile = {};
          window.currentProfile.lat = lat;
          window.currentProfile.lng = lng;

          alert("GPS location saved.");
        } catch (err) {
          alert("Failed: " + err.message);
        }
      },
      (err) => {
        alert("GPS error: " + err.message);
      }
    );
  }

  // ------------------------------------------------------------
  //               PREMIUM UPGRADE (DEV MODE)
  // ------------------------------------------------------------
  async function upgradeToPremiumDev() {
    if (!window.currentUser) {
      alert("Sign in first to upgrade.");
      return;
    }

    const c = confirm(
      "In production, this would take you to a real payment page.\n\nFor testing, do you want to mark this account as PREMIUM?"
    );
    if (!c) return;

    try {
      const { error } = await supa
        .from("profiles")
        .update({ premium: true })
        .eq("id", window.currentUser.id);

      if (error) throw error;

      if (!window.currentProfile) window.currentProfile = {};
      window.currentProfile.premium = true;

      renderUserCard();
      syncSettingsUI();

      alert("Premium enabled (dev mode).");
    } catch (err) {
      alert("Upgrade failed: " + err.message);
    }
  }
})();
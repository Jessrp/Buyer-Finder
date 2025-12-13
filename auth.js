// auth.js — auth + profile loader + BF+ toggle (dev mode)
(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("auth.js: window.supa missing");
    return;
  }

  // ---- DOM (bind only if present)
  const btnSignIn = document.getElementById("btn-signin") || document.querySelector('[data-action="signin"]');
  const btnSignOut = document.getElementById("btn-signout") || document.querySelector('[data-action="signout"]');
  const bfPlusBtn =
    document.getElementById("bfplus-btn") ||
    document.getElementById("btn-bfplus") ||
    document.querySelector('[data-action="bfplus"]') ||
    document.querySelector(".bfplus-btn");

  const userLabel = document.getElementById("user-label");
  const userEmailLabel = document.getElementById("user-email");

  // ---- Globals other files rely on
  window.currentUser = null;
  window.currentProfile = null;

  function setUiSignedOut() {
    if (userLabel) userLabel.textContent = "Not signed in";
    if (userEmailLabel) userEmailLabel.textContent = "";
    if (bfPlusBtn) bfPlusBtn.style.display = "";
  }

  function setUiSignedIn(user, profile) {
    if (userLabel) userLabel.textContent = profile?.username || user?.email?.split("@")?.[0] || "Signed in";
    if (userEmailLabel) userEmailLabel.textContent = user?.email || "";
    // Optional: you can change button text/label here if you want
  }

  async function ensureProfile(user) {
    if (!user?.id) return null;

    // Try fetch
    let { data: prof, error } = await supa
      .from("profiles")
      .select("id,username,email,avatar_url,location_text,lat,lng,premium")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.log("profiles select error:", error.message);
      // If RLS is wrong, you'll see it here.
    }

    // Create if missing
    if (!prof) {
      const base = {
        id: user.id,
        email: user.email || null,
        username: (user.email || "user").split("@")[0],
        premium: false
      };

      const res = await supa.from("profiles").insert(base).select().maybeSingle();
      if (res.error) {
        console.log("profiles insert error:", res.error.message);
        return null;
      }
      prof = res.data;
    }

    return prof;
  }

  async function refreshSession() {
    const { data } = await supa.auth.getSession();
    const session = data?.session || null;

    if (!session?.user) {
      window.currentUser = null;
      window.currentProfile = null;
      setUiSignedOut();
      // Let other modules refresh
      window.Posts?.loadPosts?.();
      window.BFMap?.refresh?.();
      return;
    }

    window.currentUser = session.user;
    const prof = await ensureProfile(session.user);
    window.currentProfile = prof;

    setUiSignedIn(session.user, prof);

    // Let other modules refresh
    window.Posts?.loadPosts?.();
    window.Posts?.loadMatches?.();
    window.Posts?.loadNotifications?.();
    window.BFMap?.refresh?.();

    // Update BF+ gate styling/flags if you have them
    document.documentElement.classList.toggle("is-premium", !!prof?.premium);
  }

  // DEV BF+ toggle: flips premium in profiles
  // Real payment later, but this makes the feature actually work right now.
  async function togglePremium() {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in first.");
      return;
    }

    const current = !!window.currentProfile?.premium;
    const next = !current;

    const ok = confirm(next ? "Enable BF+ (premium) for this account?" : "Disable BF+ (premium)?");
    if (!ok) return;

    const { data, error } = await supa
      .from("profiles")
      .update({ premium: next })
      .eq("id", user.id)
      .select("id,premium,username,email,avatar_url,location_text,lat,lng")
      .maybeSingle();

    if (error) {
      console.log("premium update error:", error.message);
      alert("BF+ toggle failed: " + error.message);
      return;
    }

    window.currentProfile = { ...(window.currentProfile || {}), ...(data || {}), premium: next };

    // Broadcast refresh so the app immediately unlocks premium-only stuff
    document.documentElement.classList.toggle("is-premium", next);
    window.Posts?.loadPosts?.();
    window.BFMap?.refresh?.();

    alert(next ? "BF+ enabled." : "BF+ disabled.");
  }

  // Wire buttons if they exist
  btnSignOut?.addEventListener("click", async () => {
    await supa.auth.signOut();
    await refreshSession();
  });

  bfPlusBtn?.addEventListener("click", togglePremium);

  // Keep session fresh
  supa.auth.onAuthStateChange(() => refreshSession());

  // Initial
  refreshSession();
})();

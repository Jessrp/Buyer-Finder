// auth.js — AUTH BOOTSTRAP (FIXED, SELF-CONTAINED)

(() => {
  // ---- Supabase INIT (MUST LIVE HERE)
  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

  window.supa =
    window.supa ||
    supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  const supa = window.supa;

  // ---- Globals (EVERY FILE RELIES ON THESE)
  window.currentUser = null;
  window.currentProfile = null;

  // ---- DOM
  const btnGoogle = document.getElementById("login-google-btn");
  const btnEmail = document.getElementById("login-email-btn");
  const btnLogout = document.getElementById("logout-btn");

  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const userPlan = document.getElementById("user-plan");
  const bfPlusPrompt = document.getElementById("bfPlusPrompt");
  const upgradeBtn = document.getElementById("upgradeBtn");

  // ---- UI helpers
  function setSignedOut() {
    window.currentUser = null;
    window.currentProfile = null;

    userName && (userName.textContent = "Guest");
    userEmail && (userEmail.textContent = "Not signed in");
    userPlan && (userPlan.textContent = "Free");
    btnLogout && (btnLogout.style.display = "none");

    document.documentElement.classList.remove("is-premium");
  }

  function setSignedIn(user, profile) {
    window.currentUser = user;
    window.currentProfile = profile;

    userName && (userName.textContent = profile?.username || user.email);
    userEmail && (userEmail.textContent = user.email);
    userPlan &&
      (userPlan.textContent = profile?.premium ? "BF+" : "Free");

    btnLogout && (btnLogout.style.display = "inline-block");
    document.documentElement.classList.toggle(
      "is-premium",
      !!profile?.premium
    );
  }

  // ---- Profile loader
  async function loadProfile(user) {
    const { data } = await supa
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) return data;

    const base = {
      id: user.id,
      email: user.email,
      username: user.email.split("@")[0],
      premium: false,
    };

    const res = await supa.from("profiles").insert(base).select().maybeSingle();
    return res.data;
  }

  // ---- Session refresh (THE HEART)
  async function refreshSession() {
    const { data } = await supa.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      setSignedOut();
      window.Posts?.loadPosts?.();
      return;
    }

    const profile = await loadProfile(session.user);
    setSignedIn(session.user, profile);

    window.Posts?.loadPosts?.();
    window.Posts?.loadMatches?.();
    window.Posts?.loadNotifications?.();
  }

  // ---- Auth actions
  btnGoogle?.addEventListener("click", async () => {
    await supa.auth.signInWithOAuth({ provider: "google" });
  });

  btnEmail?.addEventListener("click", async () => {
    const email = prompt("Email:");
    if (!email) return;
    await supa.auth.signInWithOtp({ email });
    alert("Check your email for the sign-in link.");
  });

  btnLogout?.addEventListener("click", async () => {
    await supa.auth.signOut();
    refreshSession();
  });

  // ---- BF+ dev toggle
  upgradeBtn?.addEventListener("click", async () => {
    if (!window.currentUser) return alert("Sign in first");

    const next = !window.currentProfile?.premium;

    const { data } = await supa
      .from("profiles")
      .update({ premium: next })
      .eq("id", window.currentUser.id)
      .select()
      .maybeSingle();

    window.currentProfile = data;
    refreshSession();
  });

  // ---- Boot
  supa.auth.onAuthStateChange(refreshSession);
  refreshSession();
})();

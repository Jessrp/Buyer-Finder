// auth.js — FINAL, CORRECT SUPABASE INIT (GUEST SAFE)

(() => {
  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";

  // 🔴 PASTE YOUR *REAL* ANON PUBLIC KEY BELOW
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

  window.supa =
    window.supa ||
    supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const supa = window.supa;

  window.currentUser = null;
  window.currentProfile = null;

  const btnGoogle = document.getElementById("login-google-btn");
  const btnEmail = document.getElementById("login-email-btn");
  const btnLogout = document.getElementById("logout-btn");
  const btnSigninShortcut = document.getElementById("user-signin-shortcut");

  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const userPlan = document.getElementById("user-plan");

  async function refreshSession() {
    const { data } = await supa.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      window.currentUser = null;
      window.currentProfile = null;

      userName && (userName.textContent = "Guest");
      userEmail && (userEmail.textContent = "Not signed in");
      userPlan && (userPlan.textContent = "Free");

      btnLogout && (btnLogout.style.display = "none");
      return;
    }

    window.currentUser = session.user;

    const { data: profile } = await supa
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    window.currentProfile = profile;

    userName &&
      (userName.textContent = profile?.username || session.user.email);
    userEmail && (userEmail.textContent = session.user.email);
    userPlan &&
      (userPlan.textContent = profile?.premium ? "BF+" : "Free");

    btnLogout && (btnLogout.style.display = "inline-block");
  }

  // Auth buttons (unchanged)
  btnGoogle?.addEventListener("click", async () => {
    await supa.auth.signInWithOAuth({ provider: "google" });
  });

  btnEmail?.addEventListener("click", async () => {
    const email = prompt("Email:");
    if (!email) return;
    await supa.auth.signInWithOtp({ email });
    alert("Check your email for the sign-in link.");
  });

  btnSigninShortcut?.addEventListener("click", () => {
    btnGoogle?.click?.();
  });

  btnLogout?.addEventListener("click", async () => {
    await supa.auth.signOut();
    refreshSession();
    window.Posts?.loadPosts?.();
  });

  // 🔥 THIS IS CRITICAL 🔥
  supa.auth.onAuthStateChange(async () => {
    await refreshSession();
    window.Posts?.loadPosts?.();
  });

  // Force guest load on boot
  window.Posts?.loadPosts?.();

  refreshSession();
})();

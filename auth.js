// auth.js
// Handles Supabase, Google sign-in, user card, and exposes window.supa + window.AuthUI

(function () {
  // ================== CONFIG ==================
  // USE YOUR REAL VALUES HERE
  const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4"; // <-- paste your anon key

  if (!SUPABASE_KEY || SUPABASE_KEY.indexOf("YOUR_") === 0) {
    console.warn(
      "Supabase anon key not set in auth.js. Sign-in will NOT work until you paste it."
    );
  }

  // Reuse existing client if one was created elsewhere
  const supa =
    window.supa ||
    window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
      },
    });

  window.supa = supa;

  // ============== DOM HOOKS ==============
  const headerSignInBtn = document.getElementById("btn-signin-header");
  const cardSignInBtn = document.getElementById("btn-signin-card");
  const userNameEl = document.getElementById("user-name");
  const userStatusEl = document.getElementById("user-status");
  const planBadgeEl = document.getElementById("user-plan-badge");

  // Global-ish state so other scripts can use it
  window.currentUser = null;
  window.currentProfile = null;

  // ============== HELPERS ==============

  async function fetchProfile(user) {
    if (!user) return null;
    const { data, error } = await supa
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.log("fetchProfile error:", error.message);
    }
    return data || null;
  }

  function updateUserUI(user, profile) {
    // Text
    if (userNameEl) {
      userNameEl.textContent =
        profile?.username || user?.email || "Guest";
    }
    if (userStatusEl) {
      userStatusEl.textContent = user ? "Signed in" : "Not signed in";
    }

    // Badge
    if (planBadgeEl) {
      if (profile?.premium) {
        planBadgeEl.textContent = "Premium";
        planBadgeEl.classList.remove("free");
        planBadgeEl.classList.add("premium");
      } else if (user) {
        planBadgeEl.textContent = "Free";
        planBadgeEl.classList.remove("premium");
        planBadgeEl.classList.add("free");
      } else {
        planBadgeEl.textContent = "Free (guest)";
        planBadgeEl.classList.remove("premium");
        planBadgeEl.classList.add("free");
      }
    }

    // Buttons text
    const label = user ? "Sign out" : "Sign In";
    if (headerSignInBtn) headerSignInBtn.textContent = label;
    if (cardSignInBtn) cardSignInBtn.textContent = label;
  }

  async function handleUserChanged(sessionUser) {
    window.currentUser = sessionUser || null;
    window.currentProfile = null;

    let profile = null;
    if (sessionUser) {
      profile = await fetchProfile(sessionUser);
      window.currentProfile = profile;
    }

    updateUserUI(sessionUser, profile);

    // Refresh posts after login / logout
    if (window.Posts && typeof window.Posts.loadPosts === "function") {
      const searchInput = document.getElementById("search-input");
      const query = searchInput ? searchInput.value.trim() : "";
      window.Posts.loadPosts(query);
    }
  }

  // ============== SIGN-IN / OUT ==============

  async function signIn() {
    if (!SUPABASE_KEY || SUPABASE_KEY.indexOf("YOUR_") === 0) {
      alert("Supabase anon key not set in auth.js yet.");
      return;
    }

    try {
      const { error } = await supa.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) {
        console.log("signIn error:", error.message);
        alert("Error starting Google sign-in: " + error.message);
      }
      // Redirect & callback are handled by Supabase + your site URL settings
    } catch (err) {
      console.log("signIn exception:", err);
      alert("Unexpected error during sign-in.");
    }
  }

  async function signOut() {
    try {
      const { error } = await supa.auth.signOut();
      if (error) {
        console.log("signOut error:", error.message);
      }
    } catch (err) {
      console.log("signOut exception:", err);
    }
  }

  // ============== INIT ==============

  async function initAuth() {
    // Wire buttons
    function attachClick(btn) {
      if (!btn) return;
      btn.addEventListener("click", async () => {
        if (window.currentUser) {
          // Currently signed in → sign out
          await signOut();
        } else {
          await signIn();
        }
      });
    }

    attachClick(headerSignInBtn);
    attachClick(cardSignInBtn);

    // Get current session
    try {
      const { data } = await supa.auth.getUser();
      const user = data?.user || null;
      await handleUserChanged(user);
    } catch (err) {
      console.log("getUser error:", err);
    }

    // Listen for changes
    supa.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      await handleUserChanged(user);
    });
  }

  // Expose so app.js can explicitly call init
  window.AuthUI = {
    init: initAuth,
  };
})();

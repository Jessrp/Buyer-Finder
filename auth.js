/* -----------------------------------------
   AUTH.JS — Supabase init + auth state
------------------------------------------ */

const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
window.currentUser = null;

/* Update header auth UI */
function updateAuthUI() {
  const statusEl = document.getElementById("auth-status");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (!statusEl || !loginBtn || !logoutBtn) return;

  if (!window.currentUser) {
    statusEl.textContent = "Not signed in";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  } else {
    statusEl.textContent = "Signed in";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  }
}

/* Ensure profile row exists */
async function ensureProfile(user) {
  const { data } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!data) {
    await supabaseClient.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      username: user.email ? user.email.split("@")[0] : "user",
      bf_plus: false,
    });
  }
}

/* Initialize session */
async function initAuth() {
  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;

  if (session?.user) {
    window.currentUser = session.user;
    await ensureProfile(session.user);
  } else {
    window.currentUser = null;
  }

  updateAuthUI();
}

/* Auth state listener */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    window.currentUser = session.user;
    await ensureProfile(session.user);
  } else {
    window.currentUser = null;
  }

  updateAuthUI();
  if (window.reloadPosts) {
    window.reloadPosts();
  }
});

/* Login / logout */

window.signIn = async function () {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: prompt("Enter your email for sign-in link:") || "",
  });
  if (error) alert("Login failed: " + error.message);
  else alert("Check your email for the magic link.");
};

window.signOut = async function () {
  const { error } = await supabaseClient.auth.signOut();
  if (error) alert("Logout error: " + error.message);
};

/* Wire header buttons */

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginBtn) loginBtn.onclick = () => window.signIn();
  if (logoutBtn) logoutBtn.onclick = () => window.signOut();

  initAuth();
});

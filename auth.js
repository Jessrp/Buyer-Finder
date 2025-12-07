/* -----------------------------------------
   AUTH.JS — Supabase Client + User Session
------------------------------------------ */

// INSERT YOUR REAL VALUES HERE:
const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

// Create the client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

window.currentUser = null;

/* -----------------------------------------
   LOAD SESSION ON STARTUP
------------------------------------------ */

async function loadUser() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    window.currentUser = session.user;
    await loadExtendedProfile();
  } else {
    window.currentUser = null;
  }

  updateAccountDisplay();
}

/* -----------------------------------------
   LOAD EXTENDED PROFILE (BF+ STATUS ETC)
------------------------------------------ */

async function loadExtendedProfile() {
  if (!window.currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", window.currentUser.id)
    .single();

  if (!error && data) {
    window.currentUser.is_bfplus = data.is_bfplus === true;
  }
}

/* -----------------------------------------
   AUTH STATE LISTENER
------------------------------------------ */

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    window.currentUser = session.user;
    await loadExtendedProfile();
  } else {
    window.currentUser = null;
  }

  updateAccountDisplay();
});

/* -----------------------------------------
   LOGIN (EMAIL OTP)
------------------------------------------ */

async function login() {
  const email = prompt("Enter your email:");
  if (!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({ email });
  if (error) {
    alert("Login failed: " + error.message);
  } else {
    alert("Check your email for the login link.");
  }
}

/* -----------------------------------------
   LOGOUT
------------------------------------------ */

async function logout() {
  await supabaseClient.auth.signOut();
  window.currentUser = null;
  updateAccountDisplay();
  alert("Logged out.");
}

/* -----------------------------------------
   UPDATE ACCOUNT PANEL DISPLAY
------------------------------------------ */

function updateAccountDisplay() {
  const msg = document.getElementById("posts-status");
  if (!msg) return;

  if (!window.currentUser) {
    msg.textContent = "Not logged in.";
    return;
  }

  msg.textContent = window.currentUser.is_bfplus
    ? "BF+ Active"
    : "Free tier";
}

/* -----------------------------------------
   INITIALIZE
------------------------------------------ */

loadUser();
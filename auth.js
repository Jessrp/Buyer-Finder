/* -----------------------------------------
   AUTH.JS — User login & BF+ status
------------------------------------------ */

// Initialize Supabase client
window.supabaseClient = supabase.createClient(
  "https://hcgwldsslzkppzgfhwws.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4"
);

window.currentUser = null;

/* -----------------------------------------
   LOAD USER SESSION
------------------------------------------ */

async function loadUser() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    window.currentUser = session.user;

    // Load extended profile info including BF+ status
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (!error && data) {
      window.currentUser.is_bfplus = data.is_bfplus;
    }
  } else {
    window.currentUser = null;
  }

  updateAccountPanel();
}

/* -----------------------------------------
   SUPABASE AUTH LISTENERS
------------------------------------------ */

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    window.currentUser = session.user;

    // Reload extended profile
    supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) window.currentUser.is_bfplus = data.is_bfplus;
      });
  } else {
    window.currentUser = null;
  }

  updateAccountPanel();
});

/* -----------------------------------------
   LOGIN
------------------------------------------ */

async function loginWithEmail() {
  const email = prompt("Enter your email:");
  if (!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({ email });
  if (error) {
    alert("Login error: " + error.message);
  } else {
    alert("Check your email for the login link.");
  }
}

/* -----------------------------------------
   LOGOUT
------------------------------------------ */

async function logoutUser() {
  await supabaseClient.auth.signOut();
  alert("Logged out.");
}

/* -----------------------------------------
   RUN ON PAGE LOAD
------------------------------------------ */

loadUser();

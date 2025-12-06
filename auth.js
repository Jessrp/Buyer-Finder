/* -----------------------------------------
   AUTH.JS — User login & BF+ status
------------------------------------------ */

// Initialize Supabase client
window.supabaseClient = supabase.createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_SUPABASE_ANON_KEY"
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
/* ---------------------------------------------------------
   AUTH.JS — Supabase Initialization + Session Management
----------------------------------------------------------- */

/* ============================
   INSERT YOUR REAL VALUES HERE
   ============================ */

const SUPABASE_URL = "https://hcgwldsslzkppzgfhwws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprcHB6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzE1MTYsImV4cCI6MjA3NjEwNzUxNn0.fCKpSI2UYHBlgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4";

/* ========================================================= */

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.currentUser = null;

/* ---------------------------------------------------------
   LOAD SESSION ON APP START
----------------------------------------------------------- */
async function initAuth() {
    const { data } = await supabaseClient.auth.getSession();
    const session = data.session;

    if (session?.user) {
        window.currentUser = session.user;
        await ensureProfileExists(session.user);
    } else {
        window.currentUser = null;
    }

    refreshUI();
}

/* ---------------------------------------------------------
   AUTH EVENT LISTENER
----------------------------------------------------------- */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        window.currentUser = session.user;
        await ensureProfileExists(session.user);
    } else {
        window.currentUser = null;
    }

    refreshUI();
});

/* ---------------------------------------------------------
   CREATE PROFILE IF MISSING
----------------------------------------------------------- */
async function ensureProfileExists(user) {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!data) {
        await supabaseClient.from("profiles").insert({
            id: user.id,
            email: user.email || null,
            username: user.email ? user.email.split("@")[0] : "user",
            bf_plus: false
        });
    }
}

/* ---------------------------------------------------------
   LOGIN & LOGOUT
----------------------------------------------------------- */
window.signIn = async function () {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google"
    });
    if (error) alert("Login failed: " + error.message);
};

window.signOut = async function () {
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Logout error: " + error.message);
};

/* ---------------------------------------------------------
   REFRESH UI BASED ON LOGIN
----------------------------------------------------------- */
function refreshUI() {
    const status = document.getElementById("posts-status");

    if (!status) return;

    if (!window.currentUser) {
        status.textContent = "Not signed in";
    } else {
        status.textContent = "Signed in";
    }

    if (window.myPostsMode) {
        loadMyPostsWithFilter();
    } else {
        loadPosts("global");
    }
}

/* ---------------------------------------------------------
   INITIALIZE AUTH
----------------------------------------------------------- */
initAuth();
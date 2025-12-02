// app.js

// Initialize Supabase client
const supabase = window.supabase.createClient(
    "YOUR_URL",
    "YOUR_ANON_KEY"
);

// Auth listener
supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
        document.getElementById("authPanel").style.display = "none";
        loadPosts();
    } else {
        document.getElementById("authPanel").style.display = "block";
    }
});

// Sign in
async function signIn() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google"
    });

    if (error) console.error("Auth error:", error);
}

// Sign out
async function signOut() {
    await supabase.auth.signOut();
    document.getElementById("postsContainer").innerHTML = "";
}



// Only BF+ users get full features
async function checkBFPlus() {
    const user = supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
        .from("profiles")
        .select("premium")
        .eq("id", (await user).data.user.id)
        .single();

    if (error) return false;

    return data.premium === true;
}



// Open map (BF+ only)
async function openMap() {
    const allowed = await checkBFPlus();

    if (!allowed) {
        alert("BF+ required for map access.");
        return;
    }

    document.getElementById("mapPanel").style.display = "block";
    loadMap();
}



// Close map
function closeMap() {
    document.getElementById("mapPanel").style.display = "none";
}

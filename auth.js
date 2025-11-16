const supabaseUrl = "https://hcgwldsslzkppzgfhwws.supabase.co";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.getElementById("loginBtn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: "https://buyerfinder.vercel.app"
        }
    });

    if (error) console.error(error);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
});

supabase.auth.onAuthStateChange(async (e, session) => {
    if (session) {
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline-block";
    } else {
        document.getElementById("loginBtn").style.display = "inline-block";
        document.getElementById("logoutBtn").style.display = "none";
    }
});

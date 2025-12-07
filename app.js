/* -----------------------------------------------------------
   APP.JS — App State, Navigation, Login Sync, View Switching
------------------------------------------------------------*/

window.currentUser = null;

/* -----------------------------------------------------------
   AUTH STATE LISTENER
------------------------------------------------------------*/
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
        window.currentUser = session.user;
        console.log("Logged in as:", session.user.id);

        // sync profile if needed
        await ensureUserProfile(session.user);
    } else {
        window.currentUser = null;
        console.log("Logged out.");
    }

    // reload current view
    if (window.myPostsMode) {
        loadMyPostsWithFilter();
    } else {
        loadPosts("global");
    }
});

/* -----------------------------------------------------------
   ENSURE PROFILE EXISTS
------------------------------------------------------------*/
async function ensureUserProfile(user) {
    const { data } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!data) {
        console.log("Creating new profile…");
        await supabaseClient.from("profiles").insert([
            {
                id: user.id,
                email: user.email || null,
                username: user.email ? user.email.split("@")[0] : "user",
            }
        ]);
    }
}

/* -----------------------------------------------------------
   LOGIN + LOGOUT
------------------------------------------------------------*/
window.signIn = async function () {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google"
    });
    if (error) alert("Sign-in error: " + error.message);
};

window.signOut = async function () {
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Sign-out error: " + error.message);
};

/* -----------------------------------------------------------
   VIEW SWITCHING
------------------------------------------------------------*/

window.switchView = function (viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");
};

/* Navigation helpers */
window.showFeed = function () {
    window.myPostsMode = false;
    switchView("view-posts");
    loadPosts("global");
};

window.showMyPosts = function () {
    window.myPostsMode = true;
    switchView("view-posts");
    loadMyPostsWithFilter();
};

/* -----------------------------------------------------------
   POST CREATION (placeholder — wired later)
------------------------------------------------------------*/

window.createPost = async function () {
    if (!window.currentUser) {
        alert("Sign in first.");
        return;
    }

    alert("Post creation UI coming soon!");
};

/* -----------------------------------------------------------
   DELETE POST (wired when UI is ready)
------------------------------------------------------------*/
window.deletePost = async function (postId) {
    if (!window.currentUser) {
        alert("You must be signed in.");
        return;
    }

    const { error } = await supabaseClient
        .from("posts")
        .delete()
        .eq("id", postId);

    if (error) {
        alert("Delete failed: " + error.message);
        return;
    }

    alert("Post deleted.");
    if (window.myPostsMode) loadMyPostsWithFilter();
    else loadPosts("global");
};

/* -----------------------------------------------------------
   MARK SOLD / FOUND
------------------------------------------------------------*/

window.markSold = async function (postId) {
    await supabaseClient.from("posts").update({ is_sold: true }).eq("id", postId);
    if (window.myPostsMode) loadMyPostsWithFilter();
};

window.markFound = async function (postId) {
    await supabaseClient.from("posts").update({ is_found: true }).eq("id", postId);
    if (window.myPostsMode) loadMyPostsWithFilter();
};

/* -----------------------------------------------------------
   INITIAL LOAD
------------------------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
    showFeed();
});
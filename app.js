/* -----------------------------------------
   BUYERFINDER MAIN APP SCRIPT
------------------------------------------ */

let currentView = "view-posts";

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  currentView = id;

  // Update nav highlighting
  document.querySelectorAll("#nav .nav-item").forEach((n) =>
    n.classList.remove("active")
  );
  if (id === "view-posts") document.getElementById("nav-selling").classList.add("active");
  if (id === "view-matches") document.getElementById("nav-matches").classList.add("active");
  if (id === "view-map") document.getElementById("nav-map").classList.add("active");
  if (id === "view-account") document.getElementById("nav-account").classList.add("active");
}

/* -----------------------------------------
   SEARCH HANDLING
------------------------------------------ */

async function handleSearch() {
  const q = document.getElementById("searchfield").value.trim();
  loadPosts(q);

  // Record only if logged in
  if (window.currentUser && q.length > 0) {
    recordSearchQuery(q);
  }
}

document.getElementById("searchbtn").addEventListener("click", handleSearch);

document.getElementById("searchfield").addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSearch();
});

/* -----------------------------------------
   NAVIGATION
------------------------------------------ */

document.getElementById("nav-selling").onclick = () => {
  showView("view-posts");
  loadPosts("");
};

document.getElementById("nav-requests").onclick = () => {
  showView("view-posts");
  loadPosts("", "request");
};

document.getElementById("nav-matches").onclick = () => {
  showView("view-matches");
  loadMatches();
};

document.getElementById("nav-map").onclick = () => {
  showView("view-map");
  initMap();
};

document.getElementById("nav-account").onclick = () => {
  showView("view-account");
  updateAccountPanel();
};

/* -----------------------------------------
   MY POSTS BUTTON
------------------------------------------ */

document.getElementById("btn-my-posts").onclick = () => {
  loadMyPosts();
};

/* Toggle filters for MY POSTS */
document.getElementById("my-filter-selling").onclick = () => {
  window.myPostsShowSelling = !window.myPostsShowSelling;
  document
    .getElementById("my-filter-selling")
    .classList.toggle("chip-on", window.myPostsShowSelling);
  loadMyPosts();
};

document.getElementById("my-filter-requests").onclick = () => {
  window.myPostsShowRequests = !window.myPostsShowRequests;
  document
    .getElementById("my-filter-requests")
    .classList.toggle("chip-on", window.myPostsShowRequests);
  loadMyPosts();
};

/* -----------------------------------------
   POST DETAIL VIEW
------------------------------------------ */

document.getElementById("detail-close-btn").onclick = () => {
  showView("view-posts");
};

document.getElementById("detail-delete-btn").onclick = async () => {
  if (!window.currentPost) return;

  const { id } = window.currentPost;

  if (!confirm("Delete this post?")) return;

  await supabase.from("posts").delete().eq("id", id);
  alert("Post deleted.");

  showView("view-posts");
  loadPosts("");
};

document.getElementById("detail-mark-sold-btn").onclick = async () => {
  if (!window.currentPost) return;

  const { id } = window.currentPost;

  await supabase.from("posts").update({ status: "sold" }).eq("id", id);
  alert("Marked SOLD");
  showView("view-posts");
  loadPosts("");
};

document.getElementById("detail-mark-found-btn").onclick = async () => {
  if (!window.currentPost) return;

  const { id } = window.currentPost;

  await supabase.from("posts").update({ status: "found" }).eq("id", id);
  alert("Marked FOUND");
  showView("view-posts");
  loadPosts("");
};

/* -----------------------------------------
   MAP CLOSE BUTTON
------------------------------------------ */

document.getElementById("map-close-btn").onclick = () => {
  showView("view-posts");
};

/* -----------------------------------------
   ACCOUNT PANEL UPDATE
------------------------------------------ */

function updateAccountPanel() {
  const box = document.getElementById("account-content");

  if (!window.currentUser) {
    box.innerHTML = "Login to view your account details.";
    return;
  }

  box.innerHTML = `
    <p>Email: ${window.currentUser.email}</p>
    <p>Bf+ Status: ${window.currentUser.is_bfplus ? "Active" : "Free tier"}</p>
  `;
}

/* -----------------------------------------
   INITIAL STATES
------------------------------------------ */

window.myPostsShowSelling = true;
window.myPostsShowRequests = true;
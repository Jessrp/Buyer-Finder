/* -----------------------------------------
   APP.JS — app state + event wiring
------------------------------------------ */

let myPostsMode = false;        // false = global feed, true = my posts
let currentFilter = "all";      // all | selling | requesting
let currentSearch = "";         // search text

/* Reload posts based on current state */
window.reloadPosts = async function () {
  const statusEl = document.getElementById("posts-status");
  const grid = document.getElementById("posts-grid");

  if (!statusEl || !grid) return;

  statusEl.textContent = "Loading...";
  grid.innerHTML = "";

  let query = supabaseClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  // My posts mode
  if (myPostsMode) {
    if (!window.currentUser) {
      statusEl.textContent = "Sign in to view your posts.";
      return;
    }
    query = query.eq("user_id", window.currentUser.id);
  }

  // Filter selling/requesting
  if (currentFilter === "selling") {
    query = query.eq("type", "sell");
  } else if (currentFilter === "requesting") {
    query = query.eq("type", "request");
  }

  // Search
  if (currentSearch && currentSearch.trim().length > 0) {
    const q = currentSearch.trim();
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    statusEl.textContent = "Error loading posts.";
    return;
  }

  if (!data || data.length === 0) {
    statusEl.textContent = "No posts found.";
    return;
  }

  statusEl.textContent = myPostsMode ? "Showing your posts" : "Showing all posts";
  window.renderPosts(data);
};

/* Event wiring */
document.addEventListener("DOMContentLoaded", () => {
  // Search
  const searchField = document.getElementById("searchfield");
  const searchBtn = document.getElementById("searchbtn");

  if (searchBtn) {
    searchBtn.onclick = () => {
      currentSearch = searchField.value || "";
      reloadPosts();
    };
  }

  if (searchField) {
    searchField.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        currentSearch = searchField.value || "";
        reloadPosts();
      }
    });
  }

  // My posts toggle
  const myBtn = document.getElementById("btn-my-posts");
  if (myBtn) {
    myBtn.onclick = () => {
      myPostsMode = !myPostsMode;
      myBtn.classList.toggle("active", myPostsMode);
      reloadPosts();
    };
  }

  // Filter buttons
  const sellBtn = document.getElementById("filter-selling");
  const reqBtn = document.getElementById("filter-requesting");

  if (sellBtn) {
    sellBtn.onclick = () => {
      currentFilter = currentFilter === "selling" ? "all" : "selling";
      updateFilterButtons();
      reloadPosts();
    };
  }

  if (reqBtn) {
    reqBtn.onclick = () => {
      currentFilter = currentFilter === "requesting" ? "all" : "requesting";
      updateFilterButtons();
      reloadPosts();
    };
  }

  // FAB (for now just placeholder)
  const fab = document.getElementById("fab-addpost");
  if (fab) {
    fab.onclick = () => {
      alert("Post creation UI will be wired next.");
    };
  }

  // Initial load after auth init
  setTimeout(() => {
    reloadPosts();
  }, 500);
});

function updateFilterButtons() {
  const sellBtn = document.getElementById("filter-selling");
  const reqBtn = document.getElementById("filter-requesting");

  if (sellBtn) sellBtn.classList.remove("active");
  if (reqBtn) reqBtn.classList.remove("active");

  if (currentFilter === "selling" && sellBtn) {
    sellBtn.classList.add("active");
  } else if (currentFilter === "requesting" && reqBtn) {
    reqBtn.classList.add("active");
  }
}

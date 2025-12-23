// posts.js — SAFE INSERT FIX (NO UI / NO FEATURE CHANGES)
// Fixes posts_type_check by clamping type to DB-allowed values ONLY.

(() => {
  if (!window.supa) {
    console.error("posts.js: Supabase client missing");
    return;
  }

  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const statusEl = document.getElementById("posts-status");

  // Public API (used by auth.js)
  window.Posts = {
    loadPosts,
    loadMatches,
    loadNotifications
  };

  // -------------------------
  // LOAD POSTS (GUEST SAFE)
  // -------------------------
  async function loadPosts() {
    if (!postsGrid) return;

    statusEl && (statusEl.textContent = "Loading posts…");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading posts:", error);
      statusEl && (statusEl.textContent = "Error loading posts");
      return;
    }

    postsGrid.innerHTML = "";
    statusEl && (statusEl.textContent = "");

    if (!data || data.length === 0) {
      statusEl && (statusEl.textContent = "No posts yet");
      return;
    }

    data.forEach(renderPostCard);
  }

  function renderPostCard(post) {
    const el = document.createElement("div");
    el.className = "post-card";
    el.innerHTML = `
      <h4>${post.title || ""}</h4>
      <p class="price">${post.price ?? ""}</p>
      <p class="hint">${post.type}</p>
    `;
    postsGrid.appendChild(el);
  }

  // -------------------------
  // CREATE POST (FIXED)
  // -------------------------
  async function createPost({
    title,
    description,
    price
  }) {
    if (!window.currentUser) {
      alert("You must be signed in to post");
      return;
    }

    // 🔥 THE FIX: clamp type to DB-allowed values ONLY
    const safeType =
      window.activePostType === "requesting"
        ? "requesting"
        : "selling";

    const payload = {
      title: title || "",
      description: description || "",
      price: price || null,
      type: safeType,          // ✅ always valid
      status: "active",        // ✅ explicit, avoids NULL
      user_id: window.currentUser.id
    };

    const { error } = await supa.from("posts").insert(payload);

    if (error) {
      console.error("Error saving post:", error);
      alert("Error saving post: " + error.message);
      return;
    }

    await loadPosts();
  }

  // Expose createPost to the modal code (unchanged API)
  window.createPost = createPost;

  // -------------------------
  // MATCHES / NOTIFICATIONS
  // (unchanged placeholders)
  // -------------------------
  function loadMatches() {}
  function loadNotifications() {}

})();

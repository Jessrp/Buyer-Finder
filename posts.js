// posts.js
(function () {
  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");
  const searchInput = document.getElementById("searchInput");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postImage = document.getElementById("post-image");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  window.activePostType = window.activePostType || "selling";
  window.editingPostId = null;

  // ===============================
  // FIX 1: global cache
  // ===============================
  window.allPosts = [];

  // ===============================
  // SAVE POST
  // ===============================
  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return alert("You must sign in.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title required.");

    postModalHint.textContent = "Saving...";

    const payload = {
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type:
        window.activePostType === "request"
          ? "requesting"
          : "selling",
      location_text: profile?.location_text ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
      user_id: user.id
    };

    let error;
    let result;

    if (window.editingPostId) {
      ({ data: result, error } = await supa
        .from("posts")
        .update(payload)
        .eq("id", window.editingPostId)
        .eq("user_id", user.id)
        .select()
        .single());
    } else {
      ({ data: result, error } = await supa
        .from("posts")
        .insert(payload)
        .select()
        .single());
    }

    if (error) {
      postModalHint.textContent = error.message;
      return;
    }

    // ===============================
    // FIX 2: trigger matches AFTER insert/update
    // ===============================
    if (window.Matches?.syncForPost) {
      window.Matches.syncForPost(result);
    }

    closeModal();
    loadPosts();
  }

  // ===============================
  // LOAD POSTS
  // ===============================
  async function loadPosts() {
    postsStatus.textContent = "Loading...";
    postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      postsStatus.textContent = "Failed to load posts.";
      return;
    }

    // ===============================
    // FIX 3: cache posts
    // ===============================
    window.allPosts = data || [];

    renderPosts(window.allPosts);

    // ===============================
    // FIX 4: retroactive match check
    // ===============================
    if (window.Matches?.retroactiveCheck) {
      window.Matches.retroactiveCheck(window.allPosts);
    }
  }

  // ===============================
  // RENDER
  // ===============================
  function renderPosts(posts) {
    const filtered = posts.filter(p => {
      const t = p.type === "requesting" ? "request" : "selling";
      return t === window.activePostType;
    });

    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";
  }

  function renderPostCard(p) {
    return `
      <article class="post">
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
        <p>${p.price || ""}</p>
      </article>
    `;
  }

  // ===============================
  // FIX 5: search (minimal)
  // ===============================
  function handleSearch(e) {
    const q = e.target.value.trim().toLowerCase();

    if (!q) {
      renderPosts(window.allPosts);
      return;
    }

    const filtered = window.allPosts.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );

    renderPosts(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }

  // ===============================
  // MODAL
  // ===============================
  function openModalForCreate() {
    if (!window.currentUser) return alert("You must sign in.");
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
    window.editingPostId = null;
  }

  fabAdd.onclick = openModalForCreate;
  btnCancelPost.onclick = closeModal;
  btnSavePost.onclick = savePost;

  loadPosts();
})();

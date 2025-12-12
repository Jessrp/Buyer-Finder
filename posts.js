// posts.js – posts grid, modal (create/edit), detail panel, search, basic matches hooks

let viewMode = "all"; // 'all' | 'mine'
let sortDir = "desc"; // 'asc' | 'desc'
let editingPostId = null;

(function () {
  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postImage = document.getElementById("post-image");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  // Detail panel
  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailImages = document.getElementById("detail-images");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");

  window.activePostType = window.activePostType || "selling";

  let editingPostImages = [];

  /* ---------------- MODAL ---------------- */

  function openModalForCreate() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    editingPostId = null;
    editingPostImages = [];
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    if (postImage) postImage.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function openModalForEdit(post) {
    if (!window.currentUser || window.currentUser.id !== post.user_id) {
      alert("You can only edit your own posts.");
      return;
    }
    editingPostId = post.id;
    editingPostImages = [];

    if (post.image_urls) {
      try {
        const arr = JSON.parse(post.image_urls);
        if (Array.isArray(arr)) editingPostImages = arr;
      } catch (_) {}
    }

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    if (postImage) postImage.value = "";
    postModalHint.textContent = "Editing existing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  /* ---------------- SAVE POST ---------------- */

  async function savePost() {
    const user = window.currentUser;
    if (!user) return;

    const title = postTitle.value.trim();
    if (!title) {
      alert("Title is required.");
      return;
    }

    const payload = {
      user_id: user.id,
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type: window.activePostType,
      image_urls: editingPostImages.length
        ? JSON.stringify(editingPostImages)
        : null,
    };

    postModalHint.textContent = "Saving…";

    try {
      if (editingPostId) {
        const { error } = await supa
          .from("posts")
          .update(payload)
          .eq("id", editingPostId);
        if (error) throw error;
      } else {
        const { error } = await supa.from("posts").insert(payload);
        if (error) throw error;
      }

      closeModal();
      loadPosts();
    } catch (err) {
      postModalHint.textContent = err.message || "Save failed";
    }
  }

  /* ---------------- LOAD POSTS ---------------- */

  async function loadPosts(query) {
    postsStatus.textContent = "Loading posts…";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    if (viewMode === "mine" && window.currentUser) {
      req = req.eq("user_id", window.currentUser.id);
    }

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await req;

    if (error) {
      postsStatus.textContent = "Error loading posts";
      return;
    }

    if (!data || !data.length) {
      postsStatus.textContent = "No posts yet.";
      return;
    }

    const filtered = data.filter(
      (p) => (p.type || "").toLowerCase() === window.activePostType
    );

    postsGrid.innerHTML = filtered
      .map((p) => {
        const isMine =
          window.currentUser && p.user_id === window.currentUser.id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${isMine ? `<button class="edit-btn">✎</button>` : ""}
            <h3>${p.title}</h3>
            <p>${p.description || ""}</p>
            <small>${p.price ? `$${p.price}` : ""}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(filtered);
    postsStatus.textContent = "";
  }

  /* ---------------- CLICK / EDIT HANDLERS ---------------- */

  function attachPostHandlers(posts) {
    const cards = postsGrid.querySelectorAll(".post[data-post-id]");

    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => p.id === id);
      if (!post) return;

      card.addEventListener("click", () => openDetailPanel(post));

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        });
      }
    });
  }

  /* ---------------- DETAIL PANEL ---------------- */

  function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailDescription.textContent = post.description || "";
    detailMeta.textContent = post.type;

    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function closeDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  if (detailCloseBtn) detailCloseBtn.onclick = closeDetailPanel;
  if (detailOverlay) detailOverlay.onclick = closeDetailPanel;

  /* ---------------- WIRES ---------------- */

  if (fabAdd) fabAdd.onclick = openModalForCreate;
  if (btnCancelPost) btnCancelPost.onclick = closeModal;
  if (btnSavePost) btnSavePost.onclick = savePost;

  window.Posts = { loadPosts };

  loadPosts();
})();

// posts.js – posts grid, modal (create/edit), detail panel, search

let viewMode = "all"; // 'all' | 'mine'
let sortDir = "desc"; // 'asc' | 'desc'

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

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailImages = document.getElementById("detail-images");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailSellerAvatar = document.getElementById("detail-seller-avatar");
  const detailSellerName = document.getElementById("detail-seller-name");
  const detailSellerEmail = document.getElementById("detail-seller-email");
  const detailLocationText = document.getElementById("detail-location-text");
  const detailMessageBtn = document.getElementById("detail-message-btn");

  window.activePostType = window.activePostType || "selling";

  let editingPostId = null;
  let editingPostImages = [];

  // ---------- MODAL ----------

  function openModalForCreate() {
    if (!window.currentUser) return alert("Sign in first");
    editingPostId = null;
    editingPostImages = [];
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function openModalForEdit(post) {
    if (window.currentUser?.id !== post.user_id) return;
    editingPostId = post.id;
    editingPostImages = [];

    if (post.image_urls) {
      try {
        editingPostImages = JSON.parse(post.image_urls) || [];
      } catch {}
    }

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    postModalHint.textContent = "Editing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  // ---------- SAVE ----------

  async function savePost() {
    const user = window.currentUser;
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: postTitle.value.trim(),
      description: postDescription.value.trim(),
      price: postPrice.value || null,
      type: window.activePostType,
      image_urls: editingPostImages.length
        ? JSON.stringify(editingPostImages)
        : null,
    };

    postModalHint.textContent = "Saving…";

    const res = editingPostId
      ? await supa.from("posts").update(payload).eq("id", editingPostId)
      : await supa.from("posts").insert(payload);

    if (res.error) {
      postModalHint.textContent = res.error.message;
      return;
    }

    closeModal();
    loadPosts();
  }

  // ---------- LOAD ----------

  async function loadPosts() {
    postsGrid.innerHTML = "";
    postsStatus.textContent = "Loading…";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      postsStatus.textContent = "Error loading posts";
      return;
    }

    const filtered = data.filter(
      p =>
        (p.type === "request" ? "request" : "selling") ===
        window.activePostType
    );

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map(
        p => `
      <article class="post" data-id="${p.id}">
        ${
          p.user_id === window.currentUser?.id
            ? `<button class="edit-btn">✎</button>`
            : ""
        }
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
        <small>${p.price ? "$" + p.price : ""}</small>
      </article>`
      )
      .join("");

    attachHandlers(filtered);
  }

  function attachHandlers(posts) {
    document.querySelectorAll(".post").forEach(card => {
      const post = posts.find(p => p.id === card.dataset.id);
      if (!post) return;

      card.onclick = () => openDetail(post);

      const edit = card.querySelector(".edit-btn");
      if (edit) {
        edit.onclick = e => {
          e.stopPropagation();
          openModalForEdit(post);
        };
      }
    });
  }

  // ---------- DETAIL ----------

  function openDetail(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? "$" + post.price : "";
    detailMeta.textContent = post.type;
    detailPanel.classList.add("active");
    detailOverlay.classList.add("active");
  }

  function closeDetail() {
    detailPanel.classList.remove("active");
    detailOverlay.classList.remove("active");
  }

  // ---------- WIRES ----------

  fabAdd?.addEventListener("click", openModalForCreate);
  btnCancelPost?.addEventListener("click", closeModal);
  btnSavePost?.addEventListener("click", savePost);
  detailCloseBtn?.addEventListener("click", closeDetail);
  detailOverlay?.addEventListener("click", closeDetail);

  loadPosts();
})();

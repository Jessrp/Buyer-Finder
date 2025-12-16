// posts.js — STABLE LIST + SEARCH + TYPE FILTER + IMAGE FIX

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

  let editingPostId = null;
  let editingPostImages = [];

  // ---------- MODAL ----------

  function openCreateModal() {
    if (!window.currentUser) {
      alert("You must sign in first.");
      return;
    }
    editingPostId = null;
    editingPostImages = [];
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  fabAdd?.addEventListener("click", openCreateModal);
  btnCancelPost?.addEventListener("click", closeModal);

  // ---------- SAVE POST ----------

  btnSavePost?.addEventListener("click", async () => {
    const user = window.currentUser;
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: postTitle.value.trim(),
      description: postDescription.value.trim(),
      price: postPrice.value || null,
      type: window.activePostType || "selling",
      image_urls: null,
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
  });

  // ---------- LOAD POSTS ----------

  async function loadPosts(query = "") {
    postsGrid.innerHTML = "";
    postsStatus.textContent = "Loading posts…";

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (query.trim()) {
      req = req.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await req;

    if (error) {
      postsStatus.textContent = "Failed to load posts.";
      return;
    }

    const activeType = window.activePostType || "selling";

    const filtered = data.filter((p) => p.type === activeType);

    postsStatus.textContent = "";

    if (!filtered.length) {
      postsGrid.innerHTML =
        "<p class='hint'>No posts in this category yet.</p>";
      return;
    }

    postsGrid.innerHTML = filtered
      .map(renderPostCard)
      .join("");

    attachHandlers(filtered);
  }

  // ---------- RENDER ----------

  function extractImage(post) {
    if (!post) return null;

    if (Array.isArray(post.image_urls)) {
      return post.image_urls[0];
    }

    if (typeof post.image_urls === "string") {
      try {
        const arr = JSON.parse(post.image_urls);
        if (Array.isArray(arr)) return arr[0];
      } catch {}
    }

    if (post.image_url) return post.image_url;

    return null;
  }

  function renderPostCard(p) {
    const img = extractImage(p);
    const canEdit = window.currentUser?.id === p.user_id;

    return `
      <article class="post" data-id="${p.id}">
        ${canEdit ? `<button class="edit-btn">✎</button>` : ""}
        ${img ? `<img src="${img}" alt="Post image" />` : ""}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
        <small>${p.price ? "$" + p.price : ""}</small>
      </article>
    `;
  }

  // ---------- HANDLERS ----------

  function attachHandlers(posts) {
    document.querySelectorAll(".post").forEach((card) => {
      const post = posts.find((p) => p.id === card.dataset.id);
      if (!post) return;

      card.addEventListener("click", () => openDetail(post));

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          editingPostId = post.id;
          postTitle.value = post.title;
          postDescription.value = post.description;
          postPrice.value = post.price || "";
          modalBackdrop.classList.add("active");
        });
      }
    });
  }

  // ---------- DETAIL (MINIMAL, SAFE) ----------

  function openDetail(post) {
    const panel = document.getElementById("detail-panel");
    const overlay = document.getElementById("detail-overlay");

    document.getElementById("detail-title").textContent = post.title;
    document.getElementById("detail-description").textContent =
      post.description || "";
    document.getElementById("detail-price").textContent =
      post.price ? "$" + post.price : "";

    panel.classList.add("active");
    overlay.classList.add("active");
  }

  document
    .getElementById("detail-close-btn")
    ?.addEventListener("click", () => {
      document.getElementById("detail-panel")?.classList.remove("active");
      document.getElementById("detail-overlay")?.classList.remove("active");
    });

  document
    .getElementById("detail-overlay")
    ?.addEventListener("click", () => {
      document.getElementById("detail-panel")?.classList.remove("active");
      document.getElementById("detail-overlay")?.classList.remove("active");
    });

  // ---------- EXPORT ----------

  window.Posts = {
    loadPosts,
  };

  // Initial
  loadPosts();
})();

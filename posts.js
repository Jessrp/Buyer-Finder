// posts.js – posts grid, modal (create/edit), detail panel, search, matches, delete
let viewMode = "all"; // 'all' | 'mine'
let sortDir = "desc";
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
  const detailSellerAvatar = document.getElementById("detail-seller-avatar");
  const detailSellerName = document.getElementById("detail-seller-name");
  const detailSellerEmail = document.getElementById("detail-seller-email");
  const detailLocationText = document.getElementById("detail-location-text");
  const detailMinimapContainer = document.getElementById("detail-minimap-container");
  const detailMessageBtn = document.getElementById("detail-message-btn");

  window.activePostType = window.activePostType || "selling";

  let editingPostImages = [];

  /* ---------- MODAL ---------- */

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
      } catch {}
    }

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    if (postImage) postImage.value = "";
    postModalHint.textContent = "Editing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  /* ---------- IMAGE UPLOAD ---------- */

  async function uploadPostImages(files, userId) {
    if (!files || !files.length) return [];
    const urls = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: true });

      if (error) continue;

      const { data } = supa.storage.from("post_images").getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  /* ---------- SAVE POST ---------- */

  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return;

    const title = postTitle.value.trim();
    if (!title) return alert("Title required");

    const description = postDescription.value.trim();
    const price = postPrice.value.trim();

    const fileList = postImage?.files || [];
    let newImages = [];
    if (fileList.length) {
      newImages = await uploadPostImages(fileList, user.id);
    }

    const image_urls = [...editingPostImages, ...newImages];
    const payload = {
      user_id: user.id,
      title,
      description,
      price: price || null,
      type: window.activePostType,
      image_urls: image_urls.length ? JSON.stringify(image_urls) : null,
      location_text: profile?.location_text || null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };

    try {
      if (editingPostId) {
        await supa.from("posts").update(payload).eq("id", editingPostId);
      } else {
        await supa.from("posts").insert(payload);
      }
      closeModal();
      loadPosts();
    } catch (e) {
      postModalHint.textContent = e.message;
    }
  }

  /* ---------- LOAD POSTS ---------- */

  async function loadPosts(query) {
    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    const user = window.currentUser;
    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    if (query?.trim()) {
      req = req.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await req;
    if (error || !data) {
      postsStatus.textContent = "Error loading posts";
      return;
    }

    const filtered = data.filter(
      (p) =>
        (p.type || "selling").toLowerCase() ===
        window.activePostType
    );

    if (!filtered.length) {
      postsStatus.textContent = "No posts yet";
      return;
    }

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map((p) => {
        let img = "";
        try {
          const arr = JSON.parse(p.image_urls || "[]");
          if (arr.length) img = `<img src="${arr[0]}">`;
        } catch {}

        const isOwner = user?.id === p.user_id;

        return `
        <article class="post" data-post-id="${p.id}">
          ${isOwner ? `
            <div class="post-owner-actions">
              <button class="edit-btn">✎</button>
              <button class="delete-btn">🗑</button>
            </div>` : ""}
          ${img}
          <h3>${p.title}</h3>
          <p>${p.description || ""}</p>
          <small>${p.price ? `$${p.price}` : ""}</small>
        </article>
      `;
      })
      .join("");

    attachPostHandlers(filtered);
  }

  /* ---------- POST HANDLERS ---------- */

  function attachPostHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((card) => {
      const post = posts.find(
        (p) => String(p.id) === card.dataset.postId
      );
      if (!post) return;

      card.addEventListener("click", () => openDetailPanel(post));

      card.querySelector(".edit-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openModalForEdit(post);
      });

      card.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this post?")) return;
        await supa.from("posts").delete().eq("id", post.id);
        loadPosts();
      });
    });
  }

  /* ---------- DETAIL PANEL ---------- */

  async function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailDescription.textContent = post.description || "";

    detailImages.innerHTML = "";
    try {
      const arr = JSON.parse(post.image_urls || "[]");
      arr.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        detailImages.appendChild(img);
      });
    } catch {}

    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function closeDetail() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  detailCloseBtn?.addEventListener("click", closeDetail);
  detailOverlay?.addEventListener("click", closeDetail);

  /* ---------- WIRES ---------- */

  fabAdd?.addEventListener("click", openModalForCreate);
  btnCancelPost?.addEventListener("click", closeModal);
  btnSavePost?.addEventListener("click", savePost);

  window.Posts = { loadPosts };
  loadPosts();
})();

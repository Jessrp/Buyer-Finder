// posts.js – posts grid, modal (create/edit), detail panel, search, basic matches hooks
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

  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  // UI uses: "selling" | "request"
  window.activePostType = window.activePostType || "selling";

  let editingPostId = null;
  let editingPostImages = [];

  // ---------- MODAL ----------

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
    } else if (post.image_url) {
      editingPostImages = [post.image_url];
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

  // ---------- IMAGE UPLOAD ----------

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

  // ---------- SAVE POST ----------

  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return alert("You must sign in to add a post.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title is required.");

    const description = postDescription.value.trim();
    const price = postPrice.value.trim();

    const lat = profile?.lat ?? null;
    const lng = profile?.lng ?? null;
    const locationText = profile?.location_text ?? null;

    postModalHint.textContent = "Saving post...";

    const fileList = postImage?.files || [];
    const newImageUrls = fileList.length
      ? await uploadPostImages(fileList, user.id)
      : [];

    const finalImageUrls = editingPostImages.concat(newImageUrls);

    const payload = {
      user_id: user.id,
      title,
      description,
      price: price || null,

      // ✅ HARDENED FIX — cannot violate DB constraint
      type:
        window.activePostType
          .toLowerCase()
          .startsWith("request")
          ? "requesting"
          : "selling",

      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng,
      image_urls: finalImageUrls.length
        ? JSON.stringify(finalImageUrls)
        : null,
    };

    try {
      if (editingPostId) {
        const { error } = await supa
          .from("posts")
          .update(payload)
          .eq("id", editingPostId);
        if (error) throw error;
      } else {
        const { data, error } = await supa
          .from("posts")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) tryCreateMatchesForNewPost(data);
      }

      postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts();
      }, 400);
    } catch (err) {
      postModalHint.textContent = "Error saving post: " + err.message;
    }
  }

  // ---------- LOAD POSTS ----------

  async function loadPosts(query) {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (query?.trim()) {
      const q = query.trim();
      req = req.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    const { data, error } = await req;
    if (error) return (postsStatus.textContent = "Error loading posts.");

    const filtered = (data || []).filter((p) => {
      const t =
        (p.type || "").toLowerCase() === "requesting"
          ? "request"
          : "selling";
      return t === window.activePostType;
    });

    if (!filtered.length) {
      postsGrid.innerHTML = "<p class='hint'>No posts yet.</p>";
      postsStatus.textContent = "";
      return;
    }

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.map(renderPostCard).join("");
    attachPostHandlers(filtered);
  }

  function renderPostCard(p) {
    let img = "";
    if (p.image_urls) {
      try {
        const arr = JSON.parse(p.image_urls);
        if (arr?.length) img = `<img src="${arr[0]}" />`;
      } catch {}
    }

    return `
      <article class="post" data-post-id="${p.id}">
        ${img}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
      </article>
    `;
  }

  function attachPostHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((card) => {
      const post = posts.find(
        (p) => p.id === Number(card.dataset.postId)
      );
      if (post) card.onclick = () => openDetailPanel(post);
    });
  }

  // ---------- DETAIL PANEL ----------

  async function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";

    detailMeta.textContent =
      post.type === "requesting" ? "Request" : "Selling";

    showDetailPanel();
  }

  function showDetailPanel() {
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  if (detailCloseBtn) detailCloseBtn.onclick = hideDetailPanel;
  if (detailOverlay) detailOverlay.onclick = hideDetailPanel;

  if (fabAdd) fabAdd.onclick = openModalForCreate;
  if (btnCancelPost) btnCancelPost.onclick = closeModal;
  if (btnSavePost) btnSavePost.onclick = savePost;

  window.Posts = { loadPosts };
  loadPosts();
})();

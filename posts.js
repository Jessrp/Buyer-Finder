// posts.js – stable, read-only post renderer & creator
(function () {
  console.error("🔥 POSTS.JS LOADED (STABLE) 🔥");

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
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");

  let editingPostId = null;
  let editingPostImages = [];

  // ---------- HELPERS ----------

  function normalizeImageUrls(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function getActiveType() {
    // READ ONLY. Never mutate.
    return window.activePostType === "request" ? "requesting" : "selling";
  }

  // ---------- MODAL ----------

  function openModalForCreate() {
    if (!window.currentUser) {
      alert("Sign in first.");
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

      const { data } = supa.storage
        .from("post_images")
        .getPublicUrl(path);

      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  // ---------- SAVE POST ----------

  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return;

    const title = postTitle.value.trim();
    if (!title) return alert("Title required.");

    postModalHint.textContent = "Saving…";

    const newImages = await uploadPostImages(
      postImage?.files || [],
      user.id
    );

    const payload = {
      user_id: user.id,
      title,
      description: postDescription.value.trim() || null,
      price: postPrice.value.trim() || null,
      type: getActiveType(),
      location_text: profile?.location_text ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
      image_urls: editingPostImages.concat(newImages)
    };

    const res = editingPostId
      ? supa.from("posts").update(payload).eq("id", editingPostId)
      : supa.from("posts").insert(payload);

    const { error } = await res;
    if (error) {
      postModalHint.textContent = "Save failed";
      return;
    }

    closeModal();
    loadPosts(); // reload WITHOUT touching activePostType
  }

  // ---------- LOAD POSTS ----------

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

    const active = getActiveType();

    const filtered = data.filter((p) => p.type === active);

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";

    attachPostHandlers(filtered);
  }

  function renderPostCard(p) {
    const urls = normalizeImageUrls(p.image_urls);
    const img = urls.length ? `<img src="${urls[0]}" loading="lazy">` : "";

    return `
      <article class="post" data-post-id="${p.id}">
        ${img}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
      </article>
    `;
  }

  function attachPostHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((el) => {
      const post = posts.find((p) => p.id === Number(el.dataset.postId));
      if (post) el.onclick = () => openDetailPanel(post);
    });
  }

  // ---------- DETAIL PANEL ----------

  function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailMeta.textContent =
      post.type === "requesting" ? "Request" : "Selling";
    showDetailPanel();
  }

  function showDetailPanel() {
    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  if (detailCloseBtn) detailCloseBtn.onclick = hideDetailPanel;
  if (detailOverlay) detailOverlay.onclick = hideDetailPanel;

  if (fabAdd) fabAdd.onclick = openModalForCreate;
  if

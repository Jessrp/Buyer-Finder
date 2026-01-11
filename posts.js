// posts.js – posts grid, modal (create/edit), detail panel, search, matches
(function () {
  console.error("🔥 POSTS.JS LOADED 🔥");

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

  const detailOverlay = document.querySelector("detail-overlay");
  const detailPanel = document.querySelector("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");

  window.activePostType = window.activePostType || "selling";

  // ---------- MODAL ----------

  function openModalForCreate() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postImage.value = "";
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
      if (!file.type?.startsWith("image/")) continue;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) continue;

      const { data } = supa.storage.from("post_images").getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  // ---------- MATCHING ----------

  async function createMatchesForPost(newPost) {
    const oppositeType =
      newPost.type === "selling" ? "requesting" : "selling";

    const keywords = newPost.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);

    const { data: candidates } = await supa
      .from("posts")
      .select("id, title, description")
      .eq("type", oppositeType)
      .neq("id", newPost.id);

    if (!candidates) return;

    for (const post of candidates) {
      const text = `${post.title} ${post.description || ""}`.toLowerCase();

      let overlap = 0;
      for (const word of keywords) {
        if (text.includes(word)) overlap++;
      }

      if (!overlap) continue;

      const a = Math.min(newPost.id, post.id);
      const b = Math.max(newPost.id, post.id);

      await supa.from("matches").upsert({
        post_a_id: a,
        post_b_id: b,
        score: overlap * 10,
      });
    }
  }

  // ---------- SAVE POST ----------

  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return alert("You must sign in.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title required.");

    postModalHint.textContent = "Saving...";

    const images = await uploadPostImages(postImage.files, user.id);

    const payload = {
      user_id: user.id,
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type:
        window.activePostType === "request"
          ? "requesting"
          : "selling",
      image_urls: images.length ? images : null,
      location_text: profile?.location_text ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };

    const { data, error } = await supa
      .from("posts")
      .insert(payload)
      .select()
      .single();

    if (error) {
      postModalHint.textContent = error.message;
      return;
    }

    await createMatchesForPost(data);

    closeModal();
    loadPosts();
  }

  // ---------- LOAD POSTS ----------

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

    const filtered = data.filter((p) => {
      const t = p.type === "requesting" ? "request" : "selling";
      return t === window.activePostType;
    });

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";

    attachPostHandlers(filtered);
  }

  function renderPostCard(p) {
    let img = "";
    let arr = [];

    if (Array.isArray(p.image_urls)) arr = p.image_urls;
    else if (typeof p.image_urls === "string") {
      try {
        arr = JSON.parse(p.image_urls);
      } catch {}
    }

    if (arr.length) img = `<img src="${arr[0]}" loading="lazy" />`;

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
      const id = Number(card.dataset.postId);
      const post = posts.find((p) => p.id === id);
      if (post) card.onclick = () => openDetailPanel(post);
    });
  }

  // ---------- DETAIL PANEL ----------

  function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailMeta.textContent =
      post.type === "requesting" ? "Request" : "Selling";

    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  detailCloseBtn.onclick = hideDetailPanel;
  detailOverlay.onclick = hideDetailPanel;

  fabAdd.onclick = openModalForCreate;
  btnCancelPost.onclick = closeModal;
  btnSavePost.onclick = savePost;

  // 🔑 expose API for app.js
  window.Posts = {
    loadPosts,
  };

  loadPosts();
})();

// posts.js – posts grid, modal, detail panel, delete
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

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailImages = document.getElementById("detail-images");

  window.activePostType = window.activePostType || "selling";

  // ---------- MODAL ----------

  function openModalForCreate() {
    if (!window.currentUser) return alert("You must sign in.");
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
    if (!files?.length) return [];
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

    const { error } = await supa.from("posts").insert(payload);
    if (error) {
      postModalHint.textContent = error.message;
      return;
    }

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
      try { arr = JSON.parse(p.image_urls); } catch {}
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
      if (!post) return;

      // open details
      card.onclick = () => openDetailPanel(post);

      // 🔑 ADD EDIT BUTTON (OWNER ONLY)
      if (window.currentUser?.id === post.user_id) {
        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.innerHTML = "✏️";

        editBtn.onclick = (e) => {
          e.stopPropagation();
          alert("Edit modal not wired yet.");
        };

        card.appendChild(editBtn);
      }
    });
  }

  // ---------- DETAIL PANEL ----------

  function openDetailPanel(post) {
    console.log("OPEN DETAIL PANEL", post.id);
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailMeta.textContent =
      post.type === "requesting" ? "Request" : "Selling";

    detailImages.innerHTML = "";
    let imgs = [];
    if (Array.isArray(post.image_urls)) imgs = post.image_urls;
    else if (typeof post.image_urls === "string") {
      try { imgs = JSON.parse(post.image_urls); } catch {}
    }

    imgs.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      detailImages.appendChild(img);
    });

    const existingDelete = detailPanel.querySelector(".delete-post-btn");
    if (existingDelete) existingDelete.remove();

    if (window.currentUser?.id === post.user_id) {
      const del = document.createElement("button");
      del.className = "delete-post-btn";
      del.textContent = "Delete Post";
      del.onclick = async () => {
        if (!confirm("Delete this post?")) return;
        await supa.from("posts").delete().eq("id", post.id);
        hideDetailPanel();
        loadPosts();
      };
      detailPanel.appendChild(del);
    }

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

  window.Posts = { loadPosts };
  loadPosts();
})();

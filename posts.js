// posts.js – posts grid, modal (create/edit), detail panel, search, basic matches hooks
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

  // Detail panel
  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");

  // UI uses: "selling" | "request"
  window.activePostType = window.activePostType || "selling";

  let editingPostId = null;
  let editingPostImages = [];

  // ✅ MOBILE-SAFE IMAGE STATE
  let selectedImageFiles = [];

  if (postImage) {
    postImage.addEventListener("change", (e) => {
      selectedImageFiles = Array.from(e.target.files || []);
    });
  }

  // ---------- MODAL ----------

  function openModalForCreate() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    editingPostId = null;
    editingPostImages = [];
    selectedImageFiles = [];
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
    const urls = [];
    if (!files || !files.length) return urls;

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: false });

      if (error) {
        console.error("UPLOAD FAILED:", error);
        continue;
      }

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
    if (!user) return alert("You must sign in to add a post.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title is required.");

    postModalHint.textContent = "Saving post...";

    const newImageUrls = selectedImageFiles.length
      ? await uploadPostImages(selectedImageFiles, user.id)
      : [];

    const finalImageUrls = editingPostImages.concat(newImageUrls);

    const payload = {
      user_id: user.id,
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type: window.activePostType.startsWith("request")
        ? "requesting"
        : "selling",
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
        const { error } = await supa.from("posts").insert(payload);
        if (error) throw error;
      }

      selectedImageFiles = [];
      if (postImage) postImage.value = "";

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

  async function loadPosts() {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    const filtered = (data || []).filter((p) => {
      const t =
        (p.type || "").toLowerCase() === "requesting"
          ? "request"
          : "selling";
      return t === window.activePostType;
    });

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.map(renderPostCard).join("");
  }

  function renderPostCard(p) {
    let img = "";
    let urls = [];

    if (p.image_urls) {
      if (Array.isArray(p.image_urls)) {
        urls = p.image_urls;
      } else if (typeof p.image_urls === "string") {
        try {
          urls = JSON.parse(p.image_urls);
        } catch {}
      }
    }

    if (urls.length) {
      img = `<img src="${urls[0]}" loading="lazy" />`;
    }

    return `
      <article class="post">
        ${img}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
      </article>
    `;
  }

  if (fabAdd) fabAdd.onclick = openModalForCreate;
  if (btnCancelPost) btnCancelPost.onclick = closeModal;
  if (btnSavePost) btnSavePost.onclick = savePost;

  loadPosts();
})();

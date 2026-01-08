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
    postImage.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  // ---------- IMAGE UPLOAD ----------

  async function uploadPostImages(files, userId, postId) {
  if (!files || !files.length) return [];

  const urls = [];

  for (const file of files) {
    if (!file || !file.type?.startsWith("image/")) continue;

    const ext = file.type.includes("png") ? "png" : "jpg";
    const path = `posts/${userId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supa.storage
      .from("post_images")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error(uploadError);
      continue;
    }

    const { data } = supa.storage.from("post_images").getPublicUrl(path);
    if (!data?.publicUrl) continue;

    // 🔥 THIS WAS MISSING
    await supa.from("post_images").insert({
      post_id: postId,
      user_id: userId,
      image_url: data.publicUrl,
    });

    urls.push(data.publicUrl);
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

    const description = postDescription.value.trim();
    const price = postPrice.value.trim() || null;

    postModalHint.textContent = "Saving...";

    const newUrls = await uploadPostImages(postImage.files, user.id);
    const allImages = [...editingPostImages, ...newUrls];

    const payload = {
      user_id: user.id,
      title,
      description,
      price,
      type:
        window.activePostType === "request"
          ? "requesting"
          : "selling",
      image_urls: allImages.length ? JSON.stringify(allImages) : null,
      location_text: profile?.location_text || null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };

    const { error } = editingPostId
      ? await supa.from("posts").update(payload).eq("id", editingPostId)
      : await supa.from("posts").insert(payload);

    if (error) {
      postModalHint.textContent = "Error: " + error.message;
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
      const uiType = p.type === "requesting" ? "request" : "selling";
      return uiType === window.activePostType;
    });

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";
  }

  // ---------- RENDER ----------

  function normalizeImages(image_urls) {
    if (!image_urls) return [];
    if (Array.isArray(image_urls)) return image_urls;
    if (typeof image_urls === "string") {
      try {
        const parsed = JSON.parse(image_urls);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [image_urls];
      }
    }
    return [];
  }

  function renderPostCard(p) {
    const images = normalizeImages(p.image_urls);
    const img = images.length
      ? `<img src="${images[0]}" loading="lazy" />`
      : "";

    return `
      <article class="post">
        ${img}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
      </article>
    `;
  }

  // ---------- EVENTS ----------

  fabAdd.onclick = openModalForCreate;
  btnCancelPost.onclick = closeModal;
  btnSavePost.onclick = savePost;

  window.Posts = { loadPosts };
  loadPosts();
})();

// posts.js — FULL VERSION (MINIMAL FIXES ONLY)

(() => {
  if (!window.supa) {
    console.error("Supabase client missing");
    return;
  }

  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const statusEl = document.getElementById("posts-status");

  const fab = document.getElementById("fab-add");
  const modal = document.getElementById("modal-backdrop");
  const btnCancel = document.getElementById("btn-cancel-post");
  const btnSave = document.getElementById("btn-save-post");

  const inputTitle = document.getElementById("post-title");
  const inputDesc = document.getElementById("post-description");
  const inputPrice = document.getElementById("post-price");
  const inputImages = document.getElementById("post-image");

  window.Posts = { loadPosts };

  let isLoading = false;

  // -------------------------
  // LOAD POSTS (GUEST SAFE)
  // -------------------------
  async function loadPosts() {
    if (isLoading) return;
    isLoading = true;

    statusEl && (statusEl.textContent = "Loading posts...");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    postsGrid.innerHTML = "";
    statusEl.textContent = "";

    if (error) {
      console.error("Error loading posts:", error);
      statusEl.textContent = "Error loading posts";
      isLoading = false;
      return;
    }

    if (!data || data.length === 0) {
      statusEl.textContent = "No posts yet";
      isLoading = false;
      return;
    }

    data.forEach(renderPost);
    isLoading = false;
  }

  // -------------------------
  // RENDER POST
  // -------------------------
  function renderPost(post) {
    const card = document.createElement("div");
    card.className = "post-card";

    let imagesHtml = "";
    if (Array.isArray(post.images)) {
      imagesHtml = post.images
        .map(
          url => `
          <div class="post-image-wrap">
            <img src="${url}" loading="lazy" />
          </div>
        `
        )
        .join("");
    }

    card.innerHTML = `
      ${imagesHtml}
      <h4>${post.title || ""}</h4>
      <div class="price">${post.price ?? ""}</div>
      <div class="hint">${post.type}</div>
    `;

    postsGrid.appendChild(card);
  }

  // -------------------------
  // MODAL CONTROLS (UNCHANGED)
  // -------------------------
  fab?.addEventListener("click", () => {
    modal.classList.add("active");
  });

  btnCancel?.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // -------------------------
  // SAVE POST (MINIMAL FIX)
  // -------------------------
  btnSave?.addEventListener("click", async () => {
    if (!window.currentUser) {
      alert("You must sign in first");
      return;
    }

    const title = inputTitle.value.trim();
    if (!title) {
      alert("Title required");
      return;
    }

    // 🔒 HARD CLAMP TYPE (NECESSARY FIX ONLY)
    const safeType =
      window.activePostType === "requesting"
        ? "requesting"
        : "selling";

    let imageUrls = [];
    if (inputImages.files.length) {
      for (const file of inputImages.files) {
        const path = `${window.currentUser.id}/${Date.now()}-${file.name}`;

        const { error: uploadErr } = await supa
          .storage
          .from("post_images")
          .upload(path, file);

        if (!uploadErr) {
          const { data } = supa
            .storage
            .from("post_images")
            .getPublicUrl(path);

          imageUrls.push(data.publicUrl);
        }
      }
    }

    const payload = {
      title,
      description: inputDesc.value || "",
      price: inputPrice.value || null,
      images: imageUrls,
      type: safeType,
      status: "active",
      user_id: window.currentUser.id
    };

    const { error } = await supa.from("posts").insert(payload);

    if (error) {
      alert("Error saving post:\n" + error.message);
      console.error(error);
      return;
    }

    modal.classList.remove("active");
    inputTitle.value = "";
    inputDesc.value = "";
    inputPrice.value = "";
    inputImages.value = "";

    loadPosts();
  });

})();

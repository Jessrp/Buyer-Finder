// posts.js — RESTORED + FIXED (UI INTACT)

(() => {
  if (!window.supa) {
    console.error("posts.js: Supabase missing");
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

  // Public API
  window.Posts = { loadPosts };

  // -------------------------
  // LOAD POSTS (GUEST SAFE)
  // -------------------------
  async function loadPosts() {
    if (!postsGrid) return;

    statusEl && (statusEl.textContent = "Loading posts…");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      statusEl.textContent = "Error loading posts";
      return;
    }

    postsGrid.innerHTML = "";
    statusEl.textContent = "";

    if (!data || data.length === 0) {
      statusEl.textContent = "No posts yet";
      return;
    }

    data.forEach(renderPost);
  }

  function renderPost(post) {
    const card = document.createElement("div");
    card.className = "post-card";

    let imagesHtml = "";
    if (post.images?.length) {
      imagesHtml = post.images
        .map(url => `<img src="${url}" />`)
        .join("");
    }

    card.innerHTML = `
      <div class="post-images">${imagesHtml}</div>
      <h4>${post.title}</h4>
      <div class="price">${post.price ?? ""}</div>
      <div class="hint">${post.type}</div>
    `;

    postsGrid.appendChild(card);
  }

  // -------------------------
  // MODAL CONTROL (UNCHANGED)
  // -------------------------
  fab?.addEventListener("click", () => {
    modal.classList.add("active");
  });

  btnCancel?.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // -------------------------
  // SAVE POST (FIXED)
  // -------------------------
  btnSave?.addEventListener("click", async () => {
    if (!window.currentUser) {
      alert("Sign in first");
      return;
    }

    const title = inputTitle.value.trim();
    if (!title) {
      alert("Title required");
      return;
    }

    // 🔥 HARD CLAMP TYPE
    const safeType =
      window.activePostType === "requesting"
        ? "requesting"
        : "selling";

    // Upload images (RESTORED)
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
      type: safeType,        // ✅ DB-safe
      status: "active",      // ✅ explicit
      user_id: window.currentUser.id
    };

    const { error } = await supa.from("posts").insert(payload);

    if (error) {
      alert("Error saving post: " + error.message);
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

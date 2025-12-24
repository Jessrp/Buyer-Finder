// posts.js — DEBUG VISIBILITY VERSION (SAFE)
// No UI changes. No feature changes. Adds logging only.

(() => {
  if (!window.supa) {
    alert("posts.js loaded but Supabase client is missing");
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

  // Expose API
  window.Posts = { loadPosts };

  // -------------------------
  // LOAD POSTS (CRITICAL)
  // -------------------------
  async function loadPosts() {
    console.log("DEBUG: loadPosts() CALLED");
    statusEl && (statusEl.textContent = "Loading posts…");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("DEBUG: Supabase response", { data, error });

    if (error) {
      alert("Supabase error loading posts:\n" + error.message);
      statusEl && (statusEl.textContent = "Error loading posts");
      return;
    }

    postsGrid.innerHTML = "";
    statusEl.textContent = "";

    if (!data || data.length === 0) {
      statusEl.textContent = "No posts found";
      console.log("DEBUG: No posts returned");
      return;
    }

    console.log("DEBUG: Rendering", data.length, "posts");
    data.forEach(renderPost);
  }

  function renderPost(post) {
    console.log("DEBUG: Rendering post", post.id);

    const card = document.createElement("div");
    card.className = "post-card";

    let imagesHtml = "";
    if (Array.isArray(post.images) && post.images.length) {
      imagesHtml = post.images
        .map(url => `<img src="${url}" />`)
        .join("");
    }

    card.innerHTML = `
      <div class="post-images">${imagesHtml}</div>
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
  // SAVE POST (UNCHANGED LOGIC)
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

    console.log("DEBUG: Saving post payload", payload);

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

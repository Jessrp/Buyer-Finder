// posts.js — stable posts grid + create/edit modal + detail panel + delete + search
// No UI injection. Only binds to existing DOM elements if they exist.

(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("posts.js: window.supa not found");
    return;
  }

  // -----------------------------
  // State
  // -----------------------------
  let viewMode = "all"; // 'all' | 'mine'
  let sortDir = "desc"; // 'asc' | 'desc'
  let editingPostId = null;
  let editingPostImages = []; // existing image URLs to keep on edit

  // Your UI uses "selling/requesting" language sometimes.
  // Your DB constraint uses "sell/request".
  // We'll normalize both directions safely.
  function normalizeUiType(uiType) {
    const t = (uiType || "").toString().toLowerCase();
    if (t === "request" || t === "requesting") return "request";
    if (t === "sell" || t === "selling") return "sell";
    return "sell";
  }

  function normalizeDbType(dbType) {
    const t = (dbType || "").toString().toLowerCase();
    if (t === "request" || t === "requesting") return "request";
    if (t === "sell" || t === "selling") return "sell";
    return "sell";
  }

  // Keep global flag consistent if other files depend on it
  window.activePostType = window.activePostType || "selling"; // UI label
  function getActiveDbType() {
    return normalizeUiType(window.activePostType); // -> sell/request
  }

  // -----------------------------
  // DOM
  // -----------------------------
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

  // Optional detail action buttons if you have them in HTML
  const detailEditBtn = document.getElementById("detail-edit-btn");
  const detailDeleteBtn = document.getElementById("detail-delete-btn");

  // Optional UI controls (bind only if present)
  const btnAllPosts = document.getElementById("btn-all-posts");
  const btnMyPosts = document.getElementById("btn-my-posts");
  const btnSelling = document.getElementById("btn-selling");
  const btnRequesting = document.getElementById("btn-requesting");
  const btnSortUp = document.getElementById("btn-sort-up");
  const btnSortDown = document.getElementById("btn-sort-down");

  const searchInput =
    document.getElementById("search-input") ||
    document.getElementById("posts-search") ||
    document.querySelector('input[type="search"]');

  const searchBtn =
    document.getElementById("search-btn") ||
    document.getElementById("btn-search") ||
    document.querySelector('button[data-action="search"]');

  // -----------------------------
  // Modal helpers
  // -----------------------------
  function openModalForCreate() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    editingPostId = null;
    editingPostImages = [];
    if (postTitle) postTitle.value = "";
    if (postDescription) postDescription.value = "";
    if (postPrice) postPrice.value = "";
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "";
    if (modalBackdrop) modalBackdrop.classList.add("active");
  }

  function openModalForEdit(post) {
    const user = window.currentUser;
    if (!user || user.id !== post.user_id) {
      alert("You can only edit your own posts.");
      return;
    }

    editingPostId = post.id;
    editingPostImages = extractImages(post);

    if (postTitle) postTitle.value = post.title || "";
    if (postDescription) postDescription.value = post.description || "";
    if (postPrice) postPrice.value = post.price ?? "";
    if (postImage) postImage.value = "";

    if (postModalHint) postModalHint.textContent = "Editing existing post";
    if (modalBackdrop) modalBackdrop.classList.add("active");
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.classList.remove("active");
  }

  // -----------------------------
  // Images
  // -----------------------------
  function extractImages(post) {
    // supports: image_urls as text[] array, JSON string, or legacy image_url
    if (!post) return [];
    const val = post.image_urls;

    if (Array.isArray(val)) {
      return val.filter(Boolean);
    }

    if (typeof val === "string" && val.trim()) {
      // could be JSON string of array
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (_) {
        // could be a single URL mistakenly stored
        if (val.startsWith("http")) return [val];
      }
    }

    if (post.image_url && typeof post.image_url === "string") {
      return [post.image_url];
    }

    return [];
  }

  async function uploadPostImages(files, userId) {
    if (!files || !files.length) return [];
    const urls = [];

    for (const file of files) {
      try {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `posts/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supa.storage
          .from("post_images")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          console.log("Upload error:", uploadError.message);
          continue;
        }

        const { data: urlData } = supa.storage.from("post_images").getPublicUrl(path);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      } catch (e) {
        console.log("uploadPostImages error:", e?.message || e);
      }
    }

    return urls;
  }

  // -----------------------------
  // Save (create / edit)
  // -----------------------------
  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;

    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }

    const title = (postTitle?.value || "").trim();
    if (!title) {
      alert("Title is required.");
      return;
    }

    const description = (postDescription?.value || "").trim();
    const priceRaw = (postPrice?.value || "").trim();
    const price = priceRaw === "" ? null : Number(priceRaw);

    const lat = profile && typeof profile.lat === "number" ? profile.lat : null;
    const lng = profile && typeof profile.lng === "number" ? profile.lng : null;
    const locationText = profile?.location_text || null;

    if (postModalHint) postModalHint.textContent = "Saving post...";

    // Upload new files if any
    const fileList = postImage?.files || [];
    const newImageUrls = fileList?.length ? await uploadPostImages(fileList, user.id) : [];

    // Merge with existing images if editing
    let finalImageUrls = editingPostImages.slice();
    if (newImageUrls.length) finalImageUrls = finalImageUrls.concat(newImageUrls);

    // IMPORTANT:
    // - Your DB expects type: 'sell' or 'request'
    // - Your DB may have image_urls as text[] (array) OR text (json string)
    const payload = {
      user_id: user.id,
      title,
      description,
      price,
      type: getActiveDbType(), // 'sell' | 'request'
      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng
    };

    // image_urls: prefer array (works for text[]). If column is text, Supabase will accept JSON string.
    if (finalImageUrls.length) {
      // send as array first (correct for text[])
      payload.image_urls = finalImageUrls;
    } else {
      payload.image_urls = null;
    }

    try {
      if (editingPostId) {
        const { error } = await supa
          .from("posts")
          .update(payload)
          .eq("id", editingPostId)
          .eq("user_id", user.id); // safety

        if (error) {
          // fallback: if image_urls column is text, array might error. Try JSON string.
          if ((error.message || "").toLowerCase().includes("array") || (error.message || "").toLowerCase().includes("malformed")) {
            const payload2 = { ...payload, image_urls: finalImageUrls.length ? JSON.stringify(finalImageUrls) : null };
            const { error: error2 } = await supa
              .from("posts")
              .update(payload2)
              .eq("id", editingPostId)
              .eq("user_id", user.id);
            if (error2) throw error2;
          } else {
            throw error;
          }
        }
      } else {
        const { data, error } = await supa
          .from("posts")
          .insert(payload)
          .select()
          .maybeSingle();

        if (error) {
          // same fallback
          if ((error.message || "").toLowerCase().includes("array") || (error.message || "").toLowerCase().includes("malformed")) {
            const payload2 = { ...payload, image_urls: finalImageUrls.length ? JSON.stringify(finalImageUrls) : null };
            const { data: data2, error: error2 } = await supa
              .from("posts")
              .insert(payload2)
              .select()
              .maybeSingle();
            if (error2) throw error2;
            if (data2) safeTryCreateMatchesForNewPost(data2);
          } else {
            throw error;
          }
        } else if (data) {
          safeTryCreateMatchesForNewPost(data);
        }
      }

      if (postModalHint) postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts(getSearchQuery());
      }, 250);
    } catch (err) {
      console.log("Insert/update error:", err?.message || err);
      if (postModalHint) postModalHint.textContent = "Error saving post: " + (err?.message || err);
    }
  }

  // -----------------------------
  // Delete
  // -----------------------------
  async function deletePost(post) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in first.");
      return;
    }
    if (!post || post.user_id !== user.id) {
      alert("You can only delete your own posts.");
      return;
    }

    const ok = confirm(`Delete "${post.title || "this post"}"? This cannot be undone.`);
    if (!ok) return;

    try {
      const { error } = await supa
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (error) throw error;

      hideDetailPanel();
      loadPosts(getSearchQuery());
    } catch (err) {
      console.log("deletePost error:", err?.message || err);
      alert("Delete failed: " + (err?.message || err));
    }
  }

  // -----------------------------
  // Load posts
  // -----------------------------
  function getSearchQuery() {
    return (searchInput?.value || "").trim();
  }

  async function loadPosts(query = "") {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser;
    const q = (query || "").trim();

    // build request
    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    // filter by type in DB terms ('sell' / 'request')
    const active = getActiveDbType();
    req = req.eq("type", active);

    if (q) {
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
    }

    let data = [];
    let error = null;

    try {
      const res = await req;
      data = res?.data || [];
      error = res?.error || null;
    } catch (e) {
      error = e;
    }

    if (error) {
      console.log("load posts error:", error?.message || error);
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    if (!data.length) {
      postsStatus.textContent = "No posts yet.";
      postsGrid.innerHTML = `<p class="hint">No posts yet in this category.</p>`;
      return;
    }

    postsStatus.textContent = "";

    const currentUser = window.currentUser;

    postsGrid.innerHTML = data
      .map((p) => {
        const imgs = extractImages(p);
        const primaryImage = imgs.length ? imgs[0] : null;

        const priceText = p.price != null && p.price !== "" ? `$${p.price}` : "";
        const metaBits = [];
        if (p.location_text) metaBits.push(p.location_text);

        const metaLine = metaBits.length ? `<small class="hint">${metaBits.join(" • ")}</small>` : "";
        const imgHtml = primaryImage ? `<img src="${primaryImage}" alt="Post image" />` : "";

        const isMine = currentUser?.id && p.user_id === currentUser.id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${isMine ? `<button class="edit-btn" data-action="edit" title="Edit">✎</button>` : ""}
            ${isMine ? `<button class="delete-btn" data-action="delete" title="Delete">🗑</button>` : ""}
            ${imgHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <h3>${p.title || "Untitled"}</h3>
            </div>
            <p>${p.description || ""}</p>
            ${metaLine}
            <small>${priceText}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(data);
  }

  function attachPostHandlers(posts) {
    if (!postsGrid) return;

    const cards = postsGrid.querySelectorAll(".post[data-post-id]");
    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      // Card click opens details (unless clicking buttons)
      card.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button");
        if (btn) return;
        openDetailPanel(post);
      });

      // Edit button
      const editBtn = card.querySelector('button[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        });
      }

      // Delete button
      const delBtn = card.querySelector('button[data-action="delete"]');
      if (delBtn) {
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deletePost(post);
        });
      }
    });
  }

  // -----------------------------
  // Detail panel
  // -----------------------------
  function showDetailPanel() {
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  async function openDetailPanel(post) {
    if (!detailPanel) return;

    // Re-fetch full post
    let fullPost = post;
    try {
      const { data, error } = await supa
        .from("posts")
        .select("*")
        .eq("id", post.id)
        .maybeSingle();
      if (!error && data) fullPost = data;
    } catch (_) {}

    // Seller profile (optional)
    let profile = null;
    try {
      const { data } = await supa
        .from("profiles")
        .select("username,email,avatar_url,lat,lng,location_text,premium")
        .eq("id", fullPost.user_id)
        .maybeSingle();
      profile = data || null;
    } catch (_) {}

    // Images
    if (detailImages) detailImages.innerHTML = "";
    const imgs = extractImages(fullPost);
    if (detailImages && imgs.length) {
      imgs.forEach((url, idx) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Post image " + (idx + 1);
        detailImages.appendChild(img);
      });
    }

    // Text
    if (detailTitle) detailTitle.textContent = fullPost.title || "Untitled";
    if (detailPrice) detailPrice.textContent = fullPost.price != null && fullPost.price !== "" ? `$${fullPost.price}` : "";
    if (detailDescription) detailDescription.textContent = fullPost.description || "";

    // Meta
    const t = normalizeDbType(fullPost.type) === "request" ? "Request" : "Selling";
    if (detailMeta) detailMeta.textContent = t;

    // Seller card
    if (detailSellerAvatar) {
      detailSellerAvatar.innerHTML = "";
      const av = document.createElement("div");
      av.className = "user-avatar small";
      const img = document.createElement("img");
      img.src =
        profile?.avatar_url ||
        "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
          );
      av.appendChild(img);
      detailSellerAvatar.appendChild(av);
    }

    if (detailSellerName) detailSellerName.textContent = profile?.username || "Seller";
    if (detailSellerEmail) detailSellerEmail.textContent = profile?.email || "";

    // Location / minimap (premium viewer only)
    const locText = fullPost.location_text || profile?.location_text || "";
    if (detailLocationText) detailLocationText.textContent = locText || "Location not specified.";

    const viewerProfile = window.currentProfile;
    const isViewerPremium = !!viewerProfile?.premium;

    const lat = typeof fullPost.lat === "number" ? fullPost.lat : (typeof profile?.lat === "number" ? profile.lat : null);
    const lng = typeof fullPost.lng === "number" ? fullPost.lng : (typeof profile?.lng === "number" ? profile.lng : null);

    if (
      detailMinimapContainer &&
      isViewerPremium &&
      typeof lat === "number" &&
      typeof lng === "number" &&
      window.BFMap &&
      typeof window.BFMap.renderMiniMap === "function"
    ) {
      detailMinimapContainer.style.display = "block";
      window.BFMap.renderMiniMap(lat, lng);
    } else if (detailMinimapContainer) {
      detailMinimapContainer.style.display = "none";
    }

    // Message button
    if (detailMessageBtn) {
      detailMessageBtn.onclick = () => handleSendMessage(fullPost, profile);
    }

    // Optional detail edit/delete buttons if present in HTML
    const isMine = window.currentUser?.id && fullPost.user_id === window.currentUser.id;

    if (detailEditBtn) {
      detailEditBtn.style.display = isMine ? "" : "none";
      detailEditBtn.onclick = () => openModalForEdit(fullPost);
    }

    if (detailDeleteBtn) {
      detailDeleteBtn.style.display = isMine ? "" : "none";
      detailDeleteBtn.onclick = () => deletePost(fullPost);
    }

    showDetailPanel();
  }

  detailCloseBtn?.addEventListener("click",

// posts.js — posts grid, modal (create/edit), detail panel, search, delete/edit
// Goal: posts MUST load for guests. Auth only affects create/edit/delete UI.
(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("posts.js: window.supa missing");
    return;
  }

  // --------- STATE ----------
  let viewMode = "all"; // 'all' | 'mine'
  let sortDir = "desc"; // 'asc' | 'desc'
  let editingPostId = null;
  let editingPostImages = [];

  // Active tab/type used by the app. We'll support both old/new naming.
  window.activePostType = window.activePostType || "selling"; // selling/requesting OR sell/request

  // --------- DOM ----------
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

  // Search bar (top)
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  // Bottom nav (we wire these here so they work even if app.js is being dramatic)
  const navSelling = document.getElementById("nav-selling");
  const navRequests = document.getElementById("nav-requests");

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

  // We inject owner controls here (Edit/Delete) without changing your HTML file
  let ownerControlsEl = null;

  // Matches/notifications lists (safe optional)
  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  // --------- HELPERS ----------
  function normalizeType(t) {
    const s = (t || "").toString().toLowerCase().trim();
    if (s === "sell" || s === "selling") return "sell";
    if (s === "request" || s === "requesting") return "request";
    // default to sell to keep UI stable
    return "sell";
  }

  function activeType() {
    return normalizeType(window.activePostType);
  }

  function moneyText(v) {
    if (v === null || v === undefined || v === "") return "";
    return `$${v}`;
  }

  // Handles: text[] array, JSON string, single url string, postgres array literal "{...}"
  function parseImageUrls(image_urls, image_url) {
    // Already an array (text[])
    if (Array.isArray(image_urls)) return image_urls.filter(Boolean);

    // JSON string?
    if (typeof image_urls === "string" && image_urls.trim()) {
      const raw = image_urls.trim();

      // Postgres array literal: {"a","b"}
      if (raw.startsWith("{") && raw.endsWith("}")) {
        // Extremely simple parser for URLs, not for arbitrary values
        // Removes braces, splits on "," not inside quotes (URLs won't contain commas usually)
        const inner = raw.slice(1, -1).trim();
        if (!inner) return [];
        return inner
          .split(",")
          .map((x) => x.trim().replace(/^"+|"+$/g, ""))
          .filter(Boolean);
      }

      // JSON array: ["..."]
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return arr.filter(Boolean);
        } catch (_) {}
      }

      // Single URL string
      if (raw.startsWith("http")) return [raw];
    }

    // Legacy single column
    if (typeof image_url === "string" && image_url.trim()) return [image_url.trim()];

    return [];
  }

  function showDetailPanel() {
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  function ensureOwnerControls() {
    if (!detailPanel) return null;
    if (ownerControlsEl) return ownerControlsEl;

    ownerControlsEl = document.createElement("div");
    ownerControlsEl.style.display = "none";
    ownerControlsEl.style.gap = "8px";
    ownerControlsEl.style.margin = "10px 0";
    ownerControlsEl.style.justifyContent = "flex-end";
    ownerControlsEl.style.alignItems = "center";
    ownerControlsEl.style.display = "none";
    ownerControlsEl.style.display = "flex";

    const editBtn = document.createElement("button");
    editBtn.className = "btn small outline";
    editBtn.textContent = "Edit";

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Delete";

    ownerControlsEl.appendChild(editBtn);
    ownerControlsEl.appendChild(delBtn);

    // Insert controls near the top of panel (under images)
    const afterNode = detailImages || detailPanel.firstChild;
    if (afterNode && afterNode.parentNode) {
      afterNode.parentNode.insertBefore(ownerControlsEl, afterNode.nextSibling);
    } else {
      detailPanel.appendChild(ownerControlsEl);
    }

    ownerControlsEl._editBtn = editBtn;
    ownerControlsEl._delBtn = delBtn;
    return ownerControlsEl;
  }

  // --------- MODAL ----------
  function openModalForCreate() {
    const user = window.currentUser;
    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }
    editingPostId = null;
    editingPostImages = [];
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "";
    modalBackdrop?.classList.add("active");
  }

  function openModalForEdit(post) {
    const user = window.currentUser;
    if (!user || user.id !== post.user_id) {
      alert("You can only edit your own posts.");
      return;
    }

    editingPostId = post.id;
    editingPostImages = parseImageUrls(post.image_urls, post.image_url);

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price ?? "";
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "Editing existing post";
    modalBackdrop?.classList.add("active");
  }

  function closeModal() {
    modalBackdrop?.classList.remove("active");
  }

  // --------- IMAGE UPLOAD ----------
  async function uploadPostImages(files, userId) {
    if (!files || !files.length) return [];
    const urls = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
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
    }

    return urls;
  }

  // Try insert/update with image_urls as array first (matches text[] schema).
  // If schema is text, fallback to JSON string.
  async function upsertPost(payload, isUpdate) {
    // Attempt 1: image_urls as array (if present)
    let try1 = { ...payload };
    if (try1.image_urls && !Array.isArray(try1.image_urls)) {
      // if someone passed JSON string, try parse
      try {
        const arr = JSON.parse(try1.image_urls);
        if (Array.isArray(arr)) try1.image_urls = arr;
      } catch (_) {}
    }

    const req1 = isUpdate
      ? supa.from("posts").update(try1).eq("id", editingPostId)
      : supa.from("posts").insert(try1).select().maybeSingle();

    const res1 = await req1;
    if (!res1.error) return res1;

    const msg = (res1.error.message || "").toLowerCase();

    // Fallback: store as JSON string if DB wants text
    // (If DB is text[], the error is usually "malformed array literal" when you send a string.
    // We are doing the opposite fallback here: if DB rejects array as text[]/json mismatch.)
    let try2 = { ...payload };
    if (Array.isArray(try2.image_urls)) {
      try2.image_urls = try2.image_urls.length ? JSON.stringify(try2.image_urls) : null;
    }

    // Only fallback if it seems type-related
    if (msg.includes("text") || msg.includes("array") || msg.includes("malformed") || msg.includes("type")) {
      const req2 = isUpdate
        ? supa.from("posts").update(try2).eq("id", editingPostId)
        : supa.from("posts").insert(try2).select().maybeSingle();

      const res2 = await req2;
      if (!res2.error) return res2;
    }

    // Give the original error back
    return res1;
  }

  // --------- SAVE POST ----------
  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;

    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }

    const title = postTitle.value.trim();
    if (!title) {
      alert("Title is required.");
      return;
    }

    const description = postDescription.value.trim();
    const priceRaw = postPrice.value.trim();

    const lat = profile && typeof profile.lat === "number" ? profile.lat : null;
    const lng = profile && typeof profile.lng === "number" ? profile.lng : null;
    const locationText = (profile && profile.location_text) || null;

    if (postModalHint) postModalHint.textContent = "Saving post...";

    const fileList = postImage?.files || [];
    let newImageUrls = [];
    if (fileList && fileList.length) {
      newImageUrls = await uploadPostImages(fileList, user.id);
    }

    let finalImageUrls = editingPostImages.slice();
    if (newImageUrls.length) finalImageUrls = finalImageUrls.concat(newImageUrls);

    // IMPORTANT: Your DB constraint expects 'sell' or 'request'
    const t = activeType();

    const payload = {
      user_id: user.id,
      title,
      description,
      price: priceRaw ? priceRaw : null,
      type: t, // 'sell' | 'request'
      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng,
      // Prefer array for text[] schema
      image_urls: finalImageUrls.length ? finalImageUrls : null,
    };

    try {
      const isUpdate = !!editingPostId;
      const res = await upsertPost(payload, isUpdate);

      if (res.error) throw res.error;

      if (postModalHint) postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts(searchInput?.value || "");
      }, 350);
    } catch (err) {
      console.log("Insert/update error:", err?.message || err);
      if (postModalHint) postModalHint.textContent = "Error saving post: " + (err?.message || err);
    }
  }

  // --------- LOAD POSTS ----------
  async function loadPosts(query = "") {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser || null;
    const q = (query || "").trim();

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    // Only apply "mine" filter when signed in
    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    // Search works for guests too
    if (q) {
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
    }

    let data = [];
    let error = null;

    try {
      const res = await req;
      data = res.data || [];
      error = res.error || null;
    } catch (e) {
      error = e;
    }

    if (error) {
      console.log("load posts error:", error.message || error);
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    if (!data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
      postsGrid.innerHTML = "<p class='hint'>No posts yet in this category.</p>";
      return;
    }

    // Filter by active type
    const at = activeType(); // 'sell' | 'request'
    const filtered = data.filter((p) => normalizeType(p.type) === at);

    if (!filtered.length) {
      postsStatus.textContent = "";
      postsGrid.innerHTML = "<p class='hint'>No posts in this category yet.</p>";
      return;
    }

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map((p) => {
        const imgs = parseImageUrls(p.image_urls, p.image_url);
        const primaryImage = imgs.length ? imgs[0] : null;

        const metaBits = [];
        if (p.location_text) metaBits.push(p.location_text);

        const metaLine = metaBits.length
          ? `<small class="hint">${metaBits.join(" • ")}</small>`
          : "";

        const imgHtml = primaryImage ? `<img src="${primaryImage}" alt="Post image" />` : "";

        const currentUser = window.currentUser;
        const showEdit = currentUser?.id && p.user_id === currentUser.id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${showEdit ? `<button class="edit-btn" data-edit-id="${p.id}" title="Edit">✎</button>` : ""}
            ${imgHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <h3>${p.title || "Untitled"}</h3>
            </div>
            <p>${p.description || ""}</p>
            ${metaLine}
            <small>${p.price ? moneyText(p.price) : ""}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(filtered);
  }

  function attachPostHandlers(posts) {
    if (!postsGrid) return;

    const cards = postsGrid.querySelectorAll(".post[data-post-id]");
    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id"); // UUID string
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      // Card click → detail
      card.addEventListener("click", () => openDetailPanel(post));

      // Edit button
      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        });
      }
    });
  }

  // --------- DETAIL PANEL ----------
  async function openDetailPanel(post) {
    if (!detailPanel) return;

    // Re-fetch the post (optional)
    let fullPost = post;
    try {
      const { data, error } = await supa.from("posts").select("*").eq("id", post.id).maybeSingle();
      if (!error && data) fullPost = data;
    } catch (_) {}

    // Seller profile (optional)
    let profile = null;
    try {
      const { data } = await supa
        .from("profiles")
        .select("id,username,email,avatar_url,lat,lng,location_text,premium")
        .eq("id", fullPost.user_id)
        .maybeSingle();
      profile = data || null;
    } catch (_) {}

    // Images
    if (detailImages) {
      detailImages.innerHTML = "";
      const imgs = parseImageUrls(fullPost.image_urls, fullPost.image_url);
      imgs.forEach((url, idx) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Post image " + (idx + 1);
        detailImages.appendChild(img);
      });
    }

    // Text
    if (detailTitle) detailTitle.textContent = fullPost.title || "Untitled";
    if (detailPrice) detailPrice.textContent = fullPost.price ? moneyText(fullPost.price) : "";
    if (detailDescription) detailDescription.textContent = fullPost.description || "";

    if (detailMeta) {
      const t = normalizeType(fullPost.type) === "request" ? "Request" : "Selling";
      detailMeta.textContent = t;
    }

    // Seller avatar
    if (detailSellerAvatar) {
      detailSellerAvatar.innerHTML = "";
      const avWrap = document.createElement("div");
      avWrap.className = "user-avatar small";
      const img = document.createElement("img");
      img.src =
        profile?.avatar_url ||
        "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
          );
      avWrap.appendChild(img);
      detailSellerAvatar.appendChild(avWrap);
    }

    if (detailSellerName) detailSellerName.textContent = profile?.username || "Seller";
    if (detailSellerEmail) detailSellerEmail.textContent = profile?.email || "";

    const locText = fullPost.location_text || profile?.location_text || "";
    if (detailLocationText) detailLocationText.textContent = locText || "Location not specified.";

    // Mini-map is premium gated
    const viewerProfile = window.currentProfile;
    const isViewerPremium = !!viewerProfile?.premium;
    const lat = fullPost.lat ?? profile?.lat ?? null;
    const lng = fullPost.lng ?? profile?.lng ?? null;

    if (
      isViewerPremium &&
      typeof lat === "number" &&
      typeof lng === "number" &&
      window.BFMap &&
      typeof window.BFMap.renderMiniMap === "function"
    ) {
      if (detailMinimapContainer) detailMinimapContainer.style.display = "block";
      window.BFMap.renderMiniMap(lat, lng);
    } else {
      if (detailMinimapContainer) detailMinimapContainer.style.display = "none";
    }

    // Message button
    if (detailMessageBtn) {
      detailMessageBtn.onclick = () => handleSendMessage(fullPost, profile);
    }

    // Owner controls (Edit/Delete) only for the post owner
    const user = window.currentUser;
    const isOwner = !!user?.id && String(user.id) === String(fullPost.user_id);
    const controls = ensureOwnerControls();

    if (controls) {
      controls.style.display = isOwner ? "flex" : "none";

      if (isOwner) {
        controls._editBtn.onclick = () => {
          hideDetailPanel();
          openModalForEdit(fullPost);
        };

        controls._delBtn.onclick = async () => {
          const ok = confirm("Delete this post permanently?");
          if (!ok) return;

          try {
            const { error } = await supa.from("posts").delete().eq("id", fullPost.id);
            if (error) throw error;

            hideDetailPanel();
            await loadPosts(searchInput?.value || "");
          } catch (err) {
            console.log("delete error:", err?.message || err);
            alert("Delete failed: " + (err?.message || err));
          }
        };
      }
    }

    showDetailPanel();
  }

  detailCloseBtn?.addEventListener("click", hideDetailPanel);
  detailOverlay?.addEventListener("click", hideDetailPanel);

  // --------- SEND MESSAGE ----------
  async function handleSendMessage(post, profile) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in to send a message.");
      return;
    }
    if (!profile || !profile.

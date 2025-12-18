// posts.js — posts grid, modal (create/edit), detail panel, search, delete/edit, messaging
// Goal: posts MUST load for guests. Auth only affects create/edit/delete UI.

(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("posts.js: window.supa missing");
    return;
  }

  // ---------- STATE ----------
  let sortDir = "desc"; // 'asc' | 'desc'
  let viewMode = "all"; // 'all' | 'mine'
  let editingPostId = null;
  let editingPostImages = [];

  // App-wide type flag (supports old/new naming)
  window.activePostType = window.activePostType || "selling";

  // ---------- DOM ----------
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

  const searchInput = document.getElementById("search-input");

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

  // Optional
  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  // Owner controls injected into detail panel
  let ownerControlsEl = null;

  // ---------- HELPERS ----------
  function normalizeType(val) {
    const s = (val || "").toString().toLowerCase().trim();
    if (s === "request" || s === "requesting") return "request";
    if (s === "sell" || s === "selling") return "sell";
    return "sell";
  }

  function getActiveType() {
    return normalizeType(window.activePostType);
  }

  function moneyText(v) {
    if (v === null || v === undefined || v === "") return "";
    return `$${v}`;
  }

  // Handles: text[] array, JSON string, postgres array literal, single url
  function parseImageUrls(image_urls, image_url) {
    if (Array.isArray(image_urls)) return image_urls.filter(Boolean);

    if (typeof image_urls === "string" && image_urls.trim()) {
      const raw = image_urls.trim();

      if (raw.startsWith("{") && raw.endsWith("}")) {
        const inner = raw.slice(1, -1).trim();
        if (!inner) return [];
        return inner
          .split(",")
          .map((x) => x.trim().replace(/^"+|"+$/g, ""))
          .filter(Boolean);
      }

      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return arr.filter(Boolean);
        } catch (_) {}
      }

      if (raw.startsWith("http")) return [raw];
    }

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

  function openModalForCreate() {
    const user = window.currentUser;
    if (!user) {
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
    modalBackdrop?.classList.add("active");
  }

  function openModalForEdit(post) {
    const user = window.currentUser;
    if (!user || String(user.id) !== String(post.user_id)) {
      alert("You can only edit your own posts.");
      return;
    }

    editingPostId = post.id;
    editingPostImages = parseImageUrls(post.image_urls, post.image_url);

    if (postTitle) postTitle.value = post.title || "";
    if (postDescription) postDescription.value = post.description || "";
    if (postPrice) postPrice.value = post.price ?? "";
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "Editing existing post";
    modalBackdrop?.classList.add("active");
  }

  function closeModal() {
    modalBackdrop?.classList.remove("active");
  }

  function ensureOwnerControls() {
    if (!detailPanel) return null;
    if (ownerControlsEl) return ownerControlsEl;

    ownerControlsEl = document.createElement("div");
    ownerControlsEl.style.display = "flex";
    ownerControlsEl.style.gap = "8px";
    ownerControlsEl.style.margin = "10px 0";
    ownerControlsEl.style.justifyContent = "flex-end";

    const editBtn = document.createElement("button");
    editBtn.className = "btn small outline";
    editBtn.textContent = "Edit";

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Delete";

    ownerControlsEl.appendChild(editBtn);
    ownerControlsEl.appendChild(delBtn);

    // Insert right under images
    const anchor = detailImages || detailPanel.firstChild;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(ownerControlsEl, anchor.nextSibling);
    else detailPanel.appendChild(ownerControlsEl);

    ownerControlsEl._editBtn = editBtn;
    ownerControlsEl._delBtn = delBtn;

    return ownerControlsEl;
  }

  // ---------- IMAGE UPLOAD ----------
  async function uploadPostImages(files, userId) {
    if (!files || !files.length) return [];
    const urls = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supa.storage.from("post_images").upload(path, file, { upsert: true });
      if (uploadError) {
        console.log("Upload error:", uploadError.message);
        continue;
      }

      const { data: urlData } = supa.storage.from("post_images").getPublicUrl(path);
      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }

    return urls;
  }

  // Insert/update with image_urls array first; fallback to JSON string if DB expects text
  async function upsertPost(payload, isUpdate) {
    const res1 = isUpdate
      ? await supa.from("posts").update(payload).eq("id", editingPostId)
      : await supa.from("posts").insert(payload).select().maybeSingle();

    if (!res1.error) return res1;

    // fallback if image_urls array isn't accepted
    const msg = (res1.error.message || "").toLowerCase();
    if (msg.includes("array") || msg.includes("malformed") || msg.includes("type") || msg.includes("text")) {
      const payload2 = { ...payload };
      if (Array.isArray(payload2.image_urls)) {
        payload2.image_urls = payload2.image_urls.length ? JSON.stringify(payload2.image_urls) : null;
      }
      const res2 = isUpdate
        ? await supa.from("posts").update(payload2).eq("id", editingPostId)
        : await supa.from("posts").insert(payload2).select().maybeSingle();

      if (!res2.error) return res2;
    }

    return res1;
  }

  // ---------- SAVE POST (CREATE / EDIT) ----------
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
    const price = (postPrice?.value || "").trim();

    const lat = profile && typeof profile.lat === "number" ? profile.lat : null;
    const lng = profile && typeof profile.lng === "number" ? profile.lng : null;
    const locationText = (profile && profile.location_text) || null;

    if (postModalHint) postModalHint.textContent = "Saving post...";

    const fileList = postImage?.files || [];
    let newImageUrls = [];
    if (fileList && fileList.length) newImageUrls = await uploadPostImages(fileList, user.id);

    let finalImageUrls = editingPostImages.slice();
    if (newImageUrls.length) finalImageUrls = finalImageUrls.concat(newImageUrls);

    const payload = {
      user_id: user.id,
      title,
      description,
      price: price || null,
      type: getActiveType(), // 'sell' | 'request'
      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng,
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
      }, 300);
    } catch (err) {
      console.log("savePost error:", err?.message || err);
      if (postModalHint) postModalHint.textContent = "Error saving post: " + (err?.message || err);
    }
  }

  // ---------- LOAD POSTS ----------
  async function loadPosts(query = "") {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const q = (query || "").trim();
    const user = window.currentUser || null;

    let req = supa.from("posts").select("*").order("created_at", { ascending: sortDir === "asc" });

    // "mine" only applies when signed in
    if (viewMode === "mine" && user?.id) req = req.eq("user_id", user.id);

    if (q) req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);

    const { data, error } = await req;
    if (error) {
      console.log("loadPosts error:", error.message);
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    if (!data || !data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
      postsGrid.innerHTML = "<p class='hint'>No posts yet in this category.</p>";
      return;
    }

    const at = getActiveType();
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
        const primaryImage = imgs[0] || null;

        const currentUser = window.currentUser;
        const showEdit = currentUser?.id && String(p.user_id) === String(currentUser.id);

        const imgHtml = primaryImage ? `<img src="${primaryImage}" alt="Post image" />` : "";

        return `
          <article class="post" data-post-id="${p.id}">
            ${showEdit ? `<button class="edit-btn" title="Edit">✎</button>` : ""}
            ${imgHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <h3>${p.title || "Untitled"}</h3>
            </div>
            <p>${p.description || ""}</p>
            <small>${p.price ? moneyText(p.price) : ""}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(filtered);
  }

  function attachPostHandlers(posts) {
    const cards = postsGrid?.querySelectorAll(".post[data-post-id]") || [];
    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      card.addEventListener("click", () => openDetailPanel(post));

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        });
      }
    });
  }

  // ---------- DETAIL PANEL ----------
  async function openDetailPanel(post) {
    if (!detailPanel) return;

    // refetch full post (safe)
    let fullPost = post;
    try {
      const { data } = await supa.from("posts").select("*").eq("id", post.id).maybeSingle();
      if (data) fullPost = data;
    } catch (_) {}

    // seller profile
    let profile = null;
    try {
      const { data } = await supa
        .from("profiles")
        .select("id,username,email,avatar_url,lat,lng,location_text,premium")
        .eq("id", fullPost.user_id)
        .maybeSingle();
      profile = data || null;
    } catch (_) {}

    // images
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

    if (detailTitle) detailTitle.textContent = fullPost.title || "Untitled";
    if (detailPrice) detailPrice.textContent = fullPost.price ? moneyText(fullPost.price) : "";
    if (detailDescription) detailDescription.textContent = fullPost.description || "";
    if (detailMeta) detailMeta.textContent = normalizeType(fullPost.type) === "request" ? "Request" : "Selling";

    if (detailSellerAvatar) {
      detailSellerAvatar.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "user-avatar small";
      const img = document.createElement("img");
      img.src =
        profile?.avatar_url ||
        "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
          );
      wrap.appendChild(img);
      detailSellerAvatar.appendChild(wrap);
    }

    if (detailSellerName) detailSellerName.textContent = profile?.username || "Seller";
    if (detailSellerEmail) detailSellerEmail.textContent = profile?.email || "";
    if (detailLocationText) detailLocationText.textContent = fullPost.location_text || profile?.location_text || "";

    // premium minimap (optional)
    const isViewerPremium = !!window.currentProfile?.premium;
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

    // message
    if (detailMessageBtn) detailMessageBtn.onclick = () => handleSendMessage(fullPost, profile);

    // owner controls
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

          const { error } = await supa.from("posts").delete().eq("id", fullPost.id);
          if (error) {
            alert("Delete failed: " + error.message);
            return;
          }

          hideDetailPanel();
          loadPosts(searchInput?.value || "");
        };
      }
    }

    showDetailPanel();
  }

  // ---------- SEND MESSAGE ----------
  async function handleSendMessage(post, profile) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in to send a message.");
      return;
    }

    // If you don't want exposing seller emails, you can remove this requirement.
    if (!profile || !profile.id) {
      alert("Seller profile not available yet.");
      return;
    }

    const body = prompt("Your message to the seller:");
    if (!body || !body.trim()) return;

    try {
      const { error } = await supa.from("messages").insert({
        post_id: post.id,
        from_user: user.id,
        to_user: post.user_id,
        body: body.trim(),
      });
      if (error) throw error;
      alert("Message saved.");
    } catch (err) {
      console.log("message insert error:", err?.message || err);
      alert("Messages table not ready (or blocked).");
    }
  }

  // ---------- MATCHES/NOTIFS (safe placeholders) ----------
  async function loadMatches() {
    if (!matchesList) return;
    if (!window.currentUser) {
      matchesList.innerHTML = "<p class='hint'>Sign in to see matches.</p>";
      return;
    }
    try {
      const { data, error } = await supa
        .from("matches")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      matchesList.innerHTML = (data || []).length
        ? data.map((m) => `<div class="list-item"><strong>${m.title || "Match"}</strong><small>${m.message || ""}</small></div>`).join("")
        : "<p class='hint'>No matches yet.</p>";
    } catch (_) {
      matchesList.innerHTML = "<p class='hint'>Matches not configured yet.</p>";
    }
  }

  async function loadNotifications() {
    if (!notificationsList) return;
    if (!window.currentUser) {
      notificationsList.innerHTML = "<p class='hint'>Sign in to see alerts.</p>";
      return;
    }
    try {
      const { data, error } = await supa
        .from("notifications")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      notificationsList.innerHTML = (data || []).length
        ? data.map((n) => `<div class="list-item"><strong>${n.title || n.type || "Notification"}</strong><small>${n.message || ""}</small></div>`).join("")
        : "<p class='hint'>No notifications yet.</p>";
    } catch (_) {
      notificationsList.innerHTML = "<p class='hint'>Notifications not configured yet.</p>";
    }
  }

  async function recordSearchQuery(q) {
    if (!q || !q.trim()) return;
    if (!window.currentUser) return;
    try {
      await supa.from("search_queries").insert({ user_id: window.currentUser.id, last_query: q.trim() });
    } catch (_) {}
  }

  // ---------- WIRES ----------
  fabAdd?.addEventListener("click", openModalForCreate);
  btnCancelPost?.addEventListener("click", closeModal);
  btnSavePost?.addEventListener("click", savePost);

  detailCloseBtn?.addEventListener("click", hideDetailPanel);
  detailOverlay?.addEventListener("click", hideDetailPanel);

  // ---------- EXPORT ----------
  window.Posts = {
    loadPosts,
    loadMatches,
    loadNotifications,
    recordSearchQuery,
  };

  // Initial load (guest-friendly)
  loadPosts();
})();

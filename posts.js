// posts.js – posts grid, modal (create/edit), detail panel, search, matches hooks + BF+ enforcement + delete

let viewMode = "all"; // 'all' | 'mine'
let sortDir = "desc"; // 'asc' | 'desc'

(function () {
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

  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  // Canonical post types in your DB/app
  window.activePostType = window.activePostType || "selling"; // 'selling' | 'requesting'

  // Canonical BF+ check (single source of truth)
  window.isPremiumUser = function () {
    return !!window.currentProfile?.premium;
  };

  let editingPostId = null;
  let editingPostImages = []; // keep existing URLs on edit

  /* -------------------- PROFILE HELPERS (BF+ truth) -------------------- */

  async function ensureCurrentProfileFresh() {
    const user = window.currentUser;
    if (!user?.id) return null;

    // If already loaded and has premium field, trust it
    if (window.currentProfile && typeof window.currentProfile.premium === "boolean") {
      return window.currentProfile;
    }

    try {
      const { data, error } = await supa
        .from("profiles")
        .select("id, username, email, avatar_url, lat, lng, location_text, premium")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data) {
        window.currentProfile = data;
        return data;
      }
    } catch (_) {}

    return window.currentProfile || null;
  }

  /* -------------------- MODAL -------------------- */

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
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function openModalForEdit(post) {
    if (!window.currentUser || window.currentUser.id !== post.user_id) {
      alert("You can only edit your own posts.");
      return;
    }
    editingPostId = post.id;
    editingPostImages = [];

    if (post.image_urls) {
      try {
        const arr = JSON.parse(post.image_urls);
        if (Array.isArray(arr)) editingPostImages = arr;
      } catch (_) {}
    }

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    if (postImage) postImage.value = "";
    if (postModalHint) postModalHint.textContent = "Editing existing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  /* -------------------- IMAGE UPLOAD -------------------- */

  async function uploadPostImages(files, userId) {
    if (!files || !files.length) return [];
    const urls = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

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

  /* -------------------- SAVE POST (CREATE / EDIT) -------------------- */

  async function savePost() {
    const user = window.currentUser;
    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }

    await ensureCurrentProfileFresh();
    const profile = window.currentProfile;

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

    const payload = {
      user_id: user.id,
      title,
      description,
      price: priceRaw || null,
      type: window.activePostType || "selling", // MUST match DB constraint
      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng,
      image_urls: finalImageUrls.length ? JSON.stringify(finalImageUrls) : null,
    };

    try {
      if (editingPostId) {
        const { error } = await supa.from("posts").update(payload).eq("id", editingPostId);
        if (error) throw error;
      } else {
        const { data, error } = await supa.from("posts").insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data) tryCreateMatchesForNewPost(data);
      }

      if (postModalHint) postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts();
      }, 250);
    } catch (err) {
      console.log("Insert/update error:", err.message || err);
      if (postModalHint) postModalHint.textContent = "Error saving post: " + (err.message || err);
    }
  }

  /* -------------------- LOAD POSTS -------------------- */

  async function loadPosts(query) {
    if (!postsGrid || !postsStatus) return;

    await ensureCurrentProfileFresh();

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser;

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    // My Posts mode (if/when you wire the UI toggle later)
    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
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
      postsStatus.textContent = "Error loading posts. Check Supabase config.";
      return;
    }

    if (!data || !data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
      postsGrid.innerHTML = "<p class='hint'>No posts yet in this category.</p>";
      return;
    }

    // IMPORTANT: exact matching of your canonical types
    const filtered = data.filter((p) => {
      const t = (p.type || "").toString().toLowerCase();
      return t === window.activePostType;
    });

    if (!filtered.length) {
      postsGrid.innerHTML = "<p class='hint'>No posts in this category yet.</p>";
      postsStatus.textContent = "";
      return;
    }

    postsStatus.textContent = "";

    const currentUser = window.currentUser;

    postsGrid.innerHTML = filtered
      .map((p) => {
        let priceText = p.price ? `$${p.price}` : "";
        let primaryImage = null;

        if (p.image_urls) {
          try {
            const arr = JSON.parse(p.image_urls);
            if (Array.isArray(arr) && arr.length) primaryImage = arr[0];
          } catch (e) {
            console.log("image_urls parse error:", e);
          }
        }

        const metaBits = [];
        if (p.location_text) metaBits.push(p.location_text);

        const metaLine = metaBits.length
          ? `<small class="hint">${metaBits.join(" • ")}</small>`
          : "";

        const imgHtml = primaryImage ? `<img src="${primaryImage}" alt="Post image" />` : "";

        const isOwner = currentUser && currentUser.id && p.user_id === currentUser.id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${
              isOwner
                ? `
                <div class="post-owner-actions">
                  <button class="edit-btn" title="Edit">✎</button>
                  <button class="delete-btn" title="Delete">🗑</button>
                </div>
              `
                : ""
            }
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

    attachPostHandlers(filtered);
  }

  function attachPostHandlers(posts) {
    const cards = postsGrid.querySelectorAll(".post[data-post-id]");

    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      // Card click → open detail
      card.addEventListener("click", () => {
        openDetailPanel(post);
      });

      // Edit
      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        });
      }

      // Delete (owner-only button is only rendered for owners)
      const deleteBtn = card.querySelector(".delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const ok = confirm("Delete this post permanently?");
          if (!ok) return;

          const { error } = await supa.from("posts").delete().eq("id", post.id);
          if (error) {
            alert("Delete failed: " + error.message);
            return;
          }
          loadPosts();
        });
      }
    });
  }

  /* -------------------- DETAIL PANEL -------------------- */

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

    await ensureCurrentProfileFresh();

    // Re-fetch full post
    let fullPost = post;
    try {
      const { data, error } = await supa.from("posts").select("*").eq("id", post.id).maybeSingle();
      if (!error && data) fullPost = data;
    } catch (_) {}

    // Seller profile (may be public-read per your SQL)
    let sellerProfile = null;
    try {
      const { data } = await supa
        .from("profiles")
        .select("username,email,avatar_url,lat,lng,location_text,premium")
        .eq("id", fullPost.user_id)
        .maybeSingle();
      sellerProfile = data || null;
    } catch (_) {}

    // Images
    if (detailImages) detailImages.innerHTML = "";
    let imgs = [];
    if (fullPost.image_urls) {
      try {
        const arr = JSON.parse(fullPost.image_urls);
        if (Array.isArray(arr) && arr.length) imgs = arr;
      } catch (_) {}
    }
    if (imgs.length && detailImages) {
      imgs.forEach((url, idx) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Post image " + (idx + 1);
        detailImages.appendChild(img);
      });
    }

    // Text
    if (detailTitle) detailTitle.textContent = fullPost.title || "Untitled";
    if (detailPrice) detailPrice.textContent = fullPost.price ? `$${fullPost.price}` : "";
    if (detailDescription) detailDescription.textContent = fullPost.description || "";

    if (detailMeta) {
      const t = (fullPost.type || "").toString().toLowerCase();
      detailMeta.textContent = t === "requesting" ? "Requesting" : "Selling";
    }

    // Seller card
    if (detailSellerAvatar) {
      detailSellerAvatar.innerHTML = "";
      const av = document.createElement("div");
      av.className = "user-avatar small";
      const img = document.createElement("img");
      img.src =
        sellerProfile?.avatar_url ||
        "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
          );
      av.appendChild(img);
      detailSellerAvatar.appendChild(av);
    }

    if (detailSellerName) detailSellerName.textContent = sellerProfile?.username || "User";

    // BF+ enforcement (contact + minimap)
    const viewerPremium = window.isPremiumUser();

    if (detailSellerEmail) {
      detailSellerEmail.textContent = viewerPremium ? sellerProfile?.email || "" : "BF+ required to view contact";
    }

    // Location / minimap
    const locText = fullPost.location_text || sellerProfile?.location_text || "";
    if (detailLocationText) detailLocationText.textContent = locText || "Location not specified.";

    const lat = fullPost.lat ?? sellerProfile?.lat ?? null;
    const lng = fullPost.lng ?? sellerProfile?.lng ?? null;

    // Map is BF+ only
    if (
      viewerPremium &&
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

    // Message button BF+ enforcement (you can tweak limits later)
    if (detailMessageBtn) {
      if (!viewerPremium) {
        detailMessageBtn.disabled = true;
        detailMessageBtn.textContent = "BF+ required to message";
        detailMessageBtn.onclick = null;
      } else {
        detailMessageBtn.disabled = false;
        detailMessageBtn.textContent = "Send message";
        detailMessageBtn.onclick = () => handleSendMessage(fullPost, sellerProfile);
      }
    }

    showDetailPanel();
  }

  detailCloseBtn?.addEventListener("click", hideDetailPanel);
  detailOverlay?.addEventListener("click", hideDetailPanel);

  async function handleSendMessage(post, sellerProfile) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in to send a message.");
      return;
    }

    if (!window.isPremiumUser()) {
      alert("BF+ required to send messages.");
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
      console.log("message insert error:", err.message || err);
      alert("Messages table not fully set up yet (or RLS blocks it).");
    }
  }

  /* -------------------- MATCHES / NOTIFICATIONS (safe placeholders) -------------------- */

  async function loadMatches() {
    if (!matchesList) return;
    if (!window.currentUser) {
      matchesList.innerHTML = "<p class='hint'>Sign in to see automatic matches.</p>";
      return;
    }

    try {
      const { data, error } = await supa
        .from("matches")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || !data.length) {
        matchesList.innerHTML = "<p class='hint'>No matches yet.</p>";
        return;
      }

      matchesList.innerHTML = data
        .map(
          (m) => `
          <div class="list-item">
            <strong>${m.title || "Match"}</strong>
            <small>${m.message || ""}</small>
          </div>
        `
        )
        .join("");
    } catch (err) {
      console.log("matches load error:", err.message || err);
      matchesList.innerHTML = "<p class='hint'>Matches not configured yet.</p>";
    }
  }

  async function loadNotifications() {
    if (!notificationsList) return;
    if (!window.currentUser) {
      notificationsList.innerHTML = "<p class='hint'>Sign in to see notifications.</p>";
      return;
    }

    try {
      const { data, error } = await supa
        .from("notifications")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || !data.length) {
        notificationsList.innerHTML = "<p class='hint'>No notifications yet.</p>";
        return;
      }

      notificationsList.innerHTML = data
        .map(
          (n) => `
          <div class="list-item">
            <strong>${n.title || n.type || "Notification"}</strong>
            <small>${n.message || ""}</small>
          </div>
        `
        )
        .join("");
    } catch (err) {
      console.log("notifications load error:", err.message || err);
      notificationsList.innerHTML = "<p class='hint'>Notifications not configured yet.</p>";
    }
  }

  async function tryCreateMatchesForNewPost(post) {
    try {
      const { data: queries, error } = await supa.from("search_queries").select("*").not("user_id", "eq", post.user_id);
      if (error) throw error;
      if (!queries || !queries.length) return;

      const titleLower = (post.title || "").toLowerCase();
      const interesting = queries.filter((q) => {
        if (!q.last_query) return false;
        const s = q.last_query.toLowerCase();
        return titleLower.includes(s) || s.includes(titleLower);
      });

      if (!interesting.length) return;

      const notifPayload = interesting.map((q) => ({
        user_id: q.user_id,
        type: "match",
        title: "New matching pos

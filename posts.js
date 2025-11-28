/* posts.js – posts grid, modal (create/edit), detail panel, search, matches */

// Wrap everything to avoid globals
(function () {
  const supa = window.supa;

  // Elements
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

  // Detail elements
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

  // Alerts panel
  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  // Working state
  let editingPostId = null;
  let editingPostImages = []; // retains previous images on edit
  window.activePostType = window.activePostType || "selling";

  // ------------------------------------------------------------
  // MODAL — Open for new post
  // ------------------------------------------------------------
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

    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  // ------------------------------------------------------------
  // MODAL — Open for editing post
  // ------------------------------------------------------------
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
    } else if (post.image_url) {
      editingPostImages = [post.image_url];
    }

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    if (postImage) postImage.value = "";

    postModalHint.textContent = "Editing existing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  // ------------------------------------------------------------
  // IMAGE UPLOAD
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // SAVE POST (CREATE or EDIT)
  // ------------------------------------------------------------
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
    const price = postPrice.value.trim();

    const lat = profile?.lat ?? null;
    const lng = profile?.lng ?? null;
    const locationText = profile?.location_text ?? null;

    postModalHint.textContent = "Saving post…";

    // Upload new images
    let newImageUrls = [];
    if (postImage?.files?.length) {
      newImageUrls = await uploadPostImages(postImage.files, user.id);
    }

    let finalImageUrls = editingPostImages.slice();
    if (newImageUrls.length) finalImageUrls = finalImageUrls.concat(newImageUrls);

    const payload = {
      user_id: user.id,
      title,
      description,
      price: price || null,
      type: window.activePostType || "selling",
      category: null,
      condition: null,
      location_text: locationText,
      lat,
      lng,
      image_urls: finalImageUrls.length ? JSON.stringify(finalImageUrls) : null,
    };

    try {
      if (editingPostId) {
        const { error } = await supa
          .from("posts")
          .update(payload)
          .eq("id", editingPostId);
        if (error) throw error;
      } else {
        const { data, error } = await supa
          .from("posts")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;

        if (data) {
          tryCreateMatchesForNewPost(data);
        }
      }

      postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts();
      }, 350);
    } catch (err) {
      console.log("Post save error:", err.message || err);
      postModalHint.textContent = "Error: " + err.message;
    }
  }

  // ------------------------------------------------------------
  // LOAD POSTS
  // ------------------------------------------------------------
  async function loadPosts(query) {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts…";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (query?.trim()) {
      const q = query.trim();
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
    }

    let res;
    try {
      res = await req;
    } catch (e) {
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    const data = res.data || [];
    const error = res.error;

    if (error) {
      postsStatus.textContent = "Error loading posts.";
      return;
    }
    if (!data.length) {
      postsStatus.textContent = "No posts yet.";
      return;
    }

    const filtered = data.filter((p) => {
      const t = (p.type || "").toLowerCase();
      const isReq = t === "request";
      return window.activePostType === (isReq ? "request" : "selling");
    });

    postsStatus.textContent = "";
    if (!filtered.length) {
      postsGrid.innerHTML = `<p class="hint">No posts in this category.</p>`;
      return;
    }

    const currentUser = window.currentUser;

    postsGrid.innerHTML = filtered
      .map((p) => {
        let img = null;
        if (p.image_urls) {
          try {
            const arr = JSON.parse(p.image_urls);
            if (arr?.length) img = arr[0];
          } catch (_) {}
        } else if (p.image_url) {
          img = p.image_url;
        }

        return `
          <article class="post" data-post-id="${p.id}">
            ${
              currentUser?.id === p.user_id
                ? `<button class="edit-btn" data-edit-id="${p.id}">✎</button>`
                : ""
            }
            ${img ? `<img src="${img}" />` : ""}
            <h3>${p.title || "Untitled"}</h3>
            <p>${p.description || ""}</p>
            ${p.location_text ? `<small class="hint">${p.location_text}</small>` : ""}
            <small>${p.price ? `$${p.price}` : ""}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(filtered);
  }

  // ------------------------------------------------------------
  // ATTACH CLICK HANDLERS FOR POSTS
  // ------------------------------------------------------------
  function attachPostHandlers(posts) {
    const cards = postsGrid.querySelectorAll(".post[data-post-id]");
    cards.forEach((card) => {
      const id = Number(card.dataset.postId);
      const post = posts.find((x) => x.id === id);

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

  // ------------------------------------------------------------
  // DETAIL PANEL
  // ------------------------------------------------------------
  async function openDetailPanel(post) {
    let fullPost = post;

    try {
      const { data, error } = await supa
        .from("posts")
        .select("*")
        .eq("id", post.id)
        .maybeSingle();
      if (!error && data) fullPost = data;
    } catch (_) {}

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
    detailImages.innerHTML = "";
    let imgs = [];
    if (fullPost.image_urls) {
      try {
        imgs = JSON.parse(fullPost.image_urls) || [];
      } catch (_) {}
    } else if (fullPost.image_url) {
      imgs = [fullPost.image_url];
    }
    imgs.forEach((u) => {
      const i = document.createElement("img");
      i.src = u;
      detailImages.appendChild(i);
    });

    // Text
    detailTitle.textContent = fullPost.title || "";
    detailPrice.textContent = fullPost.price ? `$${fullPost.price}` : "";
    detailDescription.textContent = fullPost.description || "";
    detailMeta.textContent =
      fullPost.type?.toLowerCase() === "request" ? "Request" : "Selling";

    // Seller
    const avatar = document.createElement("img");
    avatar.src =
      profile?.avatar_url ||
      "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    avatar.className = "user-avatar small";
    detailSellerAvatar.innerHTML = "";
    detailSellerAvatar.appendChild(avatar);

    detailSellerName.textContent = profile?.username || "Seller";
    detailSellerEmail.textContent = profile?.email || "";

    const locText = fullPost.location_text || profile?.location_text || "";
    detailLocationText.textContent = locText || "Location not specified.";

    const viewerProfile = window.currentProfile;
    const isPremium = !!viewerProfile?.premium;
    const lat = fullPost.lat ?? profile?.lat ?? null;
    const lng = fullPost.lng ?? profile?.lng ?? null;

    if (
      isPremium &&
      typeof lat === "number" &&
      typeof lng === "number" &&
      window.BFMap &&
      typeof window.BFMap.renderMiniMap === "function"
    ) {
      detailMinimapContainer.style.display = "block";
      window.BFMap.renderMiniMap(lat, lng);
    } else {
      detailMinimapContainer.style.display = "none";
    }

    detailMessageBtn.onclick = () => handleSendMessage(fullPost, profile);

    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  if (detailCloseBtn) detailCloseBtn.addEventListener("click", hideDetailPanel);
  if (detailOverlay)
    detailOverlay.addEventListener("click", hideDetailPanel);

  // ------------------------------------------------------------
  // SEND MESSAGE
  // ------------------------------------------------------------
  async function handleSendMessage(post, profile) {
    if (!window.currentUser) {
      alert("Sign in to send messages.");
      return;
    }

    if (!profile?.email) {
      alert("Seller has no visible contact info.");
      return;
    }

    const body = prompt("Your message:");
    if (!body?.trim()) return;

    try {
      const { error } = await supa.from("messages").insert({
        post_id: post.id,
        from_user: window.currentUser.id,
        to_user: post.user_id,
        body: body.trim(),
      });
      if (error) throw error;

      alert("Message saved. (Full chat system still pending.)");
    } catch (err) {
      alert("Message insert error: " + err.message);
    }
  }

  // ------------------------------------------------------------
  // MATCHES & NOTIFICATIONS
  // ------------------------------------------------------------

  async function loadMatches() {
    if (!matchesList) return;

    if (!window.currentUser) {
      matchesList.innerHTML =
        "<p class='hint'>Sign in to see matches.</p>";
      return;
    }

    try {
      const { data, error } = await supa
        .from("matches")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        matchesList.innerHTML =
          "<p class='hint'>No matches yet.</p>";
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
      matchesList.innerHTML =
        "<p class='hint'>Matches system not configured.</p>";
    }
  }

  async function loadNotifications() {
    if (!notificationsList) return;

    if (!window.currentUser) {
      notificationsList.innerHTML =
        "<p class='hint'>Sign in to see notifications.</p>";
      return;
    }

    try {
      const { data, error } = await supa
        .from("notifications")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        notificationsList.innerHTML =
          "<p class='hint'>No notifications.</p>";
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
      notificationsList.innerHTML =
        "<p class='hint'>Notifications not configured.</p>";
    }
  }

  // ------------------------------------------------------------
  // AUTO MATCH GENERATION (simple version)
  // ------------------------------------------------------------
  async function tryCreateMatchesForNewPost(post) {
    try {
      const { data: queries } = await supa
        .from("search_queries")
        .select("*")
        .not("user_id", "eq", post.user_id);

      if (!queries?.length) return;

      const titleLower = (post.title || "").toLowerCase();

      const hits = queries.filter((q) => {
        if (!q.last_query) return false;
        const s = q.last_query.toLowerCase();
        return titleLower.includes(s) || s.includes(titleLower);
      });

      if (!hits.length) return;

      await supa.from("notifications").insert(
        hits.map((q) => ({
          user_id: q.user_id,
          type: "match",
          title: "New matching post",
          message: `Someone posted "${post.title}" matching your search "${q.last_query}".`,
        }))
      );
    } catch (err) {
      console.log("match generation error:", err.message || err);
    }
  }

  // ------------------------------------------------------------
  // SEARCH QUERY LOGGING
  // ------------------------------------------------------------
  async function recordSearchQuery(query) {
    if (!query?.trim()) return;
    if (!window.currentUser) return;

    try {
      await supa.from("search_queries").insert({
        user_id: window.currentUser.id,
        last_query: query.trim(),
      });
    } catch (_) {}
  }

  // ------------------------------------------------------------
  // WIRES
  // ------------------------------------------------------------

  if (fabAdd) fabAdd.addEventListener("click", openModalForCreate);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

  // Expose for app.js
  window.Posts = {
    loadPosts,
    loadMatches,
    loadNotifications,
    recordSearchQuery,
  };

  loadPosts(); // initial load
})();
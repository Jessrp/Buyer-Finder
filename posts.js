// posts.js – posts grid, modal (create/edit), detail panel, search, basic matches hooks
(function () {
  const supa = window.supa;

  const postsGrid =
    document.getElementById("postsContainer") ||
    document.getElementById("posts-grid");
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
  const detailMinimapContainer = document.getElementById(
    "detail-minimap-container"
  );
  const detailMessageBtn = document.getElementById("detail-message-btn");

  const matchesList = document.getElementById("matches-list");
  const notificationsList = document.getElementById("notifications-list");

  window.activePostType = window.activePostType || "selling";

  let editingPostId = null;
  let editingPostImages = []; // keep existing URLs on edit

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
    if (postImage) postImage.value = "";
    postModalHint.textContent = "";
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

  // ---------- IMAGE UPLOAD ----------

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

      const { data: urlData } = supa.storage
        .from("post_images")
        .getPublicUrl(path);
      if (urlData && urlData.publicUrl) {
        urls.push(urlData.publicUrl);
      }
    }

    return urls;
  }

  // ---------- SAVE POST (CREATE / EDIT) ----------

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

    const lat =
      profile && typeof profile.lat === "number" ? profile.lat : null;
    const lng =
      profile && typeof profile.lng === "number" ? profile.lng : null;
    const locationText =
      (profile && profile.location_text) || null;

    postModalHint.textContent = "Saving post...";

    const fileList = postImage?.files || [];
    let newImageUrls = [];
    if (fileList && fileList.length) {
      newImageUrls = await uploadPostImages(fileList, user.id);
    }

    let finalImageUrls = editingPostImages.slice();
    if (newImageUrls.length) {
      finalImageUrls = finalImageUrls.concat(newImageUrls);
    }

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
        const { data, error } = await supa
          .from("posts")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;

        // Try to generate matches/notifications based on this new post
        if (data) {
          tryCreateMatchesForNewPost(data);
        }
      }

      postModalHint.textContent = "Saved ✓";
      setTimeout(() => {
        closeModal();
        loadPosts();
      }, 400);
    } catch (err) {
      console.log("Insert/update error:", err.message || err);
      postModalHint.textContent = "Error saving post: " + err.message;
    }
  }

  // ---------- LOAD POSTS ----------

  async function loadPosts(query) {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
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
      postsStatus.textContent =
        "Error loading posts. Check Supabase config.";
      return;
    }

    if (!data || !data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
      postsGrid.innerHTML =
        "<p class='hint'>No posts yet in this category.</p>";
      return;
    }

    const filtered = data.filter((p) => {
      const t =
        (p.type || "").toString().toLowerCase() === "request"
          ? "request"
          : "selling";
      return t === window.activePostType;
    });

    if (!filtered.length) {
      postsGrid.innerHTML =
        "<p class='hint'>No posts in this category yet.</p>";
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
            if (Array.isArray(arr) && arr.length) {
              primaryImage = arr[0];
            }
          } catch (e) {
            console.log("image_urls parse error:", e);
          }
        } else if (p.image_url) {
          primaryImage = p.image_url;
        }

        const metaBits = [];
        if (p.location_text) metaBits.push(p.location_text);

        const metaLine = metaBits.length
          ? `<small class="hint">${metaBits.join(" • ")}</small>`
          : "";

        const imgHtml = primaryImage
          ? `<img src="${primaryImage}" alt="Post image" />`
          : "";

        const showEdit =
          currentUser && currentUser.id && p.user_id === currentUser.id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${showEdit ? `<button class="edit-btn" data-edit-id="${p.id}" title="Edit">✎</button>` : ""}
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
      const idRaw = card.getAttribute("data-post-id");
      const idNum = Number(idRaw);
      const post = posts.find((p) => p.id === idNum);
      if (!post) return;

      // Card click → open detail
      card.addEventListener("click", () => {
        openDetailPanel(post);
      });

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

  // ---------- DETAIL PANEL & MESSAGE ----------

  function showDetailPanel() {
    if (detailOverlay) detailOverlay.classList.add("active");
    if (detailPanel) detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    if (detailOverlay) detailOverlay.classList.remove("active");
    if (detailPanel) detailPanel.classList.remove("active");
  }

  async function openDetailPanel(post) {
    if (!detailPanel) return;

    // Re-fetch full post in case data is stale
    let fullPost = post;
    try {
      const { data, error } = await supa
        .from("posts")
        .select("*")
        .eq("id", post.id)
        .maybeSingle();
      if (!error && data) fullPost = data;
    } catch (_) {}

    // Seller profile
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
        const arr = JSON.parse(fullPost.image_urls);
        if (Array.isArray(arr) && arr.length) imgs = arr;
      } catch (_) {}
    } else if (fullPost.image_url) {
      imgs = [fullPost.image_url];
    }
    if (imgs.length) {
      imgs.forEach((url, idx) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Post image " + (idx + 1);
        detailImages.appendChild(img);
      });
    }

    // Text
    detailTitle.textContent = fullPost.title || "Untitled";
    detailPrice.textContent = fullPost.price ? `$${fullPost.price}` : "";
    detailDescription.textContent = fullPost.description || "";

    const metaBits = [];
    if (fullPost.type) {
      const t =
        fullPost.type.toString().toLowerCase() === "request"
          ? "Request"
          : "Selling";
      metaBits.push(t);
    }
    detailMeta.textContent = metaBits.join(" • ");

    // Seller
    detailSellerAvatar.innerHTML = "";
    const av = document.createElement("div");
    av.className = "user-avatar small";
    const img = document.createElement("img");
    if (profile && profile.avatar_url) {
      img.src = profile.avatar_url;
    } else {
      img.src =
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    }
    av.appendChild(img);
    detailSellerAvatar.appendChild(av);

    detailSellerName.textContent = profile?.username || "Seller";
    detailSellerEmail.textContent = profile?.email || "";

    // Location / minimap
    const locText =
      fullPost.location_text || profile?.location_text || "";
    detailLocationText.textContent = locText || "Location not specified.";

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
      if (detailMinimapContainer)
        detailMinimapContainer.style.display = "block";
      window.BFMap.renderMiniMap(lat, lng);
    } else {
      if (detailMinimapContainer)
        detailMinimapContainer.style.display = "none";
    }

    // Send message
    if (detailMessageBtn) {
      detailMessageBtn.onclick = () => {
        handleSendMessage(fullPost, profile);
      };
    }

    showDetailPanel();
  }

  if (detailCloseBtn) detailCloseBtn.addEventListener("click", hideDetailPanel);
  if (detailOverlay)
    detailOverlay.addEventListener("click", hideDetailPanel);

  async function handleSendMessage(post, profile) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in to send a message.");
      return;
    }
    if (!profile || !profile.email) {
      alert("Seller has no visible contact info yet.");
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
      alert("Message saved. A real app would show full chat threads here.");
    } catch (err) {
      console.log("message insert error:", err.message || err);
      alert(
        "Message table not fully set up in Supabase yet.\nAsk me for the SQL later if you want full chat."
      );
    }
  }

  // ---------- MATCHES / NOTIFICATIONS (safe placeholders) ----------

  async function loadMatches() {
    if (!matchesList) return;
    if (!window.currentUser) {
      matchesList.innerHTML =
        "<p class='hint'>Sign in to see automatic matches.</p>";
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
        matchesList.innerHTML =
          "<p class='hint'>No matches yet. Keep posting and searching.</p>";
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
      matchesList.innerHTML =
        "<p class='hint'>Matches table not configured yet in Supabase.</p>";
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

      if (!data || !data.length) {
        notificationsList.innerHTML =
          "<p class='hint'>No notifications yet.</p>";
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
      notificationsList.innerHTML =
        "<p class='hint'>Notifications table not configured yet in Supabase.</p>";
    }
  }

  // Called when a *new* post is created to ping searchers
  async function tryCreateMatchesForNewPost(post) {
    try {
      const { data: queries, error } = await supa
        .from("search_queries")
        .select("*")
        .not("user_id", "eq", post.user_id);
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
        title: "New matching post",
        message: `Someone posted "${post.title}" that may match your search "${q.last_query}".`,
      }));

      await supa.from("notifications").insert(notifPayload).catch(() => {});
    } catch (err) {
      console.log("match generation error (non-fatal):", err.message || err);
    }
  }

  // ---------- SEARCH LOGGING ----------

  async function recordSearchQuery(query) {
    if (!query || !query.trim()) return;
    if (!window.currentUser) return;
    try {
      await supa
        .from("search_queries")
        .insert({
          user_id: window.currentUser.id,
          last_query: query.trim(),
        })
        .catch(() => {});
    } catch (_) {}
  }

  // ---------- WIRES ----------

  function openModal() {
    openModalForCreate();
  }

  if (fabAdd) fabAdd.addEventListener("click", openModal);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

  // Exported API for app.js
  window.Posts = {
    loadPosts,
    loadMatches,
    loadNotifications,
    recordSearchQuery,
  };

  // Initial load
  loadPosts();
})();
          

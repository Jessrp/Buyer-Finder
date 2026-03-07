// posts.js – posts grid, modal, detail panel, delete
(function () {
  console.log("🔥 POSTS.JS LOADED");

  var supa = window.supa;

  const postsGrid       = document.getElementById("posts-grid");
  const postsStatus     = document.getElementById("posts-status");
  const fabAdd          = document.getElementById("fab-add");
  const modalBackdrop   = document.getElementById("modal-backdrop");
  const postTitle       = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice       = document.getElementById("post-price");
  const postImage       = document.getElementById("post-image");
  const btnCancelPost   = document.getElementById("btn-cancel-post");
  const btnSavePost     = document.getElementById("btn-save-post");
  const postModalHint   = document.getElementById("post-modal-hint");

  const detailOverlay     = document.getElementById("detail-overlay");
  const detailPanel       = document.getElementById("detail-panel");
  const detailCloseBtn    = document.getElementById("detail-close-btn");
  const detailTitle       = document.getElementById("detail-title");
  const detailPrice       = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta        = document.getElementById("detail-meta");
  const detailImages      = document.getElementById("detail-images");
  const chatInput         = document.getElementById("chat-input");
  const detailMessageBtn  = document.getElementById("detail-message-btn");

  window.activePostType = window.activePostType || "selling";
  window.editingPostId  = null;
  window.allPosts       = [];

  // ─── PROFILE CACHE ──────────────────────────────────────────────
  // Avoid re-fetching the same profile multiple times per page load
  const profileCache = {};

  async function getProfile(userId) {
    if (!userId) return null;
    if (profileCache[userId]) return profileCache[userId];
    const { data } = await supa
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (data) profileCache[userId] = data;
    return data || null;
  }

  // Pre-fetch all profiles for a batch of posts in one query
  async function prefetchProfiles(posts) {
    const ids = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
    const uncached = ids.filter(id => !profileCache[id]);
    if (!uncached.length) return;
    const { data } = await supa
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", uncached);
    (data || []).forEach(p => profileCache[p.id] = p);
  }

  // ─── FREE TIER HELPERS ──────────────────────────────────────────

  function isBFPlus() {
    if (typeof window.isBFPlus === "function") return window.isBFPlus(window.currentProfile);
    const profile = window.currentProfile;
    if (!profile) return false;
    if (profile.premium === true) return true;
    const exp = profile.bfplus_expires_at;
    if (!exp) return false;
    return new Date(exp).getTime() > Date.now();
  }

  function getLimit(key) {
    return window.BF_LIMITS?.[key] ?? Infinity;
  }

  async function getUserPostCount() {
    const user = window.currentUser;
    if (!user) return 0;
    const { count, error } = await supa
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (error) return 0;
    return count || 0;
  }

  async function getUserMessageCount() {
    const user = window.currentUser;
    if (!user) return 0;
    const { count, error } = await supa
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id);
    if (error) return 0;
    return count || 0;
  }

  // ─── MODAL ──────────────────────────────────────────────────────

  async function openModalForCreate() {
    if (!window.currentUser) return alert("You must sign in to post.");
    if (!isBFPlus()) {
      const max   = getLimit("MAX_POSTS");
      const count = await getUserPostCount();
      if (count >= max) {
        const go = confirm(
          `Free accounts are limited to ${max} posts.\n\n` +
          `You already have ${count} post${count !== 1 ? "s" : ""}.\n\n` +
          `Upgrade to BF+ for unlimited posts?`
        );
        if (go && typeof window.startUpgrade === "function") window.startUpgrade();
        return;
      }
    }
    postTitle.value           = "";
    postDescription.value     = "";
    postPrice.value           = "";
    postImage.value           = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function openModalForEdit(post) {
    window.editingPostId      = post.id;
    postTitle.value           = post.title       || "";
    postDescription.value     = post.description || "";
    postPrice.value           = post.price       || "";
    postImage.value           = "";
    postModalHint.textContent = "Editing post";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
    window.editingPostId = null;
  }

  // ─── IMAGE UPLOAD ───────────────────────────────────────────────

  async function uploadPostImages(files, userId) {
    if (!files?.length) return [];
    const urls = [];
    for (const file of files) {
      if (!file.type?.startsWith("image/")) continue;
      const ext  = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) continue;
      const { data } = supa.storage.from("post_images").getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  }

  function normalizePostType(t) {
    if (t === "request" || t === "requesting") return "requesting";
    return "selling";
  }

  // ─── SAVE POST ──────────────────────────────────────────────────

  async function savePost() {
    const user    = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return alert("You must sign in.");
    const title = postTitle.value.trim();
    if (!title) return alert("Title required.");
    postModalHint.textContent = "Saving...";
    const newImages = await uploadPostImages(postImage.files, user.id);
    const payload = {
      title,
      description:   postDescription.value.trim(),
      price:         postPrice.value.trim() || null,
      type:          normalizePostType(window.activePostType),
      location_text: profile?.location_text ?? null,
      lat:           profile?.lat ?? null,
      lng:           profile?.lng ?? null,
    };
    if (newImages.length) payload.image_urls = newImages;
    let error;
    if (window.editingPostId) {
      ({ error } = await supa.from("posts").update(payload).eq("id", window.editingPostId).eq("user_id", user.id));
    } else {
      payload.user_id = user.id;
      ({ error } = await supa.from("posts").insert(payload));
    }
    if (error) { postModalHint.textContent = error.message; return; }
    closeModal();
    loadPosts(window.__bf_last_search_query || "");
    try { await window.Matching?.scanAndCreateMatchesForUser?.(); } catch {}
  }

  // ─── LOAD POSTS ─────────────────────────────────────────────────

  async function loadPosts(query = "") {
    window.__bf_last_search_query = query;
    if (postsStatus) postsStatus.textContent = "Loading...";
    if (postsGrid)   postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (postsStatus) postsStatus.textContent = "Failed to load posts.";
      return;
    }

    window.allPosts = data || [];

    const q      = String(query || "").trim().toLowerCase();
    const active = normalizePostType(window.activePostType);

    const filtered = (data || []).filter((p) => {
      if (normalizePostType(p.type) !== active) return false;
      if (!q) return true;
      const hay = [p.title, p.description, p.location_text, p.category, p.price, p.type]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    if (postsStatus) postsStatus.textContent = "";
    if (!postsGrid) return;

    if (!filtered.length) {
      postsGrid.innerHTML = "<p class='hint'>No posts yet.</p>";
      return;
    }

    // Pre-fetch all poster profiles in one batch query
    await prefetchProfiles(filtered);

    postsGrid.innerHTML = filtered.map(renderPostCard).join("");
    attachPostHandlers(filtered);

    if (window.__bf_pending_open_post_id) {
      const pid   = String(window.__bf_pending_open_post_id);
      const found = (data || []).find(p => String(p.id) === pid);
      window.__bf_pending_open_post_id = null;
      if (found) openDetailPanel(found);
    }
  }

  // ─── RENDER POST CARD ────────────────────────────────────────────

  function renderPostCard(p) {
    // Image
    let arr = [];
    if (Array.isArray(p.image_urls)) arr = p.image_urls;
    else if (typeof p.image_urls === "string") {
      try { arr = JSON.parse(p.image_urls); } catch {}
    }
    const imgHtml = arr.length
      ? `<img src="${arr[0]}" loading="lazy" />`
      : "";

    // Poster info from cache
    const poster   = profileCache[p.user_id];
    const username = poster?.username || "User";
    const initials = username.slice(0, 2).toUpperCase();
    const avatarHtml = poster?.avatar_url
      ? `<img src="${poster.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : initials;

    const isOwn = window.currentUser?.id === p.user_id;

    return `
      <article class="post" data-post-id="${p.id}">
        ${isOwn ? `<button class="edit-btn" data-edit-id="${p.id}">✎</button>` : ""}
        ${imgHtml}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
        <div class="post-footer">
          <div class="post-avatar">
            ${avatarHtml}
          </div>
          <span class="post-username">${username}</span>
          <span class="post-price">${p.price != null ? p.price : ""}</span>
        </div>
      </article>
    `;
  }

  function attachPostHandlers(posts) {
    if (!postsGrid) return;
    postsGrid.querySelectorAll(".post").forEach((card) => {
      const id   = card.dataset.postId;
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;
      card.onclick = () => openDetailPanel(post);
      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.onclick = (e) => { e.stopPropagation(); openModalForEdit(post); };
      }
    });
  }

  // ─── DETAIL PANEL ───────────────────────────────────────────────

  async function openDetailPanel(post) {
    window.activePost = post;
    if (!post) return;

    if (detailTitle)       detailTitle.textContent       = post.title       || "";
    if (detailPrice)       detailPrice.textContent       = post.price       || "";
    if (detailDescription) detailDescription.textContent = post.description || "";
    if (detailMeta) {
      detailMeta.textContent = post.user_id === window.currentUser?.id
        ? "This is your post"
        : "Tap to message seller";
    }

    // Poster info in detail panel
    const sellerAvEl   = document.getElementById("detail-seller-avatar");
    const sellerNameEl = document.getElementById("detail-seller-name");
    const sellerEmailEl = document.getElementById("detail-seller-email");

    const poster = await getProfile(post.user_id);
    if (sellerAvEl) {
      if (poster?.avatar_url) {
        sellerAvEl.innerHTML = `<img src="${poster.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        sellerAvEl.textContent = (poster?.username || "U").slice(0, 2).toUpperCase();
      }
    }
    if (sellerNameEl)  sellerNameEl.textContent  = poster?.username || "Unknown";
    if (sellerEmailEl) sellerEmailEl.textContent = "";

    if (detailImages) detailImages.innerHTML = "";
    let images = [];
    if (Array.isArray(post.image_urls)) images = post.image_urls;
    else if (typeof post.image_urls === "string") {
      try { images = JSON.parse(post.image_urls); } catch {}
    }
    images.forEach(url => {
      const img = document.createElement("img");
      img.src = url; img.loading = "lazy";
      detailImages?.appendChild(img);
    });

    if (detailPanel) detailPanel.onclick = null;
    if (post.user_id !== window.currentUser?.id) {
      if (detailPanel) detailPanel.onclick = startConversationAndSendMessage.bind(null, post);
    }

    if (detailMessageBtn) {
      detailMessageBtn.disabled = (post.user_id === window.currentUser?.id);
      detailMessageBtn.onclick  = (e) => {
        e.preventDefault(); e.stopPropagation();
        __bfSendMessageFromDetail(post);
      };
    }
    if (chatInput) {
      chatInput.onclick  = (e) => e.stopPropagation();
      chatInput.onkeydown = (e) => e.stopPropagation();
    }

    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  async function startConversationAndSendMessage(post) {
    if (!post) return;
    if (!window.currentUser) return alert("You must sign in to message.");
    try {
      const convo = await window.Conversations.getOrCreateConversation({
        postId: post.id, buyerId: window.currentUser.id, sellerId: post.user_id
      });
      hideDetailPanel();
      window.Messages?.loadInbox?.();
      window.Messages?.openConversation?.(convo.id);
    } catch (err) {
      console.error("Conversation start failed", err);
      alert("Could not start conversation.");
    }
  }

  // ─── SEND MESSAGE FROM DETAIL PANEL ─────────────────────────────

  async function __bfSendMessageFromDetail(post) {
    if (!post) return alert("No post selected.");
    const me       = window.currentUser?.id;
    const sellerId = post.user_id;
    const postId   = post.id;
    const body     = (chatInput?.value || "").trim();
    if (!body)              return alert("Type a message first.");
    if (!me)                return alert("You must sign in to message.");
    if (!postId || !sellerId) return alert("No post selected.");
    if (me === sellerId)    return alert("You can't message yourself.");

    if (!isBFPlus()) {
      const max   = getLimit("MAX_MESSAGES");
      const count = await getUserMessageCount();
      if (count >= max) {
        const go = confirm(
          `Free accounts are limited to ${max} messages.\n\n` +
          `You've sent ${count} message${count !== 1 ? "s" : ""}.\n\n` +
          `Upgrade to BF+ for unlimited messaging?`
        );
        if (go && typeof window.startUpgrade === "function") window.startUpgrade();
        return;
      }
    }

    if (!window.Conversations?.getOrCreateConversation) {
      alert("Messaging system not loaded."); return;
    }

    try {
      const convo = await window.Conversations.getOrCreateConversation({
        postId, buyerId: me, sellerId
      });
      const { error } = await window.supa.from("messages").insert({
        conversation_id: convo.id, sender_id: me, body
      });
      if (error) throw error;
      try {
        await window.supa.rpc("notify_message", {
          p_conversation_id: convo.id, p_message_body: body
        });
      } catch (e) { console.warn("notify_message failed:", e); }
      if (chatInput) chatInput.value = "";
      window.Messages?.loadInbox?.();
      window.Messages?.openConversation?.(convo.id);
      alert("Message sent ✅");
    } catch (err) {
      console.error("Send failed:", err);
      alert("Message failed. Check console for details.");
    }
  }

  function hideDetailPanel() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  // ─── OPEN POST BY ID ────────────────────────────────────────────

  async function openPostById(postId) {
    const id = String(postId || "");
    if (!id) return;
    const found = (window.allPosts || []).find(p => String(p.id) === id);
    if (found) {
      window.activePostType = normalizePostType(found.type);
      if (window.setActiveView) window.setActiveView("posts");
      await loadPosts(window.__bf_last_search_query || "");
      openDetailPanel(found);
      return;
    }
    const { data, error } = await supa.from("posts").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      window.__bf_pending_open_post_id = id;
      window.activePostType = "selling";
      if (window.setActiveView) window.setActiveView("posts");
      await loadPosts(window.__bf_last_search_query || "");
      return;
    }
    window.activePostType = normalizePostType(data.type);
    if (window.setActiveView) window.setActiveView("posts");
    window.__bf_pending_open_post_id = id;
    await loadPosts(window.__bf_last_search_query || "");
  }

  // ─── WIRE UI ────────────────────────────────────────────────────

  if (detailCloseBtn) detailCloseBtn.onclick = hideDetailPanel;
  if (detailOverlay)  detailOverlay.onclick  = hideDetailPanel;
  if (fabAdd)         fabAdd.onclick         = openModalForCreate;
  if (btnCancelPost)  btnCancelPost.onclick  = closeModal;
  if (btnSavePost)    btnSavePost.onclick    = savePost;

  window.Posts = { loadPosts, openPostById };

  loadPosts();
})();
                                          

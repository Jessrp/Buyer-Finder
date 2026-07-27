// posts.js – posts grid, modal, detail panel, delete
(function () {
  console.error("🔥 POSTS.JS LOADED 🔥");

  var supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");

  // ── SORTING ──────────────────────────────────────────────
  window.activeSort = window.activeSort || "newest";

  function kmBetween(a, b, c, d) {
    if ([a,b,c,d].some(v => typeof v !== "number")) return Infinity;
    const R = 6371, toRad = x => x * Math.PI / 180;
    const dLat = toRad(c - a), dLon = toRad(d - b);
    const s = Math.sin(dLat/2)**2 +
      Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function sortPosts(list) {
    const s = window.activeSort || "newest";
    const arr = list.slice();
    const num = v => (v == null || v === "" ? null : Number(v));
    if (s === "price_low") {
      arr.sort((a,b) => (num(a.price) ?? Infinity) - (num(b.price) ?? Infinity));
    } else if (s === "price_high") {
      arr.sort((a,b) => (num(b.price) ?? -Infinity) - (num(a.price) ?? -Infinity));
    } else if (s === "distance") {
      const me = window.currentProfile;
      const ulat = me?.lat, ulng = me?.lng;
      if (typeof ulat !== "number" || typeof ulng !== "number") return arr; // no location; leave as-is
      arr.sort((a,b) =>
        kmBetween(ulat, ulng, a.lat, a.lng) - kmBetween(ulat, ulng, b.lat, b.lng));
    } else {
      // newest — rely on created_at desc already applied, but enforce it
      arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return arr;
  }

  const postsStatus = document.getElementById("posts-status");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postImage = document.getElementById("post-image");
  const postCategory = document.getElementById("post-category");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailImages = document.getElementById("detail-images");
  const chatInput = document.getElementById("chat-input");
  const detailMessageBtn = document.getElementById("detail-message-btn");

  window.activePostType = window.activePostType || "requesting";
  window.activeCategory = window.activeCategory || null;
  window.editingPostId  = null;
  window.allPosts       = [];

  // ── CATEGORIES ──────────────────────────────────────────────────
    const CATEGORIES = [
    { label: "All",        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', value: null },
    { label: "Vehicles",   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>', value: "vehicles" },
    { label: "Tech",       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>', value: "tech" },
    { label: "Gaming",     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1"/><circle cx="17" cy="13" r="1"/><path d="M3 7h18l-2 10H5L3 7z"/></svg>', value: "gaming" },
    { label: "Tools",      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>', value: "tools" },
    { label: "Furniture",  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v3"/><path d="M2 11v5a2 2 0 002 2h16a2 2 0 002-2v-5a2 2 0 00-4 0v2H6v-2a2 2 0 00-4 0z"/><line x1="6" y1="18" x2="6" y2="22"/><line x1="18" y1="18" x2="18" y2="22"/></svg>', value: "furniture" },
    { label: "Clothing",   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>', value: "clothing" },
    { label: "Sports",     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/><path d="M12 2a10 10 0 00-6.88 17.19"/><path d="M12 2a10 10 0 016.88 17.19"/></svg>', value: "sports" },
    { label: "Music",      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', value: "music" },
    { label: "Outdoors",   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-8 4 4 3-6 4 10H3z"/><path d="M3 20h18"/></svg>', value: "outdoors" },
    { label: "Baby",       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16s.5 1 2 1 2-1 2-1"/><circle cx="12" cy="10" r="8"/><path d="M8 2s0 4-4 4"/><path d="M16 2s0 4 4 4"/></svg>', value: "baby" },
    { label: "Pets",       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.96-1.45-2.344-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/><path d="M4.42 11.247A13.152 13.152 0 0012 17c2.85 0 5.45-.94 7.58-2.753"/></svg>', value: "pets" },
    { label: "Kitchen",    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>', value: "kitchen" },
    { label: "Appliances", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>', value: "appliances" },
    { label: "Toys",       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 015 5v1h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1V7a5 5 0 015-5z"/><circle cx="12" cy="15" r="2"/></svg>', value: "toys" },
    { label: "Other",      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>', value: "other" },
  ];

  function buildCategoryPills() {
    const wrap = document.getElementById("category-pills");
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map(c => `
      <button class="cat-pill${window.activeCategory === c.value ? " active" : ""}" data-cat="${c.value === null ? "" : c.value}">
        <span class="cat-icon">${c.icon}</span>
        <span class="cat-label">${c.label}</span>
      </button>
    `).join("");
    wrap.querySelectorAll(".cat-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.cat === "" ? null : btn.dataset.cat;
        window.activeCategory = val;
        wrap.querySelectorAll(".cat-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadPosts(window.__bf_last_search_query || "");
      });
    });
  }

  /* ---------- MODAL ---------- */
  function openModalForCreate() {
    if (!window.currentUser) return alert("You must sign in.");
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postImage.value = "";
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

  /* ---------- IMAGE UPLOAD ---------- */
  async function uploadPostImages(files, userId) {
    if (!files?.length) return [];
    const urls = [];
    for (const file of files) {
      if (!file.type?.startsWith("image/")) continue;
      const ext  = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supa.storage.from("post_images").upload(path, file, { upsert: true, contentType: file.type });
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

  /* ---------- SAVE POST ---------- */
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
      category: postCategory?.value || window.activeCategory || null,
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

  /* ---------- LOAD POSTS ---------- */
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
    const cat    = window.activeCategory;

    const filtered = (data || []).filter((p) => {
      // "My Posts" mode: show ALL of the user's own posts regardless of type/category
      if (window.activeMineOnly) {
        return window.currentUser && p.user_id === window.currentUser.id;
      }
      if (normalizePostType(p.type) !== active) return false;
      if (cat) {
        const pCat = (p.category || "").toLowerCase().trim();
        if (pCat !== cat) return false;
      }
      if (!q) return true;
      const hay = [p.title, p.description, p.location_text, p.category, p.price, p.type]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    if (postsStatus) postsStatus.textContent = "";
    if (!postsGrid) return;

    const sorted = sortPosts(filtered);
    postsGrid.innerHTML = sorted.length
      ? sorted.map(renderPostCard).join("")
      : `<p class='hint'>${window.activeMineOnly ? "You haven't posted anything yet. Tap + to create your first post!" : (cat ? "No posts in this category yet." : "No posts yet.")}</p>`;

    attachPostHandlers(sorted);

    if (window.__bf_pending_open_post_id) {
      const pid   = String(window.__bf_pending_open_post_id);
      const found = (data || []).find(p => String(p.id) === pid);
      window.__bf_pending_open_post_id = null;
      if (found) openDetailPanel(found);
    }
  }

  function renderPostCard(p) {
    let arr = [];
    if (Array.isArray(p.image_urls)) arr = p.image_urls;
    else if (typeof p.image_urls === "string") { try { arr = JSON.parse(p.image_urls); } catch {} }
    const img  = arr.length ? `<img src="${arr[0]}" loading="lazy" />` : "";
    const isOwn = window.currentUser?.id === p.user_id;
    return `
      <article class="post" data-post-id="${p.id}">
        ${isOwn ? `<button class="edit-btn" data-edit-id="${p.id}">✎</button>` : ""}
        ${img ? `<div class="post-img-wrap">${img}</div>` : `<div class="post-no-img">📦</div>`}
        <div class="post-body">
          <span class="post-type-pill ${p.type === "requesting" ? "request" : "selling"}">${p.type === "requesting" ? "🔍 Wanted" : "🏷️ For Sale"}</span>
          <h3>${p.title}</h3>
          <p>${p.description || ""}</p>
          <div class="post-meta-row">
            ${p.price != null && p.price !== "" && p.price != 0
              ? `<span class="card-budget">${p.type === "requesting" ? "Up to " : ""}$${Number(p.price).toLocaleString()}</span>`
              : `<span class="card-budget" style="opacity:.5">Price open</span>`}
            ${p.location_text ? `<span class="card-location">📍 ${p.location_text}</span>` : ""}
          </div>
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
      if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); openModalForEdit(post); };
    });
  }

  /* ---------- DETAIL PANEL ---------- */
  async function startConversationAndSendMessage(post) {
    if (!post) return;
    if (!window.currentUser) { alert("You must sign in to message."); return; }
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

  function openDetailPanel(post) {
    window.activePost = post;
    if (!post) return;
    if (detailTitle)       detailTitle.textContent       = post.title       || "";
    if (detailPrice)       detailPrice.textContent       = post.price       || "";
    if (detailDescription) detailDescription.textContent = post.description || "";
    if (detailMeta) {
      detailMeta.textContent = post.user_id === window.currentUser?.id
        ? "This is your post" : "Tap to message seller";
    }
    if (detailImages) detailImages.innerHTML = "";
    let images = [];
    if (Array.isArray(post.image_urls)) images = post.image_urls;
    else if (typeof post.image_urls === "string") { try { images = JSON.parse(post.image_urls); } catch {} }
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
      detailMessageBtn.onclick  = (e) => { e.preventDefault(); e.stopPropagation(); __bfSendMessageFromDetail(post); };
    }
    if (chatInput) {
      chatInput.onclick   = (e) => e.stopPropagation();
      chatInput.onkeydown = (e) => e.stopPropagation();
    }
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  async function __bfSendMessageFromDetail(post) {
    if (!post) return alert("No post selected.");
    const me       = window.currentUser?.id;
    const sellerId = post.user_id;
    const postId   = post.id;
    const body     = (chatInput?.value || "").trim();
    if (!body)            return alert("Type a message first.");
    if (!me)              return alert("You must sign in to message.");
    if (!postId || !sellerId) return alert("No post selected.");
    if (me === sellerId)  return alert("You can't message yourself.");
    if (!window.Conversations?.getOrCreateConversation) {
      alert("Messaging system not loaded.");
      return;
    }
    try {
      const convo = await window.Conversations.getOrCreateConversation({ postId, buyerId: me, sellerId });
      const { error } = await window.supa.from("messages").insert({ conversation_id: convo.id, sender_id: me, body });
      if (error) throw error;
      try {
        await window.supa.rpc("notify_message", { p_conversation_id: convo.id, p_message_body: body });
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
      window.activePostType = "requesting";
      if (window.setActiveView) window.setActiveView("posts");
      await loadPosts(window.__bf_last_search_query || "");
      return;
    }
    window.activePostType = normalizePostType(data.type);
    if (window.setActiveView) window.setActiveView("posts");
    window.__bf_pending_open_post_id = id;
    await loadPosts(window.__bf_last_search_query || "");
  }

  if (detailCloseBtn) detailCloseBtn.onclick = hideDetailPanel;
  if (detailOverlay)  detailOverlay.onclick  = hideDetailPanel;
  if (fabAdd)         fabAdd.onclick         = openModalForCreate;
  if (btnCancelPost)  btnCancelPost.onclick  = closeModal;
  if (btnSavePost)    btnSavePost.onclick    = savePost;

  buildCategoryPills();

  // Wire sort dropdown
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      window.activeSort = sortSelect.value;
      if (window.activeSort === "distance" &&
          (typeof window.currentProfile?.lat !== "number")) {
        // Gently note that distance needs a location set
        if (postsStatus) {
          postsStatus.textContent = "Set your location in Settings to sort by distance.";
          setTimeout(() => { if (postsStatus) postsStatus.textContent = ""; }, 3000);
        }
      }
      loadPosts(window.__bf_last_search_query || "");
    });
  }

  window.Posts = { loadPosts, openPostById, openDetailPanel };

  loadPosts();
})();

// posts.js – posts grid, modal, detail panel, delete
(function () {
  console.error("🔥 POSTS.JS LOADED 🔥");

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

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailImages = document.getElementById("detail-images");

  // Detail-panel message UI (these already exist in your index.html)
  const detailChatInput = document.getElementById("chat-input");
  const detailMessageBtn = document.getElementById("detail-message-btn");

  window.activePostType = window.activePostType || "selling";
  window.editingPostId = null;

  window.allPosts = [];

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
    window.editingPostId = post.id;

    postTitle.value = post.title || "";
    postDescription.value = post.description || "";
    postPrice.value = post.price || "";
    postImage.value = "";

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

      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) continue;

      const { data } = supa.storage.from("post_images").getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  /* ---------- SAVE POST ---------- */
  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return alert("You must sign in.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title required.");

    postModalHint.textContent = "Saving...";

    const newImages = await uploadPostImages(postImage.files, user.id);

    const payload = {
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type: window.activePostType === "request" ? "requesting" : "selling",
      location_text: profile?.location_text ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };

    if (newImages.length) payload.image_urls = newImages;

    let error;

    if (window.editingPostId) {
      ({ error } = await supa
        .from("posts")
        .update(payload)
        .eq("id", window.editingPostId)
        .eq("user_id", user.id));
    } else {
      payload.user_id = user.id;
      ({ error } = await supa.from("posts").insert(payload));
    }

    if (error) {
      postModalHint.textContent = error.message;
      return;
    }

    closeModal();
    loadPosts();
  }

  /* ---------- LOAD POSTS ---------- */
  async function loadPosts() {
    if (!postsStatus || !postsGrid) return;

    postsStatus.textContent = "Loading...";
    postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      postsStatus.textContent = "Failed to load posts.";
      return;
    }

    window.allPosts = data || [];

    const filtered = (data || []).filter((p) => {
      const t = p.type === "requesting" ? "request" : "selling";
      return t === window.activePostType;
    });

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";

    attachPostHandlers(filtered);
  }

  function renderPostCard(p) {
    let img = "";
    let arr = [];

    if (Array.isArray(p.image_urls)) arr = p.image_urls;
    else if (typeof p.image_urls === "string") {
      try {
        arr = JSON.parse(p.image_urls);
      } catch {}
    }

    if (arr.length) img = `<img src="${arr[0]}" loading="lazy" />`;

    return `
      <article class="post" data-post-id="${p.id}">
        ${
          window.currentUser?.id === p.user_id
            ? `<button class="edit-btn" data-edit-id="${p.id}">✎</button>`
            : ""
        }
        ${img}
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
        <p>${p.price ?? ""}</p>
      </article>
    `;
  }

  function attachPostHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((card) => {
      const id = card.dataset.postId;
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      card.onclick = () => openDetailPanel(post);

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.stopPropagation();
          openModalForEdit(post);
        };
      }
    });
  }

  /* ---------- DETAIL PANEL ---------- */

  async function startConversationAndSendMessage(post) {
    if (!post) return;

    if (!window.currentUser) {
      alert("You must sign in to message.");
      return;
    }

    if (!window.Conversations?.getOrCreateConversation) {
      console.error("Conversations module not loaded. Did you include conversations.js?");
      alert("Messaging system not loaded (missing conversations.js).");
      return;
    }

    const body = (detailChatInput?.value || "").trim();
    if (!body) {
      alert("Type a message first.");
      return;
    }

    // block "message yourself"
    if (window.currentUser.id === post.user_id) {
      alert("You can’t message yourself. That’s what journaling is for.");
      return;
    }

    try {
      const convo = await window.Conversations.getOrCreateConversation({
        postId: post.id,
        buyerId: window.currentUser.id,
        sellerId: post.user_id,
      });

      // send the first message into that conversation
      const { error: msgErr } = await supa.from("messages").insert({
        conversation_id: convo.id,
        sender_id: window.currentUser.id,
        body,
      });

      if (msgErr) {
        console.error("Message insert failed", msgErr);
        alert("Message failed: " + (msgErr.message || "unknown error"));
        return;
      }

      if (detailChatInput) detailChatInput.value = "";

      hideDetailPanel();

      // open chat UI if available
      if (window.Messages?.openConversation) {
        window.Messages.openConversation(convo.id);
      } else {
        // fallback: at least load inbox if you wired it somewhere
        window.Messages?.loadInbox?.();
        alert("Conversation created, but chat UI isn't loaded.");
      }
    } catch (err) {
      console.error("Conversation start failed", err);
      alert("Could not start conversation.");
    }
  }

  function openDetailPanel(post) {
    if (!post) return;

    detailTitle.textContent = post.title || "";
    detailPrice.textContent = post.price || "";
    detailDescription.textContent = post.description || "";
    detailMeta.textContent =
      post.user_id === window.currentUser?.id
        ? "This is your post"
        : "Send a message to the seller";

    detailImages.innerHTML = "";

    let images = [];
    if (Array.isArray(post.image_urls)) images = post.image_urls;
    else if (typeof post.image_urls === "string") {
      try {
        images = JSON.parse(post.image_urls);
      } catch {}
    }

    images.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.loading = "lazy";
      detailImages.appendChild(img);
    });

    // IMPORTANT: DO NOT hijack the whole detail panel click.
    // That was causing a bunch of “why did it send?” chaos.
    detailPanel.onclick = null;

    // Wire the send button for THIS post
    if (detailMessageBtn) {
      detailMessageBtn.style.display =
        post.user_id === window.currentUser?.id ? "none" : "block";
      detailMessageBtn.onclick = () => startConversationAndSendMessage(post);
    }
    if (detailChatInput) {
      detailChatInput.style.display =
        post.user_id === window.currentUser?.id ? "none" : "block";
    }

    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  if (detailCloseBtn) detailCloseBtn.onclick = hideDetailPanel;
  if (detailOverlay) detailOverlay.onclick = hideDetailPanel;

  if (fabAdd) fabAdd.onclick = openModalForCreate;
  if (btnCancelPost) btnCancelPost.onclick = closeModal;
  if (btnSavePost) btnSavePost.onclick = savePost;

  window.Posts = { loadPosts };

  loadPosts();
})();

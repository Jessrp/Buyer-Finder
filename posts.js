// posts.js – posts grid, modal, detail panel, delete
(function () {
  console.error("🔥 POSTS.JS LOADED 🔥");

  var supa = window.supa;

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
  const chatInput = document.getElementById("chat-input");
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
      type:
        window.activePostType === "request"
          ? "requesting"
          : "selling",
      location_text: profile?.location_text ?? null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
    };

    if (newImages.length) {
      payload.image_urls = newImages;
    }

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

    // ✅ Create matches after saving a post (retry in case matching.js loads after posts.js)
    (function triggerMatchScan(retries) {
      if (window.Matching?.scanAndCreateMatchesForUser) {
        window.Matching.scanAndCreateMatchesForUser();
        return;
      }
      if (retries <= 0) {
        console.warn("Matching not ready (matching.js not loaded yet).");
        return;
      }
      setTimeout(() => triggerMatchScan(retries - 1), 250);
    })(12);
}

  /* ---------- LOAD POSTS ---------- */
  async function loadPosts() {
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

    const filtered = data.filter((p) => {
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
      try { arr = JSON.parse(p.image_urls); } catch {}
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
        <p>${p.price}</p>
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
    if (!post) {
  console.error("startConversationAndSendMessage called with undefined post!");
  return;
    }
    
    if (!window.currentUser) {
      alert("You must sign in to message.");
      return;
    }

    try {
      const convo = await window.Conversations.getOrCreateConversation({
        postId: post.id,
        buyerId: window.currentUser.id,
        sellerId: post.user_id
      });

      hideDetailPanel();

      window.Messages?.loadInbox?.();
      window.openConversation?.(convo.id);

    } catch (err) {
      console.error("Conversation start failed", err);
      alert("Could not start conversation.");
    }
  }

  function openDetailPanel(post) {
    window.activePost = post;

    if (!post) return;

    detailTitle.textContent = post.title || "";
    detailPrice.textContent = post.price || "";
    detailDescription.textContent = post.description || "";
    detailMeta.textContent =
      post.user_id === window.currentUser?.id
        ? "This is your post"
        : "Tap to message seller";

    detailImages.innerHTML = "";

    let images = [];
    if (Array.isArray(post.image_urls)) images = post.image_urls;
    else if (typeof post.image_urls === "string") {
      try { images = JSON.parse(post.image_urls); } catch {}
    }

    images.forEach(url => {
      const img = document.createElement("img");
      img.src = url;
      img.loading = "lazy";
      detailImages.appendChild(img);
    });

    detailPanel.onclick = null;

    if (post.user_id !== window.currentUser?.id) {
  detailPanel.onclick = startConversationAndSendMessage.bind(null, post);
}

// Wire Send Message button to send the typed message for THIS post.
if (detailMessageBtn) {
  detailMessageBtn.disabled = (post.user_id === window.currentUser?.id);
  detailMessageBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    __bfSendMessageFromDetail(post);
  };
}
if (chatInput) {
  chatInput.onclick = (e) => e.stopPropagation();
  chatInput.onkeydown = (e) => e.stopPropagation();
}

detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  
// --- Messaging helper: send from detail panel (BuyerFinder) ---
async function __bfSendMessageFromDetail(post) {
  if (!post) return alert("No post selected.");
  const me = window.currentUser?.id;
  const sellerId = post.user_id;
  const postId = post.id;

  const body = (chatInput?.value || "").trim();
  if (!body) return alert("Type a message first.");
  if (!me) return alert("You must sign in to message.");
  if (!postId || !sellerId) return alert("No post selected.");
  if (me === sellerId) return alert("You can't message yourself.");

  if (!window.Conversations?.getOrCreateConversation) {
    alert("Messaging system not loaded (conversations.js did not initialize).");
    return;
  }

  try {
    const convo = await window.Conversations.getOrCreateConversation({
      postId,
      buyerId: me,
      sellerId
    });

    const { error } = await window.supa.from("messages").insert({
      conversation_id: convo.id,
      sender_id: me,
      body
    });

    if (error) throw error;

    // Create an in-app notification for the other participant (best-effort)
    try {
      await window.supa.rpc("notify_message", {
        p_conversation_id: convo.id,
        p_message_body: body
      });
    } catch (e) {
      console.warn("notify_message failed (message still sent):", e);
    }

    if (chatInput) chatInput.value = "";
    // Optional hooks if you later add inbox/chat UI
    window.Messages?.loadInbox?.();
    window.Messages?.openConversation?.(convo.id);

    alert("Message sent ✅");
  } catch (err) {
    console.error("Send failed:", err);
    alert("Message failed. Check console for details.");
  }
}

function hideDetailPanel() {
    detailOverlay.classList.remove("active");
    detailPanel.classList.remove("active");
  }

  detailCloseBtn.onclick = hideDetailPanel;
  detailOverlay.onclick = hideDetailPanel;

  fabAdd.onclick = openModalForCreate;
  btnCancelPost.onclick = closeModal;
  btnSavePost.onclick = savePost;

  window.Posts = { loadPosts };

  loadPosts();
})();

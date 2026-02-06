// posts.js – posts grid, modal, detail panel, delete

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
});

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

  window.activePostType = window.activePostType || "selling";
  window.editingPostId = null;

  // ---------- MODAL ----------

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

  // ---------- IMAGE UPLOAD ----------

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

  // ---------- SAVE POST ----------

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
  }

  // ---------- LOAD POSTS ----------

  window.allPosts = [];
  
  async function loadPosts() {
    postsStatus.textContent = "Loading...";
    postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
if (error) {
  console.error(error);
  return;
}

window.allPosts = data || [];
renderPosts(window.allPosts);

    if (error) {
      postsStatus.textContent = "Failed to load posts.";
      return;
    }

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

  //------------LOAD MATCHES-----------

  async function loadMatches() {
  const user = window.currentUser;
  if (!user) return;

  const { data, error } = await supa
    .from("posts")
    .select("*");

  if (error) {
    console.error("Match load error:", error);
    return;
  }

  const selling = data.filter(p => p.type === "selling");
  const requesting = data.filter(p => p.type === "requesting");

  const matches = [];

  selling.forEach(sell => {
    const sellText = `${sell.title} ${sell.description || ""}`.toLowerCase();

    requesting.forEach(req => {
      const reqText = `${req.title} ${req.description || ""}`.toLowerCase();

      const keywords = sellText.split(/\s+/);

      const hit = keywords.some(word =>
        word.length > 3 && reqText.includes(word)
      );

      if (hit) {
        matches.push({ sell, req });
      }
    });
  });

  renderMatches(matches);
}

  // ---------- DETAIL PANEL ----------

  async function startConversationAndSendMessage(post) {
  console.error("🔥 SEND MESSAGE CLICKED 🔥");
  const user = window.currentUser;
  if (!user) {
    alert("You must be signed in to message.");
    return;
  }

  const isSeller = user.id === post.user_id;

  const buyerId = user.id;
  const sellerId = post.user_id;

  // Find existing conversation
  const { data: existing, error: findErr } = await supa
    .from("conversations")
    .select("*")
    .eq("post_id", post.id)
    .eq("seller_id", sellerId)
    .eq("buyer_id", buyerId)
    .maybeSingle();

  if (findErr) {
    console.error("Conversation lookup failed", findErr);
    alert("Conversation error");
    return;
  }

  let conversation = existing;

  // Create conversation if needed
  if (!conversation) {
    const { data: created, error: createErr } = await supa
      .from("conversations")
      .insert({
        post_id: post.id,
        seller_id: sellerId,
        buyer_id: buyerId,
      })
      .select()
      .single();

    if (createErr) {
      console.error("Conversation create failed", createErr);
      alert("Could not start conversation");
      return;
    }

    conversation = created;
  }
  
  const input = document.getElementById("chat-input");
const body = input?.value.trim();

if (!body) {
  alert("Type a message first.");
  return;
}

  // Insert first message
  const { error: msgErr } = await supa.from("messages").insert({
  conversation_id: conversation.id,
  sender_id: user.id,
  body,
});
  
  document.getElementById("chat-input").value = "";
alert("Message sent");

  if (msgErr) {
    console.error("Message send failed", msgErr);
    alert("Message failed to send");
    return;
  }

  // Open chat modal (UI can be empty for now)
  document.getElementById("chat-overlay").classList.add("active");
  document.getElementById("chat-modal").classList.add("active");
  }

  function openDetailPanel(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailMeta.textContent =
      post.type === "requesting" ? "Request" : "Selling";

    detailImages.innerHTML = "";
    let imgs = [];
    if (Array.isArray(post.image_urls)) imgs = post.image_urls;
    else if (typeof post.image_urls === "string") {
      try { imgs = JSON.parse(post.image_urls); } catch {}
    }

    imgs.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      detailImages.appendChild(img);
    });

    const existingDelete = detailPanel.querySelector(".delete-post-btn");
    if (existingDelete) existingDelete.remove();

    if (window.currentUser?.id === post.user_id) {
      const del = document.createElement("button");
      del.className = "delete-post-btn";
      del.textContent = "Delete Post";
      del.onclick = async () => {
        if (!confirm("Delete this post?")) return;
        await supa.from("posts").delete().eq("id", post.id);
        hideDetailPanel();
        loadPosts();
      };
      detailPanel.appendChild(del);
    }

    const msgBtn = document.getElementById("detail-message-btn");
if (msgBtn) {
  msgBtn.onclick = () => startConversationAndSendMessage(post);
}

detailOverlay.classList.add("active");
detailPanel.classList.add("active");

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
  let activeConversationId = null;
  window.Posts = {
  loadPosts,
  loadMatches
};
  loadPosts();
})();

// --- SEARCH SETUP ---
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
});

// --- SEARCH LOGIC ---
function handleSearch(e) {
  const q = e.target.value.trim().toLowerCase();

  if (!q) {
    renderPosts(window.allPosts);
    return;
  }

  const filtered = window.allPosts.filter(post =>
    post.title?.toLowerCase().includes(q) ||
    post.description?.toLowerCase().includes(q) ||
    post.type?.toLowerCase().includes(q)
  );

  renderPosts(filtered);
}
    

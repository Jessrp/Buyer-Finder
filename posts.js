// posts.js — posts grid, modal (create/edit), detail panel, search, delete/edit
// Goal: posts MUST load for guests. Auth only affects create/edit/delete UI.
(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("posts.js: window.supa missing");
    return;
  }

  // --------- STATE ----------
  let viewMode = "all";
  let sortDir = "desc";
  let editingPostId = null;
  let editingPostImages = [];

  window.activePostType = window.activePostType || "selling";

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

  const searchInput = document.getElementById("search-input");

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

  let ownerControlsEl = null;

  // --------- HELPERS ----------
  const normalizeType = (t) =>
    (t || "").toLowerCase().startsWith("request") ? "request" : "sell";

  const moneyText = (v) => (v ? `$${v}` : "");

  function parseImageUrls(image_urls, image_url) {
    if (Array.isArray(image_urls)) return image_urls;
    if (typeof image_urls === "string") {
      try {
        const arr = JSON.parse(image_urls);
        if (Array.isArray(arr)) return arr;
      } catch (_) {}
      if (image_urls.startsWith("http")) return [image_urls];
    }
    if (typeof image_url === "string") return [image_url];
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
    if (ownerControlsEl) return ownerControlsEl;

    ownerControlsEl = document.createElement("div");
    ownerControlsEl.style.display = "flex";
    ownerControlsEl.style.gap = "8px";
    ownerControlsEl.style.margin = "10px 0";

    const editBtn = document.createElement("button");
    editBtn.className = "btn small outline";
    editBtn.textContent = "Edit";

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Delete";

    ownerControlsEl.append(editBtn, delBtn);
    detailPanel.insertBefore(ownerControlsEl, detailPanel.children[1]);

    ownerControlsEl._editBtn = editBtn;
    ownerControlsEl._delBtn = delBtn;

    return ownerControlsEl;
  }

  // --------- LOAD POSTS ----------
  async function loadPosts(query = "") {
    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let req = supa.from("posts").select("*").order("created_at", { ascending: false });

    if (query) {
      req = req.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    const type = normalizeType(window.activePostType);
    const posts = data.filter((p) => normalizeType(p.type) === type);

    if (!posts.length) {
      postsStatus.textContent = "No posts yet.";
      return;
    }

    postsStatus.textContent = "";
    postsGrid.innerHTML = posts
      .map((p) => {
        const img = parseImageUrls(p.image_urls, p.image_url)[0];
        const canEdit = window.currentUser?.id === p.user_id;
        return `
          <article class="post" data-id="${p.id}">
            ${canEdit ? `<button class="edit-btn">✎</button>` : ""}
            ${img ? `<img src="${img}" />` : ""}
            <h3>${p.title}</h3>
            <p>${p.description || ""}</p>
            <small>${moneyText(p.price)}</small>
          </article>
        `;
      })
      .join("");

    attachHandlers(posts);
  }

  function attachHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((el) => {
      const id = el.dataset.id;
      const post = posts.find((p) => p.id === id);
      if (!post) return;

      el.addEventListener("click", () => openDetailPanel(post));

      const editBtn = el.querySelector(".edit-btn");
      editBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        openModalForEdit(post);
      });
    });
  }

  // --------- DETAIL PANEL ----------
  async function openDetailPanel(post) {
    const { data: profile } = await supa
      .from("profiles")
      .select("*")
      .eq("id", post.user_id)
      .maybeSingle();

    detailImages.innerHTML = "";
    parseImageUrls(post.image_urls, post.image_url).forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      detailImages.appendChild(img);
    });

    detailTitle.textContent = post.title;
    detailPrice.textContent = moneyText(post.price);
    detailDescription.textContent = post.description || "";
    detailMeta.textContent = normalizeType(post.type) === "request" ? "Request" : "Selling";
    detailSellerName.textContent = profile?.username || "Seller";
    detailSellerEmail.textContent = profile?.email || "";
    detailLocationText.textContent = post.location_text || "";

    const controls = ensureOwnerControls();
    const isOwner = window.currentUser?.id === post.user_id;
    controls.style.display = isOwner ? "flex" : "none";

    if (isOwner) {
      controls._editBtn.onclick = () => {
        hideDetailPanel();
        openModalForEdit(post);
      };
      controls._delBtn.onclick = async () => {
        if (!confirm("Delete this post?")) return;
        await supa.from("posts").delete().eq("id", post.id);
        hideDetailPanel();
        loadPosts(searchInput?.value || "");
      };
    }

    detailMessageBtn.onclick = () => handleSendMessage(post, profile);
    showDetailPanel();
  }

  // --------- MESSAGE ----------
  async function handleSendMessage(post, profile) {
    if (!window.currentUser) {
      alert("Sign in to send a message.");
      return;
    }
    if (!profile?.email) {
      alert("Seller has no contact info.");
      return;
    }

    const body = prompt("Message to seller:");
    if (!body) return;

    await supa.from("messages").insert({
      post_id: post.id,
      from_user: window.currentUser.id,
      to_user: post.user_id,
      body,
    });

    alert("Message sent.");
  }

  // --------- WIRES ----------
  fabAdd?.addEventListener("click", () => {
    if (!window.currentUser) {
      alert("Sign in first.");
      return;
    }
    editingPostId = null;
    modalBackdrop.classList.add("active");
  });

  btnCancelPost?.addEventListener("click", () => modalBackdrop.classList.remove("active"));
  btnSavePost?.addEventListener("click", savePost);
  detailCloseBtn?.addEventListener("click", hideDetailPanel);
  detailOverlay?.addEventListener("click", hideDetailPanel);

  // --------- EXPORT ----------
  window.Posts = { loadPosts };

  loadPosts();
})();

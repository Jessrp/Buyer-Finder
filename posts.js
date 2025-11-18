// posts.js
// Loads posts, saves posts, displays them, and handles the detail panel.

(function () {
  const supa = window.supa;

  // DOM
  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");

  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postType = document.getElementById("post-type");
  const postCategory = document.getElementById("post-category");
  const postCondition = document.getElementById("post-condition");
  const postLocation = document.getElementById("post-location");
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

  window.activePostType = window.activePostType || "selling";

  // ============================
  // OPEN/CLOSE MODAL
  // ============================
  function openModal() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }

    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postType.value = window.activePostType || "selling";
    postCategory.value = "";
    postCondition.value = "";
    postLocation.value = "";
    postImage.value = "";
    postModalHint.textContent = "";

    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  fabAdd?.addEventListener("click", openModal);
  btnCancelPost?.addEventListener("click", closeModal);

  // ============================
  // IMAGE UPLOAD
  // ============================
  async function uploadImages(files, userId) {
    if (!files?.length) return [];
    const urls = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path =
        "posts/" +
        userId +
        "-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2) +
        "." +
        ext;

      const { error: upErr } = await supa.storage
        .from("post_images")
        .upload(path, file);

      if (upErr) {
        console.log("Upload error:", upErr.message);
        continue;
      }

      const { data: urlData } = supa.storage
        .from("post_images")
        .getPublicUrl(path);

      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }

    return urls;
  }

  // ============================
  // SAVE POST
  // ============================
  async function savePost() {
    if (!window.currentUser) return alert("Sign in first.");

    const title = postTitle.value.trim();
    if (!title) return alert("Title is required.");

    const files = postImage.files;
    postModalHint.textContent = "Saving...";

    const imageUrls = await uploadImages(files, window.currentUser.id);

    const { error } = await supa.from("posts").insert({
      user_id: window.currentUser.id,
      title,
      description: postDescription.value.trim(),
      price: postPrice.value.trim() || null,
      type: postType.value,
      category: postCategory.value.trim(),
      condition: postCondition.value.trim(),
      location_text: postLocation.value.trim(),
      image_urls: imageUrls.length ? JSON.stringify(imageUrls) : null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.log(error.message);
      postModalHint.textContent = "Error saving post.";
      return;
    }

    postModalHint.textContent = "Saved!";
    setTimeout(() => {
      closeModal();
      loadPosts();
    }, 400);
  }

  btnSavePost?.addEventListener("click", savePost);

  // ============================
  // LOAD POSTS
  // ============================
  async function loadPosts(searchText = "") {
    if (!postsGrid || !postsStatus) return;

    postsGrid.innerHTML = "";
    postsStatus.textContent = "Loading posts…";

    let query = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (searchText) {
      const q = searchText.toLowerCase();
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      postsStatus.textContent = "Error loading posts.";
      console.log(error.message);
      return;
    }

    if (!data?.length) {
      postsStatus.textContent = "No posts found.";
      return;
    }

    const filtered = data.filter((p) => {
      const t =
        p.type?.toLowerCase() === "request" ? "request" : "selling";
      return t === window.activePostType;
    });

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map((p) => {
        let firstImg = "";

        if (p.image_urls) {
          try {
            const arr = JSON.parse(p.image_urls);
            if (arr.length) firstImg = arr[0];
          } catch {}
        }

        return `
          <article class="post" data-id="${p.id}">
            ${firstImg ? `<img src="${firstImg}">` : ""}
            <h3>${p.title}</h3>
            <p>${p.description || ""}</p>
            ${
              p.price
                ? `<small style="color:#22c55e;">$${p.price}</small>`
                : ""
            }
          </article>
        `;
      })
      .join("");

    attachDetailHandlers(filtered);
  }

  // ============================
  // DETAIL PANEL
  // ============================
  function openDetailUI() {
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  function closeDetailUI() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  detailCloseBtn?.addEventListener("click", closeDetailUI);
  detailOverlay?.addEventListener("click", closeDetailUI);

  // Load full post when clicked
  function attachDetailHandlers(posts) {
    const cards = document.querySelectorAll(".post[data-id]");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const id = Number(card.getAttribute("data-id"));
        const post = posts.find((p) => p.id === id);
        if (post) openDetail(post);
      });
    });
  }

  async function openDetail(post) {
    // Seller info
    const { data: profile } = await supa
      .from("profiles")
      .select("*")
      .eq("id", post.user_id)
      .maybeSingle();

    // Images
    detailImages.innerHTML = "";
    let urls = [];
    try {
      if (post.image_urls) urls = JSON.parse(post.image_urls);
    } catch {}

    if (urls.length) {
      urls.forEach((u) => {
        const img = document.createElement("img");
        img.src = u;
        detailImages.appendChild(img);
      });
    }

    detailTitle.textContent = post.title || "Untitled";
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? "$" + post.price : "";

    detailMeta.textContent = [
      post.category,
      post.condition,
      post.type === "request" ? "Request" : "Selling",
    ]
      .filter(Boolean)
      .join(" • ");

    detailSellerName.textContent = profile?.username || "Seller";
    detailSellerEmail.textContent = profile?.email || "";

    // Avatar
    detailSellerAvatar.innerHTML = "";
    const av = document.createElement("img");
    av.src =
      profile?.avatar_url ||
      "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111"/><text x="50%" y="55%" fill="#999" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    detailSellerAvatar.appendChild(av);

    detailLocationText.textContent =
      post.location_text || "Location not specified";

    // Mini-map (premium only)
    const isPremium = window.currentProfile?.premium;
    const lat = post.lat;
    const lng = post.lng;

    if (lat && lng && isPremium) {
      detailMinimapContainer.style.display = "block";
      if (window.BFMap?.renderMiniMap)
        window.BFMap.renderMiniMap(lat, lng);
    } else {
      detailMinimapContainer.style.display = "none";
    }

    detailMessageBtn.onclick = () => {
      alert("Messaging coming soon.");
    };

    openDetailUI();
  }

  // ============================
  // EXPORT
  // ============================
  window.Posts = {
    loadPosts,
  };

  loadPosts();
})();

// posts.js
(function () {
  const supa = window.supa;

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

  // detail panel
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

  let currentSearch = "";

  // helpers
  function normalizeImageUrls(field) {
    if (!field) return [];
    if (Array.isArray(field)) {
      return field.filter((u) => typeof u === "string" && u.length > 0);
    }
    if (typeof field === "string") {
      try {
        const arr = JSON.parse(field);
        if (Array.isArray(arr)) {
          return arr.filter((u) => typeof u === "string" && u.length > 0);
        }
      } catch {
        if (field.startsWith("http")) return [field];
      }
    }
    return [];
  }

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
        postModalHint.textContent =
          "Image upload error: " + uploadError.message;
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

  async function savePost() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) {
      alert("Sign in first.");
      return;
    }

    const title = postTitle.value.trim();
    if (!title) {
      alert("Title is required.");
      return;
    }

    const description = postDescription.value.trim();
    const price = postPrice.value.trim();
    const type = postType.value;
    const category = postCategory.value.trim();
    const condition = postCondition.value.trim();
    const locationText =
      postLocation.value.trim() || (profile && profile.location_text) || null;

    const lat =
      profile && typeof profile.lat === "number" ? profile.lat : null;
    const lng =
      profile && typeof profile.lng === "number" ? profile.lng : null;

    postModalHint.textContent = "Saving post...";

    const fileList = postImage.files;
    let imageUrls = [];
    if (fileList && fileList.length) {
      imageUrls = await uploadPostImages(fileList, user.id);
    }

    const isPremiumUser = !!(profile && profile.premium);

    const payload = {
      user_id: user.id,
      title,
      description,
      price: price || null,
      type,
      category: category || null,
      condition: condition || null,
      location_text: locationText,
      lat,
      lng,
      is_premium: isPremiumUser
    };

    if (imageUrls.length) {
      payload.image_urls = JSON.stringify(imageUrls);
    } else {
      payload.image_urls = null;
    }

    const { error } = await supa.from("posts").insert(payload);
    if (error) {
      console.log("Insert error:", error.message);
      postModalHint.textContent = "Error saving post: " + error.message;
      return;
    }

    postModalHint.textContent = "Saved!";
    setTimeout(() => {
      closeModal();
      loadPosts();
    }, 400);
  }

  async function loadPosts() {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let { data, error } = await supa
      .from("posts")
      .select(
        "id,user_id,title,description,price,type,category,condition,location_text,image_urls,is_premium,created_at"
      )
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("load posts error:", error.message);
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    if (!data || !data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
      postsGrid.innerHTML =
        "<p class='hint'>No posts yet in this category.</p>";
      return;
    }

    const typeFilter = (window.activePostType || "selling").toLowerCase();
    const search = currentSearch.toLowerCase();

    const filtered = data.filter((p) => {
      const t =
        (p.type || "").toString().toLowerCase() === "request"
          ? "request"
          : "selling";
      if (t !== typeFilter) return false;

      if (search) {
        const haystack = (
          (p.title || "") +
          " " +
          (p.description || "") +
          " " +
          (p.category || "") +
          " " +
          (p.location_text || "")
        ).toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      postsStatus.textContent = "";
      postsGrid.innerHTML =
        "<p class='hint'>No posts match this filter yet.</p>";
      return;
    }

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map((p) => {
        const imgs = normalizeImageUrls(p.image_urls);
        const primaryImage = imgs.length ? imgs[0] : null;

        const badge =
          p.is_premium && p.is_premium === true
            ? `<span class="badge premium">Premium</span>`
            : "";

        const metaBits = [];
        if (p.category) metaBits.push(p.category);
        if (p.condition) metaBits.push(p.condition);
        if (p.location_text) metaBits.push(p.location_text);

        const metaLine = metaBits.length
          ? `<small class="hint">${metaBits.join(" • ")}</small>`
          : "";

        const priceText = p.price ? `$${p.price}` : "";

        const imgHtml = primaryImage
          ? `<img src="${primaryImage}" alt="Post image" />`
          : "";

        return `
          <article class="post" data-post-id="${p.id}">
            ${imgHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <h3>${p.title || "Untitled"}</h3>
              ${badge}
            </div>
            <p>${p.description || ""}</p>
            ${metaLine}
            <small>${priceText}</small>
          </article>
        `;
      })
      .join("");

    attachPostClickHandlers(filtered);
  }

  function attachPostClickHandlers(posts) {
    const cards = postsGrid.querySelectorAll(".post[data-post-id]");
    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;
      card.addEventListener("click", () => openDetailPanel(post.id));
    });
  }

  function openDetailUI() {
    if (detailOverlay) detailOverlay.classList.add("active");
    if (detailPanel) detailPanel.classList.add("active");
  }

  function closeDetailUI() {
    if (detailOverlay) detailOverlay.classList.remove("active");
    if (detailPanel) detailPanel.classList.remove("active");
  }

  async function openDetailPanel(postId) {
    const { data: post, error } = await supa
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
    if (error || !post) {
      alert("Could not load post details.");
      return;
    }

    const { data: profile } = await supa
      .from("profiles")
      .select("username,email,avatar_url,lat,lng,location_text,premium")
      .eq("id", post.user_id)
      .maybeSingle();

    // images
    detailImages.innerHTML = "";
    const imgs = normalizeImageUrls(post.image_urls);
    if (imgs.length) {
      imgs.forEach((url, idx) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Post image " + (idx + 1);
        detailImages.appendChild(img);
      });
    }

    detailTitle.textContent = post.title || "Untitled";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailDescription.textContent = post.description || "";

    const metaBits = [];
    if (post.category) metaBits.push(post.category);
    if (post.condition) metaBits.push(post.condition);
    if (post.type) {
      const t =
        post.type.toString().toLowerCase() === "request"
          ? "Request"
          : "Selling";
      metaBits.push(t);
    }
    detailMeta.textContent = metaBits.join(" • ");

    // seller
    detailSellerAvatar.innerHTML = "";
    const avImg = document.createElement("img");
    if (profile?.avatar_url) {
      avImg.src = profile.avatar_url;
    } else {
      avImg.src =
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#111827"/><text x="50%" y="55%" fill="#9ca3af" font-size="28" text-anchor="middle">BF</text></svg>'
        );
    }
    detailSellerAvatar.appendChild(avImg);
    detailSellerName.textContent = profile?.username || "Seller";
    detailSellerEmail.textContent = profile?.email || "";

    const locText = post.location_text || profile?.location_text || "";
    detailLocationText.textContent = locText || "Location not specified.";

    const viewerProfile = window.currentProfile;
    const isViewerPremium = !!viewerProfile?.premium;
    const showMiniPref =
      localStorage.getItem("bf-show-minimap") !== "false";

    const lat = post.lat ?? profile?.lat ?? null;
    const lng = post.lng ?? profile?.lng ?? null;

    if (
      isViewerPremium &&
      showMiniPref &&
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

    if (detailMessageBtn) {
      detailMessageBtn.textContent = "Send message";
      detailMessageBtn.onclick = () => {
        alert("Messaging not wired up yet.");
      };
    }

    openDetailUI();
  }

  // events
  if (fabAdd) fabAdd.addEventListener("click", openModal);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

  if (detailCloseBtn)
    detailCloseBtn.addEventListener("click", closeDetailUI);
  if (detailOverlay)
    detailOverlay.addEventListener("click", closeDetailUI);

  window.Posts = {
    loadPosts,
    setSearchQuery(q) {
      currentSearch = (q || "").trim();
    }
  };

  // initial load
  loadPosts();
})();

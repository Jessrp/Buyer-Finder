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

  window.activePostType = window.activePostType || "selling";

  // ---------- helpers ----------
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

  async function enforcePostLimitForFree() {
    const user = window.currentUser;
    const profile = window.currentProfile;
    if (!user) return false;

    // Premium = unlimited
    if (profile && profile.premium) return true;

    // Free users = 5 posts max
    const { count, error } = await supa
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      console.log("post count error (ignoring):", error.message);
      return true; // don't block them if count failed
    }

    if ((count || 0) >= 5) {
      alert(
        "You reached the free plan limit of 5 posts.\nUpgrade to premium to post unlimited."
      );
      return false;
    }

    return true;
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
    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }

    const ok = await enforcePostLimitForFree();
    if (!ok) {
      postModalHint.textContent =
        "Free plan: post limit reached. Upgrade to premium for unlimited posts.";
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
    const locationText = postLocation.value.trim();

    postModalHint.textContent = "Saving post...";

    const fileList = postImage.files;
    let imageUrls = [];
    if (fileList && fileList.length) {
      imageUrls = await uploadPostImages(fileList, user.id);
    }

    const isPremiumUser =
      !!(window.currentProfile && window.currentProfile.premium);

    const { error } = await supa.from("posts").insert({
      user_id: user.id,
      title,
      description,
      price: price || null,
      type,
      category: category || null,
      condition: condition || null,
      location_text: locationText || null,
      image_urls: imageUrls.length ? JSON.stringify(imageUrls) : null,
      is_premium: isPremiumUser,
    });

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

  // --------- load posts ----------
  async function loadPosts() {
    if (!postsGrid || !postsStatus) return;

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let { data, error } = await supa
      .from("posts")
      .select("*")
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("load posts error:", error.message);
      postsStatus.textContent =
        "Error loading posts. Check console / Supabase.";
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

        const imgHtml = primaryImage
          ? `<img src="${primaryImage}" alt="Post image" />`
          : "";

        return `
          <article class="post">
            ${imgHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
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
  }

  // ---------- events ----------
  if (fabAdd) fabAdd.addEventListener("click", openModal);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

  window.Posts = {
    loadPosts,
  };
})();

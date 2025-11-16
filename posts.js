// posts.js
(function () {
  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postType = document.getElementById("post-type");
  const postImage = document.getElementById("post-image");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  window.activePostType = window.activePostType || "selling";

  function openModal() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    postTitle.value = "";
    postDescription.value = "";
    postPrice.value = "";
    postType.value = window.activePostType;
    postImage.value = "";
    postModalHint.textContent = "";
    modalBackdrop.classList.add("active");
  }

  function closeModal() {
    modalBackdrop.classList.remove("active");
  }

  async function uploadPostImage(file) {
    if (!file) return null;
    const user = window.currentUser;
    if (!user) return null;

    const ext = file.name.split(".").pop() || "jpg";
    const path = `posts/${user.id}-${Date.now()}.${ext}`;

    const { error } = await window.supa.storage
      .from("post_images")
      .upload(path, file, { upsert: true });
    if (error) {
      console.log("Upload error:", error.message);
      return null;
    }

    const { data } = window.supa.storage
      .from("post_images")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function savePost() {
    if (!window.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }
    const title = postTitle.value.trim();
    if (!title) return alert("Title is required.");
    const description = postDescription.value.trim();
    const price = postPrice.value.trim();
    const type = postType.value;

    postModalHint.textContent = "Saving post...";

    let imageUrl = null;
    const file = postImage.files[0];
    if (file) {
      imageUrl = await uploadPostImage(file);
    }

    const { error } = await window.supa.from("posts").insert({
      title,
      description,
      price: price || null,
      type,
      image_url: imageUrl,
      user_id: window.currentUser.id,
    });

    if (error) {
      console.log("Insert error:", error.message);
      postModalHint.textContent = "Error saving post.";
    } else {
      postModalHint.textContent = "Saved!";
      setTimeout(() => {
        closeModal();
        window.Posts.loadPosts();
      }, 400);
    }
  }

  async function loadPosts() {
    if (!postsStatus || !postsGrid) return;
    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let { data, error } = await window.supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("load posts error:", error.message);
      data = [];
      postsStatus.textContent =
        "Error loading posts. Check console or Supabase.";
    } else if (!data || !data.length) {
      postsStatus.textContent = "No posts yet. Be the first to post!";
    } else {
      postsStatus.textContent = "";
    }

    const filtered = (data || []).filter((p) => {
      const t =
        (p.type || "").toString().toLowerCase() === "request"
          ? "request"
          : "selling";
      return t === window.activePostType;
    });

    if (!filtered.length) {
      postsGrid.innerHTML = "<p class='hint'>No posts in this category yet.</p>";
      return;
    }

    postsGrid.innerHTML = filtered
      .map((p) => {
        let priceText = "";
        if (p.price) priceText = "$" + p.price;
        let imgHtml = "";
        if (p.image_url) {
          imgHtml = `<img src="${p.image_url}" alt="Post image" />`;
        }
        return `
          <article class="post">
            ${imgHtml}
            <h3>${p.title || "Untitled"}</h3>
            <p>${p.description || ""}</p>
            <small>${priceText}</small>
          </article>
        `;
      })
      .join("");
  }

  if (fabAdd) fabAdd.addEventListener("click", openModal);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

  window.Posts = {
    loadPosts,
  };
})();

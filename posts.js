// posts.js
window.BF = window.BF || {};

(function (BF) {
  BF.posts = BF.posts || {};

  const DEMO_POSTS = [
    {
      title: "Vintage Penny",
      description: "1969 penny, good condition.",
      price: "5",
      type: "selling",
    },
    {
      title: "Looking for used car",
      description: "Anything cheap but running.",
      price: "",
      type: "request",
    },
    {
      title: "Electric Guitar",
      description: "Teal guitar, used, plays great.",
      price: "120",
      type: "selling",
    },
  ];

  BF.posts.loadPosts = async function () {
    const supa = BF.supa;
    const state = BF.state;
    const ui = BF.ui;

    ui.postsStatus.textContent = "Loading posts...";
    ui.postsGrid.innerHTML = "";

    let data = [];
    let error = null;
    try {
      const res = await supa
        .from("post_drafts")
        .select("*")
        .order("updated_at", { ascending: false });
      data = res.data || [];
      error = res.error || null;
    } catch (e) {
      error = e;
    }

    if (error) {
      console.log("Error loading posts:", error.message || error);
      data = DEMO_POSTS;
      ui.postsStatus.textContent =
        "Showing demo posts (Supabase error, check console).";
    } else if (!data.length) {
      data = DEMO_POSTS;
      ui.postsStatus.textContent =
        "No posts yet in Supabase. Showing demo posts.";
    } else {
      ui.postsStatus.textContent = "";
    }

    const filtered = data.filter((p) => {
      const t =
        (p.type || "").toString().toLowerCase() === "request"
          ? "request"
          : "selling";
      return t === state.activePostType;
    });

    if (!filtered.length) {
      ui.postsGrid.innerHTML = "<p>No posts yet.</p>";
      return;
    }

    ui.postsGrid.innerHTML = filtered
      .map((p) => {
        let priceText = "";
        if (p.price) priceText = "$" + p.price;

        let imgHtml = "";
        const imgField = p.image_urls;
        if (Array.isArray(imgField) && imgField.length > 0) {
          imgHtml = `<img src="${imgField[0]}" alt="Post image" />`;
        } else if (typeof imgField === "string" && imgField.length > 0) {
          imgHtml = `<img src="${imgField}" alt="Post image" />`;
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
  };

  BF.posts.openModal = function () {
    const state = BF.state;
    const ui = BF.ui;

    if (!state.currentUser) {
      alert("You must sign in to add a post.");
      return;
    }

    ui.postTitle.value = "";
    ui.postDescription.value = "";
    ui.postPrice.value = "";
    ui.postType.value = state.activePostType;
    ui.postImage.value = "";
    ui.postModalHint.textContent = "";
    ui.modalBackdrop.classList.add("active");
  };

  BF.posts.closeModal = function () {
    BF.ui.modalBackdrop.classList.remove("active");
  };

  BF.posts.savePost = async function () {
    const supa = BF.supa;
    const state = BF.state;
    const ui = BF.ui;
    const user = state.currentUser;

    if (!user) {
      alert("You must sign in to add a post.");
      return;
    }

    const title = ui.postTitle.value.trim();
    if (!title) return alert("Title is required.");

    const description = ui.postDescription.value.trim();
    const price = ui.postPrice.value.trim();
    const type = ui.postType.value;

    ui.postModalHint.textContent = "Saving post...";

    let imageUrls = [];
    const file = ui.postImage.files[0];

    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posts/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supa.storage
        .from("post_images")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        ui.postModalHint.textContent =
          "Upload failed: " + uploadError.message + " (post not saved)";
        return;
      }

      const { data: urlData } = supa.storage
        .from("post_images")
        .getPublicUrl(path);

      imageUrls = [urlData.publicUrl];
    }

    const { error: insertError } = await supa.from("post_drafts").insert({
      user_id: user.id,
      title,
      description,
      price: price || null,
      type,
      image_urls: imageUrls,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      ui.postModalHint.textContent = "Error saving: " + insertError.message;
      return;
    }

    ui.postModalHint.textContent = "Saved!";
    setTimeout(() => {
      BF.posts.closeModal();
      BF.posts.loadPosts();
    }, 400);
  };
})(window.BF);
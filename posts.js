// posts.js – posts grid with BF+, My Posts, filters, delete, detail panel

let viewMode = "all"; // 'all' | 'mine'
let sortDir = "desc";

(function () {
  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  window.activePostType = window.activePostType || "selling";

  window.isPremiumUser = () => !!window.currentProfile?.premium;

  let editingPostId = null;
  let editingPostImages = [];

  /* ---------------- CORE LOAD ---------------- */

  async function loadPosts(query = "") {
    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser;

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    if (query.trim()) {
      req = req.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await req;

    if (error) {
      postsStatus.textContent = "Error loading posts";
      return;
    }

    const filtered = (data || []).filter(
      (p) =>
        (p.type || "").toLowerCase() === window.activePostType
    );

    if (!filtered.length) {
      postsStatus.textContent = "No posts found";
      return;
    }

    postsStatus.textContent = "";

    postsGrid.innerHTML = filtered
      .map((p) => {
        let img = "";
        try {
          const arr = JSON.parse(p.image_urls || "[]");
          if (arr.length) img = `<img src="${arr[0]}">`;
        } catch {}

        const isOwner = user?.id === p.user_id;

        return `
          <article class="post" data-post-id="${p.id}">
            ${
              isOwner
                ? `<div class="post-owner-actions">
                    <button class="edit-btn">✎</button>
                    <button class="delete-btn">🗑</button>
                  </div>`
                : ""
            }
            ${img}
            <h3>${p.title}</h3>
            <p>${p.description || ""}</p>
            <small>${p.price ? `$${p.price}` : ""}</small>
          </article>
        `;
      })
      .join("");

    attachHandlers(filtered);
  }

  /* ---------------- HANDLERS ---------------- */

  function attachHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach((card) => {
      const post = posts.find(
        (p) => String(p.id) === card.dataset.postId
      );
      if (!post) return;

      card.onclick = () => openDetail(post);

      card.querySelector(".edit-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openEdit(post);
      });

      card.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this post?")) return;
        await supa.from("posts").delete().eq("id", post.id);
        loadPosts();
      });
    });
  }

  /* ---------------- DETAIL ---------------- */

  function openDetail(post) {
    document.getElementById("detail-title").textContent = post.title;
    document.getElementById("detail-price").textContent =
      post.price ? `$${post.price}` : "";
    document.getElementById("detail-description").textContent =
      post.description || "";

    document.getElementById("detail-overlay").classList.add("active");
    document.getElementById("detail-panel").classList.add("active");
  }

  /* ---------------- EDIT ---------------- */

  function openEdit(post) {
    editingPostId = post.id;
    document.getElementById("post-title").value = post.title;
    document.getElementById("post-description").value = post.description || "";
    document.getElementById("post-price").value = post.price || "";
    document.getElementById("modal-backdrop").classList.add("active");
  }

  /* ---------------- PUBLIC API ---------------- */

  window.Posts = {
    loadPosts,
    setViewMode(mode) {
      viewMode = mode === "mine" ? "mine" : "all";
      loadPosts();
    },
    setPostType(type) {
      window.activePostType = type === "requesting" ? "requesting" : "selling";
      loadPosts();
    },
    search(q) {
      loadPosts(q);
    },
  };

  loadPosts();
})();

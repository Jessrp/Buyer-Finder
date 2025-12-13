// posts.js – full lifecycle: active / sold / found, BF+, filters, my posts

let viewMode = "all";
let sortDir = "desc";

(function () {
  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  window.activePostType = window.activePostType || "selling";
  window.isPremiumUser = () => !!window.currentProfile?.premium;

  /* ---------------- LOAD POSTS ---------------- */

  async function loadPosts(query = "") {
    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser;

    let req = supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: sortDir === "asc" });

    // Global feed hides sold/found
    if (viewMode === "all") {
      req = req.eq("status", "active");
    }

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
        const isOwner = user?.id === p.user_id;
        const badge =
          p.status !== "active"
            ? `<span class="status-badge">${p.status.toUpperCase()}</span>`
            : "";

        return `
          <article class="post" data-post-id="${p.id}">
            ${badge}
            ${
              isOwner
                ? `
                <div class="post-owner-actions">
                  <button class="mark-btn">${p.type === "selling" ? "MARK SOLD" : "MARK FOUND"}</button>
                </div>`
                : ""
            }
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

      card.querySelector(".mark-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();

        const newStatus =
          post.type === "selling" ? "sold" : "found";

        const ok = confirm(
          `Mark this post as ${newStatus.toUpperCase()}?`
        );
        if (!ok) return;

        await supa
          .from("posts")
          .update({ status: newStatus })
          .eq("id", post.id);

        loadPosts();
      });
    });
  }

  /* ---------------- PUBLIC API ---------------- */

  window.Posts = {
    loadPosts,
    setViewMode(mode) {
      viewMode = mode === "mine" ? "mine" : "all";
      loadPosts();
    },
    setPostType(type) {
      window.activePostType =
        type === "requesting" ? "requesting" : "selling";
      loadPosts();
    },
    search(q) {
      loadPosts(q);
    },
  };

  loadPosts();
})();

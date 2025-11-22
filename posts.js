alert("POSTS.JS LOADED");
async function loadPosts(query) {
    if (!postsGrid || !postsStatus) return;

    const q = (query || "").trim();

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    let req = supa
      .from("posts")
      .select("*")
      .order("is_premium", { ascending: false })
      .order("created_at", { ascending: false });

    if (q) {
      req = req.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }

    let { data, error } = await req;

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

  // at bottom:
  window.Posts = {
    loadPosts,
  };
})();

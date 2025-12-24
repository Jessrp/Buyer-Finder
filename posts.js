// posts.js — STABLE RENDER VERSION

(() => {
  if (!window.supa) return;

  const supa = window.supa;
  const postsGrid = document.getElementById("posts-grid");
  const statusEl = document.getElementById("posts-status");

  window.Posts = { loadPosts };

  let isRendering = false;

  async function loadPosts() {
    if (isRendering) return;
    isRendering = true;

    statusEl && (statusEl.textContent = "Loading posts…");

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error loading posts:\n" + error.message);
      isRendering = false;
      return;
    }

    postsGrid.innerHTML = "";
    statusEl.textContent = "";

    if (!data || data.length === 0) {
      statusEl.textContent = "No posts yet";
      isRendering = false;
      return;
    }

    data.forEach(renderPost);
    isRendering = false;
  }

  function renderPost(post) {
    const card = document.createElement("div");
    card.className = "post-card";

    let imagesHtml = "";
    if (Array.isArray(post.images)) {
      imagesHtml = post.images
        .map(
          url =>
            `<div class="post-image-wrap">
               <img src="${url}" loading="lazy" />
             </div>`
        )
        .join("");
    }

    card.innerHTML = `
      ${imagesHtml}
      <h4>${post.title}</h4>
      <div class="price">${post.price ?? ""}</div>
      <div class="hint">${post.type}</div>
    `;

    postsGrid.appendChild(card);
  }
})();

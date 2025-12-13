// posts.js — SOLD / FOUND support added (stable, no UI injection)

(() => {
  const supa = window.supa;
  if (!supa) return;

  let editingPostId = null;
  let editingPostImages = [];

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailDescription = document.getElementById("detail-description");
  const detailPrice = document.getElementById("detail-price");
  const detailMeta = document.getElementById("detail-meta");

  const detailMarkSoldBtn = document.getElementById("detail-mark-sold");
  const detailMarkFoundBtn = document.getElementById("detail-mark-found");
  const detailDeleteBtn = document.getElementById("detail-delete-btn");

  function normalizeType(t) {
    return t === "requesting" ? "request" : "sell";
  }

  async function loadPosts(query = "") {
    if (!postsGrid) return;

    postsGrid.innerHTML = "";
    postsStatus.textContent = "Loading posts…";

    const user = window.currentUser;
    const viewMode = window.viewMode || "all";
    const activeType = normalizeType(window.activePostType || "selling");

    let req = supa
      .from("posts")
      .select("*")
      .eq("type", activeType)
      .order("created_at", { ascending: false });

    if (viewMode === "all") {
      req = req.eq("status", "active");
    }

    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    if (query) {
      req = req.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await req;

    if (error) {
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    if (!data.length) {
      postsStatus.textContent = "No posts found.";
      return;
    }

    postsStatus.textContent = "";

    postsGrid.innerHTML = data.map(p => {
      const mine = user?.id === p.user_id;
      const badge =
        p.status !== "active"
          ? `<span class="post-status">${p.status.toUpperCase()}</span>`
          : "";

      return `
        <article class="post" data-id="${p.id}">
          ${badge}
          <h3>${p.title}</h3>
          <p>${p.description || ""}</p>
          ${p.price ? `<small>$${p.price}</small>` : ""}
          ${mine ? `<button class="edit-btn">✎</button>` : ""}
        </article>
      `;
    }).join("");

    attachHandlers(data);
  }

  function attachHandlers(posts) {
    postsGrid.querySelectorAll(".post").forEach(card => {
      const id = card.dataset.id;
      const post = posts.find(p => p.id === id);
      if (!post) return;

      card.addEventListener("click", e => {
        if (e.target.tagName === "BUTTON") return;
        openDetail(post);
      });

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.onclick = e => {
          e.stopPropagation();
          openDetail(post);
        };
      }
    });
  }

  function showDetail() {
    detailOverlay?.classList.add("active");
    detailPanel?.classList.add("active");
  }

  function hideDetail() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
  }

  async function openDetail(post) {
    detailTitle.textContent = post.title;
    detailDescription.textContent = post.description || "";
    detailPrice.textContent = post.price ? `$${post.price}` : "";
    detailMeta.textContent = post.status === "active"
      ? ""
      : post.status.toUpperCase();

    const mine = window.currentUser?.id === post.user_id;

    if (detailMarkSoldBtn) {
      detailMarkSoldBtn.style.display = mine && post.type === "sell" ? "" : "none";
      detailMarkSoldBtn.onclick = () => updateStatus(post.id, "sold");
    }

    if (detailMarkFoundBtn) {
      detailMarkFoundBtn.style.display = mine && post.type === "request" ? "" : "none";
      detailMarkFoundBtn.onclick = () => updateStatus(post.id, "found");
    }

    if (detailDeleteBtn) {
      detailDeleteBtn.style.display = mine ? "" : "none";
      detailDeleteBtn.onclick = () => deletePost(post.id);
    }

    showDetail();
  }

  async function updateStatus(postId, status) {
    await supa.from("posts").update({ status }).eq("id", postId);
    hideDetail();
    loadPosts();
  }

  async function deletePost(postId) {
    if (!confirm("Delete this post permanently?")) return;
    await supa.from("posts").delete().eq("id", postId);
    hideDetail();
    loadPosts();
  }

  detailCloseBtn?.addEventListener("click", hideDetail);
  detailOverlay?.addEventListener("click", hideDetail);

  window.Posts = { loadPosts };
  loadPosts();
})();

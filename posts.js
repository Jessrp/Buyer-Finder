// posts.js – posts grid, modal, detail panel, delete
(function () {
  console.error("🔥 POSTS.JS LOADED 🔥");

  const supa = window.supa;

  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  const fabAdd = document.getElementById("fab-add");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const postImage = document.getElementById("post-image");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailImages = document.getElementById("detail-images");

  window.activePostType = window.activePostType || "selling";
  window.editingPostId = null;

  // ===== ADDITION #1 (GLOBAL POST CACHE) =====
  window.allPosts = [];
  // ============================================

  // ---------- MODAL ----------
  function openModalForCreate() { /* unchanged */ }
  function openModalForEdit(post) { /* unchanged */ }
  function closeModal() { /* unchanged */ }

  // ---------- IMAGE UPLOAD ----------
  async function uploadPostImages(files, userId) { /* unchanged */ }

  // ---------- SAVE POST ----------
  async function savePost() { /* unchanged */ }

  // ---------- LOAD POSTS ----------
  async function loadPosts() {
    postsStatus.textContent = "Loading...";
    postsGrid.innerHTML = "";

    const { data, error } = await supa
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      postsStatus.textContent = "Failed to load posts.";
      return;
    }

    // ===== ADDITION #2 (STORE RAW POSTS FOR SEARCH) =====
    window.allPosts = data || [];
    // ========================================

    const filtered = data.filter((p) => {
      const t = p.type === "requesting" ? "request" : "selling";
      return t === window.activePostType;
    });

    postsStatus.textContent = "";
    postsGrid.innerHTML = filtered.length
      ? filtered.map(renderPostCard).join("")
      : "<p class='hint'>No posts yet.</p>";

    attachPostHandlers(filtered);
  }

  function renderPostCard(p) { /* unchanged */ }
  function attachPostHandlers(posts) { /* unchanged */ }

  // ===== ADDITION #3 (SEARCH HANDLER) =====
  function handleSearch(e) {
    const q = e.target.value.trim().toLowerCase();

    const base = window.allPosts.filter((p) => {
      const t = p.type === "requesting" ? "request" : "selling";
      return t === window.activePostType;
    });

    const results = !q
      ? base
      : base.filter(p =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.price?.toString().includes(q)
        );

    postsGrid.innerHTML = results.length
      ? results.map(renderPostCard).join("")
      : "<p class='hint'>No results.</p>";

    attachPostHandlers(results);
  }
  // =======================================

  // ---------- LOAD MATCHES ----------
  async function loadMatches() { /* unchanged */ }

  // ---------- DETAIL PANEL ----------
  async function startConversationAndSendMessage(post) { /* unchanged */ }
  function openDetailPanel(post) { /* unchanged */ }
  function hideDetailPanel() { /* unchanged */ }

  detailCloseBtn.onclick = hideDetailPanel;
  detailOverlay.onclick = hideDetailPanel;

  fabAdd.onclick = openModalForCreate;
  btnCancelPost.onclick = closeModal;
  btnSavePost.onclick = savePost;

  window.Posts = { loadPosts, loadMatches };

  // ===== ADDITION #4 (SEARCH INPUT LISTENER) =====
  setTimeout(() => {
    const searchInput = document.getElementById("searchinput") || document.getElementById("searchInput");
    const searchBtn = document.getElementById("search-btn");

    if (searchInput) searchInput.addEventListener("input", handleSearch);
    if (searchBtn) searchBtn.addEventListener("click", () => handleSearch({ target: searchInput }));

    console.log("🔍 Search initialized:", searchInput, searchBtn);
  }, 0);
  // ==============================================

  loadPosts();
})();

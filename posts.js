// posts.js — Stable feed + My Posts + type filters + detail panel owner actions (edit/delete/sold/found)
// Works even if your DB uses type = 'sell'/'request' OR legacy 'selling'/'requesting'

let viewMode = "all";   // 'all' | 'mine'
let sortDir = "desc";   // 'asc' | 'desc'

// filter toggles (both on = ALL)
let showSelling = true;
let showRequesting = true;

(function () {
  const supa = window.supa;

  // Feed
  const postsGrid = document.getElementById("posts-grid");
  const postsStatus = document.getElementById("posts-status");

  // Detail panel (must exist in your HTML already)
  const detailOverlay = document.getElementById("detail-overlay");
  const detailPanel = document.getElementById("detail-panel");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailImages = document.getElementById("detail-images");
  const detailTitle = document.getElementById("detail-title");
  const detailPrice = document.getElementById("detail-price");
  const detailDescription = document.getElementById("detail-description");
  const detailMeta = document.getElementById("detail-meta");
  const detailSellerName = document.getElementById("detail-seller-name");
  const detailSellerEmail = document.getElementById("detail-seller-email");
  const detailMessageBtn = document.getElementById("detail-message-btn");

  // Create/Edit modal (if present, we’ll use it; if not, we fall back to prompts)
  const modalBackdrop = document.getElementById("modal-backdrop");
  const postTitle = document.getElementById("post-title");
  const postDescription = document.getElementById("post-description");
  const postPrice = document.getElementById("post-price");
  const btnCancelPost = document.getElementById("btn-cancel-post");
  const btnSavePost = document.getElementById("btn-save-post");
  const postModalHint = document.getElementById("post-modal-hint");

  // Safety: BF+ truth
  window.isPremiumUser = () => !!window.currentProfile?.premium;

  // Active category used elsewhere in your app
  // We normalize this on every filter decision anyway.
  window.activePostType = window.activePostType || "selling"; // or 'requesting'

  // Track what’s currently open in detail
  let activeDetailPost = null;
  let editingPostId = null;

  injectMyPostsAndTypeFilters();

  /* -------------------- NORMALIZERS -------------------- */

  function normalizeDbType(typeRaw) {
    const t = (typeRaw || "").toString().toLowerCase();
    // Accept multiple historical values, normalize to 'sell' or 'request'
    if (t === "sell" || t === "selling") return "sell";
    if (t === "request" || t === "requesting") return "request";
    return "sell";
  }

  function currentTypeFilter() {
    // When both toggles on -> return null (means ALL)
    // else return a Set of allowed normalized types
    const allowed = new Set();
    if (showSelling) allowed.add("sell");
    if (showRequesting) allowed.add("request");
    return allowed.size === 2 ? null : allowed;
  }

  function normalizeStatus(statusRaw) {
    const s = (statusRaw || "active").toString().toLowerCase();
    if (s === "sold") return "sold";
    if (s === "found") return "found";
    return "active";
  }

  /* -------------------- UI INJECTION (SAFE, MINIMAL) -------------------- */

  function injectMyPostsAndTypeFilters() {
    if (!postsGrid?.parentElement) return;
    if (document.getElementById("bf-feed-controls")) return;

    const bar = document.createElement("div");
    bar.id = "bf-feed-controls";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.flexWrap = "wrap";
    bar.style.margin = "8px 8px 0 8px";
    bar.style.alignItems = "center";

    bar.innerHTML = `
      <button id="bf-toggle-selling" class="active" title="Toggle Selling">⬆</button>
      <button id="bf-toggle-requesting" class="active" title="Toggle Requesting">⬇</button>
      <button id="bf-toggle-mine" title="Toggle My Posts">MY POSTS</button>
    `;

    postsGrid.parentElement.prepend(bar);

    const sellBtn = document.getElementById("bf-toggle-selling");
    const reqBtn = document.getElementById("bf-toggle-requesting");
    const mineBtn = document.getElementById("bf-toggle-mine");

    const syncBtnState = () => {
      sellBtn.classList.toggle("active", showSelling);
      reqBtn.classList.toggle("active", showRequesting);
      mineBtn.classList.toggle("active", viewMode === "mine");
    };

    sellBtn.onclick = () => {
      showSelling = !showSelling;
      // Don’t allow both off. Humans love breaking things.
      if (!showSelling && !showRequesting) showRequesting = true;
      syncBtnState();
      loadPosts(window.__lastSearch || "");
    };

    reqBtn.onclick = () => {
      showRequesting = !showRequesting;
      if (!showSelling && !showRequesting) showSelling = true;
      syncBtnState();
      loadPosts(window.__lastSearch || "");
    };

    mineBtn.onclick = () => {
      viewMode = viewMode === "mine" ? "all" : "mine";
      syncBtnState();
      loadPosts(window.__lastSearch || "");
    };

    syncBtnState();
  }

  function ensureOwnerActionsContainer() {
    if (!detailPanel) return null;

    let box = detailPanel.querySelector("#bf-owner-actions");
    if (box) return box;

    box = document.createElement("div");
    box.id = "bf-owner-actions";
    box.style.display = "none";
    box.style.gap = "8px";
    box.style.marginTop = "10px";
    box.style.flexWrap = "wrap";

    // Insert near the top of the detail panel content
    const anchor = detailMeta?.parentElement || detailPanel;
    anchor.appendChild(box);

    return box;
  }

  /* -------------------- FEED LOAD -------------------- */

  async function loadPosts(query = "") {
    if (!postsGrid || !postsStatus) return;

    window.__lastSearch = query || "";

    postsStatus.textContent = "Loading posts...";
    postsGrid.innerHTML = "";

    const user = window.currentUser;

    let req = supa.from("posts").select("*").order("created_at", {
      ascending: sortDir === "asc",
    });

    // Global feed: hide sold/found (status must exist, but we handle missing gracefully)
    if (viewMode === "all") {
      req = req.eq("status", "active");
    }

    // My Posts: show everything (history)
    if (viewMode === "mine" && user?.id) {
      req = req.eq("user_id", user.id);
    }

    if (query && query.trim()) {
      const q = query.trim();
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await req;

    if (error) {
      console.log("load posts error:", error.message || error);
      postsStatus.textContent = "Error loading posts.";
      return;
    }

    const allowedTypes = currentTypeFilter();

    const filtered = (data || []).filter((p) => {
      const t = normalizeDbType(p.type);
      if (allowedTypes && !allowedTypes.has(t)) return false;

      // Also respect your legacy window.activePostType if it’s being used elsewhere:
      // If activePostType is set to one side, keep it. If not, ignore.
      // But we do NOT let it override the toggle logic.
      return true;
    });

    if (!filtered.length) {
      postsStatus.textContent = "No posts found.";
      return;
    }

    postsStatus.textContent = "";

    const currentUser = window.currentUser;

    postsGrid.innerHTML = filtered
      .map((p) => {
        const isOwner = currentUser?.id && p.user_id === currentUser.id;

        const status = normalizeStatus(p.status);
        const badge =
          viewMode === "mine" && status !== "active"
            ? `<span class="status-badge">${status.toUpperCase()}</span>`
            : "";

        return `
          <article class="post" data-post-id="${p.id}">
            ${badge}
            ${isOwner ? `<button class="edit-btn" title="Edit">✎</button>` : ""}
            <h3>${escapeHtml(p.title || "Untitled")}</h3>
            <p>${escapeHtml(p.description || "")}</p>
            <small>${p.price ? `$${escapeHtml(String(p.price))}` : ""}</small>
          </article>
        `;
      })
      .join("");

    attachPostHandlers(filtered);
  }

  function attachPostHandlers(posts) {
    const cards = postsGrid.querySelectorAll(".post[data-post-id]");

    cards.forEach((card) => {
      const id = card.getAttribute("data-post-id");
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return;

      card.addEventListener("click", () => openDetailPanel(post));

      const editBtn = card.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openEdit(post);
        });
      }
    });
  }

  /* -------------------- DETAIL PANEL -------------------- */

  async function openDetailPanel(post) {
    if (!detailPanel || !detailOverlay) return;

    // Re-fetch latest (so status edits show instantly)
    let fullPost = post;
    try {
      const { data } = await supa.from("posts").select("*").eq("id", post.id).maybeSingle();
      if (data) fullPost = data;
    } catch (_) {}

    activeDetailPost = fullPost;

    // Fill basic fields
    if (detailImages) detailImages.innerHTML = ""; // keep quiet if you don’t have images
    if (detailTitle) detailTitle.textContent = fullPost.title || "Untitled";
    if (detailPrice) detailPrice.textContent = fullPost.price ? `$${fullPost.price}` : "";
    if (detailDescription) detailDescription.textContent = fullPost.description || "";

    if (detailMeta) {
      const t = normalizeDbType(fullPost.type) === "request" ? "Request" : "Selling";
      const s = normalizeStatus(fullPost.status);
      detailMeta.textContent = s === "active" ? t : `${t} • ${s.toUpperCase()}`;
    }

    // Seller info (minimal)
    if (detailSellerName) detailSellerName.textContent = "User";
    if (detailSellerEmail) {
      detailSellerEmail.textContent = window.isPremiumUser()
        ? (fullPost.user_id ? "" : "")
        : "BF+ required to view contact";
    }

    // Message button
    if (detailMessageBtn) {
      detailMessageBtn.onclick = () => handleSendMessage(fullPost);
    }

    // Owner actions in detail panel
    const ownerBox = ensureOwnerActionsContainer();
    const isOwner = window.currentUser?.id && fullPost.user_id === window.currentUser.id;

    if (ownerBox) {
      ownerBox.style.display = isOwner ? "flex" : "none";
      if (isOwner) {
        const status = normalizeStatus(fullPost.status);
        const typeNorm = normalizeDbType(fullPost.type);

        ownerBox.innerHTML = `
          <button id="bf-detail-edit">Edit</button>
          <button id="bf-detail-delete">Delete</button>
          ${
            status === "active"
              ? `<button id="bf-detail-mark">${typeNorm === "sell" ? "Mark Sold" : "Mark Found"}</button>`
              : `<button id="bf-detail-relist">Relist</button>`
          }
        `;

        ownerBox.querySelector("#bf-detail-edit")?.addEventListener("click", () => openEdit(fullPost));
        ownerBox.querySelector("#bf-detail-delete")?.addEventListener("click", () => deletePost(fullPost));
        ownerBox.querySelector("#bf-detail-mark")?.addEventListener("click", () => markStatus(fullPost, typeNorm === "sell" ? "sold" : "found"));
        ownerBox.querySelector("#bf-detail-relist")?.addEventListener("click", () => markStatus(fullPost, "active"));
      }
    }

    // Show
    detailOverlay.classList.add("active");
    detailPanel.classList.add("active");
  }

  function hideDetailPanel() {
    detailOverlay?.classList.remove("active");
    detailPanel?.classList.remove("active");
    activeDetailPost = null;
  }

  detailCloseBtn?.addEventListener("click", hideDetailPanel);
  detailOverlay?.addEventListener("click", hideDetailPanel);

  /* -------------------- OWNER ACTIONS -------------------- */

  function openEdit(post) {
    editingPostId = post.id;

    // If modal exists, use it
    if (modalBackdrop && postTitle && postDescription && postPrice) {
      postTitle.value = post.title || "";
      postDescription.value = post.description || "";
      postPrice.value = post.price || "";
      postModalHint && (postModalHint.textContent = "Editing post");
      modalBackdrop.classList.add("active");
      return;
    }

    // Fallback prompts (no modal available)
    const newTitle = prompt("Edit title:", post.title || "");
    if (newTitle == null) return;
    const newDesc = prompt("Edit description:", post.description || "");
    if (newDesc == null) return;
    const newPrice = prompt("Edit price:", post.price || "");
    if (newPrice == null) return;

    saveEdit(post.id, { title: newTitle.trim(), description: newDesc.trim(), price: newPrice.trim() || null });
  }

  async function saveEdit(id, payload) {
    try {
      const { error } = await supa.from("posts").update(payload).eq("id", id);
      if (error) throw error;

      // Refresh detail + feed
      if (activeDetailPost && String(activeDetailPost.id) === String(id)) {
        await openDetailPanel({ id }); // will refetch
      }
      loadPosts(window.__lastSearch || "");
    } catch (e) {
      alert("Edit failed: " + (e.message || e));
    }
  }

  async function deletePost(post) {
    const ok = confirm("Delete this post permanently?");
    if (!ok) return;

    try {
      const { error } = await supa.from("posts").delete().eq("id", post.id);
      if (error) throw error;

      hideDetailPanel();
      loadPosts(window.__lastSearch || "");
    } catch (e) {
      alert("Delete failed: " + (e.message || e));
    }
  }

  async function markStatus(post, status) {
    try {
      const { error } = await supa.from("posts").update({ status }).eq("id", post.id);
      if (error) throw error;

      // If global feed and we marked sold/found, it should disappear immediately
      if (viewMode === "all" && status !== "active") {
        hideDetailPanel();
      } else {
        // Refresh detail contents
        await openDetailPanel(post);
      }
      loadPosts(window.__lastSearch || "");
    } catch (e) {
      alert("Update failed: " + (e.message || e));
    }
  }

  /* -------------------- MESSAGING (SEND + READ LIMITS) -------------------- */

  async function handleSendMessage(post) {
    const user = window.currentUser;
    if (!user) {
      alert("Sign in to send messages.");
      return;
    }

    const isPremium = window.isPremiumUser();

    const { data: counter } = await supa
      .from("message_counters")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const sent = counter?.sent_count || 0;
    const received = counter?.received_count || 0;

    // Read lock (we don’t show message bodies anywhere yet, but this enforces the rule)
    if (!isPremium && received >= 3) {
      alert("You’ve reached your free message limit. Upgrade to BF+ to read messages.");
      return;
    }

    // Send lock
    if (!isPremium && sent >= 3) {
      alert("Free users can only send 3 messages. Upgrade to BF+.");
      return;
    }

    const body = prompt("Your message:");
    if (!body || !body.trim()) return;

    const { error } = await supa.from("messages").insert({
      post_id: post.id,
      from_user: user.id,
      to_user: post.user_id,
      body: body.trim(),
    });

    if (error) {
      alert("Failed to send message: " + error.message);
      return;
    }

    await supa.from("message_counters").upsert({
      user_id: user.id,
      sent_count: sent + 1,
    });

    await supa.rpc("increment_received", { uid: post.user_id }).catch(() => {});
    alert("Message sent.");
  }

  /* -------------------- MODAL SAVE (IF YOUR MODAL EXISTS) -------------------- */

  btnCancelPost?.addEventListener("click", () => modalBackdrop?.classList.remove("active"));

  btnSavePost?.addEventListener("click", async () => {
    if (!editingPostId) {
      // If your create flow lives elsewhere, we do nothing here.
      // (We’re not breaking your add-post system.)
      modalBackdrop?.classList.remove("active");
      return;
    }

    const payload = {
      title: (postTitle?.value || "").trim(),
      description: (postDescription?.value || "").trim(),
      price: (postPrice?.value || "").trim() || null,
    };

    if (!payload.title) {
      alert("Title is required.");
      return;
    }

    postModalHint && (postModalHint.textContent = "Saving...");
    await saveEdit(editingPostId, payload);
    postModalHint && (postModalHint.textContent = "Saved ✓");
    setTimeout(() => {
      modalBackdrop?.classList.remove("active");
      postModalHint && (postModalHint.textContent = "");
    }, 250);
  });

  /* -------------------- EXPORT API -------------------- */

  window.Posts = {
    loadPosts,
    search(q) {
      loadPosts(q || "");
    },
    setViewMode(mode) {
      viewMode = mode === "mine" ? "mine" : "all";
      loadPosts(window.__lastSearch || "");
    },
    setSort(dir) {
      sortDir = dir === "asc" ? "asc" : "desc";
      loadPosts(window.__lastSearch || "");
    },
  };

  // Small util to avoid HTML injection in titles/descriptions
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Initial load
  loadPosts("");
})();

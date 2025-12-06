/* -----------------------------------------
   POSTS.JS — Handles all feed + filtering logic
------------------------------------------ */

const supabase = window.supabaseClient;

/* -----------------------------------------
   LOAD POSTS (GLOBAL FEED)
------------------------------------------ */

async function loadPosts(query = "", type = "all") {
  const container = document.getElementById("posts-grid");
  container.innerHTML = "<p class='hint'>Loading...</p>";

  let sql = supabase.from("posts").select("*").order("created_at", { ascending: false });

  if (query.length > 0) {
    sql = sql.ilike("title", `%${query}%`);
  }

  if (type === "request") {
    sql = sql.eq("post_type", "request");
  }

  const { data, error } = await sql;
  if (error) {
    container.innerHTML = "<p class='hint'>Error loading posts.</p>";
    return;
  }

  const filtered = data.filter((p) => p.status !== "sold" && p.status !== "found");

  if (filtered.length === 0) {
    container.innerHTML = "<p class='hint'>No posts found.</p>";
    return;
  }

  container.innerHTML = "";
  filtered.forEach(renderPostItem);
}

/* -----------------------------------------
   LOAD MY POSTS
------------------------------------------ */

async function loadMyPosts() {
  if (!window.currentUser) {
    alert("You must be logged in.");
    return;
  }

  showView("view-posts");

  const container = document.getElementById("posts-grid");
  container.innerHTML = "<p class='hint'>Loading...</p>";

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", window.currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p class='hint'>Error loading your posts.</p>";
    return;
  }

  let posts = data;

  if (!window.myPostsShowSelling) {
    posts = posts.filter((p) => p.post_type !== "selling");
  }

  if (!window.myPostsShowRequests) {
    posts = posts.filter((p) => p.post_type !== "request");
  }

  if (posts.length === 0) {
    container.innerHTML = "<p class='hint'>No posts match your filter.</p>";
    return;
  }

  container.innerHTML = "";
  posts.forEach(renderPostItem);
}

/* -----------------------------------------
   RENDER A POST ITEM
------------------------------------------ */

function renderPostItem(post) {
  const container = document.getElementById("posts-grid");
  const box = document.createElement("div");
  box.className = "post-item";

  const color = post.post_type === "selling" ? "red" : "blue";
  const statusLabel =
    post.status === "sold"
      ? "<span class='hint'>(SOLD)</span>"
      : post.status === "found"
      ? "<span class='hint'>(FOUND)</span>"
      : "";

  box.innerHTML = `
    <h3>${post.title} ${statusLabel}</h3>
    <p>${post.description}</p>
    <p class="hint">${post.location || "No location"}</p>
    <p class="hint">Type: <strong style="color:${color}">${post.post_type}</strong></p>
    <button class="btn small outline">Details</button>
  `;

  box.querySelector("button").onclick = () => openPostDetail(post);

  container.appendChild(box);
}

/* -----------------------------------------
   OPEN POST DETAIL PANEL
------------------------------------------ */

function openPostDetail(post) {
  window.currentPost = post;

  document.getElementById("detail-title").innerText = post.title;
  document.getElementById("detail-desc").innerText = post.description;
  document.getElementById("detail-location").innerText = post.location || "No location";
  document.getElementById("detail-price").innerText = post.price
    ? `$${post.price}`
    : "No price";

  document.getElementById("detail-images").innerHTML = "";
  if (post.image_url) {
    document.getElementById(
      "detail-images"
    ).innerHTML = `<img src="${post.image_url}" />`;
  }

  document.getElementById("detail-created-at").innerText = post.created_at;

  // Owner actions
  const ownerBlock = document.getElementById("detail-owner-actions");
  if (window.currentUser && post.user_id === window.currentUser.id) {
    ownerBlock.style.display = "flex";
  } else {
    ownerBlock.style.display = "none";
  }

  // Log match attempt
  if (window.currentUser && post.user_id !== window.currentUser.id) {
    createMatchRecord(post.id);
  }

  showView("view-post-detail");
}

/* -----------------------------------------
   MATCH LOGGING
------------------------------------------ */

async function createMatchRecord(postId) {
  if (!window.currentUser) return;

  await supabase.from("matches").insert({
    user_id: window.currentUser.id,
    post_id: postId,
  });
}

async function loadMatches() {
  if (!window.currentUser) {
    alert("Login first.");
    return;
  }

  const list = document.getElementById("matches-list");
  list.innerHTML = "<p class='hint'>Loading...</p>";

  const { data, error } = await supabase
    .from("matches")
    .select("id, post_id, posts(title, description)")
    .eq("user_id", window.currentUser.id)
    .order("id", { ascending: false });

  if (error) {
    list.innerHTML = "<p class='hint'>Error loading matches.</p>";
    return;
  }

  if (data.length === 0) {
    list.innerHTML = "<p class='hint'>No matches found.</p>";
    return;
  }

  list.innerHTML = "";

  data.forEach((row) => {
    const item = document.createElement("div");
    item.className = "post-item";

    item.innerHTML = `
      <h3>${row.posts.title}</h3>
      <p>${row.posts.description}</p>
      <button class="btn small outline">View</button>
    `;

    item.querySelector("button").onclick = () => {
      openPostDetail({ ...row.posts, id: row.post_id });
    };

    list.appendChild(item);
  });
}

/* -----------------------------------------
   SEARCH LOGGING (for ML ranking)
------------------------------------------ */

async function recordSearchQuery(query) {
  if (!window.currentUser) return;

  await supabase.from("search_log").insert({
    user_id: window.currentUser.id,
    query,
  });
}
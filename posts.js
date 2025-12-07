/* -----------------------------------------
   POSTS.JS — Feed, My Posts, Filters, Matches
------------------------------------------ */

const sb = window.supabaseClient;

/* -----------------------------------------
   LOAD GLOBAL FEED
------------------------------------------ */

async function loadPosts(query = "", type = "all") {
  const grid = document.getElementById("posts-grid");
  grid.innerHTML = `<p class="hint">Loading...</p>`;

  let q = sb.from("posts").select("*").order("created_at", { ascending: false });

  if (query.trim().length > 0) {
    q = q.ilike("title", `%${query}%`);
  }

  if (type === "request") {
    q = q.eq("post_type", "request");
  }

  const { data, error } = await q;

  if (error) {
    grid.innerHTML = `<p class="hint">Error loading posts.</p>`;
    return;
  }

  const visible = data.filter(
    (p) => p.status !== "sold" && p.status !== "found"
  );

  if (visible.length === 0) {
    grid.innerHTML = `<p class="hint">No posts found.</p>`;
    return;
  }

  grid.innerHTML = "";
  visible.forEach(renderPostCard);
}

/* -----------------------------------------
   LOAD MY POSTS
------------------------------------------ */

window.showSelling = true;
window.showRequesting = true;

async function loadMyPosts() {
  if (!window.currentUser) {
    alert("You must be logged in.");
    return;
  }

  showView("view-posts");
  const grid = document.getElementById("posts-grid");
  grid.innerHTML = `<p class="hint">Loading...</p>`;

  const { data, error } = await sb
    .from("posts")
    .select("*")
    .eq("user_id", window.currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = `<p class="hint">Error loading your posts.</p>`;
    return;
  }

  let posts = data;

  if (!window.showSelling) posts = posts.filter((p) => p.post_type !== "selling");
  if (!window.showRequesting) posts = posts.filter((p) => p.post_type !== "request");

  if (posts.length === 0) {
    grid.innerHTML = `<p class="hint">No posts match your filter.</p>`;
    return;
  }

  grid.innerHTML = "";
  posts.forEach(renderPostCard);
}

/* -----------------------------------------
   RENDER A POST CARD
------------------------------------------ */

function renderPostCard(post) {
  const grid = document.getElementById("posts-grid");
  const div = document.createElement("div");
  div.className = "post-card";

  const color = post.post_type === "selling" ? "var(--accent-red)" : "var(--accent-blue)";
  const status =
    post.status === "sold"
      ? `<span class="hint">(SOLD)</span>`
      : post.status === "found"
      ? `<span class="hint">(FOUND)</span>`
      : "";

  div.innerHTML = `
    <h3>${post.title} ${status}</h3>
    <p>${post.description}</p>
    <p class="hint">${post.location || "No location"}</p>
    <p class="hint" style="color:${color}; font-weight:bold;">${post.post_type.toUpperCase()}</p>
    <button class="detail-btn">Details</button>
  `;

  div.querySelector(".detail-btn").onclick = () => openPostDetail(post);

  grid.appendChild(div);
}

/* -----------------------------------------
   OPEN POST DETAIL (NO UI CHANGE YET)
------------------------------------------ */

function openPostDetail(post) {
  // For now just show a quick preview — you can open your full detail UI here.
  alert(
    `${post.title}\n\n${post.description}\n\nLocation: ${
      post.location || "N/A"
    }\nType: ${post.post_type}`
  );

  // Log match attempt:
  if (window.currentUser && post.user_id !== window.currentUser.id) {
    recordMatch(post.id);
  }
}

/* -----------------------------------------
   RECORD MATCH
------------------------------------------ */

async function recordMatch(postId) {
  if (!window.currentUser) return;

  await sb.from("matches").insert({
    user_id: window.currentUser.id,
    post_id: postId,
  });
}

/* -----------------------------------------
   LOAD MATCHES
------------------------------------------ */

async function loadMatches() {
  if (!window.currentUser) {
    alert("Login required.");
    return;
  }

  const grid = document.getElementById("matches-grid");
  grid.innerHTML = `<p class="hint">Loading...</p>`;

  const { data, error } = await sb
    .from("matches")
    .select("id, post_id, posts(title, description)")
    .eq("user_id", window.currentUser.id)
    .order("id", { ascending: false });

  if (error) {
    grid.innerHTML = `<p class="hint">Error loading matches.</p>`;
    return;
  }

  if (data.length === 0) {
    grid.innerHTML = `<p class="hint">No matches found.</p>`;
    return;
  }

  grid.innerHTML = "";

  data.forEach((row) => {
    const div = document.createElement("div");
    div.className = "post-card";

    div.innerHTML = `
      <h3>${row.posts.title}</h3>
      <p>${row.posts.description}</p>
      <button class="detail-btn">View</button>
    `;

    div.querySelector(".detail-btn").onclick = () =>
      openPostDetail({ ...row.posts, id: row.post_id });

    grid.appendChild(div);
  });
}

/* -----------------------------------------
   SEARCH LOGGING
------------------------------------------ */

async function recordSearch(query) {
  if (!window.currentUser) return;
  await sb.from("search_log").insert({
    user_id: window.currentUser.id,
    query,
  });
}
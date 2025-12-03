// posts.js

async function loadPosts() {
  try {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading posts:", error);
      return;
    }

    const container = document.getElementById("postsContainer");
    if (!container) {
      console.error("postsContainer not found in DOM");
      return;
    }

    container.innerHTML = "";

    posts.forEach(post => {
      const div = document.createElement("div");
      div.classList.add("post-card");

      div.innerHTML = `
        <h3>${post.title}</h3>
        <p>${post.description}</p>
        <p><strong>$${post.price}</strong></p>
        ${post.image_url ? `<img src="${post.image_url}" class="post-img" />` : ""}
      `;

      // open detail view
      div.addEventListener("click", () => openPostDetail(post));

      container.appendChild(div);
    });

  } catch (err) {
    console.error("loadPosts crashed:", err);
  }
}

function openPostDetail(post) {
  const panel = document.getElementById("postDetailPanel");
  if (!panel) return;

  panel.innerHTML = `
    <button class="close-btn" onclick="closePostDetail()">X</button>
    <h2>${post.title}</h2>
    <p>${post.description}</p>
    <p><strong>$${post.price}</strong></p>
    ${post.image_url ? `<img src="${post.image_url}" class="post-img-large" />` : ""}
  `;

  panel.classList.add("active");
}

function closePostDetail() {
  const panel = document.getElementById("postDetailPanel");
  if (panel) panel.classList.remove("active");
}

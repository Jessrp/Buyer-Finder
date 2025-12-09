/* -----------------------------------------
   POSTS.JS — rendering only
------------------------------------------ */

window.renderPosts = function (posts) {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;

  grid.innerHTML = "";

  posts.forEach((post) => {
    const card = document.createElement("div");
    card.className = "post-card";

    const imgWrap = document.createElement("div");
    imgWrap.className = "post-image-wrapper";

    const img = document.createElement("img");

    let imageUrl = null;

    if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
      imageUrl = post.image_urls[0];
    }

    img.src =
      imageUrl ||
      "https://via.placeholder.com/300x200.png?text=No+Image";

    imgWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "post-body";

    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title || "Untitled";

    const meta = document.createElement("div");
    meta.className = "post-meta";
    const loc = post.location_text || "";
    const type =
      post.type === "sell"
        ? "Selling"
        : post.type === "request"
        ? "Requesting"
        : "";
    meta.textContent = [type, loc].filter(Boolean).join(" • ");

    const price = document.createElement("div");
    price.className = "post-price";
    price.textContent = post.price ? `$${post.price}` : "";

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(price);

    card.appendChild(imgWrap);
    card.appendChild(body);

    grid.appendChild(card);
  });
};

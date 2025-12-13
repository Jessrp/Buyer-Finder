// app.js – MY POSTS + Selling / Requesting filters + search wiring

(function () {
  function ensureControls() {
    let container = document.getElementById("feed-controls");

    if (!container) {
      container = document.createElement("div");
      container.id = "feed-controls";
      container.style.display = "flex";
      container.style.flexWrap = "wrap";
      container.style.gap = "8px";
      container.style.margin = "8px";

      const allBtn = document.createElement("button");
      allBtn.id = "btn-all-posts";
      allBtn.textContent = "ALL POSTS";

      const mineBtn = document.createElement("button");
      mineBtn.id = "btn-my-posts";
      mineBtn.textContent = "MY POSTS";

      const sellBtn = document.createElement("button");
      sellBtn.id = "btn-selling";
      sellBtn.textContent = "SELLING";

      const reqBtn = document.createElement("button");
      reqBtn.id = "btn-requesting";
      reqBtn.textContent = "REQUESTING";

      const search = document.createElement("input");
      search.id = "feed-search";
      search.placeholder = "Search posts…";
      search.style.flex = "1";

      container.append(
        allBtn,
        mineBtn,
        sellBtn,
        reqBtn,
        search
      );

      const feed = document.getElementById("posts-grid")?.parentElement;
      if (feed) feed.prepend(container);
    }
  }

  ensureControls();

  const allBtn = document.getElementById("btn-all-posts");
  const mineBtn = document.getElementById("btn-my-posts");
  const sellBtn = document.getElementById("btn-selling");
  const reqBtn = document.getElementById("btn-requesting");
  const search = document.getElementById("feed-search");

  // Defaults
  allBtn?.classList.add("active");
  sellBtn?.classList.add("active");

  allBtn.onclick = () => {
    Posts.setViewMode("all");
    allBtn.classList.add("active");
    mineBtn.classList.remove("active");
  };

  mineBtn.onclick = () => {
    Posts.setViewMode("mine");
    mineBtn.classList.add("active");
    allBtn.classList.remove("active");
  };

  sellBtn.onclick = () => {
    Posts.setPostType("selling");
    sellBtn.classList.add("active");
    reqBtn.classList.remove("active");
  };

  reqBtn.onclick = () => {
    Posts.setPostType("requesting");
    reqBtn.classList.add("active");
    sellBtn.classList.remove("active");
  };

  let searchTimeout;
  search.oninput = (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      Posts.search(e.target.value);
    }, 300);
  };
})();

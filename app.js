// app.js – feed controls + BF+ advanced filters

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

      container.innerHTML = `
        <button id="btn-all-posts" class="active">ALL POSTS</button>
        <button id="btn-my-posts">MY POSTS</button>
        <button id="btn-selling" class="active">SELLING</button>
        <button id="btn-requesting">REQUESTING</button>
        <input id="feed-search" placeholder="Search…" style="flex:1" />

        <input id="price-min" type="number" placeholder="Min $" style="width:80px" />
        <input id="price-max" type="number" placeholder="Max $" style="width:80px" />
        <select id="distance-filter">
          <option value="">Distance</option>
          <option value="5">5 mi</option>
          <option value="10">10 mi</option>
          <option value="25">25 mi</option>
        </select>
      `;

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

  const priceMin = document.getElementById("price-min");
  const priceMax = document.getElementById("price-max");
  const distanceSel = document.getElementById("distance-filter");

  let filters = {
    query: "",
    priceMin: null,
    priceMax: null,
    distance: null,
  };

  function applyFilters() {
    if (
      (filters.priceMin || filters.priceMax || filters.distance) &&
      !window.isPremiumUser()
    ) {
      alert("BF+ required to use advanced filters.");
      priceMin.value = "";
      priceMax.value = "";
      distanceSel.value = "";
      filters.priceMin = filters.priceMax = filters.distance = null;
      return;
    }

    Posts.search(filters.query, filters);
  }

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
    filters.query = e.target.value;
    searchTimeout = setTimeout(applyFilters, 300);
  };

  priceMin.onchange = () => {
    filters.priceMin = priceMin.value ? Number(priceMin.value) : null;
    applyFilters();
  };

  priceMax.onchange = () => {
    filters.priceMax = priceMax.value ? Number(priceMax.value) : null;
    applyFilters();
  };

  distanceSel.onchange = () => {
    filters.distance = distanceSel.value ? Number(distanceSel.value) : null;
    applyFilters();
  };
})();

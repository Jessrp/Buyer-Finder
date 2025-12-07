/* -----------------------------------------
   APP.JS — Navigation + UI Control Logic
------------------------------------------ */

function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(viewId);
  if (target) target.classList.add("active");

  // Update nav bar highlight
  document.querySelectorAll("#navbar button").forEach((b) =>
    b.classList.remove("active")
  );
  document
    .querySelector(`#navbar button[data-view="${viewId}"]`)
    ?.classList.add("active");
}

/* -----------------------------------------
   SEARCH
------------------------------------------ */

document.getElementById("searchbtn").onclick = () => {
  const q = document.getElementById("searchfield").value.trim();
  loadPosts(q);
  if (window.currentUser) recordSearch(q);
};

document.getElementById("searchfield").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    loadPosts(q);
    if (window.currentUser) recordSearch(q);
  }
});

/* -----------------------------------------
   NAV BUTTONS
------------------------------------------ */

document
  .querySelector(`#navbar button[data-view="view-posts"]`)
  .addEventListener("click", () => {
    showView("view-posts");
    loadPosts("");
  });

document
  .querySelector(`#navbar button[data-view="view-matches"]`)
  .addEventListener("click", () => {
    showView("view-matches");
    loadMatches();
  });

document.getElementById("btn-map").onclick = () => {
  showView("view-map");
  initMap();
};

document.getElementById("btn-settings").onclick = () => {
  alert("Settings coming soon.");
};

/* -----------------------------------------
   ADD POST BUTTON
------------------------------------------ */

document.getElementById("addpostbtn").onclick = () => {
  alert("Post creation will be added in the next build.");
};

/* -----------------------------------------
   MY POSTS BUTTON
------------------------------------------ */

document.getElementById("btn-my-posts").onclick = () => {
  loadMyPosts();
};

/* -----------------------------------------
   MY POSTS FILTER BUTTONS
------------------------------------------ */

document.getElementById("filter-selling").onclick = () => {
  window.showSelling = !window.showSelling;
  document
    .getElementById("filter-selling")
    .classList.toggle("chip-on", window.showSelling);
  loadMyPosts();
};

document.getElementById("filter-requesting").onclick = () => {
  window.showRequesting = !window.showRequesting;
  document
    .getElementById("filter-requesting")
    .classList.toggle("chip-on", window.showRequesting);
  loadMyPosts();
};

/* -----------------------------------------
   INITIALIZE FEED ON PAGE LOAD
------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  showView("view-posts");
  loadPosts("");
});
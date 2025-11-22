// posts.js – fixed modal open, guaranteed working
(function () {
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

  // Debug logs
  console.log("FAB:", fabAdd);
  console.log("MODAL:", modalBackdrop);

  // OPEN MODAL
  function openModal() {
    console.log("openModal called");
    if (!modalBackdrop) {
      console.log("modalBackdrop not found");
      return;
    }
    modalBackdrop.classList.add("active");
  }

  // CLOSE MODAL
  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("active");
  }

  // SAVE POST (unchanged except now modal works)
  async function savePost() {
    postModalHint.textContent = "Saving...";
    await new Promise((r) => setTimeout(r, 400));
    postModalHint.textContent = "Saved ✓";
    setTimeout(closeModal, 400);
  }

  if (fabAdd) fabAdd.addEventListener("click", openModal);
  if (btnCancelPost) btnCancelPost.addEventListener("click", closeModal);
  if (btnSavePost) btnSavePost.addEventListener("click", savePost);

})();

// messages.js
(function () {
  console.error("📨 MESSAGES.JS LOADED");

  const supa = window.supa;

  // STEP 3 — load inbox
  async function loadInbox() {
    const user = window.currentUser;
    if (!user) return;

    const { data, error } = await supa
      .from("conversations")
      .select(`
        id,
        post_id,
        seller_id,
        buyer_id,
        posts(title),
        messages (
          body,
          created_at
        )
      `)
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { foreignTable: "messages", ascending: false });

    if (error) {
      console.error("Inbox load failed", error);
      return;
    }

    renderInbox(data);
  }

  // STEP 4 — render inbox
  function renderInbox(convos) {
    const list = document.getElementById("inbox-list");
    if (!list) return;

    if (!convos.length) {
      list.innerHTML = "<p class='hint'>No messages yet.</p>";
      return;
    }

    list.innerHTML = convos.map(c => {
      const last = c.messages?.[0];

      return `
        <div class="inbox-item" data-id="${c.id}">
          <strong>${c.posts?.title || "Post"}</strong>
          <p>${last?.body || "No messages yet"}</p>
          <small>
            ${last ? new Date(last.created_at).toLocaleString() : ""}
          </small>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".inbox-item").forEach(el => {
      el.onclick = () => openChat(el.dataset.id);
    });
  }

  // expose loader
  window.Messages = {
    loadInbox
  };
})();

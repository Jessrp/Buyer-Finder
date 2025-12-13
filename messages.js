// messages.js — inbox + BF+ gated message viewing

(() => {
  const supa = window.supa;
  if (!supa) {
    console.error("messages.js: window.supa missing");
    return;
  }

  const inboxList =
    document.getElementById("inbox-list") ||
    document.getElementById("messages-list") ||
    document.getElementById("notifications-list");

  if (!inboxList) {
    console.warn("messages.js: no inbox container found");
    return;
  }

  const FREE_RECEIVE_LIMIT = 3;

  function isPremium() {
    return !!window.currentProfile?.premium;
  }

  async function loadInbox() {
    const user = window.currentUser;
    if (!user) {
      inboxList.innerHTML = `<p class="hint">Sign in to view messages.</p>`;
      return;
    }

    inboxList.innerHTML = `<p class="hint">Loading messages…</p>`;

    const { data, error } = await supa
      .from("messages")
      .select(`
        id,
        post_id,
        from_user,
        to_user,
        body,
        created_at
      `)
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("loadInbox error:", error.message);
      inboxList.innerHTML = `<p class="hint">Failed to load messages.</p>`;
      return;
    }

    if (!data || !data.length) {
      inboxList.innerHTML = `<p class="hint">No messages yet.</p>`;
      return;
    }

    const received = data.filter(m => m.to_user === user.id);
    const canReadAll = isPremium() || received.length <= FREE_RECEIVE_LIMIT;

    inboxList.innerHTML = data
      .map((m, idx) => {
        const isReceived = m.to_user === user.id;
        const locked = isReceived && !canReadAll && idx >= FREE_RECEIVE_LIMIT;

        return `
          <div class="message-item ${locked ? "locked" : ""}">
            <small>${new Date(m.created_at).toLocaleString()}</small>
            <p>
              ${
                locked
                  ? `<em>🔒 Message locked. Upgrade to BF+ to read.</em>`
                  : escapeHtml(m.body)
              }
            </p>
          </div>
        `;
      })
      .join("");

    if (!canReadAll) {
      inboxList.insertAdjacentHTML(
        "afterbegin",
        `<div class="bfplus-lock-banner">
          <strong>BF+ required</strong>
          <p>You’ve reached the free message limit.</p>
        </div>`
      );
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Refresh inbox when auth/profile changes
  supa.auth.onAuthStateChange(() => loadInbox());

  // Public API (used by app.js if needed)
  window.Messages = {
    loadInbox
  };

  // Initial
  setTimeout(loadInbox, 300);
})();

// notifications.js
console.error("🔔 NOTIFICATIONS.JS LOADED");

(function () {
  let channel = null;

  function el(id) { return document.getElementById(id); }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  async function ensurePermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  }

  function maybeBrowserNotify(n) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const title = n.title || "Alert";
    const body = n.body || "";
    try {
      new Notification(title, { body, icon: "/icon.png" });
    } catch {}
  }

  function renderItem(n) {
    const data = n.data || {};
    const type = n.type || "generic";

    const title = (n.title || type).toString();
    const body = (n.body || "").toString();
    const when = fmtTime(n.created_at);

    const readClass = n.read ? "read" : "unread";
    return `
      <div class="inbox-item notif-item ${readClass}" data-id="${n.id}" data-type="${type}"
           data-conversation="${data.conversation_id || ""}">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
        <div class="hint">${escapeHtml(when)}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function markRead(id) {
    if (!window.supa) return;
    try {
      await window.supa.from("notifications").update({ read: true }).eq("id", id);
    } catch {}
  }

  function bindClicks() {
    const list = el("notifications-list");
    if (!list) return;

    list.querySelectorAll(".notif-item").forEach(item => {
      item.onclick = async () => {
        const id = item.dataset.id;
        const type = item.dataset.type;
        const convoId = item.dataset.conversation;

        // Mark read (best-effort)
        if (id) await markRead(id);

        if (type === "message" && convoId) {
          // Open chat
          if (window.Messages && typeof window.Messages.openConversation === "function") {
            window.Messages.openConversation(convoId);
          } else {
            console.warn("Messages.openConversation not available");
          }
          // switch view if app.js helper exists
          if (typeof window.setActiveView === "function") window.setActiveView("chat");
          return;
        }

        if (type === "match") {
          if (typeof window.setActiveView === "function") window.setActiveView("matches");
          if (window.Matches && typeof window.Matches.loadMatches === "function") {
            window.Matches.loadMatches();
          }
          return;
        }
      };
    });
  }

  async function load() {
    const list = el("notifications-list");
    if (!list) return;

    if (!window.currentUser) {
      list.innerHTML = "<p class='hint'>Sign in to see alerts.</p>";
      return;
    }

    list.innerHTML = "<p class='hint'>Loading alerts…</p>";

    try {
      const { data, error } = await window.supa
        .from("notifications")
        .select("*")
        .eq("user_id", window.currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = data || [];
      if (!rows.length) {
        list.innerHTML = "<p class='hint'>No alerts yet.</p>";
        return;
      }

      list.innerHTML = rows.map(renderItem).join("");
      bindClicks();
      ensurePermission();
    } catch (e) {
      console.error("Notifications load failed:", e);
      list.innerHTML = "<p class='hint'>Failed to load alerts. Check console.</p>";
    }
  }

  function initRealtime() {
    if (!window.supa) return;
    if (channel) window.supa.removeChannel(channel);

    channel = window.supa
      .channel("notifications-" + (window.currentUser?.id || "anon"))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload?.new;
          if (!n) return;
          if (!window.currentUser || n.user_id !== window.currentUser.id) return;

          // If notifications view is open, prepend
          const list = el("notifications-list");
          if (list) {
            const html = renderItem(n);
            list.insertAdjacentHTML("afterbegin", html);
            bindClicks();
          }

          // Also a browser notification if permitted
          maybeBrowserNotify(n);
        }
      )
      .subscribe();
  }

  window.Notifications = { load, initRealtime };
})();

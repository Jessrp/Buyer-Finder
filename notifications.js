// notifications.js
console.error("🔔 NOTIFICATIONS.JS LOADED");

(function () {
  let channel = null;
  let enabled = false;

  function el(id) { return document.getElementById(id); }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return ""; }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }

  function toast(n) {
    if (!enabled) return;
    try {
      const title = n.title || "BuyerFinder";
      const body = n.body || "";
      const notif = new Notification(title, { body });
      setTimeout(() => notif.close?.(), 6000);
    } catch {}
  }

  function render(list) {
    const box = el("notifications-list");
    if (!box) return;

    if (!window.currentUser) {
      box.innerHTML = "<p class='hint'>Sign in to see notifications.</p>";
      return;
    }

    if (!list?.length) {
      box.innerHTML = "<p class='hint'>No notifications yet.</p>";
      return;
    }

    box.innerHTML = list.map(n => {
      const type = escapeHtml(n.type || "generic");
      const title = escapeHtml(n.title || "Notification");
      const body = escapeHtml(n.body || "");
      const when = fmtTime(n.created_at);
      const unread = n.read ? "" : " style=\"border-left:4px solid #00e5ff;\"";

      return `
        <div class="inbox-item" data-nid="${n.id}"${unread}>
          <strong>${title}</strong>
          <p>${body}</p>
          <p class="hint">${type} • ${when}</p>
        </div>
      `;
    }).join("");

    box.querySelectorAll(".inbox-item").forEach(item => {
      item.onclick = () => markRead(item.dataset.nid);
    });
  }

  async function load() {
    const supa = window.supa;
    const user = window.currentUser;
    const box = el("notifications-list");
    if (box) box.innerHTML = "<p class='hint'>Loading…</p>";

    if (!supa || !user) {
      render([]);
      return;
    }

    const { data, error } = await supa
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("notifications load error", error);
      if (box) box.innerHTML = "<p class='hint'>Failed to load notifications.</p>";
      return;
    }

    render(data || []);
  }

  async function markRead(id) {
    const supa = window.supa;
    const user = window.currentUser;
    if (!supa || !user || !id) return;
    await supa.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
    load();
  }

  function subscribe() {
    const supa = window.supa;
    const user = window.currentUser;
    if (!supa || !user) return;

    if (channel) supa.removeChannel(channel);

    channel = supa
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload?.new;
          if (!n) return;
          load();
          toast(n);
        }
      )
      .subscribe();
  }

  async function init() {
    enabled = await requestPermission();
    setTimeout(() => {
      load();
      subscribe();
    }, 300);
  }

  window.Notifications = { init, load, toast };
})();

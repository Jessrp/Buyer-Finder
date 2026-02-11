// notifications.js
console.error("🔔 NOTIFICATIONS.JS LOADED");

var supa = window.supa;
let notificationsEnabled = false;
let notifChannel = null;

function initNotifications() {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  if (Notification.permission === "granted") {
    notificationsEnabled = true;
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      notificationsEnabled = permission === "granted";
    });
  }
}

function notify(title, body) {
  if (!notificationsEnabled) return;
  if (document.hasFocus()) return;

  try {
    new Notification(title, { body });
  } catch (e) {
    console.warn("Notification failed", e);
  }
}

/* ---------- LOAD + RENDER NOTIFICATIONS (DB) ---------- */
function renderNotifications(items) {
  const list = document.getElementById("notifications-list");
  if (!list) return;

  if (!items?.length) {
    list.innerHTML = "<p class='hint'>No notifications yet.</p>";
    return;
  }

  list.innerHTML = items.map(n => {
    const title = n.title || (n.type === "message" ? "New message" : "Notification");
    const body = n.body || "";
    const when = n.created_at ? new Date(n.created_at).toLocaleString() : "";
    const unreadClass = n.read ? "" : " style='border-left:4px solid #22c55e; padding-left:10px;'";
    return `
      <div class="inbox-item"${unreadClass} data-id="${n.id}">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
        <small class="hint">${escapeHtml(when)}</small>
      </div>
    `;
  }).join("");

  // mark as read on click
  list.querySelectorAll(".inbox-item").forEach(el => {
    el.onclick = async () => {
      const id = el.dataset.id;
      try {
        await supa.from("notifications").update({ read: true }).eq("id", id);
        el.style.borderLeft = "";
        el.style.paddingLeft = "";
      } catch (e) {
        console.warn("Failed to mark read", e);
      }
    };
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadNotifications() {
  if (!window.currentUser) return renderNotifications([]);

  const { data, error } = await supa
    .from("notifications")
    .select("id, user_id, type, title, body, data, created_at, read")
    .eq("user_id", window.currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Notifications load error", error);
    renderNotifications([]);
    return;
  }

  renderNotifications(data || []);
}

function initNotificationRealtime() {
  if (!window.currentUser) return;
  if (!supa) supa = window.supa;
  if (!supa) return;

  if (notifChannel) supa.removeChannel(notifChannel);

  notifChannel = supa
    .channel("notifications-" + window.currentUser.id)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${window.currentUser.id}`
      },
      (payload) => {
        const n = payload?.new;
        if (!n) return;

        // refresh list if user is on notifications view
        const view = document.getElementById("view-notifications");
        if (view?.classList.contains("active")) loadNotifications();

        // browser notification
        notify(n.title || "Notification", n.body || "");
      }
    )
    .subscribe();
}

window.Notifications = {
  init: initNotifications,
  notify,
  loadNotifications,
  initRealtime: initNotificationRealtime
};

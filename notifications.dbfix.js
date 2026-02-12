// notifications.js
console.error("🔔 NOTIFICATIONS.JS LOADED");

(function () {
  const supa = () => window.supa;

  let notificationsEnabled = false;
  let notifChannel = null;

  function init() {
    // Browser notification permission (optional)
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        notificationsEnabled = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          notificationsEnabled = p === "granted";
        });
      }
    }
  }

  function toast(title, body) {
    // Browser-level pop only when app not focused
    if (!notificationsEnabled) return;
    if (document.hasFocus()) return;
    try {
      new Notification(title || "BuyerFinder", { body: body || "" });
    } catch (e) {
      console.warn("Browser Notification failed", e);
    }
  }

  function ensureListEl() {
    return document.getElementById("notifications-list");
  }

  function render(items) {
    const list = ensureListEl();
    if (!list) return;

    if (!window.currentUser) {
      list.innerHTML = "<p class='hint'>Sign in to see alerts.</p>";
      return;
    }

    if (!items?.length) {
      list.innerHTML = "<p class='hint'>No alerts yet.</p>";
      return;
    }

    list.innerHTML = items
      .map((n) => {
        const when = n.created_at ? new Date(n.created_at).toLocaleString() : "";
        const unread = n.read ? "" : " <span class='badge premium' style='font-size:10px;'>NEW</span>";
        const title = escapeHtml(n.title || n.type || "Alert");
        const body = escapeHtml(n.body || "");
        return `
          <div class="inbox-item" data-nid="${n.id}">
            <strong>${title}${unread}</strong>
            <p style="margin:6px 0;">${body}</p>
            <small class="hint">${when}</small>
          </div>
        `;
      })
      .join("");

    // mark as read on click
    list.querySelectorAll(".inbox-item").forEach((el) => {
      el.onclick = async () => {
        const id = el.getAttribute("data-nid");
        try {
          await supa().from("notifications").update({ read: true }).eq("id", id);
          el.querySelector(".badge")?.remove?.();
        } catch (e) {
          console.warn("mark read failed", e);
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

  async function load() {
    const list = ensureListEl();
    if (list) list.innerHTML = "<p class='hint'>Loading…</p>";

    if (!window.currentUser) {
      render([]);
      return;
    }

    const { data, error } = await supa()
      .from("notifications")
      .select("*")
      .eq("user_id", window.currentUser.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("notifications load error:", error);
      if (list) list.innerHTML = "<p class='hint'>Failed to load alerts (check console).</p>";
      return;
    }

    render(data || []);
    initRealtime();
  }

  function initRealtime() {
    if (!window.currentUser) return;

    // Only one channel at a time
    if (notifChannel) {
      try { supa().removeChannel(notifChannel); } catch {}
      notifChannel = null;
    }

    notifChannel = supa()
      .channel("notifications-" + window.currentUser.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${window.currentUser.id}`,
        },
        (payload) => {
          const n = payload?.new;
          if (!n) return;

          // refresh list (simple + reliable)
          load();

          // optional browser pop
          toast(n.title || "New alert", n.body || "");
        }
      )
      .subscribe();
  }

  // Helper for OTHER modules to create a notification for the CURRENT user only
  async function createForMe({ type = "generic", title = "", body = "", data = {} } = {}) {
    if (!window.currentUser) return;
    const { error } = await supa().from("notifications").insert({
      user_id: window.currentUser.id,
      type,
      title,
      body,
      data,
      read: false,
    });
    if (error) console.warn("createForMe error:", error);
  }

  window.Notifications = {
    init,
    load,
    toast,
    createForMe,
  };
})();

// notifications.js — in-app Alerts tab + browser notifications (BuyerFinder)
(function () {
  console.error("🔔 NOTIFICATIONS.JS LOADED (alerts)");

  function supa() { return window.supa; }

  let notificationsEnabled = false;
  let alertsChannel = null;

  /* ---------- BROWSER NOTIFICATIONS ---------- */
  function initNotifications() {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return;
    }
    if (Notification.permission === "granted") {
      notificationsEnabled = true;
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        notificationsEnabled = permission === "granted";
      });
    }
  }

  function notify(title, body) {
    if (!notificationsEnabled) return;
    if (document.hasFocus()) return;
    try { new Notification(title, { body }); }
    catch (e) { console.warn("Notification failed", e); }
  }

  /* ---------- UI HELPERS ---------- */
  function ensureListEl() {
    // Prefer a list container inside the notifications view
    let el = document.getElementById("notifications-list") || document.getElementById("alerts-list");
    if (el) return el;

    const view = document.getElementById("view-notifications");
    if (view) {
      el = document.createElement("div");
      el.id = "notifications-list";
      view.appendChild(el);
      return el;
    }

    el = document.createElement("div");
    el.id = "notifications-list";
    document.body.appendChild(el);
    return el;
  }

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  async function markRead(id) {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user || !id) return;
    await client.from("alerts").update({ read: true }).eq("id", id);
  }

  /* ---------- LOAD ALERTS (ALERTS TAB) ---------- */
  async function load() {
    const client = supa();
    const user = window.currentUser;
    const list = ensureListEl();

    if (!user) { list.innerHTML = "<p class='hint'>Sign in to see alerts.</p>"; return; }
    if (!client) { list.innerHTML = "<p class='hint'>Supabase not ready yet.</p>"; return; }

    list.innerHTML = "<p class='hint'>Loading alerts...</p>";

    const { data: rows, error } = await client
      .from("alerts")
      .select("id,type,title,body,ref_id,meta,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("alerts load error:", error);
      list.innerHTML = "<p class='hint'>Failed to load alerts.</p>";
      return;
    }

    const alerts = rows || [];
    if (!alerts.length) { list.innerHTML = "<p class='hint'>No alerts yet.</p>"; return; }

    list.innerHTML = alerts.map(a => {
      const unread = a.read ? "" : " unread";
      const t = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "Alert");
      const b = a.body || "";
      return `
        <div class="alert-item${unread}" data-id="${a.id}" data-type="${a.type}" data-ref="${a.ref_id || ""}">
          <div class="alert-top">
            <strong>${t}</strong>
            <span class="muted" style="float:right;">${fmtTime(a.created_at)}</span>
          </div>
          <div class="muted">${b}</div>
        </div>
      `;
    }).join("");

    // Click behavior: open the right view
    list.querySelectorAll(".alert-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        const type = el.dataset.type;
        const ref = el.dataset.ref;

        // mark read first (best effort)
        markRead(id);

        // Route
        if (type === "match") {
          window.setActiveView?.("matches");
          window.Matches?.loadMatches?.();
          return;
        }

        if (type === "message") {
          // Prefer opening the conversation directly if Messages exposes openConversation
          if (ref) {
            window.setActiveView?.("chat");
            // some builds expose openConversation globally
            if (typeof window.openConversation === "function") {
              window.openConversation(ref);
            } else if (window.Messages && typeof window.Messages.openConversation === "function") {
              window.Messages.openConversation(ref);
            } else {
              // fallback: load inbox and let user tap
              window.Messages?.loadInbox?.();
            }
          } else {
            window.Messages?.loadInbox?.();
          }
          return;
        }

        // Default: just reload
        load();
      });
    });
  }

  /* ---------- REALTIME ---------- */
  function initRealtime() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    initNotifications(); // request permission early

    if (alertsChannel) client.removeChannel(alertsChannel);

    alertsChannel = client
      .channel("alerts-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const a = payload.new || {};
          // Browser notification
          const title = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "BuyerFinder");
          const body = a.body || "You have a new alert.";
          notify(title, body);

          // In-app list refresh (only if user is in app)
          load();
        }
      )
      .subscribe();
  }

  /* ---------- EXPOSE ---------- */
  window.Notifications = {
    init: initNotifications,
    notify,
    load,
    initRealtime
  };
})();

// notifications.js — in-app Alerts tab + browser notifications (BuyerFinder)
(function () {
  console.error("🔔 NOTIFICATIONS.JS LOADED (alerts)");

  function supa() { return window.supa; }

  let notificationsEnabled = false;
  let alertsChannel = null;

  /* ---------- BROWSER NOTIFICATIONS ---------- */
  function init() {
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

  /* ---------- BADGE ---------- */
  function setBadge(count) {
    const el = document.getElementById("nav-notifications");
    if (!el) return;

    let badge = el.querySelector(".bf-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "bf-badge";
      badge.style.position = "absolute";
      badge.style.top = "6px";
      badge.style.right = "10px";
      badge.style.minWidth = "18px";
      badge.style.height = "18px";
      badge.style.padding = "0 6px";
      badge.style.borderRadius = "999px";
      badge.style.fontSize = "12px";
      badge.style.lineHeight = "18px";
      badge.style.textAlign = "center";
      badge.style.background = "#ff3b30";
      badge.style.color = "#fff";
      badge.style.display = "none";
      badge.style.pointerEvents = "none";
      el.style.position = "relative";
      el.appendChild(badge);
    }

    const n = Number(count || 0);
    if (n > 0) {
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }

  async function refreshBadge() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    const { count, error } = await client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (!error) setBadge(count || 0);
  }

  /* ---------- UI HELPERS ---------- */
  function ensureListEl() {
    let el = document.getElementById("notifications-list") || document.getElementById("alerts-list");
    if (el) return el;

    const view = document.getElementById("view-notifications");
    if (view) {
      el = document.createElement("div");
      el.id = "notifications-list";
      el.style.overflowY = "auto";
      el.style.webkitOverflowScrolling = "touch";
      el.style.maxHeight = "calc(100vh - 160px)";
      view.appendChild(el);
      return el;
    }

    el = document.createElement("div");
    el.id = "notifications-list";
    el.style.overflowY = "auto";
    el.style.webkitOverflowScrolling = "touch";
    document.body.appendChild(el);
    return el;
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return ""; }
  }

  async function markRead(id) {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user || !id) return;

    await client.from("alerts").update({ read: true }).eq("id", id);
    refreshBadge();
  }

  /* ---------- LOAD ALERTS ---------- */
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
      list.innerHTML = "<p class='hint'>Failed to load alerts. (Did you create the alerts table + triggers?)</p>";
      return;
    }

    const alerts = rows || [];
    if (!alerts.length) { list.innerHTML = "<p class='hint'>No alerts yet.</p>"; refreshBadge(); return; }

    list.innerHTML = alerts.map(a => {
      const unread = a.read ? "" : " unread";
      const t = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "Alert");
      const b = a.body || "";
      return `
        <div class="alert-item${unread}" data-id="${a.id}" data-type="${a.type}" data-ref="${a.ref_id || ""}"
             style="padding:10px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:12px;margin:10px 12px;cursor:pointer;">
          <div class="alert-top" style="display:flex;justify-content:space-between;gap:12px;">
            <strong>${t}</strong>
            <span class="muted" style="opacity:.7;white-space:nowrap;">${fmtTime(a.created_at)}</span>
          </div>
          <div class="muted" style="opacity:.75;margin-top:4px;">${b}</div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".alert-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        const type = el.dataset.type;
        const ref = el.dataset.ref;

        markRead(id);

        if (type === "match") {
          window.setActiveView?.("matches");
          window.Matches?.loadMatches?.();
          return;
        }

        if (type === "message") {
          // Open conversation if possible
          if (ref) {
            window.Messages?.openConversation?.(ref);
          } else {
            window.Messages?.loadInbox?.();
          }
          return;
        }

        load();
      });
    });

    refreshBadge();
  }

  /* ---------- REALTIME ---------- */
  function initRealtime() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;

    init(); // request permission early
    refreshBadge();

    if (alertsChannel) client.removeChannel(alertsChannel);

    alertsChannel = client
      .channel("alerts-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const a = payload.new || {};
          const title = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "BuyerFinder");
          const body = a.body || "You have a new alert.";
          notify(title, body);
          load();
          refreshBadge();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
        () => refreshBadge()
      )
      .subscribe();
  }

  window.Notifications = { init, notify, load, initRealtime, refreshBadge };
})();

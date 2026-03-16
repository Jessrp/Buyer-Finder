// notifications.js — in-app Alerts tab + browser notifications (BuyrFindr)
(function () {
  console.error("📣 NOTIFICATIONS.JS LOADED (alerts)");

  function supa() { return window.supa; }

  let notificationsEnabled = false;
  let alertsChannel = null;

  /* ---------- INJECT STYLES ---------- */
  (function injectStyles() {
    if (document.getElementById("bf-alert-styles")) return;
    const style = document.createElement("style");
    style.id = "bf-alert-styles";
    style.textContent = `
      .alert-item {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
        cursor: pointer;
        transition: background 0.15s;
        border-radius: 10px;
        margin-bottom: 4px;
      }
      .alert-item:active {
        background: rgba(255,255,255,0.04);
      }
      .alert-item.unread {
        background: rgba(0, 223, 162, 0.07);
        border-left: 3px solid #00dfa2;
        padding-left: 13px;
      }
      .alert-item.unread strong {
        color: #00dfa2;
      }
      .alert-unread-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00dfa2;
        margin-right: 6px;
        flex-shrink: 0;
        box-shadow: 0 0 6px rgba(0,223,162,0.6);
        vertical-align: middle;
        position: relative;
        top: -1px;
      }
      .bf-mark-all-btn {
        background: transparent;
        border: 1px solid rgba(0,223,162,0.3);
        color: #00dfa2;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 0.15s;
        margin-bottom: 14px;
        display: block;
        margin-left: auto;
      }
      .bf-mark-all-btn:hover {
        background: rgba(0,223,162,0.08);
      }
    `;
    document.head.appendChild(style);
  })();

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
    try { return new Date(ts).toLocaleString(); } catch { return ""; }
  }

  async function markRead(id) {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user || !id) return;
    await client.from("alerts").update({ read: true }).eq("id", id);
    refreshBadge();
  }

  async function markAllRead() {
    const client = supa();
    const user = window.currentUser;
    if (!client || !user) return;
    await client.from("alerts").update({ read: true }).eq("user_id", user.id).eq("read", false);
    // Remove unread styling from all items
    document.querySelectorAll(".alert-item.unread").forEach(el => {
      el.classList.remove("unread");
      const dot = el.querySelector(".alert-unread-dot");
      if (dot) dot.remove();
    });
    setBadge(0);
  }

  function getMatchIdFromAlert(alertRow) {
    if (!alertRow) return "";
    if (alertRow.ref_id) return String(alertRow.ref_id);
    const meta = alertRow.meta;
    if (!meta) return "";
    try {
      const obj = (typeof meta === "string") ? JSON.parse(meta) : meta;
      return obj?.match_id ? String(obj.match_id) : "";
    } catch {
      return "";
    }
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
      list.innerHTML = "<p class='hint'>Failed to load alerts.</p>";
      return;
    }

    const alerts = rows || [];
    if (!alerts.length) { list.innerHTML = "<p class='hint'>No alerts yet.</p>"; refreshBadge(); return; }

    const unreadCount = alerts.filter(a => !a.read).length;

    // Mark all read button — only show if there are unread alerts
    const markAllHtml = unreadCount > 0
      ? `<button class="bf-mark-all-btn" id="bf-mark-all-btn">✓ Mark all as read</button>`
      : "";

    list.innerHTML = markAllHtml + alerts.map(a => {
      const isUnread = !a.read;
      const unreadClass = isUnread ? " unread" : "";
      const dot = isUnread ? `<span class="alert-unread-dot"></span>` : "";
      const t = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "Alert");
      const b = a.body || "";
      const ref = a.ref_id ? String(a.ref_id) : "";
      const meta = (a.meta != null) ? (typeof a.meta === "string" ? a.meta : JSON.stringify(a.meta)) : "";

      return `
        <div class="alert-item${unreadClass}"
             data-id="${a.id}"
             data-type="${a.type || ""}"
             data-ref="${ref}"
             data-meta='${meta.replace(/'/g, "&#39;")}'>
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="display:flex;align-items:center;">${dot}<strong>${t}</strong></div>
            <span class="muted" style="opacity:.7;font-size:11px;white-space:nowrap;">${fmtTime(a.created_at)}</span>
          </div>
          <div class="muted" style="opacity:.85;margin-top:6px;padding-left:${isUnread ? "14px" : "0"}">${b}</div>
        </div>
      `;
    }).join("");

    // Mark all button handler
    document.getElementById("bf-mark-all-btn")?.addEventListener("click", markAllRead);

    list.querySelectorAll(".alert-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id   = el.dataset.id;
        const type = el.dataset.type;
        const ref  = el.dataset.ref || "";

        let meta = el.dataset.meta || "";
        try { meta = meta ? JSON.parse(meta) : null; } catch { /* leave as string */ }

        // Mark read visually immediately
        if (el.classList.contains("unread")) {
          el.classList.remove("unread");
          const dot = el.querySelector(".alert-unread-dot");
          if (dot) dot.remove();
          // Hide mark-all button if no more unread
          const remaining = list.querySelectorAll(".alert-item.unread").length;
          if (remaining === 0) {
            document.getElementById("bf-mark-all-btn")?.remove();
          }
        }

        await markRead(id);

        if (type === "match") {
          const matchId = ref || (meta?.match_id ? String(meta.match_id) : "");
          window.setActiveView?.("matches");
          if (matchId && window.Matches?.openMatch) {
            window.Matches.openMatch(matchId);
          } else {
            window.Matches?.loadMatches?.();
          }
          return;
        }

        if (type === "message") {
          if (ref) window.Messages?.openConversation?.(ref);
          else window.Messages?.loadInbox?.();
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

    init();
    refreshBadge();

    if (alertsChannel) client.removeChannel(alertsChannel);

    alertsChannel = client
      .channel("alerts-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const a = payload.new || {};
          const title = a.title || (a.type === "match" ? "New Match" : a.type === "message" ? "New Message" : "BuyrFindr");
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
        
